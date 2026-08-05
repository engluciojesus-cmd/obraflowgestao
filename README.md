# ObraFlow Gestão — Multi-Tenant

ERP de construção civil com autenticação multi-tenant (React + Vite + TanStack Router + Tailwind + Supabase).

## ⚡ Setup (na ordem)

### 1. Instalar dependências
```bash
npm install
```

### 2. Executar migração no Supabase
Abra o **SQL Editor** do Supabase Dashboard e execute:
```
supabase/migrations/20260803000000_obraflow_multitenant.sql
```

### 3. Configurar variáveis de ambiente
```bash
cp .env.example .env
```
Preencha com as credenciais do seu projeto (Settings → API no Supabase):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY` (apenas para o script de admin — nunca vai pro frontend)

### 4. Deploy da Edge Function (obrigatório para criar usuários pelo painel)
```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase functions deploy create-user
```

### 5. Criar o primeiro admin global
```bash
node scripts/create-admin.js
```

### 6. Rodar
```bash
npm run dev
```
Acesse `http://localhost:5173/auth` e logue com o admin criado.

## 🔄 Fluxo

```
Admin loga → /admin → cria empresa → cria usuário eng01 (com senha inicial)
eng01 loga → /company/users?company_id=XXX → cria mais usuários
```

## 🔧 Correções aplicadas sobre os arquivos originais

Os arquivos recebidos tinham 4 problemas que impediriam o funcionamento:

1. **`auth.tsx` — `isFormValid` autorreferente.** A constante referenciava a si mesma (`... && isFormValid`), gerando `ReferenceError` em runtime. Removida (o botão já valida os campos).

2. **`supabase.auth.admin.createUser` no frontend.** Nos painéis `/admin` e `/company/users`, essa chamada **sempre falharia** — `auth.admin.*` exige a service key, que não pode ir para o navegador. Substituída pela Edge Function **`create-user`** (`supabase/functions/create-user/index.ts`), que roda no servidor, verifica a permissão de quem chamou e faz rollback em caso de falha.

3. **Senha aleatória invisível.** O código original criava usuários com `Math.random()` como senha — ninguém nunca via a senha e o usuário jamais conseguiria logar. Agora o formulário tem campo **"Senha Inicial"** que você informa ao usuário.

4. **RLS com recursão infinita.** As policies originais consultavam `users` dentro de policies de `users` (e `company_members` dentro de `company_members`) — o Postgres retorna erro `infinite recursion detected`. Corrigido com funções `SECURITY DEFINER` (`is_admin_global()`, `my_company_ids()`). Também foram adicionadas as policies de **INSERT** que faltavam (sem elas, criar empresa e fazer signup falhariam silenciosamente).

Outros ajustes menores: `login-bg.jpg` (inexistente) trocado por fundo em gradiente; `.single()` trocado por `.maybeSingle()` na verificação de usuário existente (evita erro 406); guard de permissão em `/company/users` aguarda o carregamento do role antes de redirecionar (evitava que admin/manager legítimos fossem expulsos da página); `validateSearch` tipado para `company_id`.

## 📁 Estrutura

```
src/
├── routes/
│   ├── auth.tsx                        Login/Signup
│   ├── _authenticated.tsx              Guard de sessão
│   └── _authenticated/
│       ├── index.tsx                   Dashboard (empresas do usuário)
│       ├── admin.tsx                   Painel Admin Global
│       └── company/users.tsx           Gestão de usuários da empresa
├── hooks/useAuth.ts                    useAuthUser, useUserCompanies, useCompanyRole, useCanManageUsers
├── types/index.ts                      Roles, permissions, entidades
└── integrations/supabase/client.ts     Cliente Supabase

supabase/
├── migrations/...sql                   Tabelas + RLS (corrigido)
└── functions/create-user/index.ts      Edge Function (criação segura de usuários)

scripts/create-admin.js                 Primeiro admin global (interativo)
```

## 🔐 Roles

| Função | Criar usuários | Obras/Orçamentos | Compras | Financeiro |
|--------|:---:|:---:|:---:|:---:|
| Admin | ✓ | ✓ | ✓ | ✓ |
| Gerente | ✓ | ✓ | ✗ | ✓ |
| Operacional | ✗ | ✓ | ✓ | ✗ |
| Visualização | ✗ | ✗ | ✗ | ✓ |
