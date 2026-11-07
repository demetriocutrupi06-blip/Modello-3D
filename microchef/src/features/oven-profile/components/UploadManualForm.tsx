"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UploadManualForm() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [nickname, setNickname] = useState("");
  const [modelHint, setModelHint] = useState("");
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
      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={busy || files.length === 0}>
        {busy ? "Analisi del manuale in corso…" : "Analizza il manuale"}
      </button>
      {busy && <p className="text-sm text-stone-500">Può richiedere da uno a tre minuti per un manuale di 40 pagine. Non chiudere la pagina.</p>}
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
