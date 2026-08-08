// Monta a Pokédex nacional a partir da PokéAPI e guarda em IndexedDB.
// São ~1025 entradas: baixa uma vez, depois abre instantâneo e offline.

import { get, set } from 'idb-keyval';
import type { PokedexEntry, PokemonType, Region } from '@/types';
import { toSpriteSlug } from './sprites';

const BASE = 'https://pokeapi.co/api/v2';
const CACHE_KEY = 'pokedex-v1';
const CACHE_TTL = 1000 * 60 * 60 * 24 * 30; // 30 dias

const GEN_RANGES: [number, number, number, Region][] = [
  [1, 1, 151, 'Kanto'],
  [2, 152, 251, 'Johto'],
  [3, 252, 386, 'Hoenn'],
  [4, 387, 493, 'Sinnoh'],
  [5, 494, 649, 'Unova'],
  [6, 650, 721, 'Kalos'],
  [7, 722, 809, 'Alola'],
  [8, 810, 905, 'Galar'],
  [9, 906, 1025, 'Paldea'],
];

export function generationOf(id: number): { generation: number; region: Region } {
  const found = GEN_RANGES.find(([, from, to]) => id >= from && id <= to);
  return found ? { generation: found[0], region: found[3] } : { generation: 9, region: 'Paldea' };
}

export const GENERATIONS = GEN_RANGES.map(([generation, from, to, region]) => ({
  generation, from, to, region,
}));

interface CachedDex { at: number; entries: PokedexEntry[] }

/** Pokédex completa. Usa cache local sempre que possível. */
export async function loadPokedex(onProgress?: (pct: number) => void): Promise<PokedexEntry[]> {
  const cached = await get<CachedDex>(CACHE_KEY);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.entries;

  const total = 1025;
  const batchSize = 60;
  const entries: PokedexEntry[] = [];

  for (let start = 1; start <= total; start += batchSize) {
    const ids = Array.from(
      { length: Math.min(batchSize, total - start + 1) },
      (_, i) => start + i,
    );
    const batch = await Promise.all(ids.map(fetchEntry));
    entries.push(...batch.filter((e): e is PokedexEntry => e !== null));
    onProgress?.(Math.round((entries.length / total) * 100));
  }

  entries.sort((a, b) => a.id - b.id);
  await set(CACHE_KEY, { at: Date.now(), entries } satisfies CachedDex);
  return entries;
}

async function fetchEntry(id: number): Promise<PokedexEntry | null> {
  try {
    const [pokemon, species] = await Promise.all([
      fetch(`${BASE}/pokemon/${id}`).then((r) => r.json()),
      fetch(`${BASE}/pokemon-species/${id}`).then((r) => r.json()),
    ]);

    const ptName = species.names?.find((n: any) => n.language.name === 'ja')?.name;
    const genus =
      species.genera?.find((g: any) => g.language.name === 'en')?.genus ?? '';
    const { generation, region } = generationOf(id);

    return {
      id,
      slug: toSpriteSlug(pokemon.name),
      name: capitalize(pokemon.name),
      types: pokemon.types.map((t: any) => t.type.name as PokemonType),
      generation,
      region,
      isLegendary: Boolean(species.is_legendary),
      isMythical: Boolean(species.is_mythical),
      isBaby: Boolean(species.is_baby),
      heightM: pokemon.height / 10,
      weightKg: pokemon.weight / 10,
      genus: genus || ptName || '',
    };
  } catch {
    return null;
  }
}

function capitalize(s: string) {
  return s
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export async function clearPokedexCache() {
  await set(CACHE_KEY, undefined);
}
