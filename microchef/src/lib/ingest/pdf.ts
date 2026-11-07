import pdfParse from "pdf-parse";
import { layoutPage, type PositionedText } from "./layout";

export interface PdfPages {
  pages: string[];
  pageCount: number;
  /** true se il PDF sembra una scansione (quasi nessun testo estraibile) */
  looksScanned: boolean;
}

interface PdfJsTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

interface PdfJsPage {
  pageIndex: number;
  getViewport(scale: number): { width: number };
  getTextContent(opts: Record<string, boolean>): Promise<{ items: PdfJsTextItem[] }>;
}

/** Estrae il testo pagina per pagina con pdf-parse, ricomponendo le colonne. */
export async function extractPdfPages(data: Buffer): Promise<PdfPages> {
  const pages: string[] = [];
  const result = await pdfParse(data, {
    pagerender: async (page: PdfJsPage) => {
      const viewport = page.getViewport(1);
      const content = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
      const items: PositionedText[] = content.items
        // Le etichette laterali ruotate (es. "03 USO DEL FORNO") non fanno parte del testo.
        .filter((it) => Math.abs(it.transform[1]) < 0.01 && Math.abs(it.transform[2]) < 0.01)
        .map((it) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        width: it.width,
        height: Math.abs(it.transform[3]) || it.height,
      }));
      const text = layoutPage(items, viewport.width);
      pages[page.pageIndex] = text;
      return text;
    },
  } as unknown as Parameters<typeof pdfParse>[1]);

  const filled = Array.from({ length: result.numpages }, (_, i) => pages[i] ?? "");
  const chars = filled.reduce((n, p) => n + p.replace(/\s/g, "").length, 0);
  return { pages: filled, pageCount: result.numpages, looksScanned: chars / Math.max(1, result.numpages) < 200 };
}
