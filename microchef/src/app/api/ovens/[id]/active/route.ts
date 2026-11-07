import { NextResponse } from "next/server";
import { setActiveOven } from "@/features/oven-profile/server";
import { errorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await setActiveOven((await params).id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
