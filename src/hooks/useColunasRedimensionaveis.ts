import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Larguras de coluna arrastáveis, como no Obra Prima: o comprador puxa a borda
 * do cabeçalho para ler a descrição inteira do insumo. A largura escolhida fica
 * no localStorage — ele ajusta uma vez, não toda vez que abre a tela.
 */
export function useColunasRedimensionaveis(padrao: Record<string, number>, storageKey?: string) {
  const [larguras, setLarguras] = useState<Record<string, number>>(() => {
    if (!storageKey) return padrao;
    try {
      const salvo = JSON.parse(localStorage.getItem(storageKey) || 'null');
      return salvo && typeof salvo === 'object' ? { ...padrao, ...salvo } : padrao;
    } catch {
      return padrao;
    }
  });

  const arraste = useRef<{ chave: string; xInicial: number; larguraInicial: number } | null>(null);
  const largurasRef = useRef(larguras);
  largurasRef.current = larguras;

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const a = arraste.current;
      if (!a) return;
      const nova = Math.max(60, a.larguraInicial + (e.clientX - a.xInicial));
      setLarguras((prev) => ({ ...prev, [a.chave]: nova }));
    }
    function onUp() {
      if (!arraste.current) return;
      arraste.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(larguras));
    } catch {
      // localStorage cheio ou bloqueado — largura de coluna não é motivo para quebrar a tela.
    }
  }, [larguras, storageKey]);

  const iniciarArraste = useCallback(
    (chave: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      arraste.current = {
        chave,
        xInicial: e.clientX,
        larguraInicial: largurasRef.current[chave] ?? 120,
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [],
  );

  const largura = useCallback((chave: string) => larguras[chave] ?? 120, [larguras]);

  const resetar = useCallback(() => setLarguras(padrao), [padrao]);

  return { larguras, largura, iniciarArraste, resetar };
}

export default useColunasRedimensionaveis;
