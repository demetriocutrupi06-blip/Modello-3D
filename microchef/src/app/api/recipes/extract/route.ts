import { NextResponse } from "next/server";
import { extractFromUrl } from "@/features/recipe-adapt/server";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";
export const maxDuration = 30;

/** { url } → testo della ricetta da controllare prima di adattarla. (Le foto vengono lette nel browser.) */
export async function POST(req: Request) {
  try {
    const { url } = (await req.json().catch(() => ({}))) as { url?: string };
    const r = await extractFromUrl(String(url ?? "").trim());
    return NextResponse.json({
      text: r.text,
      info: r.structured ? "Ricetta letta dai dati strutturati della pagina." : "Testo estratto dalla pagina: controllalo e togli le parti che non servono.",
    });
  } catch (e) {
    return errorResponse(e);
  }
}
