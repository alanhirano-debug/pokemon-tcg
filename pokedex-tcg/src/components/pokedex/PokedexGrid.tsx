import { useMemo } from 'react';
import { PokedexCell } from './PokedexCell';
import { GENERATIONS } from '@/services/pokeapi';
import type { PokedexEntry, PokemonHolding, SpriteStyle } from '@/types';

interface Props {
  entries: PokedexEntry[];
  holdings: Map<number, PokemonHolding>;
  favorites: number[];
  spriteStyle: SpriteStyle;
  animated: boolean;
  groupByRegion?: boolean;
}

export function PokedexGrid({
  entries, holdings, favorites, spriteStyle, animated, groupByRegion = true,
}: Props) {
  const groups = useMemo(() => {
    if (!groupByRegion) return [{ region: null as string | null, items: entries }];
    return GENERATIONS.map(({ region, from, to }) => ({
      region,
      items: entries.filter((e) => e.id >= from && e.id <= to),
    })).filter((g) => g.items.length > 0);
  }, [entries, groupByRegion]);

  if (entries.length === 0) {
    return (
      <div className="panel grid place-items-center px-6 py-16 text-center">
        <p className="font-display text-lg font-semibold">Nenhum Pokémon com esses filtros</p>
        <p className="mt-1 text-sm text-mist">Ajuste a busca ou limpe os filtros para ver a Pokédex inteira.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map(({ region, items }) => (
        <section key={region ?? 'all'}>
          {region && (
            <header className="mb-3 flex items-baseline gap-3">
              <h2 className="font-display text-lg font-bold">{region}</h2>
              <span className="dex-num">{items.length}</span>
            </header>
          )}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9">
            {items.map((entry) => (
              <PokedexCell
                key={entry.id}
                entry={entry}
                owned={holdings.has(entry.id)}
                favorite={favorites.includes(entry.id)}
                spriteStyle={spriteStyle}
                animated={animated}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
