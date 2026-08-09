// ─────────────────────────────────────────────────────────────
// Tipos de domínio. Tudo que trafega entre serviços, hooks e UI
// passa por aqui — nenhum componente conhece o formato bruto das APIs.
// ─────────────────────────────────────────────────────────────

export type PokemonType =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic'
  | 'bug' | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

export type Region =
  | 'Kanto' | 'Johto' | 'Hoenn' | 'Sinnoh' | 'Unova'
  | 'Kalos' | 'Alola' | 'Galar' | 'Hisui' | 'Paldea';

/** Entrada da Pokédex nacional. Vem da PokéAPI e é cacheada localmente. */
export interface PokedexEntry {
  id: number;              // número nacional
  slug: string;            // 'charizard', 'mr-mime' — chave para sprites
  name: string;            // nome exibido
  types: PokemonType[];
  generation: number;      // 1..9
  region: Region;
  isLegendary: boolean;
  isMythical: boolean;
  isBaby: boolean;
  heightM: number;
  weightKg: number;
  genus: string;           // "Pokémon Chama"
}

export type CardCondition = 'M' | 'NM' | 'EX' | 'GD' | 'LP' | 'PL' | 'DMG';
export type CardLanguage = 'PT' | 'EN' | 'JP' | 'ES' | 'FR' | 'DE' | 'IT';

/** Uma carta física que o usuário possui. Documento em users/{uid}/cards/{id}. */
export interface OwnedCard {
  id: string;
  tcgId: string;           // id na Pokémon TCG API, ex. 'sv3-125'
  pokedexId: number;       // liga a carta ao Pokémon da Pokédex
  name: string;
  setId: string;
  setName: string;
  number: string;          // '125/197'
  rarity: string;
  imageSmall: string;
  imageLarge: string;
  artist?: string;
  hp?: string;
  types?: PokemonType[];
  releaseDate?: string;

  // Dados do exemplar (do usuário, não da API)
  quantity: number;
  condition: CardCondition;
  language: CardLanguage;
  isHolo: boolean;
  isReverse: boolean;
  isFirstEdition: boolean;
  notes?: string;

  // Preço em BRL — recalculado na exibição com a cotação do dia.
  unitPrice: number;
  priceUpdatedAt: number;
  /** Valor original da API, na moeda dela. Guardar isto é o que permite
   *  reconverter a coleção inteira quando o câmbio muda. */
  priceOrigin?: number;
  priceCurrency?: 'USD' | 'EUR';

  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Coleção/expansão (set) da Pokémon TCG API. */
export interface TcgSet {
  id: string;
  name: string;
  series: string;
  total: number;
  printedTotal: number;
  releaseDate: string;
  logo: string;
  symbol: string;
}

export interface WishlistItem {
  id: string;
  tcgId: string;
  pokedexId: number;
  name: string;
  setName: string;
  number: string;
  imageSmall: string;
  targetPrice?: number;
  createdAt: number;
}

/** Resultado agregado por Pokémon — calculado, nunca persistido. */
export interface PokemonHolding {
  pokedexId: number;
  owned: boolean;
  cardCount: number;      // somando quantidades
  versionCount: number;   // cartas distintas
  totalValue: number;
  favorite: boolean;
}

export interface CollectionStats {
  pokemonOwned: number;
  pokemonMissing: number;
  totalPokemon: number;
  totalCards: number;
  uniqueCards: number;
  duplicates: number;
  totalValue: number;
  averageValue: number;
  completedSets: number;
  typeBreakdown: { type: PokemonType; count: number }[];
  mostVersions: { pokedexId: number; name: string; versions: number }[];
}

export type SpriteStyle = 'pixel' | 'artwork';

export interface UserSettings {
  theme: 'dark' | 'light';
  language: 'pt-BR' | 'en';
  spriteStyle: SpriteStyle;
  animatedSprites: boolean;
  currency: 'BRL' | 'USD';
}
