# 04 — Prompts para o Continue (VS Code)

> Você disse que não é desenvolvedor e escreve o que quer no Continue. Este arquivo é o roteiro: prompts prontos, na ordem certa, com o critério de aceite de cada um.

---

## Como usar

1. Coloque os arquivos `00`, `01`, `02`, `03` numa pasta `docs/` **dentro do repositório**.
2. No Continue, sempre inicie a conversa com `@docs` ou anexe o arquivo relevante — sem isso o modelo não conhece a arquitetura e inventa outra.
3. **Um prompt por vez.** Rode, teste, commite. Não emende dois.
4. Depois de cada prompt, rode `npm run build`. Se der erro, cole o erro no Continue e peça correção antes de seguir.

**Regra de ouro:** se o Continue entregar um arquivo com mais de 300 linhas, algo saiu errado. Peça para dividir.

---

## FASE 1 — Fundação (não pule nada aqui)

### Prompt 1.1 — Versionar o schema real

> Não é prompt de IA. É comando de terminal. Faça manualmente:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db pull --schema public
git add supabase/migrations/ && git commit -m "chore: versiona schema real do banco"
```

**Aceite:** existe uma migration nova contendo `create table` para `cotacoes`, `cotacao_itens`, `cotacao_fornecedores`, `cotacao_precos`, `contratos`, `contrato_itens`, `ordens_compra`, `ordem_compra_itens`.

---

### Prompt 1.2 — Auditar RLS

```
Rode esta query no SQL Editor do Supabase e me diga o resultado:

select tablename, rowsecurity,
       (select count(*) from pg_policies p where p.tablename = t.tablename) as policies
from pg_tables t
where schemaname = 'public'
order by rowsecurity asc, policies asc;

Depois, para toda tabela com rowsecurity = false OU policies = 0, gere uma
migration que:
1. habilita RLS
2. cria policy de SELECT usando public.pode_ler(company_id)
3. cria policy de ALL usando public.can_write_company(company_id)

Se a tabela não tiver coluna company_id, primeiro adicione a coluna, faça o
backfill a partir da tabela pai, e crie trigger BEFORE INSERT para herdar.
Siga exatamente o padrão de docs/02-migration-fundacao-ia.sql §1.
```

**Aceite:** a query devolve `rowsecurity = true` e `policies >= 2` para **todas** as tabelas.

> Enquanto isso não estiver verde, você tem risco de um cliente ver os dados de outro. É o único item da lista que pode destruir o negócio de uma vez.

---

### Prompt 1.3 — Corrigir o build

```
Em package.json, o script "build" está:
  "vite build && tsc -b && vite build"

Corrija para "tsc -b && vite build".
Adicione também: "types": "supabase gen types typescript --linked > src/core/supabase/database.types.ts"

Instale as dependências: @tanstack/react-query, zod, decimal.js, date-fns.
Em devDependencies: vitest, @testing-library/react, @vitest/coverage-v8.
Crie vitest.config.ts com o mesmo alias "@" do vite.config.ts.
```

---

### Prompt 1.4 — TenantProvider (corrige o bug mais grave do front)

```
Contexto: leia docs/00-DIAGNOSTICO-TECNICO.md §P0.2 e docs/01-ARQUITETURA-ALVO.md §3.

Problema: src/hooks/useAuth.ts tem useActiveCompany() que retorna companies[0].
Isso quebra multiempresa e faz cada tela disparar 8 queries redundantes.

Crie:

1. src/app/TenantProvider.tsx exportando TenantProvider e useTenant() com o
   contrato exato descrito em docs/01-ARQUITETURA-ALVO.md §3, incluindo:
   - persistência da empresa ativa em localStorage sob "obraflow.company_id"
   - validação no boot de que o usuário ainda é membro daquela empresa
   - admin_global NÃO entra automaticamente em empresa nenhuma
   - trocarEmpresa() chama queryClient.clear() antes de trocar
   - pode(modulo: string): boolean

2. src/app/providers.tsx compondo QueryClientProvider + TenantProvider + ErrorBoundary.
   staleTime: 30s, retry: 1, refetchOnWindowFocus: false.

