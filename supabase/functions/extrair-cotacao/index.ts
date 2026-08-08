// supabase/functions/extrair-cotacao/index.ts
//
// Lê o orçamento que o fornecedor mandou (PDF ou imagem) e devolve os preços
// já casados com os itens da cotação. A chave da API fica só no servidor.
//
// O casamento é feito PELA IA, não por string matching: o fornecedor escreve
// "CIM CPII 50KG" onde a cotação diz "Cimento CP II 50kg", e comparar texto
// erraria. O que a função manda é a lista de itens com seus ids, e o que
// recebe de volta é o id do item que cada linha do documento representa.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { extrairJson, provedorValido, ErroIA, type Provedor } from "../_shared/ia.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIPOS_ACEITOS = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

interface ItemDaCotacao {
  id: string;
  descricao: string;
  unidade: string;
  quantidade: number;
}

interface LinhaExtraida {
  cotacao_item_id: string | null;
  descricao_documento: string;
  marca: string | null;
  valor_unitario: number | null;
  valor_total: number | null;
  confianca: "alta" | "media" | "baixa";
}

interface Extracao {
  fornecedor: string | null;
  condicao_pagamento: string | null;
  frete: number | null;
  validade: string | null;
  linhas: LinhaExtraida[];
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    fornecedor: { type: ["string", "null"] },
    condicao_pagamento: { type: ["string", "null"] },
    frete: { type: ["number", "null"] },
    validade: { type: ["string", "null"] },
    linhas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          cotacao_item_id: { type: ["string", "null"] },
          descricao_documento: { type: "string" },
          marca: { type: ["string", "null"] },
          valor_unitario: { type: ["number", "null"] },
          valor_total: { type: ["number", "null"] },
          confianca: { type: "string", enum: ["alta", "media", "baixa"] },
        },
        required: [
          "cotacao_item_id",
          "descricao_documento",
          "marca",
          "valor_unitario",
          "valor_total",
          "confianca",
        ],
      },
    },
  },
  required: ["fornecedor", "condicao_pagamento", "frete", "validade", "linhas"],
};

function montarPrompt(itens: ItemDaCotacao[]): string {
  const lista = itens
    .map((i) => `- id: ${i.id} | ${i.descricao} | ${i.quantidade} ${i.unidade}`)
    .join("\n");

  return `Este documento é um orçamento de fornecedor de material de construção.

Extraia os preços e case cada linha do documento com um dos itens da cotação abaixo.

ITENS DA COTAÇÃO:
${lista}

Regras de casamento:
- Case pelo insumo, não pelo texto literal. "CIM CPII 50KG" é o mesmo insumo que "Cimento CP II 50kg".
- Se uma linha do documento não corresponder a nenhum item da lista, devolva cotacao_item_id null — ela será mostrada ao usuário para decidir.
- Nunca invente um id: use exatamente um dos ids acima, ou null.
- confianca: "alta" quando descrição e unidade batem; "media" quando o insumo é o mesmo mas a apresentação difere (embalagem, marca); "baixa" quando é palpite.

Regras de valores:
- valor_unitario e valor_total são números com ponto decimal. R$ 1.234,56 vira 1234.56.
- Se o documento traz só o total da linha, preencha valor_total e deixe valor_unitario null (e vice-versa).
- frete é o valor do frete do orçamento inteiro, não por linha.
- Não invente valores que não estão no documento — use null.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const { arquivo, media_type, nome, itens, provedor, modelo } = await req.json();

    if (!arquivo) return json({ error: "Nenhum arquivo enviado." }, 400);
    if (!TIPOS_ACEITOS.includes(media_type)) {
      return json({ error: `Formato não aceito: ${media_type}. Envie PDF, PNG, JPEG ou WebP.` }, 400);
    }
    if (!Array.isArray(itens) || itens.length === 0) {
      return json({ error: "A cotação precisa ter itens antes de importar um orçamento." }, 400);
    }

    // O provedor vem da tela (que o lê do cadastro em Segurança). Sem escolha
    // explícita, cai no padrão do ambiente — e só então em Anthropic.
    const escolhido = provedor ?? Deno.env.get("IA_PROVEDOR") ?? "anthropic";
    if (!provedorValido(escolhido)) {
      return json({ error: `Provedor inválido: ${escolhido}.` }, 400);
    }

    const extracao = await extrairJson<Extracao>({
      provedor: escolhido as Provedor,
      modelo: modelo || Deno.env.get("IA_MODELO") || undefined,
      prompt: montarPrompt(itens as ItemDaCotacao[]),
      arquivos: [{ base64: arquivo, mediaType: media_type, nome }],
      schema: SCHEMA,
    });

    // Barreira contra id alucinado: o front vai usar esses ids para gravar
    // preço, e um id inventado gravaria na linha errada.
    const idsValidos = new Set((itens as ItemDaCotacao[]).map((i) => i.id));
    const linhas = (extracao.linhas || []).map((l) => ({
      ...l,
      cotacao_item_id: l.cotacao_item_id && idsValidos.has(l.cotacao_item_id) ? l.cotacao_item_id : null,
    }));

    return json({ ...extracao, linhas, provedor: escolhido });
  } catch (err) {
    if (err instanceof ErroIA) return json({ error: err.message }, err.status);
    return json({ error: err instanceof Error ? err.message : "Erro inesperado" }, 500);
  }
});
