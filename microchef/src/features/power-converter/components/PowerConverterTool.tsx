"use client";
import { useMemo, useState } from "react";
import { convertPower, formatDuration, parsePowerTime, type PowerLevelLike } from "../logic";

export function PowerConverterTool({ levels, ovenName }: { levels: PowerLevelLike[]; ovenName: string }) {
  const [quick, setQuick] = useState("");
  const [watts, setWatts] = useState("800");
  const [minutes, setMinutes] = useState("5");
  const [seconds, setSeconds] = useState("0");
  const [levelLabel, setLevelLabel] = useState("");

  function applyQuick(text: string) {
    setQuick(text);
    const p = parsePowerTime(text);
    if (p.watts) setWatts(String(p.watts));
    if (p.seconds !== null) {
      setMinutes(String(Math.floor(p.seconds / 60)));
      setSeconds(String(p.seconds % 60));
    }
  }

  const result = useMemo(() => {
    const w = Number(watts.replace(",", "."));
    const total = Number(minutes.replace(",", ".") || 0) * 60 + Number(seconds || 0);
    try {
      return { ok: true as const, r: convertPower({ watts: w, seconds: total }, levels, { levelLabel: levelLabel || undefined }), total };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [watts, minutes, seconds, levelLabel, levels]);

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <label className="block">
          <span className="label">Scrivi o incolla l&apos;indicazione (facoltativo)</span>
          <input className="field" placeholder='es. "Riscaldare 3 min a 750 W"' value={quick} onChange={(e) => applyQuick(e.target.value)} />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="label">Potenza (W)</span>
            <input className="field" inputMode="numeric" value={watts} onChange={(e) => setWatts(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Minuti</span>
            <input className="field" inputMode="decimal" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Secondi</span>
            <input className="field" inputMode="numeric" value={seconds} onChange={(e) => setSeconds(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="label">Livello del tuo forno</span>
          <select className="field" value={levelLabel} onChange={(e) => setLevelLabel(e.target.value)}>
            <option value="">Automatico (il più vicino)</option>
            {levels.map((l) => (
              <option key={l.label} value={l.label}>
                {l.label} · {l.watts} W
              </option>
            ))}
          </select>
        </label>
      </div>

      {result.ok ? (
        <div className="card border-brand-500" aria-live="polite">
          <div className="text-sm text-stone-500">Sul {ovenName} imposta</div>
          <div className="mt-1 text-3xl font-bold">{formatDuration(result.r.seconds)}</div>
          <div className="text-lg">
            a <strong>{result.r.level.label}</strong> ({result.r.level.watts} W)
          </div>
          <p className="mt-2 text-xs text-stone-500">
            Calcolo: {watts} W × {formatDuration(result.total)} = {result.r.level.watts} W × {formatDuration(Math.round(result.r.rawSeconds))} (energia costante), arrotondato.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-300">
            {result.r.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="card text-sm text-red-700">{result.error}</div>
      )}
    </div>
  );
}
