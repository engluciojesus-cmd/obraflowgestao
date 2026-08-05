import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany, useCanManageUsers } from "@/hooks/useAuth";
import { ErpLayout } from "@/components/ErpLayout";
import type { CompanyMember, TipoPagamento } from "@/types";
import { MODULOS } from "@/types";

export const Route = createFileRoute("/_authenticated/erp/seguranca")({
  head: () => ({ meta: [{ title: "Segurança — ObraFlow Gestão" }] }),
  component: SegurancaPage,
});

function SegurancaPage() {
  const { company, companyId, loading: companyLoading } = useActiveCompany();
  const canManage = useCanManageUsers(companyId || undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  if (companyLoading) {
    return (
      <ErpLayout title="Segurança">
        <p className="text-muted-foreground">Carregando...</p>
      </ErpLayout>
    );
  }

  if (!companyId) {
    return (
      <ErpLayout title="Segurança">
        <div className="rounded-lg border border-line bg-card p-8 text-center text-muted-foreground">
          Nenhuma empresa associada.
        </div>
      </ErpLayout>
    );
  }

  return (
    <ErpLayout title="Segurança" breadcrumb="Segurança">
      <div className="flex flex-col gap-8">
        {/* Identidade visual da empresa */}
        <CompanyLogoForm companyId={companyId} logoUrl={company?.logo_url} />

        {canManage ? (
          <>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="md:col-span-2">
                <CreateUserForm
                  companyId={companyId}
                  onSuccess={() => setRefreshKey((k) => k + 1)}
                />
              </div>
              <div className="rounded-lg border border-line bg-card p-6 h-fit">
                <h3 className="font-semibold mb-4">Sobre Funções</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-semibold text-cta">Admin</p>
                    <p className="text-muted-foreground">Controle total da empresa</p>
                  </div>
                  <div>
                    <p className="font-semibold text-cta">Gerente</p>
                    <p className="text-muted-foreground">Cria usuários, acessa relatórios</p>
                  </div>
                  <div>
                    <p className="font-semibold text-cta">Operacional</p>
                    <p className="text-muted-foreground">Obras, orçamentos, compras</p>
                  </div>
                  <div>
                    <p className="font-semibold text-cta">Visualização</p>
                    <p className="text-muted-foreground">Somente leitura</p>
                  </div>
                </div>
              </div>
            </div>

            <UsersList companyId={companyId} refreshKey={refreshKey} />

            <TiposPagamentoSection companyId={companyId} />
          </>
        ) : (
          <div className="rounded-lg border border-line bg-card p-8 text-center text-muted-foreground">
            Você não tem permissão para gerenciar usuários desta empresa.
          </div>
        )}
      </div>
    </ErpLayout>
  );
}

function CompanyLogoForm({
  companyId,
  logoUrl,
}: {
  companyId: string;
  logoUrl?: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(logoUrl || null);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setPreview(logoUrl || null);
  }, [logoUrl]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);
    setUploading(true);

    try {
      const ext = file.name.split(".").pop();
      const path = `${companyId}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("company-logos")
        .getPublicUrl(path);

      const { error: dbError } = await supabase
        .from("companies")
        .update({ logo_url: urlData.publicUrl })
        .eq("id", companyId);
      if (dbError) throw dbError;

      setPreview(urlData.publicUrl);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar logo");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-card p-8">
      <h2 className="mb-1 text-2xl font-bold">Logo da Empresa</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Aparece no painel e nos PDFs de orçamento exportados para o cliente.
      </p>

      <div className="flex items-center gap-6">
        <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-dashed border-line bg-side/30">
          {preview ? (
            <img src={preview} alt="Logo" className="max-h-20 max-w-36 object-contain" />
          ) : (
            <span className="text-xs text-muted-foreground">Sem logo</span>
          )}
        </div>

        <div>
          <label className="btn-cta inline-block cursor-pointer text-sm uppercase">
            {uploading ? "Enviando..." : "Enviar logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={handleFile}
              disabled={uploading}
              className="hidden"
            />
          </label>
          <p className="mt-2 text-xs text-muted-foreground">PNG, JPG ou SVG.</p>
          {erro && <p className="mt-2 text-xs text-err">{erro}</p>}
        </div>
      </div>
    </div>
  );
}

function TiposPagamentoSection({ companyId }: { companyId: string }) {
  const [tipos, setTipos] = useState<TipoPagamento[]>([]);
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [companyId]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tipos_pagamento")
      .select("*")
      .eq("company_id", companyId)
      .order("nome");
    if (error) setErro(error.message);
    setTipos(data || []);
    setLoading(false);
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setErro(null);
    const { error } = await supabase
      .from("tipos_pagamento")
      .insert({ company_id: companyId, nome: nome.trim().toUpperCase() });
    if (error) {
      setErro(error.message);
      return;
    }
    setNome("");
    load();
  }

  async function remover(id: string) {
    if (!confirm("Remover esta forma de pagamento?")) return;
    await supabase.from("tipos_pagamento").delete().eq("id", id);
    load();
  }

  return (
    <div className="rounded-lg border border-line bg-card p-8">
      <h2 className="mb-1 text-2xl font-bold">Formas de Pagamento</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Usadas no campo "Pagamento" dos pedidos de compra.
      </p>

      <form onSubmit={adicionar} className="flex gap-3 mb-6">
        <input
          className="field flex-1"
          placeholder="Ex: PIX, Boleto, Cartão de Crédito"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <button type="submit" className="btn-cta text-sm uppercase">
          Adicionar
        </button>
      </form>

      {erro && <p className="mb-4 text-sm text-err">{erro}</p>}

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : tipos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma forma de pagamento cadastrada.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tipos.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-2 rounded-full bg-side px-3 py-1.5 text-sm"
            >
              {t.nome}
              <button onClick={() => remover(t.id)} className="text-err hover:underline text-xs">
                remover
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateUserForm({
  companyId,
  onSuccess,
}: {
  companyId: string;
  onSuccess?: () => void;
}) {
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "operator" | "viewer">(
    "operator"
  );
  const [canManageUsers, setCanManageUsers] = useState(false);
  const [modulos, setModulos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setLoading(true);

    try {
      const usernameLower = username.toLowerCase().trim();

      if (usernameLower.length < 3) {
        throw new Error("Usuário deve ter no mínimo 3 caracteres");
      }
      if (password.length < 8) {
        throw new Error("Senha deve ter no mínimo 8 caracteres");
      }

      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          username: usernameLower,
          full_name: fullName,
          password,
          company_id: companyId,
          role,
          can_manage_users: canManageUsers,
          modulos: modulos.length > 0 ? modulos : null,
        },
      });

      if (error) {
        const body = await (error as any)?.context?.json?.().catch(() => null);
        throw new Error(body?.error || error.message || "Erro ao criar usuário");
      }
      if (data?.error) throw new Error(data.error);

      setSucesso(`✓ Usuário "${usernameLower}" adicionado com sucesso!`);
      setUsername("");
      setFullName("");
      setPassword("");
      setRole("operator");
      setCanManageUsers(false);
      setModulos([]);

      setTimeout(() => setSucesso(null), 3000);
      onSuccess?.();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-card p-8">
      <h2 className="mb-6 text-2xl font-bold">Criar Novo Usuário</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold text-muted-foreground mb-1">
            Usuário *
          </label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="eng01"
            minLength={3}
            className="field"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Será criado como: {username ? `${username.toLowerCase()}@obraflow.local` : "-"}
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-muted-foreground mb-1">
            Nome Completo
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Seu Nome"
            className="field"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-muted-foreground mb-1">
            Senha Inicial *
          </label>
          <input
            type="text"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="mín. 8 caracteres"
            minLength={8}
            className="field"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Informe esta senha ao usuário. Ele deve trocá-la no primeiro acesso.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-muted-foreground mb-1">
            Função *
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            className="field"
          >
            <option value="admin">Admin — Controle total</option>
            <option value="manager">Gerente — Cria usuários, relatórios</option>
            <option value="operator">Operacional — Obras, orçamentos</option>
            <option value="viewer">Visualização — Somente leitura</option>
          </select>
        </div>

        <label className="flex items-center gap-3 rounded-lg border border-line bg-side p-3">
          <input
            type="checkbox"
            checked={canManageUsers}
            onChange={(e) => setCanManageUsers(e.target.checked)}
            disabled={role === "admin"}
            className="w-4 h-4"
          />
          <div>
            <p className="text-sm font-semibold">Pode criar outros usuários na empresa</p>
            <p className="text-xs text-muted-foreground">
              {role === "admin"
                ? "Admin já tem essa permissão"
                : "Permite que este usuário crie novos usuários"}
            </p>
          </div>
        </label>

        <div className="rounded-lg border border-line bg-side/40 p-4">
          <p className="text-sm font-semibold">Módulos visíveis</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Deixe tudo desmarcado para liberar todos os módulos.
          </p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {MODULOS.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={modulos.includes(m.id)}
                  onChange={(e) =>
                    setModulos(
                      e.target.checked
                        ? [...modulos, m.id]
                        : modulos.filter((x) => x !== m.id)
                    )
                  }
                />
                {m.label}
              </label>
            ))}
          </div>
        </div>

        {erro && (
          <div className="rounded-lg bg-err/10 px-4 py-3 text-sm text-err border border-err/20">
            {erro}
          </div>
        )}
        {sucesso && (
          <div className="rounded-lg bg-ok/10 px-4 py-3 text-sm text-ok border border-ok/20">
            {sucesso}
          </div>
        )}

        <button
          type="submit"
          disabled={!username || !password || loading}
          className="btn-cta mt-2 uppercase disabled:opacity-50"
        >
          {loading ? "Criando..." : "Criar Usuário"}
        </button>
      </form>
    </div>
  );
}

function UsersList({
  companyId,
  refreshKey,
}: {
  companyId: string;
  refreshKey: number;
}) {
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editandoModulos, setEditandoModulos] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<string[]>([]);

  async function salvarModulos(memberId: string) {
    await supabase
      .from("company_members")
      .update({ modulos: rascunho.length > 0 ? rascunho : null })
      .eq("id", memberId);
    setEditandoModulos(null);
    loadMembers();
  }

  useEffect(() => {
    loadMembers();
  }, [companyId, refreshKey]);

  async function loadMembers() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("company_members")
        .select("*, user:users(email, username, full_name)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMembers((data as any) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Usuários Cadastrados</h2>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : members.length === 0 ? (
        <p className="text-muted-foreground">Nenhum usuário ainda.</p>
      ) : (
        <div className="rounded-lg border border-line overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-side border-b border-line">
              <tr>
                <th className="text-left px-6 py-3 font-semibold">Usuário</th>
                <th className="text-left px-6 py-3 font-semibold">Email</th>
                <th className="text-left px-6 py-3 font-semibold">Função</th>
                <th className="text-left px-6 py-3 font-semibold">Permissões</th>
                <th className="text-left px-6 py-3 font-semibold">Módulos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-side/30 transition">
                  <td className="px-6 py-4">
                    <p className="font-semibold">{member.user?.username || "—"}</p>
                    <p className="text-xs text-muted-foreground">{member.user?.full_name}</p>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{member.user?.email}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-cta/10 px-3 py-1 text-xs font-semibold text-cta capitalize">
                      {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {member.can_manage_users ? (
                      <span className="inline-flex items-center gap-1 text-xs text-ok">
                        ✓ Cria usuários
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sem gestão</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">
                    {editandoModulos === member.id ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-1">
                          {MODULOS.map((m) => (
                            <label key={m.id} className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                className="w-3 h-3"
                                checked={rascunho.includes(m.id)}
                                onChange={(e) =>
                                  setRascunho(
                                    e.target.checked
                                      ? [...rascunho, m.id]
                                      : rascunho.filter((x) => x !== m.id)
                                  )
                                }
                              />
                              {m.label}
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => salvarModulos(member.id)}
                            className="text-cta hover:underline font-semibold"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setEditandoModulos(null)}
                            className="text-muted-foreground hover:underline"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditandoModulos(member.id);
                          setRascunho(member.modulos || []);
                        }}
                        className="hover:text-cta hover:underline text-left"
                      >
                        {member.modulos && member.modulos.length > 0
                          ? MODULOS.filter((m) => member.modulos!.includes(m.id))
                              .map((m) => m.label)
                              .join(", ")
                          : "Todos"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
