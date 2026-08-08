import { useMemo, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useActiveCompany, useAuthUser } from '@/hooks/useAuth';
import { ErpLayout } from '@/components/ErpLayout';
import { ComprasSubNav } from '@/components/ComprasSubNav';
import {
  useRequisicoes,
  useObrasDaEmpresa,
  useSolicitantes,
  useGerarCotacao,
  useCancelarItemRequisicao,
} from '@/modules/suprimentos/ui/hooks';
import { useFornecedoresDisponiveis } from '@/modules/compras/ui/hooks';
import {
  FiltroRequisicoes,
  filtroRequisicoesPadrao,
  type FiltroRequisicoesState,
} from '@/modules/suprimentos/ui/components/FiltroRequisicoes';
import { ListaRequisicoes } from '@/modules/suprimentos/ui/components/ListaRequisicoes';
import { BarraSelecao } from '@/modules/suprimentos/ui/components/BarraSelecao';
import { ModalComprar } from '@/modules/suprimentos/ui/components/ModalComprar';
import { ModalNovaRequisicao } from '@/modules/suprimentos/ui/components/ModalNovaRequisicao';
import { ModalEditarRequisicao } from '@/modules/suprimentos/ui/components/ModalEditarRequisicao';

export const Route = createFileRoute('/_authenticated/erp/compras/requisicoes/')({
  head: () => ({ meta: [{ title: 'Requisição — ObraFlow Gestão' }] }),
  component: RequisicoesPage,
});

const MSG_SEM_BUSCA = 'Nenhuma requisição encontrada. Preencha os filtros e clique em Buscar.';
const MSG_SEM_RESULTADO = 'Nenhuma requisição encontrada para os filtros informados.';

type ModalState = { itens: any[]; titulo: string; jaRecebido: boolean } | null;

