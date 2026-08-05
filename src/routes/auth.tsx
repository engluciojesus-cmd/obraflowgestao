import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acessar — ObraFlow Gestão" },
      {
        name: "description",
        content: "Acesse o ObraFlow Gestão com seu usuário: ERP de construção civil.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirecionar se já logado
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/erp", replace: true });
      }
    });
  }, [navigate]);

  // Converter username para email @obraflow.local
  function usernameToEmail(username: string): string {
    const clean = username.trim().toLowerCase().replace(/\s+/g, "");
    if (!clean) return "";
    return `${clean}@obraflow.local`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setLoading(true);

    try {
      const email = usernameToEmail(username);

      if (!email || email === "@obraflow.local") {
        setErro("Informe um nome de usuário válido.");
        setLoading(false);
        return;
      }

      if (modo === "login") {
        // Login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            setErro("Usuário ou senha incorretos.");
          } else {
            setErro(error.message);
          }
          setLoading(false);
          return;
        }

        navigate({ to: "/erp", replace: true });
      } else {
        // Signup
        if (password.length < 8) {
          setErro("Senha deve ter no mínimo 8 caracteres.");
          setLoading(false);
          return;
        }

        if (username.length < 3) {
          setErro("Usuário deve ter no mínimo 3 caracteres.");
          setLoading(false);
          return;
        }

        // Verificar se usuário já existe (via email @obraflow.local)
        const { data: existing } = await supabase
          .from("users")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        if (existing) {
          setErro("Este usuário já existe.");
          setLoading(false);
          return;
        }

        // Criar conta no Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.toLowerCase().trim(),
              full_name: fullName.trim() || username,
            },
          },
        });

        if (authError) {
          if (authError.message.includes("already")) {
            setErro("Este usuário já está registrado.");
          } else {
            setErro(authError.message);
          }
          setLoading(false);
          return;
        }

        if (!authData.user) {
          setErro("Erro ao criar conta.");
          setLoading(false);
          return;
        }

        // Criar registro na tabela users
        const { error: dbError } = await supabase.from("users").insert({
          id: authData.user.id,
          email: email,
          username: username.toLowerCase().trim(),
          full_name: fullName.trim() || username,
          global_role: "user",
          created_at: new Date().toISOString(),
        });

        if (dbError) throw dbError;

        setSucesso("Conta criada com sucesso! Você será redirecionado...");
        setTimeout(() => {
          navigate({ to: "/erp", replace: true });
        }, 2000);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-8">
      {/* Background (gradiente — substitui login-bg.jpg) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1000px 600px at 80% -10%, hsl(28 92% 54% / 0.18), transparent 60%), radial-gradient(800px 500px at 10% 110%, hsl(210 80% 40% / 0.15), transparent 60%), hsl(220 18% 8%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-lg bg-card shadow-2xl">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 border-b border-line bg-gradient-to-br from-card to-card/80 px-8 py-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cta text-2xl font-bold text-cta-foreground">
            ⌂
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">
              Obra<span className="text-cta">Flow</span>
            </h1>
            <p className="text-xs text-muted-foreground">Gestão de Obras e Orçamentos</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-8">
          {/* Tabs */}
          <div className="flex gap-2 rounded-lg bg-side p-1">
            <button
              type="button"
              onClick={() => {
                setModo("login");
                setErro(null);
                setSucesso(null);
              }}
              className={`flex-1 rounded px-4 py-2 text-sm font-semibold transition ${
                modo === "login"
                  ? "bg-cta text-cta-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setModo("signup");
                setErro(null);
                setSucesso(null);
              }}
              className={`flex-1 rounded px-4 py-2 text-sm font-semibold transition ${
                modo === "signup"
                  ? "bg-cta text-cta-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Cadastro
            </button>
          </div>

          {/* Username */}
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Usuário
            </label>
            <input
              type="text"
              required
              placeholder="seu_usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              className="field mt-1"
              minLength={3}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Mín. 3 caracteres. Será {usernameToEmail(username) || "usuario@obraflow.local"}
            </p>
          </div>

          {/* Full Name (apenas signup) */}
          {modo === "signup" && (
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Nome Completo
              </label>
              <input
                type="text"
                placeholder="Seu Nome"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="field mt-1"
              />
            </div>
          )}

          {/* Password */}
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Senha
            </label>
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field pr-10"
                minLength={modo === "signup" ? 8 : 1}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
            {modo === "signup" && (
              <p className="mt-1 text-xs text-muted-foreground">Mín. 8 caracteres</p>
            )}
          </div>

          {/* Erro */}
          {erro && (
            <div className="rounded-lg bg-err/10 px-3 py-2 text-sm text-err">
              {erro}
            </div>
          )}

          {/* Sucesso */}
          {sucesso && (
            <div className="rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">
              {sucesso}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!username || !password || loading}
            className="btn-cta mt-2 w-full uppercase disabled:opacity-50"
          >
            {loading
              ? "Aguarde..."
              : modo === "login"
                ? "Entrar"
                : "Criar Conta"}
          </button>
        </form>

        {/* Footer */}
        <div className="border-t border-line bg-side/50 px-8 py-4 text-center text-xs text-muted-foreground">
          <p>
            Usando ObraFlow pela primeira vez?{" "}
            <a href="#" className="text-cta hover:underline">
              Saiba mais
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
