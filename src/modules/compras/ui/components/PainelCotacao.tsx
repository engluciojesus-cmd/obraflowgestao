import { useEffect, useState } from 'react';
import {
  cotacoesRepository,
  type AnexoCompra,
  type CondicaoPagamento,
} from '@/modules/compras/data/cotacoes.repository';

export type AbaCotacao = 'mapa' | 'entrega' | 'pagamento' | 'anexos';

const ABAS: { id: AbaCotacao; rotulo: string }[] = [
  { id: 'mapa', rotulo: 'Mapa de cotação' },
  { id: 'entrega', rotulo: 'Endereços de entrega' },
  { id: 'pagamento', rotulo: 'Pagamento e faturamento' },
  { id: 'anexos', rotulo: 'Anexos' },
];

/** Todo campo que o painel edita, achatado — é o shape que vai para o banco. */
export interface DadosCotacao {
  entrega_local: string;
  entrega_cep: string;
  entrega_logradouro: string;
  entrega_numero: string;
  entrega_complemento: string;
  entrega_bairro: string;
  entrega_cidade: string;
  entrega_uf: string;
  entrega_recebedor: string;
  cobranca_local: string;
  cobranca_cep: string;
  cobranca_logradouro: string;
  cobranca_numero: string;
  cobranca_complemento: string;
  cobranca_bairro: string;
  cobranca_cidade: string;
  cobranca_uf: string;
  faturamento_para: string;
  lancamento_financeiro: string;
  forma_pagamento: string;
  previsao_entrega: string;
  observacao: string;
}

export function dadosCotacaoDe(cotacao: Record<string, unknown> | null): DadosCotacao {
  const t = (chave: string) => String(cotacao?.[chave] ?? '');
  return {
    entrega_local: t('entrega_local') || 'empresa',
    entrega_cep: t('entrega_cep'),
    entrega_logradouro: t('entrega_logradouro'),
    entrega_numero: t('entrega_numero'),
    entrega_complemento: t('entrega_complemento'),
    entrega_bairro: t('entrega_bairro'),
    entrega_cidade: t('entrega_cidade'),
    entrega_uf: t('entrega_uf'),
    entrega_recebedor: t('entrega_recebedor'),
    cobranca_local: t('cobranca_local') || 'empresa',
    cobranca_cep: t('cobranca_cep'),
    cobranca_logradouro: t('cobranca_logradouro'),
    cobranca_numero: t('cobranca_numero'),
    cobranca_complemento: t('cobranca_complemento'),
    cobranca_bairro: t('cobranca_bairro'),
    cobranca_cidade: t('cobranca_cidade'),
    cobranca_uf: t('cobranca_uf'),
    faturamento_para: t('faturamento_para') || 'empresa',
    lancamento_financeiro: t('lancamento_financeiro') || 'no_recebimento',
    forma_pagamento: t('forma_pagamento'),
    previsao_entrega: t('previsao_entrega').slice(0, 10),
    observacao: t('observacao'),
  };
}

/**
 * Painel de dados da cotação — o que a Ordem de Compra herda na hora de ser
 * gerada.
 *
 * Fica na tela do mapa porque é onde a compra é decidida: endereço, forma de
 * pagamento e previsão valem para a compra inteira, não por fornecedor. Sem
 * isto, cada OC gerada teria que ser reaberta e preenchida à mão — com três
 * fornecedores escolhidos, três vezes o mesmo trabalho.
 *
 * A condição de pagamento continua por fornecedor, no cabeçalho da coluna: é
 * negociada com cada um, e é justamente o que o mapa compara.
 */
