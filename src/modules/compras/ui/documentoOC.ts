// ============================================================================
// Layout do documento da Ordem de Compra.
//
// Vive fora da tela porque agora tem dois consumidores: a lista autenticada
// (botão PDF) e a página pública que o fornecedor abre pelo link. Se cada uma
// montasse o próprio HTML, o documento que o comprador confere e o que o
// fornecedor recebe divergiriam com o tempo.
// ============================================================================

import { money } from '@/components/ErpLayout';

export interface ItemDocumentoOC {
  descricao: string;
  marca?: string | null;
  quantidade: number | string;
  unidade?: string | null;
  valor_unitario: number | string;
  ordem?: number;
}

export interface DadosDocumentoOC {
  numero: number | string;
  created_at: string;
  condicao_pagamento?: string | null;
  previsao_entrega?: string | null;
  frete?: number | string | null;
  observacao?: string | null;
  obra?: { nome?: string | null } | null;
  fornecedor?: { nome?: string | null; cnpj?: string | null } | null;
  itens?: ItemDocumentoOC[] | null;
  empresa?: { nome?: string | null; cnpj?: string | null; logo_url?: string | null } | null;
}

/**
 * Escapa texto antes de interpolar no HTML.
 *
 * Não é zelo teórico: o documento agora é servido numa página pública, e
 * descrição de item, nome de fornecedor e observação são digitados por
 * usuários. Sem isto, um `<script>` numa descrição executaria no navegador de
 * quem abrisse o link.
 */
