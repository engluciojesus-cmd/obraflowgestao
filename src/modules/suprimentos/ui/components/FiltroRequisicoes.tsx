import { REQUISICAO_STATUS, type RequisicaoStatus } from '@/modules/suprimentos/domain/types';
import { PainelFiltros, CampoFiltro, FaixaDeData } from '@/components/PainelFiltros';

// Doc lista 8 opções no filtro — ATENDIDA fica de fora (não tem "resolvido" nesta tela).
const OPCOES_STATUS: RequisicaoStatus[] = [
  'ABERTA',
  'PARCIAL',
  'RASCUNHO',
  'COTADA',
  'REJEITADA',
  'OC_GERADA',
  'CONTRATO_GERADO',
  'CANCELADA',
];

export interface FiltroRequisicoesState {
  /** Uma situação por vez, '' = todas. Era um array de checkboxes; ver abaixo. */
  situacao: string;
  numero: string;
  obraId: string;
  solicitanteId: string;
  dataSolicDe: string;
  dataSolicAte: string;
  dataNecDe: string;
  dataNecAte: string;
}

/**
 * Filtro em branco — literalmente tudo vazio.
 *
 * Antes isto vinha com `status: ['ABERTA','PARCIAL']` pré-marcado, o que fazia
 * "Limpar filtros" parecer quebrado: o botão funcionava, mas devolvia o estado
 * pré-marcado em vez de limpar. Com a busca sob demanda não há mais motivo para
 * um padrão implícito — quem abre a tela escolhe o que quer ver.
 */
export function filtroRequisicoesPadrao(): FiltroRequisicoesState {
  return {
    situacao: '',
    numero: '',
    obraId: '',
    solicitanteId: '',
    dataSolicDe: '',
    dataSolicAte: '',
    dataNecDe: '',
    dataNecAte: '',
  };
}

export function FiltroRequisicoes({
  value,
  onChange,
  onBuscar,
  onLimpar,
  obras,
  solicitantes,
  buscando = false,
}: {
  value: FiltroRequisicoesState;
  onChange: (v: FiltroRequisicoesState) => void;
  onBuscar: () => void;
  onLimpar: () => void;
  obras: { id: string; nome: string }[];
  solicitantes: { id: string; nome: string }[];
  buscando?: boolean;
}) {
  function set<K extends keyof FiltroRequisicoesState>(key: K, v: FiltroRequisicoesState[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <PainelFiltros onBuscar={onBuscar} onLimpar={onLimpar} buscando={buscando}>
      <CampoFiltro rotulo="Situação">
        {/* Select em vez de 8 checkboxes: a consulta vira uma situação só e o
            usuário para de montar combinações que o banco nunca produz. */}
        <select className="field w-full" value={value.situacao} onChange={(e) => set('situacao', e.target.value)}>
          <option value="">Todas</option>
          {OPCOES_STATUS.map((s) => (
            <option key={s} value={s}>
              {REQUISICAO_STATUS[s].label}
            </option>
          ))}
        </select>
      </CampoFiltro>

      <CampoFiltro rotulo="Número">
        <input
          className="field w-full"
          value={value.numero}
          onChange={(e) => set('numero', e.target.value)}
          placeholder="000616"
        />
      </CampoFiltro>

      <CampoFiltro rotulo="Obra">
        <select className="field w-full" value={value.obraId} onChange={(e) => set('obraId', e.target.value)}>
          <option value="">Todas</option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
      </CampoFiltro>

      <CampoFiltro rotulo="Solicitante">
        <select
          className="field w-full"
          value={value.solicitanteId}
          onChange={(e) => set('solicitanteId', e.target.value)}
        >
          <option value="">Todos</option>
          {solicitantes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
      </CampoFiltro>

      <FaixaDeData
        rotulo="Data solicitação"
        de={value.dataSolicDe}
        ate={value.dataSolicAte}
        onDe={(v) => set('dataSolicDe', v)}
        onAte={(v) => set('dataSolicAte', v)}
      />

      <FaixaDeData
        rotulo="Data necessidade"
        de={value.dataNecDe}
        ate={value.dataNecAte}
        onDe={(v) => set('dataNecDe', v)}
        onAte={(v) => set('dataNecAte', v)}
      />
    </PainelFiltros>
  );
}

export default FiltroRequisicoes;