export function PainelCotacao({
  companyId,
  cotacaoId,
  valor,
  aba,
  onAba,
  onChange,
  onSalvarCampo,
  condicoesPagamento = [],
}: {
  companyId: string;
  cotacaoId: string;
  valor: DadosCotacao;
  /** Controlado pela página: o mapa é irmão dos painéis, não filho. */
  aba: AbaCotacao;
  onAba: (a: AbaCotacao) => void;
  onChange: (v: DadosCotacao) => void;
  /** Grava um campo ao sair dele, igual às células do mapa. */
  onSalvarCampo: (patch: Record<string, unknown>) => void;
  condicoesPagamento?: CondicaoPagamento[];
}) {
  function set<K extends keyof DadosCotacao>(chave: K, v: DadosCotacao[K]) {
    onChange({ ...valor, [chave]: v });
  }

  /** Cobrança quase sempre repete a entrega — digitar duas vezes é retrabalho. */
  function copiarEntregaParaCobranca() {
    const novo: DadosCotacao = {
      ...valor,
      cobranca_local: valor.entrega_local,
      cobranca_cep: valor.entrega_cep,
      cobranca_logradouro: valor.entrega_logradouro,
      cobranca_numero: valor.entrega_numero,
      cobranca_complemento: valor.entrega_complemento,
      cobranca_bairro: valor.entrega_bairro,
      cobranca_cidade: valor.entrega_cidade,
      cobranca_uf: valor.entrega_uf,
    };
    onChange(novo);
    onSalvarCampo({
      cobranca_local: novo.cobranca_local,
      cobranca_cep: novo.cobranca_cep,
      cobranca_logradouro: novo.cobranca_logradouro,
      cobranca_numero: novo.cobranca_numero,
      cobranca_complemento: novo.cobranca_complemento,
      cobranca_bairro: novo.cobranca_bairro,
      cobranca_cidade: novo.cobranca_cidade,
      cobranca_uf: novo.cobranca_uf,
    });
  }

  return (
    <div className="mb-4">
      {/* Abas exclusivas, não sanfona: o mapa é largo e rolável, e mantê-lo
          visível junto de um formulário deixava a tela longa demais para
          achar qualquer coisa. */}
      <div className="flex flex-wrap gap-2">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onAba(a.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              aba === a.id ? 'bg-cta text-cta-foreground' : 'bg-side hover:bg-side/80'
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === 'entrega' && (
        <div className="mt-3 space-y-4 rounded-lg border border-line bg-card p-4">
          <Endereco
            titulo="Endereço de entrega"
            prefixo="entrega"
            valor={valor}
            set={set}
            onSalvarCampo={onSalvarCampo}
            comRecebedor
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={copiarEntregaParaCobranca}
              className="rounded-lg bg-side px-3 py-1.5 text-xs font-semibold hover:bg-side/80"
            >
              Copiar entrega para cobrança
            </button>
          </div>

          <Endereco
            titulo="Endereço de cobrança"
            prefixo="cobranca"
            valor={valor}
            set={set}
            onSalvarCampo={onSalvarCampo}
          />
        </div>
      )}

      {aba === 'pagamento' && (
        <div className="mt-3 grid gap-4 rounded-lg border border-line bg-card p-4 md:grid-cols-2">
          <Campo rotulo="Faturamento para">
            <select
              className="field w-full"
              value={valor.faturamento_para}
              onChange={(e) => {
                set('faturamento_para', e.target.value);
                onSalvarCampo({ faturamento_para: e.target.value });
              }}
            >
              <option value="empresa">Empresa</option>
              <option value="cliente">Cliente</option>
            </select>
          </Campo>

          <Campo rotulo="Lançamento financeiro">
            <select
              className="field w-full"
              value={valor.lancamento_financeiro}
              onChange={(e) => {
                set('lancamento_financeiro', e.target.value);
                onSalvarCampo({ lancamento_financeiro: e.target.value });
              }}
            >
              <option value="no_recebimento">No recebimento</option>
              <option value="antes">Antes do recebimento</option>
            </select>
          </Campo>

          <Campo rotulo="Forma de pagamento">
            <select
              className="field w-full"
              value={valor.forma_pagamento}
              onChange={(e) => {
                set('forma_pagamento', e.target.value);
                onSalvarCampo({ forma_pagamento: e.target.value || null });
              }}
            >
              <option value="">—</option>
              {condicoesPagamento.map((c) => (
                <option key={c.id} value={c.nome}>
                  {c.nome}
                </option>
              ))}
              {valor.forma_pagamento &&
                !condicoesPagamento.some((c) => c.nome === valor.forma_pagamento) && (
                  <option value={valor.forma_pagamento}>{valor.forma_pagamento} (fora do cadastro)</option>
                )}
            </select>
          </Campo>

          <Campo rotulo="Previsão de entrega">
            <input
              type="date"
              className="field w-full"
              value={valor.previsao_entrega}
              onChange={(e) => set('previsao_entrega', e.target.value)}
              onBlur={(e) => onSalvarCampo({ previsao_entrega: e.target.value || null })}
            />
          </Campo>

          <div className="md:col-span-2">
            <Campo rotulo="Observação (vai para a ordem de compra e para o fornecedor)">
              <textarea
                className="field w-full"
                rows={4}
                value={valor.observacao}
                onChange={(e) => set('observacao', e.target.value)}
                onBlur={(e) => onSalvarCampo({ observacao: e.target.value.trim() || null })}
              />
            </Campo>
          </div>
        </div>
      )}

      {aba === 'anexos' && (
        <PainelAnexos companyId={companyId} cotacaoId={cotacaoId} />
      )}
    </div>
  );
}

