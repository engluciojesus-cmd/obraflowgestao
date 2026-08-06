# 01 — Arquitetura Alvo

> Tradução técnica das recomendações do documento, aplicadas ao código real do ObraFlow.

---

## 1. Estrutura de pastas por domínio

O documento sugeriu "organizar por domínio em vez de por tela". Correto. Abaixo o formato exato.

```
src/
├── app/
│   ├── providers.tsx              # QueryClient + TenantProvider + ErrorBoundary
│   ├── router.tsx
│   └── env.ts                     # validação das env vars com zod (falha no boot, não em runtime)
│
├── core/                          # infraestrutura, zero regra de negócio
│   ├── supabase/
│   │   ├── client.ts
│   │   └── database.types.ts      # GERADO: supabase gen types typescript
│   ├── errors/
│   │   ├── AppError.ts            # erro de domínio tipado
│   │   └── mapSupabaseError.ts    # PostgrestError → AppError legível em pt-BR
│   ├── result.ts                  # Result<T, E> — sem try/catch espalhado
│   └── money.ts                   # aritmética decimal (NUNCA float para dinheiro)
│
├── shared/
│   ├── components/                # Button, Table, Modal, Field, Toast
│   ├── hooks/
│   └── format/                    # moeda, data, quantidade, unidade
│
├── modules/
│   ├── compras/
│   │   ├── domain/
│   │   │   ├── types.ts           # Cotacao, CotacaoPreco, ItemCotado
│   │   │   ├── rules.ts           # ⭐ REGRA PURA, sem React, sem Supabase
│   │   │   └── schemas.ts         # zod
│   │   ├── data/
│   │   │   └── cotacoes.repository.ts   # ÚNICO lugar que fala com Supabase
│   │   ├── application/
│   │   │   └── cotacoes.service.ts      # orquestra repository + rules
│   │   ├── ui/
│   │   │   ├── hooks/             # useCotacao, useSalvarPreco (TanStack Query)
│   │   │   └── components/        # MapaCotacaoTabela, LinhaFornecedor
│   │   └── index.ts               # API pública do módulo
│   │
│   ├── obras/  orcamentos/  fornecedores/  financeiro/  clientes/
│   └── inteligencia/              # ⭐ o diferencial — ver arquivo 03
│
└── routes/                        # apenas TanStack Router: layout + composição
    └── _authenticated/erp/compras/cotacoes/$cotacaoId.tsx   # alvo: < 120 linhas
```

**Regra de dependência — sentido único, sem exceção:**

```
routes  →  modules/*/ui  →  application  →  data  →  core
                                   ↓
                                domain  (não importa de ninguém)
```

`domain/rules.ts` **não pode importar React nem Supabase**. Se importar, a regra deixa de ser testável e deixa de ser reutilizável pelo backend/IA.

Cole isto no topo de cada `rules.ts` como lembrete:

```ts
// ⛔ PROIBIDO NESTE ARQUIVO: react, @supabase/*, @tanstack/*
// Só entra dado, só sai dado. Testável sem browser e sem banco.
```

---

## 2. Como extrair regra de negócio — exemplo real do seu código

### Hoje, dentro de `$cotacaoId.tsx`:

```ts
function menorPreco(itemId: string) {
  let menor = Infinity;
  for (const f of fornecedores) {
    const v = Number(preco(f.id, itemId)?.valor_unitario) || 0;
    if (v > 0 && v < menor) menor = v;
  }
  return menor === Infinity ? 0 : menor;
}
```

Três problemas: está dentro de um componente React; usa `Number()` em dinheiro; e ignora quantidade, frete e condição de pagamento — que é como a decisão de compra realmente acontece.

### Alvo — `modules/compras/domain/rules.ts`:

