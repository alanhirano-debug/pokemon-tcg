// ─────────────────────────────────────────────────────────────
// VALIDAÇÃO DO NOME LIDO
//
// O OCR erra, e erra de um jeito perigoso: às vezes devolve uma palavra
// plausível vinda do fundo da foto ("WESSEL" saiu de uma tatuagem). Sem
// validação, isso vira uma busca inútil na API.
//
// Como o app já carrega os 1025 nomes da Pokédex, dá para exigir que a
// leitura se pareça com um Pokémon de verdade. "Bulbasaur .80" casa com
// Bulbasaur; "WESSEL" não casa com nada e é descartado.
// ─────────────────────────────────────────────────────────────

import type { PokedexEntry } from '@/types';

/** Sufixos de carta que não estão na Pokédex mas importam para a busca. */
const SUFIXOS = ['VMAX', 'VSTAR', 'V-UNION', 'EX', 'GX', 'V'];

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Distância de edição, cortada cedo quando já passou do limite. */
function distancia(a: string, b: string, limite: number): number {
  if (Math.abs(a.length - b.length) > limite) return limite + 1;

  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    let melhorNaLinha = i;

    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      const valor = Math.min(atual[j - 1] + 1, anterior[j] + 1, anterior[j - 1] + custo);
      atual.push(valor);
      melhorNaLinha = Math.min(melhorNaLinha, valor);
    }

    if (melhorNaLinha > limite) return limite + 1;
    anterior = atual;
  }

  return anterior[b.length];
}

export interface NomeResolvido {
  /** Nome do Pokémon como está na Pokédex. */
  pokemon: string;
  /** Nome para consultar na API, já com o sufixo da carta. */
  consulta: string;
  pokedexId: number;
  /** 1 = idêntico. Abaixo de 0.72 a leitura é descartada. */
  confianca: number;
}

/**
 * Tenta transformar o texto lido num Pokémon conhecido.
 * Devolve null quando nada se parece o bastante — e nesse caso é melhor
 * pedir outra foto do que mandar lixo para a API.
 */
export function resolverNome(textoLido: string, pokedex: PokedexEntry[]): NomeResolvido | null {
  const bruto = normalizar(textoLido);
  if (bruto.length < 3 || pokedex.length === 0) return null;

  let melhor: { entry: PokedexEntry; score: number } | null = null;

  for (const entry of pokedex) {
    const alvo = normalizar(entry.name);
    let score = 0;

    if (bruto === alvo) {
      score = 1;
    } else if (bruto.includes(alvo) && alvo.length >= 5) {
      // "BULBASAURPS80" contém "BULBASAUR".
      score = 0.95 - (bruto.length - alvo.length) / 100;
    } else {
      const limite = Math.max(1, Math.floor(alvo.length * 0.3));
      const d = distancia(bruto, alvo, limite);
      if (d <= limite) score = 1 - d / Math.max(bruto.length, alvo.length);
    }

    if (score > 0 && (!melhor || score > melhor.score)) {
      melhor = { entry, score };
      if (score === 1) break;
    }
  }

  if (!melhor || melhor.score < 0.72) return null;

  const sufixo = SUFIXOS.find((s) => {
    const limpo = normalizar(textoLido);
    const base = normalizar(melhor!.entry.name);
    return limpo.startsWith(base) && limpo.slice(base.length).startsWith(normalizar(s));
  });

  return {
    pokemon: melhor.entry.name,
    consulta: sufixo ? `${melhor.entry.name} ${sufixo.toLowerCase()}` : melhor.entry.name,
    pokedexId: melhor.entry.id,
    confianca: Math.round(melhor.score * 100) / 100,
  };
}
