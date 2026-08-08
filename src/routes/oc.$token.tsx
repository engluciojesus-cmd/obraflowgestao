import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { money } from '@/components/ErpLayout';
import { montarDocumentoOC, type DadosDocumentoOC } from '@/modules/compras/ui/documentoOC';

/**
 * Página pública da Ordem de Compra — o fornecedor abre pelo link, sem login.
 *
 * Fica fora de `_authenticated` de propósito: é a única rota do sistema que
 * qualquer um alcança. O que a protege é o token de 64 caracteres na URL, e o
 * banco só devolve a OC quando ele bate exatamente (rpc `oc_publica`).
 */
export const Route = createFileRoute('/oc/$token')({
  head: () => ({ meta: [{ title: 'Ordem de Compra' }] }),
  component: OrdemCompraPublica,
});

interface OCPublica extends DadosDocumentoOC {
  status?: string | null;
  forma_pagamento?: string | null;
  parcelas?: string | null;
  desconto?: number | string | null;
  endereco_entrega?: string | null;
  fornecedor?: {
    nome?: string | null;
    fantasia?: string | null;
    cnpj?: string | null;
    vendedor?: string | null;
    telefone?: string | null;
    email?: string | null;
  } | null;
  empresa?: {
    nome?: string | null;
    razao_social?: string | null;
    cnpj?: string | null;
    ie?: string | null;
    telefone?: string | null;
    email?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
    cep?: string | null;
    logo_url?: string | null;
    contato_nome?: string | null;
    contato_telefone?: string | null;
    contato_email?: string | null;
  } | null;
}

function dataHoraBR(valor?: string | null) {
  if (!valor) return '—';
  const d = new Date(valor);
  return Number.isNaN(d.getTime())
    ? '—'
    : `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR')}`;
}

