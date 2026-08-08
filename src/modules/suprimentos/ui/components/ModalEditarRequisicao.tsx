import { useMemo, useState } from 'react';
import { useArvoreOrcamento, useSalvarEdicaoRequisicao } from '@/modules/suprimentos/ui/hooks';
import { podeTransicionar } from '@/modules/suprimentos/domain/rules';
import {
  REQUISICAO_STATUS,
  REQ_ITEM_STATUS,
  type RequisicaoItemStatus,
} from '@/modules/suprimentos/domain/types';
import { StatusPill } from './StatusPill';
import { BuscaInsumo } from './BuscaInsumo';

/** Situações que travam a requisição: mexer nos insumos aqui quebraria a OC/contrato já emitido. */
const STATUS_TRAVADOS = ['OC_GERADA', 'CONTRATO_GERADO'] as const;

/** Só item ainda não comprometido aceita edição de quantidade/descrição. */
const STATUS_ITEM_EDITAVEL: RequisicaoItemStatus[] = ['RASCUNHO', 'ABERTA'];

/**
 * Alvos de situação oferecidos no formulário, e para qual status de ITEM cada
 * um se traduz. RASCUNHO fica de fora de propósito: a máquina de estado do
 * banco não tem nenhuma transição *para* RASCUNHO — é só ponto de partida.
 */
const ALVOS: { requisicao: 'ABERTA' | 'REJEITADA' | 'CANCELADA'; item: RequisicaoItemStatus }[] = [
  { requisicao: 'ABERTA', item: 'ABERTA' },
  { requisicao: 'REJEITADA', item: 'REJEITADA' },
  { requisicao: 'CANCELADA', item: 'CANCELADA' },
];

interface LinhaExistente {
  id: string;
  status: RequisicaoItemStatus;
  descricao: string;
  quantidade: string;
  unidade: string;
  observacao: string;
  removido: boolean;
}

interface LinhaNova {
  chave: string;
  orcamentoItemId: string;
  insumoCanonicoId: string;
  descricao: string;
  quantidade: string;
  unidade: string;
}

let contadorLinhas = 0;
function linhaNovaVazia(): LinhaNova {
  contadorLinhas += 1;
  return {
    chave: `nova-${contadorLinhas}`,
    orcamentoItemId: '',
    insumoCanonicoId: '',
    descricao: '',
    quantidade: '',
    unidade: 'un',
  };
}

