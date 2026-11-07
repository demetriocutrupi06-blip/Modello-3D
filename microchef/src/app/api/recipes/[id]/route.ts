import { NextResponse } from "next/server";
import { deleteAdaptation, getAdaptation } from "@/features/recipe-adapt/server";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const a = await getAdaptation((await params).id);
  return a ? NextResponse.json(a) : NextResponse.json({ error: "Ricetta non trovata." }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await deleteAdaptation((await params).id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
