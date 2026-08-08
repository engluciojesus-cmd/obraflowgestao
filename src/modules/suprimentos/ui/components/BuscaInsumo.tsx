import { useEffect, useRef, useState } from 'react';
import { useBuscaInsumos } from '@/modules/suprimentos/ui/hooks';
import type { InsumoEncontrado } from '@/modules/suprimentos/data/requisicoes.repository';

/**
 * Descrição do insumo com busca no cadastro (`insumos_canonicos` + apelidos).
 *
 * Digitar continua livre — o insumo do dia a dia nem sempre está no catálogo,
 * e travar o campo pararia a requisição. O que a escolha na lista acrescenta é
 * a unidade certa e o vínculo com o item canônico (`insumo_canonico_id`), que
 * é o que faz a série histórica de preço existir.
 *
 * `travado` é o caso do item vindo do orçamento: aí a descrição é do banco e
 * não se edita, para o custo não ser apropriado num insumo que não é aquele.
 */
export function BuscaInsumo({
  companyId,
  valor,
  travado = false,
  placeholder = 'Descrição do insumo',
  className = '',
  onChange,
  onEscolher,
}: {
  companyId: string;
  valor: string;
  travado?: boolean;
  placeholder?: string;
  className?: string;
  onChange: (descricao: string) => void;
  onEscolher: (insumo: InsumoEncontrado) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState('');
  const ignorarProximaBusca = useRef(false);

  // Debounce: o comprador digita rápido e cada tecla bateria no banco.
  useEffect(() => {
    if (ignorarProximaBusca.current) {
      ignorarProximaBusca.current = false;
      return;
    }
    const id = window.setTimeout(() => setTermo(valor), 250);
    return () => window.clearTimeout(id);
  }, [valor]);

  const { data: resultados = [], isFetching } = useBuscaInsumos(companyId, travado ? '' : termo);

  const mostrarLista = aberto && !travado && valor.trim().length >= 2;

  function escolher(insumo: InsumoEncontrado) {
    // Sem isto o efeito acima dispararia uma busca com a descrição recém-posta
    // e a lista reabriria por cima do que o usuário acabou de escolher.
    ignorarProximaBusca.current = true;
    setTermo('');
    setAberto(false);
    onEscolher(insumo);
  }

  return (
    <div className={`relative ${className}`}>
      <input
        className="field w-full"
        placeholder={placeholder}
        value={valor}
        readOnly={travado}
        title={travado ? 'Descrição vem do item do orçamento' : undefined}
        aria-autocomplete="list"
        aria-expanded={mostrarLista}
        onChange={(e) => {
          onChange(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => window.setTimeout(() => setAberto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setAberto(false);
          if (e.key === 'Enter' && mostrarLista && resultados.length === 1) {
            e.preventDefault();
            escolher(resultados[0]);
          }
        }}
      />

      {mostrarLista && (
        <div className="absolute z-40 mt-1 max-h-64 w-full min-w-[20rem] overflow-y-auto rounded-lg border border-line bg-card shadow-lg">
          {resultados.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {isFetching ? 'Buscando no cadastro...' : 'Nenhum insumo cadastrado com esse termo — pode digitar livre.'}
            </p>
          ) : (
            resultados.map((insumo) => (
              <button
                key={insumo.id}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-side"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(insumo)}
              >
                <span className="block">
                  {insumo.codigo && <span className="mr-2 text-xs text-muted-foreground">{insumo.codigo}</span>}
                  {insumo.descricao}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {insumo.unidade}
                  {insumo.categoria ? ` · ${insumo.categoria}` : ''}
                  {insumo.via ? ` · consta como "${insumo.via}"` : ''}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default BuscaInsumo;
