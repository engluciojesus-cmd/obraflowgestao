import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/erp/compras/")({
  beforeLoad: () => {
    throw redirect({ to: "/erp/compras/itens" });
  },
});
