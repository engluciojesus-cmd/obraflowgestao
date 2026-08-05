import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuth";
import type { Company } from "@/types";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Global — ObraFlow" },
      { name: "description", content: "Painel de administração global" },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const navigate = useNavigate();
  const { user, loading: userLoading } = useAuthUser();

  // Redirecionar se não for admin
  useEffect(() => {
    if (!userLoading && (!user || user.global_role !== "admin_global")) {
      navigate({ to: "/", replace: true });
    }
  }, [user, userLoading, navigate]);

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Carregando...
      </div>
    );
  }

  if (!user || user.global_role !== "admin_global") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-line bg-card px-8 py-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Painel Admin Global</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie empresas e usuários
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate({ to: "/" })}
              className="rounded-lg bg-side px-4 py-2 text-sm font-semibold text-foreground hover:bg-side/80 transition"
            >
              Dashboard
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth", replace: true });
              }}
              className="rounded-lg bg-side px-4 py-2 text-sm font-semibold text-foreground hover:bg-side/80 transition"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="grid gap-8 p-8 md:grid-cols-2">
        {/* Criar Empresa */}
        <CompanyForm />

        {/* Lista de Empresas */}
        <CompaniesList />
      </main>
    </div>
  );
}

function CompanyForm() {
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const { user } = useAuthUser();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setErro(null);
    setSucesso(null);
    setLoading(true);

    try {
      const { error } = await supabase.from("companies").insert({
        name: name.trim(),
        cnpj: cnpj.trim() || null,
        created_by: user.id,
        active: true,
      });

      if (error) throw error;

      setSucesso("Empresa criada com sucesso!");
      setName("");
      setCnpj("");

      setTimeout(() => setSucesso(null), 3000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao criar empresa");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-card p-6">
      <h2 className="mb-4 text-lg font-bold">Criar Empresa</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold text-muted-foreground mb-1">
            Nome da Empresa *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Construções ABC"
            className="field"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-muted-foreground mb-1">
            CNPJ (opcional)
          </label>
          <input
            type="text"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
            className="field"
          />
        </div>

        {erro && (
          <div className="rounded bg-err/10 px-3 py-2 text-sm text-err">
            {erro}
          </div>
        )}
        {sucesso && (
          <div className="rounded bg-ok/10 px-3 py-2 text-sm text-ok">
            {sucesso}
          </div>
        )}

        <button
          type="submit"
          disabled={!name || loading}
          className="btn-cta uppercase disabled:opacity-50"
        >
          {loading ? "Criando..." : "Criar Empresa"}
        </button>
      </form>
    </div>
  );
}

function CompaniesList() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  useEffect(() => {
    loadCompanies();
  }, []);

  async function loadCompanies() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Empresas</h2>
        <button
          onClick={loadCompanies}
          className="text-xs text-cta hover:underline"
        >
          Atualizar
        </button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : companies.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma empresa criada ainda.
        </p>
      ) : (
        <div className="space-y-3">
          {companies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              isSelected={selectedCompany === company.id}
              onSelect={() =>
                setSelectedCompany(
                  selectedCompany === company.id ? null : company.id
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CompanyCard({
  company,
  isSelected,
  onSelect,
}: {
  company: Company;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-lg border p-4 transition ${
        isSelected
          ? "border-cta bg-cta/10"
          : "border-line hover:border-cta/50 hover:bg-side/30"
      }`}
    >
      <h3 className="font-semibold">{company.name}</h3>
      {company.cnpj && (
        <p className="text-xs text-muted-foreground">CNPJ: {company.cnpj}</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Criada em {new Date(company.created_at).toLocaleDateString("pt-BR")}
      </p>

      {isSelected && (
        <div
          className="mt-4 border-t border-line pt-4"
          onClick={(e) => e.stopPropagation()}
        >
          <CreateUserForm companyId={company.id} />
        </div>
      )}
    </div>
  );
}

function CreateUserForm({ companyId }: { companyId: string }) {
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "operator" | "viewer">(
    "operator"
  );
  const [canManageUsers, setCanManageUsers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setLoading(true);

    try {
      // Criação de usuário roda no servidor (Edge Function) — a service key
      // nunca vai para o navegador.
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          username,
          full_name: fullName,
          password,
          company_id: companyId,
          role,
          can_manage_users: canManageUsers,
        },
      });

      if (error) {
        const body = await (error as any)?.context?.json?.().catch(() => null);
        throw new Error(body?.error || error.message || "Erro ao criar usuário");
      }
      if (data?.error) throw new Error(data.error);

      setSucesso(`Usuário "${username}" criado com sucesso!`);
      setUsername("");
      setFullName("");
      setPassword("");
      setRole("operator");
      setCanManageUsers(false);

      setTimeout(() => setSucesso(null), 3000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao criar usuário");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold">Adicionar Usuário</h4>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">
          Usuário *
        </label>
        <input
          type="text"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          placeholder="eng01"
          className="field text-sm"
          minLength={3}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">
          Nome Completo
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nome completo"
          className="field text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">
          Senha Inicial *
        </label>
        <input
          type="text"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="mín. 8 caracteres"
          className="field text-sm"
          minLength={8}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1">
          Função
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
          className="field text-sm"
        >
          <option value="admin">Admin (controla tudo)</option>
          <option value="manager">Gerente (cria usuários, relatórios)</option>
          <option value="operator">Operacional (obras e orçamentos)</option>
          <option value="viewer">Visualização (somente leitura)</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={canManageUsers}
          onChange={(e) => setCanManageUsers(e.target.checked)}
          disabled={role === "admin"}
        />
        <span>Pode criar outros usuários na empresa</span>
      </label>

      {erro && (
        <div className="rounded bg-err/10 px-2 py-1 text-xs text-err">{erro}</div>
      )}
      {sucesso && (
        <div className="rounded bg-ok/10 px-2 py-1 text-xs text-ok">
          {sucesso}
        </div>
      )}

      <button
        type="submit"
        disabled={!username || !password || loading}
        className="btn-cta text-xs uppercase disabled:opacity-50"
      >
        {loading ? "Criando..." : "Adicionar Usuário"}
      </button>
    </form>
  );
}
