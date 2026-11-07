/**
 * Ricostruzione del testo di una pagina PDF a partire dagli elementi di testo posizionati.
 *
 * Molti manuali (come quelli Samsung) sono impaginati su due colonne: l'estrazione "riga per riga"
 * mescola le colonne e rende illeggibili le sezioni. Qui rileviamo un'eventuale colonna vuota
 * (gutter) al centro della pagina e leggiamo prima la colonna sinistra e poi la destra.
 * Funzioni pure: nessuna dipendenza da pdf.js, così si possono testare con dati sintetici.
 */

export interface PositionedText {
  str: string;
  x: number;
  /** y del PDF: cresce verso l'alto */
  y: number;
  width: number;
  height: number;
}

const LINE_TOLERANCE = 2.5;

/** Cerca la colonna vuota più larga nella fascia centrale della pagina. */
export function findGutter(items: PositionedText[], pageWidth: number): number | null {
  const bins = 200;
  const binW = pageWidth / bins;
  const coverage = new Array<number>(bins).fill(0);
  let textItems = 0;
  for (const it of items) {
    if (!it.str.trim() || it.width <= 0) continue;
    textItems++;
    const from = Math.max(0, Math.floor(it.x / binW));
    const to = Math.min(bins - 1, Math.floor((it.x + it.width) / binW));
    for (let b = from; b <= to; b++) coverage[b]++;
  }
  if (textItems < 10) return null;

  // Una colonna è "vuota" se pochissimi elementi la attraversano (titoli a tutta pagina, numeri di pagina).
  const threshold = Math.max(1, Math.round(textItems * 0.02));
  const lo = Math.floor(bins * 0.3);
  const hi = Math.ceil(bins * 0.7);
  let best: { start: number; len: number } | null = null;
  let start = -1;
  for (let b = lo; b <= hi; b++) {
    const empty = coverage[b] <= threshold;
    if (empty && start < 0) start = b;
    if ((!empty || b === hi) && start >= 0) {
      const end = empty ? b : b - 1;
      const len = end - start + 1;
      if (!best || len > best.len) best = { start, len };
      start = -1;
    }
  }
  // Serve un gutter di almeno ~1% della pagina e testo su entrambi i lati.
  if (!best || best.len < 2) return null;
  const gutter = (best.start + best.len / 2) * binW;
  const left = items.filter((i) => i.str.trim() && i.x + i.width <= gutter).length;
  const right = items.filter((i) => i.str.trim() && i.x >= gutter).length;
  if (left < textItems * 0.15 || right < textItems * 0.15) return null;
  return gutter;
}

/** Raggruppa gli elementi in righe (dall'alto in basso) e le unisce con spazi sensati. */
export function itemsToLines(items: PositionedText[]): string[] {
  const sorted = [...items].filter((i) => i.str.length > 0).sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: PositionedText[][] = [];
  for (const it of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].y - it.y) <= LINE_TOLERANCE) row.push(it);
    else rows.push([it]);
  }
  return rows
    .map((row) => {
      row.sort((a, b) => a.x - b.x);
      let line = "";
      let lastEnd = -Infinity;
      for (const it of row) {
        const gap = it.x - lastEnd;
        const charW = it.height > 0 ? it.height * 0.25 : 2;
        if (line && gap > charW && !line.endsWith(" ") && !it.str.startsWith(" ")) line += " ";
        line += it.str;
        lastEnd = it.x + it.width;
      }
      return line.replace(/\s+/g, " ").trim();
    })
    .filter((l) => l.length > 0);
}

/** Testo di una pagina, leggendo le colonne nell'ordine corretto. */
export function layoutPage(items: PositionedText[], pageWidth: number): string {
  const gutter = findGutter(items, pageWidth);
  if (gutter === null) return itemsToLines(items).join("\n");
  const left: PositionedText[] = [];
  const right: PositionedText[] = [];
  for (const it of items) {
    const center = it.x + it.width / 2;
    (center < gutter ? left : right).push(it);
  }
  return [...itemsToLines(left), ...itemsToLines(right)].join("\n");
}
