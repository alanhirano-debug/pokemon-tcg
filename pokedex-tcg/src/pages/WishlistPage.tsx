import { useState } from 'react';
import { Heart, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCollection } from '@/contexts/CollectionContext';
import { addToWishlist, removeFromWishlist } from '@/services/collectionService';
import { searchCards, type TcgCard } from '@/services/tcgapi';
import { brl } from '@/lib/format';

export function WishlistPage() {
  const { user } = useAuth();
  const { wishlist } = useCollection();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<TcgCard[]>([]);
  const [searching, setSearching] = useState(false);

  async function search() {
    if (!term.trim()) return;
    setSearching(true);
    try {
      setResults(await searchCards(`name:"${term.trim()}*"`, 1, 12));
    } finally {
      setSearching(false);
    }
  }

  async function add(card: TcgCard) {
    if (!user) return;
    await addToWishlist(user.uid, {
      tcgId: card.id,
      pokedexId: card.nationalPokedexNumbers?.[0] ?? 0,
      name: card.name,
      setName: card.set.name,
      number: card.number,
      imageSmall: card.images.small,
      createdAt: Date.now(),
    });
    setResults([]);
    setTerm('');
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Wishlist</h1>
        <p className="text-sm text-mist">As cartas que você ainda quer caçar.</p>
      </header>

      <div className="flex gap-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Procurar carta para adicionar"
          className="flex-1 rounded-xl border border-white/10 bg-ink-700 px-3 py-2.5 text-sm outline-none focus:border-flame/60"
        />
        <button onClick={search} disabled={searching} className="rounded-xl bg-flame px-4 font-display text-sm font-bold disabled:opacity-50">
          {searching ? '…' : 'Buscar'}
        </button>
      </div>

      {results.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
          {results.map((c) => (
            <li key={c.id} className="panel p-2">
              <img src={c.images.small} alt={c.name} className="w-full rounded-lg" loading="lazy" />
              <p className="mt-1.5 truncate text-[11px] font-semibold">{c.name}</p>
              <p className="truncate text-[10px] text-mist">{c.set.name}</p>
              <button onClick={() => add(c)} className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg bg-ink-500 py-1.5 text-[11px] hover:bg-ink-400">
                <Plus size={11} /> Adicionar
              </button>
            </li>
          ))}
        </ul>
      )}

      {wishlist.length === 0 ? (
        <div className="panel grid place-items-center px-6 py-14 text-center">
          <Heart size={28} className="mb-3 text-mist" />
          <p className="font-display font-semibold">Wishlist vazia</p>
          <p className="mt-1 text-sm text-mist">Busque uma carta acima para começar sua lista.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {wishlist.map((item) => (
            <li key={item.id} className="panel flex items-center gap-3 p-3">
              <img src={item.imageSmall} alt={item.name} className="h-16 w-12 rounded-md object-cover" loading="lazy" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-semibold">{item.name}</p>
                <p className="truncate text-xs text-mist">{item.setName} · {item.number}</p>
              </div>
              {item.targetPrice && <span className="text-sm text-gold">{brl(item.targetPrice)}</span>}
              <button
                onClick={() => user && removeFromWishlist(user.uid, item.id)}
                className="rounded-lg p-2 text-mist hover:bg-flame/15 hover:text-flame"
                aria-label={`Remover ${item.name} da wishlist`}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
