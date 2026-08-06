# 05 — Fluxo de Suprimentos: Requisição → Cotação → Ordem de Compra → Financeiro

> Especificação funcional e técnica. Baseada no fluxo real descrito e no padrão de tela do Obra Prima.

---

## 1. O princípio que organiza tudo

**O estado vive no ITEM, não no documento.**

Uma requisição com 10 itens pode ter, ao mesmo tempo:
- 4 itens em cotação
- 3 itens já em ordem de compra
- 2 itens ainda abertos
- 1 item cancelado

Se o status ficasse na requisição, isso seria impossível de representar. Por isso `requisicao_itens.status` é a fonte da verdade, e `requisicoes.status` é **derivado** dos itens (calculado por trigger, nunca digitado).

Consequência prática: cada tela filtra por status **do item**, não do documento.

---

## 2. Numeração — dois níveis

Você pediu "um número que segue até o final". O Obra Prima resolve com dois níveis, e é o desenho certo:

### Nível 1 — Número do documento (sequencial por empresa, como você já conhece)

```
Requisição       000616
Cotação          000843
Ordem de compra  003953
Lançamento       FIN-004120
```

Familiar, curto, é o que a pessoa fala no telefone: *"me manda a OC 3953"*.

### Nível 2 — Processo (o fio que atravessa tudo)

```
processo_id (uuid) + numero_processo "2026-0001"
```

Toda requisição nasce criando um processo. Cotações, OCs e lançamentos derivados herdam o mesmo `processo_id`. É isso que permite a coluna "Registros vinculados" do Obra Prima e responder *"de onde veio essa conta a pagar?"* em um clique.

**OC avulsa** (combustível, imposto, reembolso) nasce **sem** requisição e **sem** cotação — mas cria seu próprio processo. Por isso na sua tela do Obra Prima as colunas Cotação e Solicitação aparecem vazias nessas linhas. Está correto.

### Como fica a cadeia completa

```
Processo 2026-0001
├── REQ 000616         10 itens
│   ├── COT 000843     4 itens selecionados
│   │   ├── OC 003953  2 itens → Fornecedor A
│   │   │   ├── REC 1  (60 de 100 sacos)  → FIN-004120  nota 12345
│   │   │   └── REC 2  (40 restantes)     → FIN-004180  nota 12890
│   │   └── OC 003954  2 itens → Fornecedor B
│   │       └── REC 1  (total)            → FIN-004121
│   ├── OC 003960      3 itens direto (boleto, sem cotação)
│   └── 2 itens ainda ABERTOS
│       1 item CANCELADO
```

Cada recebimento vira um lançamento com sua própria nota. É por isso que a coluna "Lançados (R$)" do Obra Prima é diferente de "Total (R$)".

---

## 3. Máquinas de estado

### 3.1 `requisicao_itens.status` — a fonte da verdade

| Status | Significa | Aparece na tela |
|---|---|---|
| `RASCUNHO` | Digitando, não enviou | Requisição (filtro) |
| `ABERTA` | Aguardando encaminhamento | **Requisição (padrão)** |
| `EM_COTACAO` | Selecionado para uma cotação | **Cotação (padrão)** |
| `COTADA` | Fornecedores responderam, aguarda decisão | **Cotação (padrão)** |
| `EM_OC` | Virou ordem de compra | **Ordem de compra (padrão)** |
| `RECEBIDO_PARCIAL` | Chegou parte | **Ordem de compra (padrão)** |
| `RECEBIDA` | Chegou tudo | Financeiro |
| `REJEITADA` | Reprovado na aprovação | Histórico |
| `CANCELADA` | Cancelado com motivo | Histórico |

Transições permitidas (validadas em Postgres, não no front):

```
RASCUNHO  → ABERTA | CANCELADA
ABERTA    → EM_COTACAO | EM_OC | REJEITADA | CANCELADA
EM_COTACAO→ COTADA | ABERTA (devolve) | CANCELADA
COTADA    → EM_OC | ABERTA (devolve) | CANCELADA
EM_OC     → RECEBIDO_PARCIAL | RECEBIDA | ABERTA (OC cancelada devolve) | CANCELADA
RECEBIDO_PARCIAL → RECEBIDA | CANCELADA
RECEBIDA  → (terminal)
```

O "devolve para ABERTA" é essencial: se você cancelar uma cotação, os 4 itens voltam para a tela de Requisição em vez de sumirem. Sem isso o usuário perde material e refaz do zero.

### 3.2 `requisicoes.status` — derivado (trigger)

Espelha as opções do seu filtro no Obra Prima:

```
todos itens RASCUNHO                       → RASCUNHO
todos itens ABERTA                         → ABERTA
algum encaminhado, algum ABERTA            → PARCIAL
todos em COTADA/EM_COTACAO                 → COTADA
todos em EM_OC ou além                     → OC_GERADA
todos RECEBIDA                             → ATENDIDA
todos CANCELADA/REJEITADA                  → CANCELADA
```

