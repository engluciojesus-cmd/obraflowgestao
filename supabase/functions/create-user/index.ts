// Supabase Edge Function: create-user
//
// Cria usuários de forma segura no servidor (service role), verificando
// se quem chamou tem permissão (admin_global OU admin/manager com
// can_manage_users na empresa alvo).
//
// Deploy: supabase functions deploy create-user
//
// O frontend chama via: supabase.functions.invoke("create-user", { body })

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1. Identificar quem está chamando (via JWT do header Authorization)
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !caller) {
      return json({ error: "Não autenticado." }, 401);
    }

    // 2. Ler payload
    const { username, full_name, password, company_id, role, can_manage_users } =
      await req.json();

    if (!username || username.trim().length < 3) {
      return json({ error: "Usuário deve ter no mínimo 3 caracteres." }, 400);
    }
    if (!password || password.length < 8) {
      return json({ error: "Senha deve ter no mínimo 8 caracteres." }, 400);
    }
    if (!company_id || !role) {
      return json({ error: "company_id e role são obrigatórios." }, 400);
    }
    const validRoles = ["admin", "manager", "operator", "viewer"];
    if (!validRoles.includes(role)) {
      return json({ error: "Função inválida." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 3. Verificar permissão de quem chamou
    const { data: callerRow } = await admin
      .from("users")
      .select("global_role")
      .eq("id", caller.id)
      .single();

    let allowed = callerRow?.global_role === "admin_global";

    if (!allowed) {
      const { data: membership } = await admin
        .from("company_members")
        .select("role, can_manage_users")
        .eq("user_id", caller.id)
        .eq("company_id", company_id)
        .single();

      allowed =
        !!membership &&
        (membership.role === "admin" || membership.can_manage_users === true);
    }

    if (!allowed) {
      return json({ error: "Sem permissão para criar usuários nesta empresa." }, 403);
    }

    // 4. Criar usuário
    const usernameLower = String(username).toLowerCase().trim();
    const email = `${usernameLower}@obraflow.local`;

    const { data: existing } = await admin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return json({ error: "Este usuário já existe." }, 409);
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username: usernameLower,
        full_name: (full_name || username).trim(),
      },
    });

    if (authError || !authData.user) {
      return json({ error: authError?.message || "Falha ao criar usuário no Auth." }, 500);
    }

    const newUserId = authData.user.id;

    // 5. Registro na tabela users (rollback do Auth se falhar)
    const { error: userError } = await admin.from("users").insert({
      id: newUserId,
      email,
      username: usernameLower,
      full_name: (full_name || username).trim(),
      global_role: "user",
    });

    if (userError) {
      await admin.auth.admin.deleteUser(newUserId);
      return json({ error: `Erro na tabela users: ${userError.message}` }, 500);
    }

    // 6. Associar à empresa
    const { error: memberError } = await admin.from("company_members").insert({
      user_id: newUserId,
      company_id,
      role,
      can_manage_users: can_manage_users === true || role === "admin",
    });

    if (memberError) {
      await admin.from("users").delete().eq("id", newUserId);
      await admin.auth.admin.deleteUser(newUserId);
      return json({ error: `Erro ao associar à empresa: ${memberError.message}` }, 500);
    }

    return json({ ok: true, user_id: newUserId, username: usernameLower, email });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Erro inesperado." },
      500
    );
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