```ts
import type { Decimal } from "@/core/money";
import { dec, mul, add, div, isZero } from "@/core/money";

export interface PropostaItem {
  fornecedorId: string;
  itemId: string;
  valorUnitario: Decimal;
  marca: string | null;
  disponivel: boolean;
}

export interface CondicaoFornecedor {
  fornecedorId: string;
  frete: Decimal;
  descontoGlobalPct: Decimal;
  prazoPagamentoDias: number;
  prazoEntregaDias: number;
}

export interface Ranking {
  fornecedorId: string;
  totalBruto: Decimal;
  totalLiquido: Decimal;        // com frete e desconto
  totalPresente: Decimal;       // ⭐ trazido a valor presente pelo prazo de pagamento
  itensAtendidos: number;
  itensTotais: number;
  cobertura: number;            // 0..1
}

/**
 * Ranking de fornecedores em um mapa de cotação.
 *
 * Diferencial: `totalPresente` traz o total a valor presente usando a taxa de
 * oportunidade da empresa. Um fornecedor 2% mais caro a 60 dias pode ser mais
 * barato que um à vista. Nenhum ERP de pequeno porte faz essa conta — e é
 * exatamente a conta que o comprador faz de cabeça, errado, todo dia.
 */
export function rankearFornecedores(params: {
  itens: { id: string; quantidade: Decimal }[];
  propostas: PropostaItem[];
  condicoes: CondicaoFornecedor[];
  taxaOportunidadeMensal: Decimal;   // ex: 0.015 = 1,5% a.m.
}): Ranking[] { /* ... */ }

/** Menor preço unitário válido de um item entre todos os fornecedores. */
export function menorPrecoUnitario(
  itemId: string,
  propostas: PropostaItem[],
): Decimal | null { /* ... */ }

/**
 * Split de compra: qual fornecedor por item minimiza o custo total,
 * respeitando pedido mínimo e número máximo de fornecedores.
 */
export function splitOtimo(params: {
  itens: { id: string; quantidade: Decimal }[];
  propostas: PropostaItem[];
  condicoes: CondicaoFornecedor[];
  maxFornecedores: number;
  pedidoMinimoPorFornecedor: Map<string, Decimal>;
}): { fornecedorId: string; itemIds: string[]; total: Decimal }[] { /* ... */ }
```

Agora essa função é chamada **pela tela, pelo agente de IA e pelo relatório** — uma implementação só.

---

## 3. Contexto de tenant (corrige P0.2)

```ts
// src/app/TenantProvider.tsx
interface TenantContext {
  companyId: string;
  company: Company;
  role: CompanyRole;
  modulos: string[] | null;        // null = todos
  isAdminGlobal: boolean;
  trocarEmpresa: (id: string) => void;
  pode: (modulo: string) => boolean;
}
```

Regras de implementação:

1. Empresa ativa persiste em `localStorage` sob a chave `obraflow.company_id`.
2. No boot, valida que o usuário ainda é membro dessa empresa; se não for, cai para a primeira.
3. `admin_global` **não entra automaticamente** em nenhuma empresa — precisa escolher explicitamente. Isso evita você operar dentro do cliente errado por acidente.
4. **Trocar de empresa executa `queryClient.clear()`.** Sem isso, dados da empresa A vazam em cache para a tela da empresa B. É o bug mais perigoso de SaaS multi-tenant e o mais fácil de cometer.
5. `useActiveCompany()` vira um alias fino de `useTenant()` para não quebrar as telas existentes durante a migração.

---

## 4. Camada de dados

```ts
// modules/compras/data/cotacoes.repository.ts
// ÚNICO arquivo do módulo autorizado a importar `supabase`.

export const cotacoesRepository = {
  async buscarMapa(cotacaoId: string): Promise<MapaCotacaoDTO> { /* ... */ },
  async salvarPreco(input: SalvarPrecoInput): Promise<void> { /* ... */ },
  async gerarOrdemCompra(input: GerarOCInput): Promise<{ ordemId: string }> { /* ... */ },
};
```

Query keys hierárquicas e **sempre prefixadas por `companyId`**:

```ts
export const comprasKeys = {
  all: (c: string) => ["compras", c] as const,
  cotacoes: (c: string) => [...comprasKeys.all(c), "cotacoes"] as const,
  cotacao: (c: string, id: string) => [...comprasKeys.cotacoes(c), id] as const,
  mapa: (c: string, id: string) => [...comprasKeys.cotacao(c, id), "mapa"] as const,
};
```

O prefixo por `companyId` é o que torna o `queryClient.clear()` do item 3 uma rede de segurança em vez da única defesa.

---

## 5. Transações — o que precisa sair do front

