// ─────────────────────────────────────────────────────────────
// TCGdex — fonte principal de dados de cartas
//
// Por que trocar: a pokemontcg.io passou a fazer parte da Scrydex e vem
// devolvendo 500 de forma intermitente. Além disso ela só cataloga cartas
// em inglês — e as suas são em português, então a arte exibida nunca era
// a da carta que você tem na mão.
//
// A TCGdex é gratuita, sem chave, e o idioma vai na URL: /v2/pt/.
// A busca por número aqui é um acesso DIRETO ao recurso
// (/cards/{colecao}-{numero}), não uma consulta com sintaxe de busca —
// bem menos frágil que o modelo anterior.
//
// As funções devolvem exatamente o mesmo formato que o app já consome,
// então nenhuma tela precisou mudar.
// ─────────────────────────────────────────────────────────────

import { get, set as idbSet } from 'idb-keyval';
import type { TcgSet } from '@/types';
import type { TcgCard } from './tcgapi';
import colecoesEmbutidas from '@/data/colecoes.json';

const IDIOMA = 'pt';
const BASE = `https://api.tcgdex.net/v2/${IDIOMA}`;
const TIMEOUT_MS = 12000;

const CACHE_SETS = 'tcgdex-sets-v1';
const CACHE_TTL = 1000 * 60 * 60 * 24 * 7;

/** Formato bruto devolvido pela API. Campos opcionais são frequentes. */
interface DexCard {
  id: string;
  localId: string | number;
  name: string;
  image?: string;
  category?: string;
  rarity?: string;
  illustrator?: string;
  hp?: number;
  types?: string[];
  dexId?: number[];
  set?: DexSet;
}

interface DexSet {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  releaseDate?: string;
  serie?: { id: string; name: string };
  cardCount?: { official?: number; total?: number };
  /** Sigla impressa no rodapé da carta (ex. "DRI") — só vem no detalhe do set. */
  abbreviation?: { official?: string };
}