### 3.3 `cotacoes.status`

```
NOVA → ENVIADA → RESPONDIDA_PARCIAL → RESPONDIDA → OC_PARCIAL → OC_GERADA
                                                              ↘ CANCELADA
```

`PENDENTE_REENVIO` quando um fornecedor pede prazo ou a cotação foi alterada após envio.

### 3.4 `ordens_compra.status`

Copiado do seu filtro do Obra Prima, que está correto:

```
EM_APROVACAO → GERADA → ENVIADA → PROCESSADA → PARCIALMENTE_RECEBIDA → RECEBIDA
     ↓            ↓        ↓                            ↓
NAO_APROVADA  CANCELADA  PENDENTE_REENVIO         (fica aqui até fechar saldo)
                         RECUSADA
```

**⭐ Atalho obrigatório:** `GERADA → RECEBIDA` direto, num clique. É o caso "já comprei, tenho a nota, só quero registrar". Sem esse atalho o sistema vira burocracia e o pessoal contorna com planilha.

---

## 4. Regras de tela (padrão Obra Prima)

### Regra geral

> **A tela principal mostra pendências. O que foi resolvido some.**
> Filtro de situação por **checkbox de múltipla seleção**, com os status pendentes já marcados.

### 4.1 Tela Requisição (renomear de "Itens")

**Filtro padrão marcado:** `Aberta`, `Parcial`
**Disponíveis:** Rascunho, Aberta, Parcial, Cotada, Rejeitada, Ordem de compra gerada, Contrato gerado, Cancelada

**Agrupamento:** Empresa → Obra (colapsável), como no seu print.

**Colunas:** checkbox · Núm. · Descrição · Itens · Solicitação · Necessidade · Solicitante · Situação · Ações

**Ação em lote** (botão "Comprar insumos", igual ao Obra Prima):
- Gerar cotação unificada
- Gerar ordem de compra unificada
- Gerar contrato unificado

Seleção é **por item**, não por requisição. Selecionar 4 itens de 3 requisições diferentes e gerar uma cotação única tem que funcionar.

**Atalhos por requisição:**
- `Já comprei` → abre modal (fornecedor, valor, forma de pagamento, anexo da nota) → cria OC status `RECEBIDA` + recebimento + lançamento `PAGA`, tudo numa transação
- `Comprar por boleto` → cria OC status `GERADA`, pula cotação

### 4.2 Tela Cotação

**Filtro padrão:** `Nova`, `Enviada aos fornecedores`, `Respondida parcialmente`, `Respondida pelos fornecedores`
**Disponíveis:** + Pendente de reenvio, Ordem de compra parcial, Ordem de compra gerada, Contrato parcial, Contrato gerado, Cancelada

**Dentro da cotação:**
- Remover item da cotação → item volta para `ABERTA` na Requisição
- **⭐ Puxar mais insumos** → modal listando itens `ABERTA` da mesma obra, com busca, para acrescentar sem sair da tela
- Adicionar/remover fornecedor
- Registrar preço, marca, prazo de entrega, condição de pagamento por fornecedor

### 4.3 Mapa de cotação — o diferencial

Três sugestões calculadas, **e você decide**:

| Sugestão | O que faz | Quando usar |
|---|---|---|
| **Menor unitário** | Melhor preço item a item (pode dar 4 fornecedores) | Materiais soltos, sem frete relevante |
| **Menor global** | Um fornecedor só, menor total | Entrega única, frete alto, obra longe |
| **Menor a valor presente** ⭐ | Considera prazo de pagamento e taxa de oportunidade | Sempre que houver prazo diferente entre fornecedores |

A terceira é `rankearFornecedores()` que já está em `src/modules/compras/domain/rules.ts`. Nenhum ERP de pequeno porte faz essa conta — e é a conta que o comprador faz de cabeça, errado.

**Destaque visual:** quando o vencedor por valor presente for diferente do vencedor por preço bruto, a tela avisa. Esse é o momento em que o sistema mostra que sabe algo que a planilha não sabe.

O usuário marca `escolhido` célula a célula, e o botão gera **uma OC por fornecedor escolhido**.

### 4.4 Tela Ordem de Compra

**Filtro padrão:** `Em aprovação`, `Gerada`, `Enviada ao fornecedor`, `Pendente de reenvio`, `Processada pelo fornecedor`, `Parcialmente recebida`
**Disponíveis:** + Recebida, Recusada, Cancelada, Não aprovado

**Colunas** (espelhando seu print): Núm · **Cotação** · **Solicitação** · Obra · Fornecedor · Criação · Previsão de entrega · Situação · Total (R$) · **Recebidos (%)** com barra · **Lançados (R$)** · Descrição

Cotação e Solicitação vazias = OC avulsa. Correto e esperado.

**Abas da OC:** Dados · Endereços · Pagamento · Envio · **Recebimento** · Anexos · **Avaliação**

