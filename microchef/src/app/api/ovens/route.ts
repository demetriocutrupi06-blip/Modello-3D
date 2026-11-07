import { NextResponse } from "next/server";
import { createOvenFromManual, listOvens } from "@/features/oven-profile/server";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json(await listOvens());
}

/** multipart/form-data: files (PDF o immagini), nickname, modelHint, mode ("ai" | "free") */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = await Promise.all(
      form
        .getAll("files")
        .filter((f): f is File => f instanceof File && f.size > 0)
        .map(async (f) => ({ name: f.name, type: f.type, data: Buffer.from(await f.arrayBuffer()) })),
    );
    const nickname = String(form.get("nickname") ?? "");
    const modelHint = String(form.get("modelHint") ?? "").trim() || undefined;
    const mode = form.get("mode") === "ai" ? "ai" : "free";
    const oven = await createOvenFromManual(files, nickname, modelHint, mode);
    return NextResponse.json(oven, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
