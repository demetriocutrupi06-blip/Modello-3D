/**
 * Test facoltativo sul PDF reale (non incluso nella repository per motivi di copyright):
 *   MANUAL_PDF=/percorso/manuale.pdf npm test
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { extractPdfPages } from "../pdf";
import { splitIntoSections } from "../sections";

const file = process.env.MANUAL_PDF;

describe.skipIf(!file)("manuale reale (MANUAL_PDF)", () => {
  it("estrae testo leggibile e sezioni citabili", async () => {
    const { pages, looksScanned } = await extractPdfPages(fs.readFileSync(file!));
    expect(looksScanned).toBe(false);
    const sections = splitIntoSections(pages);
    expect(sections.length).toBeGreaterThan(20);
    const power = sections.find((s) => /livelli di potenza/i.test(s.title));
    expect(power?.text).toMatch(/900 W/);
  }, 60_000);
});
