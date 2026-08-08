import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Star, Trash2 } from 'lucide-react';
import { PokemonSprite } from '@/components/pokedex/PokemonSprite';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { StatTile } from '@/components/ui/StatTile';
import { useAuth } from '@/contexts/AuthContext';
import { useCollection } from '@/contexts/CollectionContext';
import { removeCard, toggleFavoritePokemon, updateCard } from '@/services/collectionService';
import { CONDITION_LABEL, LANGUAGE_LABEL, brl, dexNumber } from '@/lib/format';

export function PokemonDetailPage() {
  const { id } = useParams();
  const pokedexId = Number(id);
  const { user } = useAuth();
  const { pokedex, cards, favoritePokemon, setFavoritePokemon, settings } = useCollection();
  const [busy, setBusy] = useState<string | null>(null);

  const entry = pokedex.find((p) => p.id === pokedexId);
  const myCards = useMemo(
    () => cards.filter((c) => c.pokedexId === pokedexId),
    [cards, pokedexId],
  );

  if (!entry) return <p className="text-mist">Pokémon não encontrado.</p>;

  const owned = myCards.length > 0;
  const totalCards = myCards.reduce((s, c) => s + c.quantity, 0);
  const totalValue = myCards.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  const isFavorite = favoritePokemon.includes(entry.id);

  async function changeQty(cardId: string, current: number, delta: number) {
    if (!user) return;
    const next = current + delta;
    setBusy(cardId);
    if (next <= 0) await removeCard(user.uid, cardId);
    else await updateCard(user.uid, cardId, { quantity: next });
    setBusy(null);
  }

  return (
    <div className="space-y-5">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-mist hover:text-white">
        <ArrowLeft size={15} /> Pokédex
      </Link>

      <section className="panel flex flex-wrap items-center gap-6 p-5">
        <PokemonSprite
          id={entry.id}
          name={entry.name}
          slug={entry.slug}
          owned={owned}
          size={132}
          style={settings.spriteStyle}
          animated={settings.animatedSprites}
          eager
        />

        <div className="min-w-[200px] flex-1">
          <span className="dex-num">{dexNumber(entry.id)}</span>
          <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold">
            {entry.name}
            <button
              onClick={async () => {
                if (!user) return;
                setFavoritePokemon(await toggleFavoritePokemon(user.uid, entry.id, favoritePokemon));
              }}
              aria-label={isFavorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
            >
              <Star size={20} className={isFavorite ? 'fill-gold text-gold' : 'text-mist hover:text-gold'} />
            </button>
          </h1>

          <div className="mt-2 flex flex-wrap gap-2">
            {entry.types.map((t) => <TypeBadge key={t} type={t} />)}
          </div>

          <p className="mt-3 text-sm text-mist">
            {entry.genus} · {entry.heightM.toFixed(1)} m · {entry.weightKg.toFixed(1)} kg · {entry.region}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Cartas" value={totalCards} />
          <StatTile label="Versões" value={myCards.length} />
          <StatTile label="Valor total" value={brl(totalValue)} accent />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Suas cartas deste Pokémon</h2>

        {myCards.length === 0 ? (
          <div className="panel px-6 py-12 text-center">
            <p className="font-display font-semibold">Você ainda não tem cartas do {entry.name}</p>
            <p className="mt-1 text-sm text-mist">Escaneie uma carta para marcá-lo como obtido na Pokédex.</p>
            <Link to="/adicionar" className="mt-4 inline-block rounded-xl bg-flame px-4 py-2 font-display text-sm font-bold">
              Escanear carta
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {myCards.map((card) => (
              <li key={card.id} className="panel flex items-center gap-4 p-3">
                <img src={card.imageSmall} alt={card.name} className="h-[74px] w-[54px] rounded-md object-cover" loading="lazy" />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-semibold">{card.name}</p>
                  <p className="truncate text-xs text-mist">
                    {card.setName} · {card.number}
                  </p>
                  <p className="truncate text-xs text-mist">
                    {card.rarity} · {LANGUAGE_LABEL[card.language]} · {CONDITION_LABEL[card.condition]}
                    {card.isHolo && ' · Holo'}
                    {card.isReverse && ' · Reverse'}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <IconBtn onClick={() => changeQty(card.id, card.quantity, -1)} disabled={busy === card.id} label="Diminuir quantidade">
                    <Minus size={14} />
                  </IconBtn>
                  <span className="w-7 text-center font-dex text-sm font-bold">{card.quantity}</span>
                  <IconBtn onClick={() => changeQty(card.id, card.quantity, 1)} disabled={busy === card.id} label="Aumentar quantidade">
                    <Plus size={14} />
                  </IconBtn>
                </div>

                <div className="w-24 text-right">
                  <div className="font-display font-bold text-flame">{brl(card.unitPrice * card.quantity)}</div>
                  <div className="text-[11px] text-mist">{brl(card.unitPrice)} un.</div>
                </div>

                <button
                  onClick={() => user && removeCard(user.uid, card.id)}
                  className="rounded-lg p-2 text-mist transition hover:bg-flame/15 hover:text-flame"
                  aria-label={`Excluir ${card.name}`}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function IconBtn({
  children, onClick, disabled, label,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-ink-600 transition hover:border-flame/60 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
