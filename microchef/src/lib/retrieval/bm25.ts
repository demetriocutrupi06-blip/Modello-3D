/**
 * Ricerca BM25 sulle sezioni del manuale, in TypeScript puro (nessun servizio esterno).
 * Normalizzazione per l'italiano: minuscole, senza accenti, senza parole vuote,
 * radice grezza (via l'ultima vocale) così "convezione"/"convezioni" coincidono.
 */

export interface SearchableSection {
  slug: string;
  title: string;
  text: string;
}

const STOPWORDS = new Set(
  "il lo la i gli le un uno una di a da in con su per tra fra e o ed od non che chi cui del dello della dei degli delle al allo alla ai agli alle dal dallo dalla dai dagli dalle nel nello nella nei negli nelle sul sullo sulla sui sugli sulle si se è sono come anche piu più ma questo questa quello quella essere viene vengono può possono deve devono".split(" "),
);

export function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map((t) => (t.length > 4 ? t.replace(/[aeiou]$/, "") : t));
}

export interface SearchHit<T> {
  section: T;
  score: number;
}

export function searchSections<T extends SearchableSection>(sections: T[], query: string, k = 5, opts = { k1: 1.4, b: 0.75, titleBoost: 3 }): SearchHit<T>[] {
  const q = [...new Set(normalize(query))];
  if (q.length === 0 || sections.length === 0) return [];
  const docs = sections.map((s) => {
    const title = normalize(s.title);
    const body = normalize(s.text);
    const tf = new Map<string, number>();
    for (const t of body) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of title) tf.set(t, (tf.get(t) ?? 0) + opts.titleBoost);
    return { tf, len: body.length + title.length * opts.titleBoost };
  });
  const avg = docs.reduce((n, d) => n + d.len, 0) / docs.length;
  const df = new Map<string, number>();
  for (const t of q) df.set(t, docs.filter((d) => d.tf.has(t)).length);

  return docs
    .map((d, i) => {
      let score = 0;
      for (const t of q) {
        const f = d.tf.get(t) ?? 0;
        if (!f) continue;
        const n = df.get(t)!;
        const idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
        score += idf * ((f * (opts.k1 + 1)) / (f + opts.k1 * (1 - opts.b + (opts.b * d.len) / avg)));
      }
      return { section: sections[i], score };
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
