// Tipos de role global (no nível Supabase auth)
export type GlobalRole = "admin_global" | "user";

// Tipos de role dentro de uma empresa
export type CompanyRole = "admin" | "manager" | "operator" | "viewer";

// Permissões específicas
export type Permission = 
  | "manage_company"
  | "manage_users"
  | "manage_projects"
  | "manage_budgets"
  | "manage_purchases"
  | "view_financial"
  | "export_reports";

// Estrutura do usuário autenticado
export interface AuthUser {
  id: string;
  email: string;
  global_role: GlobalRole;
  current_company_id?: string;
  username: string;
  full_name: string;
  created_at: string;
}

// Estrutura da empresa
export interface Company {
  id: string;
  name: string;
  cnpj?: string;
  logo_url?: string | null;
  created_by: string;
  created_at: string;
  active: boolean;
}

// Associação usuário-empresa com role
// Sub-módulos do módulo Compras
export const COMPRAS_SUBMODULOS = [
  { id: "itens", label: "Itens", to: "/erp/compras/itens" },
  { id: "cotacoes", label: "Cotação", to: "/erp/compras/cotacoes" },
  { id: "ordens", label: "Ordem de Compra", to: "/erp/compras/ordens" },
  { id: "contratos", label: "Contratos", to: "/erp/compras/contratos" },
] as const;

export const COMPRAS_SUBMODULO_IDS = COMPRAS_SUBMODULOS.map((m) => m.id);

/** Verifica acesso a um sub-módulo de Compras (inclui permissão legada "compras"). */
export function temAcessoComprasSub(modulos: string[] | null, subId: string) {
  if (!modulos) return true;
  if (modulos.includes(subId)) return true;
  if (modulos.includes("compras")) return true;
  return false;
}

// Módulos do ERP que podem ser liberados individualmente
export const MODULOS = [
  { id: "inicio", label: "Início", to: "/erp" },
  { id: "clientes", label: "Clientes", to: "/erp/clientes" },
  { id: "obras", label: "Obras", to: "/erp/obras" },
  { id: "orcamentos", label: "Orçamentos", to: "/erp/orcamentos" },
  { id: "fornecedores", label: "Fornecedores", to: "/erp/fornecedores" },
  { id: "itens", label: "Compras — Itens", to: "/erp/compras/itens", grupo: "compras" as const },
  { id: "cotacoes", label: "Compras — Cotação", to: "/erp/compras/cotacoes", grupo: "compras" as const },
  { id: "ordens", label: "Compras — Ordem de Compra", to: "/erp/compras/ordens", grupo: "compras" as const },
  { id: "contratos", label: "Compras — Contratos", to: "/erp/compras/contratos", grupo: "compras" as const },
  { id: "financeiro", label: "Financeiro", to: "/erp/financeiro" },
  { id: "seguranca", label: "Segurança", to: "/erp/seguranca" },
] as const;

export interface CompanyMember {
  id: string;
  user_id: string;
  company_id: string;
  role: CompanyRole;
  can_manage_users: boolean;
  modulos?: string[] | null;
  created_at: string;
  user?: {
    email: string;
    username: string;
    full_name: string;
  };
}

// Mapeamento de role para permissões
export interface RolePermissions {
  role: CompanyRole;
  permissions: Permission[];
  can_manage_users: boolean;
}

// ============ MÓDULOS ERP ============

export interface Cliente {
  id: string;
  company_id: string;
  nome: string;
  documento?: string | null;
  tipo: "Pessoa Física" | "Empresa";
  telefone?: string | null;
  email?: string | null;
  status: "ATIVO" | "INATIVO";
  created_at: string;
}

export type ObraStatus = "PLANEJAMENTO" | "EM EXECUÇÃO" | "MEDIÇÃO" | "CONCLUÍDA" | "INATIVA";

export interface Obra {
  id: string;
  company_id: string;
  cliente_id?: string | null;
  nome: string;
  local?: string | null;
  prazo?: string | null;
  valor: number;
  avanco: number;
  status: ObraStatus;
  created_at: string;
  cliente?: { nome: string } | null;
}

export type OrcamentoStatus = "RASCUNHO" | "APROVADO";

export interface Orcamento {
  id: string;
  company_id: string;
  cliente_id?: string | null;
  obra_id?: string | null;
  nome: string;
  data: string;
  valor: number;
  percentual_consumo: number;
  status: OrcamentoStatus;
  responsavel?: string | null;
  usa_fases: boolean;
  created_at: string;
  cliente?: { nome: string } | null;
  obra?: { nome: string } | null;
}

export interface OrcamentoFase {
  id: string;
  orcamento_id: string;
  nome: string;
  ordem: number;
}

export interface OrcamentoServico {
  id: string;
  orcamento_id: string;
  fase_id?: string | null;
  nome: string;
  tipo: "Serviço" | "Material" | "Misto";
  peso: number;
  ordem: number;
  itens?: OrcamentoItem[];
}

export type ItemModo = "aberto" | "verba";

export interface OrcamentoItem {
  id: string;
  servico_id: string;
  descricao: string;
  peso?: number | null;
  modo: ItemModo;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_verba: number;
  memoria_calculo?: string | null;
  observacoes?: string | null;
  ordem: number;
}

export function itemTotal(item: Pick<OrcamentoItem, "modo" | "quantidade" | "valor_unitario" | "valor_verba">) {
  return item.modo === "verba"
    ? Number(item.valor_verba)
    : Number(item.quantidade) * Number(item.valor_unitario);
}

export interface Fornecedor {
  id: string;
  company_id: string;
  nome: string;
  cnpj?: string | null;
  categoria?: string | null;
  avaliacao: number;
  status: "ATIVO" | "INATIVO";
  created_at: string;
}

