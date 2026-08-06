import { useTenant } from "@/app/TenantProvider";

export function SeletorEmpresa() {
  const { company, companies, trocarEmpresa } = useTenant();

  if (companies.length <= 1) {
    return (
      <div className="text-sm text-muted-foreground">{company?.name || "Sem empresa"}</div>
    );
  }

  return (
    <select
      value={company?.id || ""}
      onChange={(e) => trocarEmpresa(e.target.value)}
      className="field text-sm py-1"
    >
      <option value="">Escolha uma empresa...</option>
      {companies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
