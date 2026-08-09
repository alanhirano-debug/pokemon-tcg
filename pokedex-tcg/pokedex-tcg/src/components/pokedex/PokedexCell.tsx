import { Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PokemonSprite } from './PokemonSprite';
import { dexNumber } from '@/lib/format';
import type { PokedexEntry, SpriteStyle } from '@/types';

interface Props {
  entry: PokedexEntry;
  owned: boolean;
  favorite: boolean;
  spriteStyle: SpriteStyle;
  animated: boolean;
}

export function PokedexCell({ entry, owned, favorite, spriteStyle, animated }: Props) {
  return (
    <Link
      to={`/pokemon/${entry.id}`}
      className={[
        'group relative flex flex-col items-center gap-1 rounded-xl border px-2 pb-2 pt-3',
        'transition duration-200 hover:-translate-y-0.5',
        owned
          ? 'border-white/10 bg-ink-600 hover:border-flame/60 hover:shadow-glow'
          : 'border-white/[0.04] bg-ink-700/50 hover:border-white/15',
      ].join(' ')}
    >
      <span className="dex-num self-start">{dexNumber(entry.id)}</span>

      {favorite && (
        <Star size={12} className="absolute right-2 top-2 fill-gold text-gold" aria-hidden />
      )}

      <PokemonSprite
        id={entry.id}
        name={entry.name}
        slug={entry.slug}
        owned={owned}
        size={64}
        style={spriteStyle}
        animated={animated}
      />

      <span
        className={`line-clamp-1 text-center text-xs font-medium ${owned ? 'text-white' : 'text-mist'}`}
      >
        {owned ? entry.name : '???'}
      </span>
    </Link>
  );
}
