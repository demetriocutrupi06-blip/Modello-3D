import { NextResponse } from "next/server";
import { z } from "zod";
import { createOvenFromManual, listOvens } from "@/features/oven-profile/server";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json(await listOvens());
}

/** Il manuale arriva già come testo, letto nel browser (PDF con pdf.js, foto con l'OCR). */
const Body = z.object({
  pages: z.array(z.string().max(60_000)).min(1).max(600),
  source: z.enum(["pdf_text", "pdf_ocr", "images_ocr"]),
  fileName: z.string().max(200),
  nickname: z.string().max(80).default(""),
  modelHint: z.string().max(80).optional(),
  mode: z.enum(["free", "ai"]).default("free"),
});

export async function POST(req: Request) {
  try {
    const body = Body.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: "Dati del manuale non validi." }, { status: 400 });
    const oven = await createOvenFromManual({ ...body.data, modelHint: body.data.modelHint?.trim() || undefined });
    return NextResponse.json(oven, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
