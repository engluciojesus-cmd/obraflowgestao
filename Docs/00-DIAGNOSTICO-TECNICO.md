# 00 — Diagnóstico Técnico do ObraFlow Gestão

> Auditoria do commit `39da4db` (83 arquivos, 454 KB). Leitura completa de `src/`, `supabase/migrations/`, `supabase/functions/`.

---

## Resumo executivo

O documento que você recebeu deu nota 9/10 para a arquitetura. **Eu discordo — a nota real hoje é 5/10.** Não porque as escolhas de tecnologia estejam erradas (elas estão certas), mas porque existem três problemas estruturais que o revisor anterior não detectou porque avaliou a *árvore de pastas*, não o *código e o schema*.

Vou listar em ordem de gravidade. **Nada de IA deve ser construído antes dos itens P0 estarem resolvidos** — construir IA sobre esta base é construir sobre areia.

---

## P0 — BLOQUEADORES (resolver esta semana)

### P0.1 — Schema drift: 6 tabelas existem no código e não existem nas migrations

Rodei um levantamento de todas as tabelas referenciadas em `src/`:

```
clientes ✅  companies ✅  company_members ✅  fornecedores ✅
lancamentos ✅  medicoes ✅  obras ✅  orcamentos ✅
orcamento_fases ✅  orcamento_itens ✅  orcamento_servicos ✅
pedidos ✅  pedido_itens ✅  tipos_pagamento ✅  users ✅

contratos            ❌ SEM MIGRATION
contrato_itens       ❌ SEM MIGRATION
cotacoes             ❌ SEM MIGRATION
cotacao_itens        ❌ SEM MIGRATION
cotacao_fornecedores ❌ SEM MIGRATION
cotacao_precos       ❌ SEM MIGRATION
ordens_compra        ❌ SEM MIGRATION
ordem_compra_itens   ❌ SEM MIGRATION
```

Além disso, `company_members.modulos` é lido em `useAuth.ts` (`useModulosPermitidos`) e usado em `types/index.ts`, mas **essa coluna não existe em nenhuma migration**.

**O que isso significa na prática:** você criou essas tabelas manualmente pelo SQL Editor do Supabase. Elas existem no seu banco de produção e em mais lugar nenhum. Consequências:

- Ninguém consegue clonar o repo e rodar o projeto.
- Você não consegue criar um ambiente de staging.
- Você não sabe se as RLS dessas 8 tabelas estão corretas — e se estiverem erradas, **um cliente vê os dados de outro cliente**. Isso é o fim de um SaaS.
- Se o projeto Supabase for corrompido ou você errar um `DROP`, não há como reconstruir.

**Correção (fazer agora, antes de qualquer outra coisa):**

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db pull --schema public
```

Isso gera uma migration com o estado real do banco. Commite. A partir desse ponto, **nunca mais rode DDL pelo SQL Editor** — toda mudança de schema vira arquivo em `supabase/migrations/`.

Depois rode e confira que as 8 tabelas têm RLS:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by rowsecurity, tablename;
```

Qualquer linha com `rowsecurity = false` é um vazamento de dados entre empresas.

---

### P0.2 — `useActiveCompany` quebra multiempresa (o SaaS não funciona)

`src/hooks/useAuth.ts`, linha ~180:

```ts
export function useActiveCompany() {
  const { companies, loading, error } = useUserCompanies();
  return {
    company: companies[0] ?? null,   // ⚠️
    companyId: companies[0]?.id ?? null,
    loading, error,
  };
}
```

**`companies[0]` é a empresa ativa.** Não há seletor, não há persistência, não há contexto.

Efeitos:
1. Um usuário que pertence a duas construtoras só enxerga a primeira. Para sempre.
2. Para `admin_global`, `companies[0]` é a empresa mais recente criada — ou seja, você mesmo, como admin da plataforma, opera "dentro" de um cliente aleatório.
3. Todo módulo ERP chama `useActiveCompany()` → cada um dispara `useUserCompanies()` → que dispara `useAuthUser()` → que faz `supabase.auth.getSession()` + um `select` em `users`. **A tela de orçamentos faz ~8 round-trips redundantes só para descobrir quem é o usuário.**

Isso não é um bug de tela. É a ausência da camada de tenant. Ver `01-ARQUITETURA-ALVO.md` §3.

---

### P0.3 — Policy de RLS com risco de recursão infinita

`20260803000000_obraflow_multitenant.sql`:

```sql
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND global_role = (SELECT global_role FROM public.users u WHERE u.id = auth.uid())
  );
```

O `WITH CHECK` de uma policy da tabela `users` faz `SELECT ... FROM public.users`. É exatamente o padrão que a própria migration diz ter corrigido nas outras policies com `SECURITY DEFINER` — mas ficou de fora aqui. O Postgres retorna `infinite recursion detected in policy for relation "users"` em qualquer UPDATE de perfil.

**Correção:**

```sql
CREATE OR REPLACE FUNCTION public.my_global_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT global_role FROM public.users WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND global_role = public.my_global_role());
```

---

## P1 — DÍVIDA ESTRUTURAL (resolver antes do primeiro cliente pagante)

### P1.1 — Regra de negócio dentro das rotas

`compras/cotacoes/$cotacaoId.tsx` tem **27.542 caracteres**. `compras/itens.tsx` tem **28.576**. `orcamentos/$orcamentoId.tsx` tem **33.348**.

Dentro de `$cotacaoId.tsx` convivem, no mesmo arquivo: fetch do Supabase, cálculo de menor preço, upsert otimista, geração de ordem de compra, e JSX. A função `menorPreco()` — que é **regra de negócio de suprimentos** — está declarada dentro de um componente React.

