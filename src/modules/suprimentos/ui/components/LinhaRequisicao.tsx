import { REQUISICAO_STATUS, REQ_ITEM_STATUS } from '@/modules/suprimentos/domain/types';
import { podeTransicionar } from '@/modules/suprimentos/domain/rules';
import { StatusPill } from './StatusPill';

function formatarData(iso: string | null, apenasData = false) {
  if (!iso) return '—';
  const d = new Date(apenasData ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString('pt-BR');
}

export function LinhaRequisicao({
  requisicao,
  expandido,
  onToggleExpand,
  selecionados,
  onToggleItem,
  onToggleTodosDaRequisicao,
  onEditar,
  onCancelarItem,
}: {
  requisicao: any;
  expandido: boolean;
  onToggleExpand: () => void;
  selecionados: Set<string>;
  onToggleItem: (itemId: string) => void;
  onToggleTodosDaRequisicao: (itemIds: string[], marcar: boolean) => void;
  onEditar: (requisicao: any) => void;
  onCancelarItem: (item: any) => void;
}) {
  const itens: any[] = requisicao.itens || [];
  const itensAbertos = itens.filter((i) => i.status === 'ABERTA');
  const todosMarcados = itensAbertos.length > 0 && itensAbertos.every((i) => selecionados.has(i.id));
  const statusInfo = REQUISICAO_STATUS[requisicao.status as keyof typeof REQUISICAO_STATUS];

  return (
    <>
      <tr className="border-b border-line">
        <td className="py-2 pl-4 pr-2">
          <input
            type="checkbox"
            checked={todosMarcados}
            disabled={itensAbertos.length === 0}
            onChange={() =>
              onToggleTodosDaRequisicao(
                itensAbertos.map((i) => i.id),
                !todosMarcados,
              )
            }
          />
        </td>
        <td className="py-2 pr-3">
          <button type="button" onClick={onToggleExpand} className="font-semibold hover:underline">
            {expandido ? '▾' : '▸'} {requisicao.numero}
          </button>
        </td>
        {/* Sem largura fixa: quem manda é a coluna arrastável do cabeçalho. */}
        <td className="py-2 pr-3 text-muted-foreground truncate" title={requisicao.descricao || undefined}>
          {requisicao.descricao || '—'}
        </td>
        <td className="py-2 pr-3 text-center">{itens.length}</td>
        <td className="py-2 pr-3 text-muted-foreground">{formatarData(requisicao.data_solicitacao)}</td>
        <td className="py-2 pr-3 text-muted-foreground">{formatarData(requisicao.data_necessidade, true)}</td>
        <td className="py-2 pr-3 text-muted-foreground">
          {requisicao.solicitante?.full_name || requisicao.solicitante?.username || '—'}
        </td>
        <td className="py-2 pr-3">
          <StatusPill label={statusInfo?.label ?? requisicao.status} cor={statusInfo?.cor ?? 'side'} />
        </td>
        {/* Compra em massa vive na barra de seleção do rodapé, não linha a linha. */}
        <td className="py-2">
          <button type="button" onClick={() => onEditar(requisicao)} className="text-xs text-cta hover:underline">
            Editar
          </button>
        </td>
      </tr>

      {expandido && (
        <tr>
          <td colSpan={9} className="bg-side/30 px-4 py-3">
            <div className="space-y-2">
              {itens.length === 0 && <p className="text-xs text-muted-foreground">Sem itens.</p>}
              {itens.map((item) => {
                const itemInfo = REQ_ITEM_STATUS[item.status as keyof typeof REQ_ITEM_STATUS];
                return (
                  <div key={item.id} className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      disabled={item.status !== 'ABERTA'}
                      checked={selecionados.has(item.id)}
                      onChange={() => onToggleItem(item.id)}
                    />
                    <span className="flex-1">{item.descricao}</span>
                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                      {Number(item.quantidade)} {item.unidade}
                    </span>
                    <StatusPill label={itemInfo?.label ?? item.status} cor={itemInfo?.cor ?? 'side'} />
                    {podeTransicionar(item.status, 'CANCELADA') && (
                      <button
                        type="button"
                        onClick={() => onCancelarItem(item)}
                        className="text-xs text-err hover:underline"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default LinhaRequisicao;
