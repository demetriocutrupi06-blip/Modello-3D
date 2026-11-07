/**
 * Testo di un PDF pagina per pagina, con la ricomposizione delle colonne (layout.ts).
 * Funziona con pdf.js sia nel browser sia in Node (nei test): riceve il documento già aperto.
 */
import { layoutPage, type PositionedText } from "./layout";

interface TextItemLike {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
}

export interface PdfPageLike {
  getViewport(opts: { scale: number }): { width: number };
  getTextContent(): Promise<{ items: unknown[] }>;
}

export interface PdfDocumentLike {
  numPages: number;
  getPage(n: number): Promise<PdfPageLike>;
}

export async function pageText(page: PdfPageLike): Promise<string> {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items: PositionedText[] = (content.items as TextItemLike[])
    .filter((it): it is Required<TextItemLike> => typeof it.str === "string" && Array.isArray(it.transform))
    // le etichette laterali ruotate (es. "03 USO DEL FORNO") non fanno parte del testo
    .filter((it) => Math.abs(it.transform[1]) < 0.01 && Math.abs(it.transform[2]) < 0.01)
    .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width, height: Math.abs(it.transform[3]) || it.height }));
  return layoutPage(items, viewport.width);
}

export async function extractPdfPages(doc: PdfDocumentLike, onProgress?: (done: number, total: number) => void) {
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    pages.push(await pageText(await doc.getPage(n)));
    onProgress?.(n, doc.numPages);
  }
  return { pages, pageCount: doc.numPages, looksScanned: looksScanned(pages) };
}

/** Un PDF con meno di ~200 caratteri per pagina è quasi certamente una scansione. */
export function looksScanned(pages: string[]): boolean {
  const chars = pages.reduce((n, p) => n + p.replace(/\s/g, "").length, 0);
  return chars / Math.max(1, pages.length) < 200;
}
