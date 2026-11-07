import "server-only";
import { createWorker } from "tesseract.js";

/** OCR in italiano di una o più immagini (pagine del manuale, foto di ricette). */
export async function ocrImages(images: Buffer[]): Promise<string[]> {
  const worker = await createWorker("ita");
  try {
    const out: string[] = [];
    for (const img of images) {
      const { data } = await worker.recognize(img);
      out.push(data.text.replace(/[ \t]+\n/g, "\n").trim());
    }
    return out;
  } finally {
    await worker.terminate();
  }
}
