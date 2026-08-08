import type { StatusCor } from '@/modules/suprimentos/domain/types';

const CLASSES: Record<StatusCor, string> = {
  side: 'bg-side text-muted-foreground',
  cta: 'bg-cta/10 text-cta',
  ok: 'bg-ok/10 text-ok',
  err: 'bg-err/10 text-err',
};

export function StatusPill({ label, cor }: { label: string; cor: StatusCor }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${CLASSES[cor]}`}
    >
      {label}
    </span>
  );
}

export default StatusPill;
