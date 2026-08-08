import { useEffect, useMemo, useState } from 'react';
import { useArvoreOrcamento, useCriarRequisicao } from '@/modules/suprimentos/ui/hooks';
import type { ArvoreOrcamento } from '@/modules/suprimentos/data/requisicoes.repository';
import { BuscaInsumo } from './BuscaInsumo';

interface LinhaItem {
  /** Identidade local da linha — `orcamentoItemId` não serve (linhas avulsas não têm). */
  chave: string;
  orcamentoItemId: string;
  insumoCanonicoId: string;
  descricao: string;
  quantidade: string;
  unidade: string;
  /** Quantidade do orçamento, para o usuário ver do que está partindo. */
  quantidadeOrcada?: number;
}

let contadorLinhas = 0;
function linhaAvulsa(): LinhaItem {
  contadorLinhas += 1;
  return {
    chave: `avulsa-${contadorLinhas}`,
    orcamentoItemId: '',
    insumoCanonicoId: '',
    descricao: '',
    quantidade: '',
    unidade: 'un',
  };
}

/**
 * Cria a requisição já em ABERTA com seus itens.
 *
 * A apropriação nasce aqui: o cabeçalho escolhe Orçamento → Fase → Serviço e
 * cada linha aponta para um item desse serviço. Quem guarda o vínculo é
 * `requisicao_itens.orcamento_item_id` — a migration 20260804010000 define que
 * compras vinculam por ITEM (medições é que vinculam por serviço).
 */
