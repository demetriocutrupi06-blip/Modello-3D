"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MODE_LABELS } from "@/features/oven-profile/schema";
import { formatDuration } from "@/features/power-converter/logic";
import { portionWarnings, scaleIngredient } from "@/features/portions/logic";
import type { StoredAdaptation } from "../schema";
import { scaleStep } from "../scale";
import { FeasibilityBadge } from "./FeasibilityBadge";

const COVERAGE = {
  manuale: { label: "dal manuale", cls: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" },
  regola_generale: { label: "regola generale", cls: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300" },
  non_coperto: { label: "non coperto dal manuale", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
} as const;

export function RecipeView(props: {
  id: string;
  data: StoredAdaptation;
  oven: { id: string; nickname: string; brand: string; model: string };
  sourceUrl: string | null;
  sections: { slug: string; title: string; pageFrom: number }[];
}) {
  const router = useRouter();
  const { data } = props;
  const [servings, setServings] = useState(data.servings);
  const ratio = servings / data.servings;
  const sectionMap = useMemo(() => new Map(props.sections.map((s) => [s.slug, s])), [props.sections]);

  const ingredients = data.ingredients.map((i) => ({ ...i, scaled: scaleIngredient(i.text, ratio) }));
  const warnings = portionWarnings(ratio);

  async function remove() {
    if (!confirm("Eliminare questa ricetta?")) return;
    await fetch(`/api/recipes/${props.id}`, { method: "DELETE" });
    router.push("/ricette");
    router.refresh();
  }

  const Source = ({ slug }: { slug: string }) => {
    const s = sectionMap.get(slug);
    return (
      <Link href={`/forni/${props.oven.id}#sez-${slug}`} className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 hover:bg-brand-100 dark:bg-stone-800 dark:text-stone-300">
        📖 {s ? `${s.title} · p. ${s.pageFrom}` : slug}
      </Link>
    );
  };

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <FeasibilityBadge value={data.feasibility} />
          <span className="text-xs text-stone-500">
            {data.method === "ai" ? "Adattata con Claude" : "Adattata con regole fisse (gratis)"} · {props.oven.nickname}
          </span>
        </div>
        <h1 className="text-2xl font-bold">{data.title}</h1>
        <p className="text-stone-700 dark:text-stone-300">{data.feasibilityReason}</p>
        {props.sourceUrl && (
          <a href={props.sourceUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-700 underline">
            Ricetta originale
          </a>
        )}
      </header>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Ingredienti</h2>
          <div className="flex items-center gap-2" aria-label="Porzioni">
            <button type="button" className="btn-secondary h-11 w-11 p-0 text-xl" onClick={() => setServings((s) => Math.max(1, s - 1))} aria-label="Una porzione in meno">
              −
            </button>
            <span className="min-w-24 text-center font-semibold">
              {servings} {servings === 1 ? "porzione" : "porzioni"}
            </span>
            <button type="button" className="btn-secondary h-11 w-11 p-0 text-xl" onClick={() => setServings((s) => Math.min(50, s + 1))} aria-label="Una porzione in più">
              +
            </button>
          </div>
        </div>
        <ul className="mt-3 space-y-1">
          {ingredients.map((i, k) => (
            <li key={k}>
              <span className={i.scaled.scaled ? "font-medium" : ""}>{i.scaled.text}</span>
              {i.note && <span className="block text-sm text-amber-700 dark:text-amber-300">↳ {i.note}</span>}
            </li>
          ))}
        </ul>
        {warnings.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 rounded-lg bg-amber-50 p-3 pl-7 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <li>
              Tempi al microonde adattati con la regola ×{(Math.pow(ratio, 0.65)).toFixed(2).replace(".", ",")} (non proporzionale).
            </li>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Procedimento</h2>
        {data.steps.map((s, i) => {
          const sc = scaleStep(s, ratio);
          const scale = sc.scaled;
          const dur = sc.durationSeconds;
          const durMax = sc.durationMaxSeconds;
          return (
            <article key={i} className="card space-y-2">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="font-medium">{sc.instruction}</p>
                  {s.mode !== null && (
                    <div className="flex flex-wrap gap-1 text-sm">
                      <Chip>{s.modeLabel ?? MODE_LABELS[s.mode]}</Chip>
                      {s.powerWatts && <Chip>{s.powerLabel ? `${s.powerLabel} · ` : ""}{s.powerWatts} W</Chip>}
                      {s.temperatureC && <Chip>{s.temperatureC} °C</Chip>}
                      {dur && <Chip strong={Boolean(scale)}>⏱ {formatDuration(dur)}{durMax ? `-${formatDuration(durMax)}` : ""}</Chip>}
                      {s.accessory && <Chip>🧰 {s.accessory}</Chip>}
                    </div>
                  )}
                  {scale && <p className="text-xs text-amber-700 dark:text-amber-300">Tempo per {servings} porzioni (originale {formatDuration(s.durationSeconds!)}): controlla a metà.</p>}
                  {s.container && <p className="text-sm text-stone-600 dark:text-stone-400">Contenitore: {s.container}</p>}
                  {s.pauses.length > 0 && (
                    <ul className="list-disc pl-5 text-sm text-stone-700 dark:text-stone-300">
                      {sc.pauses.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  )}
                  {s.note && <p className="text-sm text-stone-600 dark:text-stone-400">💡 {s.note}</p>}
                  {s.original && s.original !== sc.instruction && <p className="text-xs text-stone-400">Originale: {s.original}</p>}
                  {(s.mode !== null || s.coverage === "non_coperto") && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${COVERAGE[s.coverage].cls}`}>{COVERAGE[s.coverage].label}</span>
                      {s.sources.map((src) => (
                        <Source key={src} slug={src} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {data.warnings.length > 0 && (
        <section className="card border-red-200 dark:border-red-900">
          <h2 className="mb-2 text-lg font-semibold">⚠️ Avvisi di sicurezza</h2>
          <ul className="space-y-2">
            {data.warnings.map((w, k) => (
              <li key={k} className="text-sm">
                {w.text} {w.source && <Source slug={w.source} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={`/ricette/${props.id}/cucina?porzioni=${servings}`} className="btn-primary">
          👩‍🍳 Inizia a cucinare
        </Link>
        <Link href="/ricette/nuova" className="btn-secondary">
          Adatta un&apos;altra ricetta
        </Link>
        <button type="button" className="btn-danger" onClick={remove}>
          Elimina
        </button>
      </div>
    </div>
  );
}

function Chip({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span className={`rounded-lg px-2 py-1 ${strong ? "bg-amber-100 font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100" : "bg-brand-50 text-brand-700 dark:bg-stone-800 dark:text-brand-100"}`}>
      {children}
    </span>
  );
}
