// Exportação e backup. Tudo roda no navegador — nada sai para servidor.

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { OwnedCard } from '@/types';
import { CONDITION_LABEL, LANGUAGE_LABEL, brl } from '@/lib/format';

function rows(cards: OwnedCard[]) {
  return cards.map((c) => ({
    Pokémon: c.name,
    Coleção: c.setName,
    Número: c.number,
    Raridade: c.rarity,
    Idioma: LANGUAGE_LABEL[c.language],
    Condição: CONDITION_LABEL[c.condition],
    Holo: c.isHolo ? 'Sim' : 'Não',
    Reverse: c.isReverse ? 'Sim' : 'Não',
    Quantidade: c.quantity,
    'Preço unitário': c.unitPrice,
    'Preço total': c.unitPrice * c.quantity,
  }));
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function exportCSV(cards: OwnedCard[]) {
  const csv = Papa.unparse(rows(cards));
  download(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), `colecao-${stamp()}.csv`);
}

export function exportXLSX(cards: OwnedCard[]) {
  const sheet = XLSX.utils.json_to_sheet(rows(cards));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Coleção');
  XLSX.writeFile(book, `colecao-${stamp()}.xlsx`);
}

export function exportPDF(cards: OwnedCard[]) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const total = cards.reduce((s, c) => s + c.unitPrice * c.quantity, 0);

  doc.setFontSize(16);
  doc.text('Minha coleção Pokémon TCG', 14, 16);
  doc.setFontSize(10);
  doc.text(`${cards.length} registros · valor total ${brl(total)}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [Object.keys(rows(cards)[0] ?? {})],
    body: rows(cards).map((r) => Object.values(r).map(String)),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [238, 21, 21] },
  });

  doc.save(`colecao-${stamp()}.pdf`);
}

/** Backup completo em JSON — serve para reimportar em outra conta. */
export function exportBackup(cards: OwnedCard[]) {
  const payload = { version: 1, exportedAt: new Date().toISOString(), cards };
  download(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `backup-${stamp()}.json`);
}

export async function readBackup(file: File): Promise<Omit<OwnedCard, 'id'>[]> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed?.cards)) throw new Error('Arquivo de backup inválido.');
  return parsed.cards.map(({ id: _id, ...rest }: OwnedCard) => rest);
}
