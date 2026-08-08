import { useState } from 'react';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useActiveCompany } from '@/hooks/useAuth';
import { ErpLayout, money } from '@/components/ErpLayout';
import { ComprasSubNav } from '@/components/ComprasSubNav';
import {
  useCotacaoMapa,
  useSalvarPreco,
  useRanking,
  useCondicoesPagamento,
  useAdicionarFornecedor,
  useCriarFornecedorAvulso,
  useRemoverFornecedor,
  useAtualizarCondicoesFornecedor,
  useRemoverItemCotacao,
  useGerarOrdensDaCotacao,
} from '@/modules/compras/ui/hooks';
import MapaCotacaoTabela from '@/modules/compras/ui/components/MapaCotacaoTabela';
import SeletorFornecedor from '@/modules/compras/ui/components/SeletorFornecedor';
import { ResumoRanking } from '@/modules/compras/ui/components/ResumoRanking';
import ModalGerarOC from '@/modules/compras/ui/components/ModalGerarOC';
import ModalImportarOrcamento from '@/modules/compras/ui/components/ModalImportarOrcamento';
import { rotuloFornecedor } from '@/modules/compras/ui/components/SeletorFornecedor';
import {
  PainelCotacao,
  dadosCotacaoDe,
  type DadosCotacao,
  type AbaCotacao,
} from '@/modules/compras/ui/components/PainelCotacao';
import { cotacoesRepository } from '@/modules/compras/data/cotacoes.repository';
import type { Cotacao, CotacaoItem, CotacaoFornecedor, CotacaoPreco } from '@/types';

export const Route = createFileRoute('/_authenticated/erp/compras/cotacoes/$cotacaoId')({
  head: () => ({ meta: [{ title: 'Mapa de Cotação — ObraFlow Gestão' }] }),
  component: MapaCotacao,
});