function Endereco({
  titulo,
  prefixo,
  valor,
  set,
  onSalvarCampo,
  comRecebedor = false,
}: {
  titulo: string;
  prefixo: 'entrega' | 'cobranca';
  valor: DadosCotacao;
  set: <K extends keyof DadosCotacao>(chave: K, v: DadosCotacao[K]) => void;
  onSalvarCampo: (patch: Record<string, unknown>) => void;
  comRecebedor?: boolean;
}) {
  // O `as never` existe porque as chaves são montadas por concatenação; o
  // conjunto de campos por prefixo é fixo e conferido no tipo DadosCotacao.
  const campo = (sufixo: string) => `${prefixo}_${sufixo}` as never;
  const ler = (sufixo: string) => String(valor[campo(sufixo)] ?? '');
  const escrever = (sufixo: string, v: string) => set(campo(sufixo), v as never);

  /**
   * Grava o valor que veio do próprio input, não o do state.
   *
   * Ler do state aqui dependeria de o React já ter processado o onChange da
   * última tecla antes do blur — verdade no uso normal, mas frágil, e falso
   * quando a mudança e a saída do campo caem no mesmo ciclo. O input é a
   * fonte da verdade no momento do blur.
   */
  const gravar = (sufixo: string, v: string) =>
    onSalvarCampo({ [`${prefixo}_${sufixo}`]: v.trim() || null });

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">{titulo}</p>
      <div className="grid gap-3 md:grid-cols-4">
        <Campo rotulo="Local">
          <select
            className="field w-full"
            value={ler('local') || 'empresa'}
            onChange={(e) => {
              escrever('local', e.target.value);
              onSalvarCampo({ [`${prefixo}_local`]: e.target.value });
            }}
          >
            <option value="empresa">Empresa</option>
            <option value="cliente">Cliente</option>
            <option value="obra">Obra</option>
          </select>
        </Campo>

        <Campo rotulo="CEP">
          <input className="field w-full" value={ler('cep')} onChange={(e) => escrever('cep', e.target.value)} onBlur={(e) => gravar('cep', e.target.value)} />
        </Campo>

        <div className="md:col-span-2">
          <Campo rotulo="Logradouro">
            <input className="field w-full" value={ler('logradouro')} onChange={(e) => escrever('logradouro', e.target.value)} onBlur={(e) => gravar('logradouro', e.target.value)} />
          </Campo>
        </div>

        <Campo rotulo="Número">
          <input className="field w-full" value={ler('numero')} onChange={(e) => escrever('numero', e.target.value)} onBlur={(e) => gravar('numero', e.target.value)} />
        </Campo>

        <Campo rotulo="Complemento">
          <input className="field w-full" value={ler('complemento')} onChange={(e) => escrever('complemento', e.target.value)} onBlur={(e) => gravar('complemento', e.target.value)} />
        </Campo>

        <Campo rotulo="Bairro">
          <input className="field w-full" value={ler('bairro')} onChange={(e) => escrever('bairro', e.target.value)} onBlur={(e) => gravar('bairro', e.target.value)} />
        </Campo>

        <Campo rotulo="Cidade">
          <input className="field w-full" value={ler('cidade')} onChange={(e) => escrever('cidade', e.target.value)} onBlur={(e) => gravar('cidade', e.target.value)} />
        </Campo>

        <Campo rotulo="UF">
          <input className="field w-full" maxLength={2} value={ler('uf')} onChange={(e) => escrever('uf', e.target.value.toUpperCase())} onBlur={(e) => gravar('uf', e.target.value)} />
        </Campo>

        {comRecebedor && (
          <div className="md:col-span-3">
            <Campo rotulo="Recebedor">
              <input className="field w-full" value={ler('recebedor')} onChange={(e) => escrever('recebedor', e.target.value)} onBlur={(e) => gravar('recebedor', e.target.value)} />
            </Campo>
          </div>
        )}
      </div>
    </div>
  );
}

