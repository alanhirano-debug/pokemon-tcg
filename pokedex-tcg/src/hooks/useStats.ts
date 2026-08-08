import { useMemo } from 'react';
import type { CollectionStats, OwnedCard, PokedexEntry, PokemonHolding, PokemonType } from '@/types';

export function useStats(
  pokedex: PokedexEntry[],
  cards: OwnedCard[],
  holdings: Map<number, PokemonHolding>,
): CollectionStats {
  return useMemo(() => {
    const totalCards = cards.reduce((sum, c) => sum + c.quantity, 0);
    const uniqueCards = cards.length;
    const totalValue = cards.reduce((sum, c) => sum + c.unitPrice * c.quantity, 0);

    const typeCount = new Map<PokemonType, number>();
    for (const [id] of holdings) {
      const entry = pokedex.find((p) => p.id === id);
      entry?.types.forEach((t) => typeCount.set(t, (typeCount.get(t) ?? 0) + 1));
    }

    const mostVersions = [...holdings.values()]
      .sort((a, b) => b.versionCount - a.versionCount)
      .slice(0, 5)
      .map((h) => ({
        pokedexId: h.pokedexId,
        name: pokedex.find((p) => p.id === h.pokedexId)?.name ?? `#${h.pokedexId}`,
        versions: h.versionCount,
      }));

    const setTotals = new Map<string, number>();
    cards.forEach((c) => setTotals.set(c.setId, (setTotals.get(c.setId) ?? 0) + 1));

    return {
      pokemonOwned: holdings.size,
      pokemonMissing: pokedex.length - holdings.size,
      totalPokemon: pokedex.length,
      totalCards,
      uniqueCards,
      duplicates: totalCards - uniqueCards,
      totalValue,
      averageValue: totalCards ? totalValue / totalCards : 0,
      completedSets: 0, // preenchido na página de Coleções, que conhece o total de cada set
      typeBreakdown: [...typeCount.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      mostVersions,
    };
  }, [pokedex, cards, holdings]);
}
