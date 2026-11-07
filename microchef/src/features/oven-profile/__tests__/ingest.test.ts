import { describe, expect, it, vi } from "vitest";
import { classifyUpload, IngestError, parseManual, type IngestDeps, type UploadedFile } from "../ingest";

const text = (n: number) =>
  `LIVELLI DI POTENZA\n${"Il forno offre sei livelli di potenza tra 100 W e 900 W, da scegliere in base all'alimento. ".repeat(n)}`;

const pdf: UploadedFile = { name: "manuale.pdf", type: "application/pdf", data: Buffer.from("%PDF") };
const img = (name: string): UploadedFile => ({ name, type: "image/jpeg", data: Buffer.from(name) });

function deps(overrides: Partial<IngestDeps> = {}): IngestDeps {
  return {
    extractPdfPages: vi.fn(async () => ({ pages: [text(10)], pageCount: 1, looksScanned: false })),
    transcribeScannedPdf: vi.fn(async () => [text(10)]),
    ocrImages: vi.fn(async (images: Buffer[]) => images.map(() => text(5))),
    ...overrides,
  };
}

describe("classifyUpload", () => {
  it("riconosce un PDF o un gruppo di immagini", () => {
    expect(classifyUpload([pdf])).toBe("pdf");
    expect(classifyUpload([img("a.jpg"), img("b.jpg")])).toBe("images");
  });

  it("rifiuta combinazioni e formati non supportati", () => {
    expect(() => classifyUpload([])).toThrow(IngestError);
    expect(() => classifyUpload([pdf, img("a.jpg")])).toThrow(/un solo PDF/);
    expect(() => classifyUpload([{ name: "x.docx", type: "application/msword", data: Buffer.from("") }])).toThrow(/non supportato/);
  });
});

describe("parseManual", () => {
  it("usa il testo del PDF quando c'è", async () => {
    const d = deps();
    const m = await parseManual([pdf], d);
    expect(m.source).toBe("pdf_text");
    expect(m.sections[0].id).toBe("p1-livelli-di-potenza");
    expect(d.transcribeScannedPdf).not.toHaveBeenCalled();
  });

  it("trascrive con il modello i PDF scansionati", async () => {
    const d = deps({ extractPdfPages: vi.fn(async () => ({ pages: [""], pageCount: 1, looksScanned: true })) });
    const m = await parseManual([pdf], d);
    expect(m.source).toBe("pdf_ocr");
    expect(d.transcribeScannedPdf).toHaveBeenCalledOnce();
  });

  it("legge le foto in ordine numerico di nome file", async () => {
    const d = deps();
    const m = await parseManual([img("pag-10.jpg"), img("pag-2.jpg"), img("pag-1.jpg")], d);
    expect(m.source).toBe("images_ocr");
    const order = vi.mocked(d.ocrImages).mock.calls[0][0].map((b) => b.toString());
    expect(order).toEqual(["pag-1.jpg", "pag-2.jpg", "pag-10.jpg"]);
    expect(m.fileName).toBe("3 immagini");
  });

  it("si ferma se il testo letto è troppo poco", async () => {
    const d = deps({ extractPdfPages: vi.fn(async () => ({ pages: ["POCO\nniente"], pageCount: 1, looksScanned: false })) });
    await expect(parseManual([pdf], d)).rejects.toThrow(/troppo poco testo/);
  });
});
