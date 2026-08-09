import { TYPE_LABEL } from '@/lib/format';
import type { PokemonType } from '@/types';

const BG: Record<PokemonType, string> = {
  normal: 'bg-type-normal', fire: 'bg-type-fire', water: 'bg-type-water',
  electric: 'bg-type-electric', grass: 'bg-type-grass', ice: 'bg-type-ice',
  fighting: 'bg-type-fighting', poison: 'bg-type-poison', ground: 'bg-type-ground',
  flying: 'bg-type-flying', psychic: 'bg-type-psychic', bug: 'bg-type-bug',
  rock: 'bg-type-rock', ghost: 'bg-type-ghost', dragon: 'bg-type-dragon',
  dark: 'bg-type-dark', steel: 'bg-type-steel', fairy: 'bg-type-fairy',
};

export function TypeBadge({ type, size = 'md' }: { type: PokemonType; size?: 'sm' | 'md' }) {
  return (
    <span
      className={[
        BG[type],
        'inline-flex items-center rounded-full font-display font-semibold uppercase tracking-wide text-white',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs',
      ].join(' ')}
    >
      {TYPE_LABEL[type]}
    </span>
  );
}