function dataBR(valor?: string | null) {
  if (!valor) return '—';
  const iso = valor.length === 10 ? `${valor}T00:00:00` : valor;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

function OrdemCompraPublica() {
  const { token } = Route.useParams();
  const [oc, setOc] = useState<OCPublica | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    supabase
      .rpc('oc_publica', { p_token: token })
      .then(({ data }) => {
        if (!ativo) return;
        setOc((data as OCPublica) ?? null);
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [token]);

  function imprimir() {
    if (!oc) return;
    const janela = window.open('', '_blank');
    if (!janela) {
      alert('Permita pop-ups neste site para gerar o PDF.');
      return;
    }
    janela.document.write(montarDocumentoOC(oc, true));
    janela.document.close();
  }

  if (carregando) {
    return <Moldura><p className="text-muted-foreground">Carregando...</p></Moldura>;
  }

  // Token inválido, revogado ou OC apagada — a mesma mensagem para os três, de
  // propósito: distinguir "não existe" de "foi revogado" ajudaria quem estivesse
  // testando tokens no braço.
  if (!oc) {
    return (
      <Moldura>
        <h1 className="mb-2 text-xl font-bold">Ordem de compra não encontrada</h1>
        <p className="text-sm text-muted-foreground">
          Este link não é válido ou foi desativado. Peça um novo link a quem enviou a ordem de compra.
        </p>
      </Moldura>
    );
  }

  const itens = [...(oc.itens || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const subtotal = itens.reduce((s, it) => s + Number(it.quantidade) * Number(it.valor_unitario), 0);
  const frete = Number(oc.frete || 0);
  const desconto = Number(oc.desconto || 0);
  const total = subtotal + frete - desconto;
  const empresa = oc.empresa || {};
  const forn = oc.fornecedor || {};

  const enderecoEmpresa = [
    [empresa.logradouro, empresa.numero].filter(Boolean).join(', '),
    empresa.complemento,
    empresa.bairro,
    [empresa.cidade, empresa.uf].filter(Boolean).join(' - '),
    empresa.cep,
  ]
    .filter((p) => p && String(p).trim())
    .join(' · ');

  return (
    <div className="min-h-screen bg-bg pb-24">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            {empresa.logo_url ? (
              <img src={empresa.logo_url} alt="" className="max-h-10 max-w-[140px] object-contain" />
            ) : (
              <span className="text-lg font-bold">{empresa.nome || 'ObraFlow'}</span>
            )}
          </div>
          <button type="button" onClick={imprimir} className="btn-cta text-sm">
            Baixar PDF
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-6">
        <h1 className="mb-1 text-center text-lg font-bold">Resumo da ordem de compra</h1>
        {oc.status && (
          <p className="mb-6 text-center text-xs uppercase tracking-wide text-cta">Status: {oc.status}</p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Bloco titulo={`Ordem de compra ${String(oc.numero).padStart(6, '0')}`}>
            <Linha rotulo="Criada em" valor={dataHoraBR(oc.created_at)} />
            <Linha rotulo="Parcelas" valor={oc.parcelas || 'À vista'} />
            <Linha rotulo="Condição de pagamento" valor={oc.condicao_pagamento || '—'} />
            <Linha rotulo="Forma de pagamento" valor={oc.forma_pagamento || '—'} />
            <Linha rotulo="Previsão de entrega" valor={dataBR(oc.previsao_entrega)} />
          </Bloco>

          <Bloco titulo="Fornecedor">
            <Linha rotulo="Fornecedor" valor={forn.nome || '—'} />
            {forn.fantasia && <Linha rotulo="Nome fantasia" valor={forn.fantasia} />}
            <Linha rotulo="CNPJ" valor={forn.cnpj || '—'} />
            <Linha rotulo="Vendedor" valor={forn.vendedor || '—'} />
            <Linha rotulo="Telefone" valor={forn.telefone || '—'} />
          </Bloco>
        </div>

        {oc.observacao && (
          <div className="mt-4 rounded-lg border-l-4 border-cta bg-card px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Observações</p>
            <p className="whitespace-pre-wrap text-sm">{oc.observacao}</p>
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Bloco titulo="Dados de faturamento">
            <Linha rotulo="Razão social" valor={empresa.razao_social || empresa.nome || '—'} />
            <Linha rotulo="CNPJ" valor={empresa.cnpj || '—'} />
            {empresa.ie && <Linha rotulo="Inscrição estadual" valor={empresa.ie} />}
            <Linha rotulo="Telefone" valor={empresa.telefone || '—'} />
            <Linha rotulo="E-mail" valor={empresa.email || '—'} />
            <Linha rotulo="Endereço" valor={enderecoEmpresa || '—'} />
          </Bloco>

          <Bloco titulo="Responsável pela compra">
            <Linha rotulo="Comprador" valor={empresa.nome || '—'} />
            <Linha rotulo="Contato" valor={empresa.contato_nome || '—'} />
            <Linha rotulo="Telefone" valor={empresa.contato_telefone || '—'} />
            <Linha rotulo="E-mail" valor={empresa.contato_email || '—'} />
          </Bloco>
        </div>

        <div className="mt-4">
          <Bloco titulo={oc.obra?.nome || 'Sem obra vinculada'}>
            <Linha rotulo="Endereço de entrega" valor={oc.endereco_entrega || '—'} />
          </Bloco>
        </div>

        <h2 className="mt-6 mb-2 text-sm font-bold">Itens ({itens.length})</h2>
        <div className="space-y-2">
          {itens.map((it, i) => (
            <div key={i} className="rounded-lg border border-line bg-card p-4">
              <p className="text-sm font-semibold">{it.descricao}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-side px-2 py-0.5">
                  {Number(it.quantidade)} {it.unidade || 'un'}
                </span>
                {it.marca && <span>Marca: {it.marca}</span>}
              </div>
              <div className="mt-3 flex gap-8 text-sm">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Valor unitário</p>
                  <p className="font-semibold">{money(Number(it.valor_unitario))}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Valor total</p>
                  <p className="font-semibold">
                    {money(Number(it.quantidade) * Number(it.valor_unitario))}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <h2 className="mt-6 mb-2 text-sm font-bold">Valores</h2>
        <div className="rounded-lg border border-line bg-card px-4 py-3">
          <Linha rotulo="Quantidade de itens" valor={String(itens.length)} />
          <Linha rotulo="Subtotal dos itens" valor={money(subtotal)} />
          <Linha rotulo="Total de descontos" valor={money(desconto)} />
          <Linha rotulo="Total de fretes" valor={money(frete)} />
        </div>
      </main>

      {/* Total fixo: a lista de itens pode ser longa, e o fornecedor confere o
          valor fechado antes de qualquer coisa. */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-line bg-cta text-cta-foreground">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <span className="text-sm font-bold uppercase">Total</span>
          <span className="text-lg font-bold">{money(total)}</span>
        </div>
      </div>
    </div>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-md rounded-lg border border-line bg-card p-6 text-center">{children}</div>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-card">
      <h2 className="border-b border-line px-4 py-2 text-xs font-bold uppercase text-muted-foreground">
        {titulo}
      </h2>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1 text-sm">
      <span className="shrink-0 text-xs text-muted-foreground">{rotulo}</span>
      <span className="text-right">{valor}</span>
    </div>
  );
}

export default OrdemCompraPublica;
