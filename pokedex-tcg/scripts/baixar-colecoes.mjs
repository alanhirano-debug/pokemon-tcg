// Baixa a lista de coleções e grava em src/data/colecoes.json, para ela
// entrar no pacote do app.
//
// Motivo: buscar ~170 coleções pela rede toda vez que a tela abre é o que
// travava o cadastro. Embutida, a lista aparece instantaneamente, funciona
// offline, e continua atualizada porque este script roda a cada build.
//
// O script NUNCA derruba o build: se a API não responder, mantém o arquivo
// que já existe; se nem isso existir, grava uma lista vazia e o app cai
// para a busca pela rede.

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const DESTINO = new URL('../src/data/colecoes.json', import.meta.url);
const URL_API = 'https://api.tcgdex.net/v2/pt/sets';
const TIMEOUT = 20000;
const CONCORRENCIA = 8;

const imagemSet = (base) => (base ? `${base}.webp` : '');

async function buscarJson(url) {
  const abortar = new AbortController();
  const relogio = setTimeout(() => abortar.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: abortar.signal });
    if (!res.ok) throw new Error(`API respondeu ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(relogio);
  }
}

/**
 * A lista resumida (/sets) não traz a sigla impressa no rodapé da carta
 * (ex. "DRI" para Rivais Predestinados) — isso só vem no detalhe de cada
 * coleção (/sets/{id}, campo abbreviation.official). Por isso buscamos o
 * detalhe de cada uma, em paralelo com concorrência limitada, só para
 * extrair essa sigla — o resto dos dados já vem completo na lista.
 */
async function buscarSigla(id) {
  try {
    const detalhe = await buscarJson(`${URL_API}/${id}`);
    return detalhe.abbreviation?.official;
  } catch {
    return undefined; // busca por nome ainda funciona sem a sigla
  }
}

async function baixar() {
  const brutos = await buscarJson(URL_API);

  const siglas = new Array(brutos.length);
  let indice = 0;
  async function trabalhador() {
    while (indice < brutos.length) {
      const meu = indice++;
      siglas[meu] = await buscarSigla(brutos[meu].id);
    }
  }
  await Promise.all(Array.from({ length: CONCORRENCIA }, trabalhador));

  return brutos
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
}

async function manterExistente() {
  try {
    const atual = JSON.parse(await readFile(DESTINO, 'utf8'));
    if (Array.isArray(atual) && atual.length > 0) {
      console.warn(`[coleções] Falha ao baixar. Mantendo as ${atual.length} já embutidas.`);
      return atual;
    }
  } catch {
    // arquivo ainda não existe
  }
  console.warn('[coleções] Falha ao baixar e nada em cache. O app buscará pela rede.');
  return [];
}

let colecoes;
try {
  colecoes = await baixar();
  console.log(`[coleções] ${colecoes.length} coleções embutidas no pacote.`);
} catch (err) {
  console.warn(`[coleções] ${err.message}`);
  colecoes = await manterExistente();
}

await mkdir(dirname(DESTINO.pathname), { recursive: true });
await writeFile(DESTINO, JSON.stringify(colecoes, null, 0));
