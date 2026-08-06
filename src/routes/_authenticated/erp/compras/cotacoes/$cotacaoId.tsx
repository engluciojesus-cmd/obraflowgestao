import React, { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useActiveCompany } from '@/hooks/useAuth';
import { ErpLayout, money } from '@/components/ErpLayout';
import { ComprasSubNav } from '@/components/ComprasSubNav';
import { useCotacaoMapa, useSalvarPreco, useRanking, useFornecedoresDisponiveis, useAdicionarFornecedor, useGerarOrdemCompra } from '@/modules/compras/ui/hooks';
import MapaCotacaoTabela from '@/modules/compras/ui/components/MapaCotacaoTabela';
import { ResumoRanking } from '@/modules/compras/ui/components/ResumoRanking';
import ModalGerarOC from '@/modules/compras/ui/components/ModalGerarOC';
import type { Cotacao, CotacaoItem, CotacaoFornecedor, CotacaoPreco } from '@/types';

export const Route = createFileRoute('/_authenticated/erp/compras/cotacoes/$cotacaoId')({
  head: () => ({ meta: [{ title: 'Mapa de Cotação — ObraFlow Gestão' }] }),
  component: MapaCotacao,
});

function MapaCotacao() {
  const { cotacaoId } = Route.useParams();
  const { companyId } = useActiveCompany();
  const { data: mapa, isLoading, isFetching } = useCotacaoMapa(companyId || '', cotacaoId || '');
  const salvarPrecoMutation = useSalvarPreco(companyId || '', cotacaoId || '');
  const rankingQuery = useRanking(companyId || '', cotacaoId || '', 0.015);
  const fornecedoresQuery = useFornecedoresDisponiveis(companyId || '');
  const adicionarFornecedorMutation = useAdicionarFornecedor(companyId || '', cotacaoId || '');
  const gerarOrdemMutation = useGerarOrdemCompra(companyId || '', cotacaoId || '');
  const [showOC, setShowOC] = useState(false);
  const [selectedFornecedor, setSelectedFornecedor] = useState('');

  const loading = isLoading || isFetching;
  const mapaTyped = mapa as any;
  const cotacao: Cotacao | null = mapaTyped?.cotacao || null;
  const itens: CotacaoItem[] = mapaTyped?.items || [];
  const fornecedores: CotacaoFornecedor[] = mapaTyped?.fornecedores || [];
  const precos = new Map<string, CotacaoPreco>();
  (mapaTyped?.precos || []).forEach((p: CotacaoPreco) => precos.set(`${p.cotacao_fornecedor_id}|${p.cotacao_item_id}`, p));

  function onSalvarPreco(fornId: string, itemId: string, campo: 'valor_unitario' | 'marca', valor: string) {
    const payload: any = { cotacao_fornecedor_id: fornId, cotacao_item_id: itemId };
    if (campo === 'valor_unitario') payload.valor_unitario = Number(valor) || 0;
    else payload.marca = valor;
    salvarPrecoMutation.mutate(payload);
  }

  function onAlternarEscolha(fornId: string, itemId: string) {
    salvarPrecoMutation.mutate({ cotacao_fornecedor_id: fornId, cotacao_item_id: itemId, toggle_escolhido: true } as any);
  }

  if (loading || !cotacao) return (
    <ErpLayout title="Mapa de Cotação"><p className="text-muted-foreground">Carregando...</p></ErpLayout>
  );

  return (
    <ErpLayout title={`Cotação COT-${String(cotacao.numero).padStart(3, '0')}`} breadcrumb={<><Link to="/erp/compras/itens" className="hover:text-cta">Compras</Link>{' / '}Cotação</>}>
      <ComprasSubNav />

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Obra</p>
          <p className="mt-1 text-sm font-semibold">{cotacao.obra?.nome || '—'}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Itens</p>
          <p className="mt-1 text-sm font-semibold">{itens.length}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Fornecedores</p>
          <p className="mt-1 text-sm font-semibold">{fornecedores.length}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Compra selecionada</p>
          <p className="mt-1 text-lg font-bold text-cta">{money(0)}</p>
        </div>
      </div>

      {rankingQuery.data && <ResumoRanking rankings={rankingQuery.data} />}

      <div className="mb-6">
        <div className="rounded-lg border border-line bg-card p-4 mb-4 flex gap-3 items-center">
          <span className="text-sm font-semibold">Adicionar fornecedor:</span>
          <select
            className="field w-64"
            value={selectedFornecedor}
            onChange={(e) => setSelectedFornecedor(e.target.value)}
            disabled={!fornecedoresQuery.data || adicionarFornecedorMutation.status === 'pending'}
          >
            <option value="">Selecione...</option>
            {(fornecedoresQuery.data || [])
              .filter((f: any) => !fornecedores.some((fr) => fr.fornecedor_id === f.id))
              .map((f: any) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
          </select>
          <button
            className="btn-cta"
            onClick={async () => {
              if (!selectedFornecedor) return;
              await adicionarFornecedorMutation.mutateAsync({ fornecedorId: selectedFornecedor });
              setSelectedFornecedor('');
            }}
          >Adicionar</button>
        </div>
        <MapaCotacaoTabela
          items={itens}
          fornecedores={fornecedores}
          precos={precos}
          onSalvarPreco={onSalvarPreco}
          onAlternarEscolha={onAlternarEscolha}
        />
      </div>

      {showOC && (
        <ModalGerarOC
          grupos={[]}
          onClose={() => setShowOC(false)}
          onGerado={async () => {
            await gerarOrdemMutation.mutateAsync({});
            setShowOC(false);
            // navigate to orders after generation
            // useNavigate not used here to avoid hooks inside conditional; instead reload page or rely on mutation side-effects
          }}
        />
      )}
    </ErpLayout>
  );
}

export default MapaCotacao;
