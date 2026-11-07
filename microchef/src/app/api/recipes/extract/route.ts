import { NextResponse } from "next/server";
import { extractFromImages, extractFromUrl } from "@/features/recipe-adapt/server";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";
export const maxDuration = 120;

/** multipart/form-data: url oppure files (foto). Restituisce il testo da controllare prima di adattarlo. */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const url = String(form.get("url") ?? "").trim();
    if (url) {
      const r = await extractFromUrl(url);
      return NextResponse.json({ text: r.text, info: r.structured ? "Ricetta letta dai dati strutturati della pagina." : "Testo estratto dalla pagina: controllalo e togli le parti che non servono." });
    }
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    const images = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));
    return NextResponse.json({ text: await extractFromImages(images), info: "Testo letto dalla foto con l'OCR: correggi eventuali errori." });
  } catch (e) {
    return errorResponse(e);
  }
}