export function ModalEditarRequisicao({
  companyId,
  requisicao,
  obras,
  onClose,
  onSalva,
}: {
  companyId: string;
  requisicao: any;
  obras: { id: string; nome: string }[];
  onClose: () => void;
  onSalva: () => void;
}) {
  const travada = STATUS_TRAVADOS.includes(requisicao.status);

  const [obraId, setObraId] = useState<string>(requisicao.obra_id || '');
  const [dataNecessidade, setDataNecessidade] = useState<string>(requisicao.data_necessidade || '');
  const [observacao, setObservacao] = useState<string>(requisicao.observacao || '');
  const [alvoSituacao, setAlvoSituacao] = useState<string>('');
  const [erro, setErro] = useState<string | null>(null);

  const [existentes, setExistentes] = useState<LinhaExistente[]>(() =>
    [...(requisicao.itens || [])]
      .sort((a: any, b: any) => a.ordem - b.ordem)
      .map((it: any) => ({
        id: it.id,
        status: it.status,
        descricao: it.descricao,
        quantidade: String(Number(it.quantidade)),
        unidade: it.unidade || 'un',
        observacao: it.observacao || '',
        removido: false,
      })),
  );
  const [novas, setNovas] = useState<LinhaNova[]>([]);

  const salvar = useSalvarEdicaoRequisicao(companyId);
  const salvando = salvar.status === 'pending';

  // Reaproveita a cascata da Tarefa 2 para apropriar os insumos incluídos agora.
  const { data: arvore = [] } = useArvoreOrcamento(companyId, obraId);
  const [orcamentoId, setOrcamentoId] = useState('');
  const [faseId, setFaseId] = useState('');
  const [servicoId, setServicoId] = useState('');

  const orcamento = arvore.find((o) => o.id === orcamentoId);
  const usaFases = Boolean(orcamento?.usaFases && orcamento.fases.length > 0);
  const servicosVisiveis = useMemo(() => {
    if (!orcamento) return [];
    return usaFases ? orcamento.servicos.filter((s) => s.faseId === faseId) : orcamento.servicos;
  }, [orcamento, usaFases, faseId]);
  const itensDoServico = servicosVisiveis.find((s) => s.id === servicoId)?.itens ?? [];

  /** Itens vivos: os que a transição de situação pode alcançar. */
  const vivos = existentes.filter((l) => !l.removido);

  /** Para cada alvo, quais itens o banco aceitaria mover. */
  const alcancePorAlvo = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const alvo of ALVOS) {
      mapa.set(
        alvo.requisicao,
        vivos.filter((l) => l.status !== alvo.item && podeTransicionar(l.status, alvo.item)).map((l) => l.id),
      );
    }
    return mapa;
  }, [vivos]);

  function setExistente(id: string, patch: Partial<LinhaExistente>) {
    setExistentes((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function setNova(chave: string, patch: Partial<LinhaNova>) {
    setNovas((prev) => prev.map((l) => (l.chave === chave ? { ...l, ...patch } : l)));
  }

  /**
   * Traz de uma vez os itens do serviço escolhido, pulando os que a requisição
   * já tem — mesmo princípio da tela de criação: com o orçamento no banco, não
   * há por que escolher item por item num dropdown.
   */
  function puxarItensDoServico() {
    const jaNaRequisicao = new Set(
      [...(requisicao.itens || [])].map((it: any) => it.orcamento_item_id).filter(Boolean),
    );
    const jaNaLista = new Set(novas.map((l) => l.orcamentoItemId).filter(Boolean));

    const novosItens = itensDoServico
      .filter((item) => !jaNaRequisicao.has(item.id) && !jaNaLista.has(item.id))
      .map((item) => ({
        ...linhaNovaVazia(),
        orcamentoItemId: item.id,
        descricao: item.descricao,
        quantidade: item.quantidade > 0 ? String(item.quantidade) : '',
        unidade: item.unidade || 'un',
      }));

    if (novosItens.length === 0) {
      setErro('Todos os itens deste serviço já estão nesta requisição.');
      return;
    }
    setErro(null);
    setNovas((prev) => [...prev, ...novosItens]);
  }

  function marcarRemovido(id: string) {
    const linha = existentes.find((l) => l.id === id);
    if (!linha) return;
    if (linha.removido) {
      setExistente(id, { removido: false });
      return;
    }
    if (!podeTransicionar(linha.status, 'CANCELADA')) {
      setErro(`"${linha.descricao}" está ${REQ_ITEM_STATUS[linha.status].label} e não pode mais ser cancelado.`);
      return;
    }
    setExistente(id, { removido: true });
  }

  function numero(txt: string) {
    return Number(String(txt).replace(',', '.'));
  }

  async function confirmar() {
    const originais: any[] = requisicao.itens || [];

    const itensEditados = existentes
      .filter((l) => !l.removido && STATUS_ITEM_EDITAVEL.includes(l.status))
      .filter((l) => {
        const orig = originais.find((o) => o.id === l.id);
        if (!orig) return false;
        return (
          orig.descricao !== l.descricao.trim() ||
          Number(orig.quantidade) !== numero(l.quantidade) ||
          (orig.unidade || 'un') !== l.unidade.trim() ||
          (orig.observacao || '') !== l.observacao
        );
      })
      .map((l) => ({
        id: l.id,
        descricao: l.descricao.trim(),
        quantidade: numero(l.quantidade),
        unidade: l.unidade.trim() || 'un',
        observacao: l.observacao.trim() || null,
      }));

    if (itensEditados.some((it) => !it.descricao)) {
      setErro('Item sem descrição.');
      return;
    }
    if (itensEditados.some((it) => !(it.quantidade > 0))) {
      setErro('Quantidade precisa ser maior que zero.');
      return;
    }

    const itensNovos = novas
      .filter((l) => l.descricao.trim() !== '' && l.quantidade.trim() !== '')
      .map((l) => ({
        descricao: l.descricao.trim(),
        quantidade: numero(l.quantidade),
        unidade: l.unidade.trim() || 'un',
        orcamentoItemId: l.orcamentoItemId || null,
        insumoCanonicoId: l.insumoCanonicoId || null,
      }));

    if (itensNovos.some((it) => !(it.quantidade > 0))) {
      setErro('Todo insumo novo precisa de quantidade maior que zero.');
      return;
    }

    const itensRemovidos = existentes
      .filter((l) => l.removido)
      .map((l) => ({ id: l.id, motivo: 'Removido na edição da requisição' }));

    const transicao = alvoSituacao
      ? { itemIds: alcancePorAlvo.get(alvoSituacao) ?? [], status: ALVOS.find((a) => a.requisicao === alvoSituacao)!.item }
      : null;

    setErro(null);
    try {
      await salvar.mutateAsync({
        requisicaoId: requisicao.id,
        cabecalho: {
          obraId: obraId || null,
          descricao: requisicao.descricao ?? null,
          dataNecessidade: dataNecessidade || null,
          observacao: observacao.trim() || null,
        },
        itensEditados,
        itensNovos,
        itensRemovidos,
        transicao,
      });
      onSalva();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar a requisição.');
    }
  }

  const statusInfo = REQUISICAO_STATUS[requisicao.status as keyof typeof REQUISICAO_STATUS];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg border border-line bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <h3 className="text-lg font-bold">Requisição {requisicao.numero}</h3>
          <StatusPill label={statusInfo?.label ?? requisicao.status} cor={statusInfo?.cor ?? 'side'} />
        </div>

        {travada && (
          <p className="mb-4 rounded-lg border border-cta/40 bg-cta/10 px-4 py-2 text-sm">
            Esta requisição já virou {statusInfo?.label.toLowerCase()}. Os insumos ficam somente para consulta —
            alterá-los agora quebraria o documento já emitido.
          </p>
        )}

        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Obra</label>
            <select
              className="field w-full"
              value={obraId}
              disabled={travada}
              onChange={(e) => setObraId(e.target.value)}
            >
              <option value="">Sem obra (administrativo)</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Data de necessidade</label>
            <input
              type="date"
              className="field w-full"
              value={dataNecessidade}
              disabled={travada}
              onChange={(e) => setDataNecessidade(e.target.value)}
            />
          </div>
        </div>

        {requisicao.descricao && (
          <p className="mb-4 text-xs text-muted-foreground">
            Apropriação: <span className="text-cta">{requisicao.descricao}</span>
          </p>
        )}

        {/* ---------- Itens já salvos ---------- */}
        <label className="mb-2 block text-xs font-semibold text-muted-foreground">Insumos</label>
        <div className="mb-4 space-y-2">
          {existentes.length === 0 && <p className="text-xs text-muted-foreground">Sem itens.</p>}
          {existentes.map((l) => {
            const editavel = !travada && STATUS_ITEM_EDITAVEL.includes(l.status) && !l.removido;
            return (
              <div
                key={l.id}
                className={`flex items-center gap-2 ${l.removido ? 'opacity-40 line-through' : ''}`}
              >
                {editavel ? (
                  <BuscaInsumo
                    className="min-w-0 flex-1"
                    companyId={companyId}
                    valor={l.descricao}
                    onChange={(descricao) => setExistente(l.id, { descricao })}
                    onEscolher={(insumo) =>
                      setExistente(l.id, { descricao: insumo.descricao, unidade: insumo.unidade })
                    }
                  />
                ) : (
                  <input className="field min-w-0 flex-1" value={l.descricao} disabled />
                )}
                <input
                  className="field w-20 shrink-0 text-right"
                  inputMode="decimal"
                  value={l.quantidade}
                  disabled={!editavel}
                  onChange={(e) => setExistente(l.id, { quantidade: e.target.value })}
                />
                <input
                  className="field w-16 shrink-0"
                  value={l.unidade}
                  disabled={!editavel}
                  onChange={(e) => setExistente(l.id, { unidade: e.target.value })}
                />
                <input
                  className="field w-32 shrink-0"
                  placeholder="Observação"
                  value={l.observacao}
                  disabled={!editavel}
                  onChange={(e) => setExistente(l.id, { observacao: e.target.value })}
                />
                <StatusPill
                  label={REQ_ITEM_STATUS[l.status]?.label ?? l.status}
                  cor={REQ_ITEM_STATUS[l.status]?.cor ?? 'side'}
                />
                <button
                  type="button"
                  disabled={travada}
                  onClick={() => marcarRemovido(l.id)}
                  title={l.removido ? 'Desfazer remoção' : 'Remover insumo'}
                  className="px-1 text-sm text-err disabled:opacity-30"
                >
                  {l.removido ? '↺' : '✕'}
                </button>
              </div>
            );
          })}
        </div>

        {/* ---------- Inclusão de novos insumos ---------- */}
        {!travada && (
          <div className="mb-4 rounded-lg border border-line bg-side/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground">Incluir insumos</label>
              <button
                type="button"
                onClick={() => setNovas((prev) => [...prev, linhaNovaVazia()])}
                className="text-xs text-cta hover:underline"
              >
                + Adicionar item avulso
              </button>
            </div>

            {arvore.length > 0 && (
              <div className={`mb-2 grid gap-2 ${usaFases ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
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
                  onChange={(e) => setServicoId(e.target.value)}
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

            {arvore.length > 0 && (
              <button
                type="button"
                disabled={!servicoId || itensDoServico.length === 0}
                onClick={puxarItensDoServico}
                className="mb-2 rounded-lg bg-side px-3 py-2 text-xs font-semibold hover:bg-side/80 disabled:opacity-40"
              >
                Puxar itens deste serviço
                {servicoId && itensDoServico.length > 0 ? ` (${itensDoServico.length})` : ''}
              </button>
            )}

            <div className="space-y-2">
              {novas.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum insumo novo nesta edição.</p>
              )}
              {novas.map((l) => (
                <div key={l.chave} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <BuscaInsumo
                      companyId={companyId}
                      valor={l.descricao}
                      travado={Boolean(l.orcamentoItemId)}
                      onChange={(descricao) => setNova(l.chave, { descricao, insumoCanonicoId: '' })}
                      onEscolher={(insumo) =>
                        setNova(l.chave, {
                          descricao: insumo.descricao,
                          unidade: insumo.unidade,
                          insumoCanonicoId: insumo.id,
                        })
                      }
                    />
                    {l.orcamentoItemId && (
                      <p className="mt-0.5 px-1 text-[10px] text-muted-foreground">Do orçamento</p>
                    )}
                  </div>
                  <input
                    className="field w-20 shrink-0 text-right"
                    inputMode="decimal"
                    placeholder="Qtd"
                    value={l.quantidade}
                    onChange={(e) => setNova(l.chave, { quantidade: e.target.value })}
                  />
                  <input
                    className="field w-16 shrink-0"
                    placeholder="Un."
                    value={l.unidade}
                    readOnly={Boolean(l.orcamentoItemId)}
                    onChange={(e) => setNova(l.chave, { unidade: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setNovas((prev) => prev.filter((x) => x.chave !== l.chave))}
                    className="mt-2 px-1 text-sm text-err"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------- Situação ---------- */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Alterar situação</label>
          <select
            className="field w-full md:w-72"
            value={alvoSituacao}
            disabled={travada}
            onChange={(e) => setAlvoSituacao(e.target.value)}
          >
            <option value="">Manter {statusInfo?.label ?? requisicao.status}</option>
            {ALVOS.map((alvo) => {
              const alcance = alcancePorAlvo.get(alvo.requisicao) ?? [];
              return (
                <option key={alvo.requisicao} value={alvo.requisicao} disabled={alcance.length === 0}>
                  {REQUISICAO_STATUS[alvo.requisicao].label}
                  {alcance.length === 0 ? ' — nenhum item pode' : ` (${alcance.length} ${alcance.length === 1 ? 'item' : 'itens'})`}
                </option>
              );
            })}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            A situação da requisição é calculada pelo banco a partir dos itens — o que este campo faz é
            transicionar os itens que a máquina de estado permite.
          </p>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Observação</label>
          <textarea
            className="field w-full"
            rows={2}
            value={observacao}
            disabled={travada}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>

        {erro && <p className="mb-3 text-sm text-err">{erro}</p>}

        <div className="flex gap-3">
          {!travada && (
            <button type="button" disabled={salvando} onClick={confirmar} className="btn-cta disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-side px-4 py-2.5 text-sm font-semibold hover:bg-side/80"
          >
            {travada ? 'Fechar' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalEditarRequisicao;
