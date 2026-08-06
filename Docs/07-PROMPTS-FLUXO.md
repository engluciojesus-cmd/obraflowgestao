# 07 — Prompts do Claude Code: Fluxo de Suprimentos

> Um prompt por vez. Rode, teste no navegador, commite. Sempre comece com `@docs`.

---

## Prompt A — Migration

```
CONTEXTO: docs/05-FLUXO-SUPRIMENTOS.md

TAREFA: aplicar a migration do fluxo de suprimentos.

1. Crie supabase/migrations/20260811000000_fluxo_suprimentos.sql com o conteúdo
   EXATO de docs/06-migration-fluxo-suprimentos.sql

2. ANTES de aplicar, valide os nomes de coluna reais rodando no Supabase:

   select table_name, string_agg(column_name, ', ' order by ordinal_position)
   from information_schema.columns
   where table_schema='public'
     and table_name in ('cotacoes','cotacao_itens','cotacao_fornecedores',
                        'cotacao_precos','ordens_compra','ordem_compra_itens')
   group by table_name;

   Ajuste os ALTER TABLE do §5 e §6 se algum nome divergir. Em particular:
   - ordem_compra_itens: a FK para a ordem se chama `ordem_id` ou `ordem_compra_id`?
   - cotacoes: existe `obra_id` e `descricao`?
   - cotacao_precos: existe `escolhido`?
   Me mostre o que divergiu antes de mudar.

3. npx supabase db push

4. Inicialize as sequências:
   insert into public.sequencias (company_id, entidade, valor)
   select c.id, e.ent, 0
   from public.companies c,
        unnest(array['processo','requisicao','cotacao','ordem_compra','lancamento']) e(ent)
   on conflict do nothing;

5. npm run types

6. Commit: "feat(db): fluxo de suprimentos — requisição, recebimento parcial, processo"
```

---

## Prompt B — Módulo de domínio

```
CONTEXTO: docs/05-FLUXO-SUPRIMENTOS.md §3 e docs/01-ARQUITETURA-ALVO.md §1

Crie src/modules/suprimentos/ seguindo a arquitetura em camadas.

domain/types.ts — enums e tipos:
  RequisicaoItemStatus, RequisicaoStatus, CotacaoStatus, OrdemCompraStatus
  Requisicao, RequisicaoItem, Recebimento, RecebimentoItem, ProcessoCadeia
  Constantes de UI: label em pt-BR, cor (Tailwind) e se é status "pendente"
  Exemplo:
    export const REQ_ITEM_STATUS = {
      ABERTA:  { label: 'Aberta',  cor: 'blue',  pendente: true },
      EM_COTACAO: { label: 'Em cotação', cor: 'amber', pendente: true },
      RECEBIDA: { label: 'Recebida', cor: 'green', pendente: false },
      ...
    } as const

domain/rules.ts — ⛔ proibido react, @supabase/*, @tanstack/*
  podeTransicionar(de, para): boolean       // espelha a máquina de estado do banco
  statusRequisicaoDerivado(itens): RequisicaoStatus
  saldoItem(pedido, recebido): number
  percentualRecebido(itens): number
  statusPendentesPorTela(tela): Status[]    // filtro padrão de cada tela

  ⭐ Comparadores do mapa de cotação:
  sugestaoMenorUnitario(itens, propostas): Map<itemId, fornecedorId>
  sugestaoMenorGlobal(itens, propostas, condicoes): fornecedorId
  // sugestaoMenorValorPresente já existe: rankearFornecedores() em
  // src/modules/compras/domain/rules.ts — reutilize, não reimplemente

domain/rules.test.ts — cobrir:
  - transição inválida rejeitada (RECEBIDA → qualquer coisa)
  - devolução EM_COTACAO → ABERTA permitida
  - status derivado: 3 itens (1 aberta, 1 em OC, 1 recebida) = PARCIAL
  - recebimento parcial: 60 de 100 → 60%, saldo 40
  - menor unitário e menor global divergindo (caso com frete alto)

data/requisicoes.repository.ts — único arquivo que importa supabase.
  Métodos: listar (com filtro de status[]), buscar, criar, adicionarItem,
  cancelarItem (rpc), gerarCotacao (rpc gerar_cotacao_de_itens),
  comprarDireto (rpc comprar_direto)

ui/hooks/ — TanStack Query, query keys prefixadas por companyId conforme
  docs/01-ARQUITETURA-ALVO.md §4

Rode npm run test e npm run build. Commit.
```

---

## Prompt C — Tela Requisição (padrão Obra Prima)

