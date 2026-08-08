import { useState } from 'react';
import { money } from '@/components/ErpLayout';
import { useComprarDireto } from '@/modules/suprimentos/ui/hooks';
import { requisicoesRepository } from '@/modules/suprimentos/data/requisicoes.repository';

interface ItemParaComprar {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
}

/**
 * Modal do "Gerar Ordem de compra" (rpc comprar_direto).
 *
 * O antigo par de atalhos "Já comprei" / "Comprar por boleto" virou uma ação só:
 * o que os separava era o `ja_recebido`, que agora é uma caixa aqui dentro.
 * Marcado → OC RECEBIDA + lançamento; desmarcado → OC GERADA, a receber.
 */
export function ModalComprar({
  companyId,
  itens,
  fornecedores,
  titulo,
  jaRecebidoPadrao,
  onClose,
  onSucesso,
}: {
  companyId: string;
  itens: ItemParaComprar[];
  fornecedores: { id: string; nome: string }[];
  titulo: string;
  jaRecebidoPadrao: boolean;
  onClose: () => void;
  onSucesso: () => void;
}) {
  const [fornecedorId, setFornecedorId] = useState('');
  const [valores, setValores] = useState<Record<string, string>>({});
  const [formaPagamento, setFormaPagamento] = useState('');
  const [documentoNumero, setDocumentoNumero] = useState('');
  const [jaRecebido, setJaRecebido] = useState(jaRecebidoPadrao);
  const [jaPago, setJaPago] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const comprarDireto = useComprarDireto(companyId);

  const total = itens.reduce((s, it) => s + Number(it.quantidade) * (Number(valores[it.id]) || 0), 0);

  async function confirmar() {
    if (!fornecedorId) {
      setErro('Selecione o fornecedor.');
      return;
    }
    if (itens.some((it) => !(Number(valores[it.id]) > 0))) {
      setErro('Informe o valor unitário de todos os itens.');
      return;
    }

    setEnviando(true);
    setErro(null);
    try {
      const documentoPath = arquivo
        ? (await requisicoesRepository.uploadAnexo(companyId, arquivo)) ?? undefined
        : undefined;

      await comprarDireto.mutateAsync({
        companyId,
        itemIds: itens.map((it) => it.id),
        fornecedorId,
        valores: Object.fromEntries(itens.map((it) => [it.id, Number(valores[it.id]) || 0])),
        formaPagamento: formaPagamento || undefined,
        jaRecebido,
        jaPago: jaRecebido ? jaPago : false,
        documentoNumero: documentoNumero || undefined,
        documentoPath,
      });
      onSucesso();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar a compra.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-lg border border-line bg-card p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">{titulo}</h3>

        <div className="grid gap-4 md:grid-cols-2 mb-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Fornecedor *</label>
            <select className="field w-full" value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
              <option value="">Selecione...</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Forma de pagamento</label>
            <input
              className="field w-full"
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              placeholder="Ex: PIX, Boleto 30 dias"
            />
          </div>
        </div>

        <label className="block text-xs font-semibold text-muted-foreground mb-2">Valor por item</label>
        <div className="space-y-2 mb-4">
          {itens.map((it) => (
            <div key={it.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm">
                {it.descricao}{' '}
                <span className="text-xs text-muted-foreground">
                  ({Number(it.quantidade)} {it.unidade})
                </span>
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="field w-32"
                value={valores[it.id] || ''}
                onChange={(e) => setValores({ ...valores, [it.id]: e.target.value })}
                placeholder="Valor unit."
              />
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Número da nota</label>
            <input className="field w-full" value={documentoNumero} onChange={(e) => setDocumentoNumero(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Anexar nota (opcional)</label>
            <input
              type="file"
              accept="image/*,.pdf"
              className="text-sm"
              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        <div className="mb-4 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={jaRecebido} onChange={(e) => setJaRecebido(e.target.checked)} />
            Material já recebido
            <span className="text-xs text-muted-foreground">
              (a OC já nasce recebida e gera o lançamento)
            </span>
          </label>
          {jaRecebido && (
            <label className="flex items-center gap-2 text-sm pl-6">
              <input type="checkbox" checked={jaPago} onChange={(e) => setJaPago(e.target.checked)} />
              Já pago
            </label>
          )}
        </div>

        <p className="text-sm font-semibold mb-4">Total estimado: {money(total)}</p>

        {erro && <p className="text-sm text-err mb-3">{erro}</p>}

        <div className="flex gap-3">
          <button type="button" disabled={enviando} onClick={confirmar} className="btn-cta disabled:opacity-50">
            {enviando ? 'Salvando...' : 'Confirmar'}
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

export default ModalComprar;
