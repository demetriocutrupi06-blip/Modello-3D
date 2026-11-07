"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Source = "text" | "url" | "photo";

export function RecipeInputForm({ hasApiKey }: { hasApiKey: boolean }) {
  const router = useRouter();
  const [source, setSource] = useState<Source>("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [servings, setServings] = useState("");
  const [mode, setMode] = useState<"free" | "ai">("free");
  const [busy, setBusy] = useState<"extract" | "adapt" | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function extract() {
    setBusy("extract");
    setError(null);
    setInfo(null);
    const form = new FormData();
    if (source === "url") form.append("url", url);
    else files.forEach((f) => form.append("files", f));
    try {
      const res = await fetch("/api/recipes/extract", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(body.error ?? `Errore ${res.status}`);
      setText(body.text);
      setInfo(body.info);
    } catch {
      setError("Connessione al server non riuscita.");
    } finally {
      setBusy(null);
    }
  }

  async function adapt(e: React.FormEvent) {
    e.preventDefault();
    setBusy("adapt");
    setError(null);
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          sourceType: source,
          sourceUrl: source === "url" && url ? url : null,
          servings: servings ? Number(servings) : null,
          mode,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(body.error ?? `Errore ${res.status}`);
      router.push(`/ricette/${body.id}`);
    } catch {
      setError("Connessione al server non riuscita.");
    } finally {
      setBusy(null);
    }
  }

  const tab = (s: Source, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={source === s}
      onClick={() => setSource(s)}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${source === s ? "bg-white shadow dark:bg-stone-800" : "text-stone-500"}`}
    >
      {label}
    </button>
  );

  return (
    <form onSubmit={adapt} className="space-y-4">
      <div className="card space-y-3">
        <div role="tablist" className="flex gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-950">
          {tab("text", "Testo")}
          {tab("url", "Link")}
          {tab("photo", "Foto")}
        </div>

        {source === "url" && (
          <div className="flex gap-2">
            <input className="field" type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button type="button" className="btn-secondary shrink-0" onClick={extract} disabled={!url || busy !== null}>
              {busy === "extract" ? "…" : "Leggi"}
            </button>
          </div>
        )}
        {source === "photo" && (
          <div className="flex gap-2">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="field file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-1 file:text-brand-700"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            <button type="button" className="btn-secondary shrink-0" onClick={extract} disabled={files.length === 0 || busy !== null}>
              {busy === "extract" ? "…" : "Leggi"}
            </button>
          </div>
        )}
        {busy === "extract" && source === "photo" && <p className="text-sm text-stone-500">Lettura della foto con l&apos;OCR, circa 10-20 secondi…</p>}
        {info && <p className="text-sm text-stone-500">{info}</p>}

        <label className="block">
          <span className="label">{source === "text" ? "Incolla la ricetta (ingredienti e procedimento)" : "Testo della ricetta (controllalo prima di adattare)"}</span>
          <textarea
            className="field min-h-64 font-mono text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Pasta al forno\nPer 4 persone\n\nIngredienti\n- 320 g di pasta\n- 400 g di passata\n\nProcedimento\n1. Cuoci la pasta in acqua salata per 8 minuti.\n2. Inforna a 200 °C per 20 minuti."}
          />
        </label>
        <label className="block w-40">
          <span className="label">Porzioni (facoltativo)</span>
          <input className="field" inputMode="numeric" placeholder="dalla ricetta" value={servings} onChange={(e) => setServings(e.target.value.replace(/\D/g, ""))} />
        </label>
      </div>

      <fieldset className="card">
        <legend className="label">Come adattarla</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${mode === "free" ? "border-brand-500 bg-brand-50 dark:bg-stone-800" : "border-stone-300 dark:border-stone-700"}`}>
            <input type="radio" checked={mode === "free"} onChange={() => setMode("free")} className="mt-1 accent-brand-600" />
            <span>
              <span className="block font-semibold">Gratis</span>
              <span className="text-sm text-stone-600 dark:text-stone-400">Regole fisse: riconosce forno, padella, pentola, vapore, microonde e li traduce nelle modalità del tuo forno.</span>
            </span>
          </label>
          <label className={`flex gap-3 rounded-xl border p-3 ${hasApiKey ? "cursor-pointer" : "cursor-not-allowed opacity-60"} ${mode === "ai" ? "border-brand-500 bg-brand-50 dark:bg-stone-800" : "border-stone-300 dark:border-stone-700"}`}>
            <input type="radio" checked={mode === "ai"} disabled={!hasApiKey} onChange={() => setMode("ai")} className="mt-1 accent-brand-600" />
            <span>
              <span className="block font-semibold">Con Claude (a pagamento)</span>
              <span className="text-sm text-stone-600 dark:text-stone-400">{hasApiKey ? "Adattamento completo e ragionato. Circa 1-3 centesimi." : "Richiede la chiave API nel file .env."}</span>
            </span>
          </label>
        </div>
      </fieldset>

      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={text.trim().length < 10 || busy !== null}>
        {busy === "adapt" ? "Adattamento in corso…" : "Adatta al mio forno"}
      </button>
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}
    </form>
  );
}
