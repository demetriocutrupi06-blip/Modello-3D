const SOURCE_LABEL: Record<string, string> = {
  pdf_text: "testo del PDF",
  pdf_ocr: "PDF scansionato, trascritto",
  images_ocr: "foto, lette con OCR",
};

export function ManualSections(props: {
  fileName: string;
  source: string;
  pageCount: number;
  sections: { slug: string; title: string; pageFrom: number; pageTo: number; text: string }[];
}) {
  return (
    <section className="card">
      <h2 className="text-lg font-semibold">Testo del manuale</h2>
      <p className="mb-3 text-sm text-stone-500">
        {props.fileName} · {props.pageCount} pagine · {SOURCE_LABEL[props.source] ?? props.source} · {props.sections.length} sezioni
      </p>
      <div className="space-y-2">
        {props.sections.map((s) => (
          <details key={s.slug} id={`sez-${s.slug}`} className="scroll-mt-20 rounded-lg border border-stone-200 dark:border-stone-800">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
              {s.title} <span className="text-stone-400">· p. {s.pageFrom === s.pageTo ? s.pageFrom : `${s.pageFrom}-${s.pageTo}`}</span>
            </summary>
            <pre className="whitespace-pre-wrap break-words px-3 pb-3 font-sans text-sm text-stone-700 dark:text-stone-300">{s.text}</pre>
          </details>
        ))}
      </div>
    </section>
  );
}
