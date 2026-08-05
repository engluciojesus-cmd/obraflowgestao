// supabase/functions/ler-nota/index.ts
// Lê uma nota fiscal / romaneio a partir de uma imagem e devolve os itens em JSON.
// A chave da API fica só no servidor.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMPT = `Extraia os dados desta nota fiscal, romaneio ou cupom de compra de material de construção.

Responda APENAS com JSON válido, sem markdown e sem explicação, neste formato:
{
  "fornecedor": "nome do emitente",
  "documento": "número da nota",
  "data": "AAAA-MM-DD",
  "itens": [
    {
      "descricao": "descrição do material",
      "quantidade": 0,
      "unidade": "un",
      "valor_unitario": 0
    }
  ],
  "total": 0
}

Regras:
- quantidade e valor_unitario são números, use ponto como separador decimal
- se não conseguir ler algum campo, use null
- não invente itens que não estão no documento`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada nas secrets do projeto." }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { image, media_type } = await req.json();
    if (!image) {
      return new Response(JSON.stringify({ error: "Imagem não enviada." }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const resposta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: media_type || "image/jpeg",
                  data: image,
                },
              },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      return new Response(
        JSON.stringify({ error: `Falha ao ler o documento: ${detalhe}` }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const dados = await resposta.json();
    const texto = (dados.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("")
      .replace(/```json|```/g, "")
      .trim();

    let extraido;
    try {
      extraido = JSON.parse(texto);
    } catch {
      return new Response(
        JSON.stringify({ error: "Não foi possível interpretar o documento. Tente uma foto mais nítida." }),
        { status: 422, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(extraido), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro inesperado" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