Isso não é só feio. É o que impede a IA. Quando você quiser que o agente responda *"qual o menor preço do cimento nesta cotação?"*, ele precisa executar a mesma regra que a tela executa. Se a regra só existe dentro de um componente React, o backend não alcança. Você vai reimplementar — e as duas implementações vão divergir.

**Regra:** toda função que produz um número que o cliente vai usar para decidir dinheiro sai da rota. Ver `01-ARQUITETURA-ALVO.md` §2.

### P1.2 — Sem camada de dados (nem TanStack Query)

`package.json` tem 4 dependências de runtime. Não há `@tanstack/react-query`. Todo fetch é `useEffect` + `useState` + `supabase.from(...)` manual, com:

- zero cache → toda navegação refaz todas as queries
- zero invalidação → salvar em uma tela não atualiza outra
- zero retry
- zero estado de erro padronizado (várias telas ignoram `error` silenciosamente)

Você já está usando TanStack Router. `@tanstack/react-query` é do mesmo ecossistema e resolve isso em uma tarde.

### P1.3 — Permissões: o banco é mais permissivo que a tela

O front tem permissão granular por módulo (`MODULOS`, `useModulosPermitidos`, `temAcessoComprasSub`). O banco tem:

```sql
CREATE OR REPLACE FUNCTION public.can_write_company(target_company_id UUID) ...
  AND role IN ('admin', 'manager', 'operator')
```

Ou seja: **um `operator` sem permissão de Financeiro na interface pode escrever em `lancamentos` via chamada direta à API.** A anon key está no bundle do navegador — qualquer pessoa abre o DevTools, copia o token e faz o `POST`. A permissão granular hoje é decorativa.

Para vender B2B isso é reprovação imediata em qualquer due diligence. A permissão precisa descer para o banco. Ver `02-migration-fundacao-ia.sql` §0.

### P1.4 — Script de build roda `vite build` duas vezes

```json
"build": "vite build && tsc -b && vite build"
```

Deve ser `"build": "tsc -b && vite build"`. Você está pagando o dobro de minutos de build no Netlify por um erro de digitação.

### P1.5 — Sem validação de entrada, sem tratamento de erro, sem toast

Não há `zod`. Não há Error Boundary. Não há feedback visual de erro. `.single()` em vários lugares onde `.maybeSingle()` seria correto — `.single()` lança 406 quando não encontra, e várias telas engolem isso.

---

## P2 — O QUE FALTA PARA SER SaaS (não apenas software)

| Falta | Impacto |
|---|---|
| `company_id` nas tabelas-filho | RLS via `JOIN` é lenta e frágil (ver P1.6) |
| Trilha de auditoria | Cliente B2B **exige** "quem alterou este preço?" |
| Soft delete | Hoje `DELETE` é permanente. Cliente apaga uma obra e não há volta |
| Planos / limites / billing | Sem isso não existe SaaS, existe software |
| Observabilidade (Sentry) | Você descobre bugs pelo WhatsApp do cliente |
| Backup testado | Supabase faz backup. Você já testou o *restore*? |
| Numeração sequencial por empresa | `itens.tsx` faz `select ... order desc limit 1` para achar o próximo número da cotação. Dois usuários simultâneos geram o mesmo número. Precisa de sequence ou constraint |

### P1.6 — RLS por JOIN em cascata

```sql
CREATE POLICY "orcamento_itens_select" ON public.orcamento_itens
  FOR SELECT USING (
    servico_id IN (
      SELECT id FROM public.orcamento_servicos
      WHERE public.orcamento_company(orcamento_id) IN (SELECT public.my_company_ids())
    ) OR public.is_admin_global()
  );
```

Para ler **um** item, o Postgres resolve: `orcamento_itens → orcamento_servicos → orcamentos → company_members`. Com 50 mil itens isso derruba a tela.

**Correção:** denormalizar `company_id` em toda tabela-filho e simplificar toda RLS para `company_id = any(my_company_ids())`. Um índice, uma comparação. Está no `02-migration-fundacao-ia.sql`.

---

## Notas revisadas

| Dimensão | Nota do doc anterior | Nota real | Por quê |
|---|:---:|:---:|---|
| Escolha de tecnologias | 10 | **10** | React + TS + Vite + TanStack + Supabase está correto |
| Arquitetura | 9 | **4** | Sem camada de serviço; regra de negócio na UI |
| Escalabilidade | 9 | **4** | RLS por JOIN; sem cache; sem `company_id` denormalizado |
| Organização | 9 | **6** | Pastas boas, arquivos de 30 KB |
| **Segurança multi-tenant** | não avaliado | **3** | 8 tabelas sem RLS versionada; permissão só no front |
| **Reprodutibilidade** | não avaliado | **2** | Schema drift; repo não sobe do zero |
| Potencial comercial | 10 | **10** | Concordo integralmente — e explico em `03` por quê |

O potencial é real. A base precisa de duas a três semanas de correção antes de receber IA.

---

## Ordem de execução recomendada

```
Semana 1  P0.1 db pull + auditar RLS das 8 tabelas
          P0.3 corrigir users_update_own
          P1.4 corrigir build script

Semana 2  P0.2 TenantProvider + seletor de empresa
          P1.2 TanStack Query
          P1.3 + P1.6 permissão granular no banco + company_id denormalizado

Semana 3  P1.1 extrair services/ e repositories/ (módulo Compras primeiro)
          P2   auditoria (tabela eventos) + soft delete

Semana 4+ FUNDAÇÃO DE IA — arquivo 02 e 03
```
