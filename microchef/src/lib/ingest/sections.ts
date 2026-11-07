/**
 * Divide il testo del manuale in sezioni citabili.
 * Euristica: un titolo è una riga breve, tutta in MAIUSCOLO, senza punteggiatura finale
 * e non composta in prevalenza da numeri (che sarebbe una riga di tabella, es. "ALTO 100 % 900 W").
 */

export interface ManualSectionDraft {
  id: string;
  title: string;
  pageFrom: number;
  pageTo: number;
  text: string;
  order: number;
}

const FOOTER = /^(italiano|english|deutsch|français|español)\s*-\s*\d+$/i;
const MAX_SECTION_CHARS = 6000;
const MIN_SECTION_CHARS = 60;

export function isHeading(line: string): boolean {
  const l = line.trim();
  if (l.length < 5 || l.length > 80) return false;
  if (/^\d+\.\s/.test(l)) return false; // voce di elenco numerato
  if (/[.:;,]$/.test(l)) return false;
  const letters = l.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "");
  if (letters.length < 5) return false;
  if (letters !== letters.toLocaleUpperCase("it-IT")) return false;
  const digits = l.replace(/[^0-9]/g, "").length;
  if (digits > 2) return false;
  if (/\b(W|%|°C|kg|g|ml|min)\b/.test(l)) return false;
  // almeno una parola di 3+ lettere
  return /[A-ZÀ-Ö]{3,}/.test(l);
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function titleCase(s: string): string {
  const lower = s.toLocaleLowerCase("it-IT").replace(/\s+/g, " ").trim();
  return lower.charAt(0).toLocaleUpperCase("it-IT") + lower.slice(1);
}

/** pages[i] è il testo della pagina i+1. */
export function splitIntoSections(pages: string[]): ManualSectionDraft[] {
  const drafts: { title: string; pageFrom: number; pageTo: number; lines: string[] }[] = [];
  let current = { title: "Introduzione", pageFrom: 1, pageTo: 1, lines: [] as string[] };

  pages.forEach((pageText, idx) => {
    const page = idx + 1;
    for (const raw of pageText.split("\n")) {
      const line = raw.trim();
      if (!line || FOOTER.test(line)) continue;
      if (isHeading(line)) {
        // Titoli consecutivi (es. su due righe) vengono uniti se la sezione corrente è ancora vuota.
        if (current.lines.length === 0 && drafts.length > 0 && current.title !== "Introduzione" && current.pageFrom === page) {
          current.title = `${current.title} ${line}`;
          continue;
        }
        if (current.lines.length > 0) drafts.push(current);
        current = { title: line, pageFrom: page, pageTo: page, lines: [] };
        continue;
      }
      current.lines.push(line);
      current.pageTo = page;
    }
  });
  if (current.lines.length > 0) drafts.push(current);

  // Sezioni minuscole (didascalie, etichette) vengono accorpate alla precedente.
  for (let i = drafts.length - 1; i > 0; i--) {
    const size = drafts[i].lines.join(" ").length;
    if (size < MIN_SECTION_CHARS) {
      drafts[i - 1].lines.push(drafts[i].title, ...drafts[i].lines);
      drafts[i - 1].pageTo = Math.max(drafts[i - 1].pageTo, drafts[i].pageTo);
      drafts.splice(i, 1);
    }
  }

  // Spezza le sezioni troppo lunghe in parti, per tenere il recupero preciso.
  const out: ManualSectionDraft[] = [];
  const used = new Set<string>();
  for (const d of drafts) {
    const parts = chunkLines(d.lines, MAX_SECTION_CHARS);
    parts.forEach((lines, i) => {
      const title = titleCase(d.title) + (parts.length > 1 ? ` (parte ${i + 1})` : "");
      let id = `p${d.pageFrom}-${slugify(d.title)}${parts.length > 1 ? `-${i + 1}` : ""}`;
      let n = 2;
      while (used.has(id)) id = `${id.replace(/~\d+$/, "")}~${n++}`;
      used.add(id);
      out.push({ id, title, pageFrom: d.pageFrom, pageTo: d.pageTo, text: lines.join("\n"), order: out.length });
    });
  }
  return out;
}

function chunkLines(lines: string[], max: number): string[][] {
  const chunks: string[][] = [[]];
  let size = 0;
  for (const l of lines) {
    if (size + l.length > max && chunks[chunks.length - 1].length > 0) {
      chunks.push([]);
      size = 0;
    }
    chunks[chunks.length - 1].push(l);
    size += l.length + 1;
  }
  return chunks;
}
