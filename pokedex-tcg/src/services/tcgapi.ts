// Formato de carta que o app consome. Os dados vêm da TCGdex
// (ver services/tcgdex.ts); este arquivo guarda o contrato e a conversão
// para o documento gravado no Firestore.

import type { OwnedCard, PokemonType } from '@/types';

export interface TcgCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  artist?: string;
  hp?: string;
  types?: string[];
  images: { small: string; large: string };
  set: { id: string; name: string; series: string; ptcgoCode?: string; printedTotal: number; total: number; releaseDate: string; images: { symbol: string; logo: string } };
  nationalPokedexNumbers?: number[];
  tcgplayer?: { prices?: Record<string, { market?: number; mid?: number; low?: number }> };
  cardmarket?: { prices?: { averageSellPrice?: number; trendPrice?: number } };
}

/**
 * Requisição com repetição em erro de servidor.
 * A Pokémon TCG API devolve 5xx com alguma frequência sob carga — e uma
 * falha dessas não é motivo para o usuário refazer a foto.
 */
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
    unitPrice: 0,
    priceUpdatedAt: now,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
