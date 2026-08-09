// ─────────────────────────────────────────────────────────────
// SPRITES 2D
//
// Regra do projeto: a Pokédex usa SOMENTE sprites 2D. Nenhum render 3D.
// Por isso as fontes abaixo são fixas e o conjunto `other/home` da
// PokéAPI (renders 3D do Pokémon HOME) está explicitamente banido.
//
// Cadeia de fallback (a primeira que carregar vence):
//
//   pixel (padrão)
//     1. Showdown animado .......... GIF pixel art, cobre gen 1–9
//     2. Showdown estático ......... PNG pixel art
//     3. Black/White ............... pixel art original dos jogos (nº 1–649)
//     4. PokéSprite (box icon) ..... ícone pixel de caixa, cobre até gen 9
//     5. front_default ............. último recurso
//
//   artwork
//     1. Official artwork .......... ilustração 2D estilo Sugimori (1–1025)
//     2. cai para a cadeia pixel
//
// Todas as fontes são estáticas e versionadas — o service worker faz
// CacheFirst nelas (ver vite.config.ts), então a Pokédex abre offline.
// ─────────────────────────────────────────────────────────────

import type { SpriteStyle } from '@/types';

const POKEAPI_SPRITES =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

const POKESPRITE =
  'https://cdn.jsdelivr.net/gh/msikma/pokesprite@master/pokemon-gen8';

/** Fontes 2D disponíveis, em pixel art. */
export const Sprite2D = {
  showdownAnimated: (id: number) => `${POKEAPI_SPRITES}/other/showdown/${id}.gif`,
  showdownShiny: (id: number) => `${POKEAPI_SPRITES}/other/showdown/shiny/${id}.gif`,
  blackWhite: (id: number) =>
    `${POKEAPI_SPRITES}/versions/generation-v/black-white/${id}.png`,
  blackWhiteAnimated: (id: number) =>
    `${POKEAPI_SPRITES}/versions/generation-v/black-white/animated/${id}.gif`,
  boxIcon: (slug: string) => `${POKESPRITE}/regular/${slug}.png`,
  boxIconShiny: (slug: string) => `${POKESPRITE}/shiny/${slug}.png`,
  frontDefault: (id: number) => `${POKEAPI_SPRITES}/${id}.png`,
  officialArtwork: (id: number) =>
    `${POKEAPI_SPRITES}/other/official-artwork/${id}.png`,
} as const;

interface SpriteRequest {
  id: number;
  slug: string;
  style?: SpriteStyle;
  animated?: boolean;
  shiny?: boolean;
}

/**
 * Devolve a cadeia de URLs para um Pokémon, da melhor para a mais tolerante.
 * O componente <PokemonSprite /> desce a lista no onError.
 */
export function spriteChain({
  id,
  slug,
  style = 'pixel',
  animated = true,
  shiny = false,
}: SpriteRequest): string[] {
  const pixel = shiny
    ? [
        animated && Sprite2D.showdownShiny(id),
        Sprite2D.boxIconShiny(slug),
        Sprite2D.showdownAnimated(id),
      ]
    : [
        animated && Sprite2D.showdownAnimated(id),
        Sprite2D.blackWhite(id),
        Sprite2D.boxIcon(slug),
        Sprite2D.frontDefault(id),
      ];

  const chain = style === 'artwork'
    ? [Sprite2D.officialArtwork(id), ...pixel]
    : pixel;

  return chain.filter((u): u is string => Boolean(u));
}

/**
 * PokéSprite usa slugs próprios em alguns casos.
 * A PokéAPI diz 'mr-mime', o PokéSprite diz 'mr-mime' também — mas
 * formas regionais e nomes com pontuação divergem. Normalizamos aqui.
 */
export function toSpriteSlug(apiName: string): string {
  const overrides: Record<string, string> = {
    'nidoran-f': 'nidoran-f',
    'nidoran-m': 'nidoran-m',
    'farfetchd': 'farfetchd',
    'mr-mime': 'mr-mime',
    'mime-jr': 'mime-jr',
    'ho-oh': 'ho-oh',
    'porygon-z': 'porygon-z',
    'jangmo-o': 'jangmo-o',
    'hakamo-o': 'hakamo-o',
    'kommo-o': 'kommo-o',
    'type-null': 'type-null',
    'tapu-koko': 'tapu-koko',
    'flabebe': 'flabebe',
    'deoxys-normal': 'deoxys',
    'wormadam-plant': 'wormadam',
    'giratina-altered': 'giratina',
    'shaymin-land': 'shaymin',
    'basculin-red-striped': 'basculin',
    'darmanitan-standard': 'darmanitan',
    'tornadus-incarnate': 'tornadus',
    'thundurus-incarnate': 'thundurus',
    'landorus-incarnate': 'landorus',
    'keldeo-ordinary': 'keldeo',
    'meloetta-aria': 'meloetta',
    'meowstic-male': 'meowstic',
    'aegislash-shield': 'aegislash',
    'pumpkaboo-average': 'pumpkaboo',
    'gourgeist-average': 'gourgeist',
    'zygarde-50': 'zygarde',
    'oricorio-baile': 'oricorio',
    'lycanroc-midday': 'lycanroc',
    'wishiwashi-solo': 'wishiwashi',
    'minior-red-meteor': 'minior',
    'mimikyu-disguised': 'mimikyu',
    'toxtricity-amped': 'toxtricity',
    'eiscue-ice': 'eiscue',
    'indeedee-male': 'indeedee',
    'morpeko-full-belly': 'morpeko',
    'urshifu-single-strike': 'urshifu',
    'basculegion-male': 'basculegion',
    'enamorus-incarnate': 'enamorus',
    'oinkologne-male': 'oinkologne',
    'maushold-family-of-four': 'maushold',
    'squawkabilly-green-plumage': 'squawkabilly',
    'palafin-zero': 'palafin',
    'tatsugiri-curly': 'tatsugiri',
    'dudunsparce-two-segment': 'dudunsparce',
  };

  return overrides[apiName] ?? apiName.replace(/[.'’:]/g, '').toLowerCase();
}

/** Item do carrossel de sprites nas configurações. */
export const SPRITE_STYLE_OPTIONS: {
  value: SpriteStyle;
  label: string;
  hint: string;
  preview: (id: number, slug: string) => string;
}[] = [
  {
    value: 'pixel',
    label: 'Pixel art',
    hint: 'Sprites 2D dos jogos, animados quando existem.',
    preview: (id) => Sprite2D.showdownAnimated(id),
  },
  {
    value: 'artwork',
    label: 'Ilustração',
    hint: 'Arte oficial 2D, mesma dos cards da Pokédex.',
    preview: (id) => Sprite2D.officialArtwork(id),
  },
];
