import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { loadPokedex } from '@/services/pokeapi';
import { loadUserDoc, subscribeCards, subscribeWishlist } from '@/services/collectionService';
import { FALLBACK_RATES, convert, getRates, type FxState } from '@/services/exchange';
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
  fx: FxState;
}

const CollectionContext = createContext<CollectionValue | null>(null);

export function CollectionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [pokedex, setPokedex] = useState<PokedexEntry[]>([]);
  const [rawCards, setRawCards] = useState<OwnedCard[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [favoritePokemon, setFavoritePokemon] = useState<number[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loadingDex, setLoadingDex] = useState(true);
  const [dexProgress, setDexProgress] = useState(0);
  const [fx, setFx] = useState<FxState>({ ...FALLBACK_RATES, updatedAt: 0, live: false });

  // Cotação do dia, buscada uma vez por sessão.
  useEffect(() => {
    let alive = true;
    getRates().then((r) => { if (alive) setFx(r); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    loadPokedex(setDexProgress)
      .then((dex) => { if (alive) { setPokedex(dex); setLoadingDex(false); } })
      .catch(() => setLoadingDex(false));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!user) { setRawCards([]); setWishlist([]); return; }
    const unsubCards = subscribeCards(user.uid, setRawCards);
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

  /**
   * Converte cada carta com a cotação de hoje, usando o valor original em
   * dólar/euro. Fazer isso num lugar só significa que Pokédex, detalhe,
   * coleções e estatísticas acompanham o câmbio sem saber que ele existe.
   * Cartas antigas, gravadas antes deste campo, mantêm o valor salvo.
   */
  const cards = useMemo(
    () => rawCards.map((c) =>
      c.priceOrigin && c.priceCurrency
        ? { ...c, unitPrice: convert(c.priceOrigin, c.priceCurrency, fx) }
        : c,
    ),
    [rawCards, fx],
  );

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
        setSettings, setFavoritePokemon, holdings, loadingDex, dexProgress, fx,
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
