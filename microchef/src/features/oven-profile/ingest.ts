import { splitIntoSections, type ManualSectionDraft } from "@/lib/ingest/sections";

export interface UploadedFile {
  name: string;
  type: string;
  data: Buffer;
}

export type ManualSource = "pdf_text" | "pdf_ocr" | "images_ocr";

export interface ParsedManual {
  fileName: string;
  source: ManualSource;
  pageCount: number;
  sections: ManualSectionDraft[];
}

/** Dipendenze iniettabili: nei test si sostituiscono con funzioni finte. */
export interface IngestDeps {
  extractPdfPages(data: Buffer): Promise<{ pages: string[]; pageCount: number; looksScanned: boolean }>;
  transcribeScannedPdf(data: Buffer, pageCount: number): Promise<string[]>;
  ocrImages(images: Buffer[]): Promise<string[]>;
}

export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export class IngestError extends Error {}

export function classifyUpload(files: UploadedFile[]): "pdf" | "images" {
  if (files.length === 0) throw new IngestError("Nessun file caricato.");
  const total = files.reduce((n, f) => n + f.data.length, 0);
  if (total > MAX_UPLOAD_BYTES) throw new IngestError("I file superano il limite di 30 MB.");
  const pdfs = files.filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
  if (pdfs.length === 1 && files.length === 1) return "pdf";
  if (pdfs.length > 0) throw new IngestError("Carica un solo PDF, oppure solo immagini delle pagine.");
  const bad = files.find((f) => !IMAGE_TYPES.includes(f.type));
  if (bad) throw new IngestError(`Formato non supportato: ${bad.name}. Usa PDF, JPG, PNG o WEBP.`);
  return "images";
}

/** Dai file caricati al testo del manuale diviso in sezioni. */
export async function parseManual(files: UploadedFile[], deps: IngestDeps): Promise<ParsedManual> {
  const kind = classifyUpload(files);
  let pages: string[];
  let source: ManualSource;

  if (kind === "pdf") {
    const pdf = files[0];
    const extracted = await deps.extractPdfPages(pdf.data);
    if (extracted.looksScanned) {
      pages = await deps.transcribeScannedPdf(pdf.data, extracted.pageCount);
      source = "pdf_ocr";
    } else {
      pages = extracted.pages;
      source = "pdf_text";
    }
  } else {
    // le foto vanno in ordine di nome file (es. pagina-01.jpg, pagina-02.jpg)
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, "it", { numeric: true }));
    pages = await deps.ocrImages(sorted.map((f) => f.data));
    source = "images_ocr";
  }

  const sections = splitIntoSections(pages);
  if (sections.reduce((n, s) => n + s.text.length, 0) < 500) {
    throw new IngestError("Dal manuale si legge troppo poco testo. Prova con un PDF migliore o con foto più nitide.");
  }
  return {
    fileName: files.length === 1 ? files[0].name : `${files.length} immagini`,
    source,
    pageCount: pages.length,
    sections,
  };
}
