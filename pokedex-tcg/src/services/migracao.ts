// ─────────────────────────────────────────────────────────────
// MIGRAÇÃO: pokemontcg.io → TCGdex
//
// As cartas cadastradas na fonte antiga guardaram identificadores de
// coleção no padrão dela. Em vez de adivinhar a correspondência aqui,
// esta rotina roda no navegador — onde consegue consultar a TCGdex e
// CONFERIR cada carta antes de gravar.
//
// Nada é sobrescrito às cegas: uma carta que não resolver fica exatamente
// como está e entra no relatório final. Quantidade, condição, idioma,
// valor digitado e favoritos nunca são tocados.
// ─────────────────────────────────────────────────────────────

import { updateCard } from './collectionService';
import type { OwnedCard } from '@/types';

const BASE = 'https://api.tcgdex.net/v2';

export interface FalhaMigracao {
  carta: string;
  colecao: string;
  motivo: string;
}

export interface ResultadoMigracao {
  total: number;
  migradas: number;
  jaCorretas: number;
  falhas: FalhaMigracao[];
}

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const soData = (s?: string) => (s ?? '').replace(/\//g, '-').slice(0, 10);

async function json<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface DexSet {
  id: string;
  name: string;
  releaseDate?: string;
  cardCount?: { official?: number; total?: number };
}

/**
 * Correspondência entre as coleções antigas e as da TCGdex.
 * Usa a lista em INGLÊS porque os nomes gravados vieram da fonte antiga,
 * que só cataloga em inglês. O id resultante vale para qualquer idioma.
 */
async function mapearColecoes(cards: OwnedCard[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const sets = await json<DexSet[]>(`${BASE}/en/sets`);
  if (!sets) return mapa;

  const antigas = new Map<string, OwnedCard>();
  cards.forEach((c) => { if (!antigas.has(c.setId)) antigas.set(c.setId, c); });

  for (const [setIdAntigo, exemplo] of antigas) {
    // 1. O id já é o mesmo nas duas fontes.
    let alvo = sets.find((s) => s.id === setIdAntigo);

    // 2. Mesmo nome.
    if (!alvo) alvo = sets.find((s) => normalizar(s.name) === normalizar(exemplo.setName));

    // 3. Mesma data de lançamento — chave forte quando o nome difere.
    if (!alvo && exemplo.releaseDate) {
      alvo = sets.find((s) => soData(s.releaseDate) === soData(exemplo.releaseDate));
    }

    if (alvo) mapa.set(setIdAntigo, alvo.id);
  }

  return mapa;
}

interface DexCard {
  id: string;
  localId: string | number;
  name: string;
  image?: string;
  rarity?: string;
  dexId?: number[];
  set?: { id: string; name: string; cardCount?: { official?: number; total?: number } };
}

/** Número local a partir de "22/94". */
const numeroLocal = (numero: string) => numero.split('/')[0].trim();

/**
 * Coleções mais antigas não têm zero à esquerda no número ("1"), enquanto
 * coleções recentes mantêm ("001", "070") — igual ao que já tratamos em
 * `buscarPorNumero` (tcgdex.ts). Sem isso, uma carta "070/132" virava
 * "70" aqui e a busca direta (que não aceita variação) sempre falhava com
 * "não encontrada", mesmo a carta já estando com o setId certo.
 */
async function buscarCartaMigracao(setId: string, numero: string): Promise<DexCard | null> {
  const digitado = numero.trim();
  const tentativas = [digitado];
  if (/^\d+$/.test(digitado)) {
    const semZeros = digitado.replace(/^0+(?=\d)/, '');
    tentativas.push(semZeros, semZeros.padStart(2, '0'), semZeros.padStart(3, '0'), semZeros.padStart(4, '0'));
  }

  for (const tentativa of new Set(tentativas)) {
    // Português primeiro; se a carta não existir em PT, cai para o inglês.
    const dados =
      (await json<DexCard>(`${BASE}/pt/cards/${setId}-${tentativa}`)) ??
      (await json<DexCard>(`${BASE}/en/cards/${setId}-${tentativa}`));
    if (dados) return dados;
  }
  return null;
}

export async function migrarParaTcgdex(
  uid: string,
  cards: OwnedCard[],
  onProgresso?: (feitas: number, total: number) => void,
): Promise<ResultadoMigracao> {
  const mapa = await mapearColecoes(cards);
  const resultado: ResultadoMigracao = {
    total: cards.length, migradas: 0, jaCorretas: 0, falhas: [],
  };

  for (const [indice, carta] of cards.entries()) {
    onProgresso?.(indice, cards.length);

    const novoSetId = mapa.get(carta.setId);
    if (!novoSetId) {
      resultado.falhas.push({
        carta: carta.name,
        colecao: carta.setName,
        motivo: 'Coleção não encontrada na TCGdex',
      });
      continue;
    }

    const dados = await buscarCartaMigracao(novoSetId, numeroLocal(carta.number));

    if (!dados) {
      resultado.falhas.push({
        carta: carta.name,
        colecao: carta.setName,
        motivo: `Carta ${novoSetId}-${numeroLocal(carta.number)} não encontrada`,
      });
      continue;
    }

    const total = dados.set?.cardCount?.official ?? dados.set?.cardCount?.total ?? 0;

    await updateCard(uid, carta.id, {
      tcgId: dados.id,
      setId: dados.set?.id ?? novoSetId,
      setName: dados.set?.name ?? carta.setName,
      name: dados.name,
      number: total ? `${dados.localId}/${total}` : String(dados.localId),
      rarity: dados.rarity ?? carta.rarity,
      imageSmall: dados.image ? `${dados.image}/low.webp` : carta.imageSmall,
      imageLarge: dados.image ? `${dados.image}/high.webp` : carta.imageLarge,
      // A busca antiga (pokemontcg.io) e alguns caminhos já corrigidos
      // nesta mesma sessão podiam gravar a carta sem o vínculo com a
      // Pokédex (pokedexId 0). Como já buscamos o card completo aqui,
      // aproveitamos para também curar isso.
      pokedexId: dados.dexId?.[0] ?? carta.pokedexId,
    });

    if (carta.tcgId === dados.id && carta.imageSmall.includes('tcgdex')) resultado.jaCorretas += 1;
    else resultado.migradas += 1;

    // Respiro entre requisições — 43 cartas não justificam rajada.
    await new Promise((r) => setTimeout(r, 80));
  }

  onProgresso?.(cards.length, cards.length);
  return resultado;
}

