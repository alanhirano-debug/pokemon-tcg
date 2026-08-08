// Pokémon TCG API — busca de cartas, sets e preços.
// Docs: https://docs.pokemontcg.io

import type { OwnedCard, PokemonType, TcgSet } from '@/types';

const BASE = 'https://api.pokemontcg.io/v2';
const KEY = import.meta.env.VITE_POKEMONTCG_API_KEY;
/** Cotação de fallback quando a carta só tem preço em USD/EUR. */
const USD_BRL = 5.4;

function headers(): HeadersInit {
  return KEY ? { 'X-Api-Key': KEY } : {};
}

export interface TcgCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  artist?: string;
  hp?: string;
  types?: string[];
  images: { small: string; large: string };
  set: { id: string; name: string; series: string; printedTotal: number; total: number; releaseDate: string; images: { symbol: string; logo: string } };
  nationalPokedexNumbers?: number[];
  tcgplayer?: { prices?: Record<string, { market?: number; mid?: number; low?: number }> };
  cardmarket?: { prices?: { averageSellPrice?: number; trendPrice?: number } };
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`TCG API ${res.status}: ${res.statusText}`);
  const json = await res.json();
  return json.data as T;
}

/** Preço em BRL. Prefere TCGplayer (market), cai para Cardmarket. */
export function priceInBRL(card: TcgCard): number {
  const tcg = card.tcgplayer?.prices;
  if (tcg) {
    const order = ['holofoil', 'reverseHolofoil', 'normal', '1stEditionHolofoil', 'unlimitedHolofoil'];
    for (const k of order) {
      const p = tcg[k]?.market ?? tcg[k]?.mid;
      if (p) return round2(p * USD_BRL);
    }
  }
  const cm = card.cardmarket?.prices?.trendPrice ?? card.cardmarket?.prices?.averageSellPrice;
  return cm ? round2(cm * USD_BRL) : 0;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function searchCards(query: string, page = 1, pageSize = 24) {
  const q = encodeURIComponent(query);
  return request<TcgCard[]>(`/cards?q=${q}&page=${page}&pageSize=${pageSize}&orderBy=-set.releaseDate`);
}

export async function getCard(tcgId: string) {
  return request<TcgCard>(`/cards/${tcgId}`);
}

/** Busca por nome + número impresso — é o que o scanner consegue ler da carta. */
export async function findByNameAndNumber(name: string, number?: string, setId?: string) {
  const parts = [`name:"${name}"`];
  if (number) parts.push(`number:${number}`);
  if (setId) parts.push(`set.id:${setId}`);
  return searchCards(parts.join(' '), 1, 12);
}

export async function listSets(): Promise<TcgSet[]> {
  const sets = await request<TcgCard['set'][]>('/sets?orderBy=-releaseDate&pageSize=250');
  return sets.map((s) => ({
    id: s.id,
    name: s.name,
    series: s.series,
    total: s.total,
    printedTotal: s.printedTotal,
    releaseDate: s.releaseDate,
    logo: s.images.logo,
    symbol: s.images.symbol,
  }));
}

/** Converte a resposta da API no formato que gravamos no Firestore. */
export function toOwnedCard(
  card: TcgCard,
  overrides: Partial<OwnedCard> = {},
): Omit<OwnedCard, 'id'> {
  const now = Date.now();
  return {
    tcgId: card.id,
    pokedexId: card.nationalPokedexNumbers?.[0] ?? 0,
    name: card.name,
    setId: card.set.id,
    setName: card.set.name,
    number: `${card.number}/${card.set.printedTotal}`,
    rarity: card.rarity ?? 'Comum',
    imageSmall: card.images.small,
    imageLarge: card.images.large,
    artist: card.artist,
    hp: card.hp,
    types: card.types?.map((t) => t.toLowerCase() as PokemonType),
    releaseDate: card.set.releaseDate,
    quantity: 1,
    condition: 'NM',
    language: 'PT',
    isHolo: /holo/i.test(card.rarity ?? ''),
    isReverse: false,
    isFirstEdition: false,
    unitPrice: priceInBRL(card),
    priceUpdatedAt: now,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
