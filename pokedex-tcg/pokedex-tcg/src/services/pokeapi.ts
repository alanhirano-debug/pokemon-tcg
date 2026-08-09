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

interface CachedDex {
  at: number;
  entries: PokedexEntry[];
  /** false quando algum Pokémon não pôde ser baixado. */
  complete: boolean;
}

export const NATIONAL_DEX_TOTAL = 1025;

/** Concorrência baixa: rede móvel derruba requisições em rajada. */
const CONCURRENCY = 12;
const RETRIES = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Pokédex completa.
 *
 * Regra que faltava antes: um resultado incompleto NUNCA é tratado como
 * definitivo. Ele é guardado marcado como parcial e, na abertura seguinte,
 * o app busca só o que falta em vez de refazer os 1025.
 */
export async function loadPokedex(onProgress?: (pct: number) => void): Promise<PokedexEntry[]> {
  const cached = await get<CachedDex>(CACHE_KEY);
  const fresh = cached && Date.now() - cached.at < CACHE_TTL;

  if (fresh && cached.complete) return cached.entries;

  // Cache parcial: reaproveita o que já veio e persegue apenas os buracos.
  const known = new Map<number, PokedexEntry>(
    (cached?.entries ?? []).map((e) => [e.id, e]),
  );

  const missing = Array.from({ length: NATIONAL_DEX_TOTAL }, (_, i) => i + 1)
    .filter((id) => !known.has(id));

  const failed: number[] = [];

  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const slice = missing.slice(i, i + CONCURRENCY);
    const results = await Promise.all(slice.map((id) => fetchEntry(id)));

    results.forEach((entry, index) => {
      if (entry) known.set(entry.id, entry);
      else failed.push(slice[index]);
    });

    onProgress?.(Math.round(((known.size) / NATIONAL_DEX_TOTAL) * 100));
  }

  // Segunda passada, mais devagar, só nos que falharam.
  if (failed.length > 0) {
    for (const id of failed) {
      await sleep(120);
      const entry = await fetchEntry(id);
      if (entry) known.set(id, entry);
      onProgress?.(Math.round((known.size / NATIONAL_DEX_TOTAL) * 100));
    }
  }

  const entries = [...known.values()].sort((a, b) => a.id - b.id);
  const complete = entries.length === NATIONAL_DEX_TOTAL;

  await set(CACHE_KEY, { at: Date.now(), entries, complete } satisfies CachedDex);

  if (!complete) {
    console.warn(
      `[Pokédex] ${entries.length}/${NATIONAL_DEX_TOTAL} carregados. ` +
      `Faltam: ${Array.from({ length: NATIONAL_DEX_TOTAL }, (_, i) => i + 1)
        .filter((id) => !known.has(id)).join(', ')}`,
    );
  }

  return entries;
}

/** Quantos Pokémon estão faltando no cache local. */
export async function pokedexHealth() {
  const cached = await get<CachedDex>(CACHE_KEY);
  const loaded = cached?.entries.length ?? 0;
  return { loaded, total: NATIONAL_DEX_TOTAL, missing: NATIONAL_DEX_TOTAL - loaded };
}

async function fetchJSON(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} em ${url}`);
  return res.json();
}

async function fetchEntry(id: number, attempt = 1): Promise<PokedexEntry | null> {
  try {
    const [pokemon, species] = await Promise.all([
      fetchJSON(`${BASE}/pokemon/${id}`),
      fetchJSON(`${BASE}/pokemon-species/${id}`),
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
    // Backoff exponencial: 400ms, 800ms, 1600ms. Cobre oscilação de rede
    // móvel e limite de requisições da PokéAPI.
    if (attempt < RETRIES) {
      await sleep(400 * 2 ** (attempt - 1));
      return fetchEntry(id, attempt + 1);
    }
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