3. Um componente SeletorEmpresa no header de ErpLayout.tsx. Se o usuário tiver
   só uma empresa, mostra o nome sem dropdown.

4. Mantenha useActiveCompany() exportado de useAuth.ts como alias fino de
   useTenant(), para não quebrar as ~15 telas existentes agora.

IMPORTANTE: não altere nenhuma rota nesta tarefa. Só criar o provider e o alias.
```

**Aceite:** logar com usuário de duas empresas, trocar no seletor, e os dados da tela mudarem. Recarregar a página mantém a empresa escolhida.

**Teste de segurança obrigatório:** crie duas empresas, entre na A, abra Orçamentos, troque para B. Se aparecer qualquer registro da A, o `queryClient.clear()` não está funcionando. **Não siga adiante sem isso resolvido.**

---

### Prompt 1.5 — Tipos gerados

```
Rode: npm run types

Depois refatore src/types/index.ts para que as interfaces de tabela (Cliente,
Obra, Orcamento, Fornecedor, Pedido, Cotacao, Contrato...) derivem de
Database["public"]["Tables"][X]["Row"] em vez de serem escritas à mão.

Mantenha escritos à mão apenas: GlobalRole, CompanyRole, Permission, MODULOS,
COMPRAS_SUBMODULOS e as funções helper. Esses são domínio, não schema.
```

---

## FASE 2 — Extrair o domínio

### Prompt 2.1 — Núcleo de dinheiro

```
Crie src/core/money.ts usando decimal.js:

- type Money (branded), dec(v), add, sub, mul, div, pct, isZero, gt, lt, eq
- fromDatabase(n: number | string): Money
- toDatabase(m: Money): number
- formatBRL(m: Money): string
- Arredondamento: ROUND_HALF_UP, 2 casas para valores, 4 para unitários

Crie src/core/errors/AppError.ts e mapSupabaseError.ts, traduzindo os códigos
PostgREST para português:
  PGRST116 -> "Registro não encontrado"
  23505    -> "Já existe um registro com esses dados"
  23503    -> "Não é possível excluir: existem registros vinculados"
  42501    -> "Você não tem permissão para esta operação"

Escreva testes vitest para money.ts cobrindo o caso 0.1 + 0.2 === 0.3.
```

---

### Prompt 2.2 — Primeiro módulo de domínio (Compras)

```
Contexto: leia docs/01-ARQUITETURA-ALVO.md §1 e §2.

Refatore o módulo Compras seguindo a arquitetura em camadas. NÃO altere a UI
ainda — apenas crie a estrutura e mova a lógica.

Crie:
  src/modules/compras/domain/types.ts
  src/modules/compras/domain/rules.ts
  src/modules/compras/domain/schemas.ts       (zod)
  src/modules/compras/data/cotacoes.repository.ts
  src/modules/compras/application/cotacoes.service.ts
  src/modules/compras/index.ts

Em rules.ts implemente, com as assinaturas exatas de
docs/01-ARQUITETURA-ALVO.md §2:
  - menorPrecoUnitario()
  - rankearFornecedores()  incluindo totalPresente (valor presente pelo prazo)
  - splitOtimo()