function RequisicoesPage() {
  const { companyId } = useActiveCompany();
  const { user } = useAuthUser();
  const navigate = useNavigate();

  // Dois estados de propósito: o que está nos campos (`rascunho`) e o que foi
  // efetivamente consultado (`aplicado`). `aplicado === null` = a tela abriu e
  // ainda não buscou nada — é o que mantém a lista vazia e o banco em paz.
  const [rascunho, setRascunho] = useState<FiltroRequisicoesState>(filtroRequisicoesPadrao);
  const [aplicado, setAplicado] = useState<FiltroRequisicoesState | null>(null);

  // ⭐ A seleção é por ITEM: 4 itens de 3 requisições viram UMA cotação.
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState>(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const { data: requisicoes = [], isFetching } = useRequisicoes(companyId || '', aplicado);
  const { data: obras = [] } = useObrasDaEmpresa(companyId || '');
  const { data: solicitantes = [] } = useSolicitantes(companyId || '');
  const { data: fornecedores = [] } = useFornecedoresDisponiveis(companyId || '');
  const gerarCotacao = useGerarCotacao(companyId || '');
  const cancelarItem = useCancelarItemRequisicao(companyId || '');

  const visiveis = requisicoes as any[];

  function buscar() {
    // Cópia: o rascunho continua editável sem re-disparar a consulta a cada tecla.
    setAplicado({ ...rascunho });
    setSelecionados(new Set());
  }

  function limpar() {
    setRascunho(filtroRequisicoesPadrao());
    setAplicado(null);
    setSelecionados(new Set());
  }

  const itensPorId = useMemo(() => {
    const mapa = new Map<string, any>();
    for (const r of visiveis) for (const it of r.itens || []) mapa.set(it.id, it);
    return mapa;
  }, [visiveis]);

  function toggleItem(itemId: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function toggleVarios(itemIds: string[], marcar: boolean) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      for (const id of itemIds) {
        if (marcar) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function itensSelecionados() {
    return [...selecionados].map((id) => itensPorId.get(id)).filter(Boolean);
  }

  async function onGerarCotacao() {
    setErro(null);
    try {
      const cotacaoId = await gerarCotacao.mutateAsync({
        companyId: companyId || '',
        itemIds: [...selecionados],
      });
      setSelecionados(new Set());
      navigate({ to: '/erp/compras/cotacoes/$cotacaoId', params: { cotacaoId } });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao gerar a cotação.');
    }
  }

  async function onCancelarItem(item: any) {
    const motivo = prompt('Motivo do cancelamento (obrigatório):');
    if (!motivo?.trim()) return;
    setErro(null);
    try {
      await cancelarItem.mutateAsync({ itemId: item.id, motivo: motivo.trim() });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao cancelar o item.');
    }
  }

  return (
    <ErpLayout
      title="Requisição"
      actions={
        <div className="flex gap-2">
          <button type="button" className="btn-cta" onClick={() => setNovaAberta(true)}>
            + Nova requisição
          </button>
          {/* TODO: a medição é por serviço/item do orçamento e hoje só existe dentro
              da Obra. Enquanto não houver tela própria, este botão leva à lista de
              obras para escolher onde medir. */}
          <button
            type="button"
            className="rounded-lg bg-side px-4 py-2.5 text-sm font-bold hover:bg-side/80"
            onClick={() => navigate({ to: '/erp/obras' })}
          >
            + Nova medição
          </button>
        </div>
      }
    >
      <ComprasSubNav />

      {erro && <p className="mb-4 rounded-lg border border-err/40 bg-err/10 px-4 py-2 text-sm text-err">{erro}</p>}

      <div className="flex gap-6 pb-24">
        <FiltroRequisicoes
          value={rascunho}
          onChange={setRascunho}
          onBuscar={buscar}
          onLimpar={limpar}
          obras={obras}
          solicitantes={solicitantes}
          buscando={isFetching}
        />

        <div className="flex-1 min-w-0">
          {isFetching ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : (
            <ListaRequisicoes
              requisicoes={visiveis}
              selecionados={selecionados}
              onToggleItem={toggleItem}
              onToggleTodosDaRequisicao={toggleVarios}
              onEditar={(r) => setEditando(r)}
              onCancelarItem={onCancelarItem}
              mensagemVazio={aplicado === null ? MSG_SEM_BUSCA : MSG_SEM_RESULTADO}
            />
          )}
        </div>
      </div>

      <BarraSelecao
        count={selecionados.size}
        onGerarCotacao={onGerarCotacao}
        onGerarOC={() =>
          setModal({ itens: itensSelecionados(), titulo: 'Gerar Ordem de compra', jaRecebido: false })
        }
      />

      {novaAberta && (
        <ModalNovaRequisicao
          companyId={companyId || ''}
          obras={obras as { id: string; nome: string }[]}
          solicitantes={solicitantes as { id: string; nome: string }[]}
          solicitantePadrao={user?.id}
          onClose={() => setNovaAberta(false)}
          onCriada={() => {
            setNovaAberta(false);
            // Sem isto quem acabou de criar uma requisição olharia para a tela
            // vazia — a lista só mostra o que foi buscado.
            buscar();
          }}
        />
      )}

      {editando && (
        <ModalEditarRequisicao
          companyId={companyId || ''}
          requisicao={editando}
          obras={obras as { id: string; nome: string }[]}
          onClose={() => setEditando(null)}
          onSalva={() => setEditando(null)}
        />
      )}

      {modal && (
        <ModalComprar
          companyId={companyId || ''}
          itens={modal.itens}
          fornecedores={fornecedores as { id: string; nome: string }[]}
          titulo={modal.titulo}
          jaRecebidoPadrao={modal.jaRecebido}
          onClose={() => setModal(null)}
          onSucesso={() => {
            setModal(null);
            setSelecionados(new Set());
            // A OC recém-criada é a de maior número, e a tela de OC ordena por
            // número desc — ela aparece na primeira linha.
            navigate({ to: '/erp/compras/ordens' });
          }}
        />
      )}
    </ErpLayout>
  );
}

export default RequisicoesPage;
