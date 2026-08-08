import type { ReactNode } from 'react';

/**
 * Barra lateral de filtros das telas de Compras.
 *
 * O formato é o mesmo em Requisição, Cotação, Ordem de Compra e Contratos —
 * "Limpar filtros" discreto no topo direito, campos no meio, e um único botão
 * grande de Buscar fechando o painel. Fica num componente só para as quatro
 * telas não divergirem no detalhe (foi o que aconteceu antes: cada uma
 * carregava tudo ao abrir, de um jeito diferente).
 *
 * Os campos vêm por `children` porque cada tela filtra por coisas diferentes;
 * o que se compartilha é a casca e o comportamento, não o conteúdo.
 */
export function PainelFiltros({
  children,
  onBuscar,
  onLimpar,
  buscando = false,
  titulo = 'Filtros',
}: {
  children: ReactNode;
  onBuscar: () => void;
  onLimpar: () => void;
  buscando?: boolean;
  titulo?: string;
}) {
  return (
    <aside className="w-64 shrink-0 h-fit">
      {/* <form> para o Enter em qualquer campo disparar a busca. */}
      <form
        className="rounded-lg border border-line bg-card p-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onBuscar();
        }}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase">{titulo}</p>
          <button type="button" onClick={onLimpar} className="text-xs text-cta hover:underline">
            Limpar filtros
          </button>
        </div>

        {children}

        <button type="submit" disabled={buscando} className="btn-cta w-full py-3 text-base disabled:opacity-50">
          {buscando ? 'Buscando...' : 'Buscar'}
        </button>
      </form>
    </aside>
  );
}

export function CampoFiltro({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1">{rotulo}</label>
      {children}
    </div>
  );
}

/**
 * Empilhado, não lado a lado: um `input[type=date]` precisa de ~100px só para
 * "dd/mm/aaaa" mais o ícone do calendário, e a sidebar tem 224px úteis. Dois na
 * mesma linha estouravam a caixa.
 */
export function FaixaDeData({
  rotulo,
  de,
  ate,
  onDe,
  onAte,
}: {
  rotulo: string;
  de: string;
  ate: string;
  onDe: (v: string) => void;
  onAte: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1">{rotulo}</label>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-8 shrink-0 text-xs text-muted-foreground">De</span>
          <input type="date" className="field min-w-0 flex-1 px-2" value={de} onChange={(e) => onDe(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-8 shrink-0 text-xs text-muted-foreground">Até</span>
          <input type="date" className="field min-w-0 flex-1 px-2" value={ate} onChange={(e) => onAte(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

/** Mensagens do estado vazio — iguais nas quatro telas (docs/05 §4). */
export const SEM_BUSCA = 'Preencha os filtros e clique em Buscar.';
export const SEM_RESULTADO = 'Nada encontrado para os filtros informados.';

export function ListaVazia({ mensagem }: { mensagem: string }) {
  return (
    <div className="rounded-lg border border-line bg-card p-6">
      <p className="text-sm text-muted-foreground">{mensagem}</p>
    </div>
  );
}

export default PainelFiltros;
