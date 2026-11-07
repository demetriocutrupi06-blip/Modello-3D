"use client";
/**
 * Lettura dei file direttamente nel browser (telefono o computer): il server riceve solo il testo.
 * Così funzionano anche i PDF grandi, che i servizi di hosting gratuiti non accetterebbero (limite ~4 MB).
 */
import { extractPdfPages, looksScanned } from "./pdf-text";

export type Progress = (message: string, fraction: number) => void;

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfjs;
}

async function createOcr(onProgress?: Progress) {
  const { createWorker } = await import("tesseract.js");
  onProgress?.("Preparo il riconoscimento del testo (OCR)…", 0);
  return createWorker("ita");
}

/** OCR in italiano di immagini (foto o pagine renderizzate). */
export async function ocrImages(images: (File | HTMLCanvasElement)[], onProgress?: Progress): Promise<string[]> {
  const worker = await createOcr(onProgress);
  try {
    const out: string[] = [];
    for (let i = 0; i < images.length; i++) {
      onProgress?.(`Leggo l'immagine ${i + 1} di ${images.length}…`, i / images.length);
      const { data } = await worker.recognize(images[i]);
      out.push(data.text.replace(/[ \t]+\n/g, "\n").trim());
    }
    return out;
  } finally {
    await worker.terminate();
  }
}

/** PDF → testo delle pagine; se è una scansione, le pagine vengono disegnate e lette con l'OCR. */
export async function readPdf(file: File, onProgress?: Progress): Promise<{ pages: string[]; source: "pdf_text" | "pdf_ocr" }> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const text = await extractPdfPages(doc, (d, t) => onProgress?.(`Leggo la pagina ${d} di ${t}…`, d / t));
  if (!looksScanned(text.pages)) return { pages: text.pages, source: "pdf_text" };

  const canvases: HTMLCanvasElement[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    onProgress?.(`Il PDF è una scansione: preparo la pagina ${n} di ${doc.numPages}…`, n / doc.numPages);
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
    canvases.push(canvas);
  }
  return { pages: await ocrImages(canvases, onProgress), source: "pdf_ocr" };
}
