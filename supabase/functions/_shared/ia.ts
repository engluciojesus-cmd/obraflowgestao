// ============================================================================
// Camada de IA agnóstica de provedor.
//
// A extração não sabe qual IA está atrás dela: entra {arquivo, prompt, schema},
// sai texto JSON. Trocar Claude por Gemini ou GPT é uma linha de configuração —
// que é exatamente o que a aba Segurança vai mexer depois.
//
// HTTP direto em vez de SDK: são três provedores no mesmo arquivo, e dois deles
// não têm SDK para Deno. Misturar SDK num e fetch nos outros deixaria o
// adaptador incoerente.
// ============================================================================

export type Provedor = "anthropic" | "openai" | "google";

/** Um anexo já em base64, com o mime type que o provedor precisa saber. */
export interface ArquivoIA {
  /** base64 puro, sem o prefixo `data:`. */
  base64: string;
  /** "application/pdf", "image/png", "image/jpeg"... */
  mediaType: string;
  nome?: string;
}

export interface PedidoIA {
  provedor: Provedor;
  /** Sobrescreve o modelo padrão do provedor. */
  modelo?: string;
  prompt: string;
  arquivos: ArquivoIA[];
  /** JSON Schema do retorno. Só o Anthropic o aplica de verdade hoje. */
  schema?: Record<string, unknown>;
  maxTokens?: number;
}

/**
 * Modelos padrão por provedor.
 *
 * Os dois de fora da Anthropic são pontos de partida — quem usa OpenAI ou
 * Google costuma ter preferência de modelo e conta própria, e a tela de
 * Segurança vai permitir trocar sem mexer em código.
 */
const MODELO_PADRAO: Record<Provedor, string> = {
  anthropic: "claude-opus-5",
  openai: "gpt-4o",
  google: "gemini-2.0-flash",
};

const ENV_CHAVE: Record<Provedor, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_API_KEY",
};

export class ErroIA extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

function chaveDoProvedor(provedor: Provedor): string {
  const nome = ENV_CHAVE[provedor];
  const chave = Deno.env.get(nome);
  if (!chave) {
    throw new ErroIA(
      `${nome} não configurada. Cadastre-a como secret do projeto Supabase para usar o provedor "${provedor}".`,
      500,
    );
  }
  return chave;
}

function ehImagem(mediaType: string) {
  return mediaType.startsWith("image/");
}

/** Remove cercas de markdown que todo provedor teima em colocar às vezes. */
function limparJson(texto: string): string {
  return texto.replace(/```json/gi, "").replace(/```/g, "").trim();
}

// ----------------------------------------------------------------------------
// Anthropic — Messages API
// PDF entra como bloco `document`; imagem como bloco `image`. Nativo, sem OCR.
// ----------------------------------------------------------------------------

async function chamarAnthropic(pedido: PedidoIA): Promise<string> {
  const blocos = pedido.arquivos.map((arq) =>
    ehImagem(arq.mediaType)
      ? {
          type: "image",
          source: { type: "base64", media_type: arq.mediaType, data: arq.base64 },
        }
      : {
          type: "document",
          source: { type: "base64", media_type: arq.mediaType, data: arq.base64 },
        },
  );

  const corpo: Record<string, unknown> = {
    model: pedido.modelo || MODELO_PADRAO.anthropic,
    max_tokens: pedido.maxTokens ?? 8000,
    messages: [{ role: "user", content: [...blocos, { type: "text", text: pedido.prompt }] }],
  };

  // Structured outputs: o retorno é validado contra o schema pelo próprio
  // servidor, então não precisamos torcer para o JSON vir bem formado.
  if (pedido.schema) {
    corpo.output_config = { format: { type: "json_schema", schema: pedido.schema } };
  }

  const resposta = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": chaveDoProvedor("anthropic"),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(corpo),
  });

  if (!resposta.ok) throw new ErroIA(`Anthropic: ${await resposta.text()}`);

  const dados = await resposta.json();
  // Classificadores podem recusar o pedido com HTTP 200 — sem checar isso, o
  // `content` vem vazio e o erro apareceria como "JSON inválido".
  if (dados.stop_reason === "refusal") {
    throw new ErroIA("O provedor recusou processar este documento.", 422);
  }

  return limparJson(
    (dados.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join(""),
  );
}

