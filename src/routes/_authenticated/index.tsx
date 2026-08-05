import { createFileRoute, redirect } from "@tanstack/react-router";

// Sem tela intermediária: quem estiver autenticado vai direto para o ERP.
export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: () => {
    throw redirect({ to: "/erp" });
  },
});
