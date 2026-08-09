// ─────────────────────────────────────────────────────────────
// HIERARQUIA DE RARIDADE
//
// A Pokémon TCG API devolve dezenas de nomes diferentes de raridade, que
// mudam a cada era ("Rare Holo EX", "Double Rare", "Special Illustration
// Rare"). Em vez de tratar cada string, classificamos por palavra-chave
// em cinco níveis — assim raridades de coleções futuras já entram no
// nível certo sem ninguém precisar atualizar uma lista.
// ─────────────────────────────────────────────────────────────

export type NivelRaridade = 1 | 2 | 3 | 4 | 5;

export interface Raridade {
  nivel: NivelRaridade;
  rotulo: string;
  /** Classes de borda e brilho aplicadas à carta no álbum. */
  moldura: string;
  cor: string;
}

const NIVEIS: Record<NivelRaridade, Omit<Raridade, 'nivel'>> = {
  5: {
    rotulo: 'Secreta',
    moldura: 'border-gold/70 shadow-[0_0_26px_-6px_rgba(255,203,5,.65)]',
    cor: 'text-gold',
  },
  4: {
    rotulo: 'Ultra',
    moldura: 'border-type-psychic/70 shadow-[0_0_24px_-8px_rgba(239,65,121,.7)]',
    cor: 'text-type-psychic',
  },
  3: {
    rotulo: 'Rara',
    moldura: 'border-type-water/60 shadow-[0_0_20px_-10px_rgba(41,128,239,.7)]',
    cor: 'text-type-water',
  },
  2: { rotulo: 'Incomum', moldura: 'border-white/12', cor: 'text-mist' },
  1: { rotulo: 'Comum', moldura: 'border-white/8', cor: 'text-mist' },
};

/** Da mais rara para a mais comum — a primeira que casar decide. */
const PADROES: [RegExp, NivelRaridade][] = [
  [/secret|hyper|rainbow|gold|special illustration|crown/i, 5],
  [/illustration rare|ultra|double rare|vmax|vstar|v-union|amazing|radiant|ace spec|shiny|prime|legend|star|full art/i, 4],
  [/\brare\b|holo|\bex\b|\bgx\b|\bv\b/i, 3],
  [/uncommon|incomum/i, 2],
];

export function classificar(raridade?: string, isHolo?: boolean): Raridade {
  const texto = raridade ?? '';
  const encontrado = PADROES.find(([re]) => re.test(texto));

  let nivel: NivelRaridade = encontrado ? encontrado[1] : 1;
  // Uma comum em versão holo ainda é mais especial que a comum lisa.
  if (nivel === 1 && isHolo) nivel = 2;

  return { nivel, ...NIVEIS[nivel] };
}

/** Nível a partir do qual a carta entra nos destaques do álbum. */
export const NIVEL_DESTAQUE: NivelRaridade = 4;

export const ROTULOS_NIVEL = ([5, 4, 3, 2, 1] as NivelRaridade[]).map((n) => ({
  nivel: n,
  ...NIVEIS[n],
}));
