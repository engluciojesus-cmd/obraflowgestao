import { useMemo, useState } from 'react';
import { LinhaRequisicao } from './LinhaRequisicao';
import { useColunasRedimensionaveis } from '@/hooks/useColunasRedimensionaveis';

/** Alça de arraste na borda direita do cabeçalho. */
function Alca({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      title="Arraste para ajustar a largura"
      onMouseDown={onMouseDown}
      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none bg-transparent hover:bg-cta/60"
    />
  );
}

const COLUNAS: { chave: string; rotulo: string; alinhamento?: string }[] = [
  { chave: 'check', rotulo: '' },
  { chave: 'numero', rotulo: 'Núm.' },
  { chave: 'descricao', rotulo: 'Descrição' },
  { chave: 'itens', rotulo: 'Itens', alinhamento: 'text-center' },
  { chave: 'solicitacao', rotulo: 'Solicitação' },
  { chave: 'necessidade', rotulo: 'Necessidade' },
  { chave: 'solicitante', rotulo: 'Solicitante' },
  { chave: 'situacao', rotulo: 'Situação' },
  { chave: 'acoes', rotulo: 'Ações' },
];

interface Grupo {
  obraId: string;
  obraNome: string;
  requisicoes: any[];
}

function agruparPorObra(requisicoes: any[]): Grupo[] {
  const mapa = new Map<string, Grupo>();
  for (const r of requisicoes) {
    const obraId = r.obra_id || 'sem-obra';
    const obraNome = r.obra?.nome || 'Sem obra';
    if (!mapa.has(obraId)) mapa.set(obraId, { obraId, obraNome, requisicoes: [] });
    mapa.get(obraId)!.requisicoes.push(r);
  }
  return [...mapa.values()].sort((a, b) => a.obraNome.localeCompare(b.obraNome));
}

export function ListaRequisicoes({
  requisicoes,
  selecionados,
  onToggleItem,
  onToggleTodosDaRequisicao,
  onEditar,
  onCancelarItem,
  mensagemVazio = 'Nenhuma requisição encontrada com esse filtro.',
}: {
  requisicoes: any[];
  selecionados: Set<string>;
  onToggleItem: (itemId: string) => void;
  onToggleTodosDaRequisicao: (itemIds: string[], marcar: boolean) => void;
  onEditar: (requisicao: any) => void;
  onCancelarItem: (item: any) => void;
  /** Muda conforme a tela ainda não buscou ou buscou e não achou nada. */
  mensagemVazio?: string;
}) {
  const grupos = useMemo(() => agruparPorObra(requisicoes), [requisicoes]);
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const { largura, iniciarArraste } = useColunasRedimensionaveis(
    {
      check: 36,
      numero: 90,
      descricao: 320,
      itens: 60,
      solicitacao: 130,
      necessidade: 120,
      solicitante: 180,
      situacao: 120,
      acoes: 150,
    },
    'obraflow:requisicoes:colunas',
  );

  const larguraTotal = COLUNAS.reduce((soma, c) => soma + largura(c.chave), 0);

  function toggleGrupo(obraId: string) {
    setColapsados((prev) => {
      const next = new Set(prev);
      if (next.has(obraId)) next.delete(obraId);
      else next.add(obraId);
      return next;
    });
  }

  function toggleExpandido(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (requisicoes.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-card p-6">
        <p className="text-sm text-muted-foreground">{mensagemVazio}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grupos.map((grupo) => {
        const colapsado = colapsados.has(grupo.obraId);
        return (
          <div key={grupo.obraId} className="rounded-lg border border-line bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGrupo(grupo.obraId)}
              className="w-full flex items-center justify-between px-4 py-3 bg-side/40 hover:bg-side/60 text-left"
            >
              <span className="font-semibold text-sm">
                {colapsado ? '▸' : '▾'} {grupo.obraNome}
              </span>
              <span className="text-xs text-muted-foreground">
                {grupo.requisicoes.length} {grupo.requisicoes.length === 1 ? 'requisição' : 'requisições'}
              </span>
            </button>

            {!colapsado && (
              <div className="overflow-x-auto">
                <table className="text-sm" style={{ tableLayout: 'fixed', width: larguraTotal }}>
                  <colgroup>
                    {COLUNAS.map((c) => (
                      <col key={c.chave} style={{ width: largura(c.chave) }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground uppercase border-b border-line">
                      {COLUNAS.map((c, i) => (
                        <th
                          key={c.chave}
                          className={`relative py-2 pr-3 ${i === 0 ? 'pl-4' : ''} ${c.alinhamento || ''}`}
                        >
                          {c.rotulo}
                          <Alca onMouseDown={(e) => iniciarArraste(c.chave, e)} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.requisicoes.map((r) => (
                      <LinhaRequisicao
                        key={r.id}
                        requisicao={r}
                        expandido={expandidos.has(r.id)}
                        onToggleExpand={() => toggleExpandido(r.id)}
                        selecionados={selecionados}
                        onToggleItem={onToggleItem}
                        onToggleTodosDaRequisicao={onToggleTodosDaRequisicao}
                        onEditar={onEditar}
                        onCancelarItem={onCancelarItem}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ListaRequisicoes;
