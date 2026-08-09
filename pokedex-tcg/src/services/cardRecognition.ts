// ─────────────────────────────────────────────────────────────
// RECONHECIMENTO DE CARTA
//
// Duas entradas: um frame da câmera (com moldura de alinhamento) ou uma
// foto da galeria (sem moldura, carta em qualquer lugar da imagem).
//
// O OCR lê apenas duas faixas: o nome, no topo, e o número impresso, no
// rodapé. Ler a carta inteira seria lento e traria o ruído do texto de
// ataques — que em cartas em português tem palavras longas o suficiente
// para confundir a detecção do nome.
// ─────────────────────────────────────────────────────────────

import { createWorker, type Worker } from 'tesseract.js';

let worker: Worker | null = null;

async function getWorker() {
  if (!worker) {
    // Português + inglês: nomes de Pokémon são iguais nos dois idiomas,
    // mas o resto da carta (BÁSICO, PS, Fraqueza) muda, e o modelo só em
    // inglês erra os acentos com frequência.
    worker = await createWorker(['por', 'eng']);
    await worker.setParameters({
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" +
        "ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç" +
        "0123456789 -'./",
    });
  }
  return worker;
}

/** Retângulo em proporções de 0 a 1. */
export interface Rect { x: number; y: number; w: number; h: number }

/** A imagem inteira, quando ela já é só a carta. */
export const FULL_FRAME: Rect = { x: 0, y: 0, w: 1, h: 1 };

/**
 * Faixas dentro da CARTA — não do frame. Este era o bug: as proporções
 * antigas eram relativas à imagem inteira, então numa foto em que a carta
 * ocupa metade do quadro o OCR lia o fundo.
 */
const NAME_STRIP: Rect = { x: 0.08, y: 0.025, w: 0.66, h: 0.075 };
const NUMBER_STRIP: Rect = { x: 0.04, y: 0.875, w: 0.42, h: 0.075 };

function subRect(outer: Rect, inner: Rect): Rect {
  return {
    x: outer.x + inner.x * outer.w,
    y: outer.y + inner.y * outer.h,
    w: inner.w * outer.w,
    h: inner.h * outer.h,
  };
}

/**
 * Recorta e prepara a faixa para o OCR: amplia até uma altura mínima
 * (texto pequeno de celular fica ilegível sem isso), converte para tons
 * de cinza e aumenta o contraste. Cartas holo e fundos coloridos derrubam
 * a taxa de acerto sem esse tratamento.
 */
function extract(source: CanvasImageSource, sw: number, sh: number, rect: Rect): HTMLCanvasElement {
  const cropW = Math.max(1, sw * rect.w);
  const cropH = Math.max(1, sh * rect.h);

  const scale = Math.max(1, Math.min(4, 120 / cropH));
  const out = document.createElement('canvas');
  out.width = Math.round(cropW * scale);
  out.height = Math.round(cropH * scale);

  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return out;

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, sw * rect.x, sh * rect.y, cropW, cropH, 0, 0, out.width, out.height);

  const image = ctx.getImageData(0, 0, out.width, out.height);
  const px = image.data;
  for (let i = 0; i < px.length; i += 4) {
    const gray = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
    const boosted = Math.max(0, Math.min(255, (gray - 128) * 1.7 + 128));
    px[i] = px[i + 1] = px[i + 2] = boosted;
  }
  ctx.putImageData(image, 0, 0);

  return out;
}

export interface CardReading {
  name: string | null;
  number: string | null;
  raw: string;
}

/**
 * @param cardRect Onde a carta está dentro da imagem, em proporções.
 *                 A câmera passa a área da moldura de alinhamento;
 *                 a foto da galeria passa o quadro inteiro.
 */
export async function readCardText(
  source: HTMLCanvasElement,
  cardRect: Rect = FULL_FRAME,
): Promise<CardReading> {
  const w = await getWorker();
  const { width, height } = source;

  const nameCanvas = extract(source, width, height, subRect(cardRect, NAME_STRIP));
  const numberCanvas = extract(source, width, height, subRect(cardRect, NUMBER_STRIP));

  const [nameResult, numberResult] = await Promise.all([
    w.recognize(nameCanvas),
    w.recognize(numberCanvas),
  ]);

  const nameText = nameResult.data.text;
  const numberText = numberResult.data.text;

  const reading: CardReading = {
    name: cleanName(nameText),
    number: cleanNumber(numberText),
    raw: `nome: ${nameText.trim()} | número: ${numberText.trim()}`,
  };

  // Faixa errada por enquadramento torto: tenta a carta inteira.
  if (!reading.name) return readWholeCard(source);

  return reading;
}

/** Último recurso: OCR na imagem toda, procurando nome e padrão NNN/NNN. */
export async function readWholeCard(source: HTMLCanvasElement): Promise<CardReading> {
  const w = await getWorker();
  const prepared = extract(source, source.width, source.height, FULL_FRAME);
  const { data } = await w.recognize(prepared);

  const nameLine = data.text
    .split('\n')
    .map(cleanName)
    .find((l): l is string => Boolean(l)) ?? null;

  return { name: nameLine, number: cleanNumber(data.text), raw: data.text };
}

const RUIDO = [
  /\bB[ÁA]SICO\b/gi,           // pt
  /\bEST[ÁA]GIO\s*\d\b/gi,     // pt
  /\bBASIC\b/gi,               // en
  /\bSTAGE\s*\d\b/gi,          // en
  /\bEVOLUI\s*DE\b.*/gi,       // pt
  /\bEVOLVES FROM\b.*/gi,      // en
];

function cleanName(text: string): string | null {
  const line = text.split('\n').map((l) => l.trim()).filter((l) => l.length >= 3)[0];
  if (!line) return null;

  let cleaned = line;

  // Pontos de vida: HP em inglês, PS em português. O PS faltava —
  // "Bulbasaur PS80" ia inteiro para a API como nome e não achava nada.
  cleaned = cleaned.replace(/\b(PS|HP)\s*\d{2,3}\b/gi, '');
  cleaned = cleaned.replace(/\b\d{2,3}\s*(PS|HP)\b/gi, '');

  RUIDO.forEach((re) => { cleaned = cleaned.replace(re, ''); });

  cleaned = cleaned
    .replace(/[^A-Za-zÀ-ÿ0-9 .'\-]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned.length >= 3 ? cleaned : null;
}

function cleanNumber(text: string): string | null {
  // Formatos: "001/132", "125/197", "TG09/TG30", "SV107/SV122".
  const match = text.match(/\b([A-Z]{0,3}\d{1,3})\s*[\/\|]\s*[A-Z]{0,3}\d{1,3}\b/i);
  if (!match) return null;
  // A API não usa zeros à esquerda: 001 precisa virar 1.
  return match[1].toUpperCase().replace(/^0+(?=\d)/, '');
}

export async function disposeRecognizer() {
  await worker?.terminate();
  worker = null;
}