```
CONTEXTO: docs/05-FLUXO-SUPRIMENTOS.md §4.1

Renomeie a tela "Itens" para "Requisição" e reconstrua no padrão do Obra Prima.

Rota: src/routes/_authenticated/erp/compras/requisicoes/index.tsx
  (mantenha /erp/compras/itens redirecionando para cá por enquanto)

Atualize MODULOS e COMPRAS_SUBMODULOS em src/types/index.ts:
  id 'itens' → 'requisicoes', label 'Itens' → 'Requisição'

LAYOUT — painel de filtro fixo à esquerda, lista à direita:

Filtro (checkbox de MÚLTIPLA seleção, não dropdown):
  Situação:  ☑ Aberta   ☑ Parcial   ☐ Rascunho   ☐ Cotada
             ☐ Rejeitada  ☐ Ordem de compra gerada  ☐ Contrato gerado  ☐ Cancelada
  Número | Obra | Solicitante | Data solicitação (de/até) | Data necessidade (de/até)
  [ Pesquisar ]

  ⭐ REGRA: Aberta e Parcial vêm marcadas por padrão. Resolvidos somem da tela.

Lista agrupada por Obra (grupos colapsáveis, contador por grupo):
  ☐ | Núm. | Descrição | Itens | Solicitação | Necessidade | Solicitante | Situação | Ações

  Situação com badge colorido conforme REQ_ITEM_STATUS.
  Linha expande mostrando os itens, cada um com seu próprio badge de status.

⭐ SELEÇÃO É POR ITEM, não por requisição.
  Selecionar 4 itens de 3 requisições diferentes e gerar UMA cotação
  precisa funcionar. Guarde os ids selecionados em estado, não a requisição.

Barra inferior fixa quando há seleção:
  "6 itens selecionados"   [ Comprar insumos ▾ ]
     ├ Gerar cotação unificada
     ├ Gerar ordem de compra unificada
     └ Gerar contrato unificado

Ações por requisição:
  [ Já comprei ]  → modal: fornecedor, valor por item, forma de pagamento,
                    anexo da nota, checkbox "já pago"
                    → rpc comprar_direto
  [ Editar ]  [ Cancelar item ] (pede motivo, obrigatório)

Use os hooks do Prompt B. Zero supabase.from() na rota.
Máximo 150 linhas no arquivo da rota — extraia componentes.
```

---

## Prompt D — Mapa de cotação (o diferencial)

```
CONTEXTO: docs/05-FLUXO-SUPRIMENTOS.md §4.2 e §4.3

Reconstrua src/routes/_authenticated/erp/compras/cotacoes/$cotacaoId.tsx

CABEÇALHO: número, obra, requisição de origem (link), status, data limite

⭐ BARRA DE SUGESTÕES — três botões que pré-marcam as escolhas:

  [ Menor unitário ]  [ Menor global ]  [ Menor a valor presente ]

  Menor unitário   → sugestaoMenorUnitario()      (pode dar N fornecedores)
  Menor global     → sugestaoMenorGlobal()        (um fornecedor só)
  Valor presente   → rankearFornecedores() de @/modules/compras
                     usa prazo de pagamento + taxa de oportunidade da empresa

  Cada botão mostra o total resultante. O usuário clica e as células ficam
  pré-marcadas — ele ainda pode alterar célula a célula antes de gerar.

  ⭐ DESTAQUE: quando o vencedor por valor presente for DIFERENTE do vencedor
  por preço bruto, mostre um aviso:
    "Fornecedor B é R$ 240 mais caro, mas paga em 60 dias.
     A valor presente sai R$ 95 mais barato."
  Esse é o insight que justifica a funcionalidade.

TABELA (itens nas linhas, fornecedores nas colunas):
  - célula: valor unitário editável + marca + checkbox "escolhido"
  - menor preço da linha destacado
  - rodapé por fornecedor: subtotal, frete, desconto, prazo pgto, TOTAL, TOTAL VP
  - linha de cobertura: "atendeu 8 de 10 itens"
  - autosave com optimistic update (onMutate/onError/onSettled)

AÇÕES DE ITEM:
  [ Remover da cotação ]  → rpc remover_item_cotacao (devolve para ABERTA)
  ⭐ [ + Puxar insumos ]  → modal listando itens ABERTA da mesma obra,
                            com busca, checkbox múltiplo
                            → rpc adicionar_itens_cotacao

AÇÕES DE FORNECEDOR: adicionar, remover, registrar condições comerciais
  (frete, desconto global, prazo de pagamento em dias, prazo de entrega)

BOTÃO FINAL:
  [ Gerar ordens de compra ]  → rpc gerar_ordens_da_cotacao
  Antes de chamar, mostre o preview: "Serão geradas 3 ordens:
    Fornecedor A — 4 itens — R$ 12.400
    Fornecedor B — 2 itens — R$ 3.100
    Fornecedor C — 1 item  — R$ 890"

Rota com no máximo 150 linhas. Componentes em ui/components/.
```