async function buscar<T>(caminho: string): Promise<T> {
  const abortar = new AbortController();
  const relogio = setTimeout(() => abortar.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE}${caminho}`, { signal: abortar.signal });
    if (res.status === 404) throw new Error('NAO_ENCONTRADO');
    if (!res.ok) throw new Error(`TCGdex respondeu ${res.status}.`);
    return (await res.json()) as T;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('A API de cartas demorou demais para responder.');
    }
    throw err;
  } finally {
    clearTimeout(relogio);
  }
}

/**
 * Imagens vêm como URL base, sem extensão. Cartas pedem qualidade +
 * extensão (/high.webp); logos e símbolos pedem só a extensão (.webp).
 */
const imagemCarta = (base: string | undefined, qualidade: 'high' | 'low') =>
  base ? `${base}/${qualidade}.webp` : '';

const imagemSet = (base?: string) => (base ? `${base}.webp` : '');

/** Converte para o formato que o app já consome. */
function adaptarCarta(card: DexCard): TcgCard {
  const total = card.set?.cardCount?.official ?? card.set?.cardCount?.total ?? 0;

  return {
    id: card.id,
    name: card.name,
    number: String(card.localId),
    rarity: card.rarity,
    artist: card.illustrator,
    hp: card.hp != null ? String(card.hp) : undefined,
    types: card.types,
    images: {
      small: imagemCarta(card.image, 'low'),
      large: imagemCarta(card.image, 'high'),
    },
    set: {
      id: card.set?.id ?? '',
      name: card.set?.name ?? '',
      series: card.set?.serie?.name ?? '',
      printedTotal: total,
      total,
      releaseDate: card.set?.releaseDate ?? '',
      images: { symbol: imagemSet(card.set?.symbol), logo: imagemSet(card.set?.logo) },
    },
    nationalPokedexNumbers: card.dexId,
  };
}

/**
 * Identificação exata: coleção + número impresso.
 * O id de uma carta na TCGdex é {coleção}-{número}, então isto é uma
 * leitura direta — sem consulta, sem sintaxe, sem erro 500.
 */
export async function buscarPorNumero(setId: string, numero: string): Promise<TcgCard[]> {
  const limpo = numero.trim().replace(/^0+(?=\d)/, '');
  if (!setId || !limpo) return [];

  try {
    const card = await buscar<DexCard>(`/cards/${setId}-${limpo}`);
    return [adaptarCarta(card)];
  } catch (err: any) {
    if (err?.message === 'NAO_ENCONTRADO') return [];
    throw err;
  }
}

/** Todas as cartas de uma coleção — usado para buscar pelo nome dentro dela. */
export async function cartasDaColecao(setId: string): Promise<TcgCard[]> {
  const dados = await buscar<DexSet & { cards?: DexCard[] }>(`/sets/${setId}`);
  const cards = dados.cards ?? [];
  // A lista resumida não traz os dados da coleção em cada carta.
  return cards.map((c) => adaptarCarta({ ...c, set: dados }));
}

/**
 * Lista de coleções.
 *
 * Ordem de prioridade, da mais rápida para a mais lenta:
 *   1. Lista embutida no pacote (scripts/baixar-colecoes.mjs) — instantânea
 *   2. Cache local de uma busca anterior
 *   3. Rede
 *
 * Como a lista embutida é regravada a cada build, ela só fica velha se
 * você passar meses sem publicar — e mesmo assim a atualização em segundo
 * plano corrige na primeira abertura com internet.
 */
export async function listarColecoes(): Promise<TcgSet[]> {
  const embutidas = colecoesEmbutidas as TcgSet[];

  if (embutidas.length > 0) {
    atualizarEmSegundoPlano();
    return embutidas;
  }

  const cache = await get<{ at: number; sets: TcgSet[] }>(CACHE_SETS);
  if (cache?.sets.length) {
    atualizarEmSegundoPlano();
    return cache.sets;
  }

  return baixarColecoes();
}

/** Busca coleções novas sem segurar a tela. Falha em silêncio de propósito. */
function atualizarEmSegundoPlano() {
  get<{ at: number }>(CACHE_SETS).then((cache) => {
    if (cache && Date.now() - cache.at < CACHE_TTL) return;
    baixarColecoes().catch(() => undefined);
  });
}

/**
 * A lista resumida (/sets) não traz a sigla impressa no rodapé da carta
 * (ex. "DRI") — só o detalhe de cada set tem isso (abbreviation.official).
 * Este é o caminho de rede, usado só quando a lista embutida no pacote e o
 * cache local falharam — por isso vale buscar as siglas mesmo custando uma
 * chamada extra por coleção, com concorrência limitada.
 */
async function buscarSigla(id: string): Promise<string | undefined> {
  try {
    const detalhe = await buscar<DexSet>(`/sets/${id}`);
    return detalhe.abbreviation?.official;
  } catch {
    return undefined;
  }
}

async function baixarColecoes(): Promise<TcgSet[]> {
  const brutos = await buscar<DexSet[]>('/sets');

  const CONCORRENCIA = 8;
  const siglas: (string | undefined)[] = new Array(brutos.length);
  let indice = 0;
  async function trabalhador() {
    while (indice < brutos.length) {
      const meu = indice++;
      siglas[meu] = await buscarSigla(brutos[meu].id);
    }
  }
  await Promise.all(Array.from({ length: CONCORRENCIA }, trabalhador));

  const sets: TcgSet[] = brutos
    .map((s, i) => ({
      id: s.id,
      name: s.name,
      series: s.serie?.name ?? '',
      ptcgoCode: siglas[i],
      total: s.cardCount?.total ?? s.cardCount?.official ?? 0,
      printedTotal: s.cardCount?.official ?? s.cardCount?.total ?? 0,
      releaseDate: s.releaseDate ?? '',
      logo: imagemSet(s.logo),
      symbol: imagemSet(s.symbol),
    }))
    .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));

  await idbSet(CACHE_SETS, { at: Date.now(), sets });
  return sets;
}
