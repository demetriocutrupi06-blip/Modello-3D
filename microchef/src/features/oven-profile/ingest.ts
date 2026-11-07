import { splitIntoSections, type ManualSectionDraft } from "@/lib/ingest/sections";

export interface UploadedFile {
  name: string;
  type: string;
  size: number;
}

export type ManualSource = "pdf_text" | "pdf_ocr" | "images_ocr";

export interface ParsedManual {
  fileName: string;
  source: ManualSource;
  pageCount: number;
  sections: ManualSectionDraft[];
}

export const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export class IngestError extends Error {}

export function classifyUpload(files: UploadedFile[]): "pdf" | "images" {
  if (files.length === 0) throw new IngestError("Nessun file caricato.");
  const total = files.reduce((n, f) => n + f.size, 0);
  if (total > MAX_UPLOAD_BYTES) throw new IngestError("I file superano il limite di 60 MB.");
  const pdfs = files.filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
  if (pdfs.length === 1 && files.length === 1) return "pdf";
  if (pdfs.length > 0) throw new IngestError("Carica un solo PDF, oppure solo immagini delle pagine.");
  const bad = files.find((f) => !IMAGE_TYPES.includes(f.type));
  if (bad) throw new IngestError(`Formato non supportato: ${bad.name}. Usa PDF, JPG, PNG o WEBP.`);
  return "images";
}

/** Dal testo delle pagine (letto nel browser) al manuale diviso in sezioni. */
export function buildManual(pages: string[], source: ManualSource, fileName: string): ParsedManual {
  const sections = splitIntoSections(pages);
  if (sections.reduce((n, s) => n + s.text.length, 0) < 500) {
    throw new IngestError("Dal manuale si legge troppo poco testo. Prova con un PDF migliore o con foto più nitide.");
  }
  return { fileName, source, pageCount: pages.length, sections };
}
