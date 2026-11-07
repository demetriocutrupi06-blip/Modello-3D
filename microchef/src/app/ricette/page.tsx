import Link from "next/link";
import { listAdaptations } from "@/features/recipe-adapt/server";
import { FEASIBILITY_LABELS } from "@/features/recipe-adapt/schema";
import { FeasibilityBadge } from "@/features/recipe-adapt/components/FeasibilityBadge";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const items = await listAdaptations();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Ricette</h1>
        <Link href="/ricette/nuova" className="btn-primary">
          + Adatta
        </Link>
      </div>
      {items.length === 0 && <p className="text-stone-500">Nessuna ricetta adattata. Incolla una ricetta per iniziare.</p>}
      <ul className="space-y-3">
        {items.map((r) => (
          <li key={r.id}>
            <Link href={`/ricette/${r.id}`} className="card flex items-center justify-between gap-3 hover:border-brand-500">
              <div>
                <div className="font-semibold">{r.recipe.title}</div>
                <div className="text-sm text-stone-500">
                  {r.oven.nickname} · {r.servings} porzioni
                </div>
              </div>
              <FeasibilityBadge value={r.feasibility as keyof typeof FEASIBILITY_LABELS} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
