"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  MODE_IDS,
  MODE_LABELS,
  OvenProfile,
  type ModeId,
} from "../schema";

type Profile = OvenProfile;
type SectionRef = { slug: string; title: string; pageFrom: number };

export function ProfileEditor(props: {
  ovenId: string;
  initialNickname: string;
  initialProfile: Profile;
  confirmed: boolean;
  sections: SectionRef[];
}) {
  const router = useRouter();
  const [nickname, setNickname] = useState(props.initialNickname);
  const [p, setP] = useState<Profile>(props.initialProfile);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; message: string; details?: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const sectionsBySlug = useMemo(() => new Map(props.sections.map((s) => [s.slug, s])), [props.sections]);

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setP((prev) => ({ ...prev, [key]: value }));
  const Src = ({ source }: { source: string | null }) => <SourceChip source={source} sections={sectionsBySlug} />;

  function toggleJson() {
    if (!jsonMode) {
      setJsonText(JSON.stringify(p, null, 2));
      setJsonMode(true);
      return;
    }
    try {
      const parsed = OvenProfile.safeParse(JSON.parse(jsonText));
      if (!parsed.success) {
        setStatus({ kind: "error", message: "JSON non valido", details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
        return;
      }
      setP(parsed.data);
      setJsonMode(false);
      setStatus(null);
    } catch (e) {
      setStatus({ kind: "error", message: `JSON non leggibile: ${(e as Error).message}` });
    }
  }

  async function save() {
    if (jsonMode) {
      setStatus({ kind: "error", message: "Torna al modulo (pulsante «Modulo») prima di salvare." });
      return;
    }
    const parsed = OvenProfile.safeParse(p);
    if (!parsed.success) {
      setStatus({ kind: "error", message: "Alcuni campi non sono validi", details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/ovens/${props.ovenId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname, profile: parsed.data }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setStatus({ kind: "error", message: body.error ?? `Errore ${res.status}`, details: body.details });
      else {
        setStatus({ kind: "ok", message: "Profilo salvato." });
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function makeActive() {
    await fetch(`/api/ovens/${props.ovenId}/active`, { method: "POST" });
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Eliminare "${nickname}" e il suo manuale?`)) return;
    await fetch(`/api/ovens/${props.ovenId}`, { method: "DELETE" });
    router.push("/forni");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{nickname || "Forno"}</h1>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={toggleJson}>
            {jsonMode ? "Modulo" : "JSON"}
          </button>
          {props.confirmed && (
            <button type="button" className="btn-secondary" onClick={makeActive}>
              Usa questo forno
            </button>
          )}
        </div>
      </div>

      {jsonMode ? (
        <div className="card">
          <p className="mb-2 text-sm text-stone-500">Modifica avanzata del profilo. Premi «Modulo» per verificare e applicare.</p>
          <textarea className="field h-[60vh] font-mono text-xs" value={jsonText} onChange={(e) => setJsonText(e.target.value)} spellCheck={false} />
        </div>
      ) : (
        <>
          <Card title="Dati generali">
            <div className="grid gap-3 sm:grid-cols-2">
              <Text label="Nome del forno" value={nickname} onChange={setNickname} />
              <Text label="Marca" value={p.brand} onChange={(v) => set("brand", v)} />
              <Text label="Modello" value={p.model} onChange={(v) => set("model", v)} />
              <Num label="Capacità (litri)" value={p.capacityLiters} onChange={(v) => set("capacityLiters", v)} />
              <Num label="Potenza microonde massima resa (W)" value={p.maxOutputWatts} onChange={(v) => set("maxOutputWatts", v)} />
              <div>
                <span className="label">Piatto girevole</span>
                <select
                  className="field"
                  value={p.turntable === null ? "" : p.turntable ? "si" : "no"}
                  onChange={(e) => set("turntable", e.target.value === "" ? null : e.target.value === "si")}
                >
                  <option value="">Non indicato</option>
                  <option value="si">Sì</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
          </Card>

          <Card title="Livelli di potenza" hint="Potenza resa: è quella da usare per i tempi di cottura.">
            <ListEditor
              items={p.powerLevels}
              onChange={(v) => set("powerLevels", v)}
              newItem={() => ({ label: "", percent: null, watts: 0 })}
              addLabel="Aggiungi livello"
              render={(l, upd) => (
                <div className="grid grid-cols-3 gap-2">
                  <Text label="Nome" value={l.label} onChange={(v) => upd({ ...l, label: v })} />
                  <Num label="%" value={l.percent} onChange={(v) => upd({ ...l, percent: v })} />
                  <Num label="Watt" value={l.watts} onChange={(v) => upd({ ...l, watts: v ?? 0 })} />
                </div>
              )}
            />
          </Card>

          <Card title="Potenza assorbita (consumo)" hint="Dalle specifiche tecniche: serve per stimare i consumi, non per i tempi.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["total", "microwave", "grill", "convection"] as const).map((k) => (
                <Num
                  key={k}
                  label={{ total: "Massima (W)", microwave: "Microonde (W)", grill: "Grill (W)", convection: "Ventilato (W)" }[k]}
                  value={p.absorbedWatts[k]}
                  onChange={(v) => set("absorbedWatts", { ...p.absorbedWatts, [k]: v })}
                />
              ))}
            </div>
          </Card>

          <Card title="Modalità di cottura">
            <ListEditor
              items={p.modes}
              onChange={(v) => set("modes", v)}
              newItem={() => ({ id: "other" as ModeId, name: "", panelCode: null, microwaveWatts: [], temperatureC: null, preheatRequired: null, notes: null, source: null })}
              addLabel="Aggiungi modalità"
              render={(m, upd) => (
                <div className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <span className="label">Tipo</span>
                      <select className="field" value={m.id} onChange={(e) => upd({ ...m, id: e.target.value as ModeId })}>
                        {MODE_IDS.map((id) => (
                          <option key={id} value={id}>
                            {MODE_LABELS[id]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Text label="Nome nel manuale" value={m.name} onChange={(v) => upd({ ...m, name: v })} />
                    <Text label="Tasto / sigla" value={m.panelCode ?? ""} onChange={(v) => upd({ ...m, panelCode: v || null })} />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Text
                      label="Potenze microonde (W, separate da virgola)"
                      value={m.microwaveWatts.join(", ")}
                      onChange={(v) => upd({ ...m, microwaveWatts: parseNumberList(v) })}
                    />
                    <Num
                      label="Temperatura min (°C)"
                      value={m.temperatureC?.min ?? null}
                      onChange={(v) => upd({ ...m, temperatureC: v === null ? null : { min: v, max: m.temperatureC?.max ?? v, step: m.temperatureC?.step ?? null } })}
                    />
                    <Num
                      label="Temperatura max (°C)"
                      value={m.temperatureC?.max ?? null}
                      onChange={(v) => upd({ ...m, temperatureC: v === null ? null : { min: m.temperatureC?.min ?? v, max: v, step: m.temperatureC?.step ?? null } })}
                    />
                  </div>
                  <Text label="Note" value={m.notes ?? ""} onChange={(v) => upd({ ...m, notes: v || null })} />
                  <Src source={m.source} />
                </div>
              )}
            />
          </Card>

          <Card title={`Programmi automatici (${p.autoPrograms.length})`}>
            <ListEditor
              items={p.autoPrograms}
              onChange={(v) => set("autoPrograms", v)}
              newItem={() => ({ name: "", button: null, items: [], source: null })}
              addLabel="Aggiungi programma"
              render={(prog, upd) => (
                <details>
                  <summary className="cursor-pointer font-medium">
                    {prog.name || "Nuovo programma"} <span className="text-sm text-stone-500">· {prog.items.length} voci</span>
                  </summary>
                  <div className="mt-2 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Text label="Nome" value={prog.name} onChange={(v) => upd({ ...prog, name: v })} />
                      <Text label="Tasto" value={prog.button ?? ""} onChange={(v) => upd({ ...prog, button: v || null })} />
                    </div>
                    <ListEditor
                      items={prog.items}
                      onChange={(items) => upd({ ...prog, items })}
                      newItem={() => ({ code: "", food: "", portion: null, instructions: null })}
                      addLabel="Aggiungi voce"
                      render={(it, updItem) => (
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-2">
                            <Text label="Codice" value={it.code} onChange={(v) => updItem({ ...it, code: v })} />
                            <Text label="Alimento" value={it.food} onChange={(v) => updItem({ ...it, food: v })} />
                            <Text label="Porzione" value={it.portion ?? ""} onChange={(v) => updItem({ ...it, portion: v || null })} />
                          </div>
                          <Area label="Istruzioni" value={it.instructions ?? ""} onChange={(v) => updItem({ ...it, instructions: v || null })} />
                        </div>
                      )}
                    />
                    <Src source={prog.source} />
                  </div>
                </details>
              )}
            />
          </Card>

          <Card title="Accessori in dotazione">
            <ListEditor
              items={p.accessories}
              onChange={(v) => set("accessories", v)}
              newItem={() => ({ name: "", description: null, allowedModes: [], forbiddenModes: [], source: null })}
              addLabel="Aggiungi accessorio"
              render={(a, upd) => (
                <div className="space-y-2">
                  <Text label="Nome" value={a.name} onChange={(v) => upd({ ...a, name: v })} />
                  <Area label="Descrizione" value={a.description ?? ""} onChange={(v) => upd({ ...a, description: v || null })} />
                  <ModePicker label="Consentito in" value={a.allowedModes} onChange={(v) => upd({ ...a, allowedModes: v })} tone="green" />
                  <ModePicker label="Vietato in" value={a.forbiddenModes} onChange={(v) => upd({ ...a, forbiddenModes: v })} tone="red" />
                  <Src source={a.source} />
                </div>
              )}
            />
          </Card>

          <Card title="Contenitori e materiali">
            <ListEditor
              items={p.containerRules}
              onChange={(v) => set("containerRules", v)}
              newItem={() => ({ material: "", allowedModes: [], forbiddenModes: [], note: null, source: null })}
              addLabel="Aggiungi materiale"
              render={(r, upd) => (
                <div className="space-y-2">
                  <Text label="Materiale" value={r.material} onChange={(v) => upd({ ...r, material: v })} />
                  <ModePicker label="Adatto a" value={r.allowedModes} onChange={(v) => upd({ ...r, allowedModes: v })} tone="green" />
                  <ModePicker label="Non adatto a" value={r.forbiddenModes} onChange={(v) => upd({ ...r, forbiddenModes: v })} tone="red" />
                  <Text label="Nota" value={r.note ?? ""} onChange={(v) => upd({ ...r, note: v || null })} />
                  <Src source={r.source} />
                </div>
              )}
            />
          </Card>

          <Card title={`Avvertenze di sicurezza (${p.safetyWarnings.length})`}>
            <ListEditor
              items={p.safetyWarnings}
              onChange={(v) => set("safetyWarnings", v)}
              newItem={() => ({ text: "", category: "altro" as const, source: null })}
              addLabel="Aggiungi avvertenza"
              render={(w, upd) => (
                <div className="space-y-2">
                  <Area label="Testo" value={w.text} onChange={(v) => upd({ ...w, text: v })} />
                  <div className="flex flex-wrap items-center gap-2">
                    <select className="field w-auto" value={w.category} onChange={(e) => upd({ ...w, category: e.target.value as typeof w.category })}>
                      {(["materiali", "uso", "alimenti", "pulizia", "bambini", "installazione", "altro"] as const).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <Src source={w.source} />
                  </div>
                </div>
              )}
            />
          </Card>

          <Card title="Risoluzione dei problemi">
            <ListEditor
              items={p.troubleshooting}
              onChange={(v) => set("troubleshooting", v)}
              newItem={() => ({ problem: "", solution: "", source: null })}
              addLabel="Aggiungi problema"
              render={(t, upd) => (
                <div className="space-y-2">
                  <Text label="Problema" value={t.problem} onChange={(v) => upd({ ...t, problem: v })} />
                  <Area label="Soluzione" value={t.solution} onChange={(v) => upd({ ...t, solution: v })} />
                  <Src source={t.source} />
                </div>
              )}
            />
          </Card>

          <Card title="Codici di errore">
            <ListEditor
              items={p.errorCodes}
              onChange={(v) => set("errorCodes", v)}
              newItem={() => ({ code: "", meaning: "", action: "", source: null })}
              addLabel="Aggiungi codice"
              render={(c, upd) => (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <Text label="Codice" value={c.code} onChange={(v) => upd({ ...c, code: v })} />
                    <div className="col-span-2">
                      <Text label="Significato" value={c.meaning} onChange={(v) => upd({ ...c, meaning: v })} />
                    </div>
                  </div>
                  <Area label="Cosa fare" value={c.action} onChange={(v) => upd({ ...c, action: v })} />
                  <Src source={c.source} />
                </div>
              )}
            />
          </Card>

          <Card title="Note dell'estrazione" hint="Dati mancanti o ambigui segnalati durante la lettura del manuale.">
            <Area label="Note" value={p.notes ?? ""} onChange={(v) => set("notes", v || null)} />
          </Card>
        </>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Salvataggio…" : props.confirmed ? "Salva modifiche" : "Conferma e salva"}
        </button>
        <button type="button" className="btn-danger" onClick={remove}>
          Elimina
        </button>
        {status && (
          <div role="status" className={`w-full text-sm ${status.kind === "ok" ? "text-green-700" : "text-red-700"}`}>
            {status.message}
            {status.details && (
              <ul className="list-disc pl-5">
                {status.details.slice(0, 8).map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function parseNumberList(s: string): number[] {
  return s
    .split(/[,;\s]+/)
    .map((x) => Number(x.replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function Card(props: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="text-lg font-semibold">{props.title}</h2>
      {props.hint && <p className="mb-2 text-sm text-stone-500">{props.hint}</p>}
      <div className="mt-2">{props.children}</div>
    </section>
  );
}

function Text(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="label">{props.label}</span>
      <input className="field" value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </label>
  );
}

function Area(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="label">{props.label}</span>
      <textarea className="field min-h-16" value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </label>
  );
}

function Num(props: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="block">
      <span className="label">{props.label}</span>
      <input
        className="field"
        inputMode="decimal"
        value={props.value ?? ""}
        onChange={(e) => {
          const raw = e.target.value.replace(",", ".").trim();
          if (raw === "") return props.onChange(null);
          const n = Number(raw);
          if (Number.isFinite(n)) props.onChange(n);
        }}
      />
    </label>
  );
}

function ModePicker(props: { label: string; value: ModeId[]; onChange: (v: ModeId[]) => void; tone: "green" | "red" }) {
  const on = props.tone === "green" ? "bg-green-100 text-green-800 border-green-300" : "bg-red-100 text-red-800 border-red-300";
  return (
    <div>
      <span className="label">{props.label}</span>
      <div className="flex flex-wrap gap-1">
        {MODE_IDS.map((id) => {
          const active = props.value.includes(id);
          return (
            <button
              type="button"
              key={id}
              aria-pressed={active}
              className={`rounded-full border px-2 py-1 text-xs ${active ? on : "border-stone-300 text-stone-500 dark:border-stone-700"}`}
              onClick={() => props.onChange(active ? props.value.filter((m) => m !== id) : [...props.value, id])}
            >
              {MODE_LABELS[id]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SourceChip(props: { source: string | null; sections: Map<string, SectionRef> }) {
  if (!props.source) return <span className="text-xs text-stone-400">Fonte: non indicata</span>;
  const s = props.sections.get(props.source);
  return (
    <a
      href={`#sez-${props.source}`}
      onClick={() => {
        const el = document.getElementById(`sez-${props.source}`);
        if (el instanceof HTMLDetailsElement) el.open = true;
      }}
      className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 hover:bg-brand-100 dark:bg-stone-800 dark:text-stone-300"
    >
      📖 {s ? `${s.title} · p. ${s.pageFrom}` : props.source}
    </a>
  );
}

function ListEditor<T>(props: {
  items: T[];
  onChange: (items: T[]) => void;
  newItem: () => T;
  addLabel: string;
  render: (item: T, update: (item: T) => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {props.items.map((item, i) => (
        <div key={i} className="relative rounded-xl border border-stone-200 p-3 pr-10 dark:border-stone-800">
          {props.render(item, (next) => props.onChange(props.items.map((x, j) => (j === i ? next : x))))}
          <button
            type="button"
            aria-label="Rimuovi"
            className="absolute right-2 top-2 rounded-lg px-2 py-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
            onClick={() => props.onChange(props.items.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="btn-secondary" onClick={() => props.onChange([...props.items, props.newItem()])}>
        + {props.addLabel}
      </button>
    </div>
  );
}