function esc(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function dataBR(valor?: string | null): string {
  if (!valor) return '—';
  // `previsao_entrega` é um DATE puro: sem o T00:00:00 o JS interpreta como
  // UTC e a data volta um dia em qualquer fuso a oeste de Greenwich.
  const iso = valor.length === 10 ? `${valor}T00:00:00` : valor;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

export function totalDocumentoOC(oc: DadosDocumentoOC) {
  const subtotal = (oc.itens || []).reduce(
    (s, it) => s + Number(it.quantidade) * Number(it.valor_unitario),
    0,
  );
  const frete = Number(oc.frete || 0);
  return { subtotal, frete, total: subtotal + frete };
}

/**
 * HTML completo do documento. `autoImprimir` só é ligado no fluxo interno —
 * na página pública o fornecedor decide quando imprimir.
 */
export function montarDocumentoOC(oc: DadosDocumentoOC, autoImprimir = false): string {
  const itens = [...(oc.itens || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const { subtotal, frete, total } = totalDocumentoOC(oc);
  const numero = String(oc.numero).padStart(6, '0');
  const empresa = oc.empresa || {};

  const linhas = itens
    .map(
      (it, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${esc(it.descricao)}${it.marca ? ` <span class="marca">(${esc(it.marca)})</span>` : ''}</td>
        <td class="num">${esc(it.quantidade)} ${esc(it.unidade || '')}</td>
        <td class="num">${money(Number(it.valor_unitario))}</td>
        <td class="num">${money(Number(it.quantidade) * Number(it.valor_unitario))}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OC ${esc(numero)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #1a1a1a; font-size: 11px; margin: 0;
         background: #fff; padding: 16px; }
  header { display: flex; align-items: flex-start; justify-content: space-between;
           border-bottom: 2px solid #E8590C; padding-bottom: 10px; margin-bottom: 16px; }
  header img { max-height: 48px; max-width: 170px; object-fit: contain; }
  .empresa { font-size: 14px; font-weight: 700; }
  h1 { font-size: 15px; margin: 0 0 14px; color: #E8590C; }
  .bloco { border: 1px solid #ddd; margin-bottom: 10px; }
  .bloco .tit { background: #f0f0f0; padding: 5px 8px; font-weight: 700;
                font-size: 10px; text-transform: uppercase; }
  .bloco .corpo { padding: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
  .campo { display: flex; gap: 6px; }
  .campo .rot { color: #666; min-width: 88px; }
  table.itens { width: 100%; border-collapse: collapse; margin-top: 12px; }
  table.itens th { background: #f0f0f0; text-align: left; padding: 6px 8px;
                   border-bottom: 1px solid #999; font-size: 10px; text-transform: uppercase; }
  table.itens td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  .num { text-align: right; white-space: nowrap; }
  .marca { color: #777; font-size: 10px; }
  tfoot td { font-weight: 700; }
  .obs { margin-top: 14px; padding: 8px; background: #fafafa;
         border-left: 3px solid #E8590C; font-size: 10px; }
  footer { margin-top: 26px; padding-top: 8px; border-top: 1px solid #ddd;
           display: flex; justify-content: space-between; font-size: 9px; color: #888; }
  @media (max-width: 640px) { .bloco .corpo { grid-template-columns: 1fr; } }
</style></head><body>
  <header>
    <div>
      ${
        empresa.logo_url
          ? `<img src="${esc(empresa.logo_url)}" alt="">`
          : `<div class="empresa">${esc(empresa.nome)}</div>`
      }
    </div>
    <div style="text-align:right">
      <div style="font-weight:700">ORDEM DE COMPRA ${esc(numero)}</div>
      <div style="color:#777">${dataBR(oc.created_at)}</div>
    </div>
  </header>

  <h1>${esc(oc.obra?.nome || 'Sem obra vinculada')}</h1>

  <div class="bloco">
    <div class="tit">Dados da ordem de compra</div>
    <div class="corpo">
      <div class="campo"><span class="rot">Número</span><span>${esc(numero)}</span></div>
      <div class="campo"><span class="rot">Data</span><span>${dataBR(oc.created_at)}</span></div>
      <div class="campo"><span class="rot">Cond. pgto.</span><span>${esc(oc.condicao_pagamento || '—')}</span></div>
      <div class="campo"><span class="rot">Prev. entrega</span><span>${dataBR(oc.previsao_entrega)}</span></div>
    </div>
  </div>

  <div class="bloco">
    <div class="tit">Dados do fornecedor</div>
    <div class="corpo">
      <div class="campo"><span class="rot">Nome</span><span>${esc(oc.fornecedor?.nome || '—')}</span></div>
      <div class="campo"><span class="rot">CNPJ</span><span>${esc(oc.fornecedor?.cnpj || '—')}</span></div>
    </div>
  </div>

  <div class="bloco">
    <div class="tit">Faturamento</div>
    <div class="corpo">
      <div class="campo"><span class="rot">Empresa</span><span>${esc(empresa.nome || '—')}</span></div>
      <div class="campo"><span class="rot">CNPJ</span><span>${esc(empresa.cnpj || '—')}</span></div>
      <div class="campo"><span class="rot">Obra</span><span>${esc(oc.obra?.nome || '—')}</span></div>
    </div>
  </div>

  <table class="itens">
    <thead>
      <tr>
        <th style="width:26px">N.</th>
        <th>Item</th>
        <th class="num">Qtd.</th>
        <th class="num">Unit. (R$)</th>
        <th class="num">Total (R$)</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
    <tfoot>
      <tr><td colspan="4" class="num">Subtotal</td><td class="num">${money(subtotal)}</td></tr>
      <tr><td colspan="4" class="num">Frete</td><td class="num">${money(frete)}</td></tr>
      <tr><td colspan="4" class="num">TOTAL</td><td class="num">${money(total)}</td></tr>
    </tfoot>
  </table>

  ${oc.observacao ? `<div class="obs">${esc(oc.observacao)}</div>` : ''}

  <footer>
    <span>${esc(empresa.nome)}</span>
    <span>Gerado por ObraFlow Gestão</span>
  </footer>
${autoImprimir ? '  <script>window.onload = () => { window.print(); }<\/script>' : ''}
</body></html>`;
}

export default montarDocumentoOC;
