import { describe, expect, it } from "vitest";
import { buildManual, classifyUpload, IngestError, type UploadedFile } from "../ingest";

const text = (n: number) =>
  `LIVELLI DI POTENZA\n${"Il forno offre sei livelli di potenza tra 100 W e 900 W, da scegliere in base all'alimento. ".repeat(n)}`;

const pdf: UploadedFile = { name: "manuale.pdf", type: "application/pdf", size: 7_500_000 };
const img = (name: string): UploadedFile => ({ name, type: "image/jpeg", size: 2_000_000 });

describe("classifyUpload", () => {
  it("riconosce un PDF o un gruppo di immagini", () => {
    expect(classifyUpload([pdf])).toBe("pdf");
    expect(classifyUpload([img("a.jpg"), img("b.jpg")])).toBe("images");
  });

  it("rifiuta combinazioni, formati non supportati e file enormi", () => {
    expect(() => classifyUpload([])).toThrow(IngestError);
    expect(() => classifyUpload([pdf, img("a.jpg")])).toThrow(/un solo PDF/);
    expect(() => classifyUpload([{ name: "x.docx", type: "application/msword", size: 10 }])).toThrow(/non supportato/);
    expect(() => classifyUpload([{ ...pdf, size: 80_000_000 }])).toThrow(/60 MB/);
  });
});

describe("buildManual", () => {
  it("divide il testo delle pagine in sezioni citabili", () => {
    const m = buildManual([text(10)], "pdf_text", "manuale.pdf");
    expect(m).toMatchObject({ source: "pdf_text", pageCount: 1, fileName: "manuale.pdf" });
    expect(m.sections[0].id).toBe("p1-livelli-di-potenza");
  });

  it("si ferma se il testo letto è troppo poco", () => {
    expect(() => buildManual(["POCO\nniente"], "images_ocr", "foto")).toThrow(/troppo poco testo/);
  });
});