export function ModalNovaRequisicao({
  companyId,
  obras,
  solicitantes,
  solicitantePadrao,
  onClose,
  onCriada,
}: {
  companyId: string;
  obras: { id: string; nome: string }[];
  solicitantes: { id: string; nome: string }[];
  solicitantePadrao?: string;
  onClose: () => void;
  onCriada: (requisicaoId: string) => void;
}) {
  const [obraId, setObraId] = useState('');
  const [solicitanteId, setSolicitanteId] = useState(solicitantePadrao || '');
  const [orcamentoId, setOrcamentoId] = useState('');
  const [faseId, setFaseId] = useState('');
  const [servicoId, setServicoId] = useState('');
  const [dataNecessidade, setDataNecessidade] = useState('');
  const [observacao, setObservacao] = useState('');
  const [linhas, setLinhas] = useState<LinhaItem[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const criar = useCriarRequisicao(companyId);
  const salvando = criar.status === 'pending';

  const { data: arvore = [], isLoading: carregandoArvore } = useArvoreOrcamento(companyId, obraId);

  const orcamento: ArvoreOrcamento | undefined = arvore.find((o) => o.id === orcamentoId);
  const usaFases = Boolean(orcamento?.usaFases && orcamento.fases.length > 0);

  const servicosVisiveis = useMemo(() => {
    if (!orcamento) return [];
    return usaFases ? orcamento.servicos.filter((s) => s.faseId === faseId) : orcamento.servicos;
  }, [orcamento, usaFases, faseId]);

  const servico = servicosVisiveis.find((s) => s.id === servicoId);
  const itensDoServico = servico?.itens ?? [];

  // Trocar a obra invalida toda a árvore escolhida e a apropriação das linhas.
  useEffect(() => {
    setOrcamentoId('');
    setFaseId('');
    setServicoId('');
    setLinhas((prev) => prev.filter((l) => !l.orcamentoItemId));
  }, [obraId]);

  /**
   * ⭐ Escolher o serviço já traz os itens dele para o grid.
   *
   * A versão anterior fazia o usuário abrir um dropdown por linha e caçar o
   * item — com o orçamento na mão isso é digitação redundante: o banco já sabe
   * quais insumos aquele serviço tem, com descrição, unidade e quantidade.
   * Aqui ele só ajusta a quantidade que precisa agora e apaga o que não vai
   * pedir. Linhas avulsas criadas à mão sobrevivem à troca de serviço.
   */
  useEffect(() => {
    const doServico: LinhaItem[] = itensDoServico.map((item) => ({
      chave: `orc-${item.id}`,
      orcamentoItemId: item.id,
      insumoCanonicoId: '',
      descricao: item.descricao,
      quantidade: item.quantidade > 0 ? String(item.quantidade) : '',
      unidade: item.unidade || 'un',
      quantidadeOrcada: item.quantidade,
    }));
    setLinhas((prev) => [...doServico, ...prev.filter((l) => !l.orcamentoItemId)]);
    // itensDoServico é derivado de servicoId — a dependência real é o serviço.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicoId, orcamentoId, faseId]);

  // Obra com um orçamento só: não faz o usuário escolher o óbvio.
  useEffect(() => {
    if (!orcamentoId && arvore.length === 1) setOrcamentoId(arvore[0].id);
  }, [arvore, orcamentoId]);

  /** "Orçamento Global › Fase Cinza › Alvenaria" — vai para requisicoes.descricao. */
  const caminho = useMemo(() => {
    if (!orcamento) return '';
    const fase = usaFases ? orcamento.fases.find((f) => f.id === faseId)?.nome : undefined;
    return [orcamento.nome, fase, servico?.nome].filter(Boolean).join(' › ');
  }, [orcamento, usaFases, faseId, servico]);

  function setLinha(chave: string, patch: Partial<LinhaItem>) {
    setLinhas((prev) => prev.map((l) => (l.chave === chave ? { ...l, ...patch } : l)));
  }

  function adicionarLinha() {
    setLinhas((prev) => [...prev, linhaAvulsa()]);
  }

  function removerLinha(chave: string) {
    setLinhas((prev) => prev.filter((l) => l.chave !== chave));
  }

  async function confirmar() {
    // Linha zerada é insumo do orçamento que o usuário não vai pedir agora:
    // fica no grid para consulta, mas não entra na requisição. Já linha com
    // quantidade digitada e inválida é erro — não pode ser descartada calada.
    const preenchidas = linhas.filter((l) => l.descricao.trim() !== '' && l.quantidade.trim() !== '');

    const itens = preenchidas.map((l) => ({
      descricao: l.descricao.trim(),
      quantidade: Number(String(l.quantidade).replace(',', '.')),
      unidade: l.unidade.trim() || 'un',
      orcamentoItemId: l.orcamentoItemId || null,
      insumoCanonicoId: l.insumoCanonicoId || null,
    }));

    if (itens.length === 0) {
      setErro('Informe a quantidade de ao menos um item.');
      return;
    }
    // quantidade > 0 é constraint da tabela — barrar aqui dá mensagem melhor que o erro do banco.
    if (itens.some((it) => !(it.quantidade > 0))) {
      setErro('Todos os itens precisam de uma quantidade maior que zero.');
      return;
    }
    // A obra tem orçamento: sem serviço escolhido o custo não teria onde ser apropriado.
    if (arvore.length > 0 && !servicoId) {
      setErro('Escolha o orçamento e o serviço para apropriar o custo.');
      return;
    }

    setErro(null);
    try {
      const requisicao = await criar.mutateAsync({
        companyId,
        obraId: obraId || null,
        solicitanteId: solicitanteId || null,
        descricao: caminho || null,
        dataNecessidade: dataNecessidade || null,
        observacao: observacao.trim() || null,
        itens,
      });
      onCriada(requisicao.id);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar a requisição.');
    }
  }

  const semOrcamento = Boolean(obraId) && !carregandoArvore && arvore.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg border border-line bg-card p-6">
        <h3 className="mb-4 text-lg font-bold">Nova requisição</h3>

        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Obra</label>
            <select className="field w-full" value={obraId} onChange={(e) => setObraId(e.target.value)}>
              <option value="">Sem obra (administrativo)</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Solicitante</label>
            <select
              className="field w-full"
              value={solicitanteId}
              onChange={(e) => setSolicitanteId(e.target.value)}
            >
              <option value="">—</option>
              {solicitantes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ⭐ Apropriação: substitui a antiga descrição livre. */}
        <div className="mb-4 rounded-lg border border-line bg-side/30 p-3">
          <label className="mb-2 block text-xs font-semibold text-muted-foreground">Orçamento</label>

          {!obraId ? (
            <p className="text-xs text-muted-foreground">Escolha a obra para carregar o orçamento dela.</p>
          ) : carregandoArvore ? (
            <p className="text-xs text-muted-foreground">Carregando orçamento...</p>
          ) : semOrcamento ? (
            <p className="text-xs text-muted-foreground">
              Esta obra ainda não tem orçamento vinculado. A requisição pode seguir sem apropriação.
            </p>
          ) : (
            <div className={`grid gap-2 ${usaFases ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
              <select
                className="field w-full"
                value={orcamentoId}
                onChange={(e) => {
                  setOrcamentoId(e.target.value);
                  setFaseId('');
                  setServicoId('');
                }}
              >
                <option value="">Orçamento...</option>
                {arvore.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </select>

              {usaFases && (
                <select
                  className="field w-full"
                  value={faseId}
                  disabled={!orcamentoId}
                  onChange={(e) => {
                    setFaseId(e.target.value);
                    setServicoId('');
                  }}
                >
                  <option value="">Fase...</option>
                  {(orcamento?.fases ?? []).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              )}

              <select
                className="field w-full"
                value={servicoId}
                disabled={!orcamentoId || (usaFases && !faseId)}
                onChange={(e) => {
                  setServicoId(e.target.value);
                  setLinhas((prev) => prev.map((l) => ({ ...l, orcamentoItemId: '' })));
                }}
              >
                <option value="">Serviço...</option>
                {servicosVisiveis.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          {caminho && <p className="mt-2 text-xs text-cta">{caminho}</p>}
        </div>

        <div className="mb-4 md:w-1/2">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Data de necessidade</label>
          <input
            type="date"
            className="field w-full"
            value={dataNecessidade}
            onChange={(e) => setDataNecessidade(e.target.value)}
          />
        </div>

        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold text-muted-foreground">Itens</label>
          <button type="button" onClick={adicionarLinha} className="text-xs text-cta hover:underline">
            + Adicionar item avulso
          </button>
        </div>

        {linhas.length === 0 ? (
          <p className="mb-4 rounded-lg border border-line bg-side/30 px-3 py-4 text-xs text-muted-foreground">
            {servicoId
              ? 'Este serviço não tem itens no orçamento. Use "Adicionar item avulso".'
              : 'Escolha o serviço acima para carregar os itens do orçamento, ou use "Adicionar item avulso".'}
          </p>
        ) : (
          <div className="mb-4 space-y-2">
            {/* Cabeçalho fixo: sem ele a coluna estreita de Qtd/Un. vira adivinhação. */}
            <div className="flex items-center gap-2 px-1 text-[10px] uppercase text-muted-foreground">
              <span className="min-w-0 flex-1">Insumo</span>
              <span className="w-24 shrink-0 text-right">Qtd</span>
              <span className="w-16 shrink-0">Un.</span>
              <span className="w-5 shrink-0" />
            </div>

            {linhas.map((l) => {
              const doOrcamento = Boolean(l.orcamentoItemId);
              return (
                <div key={l.chave} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <BuscaInsumo
                      companyId={companyId}
                      valor={l.descricao}
                      travado={doOrcamento}
                      onChange={(descricao) => setLinha(l.chave, { descricao, insumoCanonicoId: '' })}
                      onEscolher={(insumo) =>
                        setLinha(l.chave, {
                          descricao: insumo.descricao,
                          unidade: insumo.unidade,
                          insumoCanonicoId: insumo.id,
                        })
                      }
                    />
                    {doOrcamento && (
                      <p className="mt-0.5 px-1 text-[10px] text-muted-foreground">
                        Do orçamento
                        {l.quantidadeOrcada ? ` · orçado ${l.quantidadeOrcada} ${l.unidade}` : ''}
                      </p>
                    )}
                  </div>
                  <input
                    className="field w-24 shrink-0 text-right"
                    inputMode="decimal"
                    placeholder="Qtd"
                    value={l.quantidade}
                    onChange={(e) => setLinha(l.chave, { quantidade: e.target.value })}
                  />
                  <input
                    className="field w-16 shrink-0"
                    placeholder="Un."
                    value={l.unidade}
                    readOnly={doOrcamento}
                    onChange={(e) => setLinha(l.chave, { unidade: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removerLinha(l.chave)}
                    className="mt-2 w-5 shrink-0 text-sm text-err"
                    title="Remover linha"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mb-4">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Observação</label>
          <textarea
            className="field w-full"
            rows={2}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>

        {erro && <p className="mb-3 text-sm text-err">{erro}</p>}

        <div className="flex gap-3">
          <button type="button" disabled={salvando} onClick={confirmar} className="btn-cta disabled:opacity-50">
            {salvando ? 'Salvando...' : 'Criar requisição'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-side px-4 py-2.5 text-sm font-semibold hover:bg-side/80"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalNovaRequisicao;