---

## Prompt E — Ordem de Compra

```
CONTEXTO: docs/05-FLUXO-SUPRIMENTOS.md §4.4

LISTA — src/routes/_authenticated/erp/compras/ordens/index.tsx

Filtro (checkbox múltiplo), marcados por padrão:
  ☑ Em aprovação  ☑ Gerada  ☑ Enviada ao fornecedor  ☑ Pendente de reenvio
  ☑ Processada pelo fornecedor  ☑ Parcialmente recebida
  ☐ Recebida  ☐ Recusada  ☐ Cancelada  ☐ Não aprovado
  + Número, Obra, Fornecedor, Data (criação/entrega), Valor (de/até), Descrição

Colunas:
  Núm | Cotação | Solicitação | Obra | Fornecedor | Criação | Previsão de entrega
  | Situação | Total (R$) | Recebidos (%) | Lançados (R$) | Descrição

  ⭐ "Recebidos (%)" é barra de progresso, dados de vw_oc_recebimento
  ⭐ Cotação e Solicitação vazias = OC avulsa (combustível, imposto, reembolso).
     Isso é esperado, não é erro. Clicáveis quando preenchidas.
  ⭐ "Lançados (R$)" = soma dos lançamentos gerados pelos recebimentos.
     É diferente de Total quando houve recebimento parcial.

DETALHE — abas: Dados · Endereços · Pagamento · Envio · Recebimento · Anexos · Avaliação

  Dados: fornecedor, vendedor, descrição, itens (insumo, qtd, unitário, total,
         desconto, obra), subtotal/desconto/frete/total no rodapé
  Envio: e-mail do fornecedor, mensagem, botão Enviar → status ENVIADA
  Recebimento: lista os recebimentos já feitos + botão Novo recebimento
  Anexos: upload para o bucket documentos-compra
  Avaliação: nota 1-5 de prazo e qualidade + observação → alimenta o scorecard

⭐ AÇÕES RÁPIDAS no topo (o atalho que evita a burocracia):
  [ Marcar como recebida ]  → pula ENVIADA/PROCESSADA, abre direto o modal de
                              recebimento com todas as quantidades preenchidas
  [ Enviar ao fornecedor ]  [ Cancelar ] (pede motivo)

Máximo 150 linhas por rota.
```

---

## Prompt F — Recebimento parcial + lançamento

```
CONTEXTO: docs/05-FLUXO-SUPRIMENTOS.md §4.5

Crie o modal de recebimento em src/modules/suprimentos/ui/components/ModalRecebimento.tsx

TABELA:
  Item | Pedido | Já recebido | Recebendo agora (input) | Saldo (calculado)

  - "Recebendo agora" pré-preenchido com o saldo (caso mais comum: chega tudo)
  - Saldo recalcula ao digitar
  - Botão "Receber tudo" preenche todas as linhas com o saldo
  - Validação: não permitir mais que 105% do pedido (o banco também valida)

CAMPOS:
  Nº do documento | Série | Valor da nota | Data | Recebido por
  Anexar nota (opcional) → upload para documentos-compra/{company_id}/{oc_id}/
  Observação
  ☑ Gerar lançamento financeiro     (marcado por padrão)
  Vencimento (aparece se o checkbox acima estiver marcado)

AO CONFIRMAR → rpc confirmar_recebimento

⭐ COMPORTAMENTO ESPERADO — teste isto:
  OC com 100 sacos de cimento.
  1º recebimento de 60  → OC vira PARCIALMENTE_RECEBIDA, barra 60%,
                          lançamento FIN-000001 com a nota 1
  2º recebimento de 40  → OC vira RECEBIDA, barra 100%,
                          lançamento FIN-000002 com a nota 2
  São DOIS lançamentos. Não é um lançamento atualizado.

Adicione na tela Financeiro: coluna com link para a OC de origem e ícone de
anexo quando houver nota.
```

---

## Prompt G — Integrar `ler-nota` no recebimento ⭐

