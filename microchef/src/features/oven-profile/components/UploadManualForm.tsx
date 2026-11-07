"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UploadManualForm({ hasApiKey }: { hasApiKey: boolean }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [nickname, setNickname] = useState("");
  const [modelHint, setModelHint] = useState("");
  const [mode, setMode] = useState<"ai" | "free">(hasApiKey ? "ai" : "free");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; details?: string[] } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    form.append("nickname", nickname);
    form.append("modelHint", modelHint);
    form.append("mode", mode);
    try {
      const res = await fetch("/api/ovens", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ message: body.error ?? `Errore ${res.status}`, details: body.details });
        return;
      }
      router.push(`/forni/${body.id}`);
    } catch {
      setError({ message: "Connessione al server non riuscita." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div>
        <label className="label" htmlFor="files">
          Manuale (PDF oppure foto delle pagine)
        </label>
        <input
          id="files"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          multiple
          className="field file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-1 file:text-brand-700"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        {files.length > 1 && <p className="mt-1 text-xs text-stone-500">Le foto vengono lette in ordine di nome file.</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="nickname">
            Nome del forno
          </label>
          <input id="nickname" className="field" placeholder="es. Casa, Casa dei genitori" value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="modelHint">
            Modello esatto (facoltativo)
          </label>
          <input id="modelHint" className="field" placeholder="es. MC28H5015AW" value={modelHint} onChange={(e) => setModelHint(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-stone-500">
        Utile se il manuale copre più modelli: lo trovi sull&apos;etichetta dietro lo sportello o sul retro del forno.
      </p>
      <fieldset>
        <legend className="label">Come leggere il manuale</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${mode === "free" ? "border-brand-500 bg-brand-50 dark:bg-stone-800" : "border-stone-300 dark:border-stone-700"}`}>
            <input type="radio" name="mode" value="free" checked={mode === "free"} onChange={() => setMode("free")} className="mt-1 accent-brand-600" />
            <span>
              <span className="block font-semibold">Gratis</span>
              <span className="text-sm text-stone-600 dark:text-stone-400">
                Il testo viene diviso in sezioni e potenze, capacità e codici di errore vengono riconosciuti in automatico. Il resto lo completi tu.
              </span>
            </span>
          </label>
          <label
            className={`flex gap-3 rounded-xl border p-3 ${!hasApiKey ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${mode === "ai" ? "border-brand-500 bg-brand-50 dark:bg-stone-800" : "border-stone-300 dark:border-stone-700"}`}
          >
            <input type="radio" name="mode" value="ai" checked={mode === "ai"} disabled={!hasApiKey} onChange={() => setMode("ai")} className="mt-1 accent-brand-600" />
            <span>
              <span className="block font-semibold">Con Claude (a pagamento)</span>
              <span className="text-sm text-stone-600 dark:text-stone-400">
                {hasApiKey
                  ? "Claude compila tutto il profilo: modalità, programmi, accessori, avvertenze. Pochi centesimi per manuale."
                  : "Richiede una chiave API di Anthropic nel file .env."}
              </span>
            </span>
          </label>
        </div>
      </fieldset>
      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={busy || files.length === 0}>
        {busy ? "Lettura del manuale in corso…" : "Leggi il manuale"}
      </button>
      {busy && (
        <p className="text-sm text-stone-500">
          {mode === "ai"
            ? "Può richiedere da uno a tre minuti per un manuale di 40 pagine. Non chiudere la pagina."
            : files.some((f) => f.type.startsWith("image/"))
              ? "Lettura delle foto con l'OCR: circa 10 secondi per pagina."
              : "Pochi secondi…"}
        </p>
      )}
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          <p>{error.message}</p>
          {error.details && (
            <ul className="mt-1 list-disc pl-5">
              {error.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
