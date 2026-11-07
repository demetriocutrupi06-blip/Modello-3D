import { NextResponse } from "next/server";
import { z } from "zod";
import { adaptAndSave, listAdaptations } from "@/features/recipe-adapt/server";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  return NextResponse.json(await listAdaptations());
}

const Body = z.object({
  text: z.string().trim().min(10, "Incolla il testo della ricetta"),
  sourceType: z.enum(["text", "url", "photo"]).default("text"),
  sourceUrl: z.string().url().nullish(),
  servings: z.number().int().min(1).max(50).nullish(),
  mode: z.enum(["free", "ai"]).default("free"),
  ovenId: z.string().nullish(),
});

export async function POST(req: Request) {
  try {
    const body = Body.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Dati non validi." }, { status: 400 });
    return NextResponse.json(await adaptAndSave(body.data), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