A aba Avaliação alimenta o scorecard de fornecedor (`vw_fornecedor_scorecard` do arquivo 02).

### 4.5 Recebimento — onde a IA entra

Modal de recebimento:

```
Item                    Pedido   Já recebido   Recebendo agora   Saldo
Cimento CP-II 50kg      100 sc      0 sc          [ 60 ]         40 sc
Areia média m³           10 m³      0 m³          [ 10 ]          0 m³

Documento:  [ Anexar foto da nota ]   (opcional)
Data:       [ 06/08/2026 ]
Recebido por: LUCIO FLAVIO
Observação: [ ]

[ Confirmar recebimento ]
```

Ao confirmar:
1. Grava `recebimentos` + `recebimento_itens`
2. Atualiza `quantidade_recebida` em `ordem_compra_itens`
3. Recalcula status: sobrou saldo → `PARCIALMENTE_RECEBIDA`; zerou → `RECEBIDA`
4. **Gera um lançamento financeiro só desse recebimento**, com a nota anexada
5. Devolve o item para a tela de OC se tiver saldo, ou manda para o Financeiro se fechou

**⭐ O gancho de IA:** se houver foto da nota, chama a `ler-nota` (que você já tem) e **compara com a OC**:

```
⚠ Divergência detectada na NF 12345

Item              OC              Nota            Diferença
Cimento 50kg      100 × R$ 32,50  100 × R$ 35,00   +R$ 250,00  (+7,7%)

[ Aceitar a nota ]  [ Manter a OC ]  [ Contestar com o fornecedor ]
```

Divergência de faturamento pega antes do lançamento entrar no contas a pagar. Isso paga a assinatura sozinho — é o erro mais caro e mais silencioso de suprimentos.

### 4.6 Financeiro

Lançamento chega com: fornecedor, obra, valor, vencimento, **nota anexada**, `processo_id`, `ordem_compra_id`, `recebimento_id`.

Clicar no lançamento navega para a OC → cotação → requisição. Rastreabilidade completa em 3 cliques.

---

## 5. Modelo de dados

```
processos_compra          numero_processo, company_id
│
├── requisicoes           numero, obra_id, solicitante, data_necessidade, status(derivado)
│   └── requisicao_itens  insumo_canonico_id, descricao, qtd, unidade,
│                         orcamento_item_id, status ⭐, qtd_atendida
│
├── cotacoes              numero, status
│   ├── cotacao_itens     → requisicao_item_id
│   ├── cotacao_fornecedores  fornecedor_id, frete, desconto, prazo_pgto, prazo_entrega
│   └── cotacao_precos    (cotacao_fornecedor_id, cotacao_item_id) valor_unitario, marca, escolhido
│
├── ordens_compra         numero, cotacao_id?, requisicao_id?, fornecedor_id, status
│   └── ordem_compra_itens → requisicao_item_id, qtd, qtd_recebida ⭐, valor_unitario
│
├── recebimentos          ordem_compra_id, data, documento_path, recebido_por
│   └── recebimento_itens → ordem_compra_item_id, quantidade, conforme
│
└── lancamentos           recebimento_id ⭐, ordem_compra_id, processo_id, anexo_path
```

Tudo com `company_id` denormalizado, RLS `company_id = any(my_company_ids())`.

---

## 6. O que fazer com `pedidos` e `pedido_itens`

Hoje `pedidos` faz papel duplo (requisição e ordem de compra) e é o que alimenta a tela "Itens".

**Recomendação: reestruturar agora.** Você tem 1 obra, 1 orçamento, 1 cliente e 1 pedido de teste no banco. É o momento mais barato que vai existir para fazer isso — daqui a seis meses, com dados reais de três construtoras, essa mesma mudança custa dez vezes mais.

O plano:
1. Criar `requisicoes` / `requisicao_itens` novas
2. Migrar o pedido de teste (ou simplesmente recriar à mão — é 1 registro)
3. Manter `pedidos` só até as telas migrarem, depois dropar

---

## 7. Ordem de implementação

| Etapa | O quê | Entrega visível |
|---|---|---|
| 1 | Migration: processos, requisições, recebimentos, status | — |
| 2 | Renomear "Itens" → "Requisição", filtro de status por checkbox | Tela nova |
| 3 | Seleção em lote → gerar cotação / OC | Fluxo básico funcionando |
| 4 | Mapa de cotação: menor unitário / global / valor presente | ⭐ Diferencial |
| 5 | OC: abas, envio, atalho "marcar recebida" | Fluxo completo |
| 6 | Recebimento parcial + anexo + lançamento por recebimento | Fluxo fecha |
| 7 | Integrar `ler-nota` no recebimento → divergência | ⭐ Diferencial |
| 8 | Coluna Registros vinculados + navegação pelo processo | Rastreabilidade |

Etapas 1 a 3 já valem como produto usável. Etapas 4 e 7 são o que diferencia comercialmente.
