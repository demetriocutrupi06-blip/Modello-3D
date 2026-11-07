import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { anthropicCall } from "@/lib/llm/client";
import { extractPdfPages } from "@/lib/ingest/pdf";
import { ocrImages } from "@/lib/ingest/ocr";
import { transcribeScannedPdf } from "@/lib/ingest/scanned-pdf";
import { extractOvenProfile } from "./extract";
import { parseManual, type IngestDeps, type UploadedFile } from "./ingest";
import { OvenProfile, normalizeProfile } from "./schema";

const deps: IngestDeps = {
  extractPdfPages,
  ocrImages,
  transcribeScannedPdf: (data, pageCount) => transcribeScannedPdf(anthropicCall, data, pageCount),
};

/** Carica il manuale, estrae il profilo e salva il forno come "da verificare". */
export async function createOvenFromManual(files: UploadedFile[], nickname: string, modelHint?: string) {
  const manual = await parseManual(files, deps);
  const profile = await extractOvenProfile({ call: anthropicCall, sections: manual.sections, modelHint });

  return db.oven.create({
    data: {
      nickname: nickname.trim() || `${profile.brand} ${profile.model}`.trim() || "Il mio forno",
      brand: profile.brand,
      model: profile.model,
      profile: profile as unknown as Prisma.InputJsonValue,
      confirmed: false,
      manual: {
        create: {
          fileName: manual.fileName,
          source: manual.source,
          pageCount: manual.pageCount,
          sections: {
            create: manual.sections.map((s) => ({
              slug: s.id,
              title: s.title,
              pageFrom: s.pageFrom,
              pageTo: s.pageTo,
              text: s.text,
              order: s.order,
            })),
          },
        },
      },
    },
    select: { id: true },
  });
}

export async function listOvens() {
  const [ovens, settings] = await Promise.all([
    db.oven.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, nickname: true, brand: true, model: true, confirmed: true, createdAt: true },
    }),
    db.settings.findUnique({ where: { id: 1 } }),
  ]);
  return ovens.map((o) => ({ ...o, active: o.id === settings?.activeOvenId }));
}

export async function getOven(id: string) {
  const oven = await db.oven.findUnique({
    where: { id },
    include: {
      manual: {
        select: {
          fileName: true,
          source: true,
          pageCount: true,
          sections: { orderBy: { order: "asc" }, select: { slug: true, title: true, pageFrom: true, pageTo: true, text: true } },
        },
      },
    },
  });
  if (!oven) return null;
  const parsed = OvenProfile.safeParse(oven.profile);
  return { ...oven, profile: parsed.success ? parsed.data : null, profileIssues: parsed.success ? [] : parsed.error.issues };
}

export async function saveOvenProfile(id: string, nickname: string, profile: OvenProfile) {
  const p = normalizeProfile(profile);
  const oven = await db.oven.update({
    where: { id },
    data: { nickname, brand: p.brand, model: p.model, profile: p as unknown as Prisma.InputJsonValue, confirmed: true },
    select: { id: true },
  });
  // il primo forno confermato diventa automaticamente quello attivo
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  if (!settings?.activeOvenId) await setActiveOven(id);
  return oven;
}

export async function setActiveOven(id: string) {
  await db.settings.upsert({ where: { id: 1 }, create: { id: 1, activeOvenId: id }, update: { activeOvenId: id } });
}

export async function deleteOven(id: string) {
  await db.oven.delete({ where: { id } });
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  if (settings?.activeOvenId === id) {
    const next = await db.oven.findFirst({ where: { confirmed: true }, orderBy: { createdAt: "asc" } });
    await db.settings.update({ where: { id: 1 }, data: { activeOvenId: next?.id ?? null } });
  }
}
