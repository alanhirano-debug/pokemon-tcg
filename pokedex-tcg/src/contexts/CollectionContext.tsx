import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { loadPokedex } from '@/services/pokeapi';
import { loadUserDoc, subscribeCards, subscribeWishlist } from '@/services/collectionService';
import type { OwnedCard, PokedexEntry, PokemonHolding, UserSettings, WishlistItem } from '@/types';

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  language: 'pt-BR',
  spriteStyle: 'pixel',
  animatedSprites: true,
  currency: 'BRL',
};

interface CollectionValue {
  pokedex: PokedexEntry[];
  cards: OwnedCard[];
  wishlist: WishlistItem[];
  favoritePokemon: number[];
  settings: UserSettings;
  setSettings: (s: UserSettings) => void;
  setFavoritePokemon: (ids: number[]) => void;
  holdings: Map<number, PokemonHolding>;
  loadingDex: boolean;
  dexProgress: number;
}

const CollectionContext = createContext<CollectionValue | null>(null);

export function CollectionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [pokedex, setPokedex] = useState<PokedexEntry[]>([]);
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [favoritePokemon, setFavoritePokemon] = useState<number[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loadingDex, setLoadingDex] = useState(true);
  const [dexProgress, setDexProgress] = useState(0);

  useEffect(() => {
    let alive = true;
    loadPokedex(setDexProgress)
      .then((dex) => { if (alive) { setPokedex(dex); setLoadingDex(false); } })
      .catch(() => setLoadingDex(false));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!user) { setCards([]); setWishlist([]); return; }
    const unsubCards = subscribeCards(user.uid, setCards);
    const unsubWish = subscribeWishlist(user.uid, setWishlist);
    loadUserDoc(user.uid).then((d) => {
      if (d?.favoritePokemon) setFavoritePokemon(d.favoritePokemon);
      if (d?.settings) setSettings({ ...DEFAULT_SETTINGS, ...d.settings });
    });
    return () => { unsubCards(); unsubWish(); };
  }, [user]);

  useEffect(() => {
    document.documentElement.classList.toggle('light', settings.theme === 'light');
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  // Agregação por Pokémon. Recalcula só quando as cartas mudam.
  const holdings = useMemo(() => {
    const map = new Map<number, PokemonHolding>();
    for (const card of cards) {
      if (!card.pokedexId) continue;
      const current = map.get(card.pokedexId) ?? {
        pokedexId: card.pokedexId, owned: true, cardCount: 0,
        versionCount: 0, totalValue: 0, favorite: false,
      };
      current.cardCount += card.quantity;
      current.versionCount += 1;
      current.totalValue += card.unitPrice * card.quantity;
      current.favorite = current.favorite || card.favorite;
      map.set(card.pokedexId, current);
    }
    return map;
  }, [cards]);

  return (
    <CollectionContext.Provider
      value={{
        pokedex, cards, wishlist, favoritePokemon, settings,
        setSettings, setFavoritePokemon, holdings, loadingDex, dexProgress,
      }}
    >
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection() {
  const ctx = useContext(CollectionContext);
  if (!ctx) throw new Error('useCollection precisa estar dentro de <CollectionProvider>');
  return ctx;
}
