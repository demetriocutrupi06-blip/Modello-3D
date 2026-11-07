import Link from "next/link";
import { listOvens } from "@/features/oven-profile/server";

export const dynamic = "force-dynamic";

export default async function OvensPage() {
  const ovens = await listOvens();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">I miei forni</h1>
        <Link href="/forni/nuovo" className="btn-primary">
          + Aggiungi
        </Link>
      </div>
      {ovens.length === 0 && <p className="text-stone-500">Nessun forno salvato. Aggiungine uno caricando il manuale.</p>}
      <ul className="space-y-3">
        {ovens.map((o) => (
          <li key={o.id}>
            <Link href={`/forni/${o.id}`} className="card flex items-center justify-between gap-3 hover:border-brand-500">
              <div>
                <div className="font-semibold">{o.nickname}</div>
                <div className="text-sm text-stone-500">
                  {o.brand} {o.model}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                {o.active && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-brand-700">attivo</span>}
                {!o.confirmed && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">da verificare</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
