import Link from "next/link";
import { listOvens } from "@/features/oven-profile/server";

export const dynamic = "force-dynamic";

const FEATURES: { name: string; phase: number; done: boolean }[] = [
  { name: "Caricamento del manuale e profilo forno", phase: 1, done: true },
  { name: "Adattamento della ricetta", phase: 2, done: false },
  { name: "Convertitore di potenza", phase: 2, done: false },
  { name: "Scalare le porzioni", phase: 2, done: false },
  { name: "Modalità cucina con timer e voce", phase: 3, done: false },
  { name: "Suggerimenti, avanzi, controllo contenitori", phase: 4, done: false },
  { name: "Diario di cottura e assistente del manuale", phase: 5, done: false },
  { name: "Meal prep, lista della spesa, consumi", phase: 6, done: false },
];

export default async function Home() {
  const ovens = await listOvens();
  const active = ovens.find((o) => o.active);
  const pending = ovens.filter((o) => !o.confirmed);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">Cucina con il tuo forno, non con un forno qualsiasi</h1>
        <p className="mt-2 text-stone-600 dark:text-stone-400">
          Carica il manuale del tuo microonde: MicroChef ne ricava modalità, potenze, programmi e avvertenze, e li usa per
          adattare le ricette.
        </p>
      </section>

      {active ? (
        <Link href={`/forni/${active.id}`} className="card block hover:border-brand-500">
          <div className="text-sm text-stone-500">Forno attivo</div>
          <div className="text-lg font-semibold">{active.nickname}</div>
          <div className="text-sm text-stone-500">
            {active.brand} {active.model}
          </div>
        </Link>
      ) : (
        <div className="card">
          <p className="mb-3">Non hai ancora un forno configurato.</p>
          <Link href="/forni/nuovo" className="btn-primary">
            Carica il manuale del tuo forno
          </Link>
        </div>
      )}

      {pending.length > 0 && (
        <div className="card border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <p className="font-medium">Profili da verificare</p>
          <ul className="mt-1 list-disc pl-5">
            {pending.map((o) => (
              <li key={o.id}>
                <Link href={`/forni/${o.id}`} className="underline">
                  {o.nickname}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="card">
        <h2 className="mb-2 font-semibold">Funzionalità</h2>
        <ul className="space-y-1 text-sm">
          {FEATURES.map((f) => (
            <li key={f.name} className="flex items-center justify-between gap-2">
              <span className={f.done ? "" : "text-stone-400"}>{f.name}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${f.done ? "bg-green-100 text-green-800" : "bg-stone-100 text-stone-500 dark:bg-stone-800"}`}>
                {f.done ? "pronta" : `fase ${f.phase}`}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
