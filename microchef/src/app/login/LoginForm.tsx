"use client";
import { useState } from "react";

export function LoginForm({ next }: { next: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Accesso non riuscito.");
        return;
      }
      window.location.href = next;
    } catch {
      setError("Connessione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <label className="block">
        <span className="label">Password</span>
        <input className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
      </label>
      <button type="submit" className="btn-primary w-full" disabled={!password || busy}>
        {busy ? "Accesso…" : "Entra"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
