# ObraFlow Gestão — Pacote Técnico de Evolução para SaaS

Auditoria do commit `39da4db` e especificação da camada de IA.

## Arquivos

| Arquivo | O que é | Quando usar |
|---|---|---|
| `00-DIAGNOSTICO-TECNICO.md` | Auditoria real do código e do schema. 3 bloqueadores P0. | Leia primeiro, inteiro |
| `01-ARQUITETURA-ALVO.md` | Estrutura por domínio, camadas, tenant, transações | Referência durante toda a refatoração |
| `02-migration-fundacao-ia.sql` | SQL pronto: catálogo canônico, histórico de preço, composições, eventos, RAG | Fase 3, depois do `db pull` |
| `03-CAMADA-DE-IA.md` | Edge Functions com código, custos, comparativo de concorrentes | Fase 3 em diante |
| `04-PROMPTS-CONTINUE.md` | Roteiro de prompts para o Continue, na ordem, com critério de aceite | Uso diário |

## Instalação

```bash
mkdir -p docs
cp 0*.md 02-migration-fundacao-ia.sql docs/
git add docs/ && git commit -m "docs: arquitetura e roadmap de IA"
```

No Continue, sempre inicie com `@docs`.

## Os três bloqueadores (resolver antes de qualquer coisa)

1. **Schema drift** — 8 tabelas existem só no banco de produção, sem migration. O repo não sobe do zero e você não sabe se a RLS delas está correta.
2. **`useActiveCompany` retorna `companies[0]`** — multiempresa não funciona; `admin_global` opera dentro de um cliente aleatório.
3. **Policy `users_update_own` com recursão de RLS** — qualquer UPDATE de perfil falha.

## As três decisões que definem o produto

1. **LLM classifica, SQL calcula.** Nenhum número que vira dinheiro sai de um modelo.
2. **IA sugere, humano aceita.** Quem assina a ART é pessoa física com CREA.
3. **Isolamento de tenant no banco, não no prompt.** RPCs `SECURITY INVOKER` + JWT do usuário.

## O fosso competitivo

Não é a IA — qualquer um chama a API. É a tabela `insumo_aliases` acumulada e os coeficientes de composição calibrados por empresa. Depois de 12 meses, trocar de ERP significa jogar esse aprendizado fora.