```
CONTEXTO: docs/05-FLUXO-SUPRIMENTOS.md §4.5 e docs/03-CAMADA-DE-IA.md §3

Quando o usuário anexar a foto da nota no modal de recebimento, chame a Edge
Function ler-nota (que já existe) e COMPARE o resultado com a ordem de compra.

FLUXO:
1. Upload da imagem → base64 → invoke('ler-nota')
2. Para cada item lido, casar com um item da OC:
   a) por insumo_canonico_id (se a normalização já resolveu)
   b) senão por similaridade de descrição (>0.75)
   c) senão marcar como "item não identificado" e deixar o usuário escolher
3. Preencher automaticamente "Recebendo agora" com a quantidade da nota
4. Comparar valor_unitario da nota com o da OC

SE HOUVER DIVERGÊNCIA > 2%, mostre ANTES de confirmar:

  ⚠ Divergência detectada na NF 12345

  Item            OC                Nota              Diferença
  Cimento 50kg    100 × R$ 32,50    100 × R$ 35,00    +R$ 250,00 (+7,7%)
  Areia m³         10 × R$ 95,00      8 × R$ 95,00    −2 m³ (falta)

  [ Aceitar a nota ]  [ Manter a OC ]  [ Contestar com o fornecedor ]

  - "Aceitar a nota"  → lançamento com o valor da nota, grava divergencia_aceita
  - "Manter a OC"     → lançamento com o valor da OC, grava a divergência
  - "Contestar"       → cria sugestao_ia tipo 'preco_anomalo' e não gera lançamento

Grave o resultado do OCR em recebimentos.ocr_payload e a comparação em
recebimentos.divergencia (jsonb), sempre — mesmo quando não houver divergência.
Isso é o histórico que prova o que foi conferido.

Se a ler-nota falhar ou a imagem estiver ilegível, o recebimento continua
funcionando manualmente. A IA nunca pode bloquear o fluxo operacional.
```

---

## Prompt H — Rastreabilidade

```
CONTEXTO: docs/05-FLUXO-SUPRIMENTOS.md §2

Crie o componente RegistrosVinculados usando a view vw_processo_cadeia.

Aparece como ícone/coluna em todas as telas do fluxo. Ao clicar, abre um popover
com a cadeia completa do processo:

  Processo 2026-0001
  ├─ REQ 000616   Aberta          → link
  ├─ COT 000843   OC gerada       → link
  ├─ OC 003953    Parcialmente recebida  R$ 12.400  → link
  │  ├─ Recebimento 1  06/08  NF 12345  → FIN-000120  R$ 7.440
  │  └─ Recebimento 2  12/08  NF 12890  → FIN-000180  R$ 4.960
  └─ OC 003954    Recebida        R$ 3.100  → link

Cada linha navega para o registro. Adicione também um campo de busca global
por número de processo no header do módulo Compras.

⭐ Esta é a tela que você mostra numa demonstração para responder
"de onde veio essa conta a pagar?" em um clique.
```

---

## Checklist de aceite do fluxo

| | Teste |
|---|---|
| ☐ | Criar requisição com 10 itens |
| ☐ | Selecionar 4 → gerar cotação → os 4 somem da tela Requisição, os 6 ficam |
| ☐ | Na cotação, remover 1 item → ele volta para a tela Requisição |
| ☐ | Na cotação, puxar mais 2 itens da requisição → somem da Requisição |
| ☐ | Preencher preços de 3 fornecedores |
| ☐ | Clicar "Menor unitário" → marca células de fornecedores diferentes |
| ☐ | Clicar "Menor global" → marca um fornecedor só |
| ☐ | Clicar "Menor a valor presente" → mostra o aviso quando diverge do bruto |
| ☐ | Gerar ordens → 3 OCs criadas, itens somem da Cotação |
| ☐ | OC: receber 60 de 100 → status PARCIALMENTE_RECEBIDA, barra 60%, 1 lançamento |
| ☐ | OC: receber os 40 restantes → status RECEBIDA, barra 100%, **2º lançamento** |
| ☐ | Financeiro mostra os 2 lançamentos, cada um com sua nota |
| ☐ | Filtrar "Recebida" na tela de OC → a OC reaparece |
| ☐ | Cancelar item com motivo → some da tela, aparece no filtro Cancelada |
| ☐ | Criar OC avulsa (combustível) sem requisição nem cotação |
| ☐ | Atalho "Já comprei" → OC + recebimento + lançamento pago numa tacada |
| ☐ | Registros vinculados mostra a cadeia completa |
| ☐ | Anexar nota divergente → alerta antes de gerar o lançamento |