export type PedidoStatus = "ENVIADO" | "CONFIRMADO" | "RECEBIDO" | "CANCELADO";

export interface PedidoItem {
  id: string;
  pedido_id: string;
  orcamento_item_id?: string | null;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  orcamento_item?: { descricao: string; servico?: { nome: string } } | null;
}

export interface Pedido {
  id: string;
  company_id: string;
  fornecedor_id?: string | null;
  obra_id?: string | null;
  data: string;
  valor: number;
  forma_pagamento?: string | null;
  status: PedidoStatus;
  created_at: string;
  fornecedor?: { nome: string } | null;
  obra?: { nome: string } | null;
  pedido_itens?: PedidoItem[];
}

export type LancamentoStatus = "NOTA RECEBIDA" | "PAGA" | "ATRASADA" | "CANCELADA";

export interface Lancamento {
  id: string;
  company_id: string;
  titulo: string;
  fornecedor_id?: string | null;
  obra_id?: string | null;
  pedido_id?: string | null;
  processo_numero?: string | null;
  nota_numero?: string | null;
  vencimento?: string | null;
  valor: number;
  forma_pagamento?: string | null;
  status: LancamentoStatus;
  created_at: string;
  fornecedor?: { nome: string } | null;
  obra?: { nome: string } | null;
}

export type MedicaoStatus = "FATURADA" | "PAGA" | "ATRASADA";

export interface Medicao {
  id: string;
  company_id: string;
  obra_id?: string | null;
  servico_id?: string | null;
  orcamento_item_id?: string | null;
  contrato_id?: string | null;
  numero?: number | null;
  data?: string | null;
  percentual_medido: number;
  nome: string;
  vencimento?: string | null;
  valor: number;
  recebido: number;
  status: MedicaoStatus;
  created_at: string;
  obra?: { nome: string } | null;
  servico?: { nome: string } | null;
}

export interface TipoPagamento {
  id: string;
  company_id: string;
  nome: string;
}

// Padrão de role padrão
export const ROLE_PERMISSIONS: Record<CompanyRole, RolePermissions> = {
  admin: {
    role: "admin",
    permissions: [
      "manage_company",
      "manage_users",
      "manage_projects",
      "manage_budgets",
      "manage_purchases",
      "view_financial",
      "export_reports",
    ],
    can_manage_users: true,
  },
  manager: {
    role: "manager",
    permissions: [
      "manage_users",
      "manage_projects",
      "manage_budgets",
      "view_financial",
    ],
    can_manage_users: true,
  },
  operator: {
    role: "operator",
    permissions: [
      "manage_projects",
      "manage_budgets",
      "manage_purchases",
    ],
    can_manage_users: false,
  },
  viewer: {
    role: "viewer",
    permissions: ["view_financial", "export_reports"],
    can_manage_users: false,
  },
};

// ============ COTAÇÃO ============

export interface Cotacao {
  id: string;
  company_id: string;
  obra_id?: string | null;
  numero: number;
  descricao?: string | null;
  status: "ABERTA" | "FECHADA";
  created_at: string;
  obra?: { nome: string } | null;
}

export interface CotacaoItem {
  id: string;
  cotacao_id: string;
  orcamento_item_id?: string | null;
  descricao: string;
  quantidade: number;
  unidade?: string | null;
  ordem: number;
}

export interface CotacaoFornecedor {
  id: string;
  cotacao_id: string;
  fornecedor_id: string;
  condicao_pagamento?: string | null;
  frete: number;
  observacao?: string | null;
  fornecedor?: { nome: string } | null;
}

export interface CotacaoPreco {
  id: string;
  cotacao_fornecedor_id: string;
  cotacao_item_id: string;
  valor_unitario: number;
  marca?: string | null;
  escolhido: boolean;
}

// ============ ORDEM DE COMPRA ============

export type OrdemCompraStatus = "GERADA" | "ENVIADA" | "CONFIRMADA" | "RECEBIDA" | "CANCELADA";

export interface OrdemCompra {
  id: string;
  company_id: string;
  cotacao_id?: string | null;
  obra_id?: string | null;
  fornecedor_id?: string | null;
  numero: number;
  condicao_pagamento: string;
  previsao_entrega?: string | null;
  frete: number;
  observacao?: string | null;
  valor: number;
  status: OrdemCompraStatus;
  created_at: string;
  obra?: { nome: string } | null;
  fornecedor?: { nome: string; cnpj?: string | null } | null;
  itens?: OrdemCompraItem[];
}

export interface OrdemCompraItem {
  id: string;
  ordem_compra_id: string;
  orcamento_item_id?: string | null;
  descricao: string;
  quantidade: number;
  unidade?: string | null;
  valor_unitario: number;
  marca?: string | null;
  ordem: number;
}

// ============ CONTRATOS ============

export type ContratoStatus =
  | "RASCUNHO"
  | "AGUARDANDO ASSINATURA"
  | "ASSINADO"
  | "CONCLUÍDO"
  | "CANCELADO";

export interface Contrato {
  id: string;
  company_id: string;
  obra_id?: string | null;
  fornecedor_id?: string | null;
  numero: number;
  identificador: string;
  descricao?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  valor: number;
  status: ContratoStatus;
  created_at: string;
  obra?: { nome: string } | null;
  fornecedor?: { nome: string; cnpj?: string | null } | null;
  itens?: ContratoItem[];
}

export interface ContratoItem {
  id: string;
  contrato_id: string;
  orcamento_item_id?: string | null;
  descricao: string;
  quantidade: number;
  unidade?: string | null;
  valor_unitario: number;
  ordem: number;
}