// ----------------------------------------------------------------------------
// OpenAI — Responses API
// Arquivo vai como data URL dentro de input_file / input_image.
// ----------------------------------------------------------------------------

async function chamarOpenAI(pedido: PedidoIA): Promise<string> {
  const partes = pedido.arquivos.map((arq) =>
    ehImagem(arq.mediaType)
      ? { type: "input_image", image_url: `data:${arq.mediaType};base64,${arq.base64}` }
      : {
          type: "input_file",
          filename: arq.nome || "cotacao.pdf",
          file_data: `data:${arq.mediaType};base64,${arq.base64}`,
        },
  );

  const resposta = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${chaveDoProvedor("openai")}`,
    },
    body: JSON.stringify({
      model: pedido.modelo || MODELO_PADRAO.openai,
      input: [{ role: "user", content: [...partes, { type: "input_text", text: pedido.prompt }] }],
    }),
  });

  if (!resposta.ok) throw new ErroIA(`OpenAI: ${await resposta.text()}`);

  const dados = await resposta.json();
  // `output_text` é a conveniência; o caminho longo cobre versões que não a mandam.
  const texto: string =
    dados.output_text ??
    (dados.output || [])
      .flatMap((item: { content?: { type: string; text?: string }[] }) => item.content || [])
      .filter((c: { type: string }) => c.type === "output_text")
      .map((c: { text: string }) => c.text)
      .join("");

  return limparJson(texto || "");
}

// ----------------------------------------------------------------------------
// Google — Gemini generateContent
// PDF e imagem entram do mesmo jeito: inline_data com mime_type.
// ----------------------------------------------------------------------------

async function chamarGoogle(pedido: PedidoIA): Promise<string> {
  const modelo = pedido.modelo || MODELO_PADRAO.google;
  const partes = pedido.arquivos.map((arq) => ({
    inline_data: { mime_type: arq.mediaType, data: arq.base64 },
  }));

  const resposta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Chave em header, não em query string: URL vai parar em log de proxy.
        "x-goog-api-key": chaveDoProvedor("google"),
      },
      body: JSON.stringify({
        contents: [{ parts: [...partes, { text: pedido.prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );

  if (!resposta.ok) throw new ErroIA(`Google: ${await resposta.text()}`);

  const dados = await resposta.json();
  const texto: string = (dados.candidates?.[0]?.content?.parts || [])
    .map((p: { text?: string }) => p.text || "")
    .join("");

  return limparJson(texto);
}

// ----------------------------------------------------------------------------

const ADAPTADORES: Record<Provedor, (p: PedidoIA) => Promise<string>> = {
  anthropic: chamarAnthropic,
  openai: chamarOpenAI,
  google: chamarGoogle,
};

export function provedorValido(v: unknown): v is Provedor {
  return v === "anthropic" || v === "openai" || v === "google";
}

/** Chama o provedor escolhido e devolve o JSON já parseado. */
export async function extrairJson<T>(pedido: PedidoIA): Promise<T> {
  const adaptador = ADAPTADORES[pedido.provedor];
  if (!adaptador) throw new ErroIA(`Provedor desconhecido: ${pedido.provedor}`, 400);

  const texto = await adaptador(pedido);
  if (!texto) throw new ErroIA("O provedor devolveu resposta vazia.", 422);

  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new ErroIA(
      "Não foi possível interpretar o documento. Tente um PDF nítido ou uma foto mais legível.",
      422,
    );
  }
}
