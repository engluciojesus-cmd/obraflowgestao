import { useEffect, useMemo, useRef, useState } from 'react';
import { useBuscaFornecedores } from '@/modules/compras/ui/hooks';
import type { FornecedorBusca, NovoFornecedor } from '@/modules/compras/data/cotacoes.repository';

/** Razão social é o que identifica o fornecedor na cotação e na OC. */
export function rotuloFornecedor(f: {
  nome?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
}): string {
  return f.razao_social?.trim() || f.nome?.trim() || f.nome_fantasia?.trim() || '—';
}

/**
 * Busca no cadastro (módulo Fornecedores) OU cria na hora só com o nome.
 *
 * A busca é no banco, não na lista já carregada: com centenas de fornecedores
 * o filtro em memória obrigava a baixar tudo antes de o comprador digitar a
 * primeira letra. O `+` continua existindo porque na hora de montar o mapa o
 * comprador tem o orçamento do fornecedor na mão e não vai parar para
 * preencher CNPJ e categoria.
 */
export function SeletorFornecedor({
  companyId,
  jaNaCotacao,
  onSelecionar,
  onCriarAvulso,
  ocupado,
}: {
  companyId: string;
  jaNaCotacao: Set<string>;
  onSelecionar: (fornecedorId: string) => void | Promise<void>;
  onCriarAvulso: (dados: NovoFornecedor) => void | Promise<void>;
  ocupado?: boolean;
}) {
  const [busca, setBusca] = useState('');
  const [termo, setTermo] = useState('');
  const [aberto, setAberto] = useState(false);
  const [cadastrando, setCadastrando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce: cada tecla viraria uma consulta ao banco.
  useEffect(() => {
    const id = window.setTimeout(() => setTermo(busca), 250);
    return () => window.clearTimeout(id);
  }, [busca]);

  const { data: encontrados = [], isFetching } = useBuscaFornecedores(companyId, termo);

  const resultados = useMemo(
    () => encontrados.filter((f) => !jaNaCotacao.has(f.id)),
    [encontrados, jaNaCotacao],
  );

  const digitado = busca.trim();
  const nomeExato = encontrados.some(
    (f) => rotuloFornecedor(f).toLowerCase() === digitado.toLowerCase(),
  );

  /**
   * Fornecedor fora do cadastro entra só com o nome — é o caso comum de pedir
   * preço para quem a obra nunca comprou antes.
   *
   * `isFetching` não entra na conta de propósito: com debounce de 250ms ele
   * fica alternando a cada tecla, e o "+" piscava desabilitado justamente
   * enquanto o usuário terminava de digitar o nome.
   */
  const podeCriar = digitado.length >= 2 && !nomeExato;

  async function selecionar(fornecedorId: string) {
    await onSelecionar(fornecedorId);
    setBusca('');
    setTermo('');
    setAberto(false);
  }

  /**
   * Abre o cadastro rápido. Não exige nada digitado: quem já sabe que o
   * fornecedor não existe vai direto no "+", sem passar pela busca. Se houver
   * texto, ele entra como nome; se não, o campo abre vazio e em foco.
   */
  function abrirCadastro() {
    setAberto(false);
    setCadastrando(true);
  }

  async function criar(dados: NovoFornecedor) {
    await onCriarAvulso(dados);
    setBusca('');
    setTermo('');
    setCadastrando(false);
  }

  function detalhe(f: FornecedorBusca) {
    return [
      f.nome_fantasia?.trim() && f.nome_fantasia.trim() !== rotuloFornecedor(f) ? f.nome_fantasia : null,
      f.vendedor_nome?.trim() ? `vendedor: ${f.vendedor_nome}` : null,
      f.cnpj?.trim() || null,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  return (
    <div className="relative flex items-center gap-2">
      <div className="relative">
        <input
          ref={inputRef}
          className="field w-72"
          placeholder="Buscar ou digitar fornecedor novo..."
          value={busca}
          disabled={ocupado}
          aria-autocomplete="list"
          aria-expanded={aberto}
          onChange={(e) => {
            setBusca(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onBlur={() => window.setTimeout(() => setAberto(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && resultados.length === 1) {
              e.preventDefault();
              void selecionar(resultados[0].id);
            } else if (e.key === 'Enter' && podeCriar) {
              e.preventDefault();
              abrirCadastro();
            } else if (e.key === 'Escape') {
              setAberto(false);
            }
          }}
        />

        {aberto && (
          <div className="absolute z-30 mt-1 max-h-64 w-full min-w-[22rem] overflow-y-auto rounded-lg border border-line bg-card shadow-lg">
            {resultados.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {isFetching ? 'Buscando...' : 'Nenhum fornecedor cadastrado com esse termo.'}
              </p>
            )}

            {resultados.map((f) => {
              const extra = detalhe(f);
              return (
                <button
                  key={f.id}
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-side"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void selecionar(f.id)}
                >
                  <span className="block">{rotuloFornecedor(f)}</span>
                  {extra && <span className="block text-xs text-muted-foreground">{extra}</span>}
                </button>
              );
            })}

            {podeCriar && (
              <button
                type="button"
                className="block w-full border-t border-line px-3 py-2 text-left text-sm text-cta hover:bg-side"
                onMouseDown={(e) => e.preventDefault()}
                onClick={abrirCadastro}
              >
                + Cadastrar &ldquo;{digitado.toUpperCase()}&rdquo; como fornecedor novo
              </button>
            )}
          </div>
        )}

        {cadastrando && (
          <FormularioCadastro
            nomeInicial={digitado}
            ocupado={ocupado}
            onCancelar={() => setCadastrando(false)}
            onSalvar={criar}
          />
        )}
      </div>

      {/* Sempre habilitado: cadastrar fornecedor novo é uma ação por si só,
          não a consequência de uma busca que falhou. */}
      <button
        type="button"
        title={
          digitado
            ? `Cadastrar "${digitado.toUpperCase()}" como fornecedor novo`
            : 'Cadastrar um fornecedor novo'
        }
        aria-label="Cadastrar fornecedor novo"
        className="rounded-lg bg-cta px-3 py-2.5 text-sm font-bold text-cta-foreground hover:bg-cta/90 disabled:opacity-40"
        disabled={ocupado}
        onClick={abrirCadastro}
      >
        +
      </button>
    </div>
  );
}

/**
 * Cadastro rápido do fornecedor que não está no banco.
 *
 * Só o mínimo para a compra andar: nome, contato e tipo de pessoa. O cadastro
 * completo (CNPJ, categoria, endereço) fica para o módulo Fornecedores, quando
 * e se ele virar recorrente — parar a cotação para preencher tudo é o que faz
 * o comprador desistir e digitar o nome errado depois.
 */
function FormularioCadastro({
  nomeInicial,
  ocupado,
  onCancelar,
  onSalvar,
}: {
  nomeInicial: string;
  ocupado?: boolean;
  onCancelar: () => void;
  onSalvar: (dados: NovoFornecedor) => Promise<void>;
}) {
  // Caixa alta desde a digitação: o usuário vê o que vai ser gravado, em vez
  // de digitar minúsculo e o valor mudar sozinho depois de salvar.
  const [nome, setNome] = useState(nomeInicial.toUpperCase());
  const [email, setEmail] = useState('');
  const [celular, setCelular] = useState('');
  const [tipoPessoa, setTipoPessoa] = useState<'fisica' | 'juridica'>('juridica');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const nomeRef = useRef<HTMLInputElement>(null);

  // Foco explícito em vez de `autoFocus`: o atributo não tira o foco do botão
  // que acabou de ser clicado, e o fluxo aqui é clicar no "+" e já digitar.
  useEffect(() => {
    nomeRef.current?.focus();
    // Cursor no fim quando o nome veio da busca, para o usuário completar em
    // vez de sobrescrever o que já digitou.
    const fim = nomeRef.current?.value.length ?? 0;
    nomeRef.current?.setSelectionRange(fim, fim);
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setErro('Informe o nome do fornecedor.');
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      await onSalvar({ nome, email, celular, tipoPessoa });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao cadastrar o fornecedor.');
      setSalvando(false);
    }
  }

  return (
    <form
      onSubmit={salvar}
      className="absolute z-40 mt-1 w-80 rounded-lg border border-line bg-card p-4 shadow-lg"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold">Cadastrar fornecedor</p>
        <button type="button" onClick={onCancelar} className="text-sm text-muted-foreground hover:text-err">
          ✕
        </button>
      </div>

      <div className="space-y-2">
        <Campo rotulo="Nome *">
          <input
            ref={nomeRef}
            className="field w-full uppercase"
            value={nome}
            onChange={(e) => setNome(e.target.value.toUpperCase())}
          />
        </Campo>

        <Campo rotulo="E-mail">
          <input
            type="email"
            className="field w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Campo>

        <Campo rotulo="Celular">
          <input
            className="field w-full"
            inputMode="tel"
            placeholder="(65) 99999-9999"
            value={celular}
            onChange={(e) => setCelular(e.target.value)}
          />
        </Campo>

        <fieldset>
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">Tipo</legend>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={tipoPessoa === 'fisica'}
                onChange={() => setTipoPessoa('fisica')}
              />
              Pessoa física
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={tipoPessoa === 'juridica'}
                onChange={() => setTipoPessoa('juridica')}
              />
              Pessoa jurídica
            </label>
          </div>
        </fieldset>
      </div>

      {erro && <p className="mt-2 text-xs text-err">{erro}</p>}

      <button type="submit" disabled={salvando || ocupado} className="btn-cta mt-3 w-full disabled:opacity-50">
        {salvando ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
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

export default SeletorFornecedor;
