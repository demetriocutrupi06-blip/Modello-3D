import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteOven, getOven, saveOvenProfile } from "@/features/oven-profile/server";
import { OvenProfile } from "@/features/oven-profile/schema";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const oven = await getOven((await params).id);
  return oven ? NextResponse.json(oven) : NextResponse.json({ error: "Forno non trovato." }, { status: 404 });
}

const SaveBody = z.object({ nickname: z.string().trim().min(1, "Dai un nome al forno"), profile: OvenProfile });

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const body = SaveBody.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json(
        { error: "Profilo non valido.", details: body.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
        { status: 400 },
      );
    }
    return NextResponse.json(await saveOvenProfile((await params).id, body.data.nickname, body.data.profile));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await deleteOven((await params).id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
