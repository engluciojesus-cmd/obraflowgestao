import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/erp/compras")({
  component: ComprasLayout,
});

function ComprasLayout() {
  return <Outlet />;
}
