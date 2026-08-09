// Pokémon TCG API — busca de cartas, sets e preços.
// Docs: https://docs.pokemontcg.io

import type { OwnedCard, PokemonType, TcgSet } from '@/types';
import { FALLBACK_RATES, convert, type Rates } from './exchange';

const BASE = 'https://api.pokemontcg.io/v2';
const KEY = import.meta.env.VITE_POKEMONTCG_API_KEY;

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

/**
 * Requisição com repetição em erro de servidor.
 * A Pokémon TCG API devolve 5xx com alguma frequência sob carga — e uma
 * falha dessas não é motivo para o usuário refazer a foto.
 */
async function request<T>(path: string, tentativa = 1): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });

  if (res.status >= 500 && tentativa < 3) {
    await new Promise((r) => setTimeout(r, 600 * tentativa));
    return request<T>(path, tentativa + 1);
  }

  if (res.status === 429) {
    throw new Error(
      'Limite de consultas da API atingido. Cadastre uma chave gratuita em dev.pokemontcg.io para liberar mais buscas.',
    );
  }

  if (!res.ok) {
    throw new Error(
      res.status >= 500
        ? 'O serviço de cartas está instável agora. Tente de novo em instantes.'
        : `Consulta recusada pela API (${res.status}).`,
    );
  }

  const json = await res.json();
  return json.data as T;
}

/** Aspas e barras soltas quebram a sintaxe de busca e geram erro 500. */
function sanitizar(valor: string): string {
  return valor.replace(/[^A-Za-zÀ-ÿ0-9 .'-]/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Preço bruto da carta, NA MOEDA DA FONTE.
 * TCGplayer cota em dólar; Cardmarket, em euro. A conversão para real
 * acontece depois, com a cotação do dia — nunca aqui.
 */
export function cardPrice(card: TcgCard): { amount: number; currency: 'USD' | 'EUR' } | null {
  const tcg = card.tcgplayer?.prices;
  if (tcg) {
    const order = ['holofoil', 'reverseHolofoil', 'normal', '1stEditionHolofoil', 'unlimitedHolofoil'];
    for (const k of order) {
      const p = tcg[k]?.market ?? tcg[k]?.mid;
      if (p) return { amount: p, currency: 'USD' };
    }
  }
  const cm = card.cardmarket?.prices?.trendPrice ?? card.cardmarket?.prices?.averageSellPrice;
  return cm ? { amount: cm, currency: 'EUR' } : null;
}

export async function searchCards(query: string, page = 1, pageSize = 24) {
  const q = encodeURIComponent(query);
  return request<TcgCard[]>(`/cards?q=${q}&page=${page}&pageSize=${pageSize}&orderBy=-set.releaseDate`);
}

export async function getCard(tcgId: string) {
  return request<TcgCard>(`/cards/${tcgId}`);
}

/** Busca por nome + número impresso — é o que o scanner consegue ler da carta. */
export async function findByNameAndNumber(name: string, number?: string, setId?: string) {
  const limpo = sanitizar(name);
  if (!limpo) return [];

  const parts = [`name:"${limpo}"`];
  if (number) parts.push(`number:${sanitizar(number)}`);
  if (setId) parts.push(`set.id:${sanitizar(setId)}`);
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
  rates: Rates = FALLBACK_RATES,
): Omit<OwnedCard, 'id'> {
  const now = Date.now();
  const price = cardPrice(card);
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
    unitPrice: price ? convert(price.amount, price.currency, rates) : 0,
    priceOrigin: price?.amount,
    priceCurrency: price?.currency,
    priceUpdatedAt: now,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
