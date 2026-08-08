// Reconhecimento de carta a partir de uma foto.
//
// Estratégia: OCR só nas duas faixas onde a informação útil sempre está —
// o nome (topo) e o número impresso (rodapé). Rodar OCR na carta inteira
// gastaria muito mais tempo e traria ruído do texto de ataques.
//
// O resultado alimenta a busca na Pokémon TCG API. É best-effort:
// quando a leitura falha, a tela cai na busca por nome digitado.

import { createWorker, type Worker } from 'tesseract.js';

let worker: Worker | null = null;

async function getWorker() {
  if (!worker) {
    worker = await createWorker('eng');
    await worker.setParameters({
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -'./",
    });
  }
  return worker;
}

/** Recorta uma faixa proporcional da imagem original. */
function crop(source: HTMLCanvasElement, x: number, y: number, w: number, h: number) {
  const out = document.createElement('canvas');
  out.width = source.width * w;
  out.height = source.height * h;
  const ctx = out.getContext('2d');
  ctx?.drawImage(
    source,
    source.width * x, source.height * y, out.width, out.height,
    0, 0, out.width, out.height,
  );
  return out;
}

export interface CardReading {
  name: string | null;
  number: string | null;
  raw: string;
}

export async function readCardText(frame: HTMLCanvasElement): Promise<CardReading> {
  const w = await getWorker();

  const nameStrip = crop(frame, 0.06, 0.03, 0.72, 0.11);
  const numberStrip = crop(frame, 0.05, 0.9, 0.45, 0.08);

  const [nameResult, numberResult] = await Promise.all([
    w.recognize(nameStrip),
    w.recognize(numberStrip),
  ]);

  const raw = `${nameResult.data.text} | ${numberResult.data.text}`;

  return {
    name: cleanName(nameResult.data.text),
    number: cleanNumber(numberResult.data.text),
    raw,
  };
}

function cleanName(text: string): string | null {
  const line = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 3)[0];
  if (!line) return null;

  // Tira HP, sufixos de estágio e lixo de OCR, mantendo "ex", "V", "VMAX"…
  const cleaned = line
    .replace(/\b\d{2,3}\s*HP\b/gi, '')
    .replace(/\b(BASIC|STAGE\s*\d|EVOLVES FROM.*)\b/gi, '')
    .replace(/[^A-Za-z0-9 .'\-]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned.length >= 3 ? cleaned : null;
}

function cleanNumber(text: string): string | null {
  // Formatos comuns: "125/197", "TG09/TG30", "SV107"
  const match = text.match(/([A-Z]{0,3}\d{1,3})\s*\/\s*[A-Z]{0,3}\d{1,3}/i);
  return match ? match[1].toUpperCase() : null;
}

export async function disposeRecognizer() {
  await worker?.terminate();
  worker = null;
}
