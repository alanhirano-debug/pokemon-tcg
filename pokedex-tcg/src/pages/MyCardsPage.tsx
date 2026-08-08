import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useCollection } from '@/contexts/CollectionContext';
import { exportCSV, exportPDF, exportXLSX } from '@/services/exportService';
import { brl } from '@/lib/format';

export function MyCardsPage() {
  const { cards } = useCollection();
  const [term, setTerm] = useState('');
  const [sort, setSort] = useState<'recent' | 'value' | 'name'>('recent');

  const list = useMemo(() => {
    const filtered = cards.filter((c) =>
      [c.name, c.setName, c.number, c.rarity].join(' ').toLowerCase().includes(term.toLowerCase()),
    );
    return filtered.sort((a, b) => {
      if (sort === 'value') return b.unitPrice * b.quantity - a.unitPrice * a.quantity;
      if (sort === 'name') return a.name.localeCompare(b.name);
      return b.createdAt - a.createdAt;
    });
  }, [cards, term, sort]);

  const total = list.reduce((s, c) => s + c.unitPrice * c.quantity, 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Minhas cartas</h1>
          <p className="text-sm text-mist">
            {list.length} registros · {brl(total)}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCSV(cards)} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs hover:border-white/25">
            <Download size={13} /> CSV
          </button>
          <button onClick={() => exportXLSX(cards)} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs hover:border-white/25">
            <Download size={13} /> Excel
          </button>
          <button onClick={() => exportPDF(cards)} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs hover:border-white/25">
            <Download size={13} /> PDF
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por nome, coleção, número ou raridade"
          className="min-w-[220px] flex-1 rounded-xl border border-white/10 bg-ink-700 px-3 py-2.5 text-sm outline-none focus:border-flame/60"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-xl border border-white/10 bg-ink-700 px-3 py-2.5 text-sm outline-none"
        >
          <option value="recent">Mais recentes</option>
          <option value="value">Maior valor</option>
          <option value="name">Nome A–Z</option>
        </select>
      </div>

      {list.length === 0 ? (
        <div className="panel px-6 py-12 text-center">
          <p className="font-display font-semibold">Nada por aqui ainda</p>
          <p className="mt-1 text-sm text-mist">Escaneie sua primeira carta para começar a coleção.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {list.map((c) => (
            <li key={c.id}>
              <Link to={`/pokemon/${c.pokedexId}`} className="panel block overflow-hidden p-2 transition hover:border-flame/60">
                <div className="relative">
                  <img src={c.imageSmall} alt={c.name} className="w-full rounded-lg" loading="lazy" />
                  {c.quantity > 1 && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-flame px-2 py-0.5 font-dex text-[10px] font-bold">
                      ×{c.quantity}
                    </span>
                  )}
                </div>
                <p className="mt-2 truncate text-xs font-semibold">{c.name}</p>
                <p className="truncate text-[10px] text-mist">{c.setName}</p>
                <p className="text-[11px] font-bold text-flame">{brl(c.unitPrice * c.quantity)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