function MapaCotacao() {
  const { cotacaoId } = Route.useParams();
  const { companyId } = useActiveCompany();
  const navigate = useNavigate();
  const { data: mapa, isLoading } = useCotacaoMapa(companyId || '', cotacaoId || '');
  const salvarPrecoMutation = useSalvarPreco(companyId || '', cotacaoId || '');
  const rankingQuery = useRanking(companyId || '', cotacaoId || '', 0.015);
  const condicoesPagamentoQuery = useCondicoesPagamento(companyId || '');
  const adicionarFornecedorMutation = useAdicionarFornecedor(companyId || '', cotacaoId || '');
  const criarFornecedorAvulsoMutation = useCriarFornecedorAvulso(companyId || '', cotacaoId || '');
  const removerFornecedorMutation = useRemoverFornecedor(companyId || '', cotacaoId || '');
  const condicoesMutation = useAtualizarCondicoesFornecedor(companyId || '', cotacaoId || '');
  const removerItemMutation = useRemoverItemCotacao(companyId || '', cotacaoId || '');
  const gerarOrdensMutation = useGerarOrdensDaCotacao(companyId || '', cotacaoId || '');
  const [showOC, setShowOC] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);
  const [importando, setImportando] = useState<CotacaoFornecedor | null>(null);
  const [dados, setDados] = useState<DadosCotacao | null>(null);
  const [aba, setAba] = useState<AbaCotacao>('mapa');

  // Cada célula grava no próprio blur. Isto conta quantas dessas gravações
  // ainda estão no ar — é o que o rodapé mostra enquanto o usuário digita.
  const gravacoesEmVoo = useIsMutating();
  const queryClient = useQueryClient();

  /**
   * O mapa não tem "rascunho não salvo" de verdade: o que existe é o campo que
   * ainda está com o cursor dentro. Tirar o foco dele é o que falta para o
   * valor virar gravação — por isso Salvar começa por um blur e só então
   * espera a fila esvaziar.
   *
   * `queryClient.isMutating()` (imperativo) em vez do hook: dentro do laço
   * precisamos do número de agora, não do capturado no render.
   */
  async function salvar(): Promise<boolean> {
    (document.activeElement as HTMLElement | null)?.blur();
    // Um tick para o onBlur da célula disparar a mutation antes de contarmos.
    await new Promise((r) => setTimeout(r, 60));

    // Teto de ~10s: rede presa não pode deixar o botão girando para sempre.
    for (let i = 0; i < 80 && queryClient.isMutating() > 0; i += 1) {
      await new Promise((r) => setTimeout(r, 120));
    }
    if (queryClient.isMutating() > 0) {
      setErro('Ainda há valores sendo gravados. Aguarde um instante e tente de novo.');
      return false;
    }
    setSalvoEm(new Date());
    return true;
  }

  async function salvarEVoltar() {
    if (await salvar()) navigate({ to: '/erp/compras/cotacoes' });
  }

  /** Grava campo a campo, no blur — mesma regra das células do mapa. */
  async function salvarCampoCotacao(patch: Record<string, unknown>) {
    try {
      await cotacoesRepository.atualizarCotacao(cotacaoId, patch);
      setSalvoEm(new Date());
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar os dados da cotação.');
    }
  }

  const mapaTyped = mapa as any;
  const cotacao: Cotacao | null = mapaTyped?.cotacao || null;
  const itens: CotacaoItem[] = mapaTyped?.items || [];
  const fornecedores: CotacaoFornecedor[] = mapaTyped?.fornecedores || [];
  const precos = new Map<string, CotacaoPreco>();
  (mapaTyped?.precos || []).forEach((p: CotacaoPreco) =>
    precos.set(`${p.cotacao_fornecedor_id}|${p.cotacao_item_id}`, p),
  );

  // Uma OC por fornecedor com ao menos um preço escolhido — espelha o que a
  // rpc gerar_ordens_da_cotacao vai fazer, só que aqui é só a prévia.
  const grupos = fornecedores
    .map((f) => {
      const linhas = itens
        .map((item) => ({ item, preco: precos.get(`${f.id}|${item.id}`) }))
        .filter((l): l is { item: CotacaoItem; preco: CotacaoPreco } => Boolean(l.preco?.escolhido));
      const subtotal = linhas.reduce(
        (s, l) => s + Number(l.preco.valor_unitario || 0) * Number(l.item.quantidade),
        0,
      );
      return { fornecedor: f, linhas, total: subtotal + Number(f.frete || 0) };
    })
    .filter((g) => g.linhas.length > 0);

  const totalSelecionado = grupos.reduce((s, g) => s + g.total, 0);

  // Popula o painel na primeira carga. Depois disso o estado é do formulário —
  // recarregar a cada refetch descartaria o que o usuário está digitando.
  if (cotacao && dados === null) {
    setDados(dadosCotacaoDe(cotacao as unknown as Record<string, unknown>));
  }

  function onSalvarPreco(fornId: string, itemId: string, campo: 'valor_unitario' | 'marca', valor: string) {
    const patch =
      campo === 'valor_unitario' ? { valor_unitario: Number(valor) || 0 } : { marca: valor || null };
    salvarPrecoMutation.mutate(
      { cotacaoFornecedorId: fornId, cotacaoItemId: itemId, patch },
      { onError: (err) => setErro(err.message) },
    );
  }

  function onToggleEscolhido(fornId: string, itemId: string) {
    const atual = precos.get(`${fornId}|${itemId}`);
    salvarPrecoMutation.mutate(
      {
        cotacaoFornecedorId: fornId,
        cotacaoItemId: itemId,
        patch: { escolhido: !atual?.escolhido },
      },
      { onError: (err) => setErro(err.message) },
    );
  }

  async function onRemoverItem(itemId: string) {
    if (!confirm('Remover este item da cotação? Ele volta para a tela de Requisição.')) return;
    await removerItemMutation.mutateAsync({ cotacaoItemId: itemId });
  }

  async function onRemoverFornecedor(cotacaoFornecedorId: string) {
    if (!confirm('Remover este fornecedor da cotação? Os preços dele serão perdidos.')) return;
    try {
      await removerFornecedorMutation.mutateAsync({ cotacaoFornecedorId });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao remover o fornecedor.');
    }
  }

  if (isLoading || !cotacao) {
    return (
      <ErpLayout title="Mapa de Cotação">
        <p className="text-muted-foreground">Carregando...</p>
      </ErpLayout>
    );
  }

  return (
    <ErpLayout
      title={`Cotação ${String(cotacao.numero).padStart(6, '0')}`}
      breadcrumb={
        <>
          <Link to="/erp/compras/requisicoes" className="hover:text-cta">
            Compras
          </Link>
          {' / '}Cotação
        </>
      }
    >
      <ComprasSubNav />

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Obra</p>
          <p className="mt-1 text-sm font-semibold">{cotacao.obra?.nome || '—'}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Itens</p>
          <p className="mt-1 text-sm font-semibold">{itens.length}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Fornecedores</p>
          <p className="mt-1 text-sm font-semibold">{fornecedores.length}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Compra selecionada</p>
          <p className="mt-1 text-lg font-bold text-cta">{money(totalSelecionado)}</p>
        </div>
      </div>

      {erro && (
        <p className="mb-4 rounded-lg border border-err/40 bg-err/10 px-4 py-2 text-sm text-err">{erro}</p>
      )}

      {/* As abas mandam no que aparece abaixo. O ranking e o seletor de
          fornecedor pertencem ao mapa, então acompanham a aba dele. */}
      {dados && (
        <PainelCotacao
          companyId={companyId || ''}
          cotacaoId={cotacaoId}
          valor={dados}
          aba={aba}
          onAba={setAba}
          onChange={setDados}
          onSalvarCampo={(patch) => void salvarCampoCotacao(patch)}
          condicoesPagamento={condicoesPagamentoQuery.data || []}
        />
      )}

      {aba === 'mapa' && rankingQuery.data && <ResumoRanking rankings={rankingQuery.data} />}

      {aba === 'mapa' && (
      <div className="rounded-lg border border-line bg-card p-4 mb-4 flex flex-wrap gap-3 items-center">
        <span className="text-sm font-semibold">Adicionar fornecedor:</span>
        <SeletorFornecedor
          companyId={companyId || ''}
          jaNaCotacao={new Set(fornecedores.map((f) => f.fornecedor_id))}
          ocupado={
            adicionarFornecedorMutation.status === 'pending' ||
            criarFornecedorAvulsoMutation.status === 'pending'
          }
          onSelecionar={async (fornecedorId) => {
            try {
              await adicionarFornecedorMutation.mutateAsync({ fornecedorId });
            } catch (err) {
              setErro(err instanceof Error ? err.message : 'Erro ao adicionar o fornecedor.');
            }
          }}
          onCriarAvulso={async (dados) => {
            // Deixa o erro subir: o formulário do seletor precisa dele para
            // manter o cadastro aberto com o que o usuário digitou.
            await criarFornecedorAvulsoMutation.mutateAsync(dados);
          }}
        />
      </div>
      )}

      {aba === 'mapa' && (
      <div className="mb-6">
        <MapaCotacaoTabela
          items={itens}
          fornecedores={fornecedores}
          precos={precos}
          onSalvarPreco={onSalvarPreco}
          onToggleEscolhido={onToggleEscolhido}
          onRemoverItem={onRemoverItem}
          onRemoverFornecedor={onRemoverFornecedor}
          onImportarOrcamento={(f) => setImportando(f)}
          condicoesPagamento={condicoesPagamentoQuery.data || []}
          onSalvarCondicoes={(cotacaoFornecedorId, patch) =>
            condicoesMutation.mutate(
              { cotacaoFornecedorId, patch },
              { onError: (err) => setErro(err.message) },
            )
          }
        />
      </div>
      )}

      {/* Espaço para a barra fixa não cobrir a última linha da tabela. */}
      <div className="h-20" />

      {/*
        Barra de ações fixa: navegação à esquerda, estado no meio, ação
        principal à direita. Fica colada no rodapé porque o mapa é largo e
        rolável — com os botões no fim do documento, quem estivesse no meio da
        tabela teria de rolar até embaixo só para sair da tela.
      */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-6 py-3">
          <button
            type="button"
            onClick={() => navigate({ to: '/erp/compras/cotacoes' })}
            className="rounded-lg bg-side px-4 py-2.5 text-sm font-semibold hover:bg-side/80"
          >
            ← Voltar
          </button>

          <span className="min-w-0 flex-1 text-xs text-muted-foreground">
            {gravacoesEmVoo > 0
              ? 'Salvando alterações...'
              : salvoEm
                ? `Salvo às ${salvoEm.toLocaleTimeString('pt-BR')}`
                : 'Cada valor é gravado ao sair do campo.'}
          </span>

          <button
            type="button"
            onClick={() => void salvar()}
            className="rounded-lg bg-side px-4 py-2.5 text-sm font-semibold hover:bg-side/80"
          >
            Salvar
          </button>

          <button
            type="button"
            onClick={() => void salvarEVoltar()}
            className="rounded-lg bg-side px-4 py-2.5 text-sm font-semibold hover:bg-side/80"
          >
            Salvar e voltar
          </button>

          <button
            type="button"
            className="btn-cta disabled:opacity-50"
            disabled={grupos.length === 0}
            title={grupos.length === 0 ? 'Marque ao menos um preço como escolhido' : undefined}
            onClick={async () => {
              if (await salvar()) setShowOC(true);
            }}
          >
            Gerar ordens de compra
          </button>
        </div>
      </div>

      {importando && (
        <ModalImportarOrcamento
          itens={itens}
          nomeFornecedor={importando.fornecedor ? rotuloFornecedor(importando.fornecedor) : '—'}
          onClose={() => setImportando(null)}
          onAplicar={async (precos, condicoes) => {
            // Sequencial de propósito: salvarPreco faz update-ou-insert por
            // par (fornecedor, item), e disparar tudo em paralelo faria as
            // inserções competirem pela mesma linha.
            for (const p of precos) {
              await salvarPrecoMutation.mutateAsync({
                cotacaoFornecedorId: importando.id,
                cotacaoItemId: p.cotacaoItemId,
                patch: { valor_unitario: p.valorUnitario, marca: p.marca },
              });
            }

            // A condição só entra se bater com o cadastro — o documento pode
            // trazer "30/60 dd" e a empresa ter "Boleto 30/60".
            const cadastradas = condicoesPagamentoQuery.data || [];
            const condicao = cadastradas.find(
              (c) => c.nome.toLowerCase() === (condicoes.condicaoPagamento || '').toLowerCase(),
            );
            const patch: Record<string, unknown> = {};
            if (condicao) patch.condicao_pagamento = condicao.nome;
            if (condicoes.frete !== null) patch.frete = condicoes.frete;
            if (Object.keys(patch).length > 0) {
              await condicoesMutation.mutateAsync({
                cotacaoFornecedorId: importando.id,
                patch,
              });
            }
          }}
        />
      )}

      {showOC && (
        <ModalGerarOC
          grupos={grupos}
          onClose={() => setShowOC(false)}
          onGerado={async () => {
            await gerarOrdensMutation.mutateAsync();
            setShowOC(false);
            navigate({ to: '/erp/compras/ordens' });
          }}
        />
      )}
    </ErpLayout>
  );
}

export default MapaCotacao;
