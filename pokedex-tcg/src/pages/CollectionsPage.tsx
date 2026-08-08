import { useEffect, useMemo, useState } from 'react';
import { useCollection } from '@/contexts/CollectionContext';
import { listSets } from '@/services/tcgapi';
import { brl, pct } from '@/lib/format';
import type { TcgSet } from '@/types';

export function CollectionsPage() {
  const { cards } = useCollection();
  const [sets, setSets] = useState<TcgSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyMine, setOnlyMine] = useState(true);

  useEffect(() => {
    listSets().then(setSets).catch(() => setSets([])).finally(() => setLoading(false));
  }, []);

  const bySet = useMemo(() => {
    const map = new Map<string, { unique: Set<string>; value: number }>();
    for (const c of cards) {
      const entry = map.get(c.setId) ?? { unique: new Set<string>(), value: 0 };
      entry.unique.add(c.tcgId);
      entry.value += c.unitPrice * c.quantity;
      map.set(c.setId, entry);
    }
    return map;
  }, [cards]);

  const rows = useMemo(() => {
    const list = sets.map((s) => {
      const mine = bySet.get(s.id);
      const have = mine?.unique.size ?? 0;
      return { set: s, have, missing: Math.max(0, s.total - have), value: mine?.value ?? 0, percent: pct(have, s.total) };
    });
    return (onlyMine ? list.filter((r) => r.have > 0) : list).sort((a, b) => b.percent - a.percent);
  }, [sets, bySet, onlyMine]);

  if (loading) return <p className="text-mist">Carregando coleções…</p>;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Coleções</h1>
          <p className="text-sm text-mist">Quanto falta para fechar cada expansão.</p>
        </div>
        <button
          onClick={() => setOnlyMine((v) => !v)}
          className="rounded-full border border-white/10 bg-ink-700 px-3.5 py-2 text-xs transition hover:border-white/25"
        >
          {onlyMine ? 'Ver todas as expansões' : 'Ver só onde tenho cartas'}
        </button>
      </header>

      {rows.length === 0 ? (
        <div className="panel px-6 py-12 text-center">
          <p className="font-display font-semibold">Nenhuma coleção começada</p>
          <p className="mt-1 text-sm text-mist">Adicione uma carta e a expansão dela aparece aqui.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ set, have, missing, value, percent }) => (
            <li key={set.id} className="panel p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display font-bold">{set.name}</p>
                  <p className="text-[11px] text-mist">{set.series} · {set.releaseDate}</p>
                </div>
                <img src={set.logo} alt="" className="h-9 w-16 object-contain" loading="lazy" />
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-ink-500">
                <div className="h-full rounded-full bg-flame transition-all duration-500" style={{ width: `${percent}%` }} />
              </div>

              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="font-dex">{have}/{set.total}</span>
                <span className="text-mist">faltam {missing}</span>
                <span className="font-display font-bold text-flame">{percent}%</span>
              </div>

              <p className="mt-2 text-xs text-mist">Valor nesta coleção: {brl(value)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