Estas operações hoje são múltiplos `INSERT` sequenciais do navegador. Se a rede cair no meio, o banco fica inconsistente. Cada uma precisa virar uma **Postgres function** (`SECURITY INVOKER`, para que a RLS continue valendo), chamada via `supabase.rpc()`:

| Operação | Onde está hoje | Por que precisa ser atômica |
|---|---|---|
| Cotação → Ordem de Compra | `$cotacaoId.tsx` | Cria OC + N itens + atualiza status da cotação |
| Aprovar orçamento | `orcamentos/$orcamentoId.tsx` | Congela versão + gera serviços + atualiza obra |
| Registrar medição | `obras/$obraId.tsx` | Atualiza `medicoes` + `%` da obra + gera lançamento |
| Receber nota fiscal | `itens.tsx` | Baixa estoque + lançamento financeiro + histórico de preço |
| Criar cotação a partir de itens | `itens.tsx` | Numeração sequencial (hoje com race condition) |

Exemplo de numeração segura (substitui o `order desc limit 1` de `itens.tsx`):

```sql
create table public.sequencias (
  company_id uuid not null references public.companies(id) on delete cascade,
  entidade   text not null,
  valor      bigint not null default 0,
  primary key (company_id, entidade)
);

create or replace function public.proximo_numero(p_company uuid, p_entidade text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  insert into public.sequencias (company_id, entidade, valor)
  values (p_company, p_entidade, 1)
  on conflict (company_id, entidade)
    do update set valor = public.sequencias.valor + 1
  returning valor into v;
  return v;
end $$;
```

`ON CONFLICT DO UPDATE` trava a linha. Dois usuários simultâneos recebem números diferentes, garantido.

---

## 6. Dependências a adicionar

```bash
npm i @tanstack/react-query zod decimal.js date-fns
npm i -D vitest @testing-library/react @vitest/coverage-v8
```

- `decimal.js` — **obrigatório**. `0.1 + 0.2 !== 0.3` em float. Em um ERP que fecha medição de R$ 400 mil, o erro acumulado aparece na planilha do cliente e você perde o contrato.
- `zod` — valida env vars no boot e formulários na borda.
- `vitest` — `domain/rules.ts` é puro, então testar é trivial. Comece só por aí; 30 testes das regras de compras e medição valem mais que 300 testes de componente.

E corrija:

```json
"build": "tsc -b && vite build"
```

---

## 7. Tipos gerados, não escritos à mão

`src/types/index.ts` tem 10 KB de interfaces mantidas manualmente. Elas **vão** divergir do banco.

```bash
npx supabase gen types typescript --linked > src/core/supabase/database.types.ts
```

Adicione ao `package.json`:

```json
"types": "supabase gen types typescript --linked > src/core/supabase/database.types.ts"
```

Rode após toda migration. Os tipos de domínio (`modules/*/domain/types.ts`) continuam escritos à mão — mas derivam dos gerados:

```ts
import type { Database } from "@/core/supabase/database.types";
type Row = Database["public"]["Tables"]["cotacoes"]["Row"];

export interface Cotacao extends Omit<Row, "created_at"> {
  criadoEm: Date;
  fornecedores: CotacaoFornecedor[];
}
```

---

## 8. Módulos — mapa de evolução

| Módulo | Status hoje | Próximo passo |
|---|---|---|
| Clientes | funcional | refatorar para `modules/` |
| Obras | funcional | + diário de obra, + cronograma |
| Orçamentos | funcional, bem modelado | + versionamento (congelar ao aprovar) |
| Fornecedores | básico | + scorecard (arquivo 03) |
| Compras | mais maduro | extrair regras; ligar ao catálogo canônico |
| Financeiro | básico | + fluxo de caixa projetado |
| Segurança | existe | descer permissão para o banco |
| **Estoque** | ❌ | pré-requisito da Inteligência da Obra |
| **Medições** | parcial | tabela própria + ligação com serviço |
| **Documentos** | ❌ | pré-requisito do agente (RAG) |
| **Inteligência** | ❌ | arquivo 03 |

**Estoque não é opcional.** Sem saldo, a sugestão "compre argamassa" é ruído — talvez você já tenha 200 sacos no canteiro. O diferencial de IA depende dele.
