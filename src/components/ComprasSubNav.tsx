import { Link, useRouterState } from "@tanstack/react-router";
import { COMPRAS_SUBMODULOS } from "@/types";

export function ComprasSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-line pb-4">
      {COMPRAS_SUBMODULOS.map((item) => {
        const active = pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-cta text-cta-foreground"
                : "bg-side text-foreground hover:bg-side/80"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