REGRAS ABSOLUTAS de rules.ts:
- proibido importar react, @supabase/*, @tanstack/*
- todo valor monetário usa Money de @/core/money, nunca number
- funções puras: mesma entrada, mesma saída, sem efeito colateral

Escreva testes vitest para rules.ts cobrindo:
  - fornecedor sem cotar um item (cobertura parcial)
  - empate de preço
  - frete que inverte o ranking
  - prazo de pagamento que inverte o ranking (o caso que justifica totalPresente)
```

**Aceite:** `npx vitest run` passa. Nenhum `import` proibido em `rules.ts`.

---

### Prompt 2.3 — Enxugar a tela

```
src/routes/_authenticated/erp/compras/cotacoes/$cotacaoId.tsx tem 27.542
caracteres com fetch, regra de negócio e JSX misturados.

Refatore para menos de 120 linhas, usando:
  - useCotacaoMapa() de @/modules/compras (TanStack Query)
  - useSalvarPreco() com optimistic update via onMutate/onError/onSettled
  - componentes extraídos para src/modules/compras/ui/components/:
      MapaCotacaoTabela, LinhaItem, ColunaFornecedor, ResumoRanking, ModalGerarOC

A tela deve APENAS: chamar hooks, tratar loading/erro, compor componentes.
Zero cálculo. Zero supabase.from(). Zero regra de negócio.

Adicione uma seção "Ranking" usando rankearFornecedores(), mostrando por
fornecedor: total bruto, total líquido, total a valor presente, cobertura.
Destaque visualmente quando o vencedor por valor presente for DIFERENTE do
vencedor por preço bruto — esse é o insight que justifica a funcionalidade.

Query keys conforme docs/01-ARQUITETURA-ALVO.md §4 (sempre prefixadas por companyId).
```

Repita o padrão dos prompts 2.2/2.3 para: `orcamentos`, `obras`, `financeiro`.

---

### Prompt 2.4 — Transações atômicas

```
Contexto: docs/01-ARQUITETURA-ALVO.md §5.

Crie migration com Postgres functions SECURITY INVOKER para as operações que
hoje são múltiplos INSERT sequenciais do navegador:

1. public.gerar_ordem_compra(p_cotacao_id uuid, p_fornecedor_id uuid,
     p_itens uuid[], p_condicoes jsonb) returns uuid
2. public.aprovar_orcamento(p_orcamento_id uuid) returns void
     — deve CONGELAR uma versão do orçamento em orcamento_versoes
3. public.registrar_medicao(p_obra_id uuid, p_servico_id uuid,
     p_percentual numeric, p_valor numeric) returns uuid
4. public.proximo_numero(p_company uuid, p_entidade text) returns bigint
     — copie a implementação de docs/01-ARQUITETURA-ALVO.md §5

Depois substitua em itens.tsx o trecho que busca o próximo número da cotação
com "order by desc limit 1" por rpc('proximo_numero'). Esse trecho tem race
condition: dois usuários simultâneos geram o mesmo número.

Atualize os repositories para usar supabase.rpc() nessas operações.
```

---

## FASE 3 — Fundação de IA

### Prompt 3.1 — Aplicar a migration

```
Crie o arquivo supabase/migrations/20260810000000_fundacao_ia.sql com o
conteúdo EXATO de docs/02-migration-fundacao-ia.sql.

Antes de aplicar, verifique:
1. a extensão "vector" está disponível no plano do projeto Supabase
2. as tabelas cotacao_fornecedores e cotacao_precos já estão versionadas
   (Prompt 1.1) — a view vw_fornecedor_scorecard depende delas
3. ajuste os nomes de coluna da view vw_cotacao_fornecedor_resposta conforme
   o schema real que veio do db pull

Aplique com: npx supabase db push
Depois: npm run types
```

---

### Prompt 3.2 — Popular o catálogo

```
Crie scripts/seed-catalogo.ts que:

1. Lê um CSV em data/insumos.csv com colunas:
   codigo, descricao, unidade, categoria, subcategoria

2. Insere em insumos_canonicos com company_id = NULL (catálogo global)

3. Para cada insumo, chama a Edge Function indexar-catalogo para gerar o
   embedding

4. Loga progresso e permite retomar de onde parou (idempotente por codigo)

Crie também data/insumos.csv com os 200 insumos mais comuns de obra
residencial brasileira, organizados por categoria:
  Cimento e agregados, Aço, Alvenaria, Argamassas e rejuntes,
  Revestimentos, Hidráulica, Elétrica, Madeiras e formas,
  Tintas, Impermeabilização, Esquadrias, Cobertura, Ferragens

Use terminologia comercial brasileira real (a que aparece em nota de
depósito de material), não terminologia acadêmica.
```

---

### Prompt 3.3 — `_shared` e a função de normalização

```
Crie supabase/functions/_shared/ com cors.ts, anthropic.ts, embedding.ts e
supabase.ts, usando exatamente o código de docs/03-CAMADA-DE-IA.md §2.

Em anthropic.ts implemente chamarClaude() com:
  - retry exponencial em 429 e 5xx (3 tentativas)
  - timeout de 30s
  - parse tolerante de JSON (remove cercas markdown)
  - tipagem do retorno

Depois crie supabase/functions/normalizar-insumo/index.ts com o código de
docs/03-CAMADA-DE-IA.md §3, na íntegra.

Deploy:
  npx supabase functions deploy normalizar-insumo
  npx supabase secrets set ANTHROPIC_API_KEY=...
```

**Teste manual antes de seguir.** Mande estas três descrições e confirme que caem no mesmo `insumo_canonico_id` com fator 50:

```
"CIM CP-II-E-32 SC 50KG"
"Cimento Portland CP II 50kg"
"CIMENTO CPII E32 SACO 50 KG"
```

Depois mande estas duas e confirme que **NÃO** casam entre si:

```
"VERGALHAO CA-50 8mm"
"VERGALHAO CA-50 10mm"
```

Se casarem, o prompt do Claude está frouxo — reforce a regra de bitola.

---

### Prompt 3.4 — Estender a `ler-nota`

```
Estenda supabase/functions/ler-nota/index.ts:

Depois de extrair os itens da imagem, para cada item chame normalizar-insumo
(via fetch interno) e enriqueça a resposta com:
  insumo_canonico_id, descricao_canonica, fator_conversao, valor_canonico,
  confianca, precisa_confirmacao

Adicione também alerta_preco: consulte vw_preco_referencia para o insumo e,
se valor_canonico > mediana * 1.15, inclua:
  { mediana_90d, desvio_pct, amostras, severidade }

Formato final conforme docs/03-CAMADA-DE-IA.md §3, seção "Integração".

Mantenha compatibilidade: os campos antigos continuam existindo.
Se a normalização falhar, retorne o item sem os campos novos — nunca deixe a
leitura da nota quebrar por causa da normalização.
```

---

### Prompt 3.5 — Tela de confirmação de insumo

```
Crie src/modules/inteligencia/ui/ConfirmarInsumo.tsx.

Quando normalizar-insumo devolve precisa_confirmacao: true, esta tela mostra:
  - a descrição original do fornecedor, destacada
  - os candidatos com a similaridade em barra
  - opção "Nenhum destes — criar novo insumo"
  - campo de fator de conversão editável, pré-preenchido

Ao confirmar: UPDATE em insumo_aliases marcando confirmado = true,
confirmado_por e confirmado_em.

Esta tela é o que faz o sistema aprender. Priorize: mostre os itens de MAIOR
valor financeiro primeiro (quantidade × valor_unitario), porque errar o
casamento de um item de R$ 40 mil importa mais que o de R$ 40.

Adicione um badge no menu lateral com a contagem de aliases pendentes.
```

---

## FASE 4 — Radar

### Prompt 4.1 — Detectores

```
Crie supabase/functions/radar-compras/index.ts.

Implemente os 10 detectores da tabela em docs/03-CAMADA-DE-IA.md §5.
Use o SQL do detector 1 como modelo exato para os demais.

REGRAS:
- Todos os detectores são SQL PURO. Zero LLM nesta função.
- Toda inserção usa hash_dedupe e ON CONFLICT DO NOTHING.
- Roda por empresa, em loop, isolando erro (uma empresa quebrada não derruba
  as outras).
- Retorna { empresas_processadas, sugestoes_criadas, erros[] }.

Depois agende com pg_cron às 6h, conforme docs/03-CAMADA-DE-IA.md §5.
```

---

### Prompt 4.2 — Inbox de sugestões

```
Crie a rota src/routes/_authenticated/erp/inteligencia/index.tsx —
o "Radar da Obra".

Layout:
  - cards de resumo no topo: total de alertas abertos, economia estimada
    somada, alertas críticos
  - filtros: obra, tipo, severidade
  - lista de sugestoes_ia com status 'nova' ou 'vista', ordenada por
    severidade e depois por economia_estimada desc
  - cada card mostra: título, descrição, severidade colorida, economia
    estimada, e um botão "Ver detalhes" que expande o payload em tabela
  - ações: Aceitar / Rejeitar (com motivo) / Ignorar

⭐ REQUISITO CRÍTICO: cada card deve ter link direto para a entidade de origem
(pedido, orçamento, cotação). Sugestão sem rastreabilidade não gera confiança
e o usuário para de olhar em uma semana.

Ao aceitar uma sugestão do tipo insumo_complementar, abra o fluxo de criar
cotação já com os itens faltantes pré-carregados.

Adicione o item "Inteligência" em MODULOS (src/types/index.ts) e no menu.
```

---

## FASE 5 — Composição e agente

### Prompt 5.1

```
Crie supabase/functions/sugerir-composicao/index.ts conforme
docs/03-CAMADA-DE-IA.md §4.

Crie também a RPC buscar_composicao_semantica, espelhando
buscar_insumo_semantico (docs/02 §10) mas sobre a tabela composicoes.

Crie scripts/seed-composicoes.ts com as 20 composições mais usadas em obra
residencial. Comece por revestimento cerâmico com os coeficientes da tabela
em docs/03-CAMADA-DE-IA.md §4.

LEMBRE: o LLM só escolhe a composição. As quantidades vêm de
explodir_composicao() em SQL. Nunca peça número ao modelo.
```

### Prompt 5.2

```
Crie supabase/functions/indexar-documento/index.ts:
  - recebe documento_id
  - baixa o arquivo do Supabase Storage
  - extrai texto (PDF via unpdf; se sem camada de texto, usa Claude com visão)
  - chunking de ~800 tokens com overlap de 100, preservando o número da página
  - gera embeddings via gte-small
  - insere em documento_chunks
  - marca documentos.indexado_em

Trigger: chamar após upload em documentos.
```

### Prompt 5.3

```
Crie supabase/functions/agente-obra/index.ts conforme docs/03-CAMADA-DE-IA.md §6.

Implemente as 6 tools listadas, cada uma como RPC nomeada e tipada.

SEGURANÇA — os três invariantes, sem exceção:
1. Nenhuma tool escreve no banco. Todas somente leitura.
2. Todas usam o cliente Supabase com o JWT do usuário (RLS ativa).
3. Nenhuma tool aceita SQL cru. Só parâmetros tipados.

Modelo: claude-sonnet-4-6. Máximo 8 iterações de tool use por conversa.
System prompt: exatamente o de docs/03 §6.

Crie a UI em src/routes/_authenticated/erp/inteligencia/assistente.tsx:
chat com streaming, histórico persistido em conversas_ia, e as tool calls
visíveis de forma colapsável — o engenheiro precisa poder auditar de onde
veio cada número.
```

---

## Checklist antes de vender para o primeiro cliente pagante

| | Item |
|---|---|
| ☐ | Todas as tabelas com RLS e ≥ 2 policies |
| ☐ | Teste de vazamento entre empresas: passar |
| ☐ | `supabase db reset` reconstrói o banco do zero a partir das migrations |
| ☐ | Backup testado — restore feito de verdade, não só configurado |
| ☐ | Sentry configurado |
| ☐ | Termo de uso e política de privacidade (LGPD) |
| ☐ | Contrato de SaaS com SLA definido |
| ☐ | Exportação de dados do cliente (LGPD, portabilidade) |
| ☐ | Soft delete nas entidades principais |
| ☐ | `eventos` populando em pedidos, orçamentos, medições |
| ☐ | Onboarding: importador de planilha de orçamento |
| ☐ | Precisão da normalização medida: ≥ 85% de aceite sem correção |

O último item é o mais importante e o mais ignorado. **Meça antes de prometer.** Rode 200 descrições reais de notas da ZBuild pela `normalizar-insumo`, confira manualmente, calcule a taxa. Se der 60%, você ajusta o prompt e o catálogo antes de o cliente descobrir — não depois.
