import type { ReactNode } from 'react';

export function StatTile({
  label, value, hint, accent = false,
}: { label: string; value: ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div className="panel px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-mist">{label}</div>
      <div className={`font-display text-xl font-bold ${accent ? 'text-flame' : ''}`}>{value}</div>
      {hint && <div className="text-[11px] text-mist">{hint}</div>}
    </div>
  );
}
