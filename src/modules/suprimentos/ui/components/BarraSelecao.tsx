import { useState } from 'react';

export function BarraSelecao({
  count,
  onGerarCotacao,
  onGerarOC,
}: {
  count: number;
  onGerarCotacao: () => void;
  onGerarOC: () => void;
}) {
  const [aberto, setAberto] = useState(false);

  if (count === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-card px-8 py-4 shadow-lg flex items-center justify-between">
      <span className="text-sm font-semibold">
        {count} {count === 1 ? 'item selecionado' : 'itens selecionados'}
      </span>
      <div className="relative">
        <button type="button" onClick={() => setAberto((v) => !v)} className="btn-cta">
          Comprar insumos ▾
        </button>
        {aberto && (
          <div className="absolute bottom-full right-0 mb-2 w-64 rounded-lg border border-line bg-card shadow-lg py-1">
            <button
              type="button"
              onClick={() => {
                setAberto(false);
                onGerarCotacao();
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-side"
            >
              Gerar cotação unificada
            </button>
            <button
              type="button"
              onClick={() => {
                setAberto(false);
                onGerarOC();
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-side"
            >
              Gerar Ordem de compra
            </button>
            <button
              type="button"
              disabled
              title="Em breve"
              className="w-full text-left px-4 py-2 text-sm text-muted-foreground opacity-50 cursor-not-allowed"
            >
              Gerar contrato unificado
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default BarraSelecao;
