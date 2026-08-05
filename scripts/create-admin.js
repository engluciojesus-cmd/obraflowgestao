#!/usr/bin/env node

/**
 * Script para criar o primeiro admin global no ObraFlow
 * 
 * Uso:
 *   node scripts/create-admin.js
 * 
 * Variáveis de ambiente necessárias:
 *   SUPABASE_URL - URL do seu projeto Supabase
 *   SUPABASE_SERVICE_KEY - Chave de serviço (NOT the anon key!)
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt) =>
  new Promise((resolve) => {
    rl.question(prompt, resolve);
  });

async function main() {
  console.log("\n🔧 ObraFlow - Criador de Admin Global\n");

  // Carregar .env se existir
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, "utf-8");
    const lines = env.split("\n");
    lines.forEach((line) => {
      const [key, value] = line.split("=");
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) {
    console.error("❌ ERRO: SUPABASE_URL não encontrada em .env ou variáveis de ambiente");
    console.error("   Adicione ao seu .env:");
    console.error("   VITE_SUPABASE_URL=https://seu-projeto.supabase.co");
    process.exit(1);
  }

  if (!serviceKey) {
    console.error("❌ ERRO: SUPABASE_SERVICE_KEY não encontrada");
    console.error("   Você pode:");
    console.error("   1. Adicionar ao .env: SUPABASE_SERVICE_KEY=sua_chave_aqui");
    console.error("   2. Passar como variável: SUPABASE_SERVICE_KEY=xxx node scripts/create-admin.js");
    console.error("\n   ⚠️  Nunca compartilhe essa chave publicamente!");
    process.exit(1);
  }

  console.log("✓ Conexão com Supabase configurada\n");

  // Coletar dados do usuário
  const email = await question("📧 Email do admin global: ");
  const password = await question("🔐 Senha (mín 8 caracteres): ");
  const username = await question("👤 Usuário (ex: admin): ");
  const fullName = await question("👥 Nome completo: ");

  // Validações
  if (!email || !email.includes("@")) {
    console.error("❌ Email inválido");
    rl.close();
    process.exit(1);
  }

  if (!password || password.length < 8) {
    console.error("❌ Senha deve ter no mínimo 8 caracteres");
    rl.close();
    process.exit(1);
  }

  if (!username || username.length < 3) {
    console.error("❌ Usuário deve ter no mínimo 3 caracteres");
    rl.close();
    process.exit(1);
  }

  console.log("\n⏳ Criando admin global...\n");

  try {
    // Criar cliente Supabase com chave de serviço
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Criar usuário no Auth
    console.log("1️⃣  Criando usuário no Supabase Auth...");
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: password,
      email_confirm: true,
      user_metadata: {
        username: username.toLowerCase().trim(),
        full_name: fullName.trim(),
      },
    });

    if (authError) {
      throw new Error(`Erro no Auth: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error("Falha ao criar usuário no Auth");
    }

    console.log("   ✓ Usuário criado no Auth");

    // 2. Criar registro na tabela users
    console.log("2️⃣  Criando registro na tabela users...");
    const { error: userError } = await supabase.from("users").insert({
      id: authData.user.id,
      email: email.toLowerCase().trim(),
      username: username.toLowerCase().trim(),
      full_name: fullName.trim(),
      global_role: "admin_global",
      created_at: new Date().toISOString(),
    });

    if (userError) {
      throw new Error(`Erro na tabela users: ${userError.message}`);
    }

    console.log("   ✓ Registro criado na tabela users");

    // Sucesso!
    console.log("\n✅ Admin global criado com sucesso!\n");
    console.log("📝 Dados do Admin Global:");
    console.log(`   📧 Email: ${email}`);
    console.log(`   👤 Usuário: ${username}`);
    console.log(`   🔐 Senha: ${password}`);
    console.log(`   👥 Nome: ${fullName}`);
    console.log(`   🔑 Role: admin_global\n`);

    console.log("🚀 Próximos passos:");
    console.log("   1. Vá para http://localhost:5173/auth");
    console.log(`   2. Faça login com: ${username}`);
    console.log("   3. Acesse /admin para criar empresas");
    console.log("   4. Crie usuários iniciais (eng01, etc)\n");

    console.log("⚠️  IMPORTANTE:");
    console.log("   - Mude a senha ao fazer o primeiro login");
    console.log("   - Guarde essas credenciais em local seguro");
    console.log("   - Não compartilhe a SUPABASE_SERVICE_KEY\n");

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ ERRO ao criar admin global:");
    console.error(`   ${error.message}\n`);

    if (error.message.includes("email")) {
      console.error("💡 Dica: Este email pode já estar registrado");
    } else if (error.message.includes("Auth")) {
      console.error("💡 Dica: Verifique suas credenciais do Supabase");
    }

    rl.close();
    process.exit(1);
  }
}

main();
