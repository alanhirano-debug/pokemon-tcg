import { useMemo, useState } from 'react';
import type { PokedexEntry, PokemonHolding, PokemonType } from '@/types';

export type OwnershipFilter = 'all' | 'owned' | 'missing';

export interface DexFilters {
  search: string;
  ownership: OwnershipFilter;
  generation: number | 'all';
  types: PokemonType[];
  legendary: boolean;
  mythical: boolean;
  baby: boolean;
  favoritesOnly: boolean;
}

export const EMPTY_FILTERS: DexFilters = {
  search: '', ownership: 'all', generation: 'all',
  types: [], legendary: false, mythical: false, baby: false, favoritesOnly: false,
};

export function usePokedexFilters(
  pokedex: PokedexEntry[],
  holdings: Map<number, PokemonHolding>,
  favorites: number[],
) {
  const [filters, setFilters] = useState<DexFilters>(EMPTY_FILTERS);

  const filtered = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return pokedex.filter((p) => {
      const owned = holdings.has(p.id);

      if (term && !p.name.toLowerCase().includes(term) && String(p.id) !== term) return false;
      if (filters.ownership === 'owned' && !owned) return false;
      if (filters.ownership === 'missing' && owned) return false;
      if (filters.generation !== 'all' && p.generation !== filters.generation) return false;
      if (filters.types.length && !filters.types.some((t) => p.types.includes(t))) return false;
      if (filters.legendary && !p.isLegendary) return false;
      if (filters.mythical && !p.isMythical) return false;
      if (filters.baby && !p.isBaby) return false;
      if (filters.favoritesOnly && !favorites.includes(p.id)) return false;
      return true;
    });
  }, [pokedex, holdings, favorites, filters]);

  const counts = useMemo(() => ({
    all: pokedex.length,
    owned: pokedex.filter((p) => holdings.has(p.id)).length,
    missing: pokedex.filter((p) => !holdings.has(p.id)).length,
  }), [pokedex, holdings]);

  const update = <K extends keyof DexFilters>(key: K, value: DexFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const reset = () => setFilters(EMPTY_FILTERS);
  const activeCount =
    (filters.generation !== 'all' ? 1 : 0) + filters.types.length +
    Number(filters.legendary) + Number(filters.mythical) +
    Number(filters.baby) + Number(filters.favoritesOnly);

  return { filters, filtered, counts, update, reset, activeCount };
}
