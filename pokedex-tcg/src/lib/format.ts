export const brl = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export const dexNumber = (id: number) => String(id).padStart(3, '0');

export const pct = (part: number, total: number) =>
  total ? Math.round((part / total) * 1000) / 10 : 0;

export const CONDITION_LABEL: Record<string, string> = {
  M: 'Mint', NM: 'Near Mint', EX: 'Excelente', GD: 'Boa',
  LP: 'Pouco jogada', PL: 'Jogada', DMG: 'Danificada',
};

export const LANGUAGE_LABEL: Record<string, string> = {
  PT: 'Português', EN: 'Inglês', JP: 'Japonês', ES: 'Espanhol',
  FR: 'Francês', DE: 'Alemão', IT: 'Italiano',
};

export const TYPE_LABEL: Record<string, string> = {
  normal: 'Normal', fire: 'Fogo', water: 'Água', electric: 'Elétrico',
  grass: 'Planta', ice: 'Gelo', fighting: 'Lutador', poison: 'Venenoso',
  ground: 'Terrestre', flying: 'Voador', psychic: 'Psíquico', bug: 'Inseto',
  rock: 'Pedra', ghost: 'Fantasma', dragon: 'Dragão', dark: 'Sombrio',
  steel: 'Metálico', fairy: 'Fada',
};