function PainelAnexos({ companyId, cotacaoId }: { companyId: string; cotacaoId: string }) {
  const [anexos, setAnexos] = useState<AnexoCompra[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function recarregar() {
    try {
      setAnexos(await cotacoesRepository.listarAnexos(cotacaoId));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao listar os anexos.');
    }
  }

  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotacaoId]);

  async function enviar(arquivo: File) {
    setErro(null);
    setEnviando(true);
    try {
      await cotacoesRepository.enviarAnexo({ companyId, cotacaoId, arquivo });
      await recarregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar o arquivo.');
    } finally {
      setEnviando(false);
    }
  }

  async function abrir(anexo: AnexoCompra) {
    try {
      window.open(await cotacoesRepository.urlAnexo(anexo.caminho), '_blank');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao abrir o anexo.');
    }
  }

  async function remover(anexo: AnexoCompra) {
    if (!confirm(`Remover o anexo "${anexo.nome}"?`)) return;
    try {
      await cotacoesRepository.removerAnexo(anexo);
      await recarregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao remover o anexo.');
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-line bg-card p-4">
      <label className="block cursor-pointer rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm hover:bg-side/30">
        {enviando ? 'Enviando...' : 'Clique para adicionar um arquivo'}
        <input
          type="file"
          className="hidden"
          disabled={enviando}
          onChange={(e) => {
            const arq = e.target.files?.[0];
            if (arq) void enviar(arq);
            e.target.value = '';
          }}
        />
      </label>
      <p className="mt-2 text-xs text-muted-foreground">
        Desenhos, especificações e o orçamento do fornecedor. Os anexos acompanham as ordens de compra geradas
        a partir desta cotação.
      </p>

      {erro && <p className="mt-3 text-sm text-err">{erro}</p>}

      <div className="mt-4 space-y-2">
        {anexos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum anexo.</p>
        ) : (
          anexos.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg bg-side/30 px-3 py-2">
              <button
                type="button"
                onClick={() => void abrir(a)}
                className="min-w-0 flex-1 truncate text-left text-sm text-cta hover:underline"
              >
                {a.nome}
              </button>
              <span className="shrink-0 text-xs text-muted-foreground">
                {a.tamanho ? `${Math.max(1, Math.round(a.tamanho / 1024))} KB` : ''}
              </span>
              <button type="button" onClick={() => void remover(a)} className="shrink-0 text-xs text-err hover:underline">
                Remover
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">{rotulo}</label>
      {children}
    </div>
  );
}

export default PainelCotacao;
