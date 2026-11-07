"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MODE_LABELS } from "@/features/oven-profile/schema";
import { formatDuration } from "@/features/power-converter/logic";
import { scaleIngredient } from "@/features/portions/logic";
import type { StoredAdaptation } from "@/features/recipe-adapt/schema";
import { scaleStep } from "@/features/recipe-adapt/scale";
import {
  notify,
  playAlarm,
  requestNotificationPermission,
  speak,
  speechRecognitionSupported,
  speechSynthesisSupported,
  stopSpeaking,
  unlockAudio,
  useLatest,
  useSpeechRecognition,
  useWakeLock,
} from "../browser";
import { parseVoiceCommand, remainingSpeech, stepSpeech, toSpeakable } from "../speech";
import { addSeconds, createTimer, formatClock, isDone, isRunning, markNotified, pause, remainingMs, reset, start, type TimerState } from "../timer";

export function CookingMode({ id, data, servings }: { id: string; data: StoredAdaptation; servings: number }) {
  const ratio = servings / data.servings;
  const steps = useMemo(() => data.steps.map((s) => ({ ...s, ...scaleStep(s, ratio) })), [data.steps, ratio]);
  const ingredients = useMemo(() => data.ingredients.map((i) => scaleIngredient(i.text, ratio).text), [data.ingredients, ratio]);
  const total = steps.length;

  // -1 = ingredienti, 0..total-1 = passaggi, total = fine
  const [idx, setIdx] = useState(-1);
  const [timers, setTimers] = useState<Record<number, TimerState>>({});
  const [now, setNow] = useState(() => Date.now());
  const [readAloud, setReadAloud] = useState(false);
  const [voice, setVoice] = useState(false);
  const [notifState, setNotifState] = useState<string>("");
  // le API vocali esistono solo nel browser: le mostriamo dopo il montaggio per evitare differenze con il server
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const wake = useWakeLock(true);
  const step = idx >= 0 && idx < total ? steps[idx] : null;
  const timer = step && step.durationSeconds ? (timers[idx] ?? createTimer(step.durationSeconds)) : null;

  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(h);
  }, []);

  // fine di un timer: allarme, notifica, voce
  useEffect(() => {
    for (const [k, t] of Object.entries(timers)) {
      if (isDone(t, now) && !t.notified) {
        const n = Number(k) + 1;
        playAlarm();
        void notify("⏰ Tempo scaduto", `Passaggio ${n}: ${steps[Number(k)]?.instruction ?? ""}`);
        if (readAloud || voice) speak(`Tempo finito per il passaggio ${n}.`);
        setTimers((prev) => ({ ...prev, [k]: markNotified(prev[Number(k)]) }));
      }
    }
  }, [now, timers, steps, readAloud, voice]);

  const readCurrent = useLatest(() => {
    if (idx === -1) speak(toSpeakable(`Ingredienti per ${servings} porzioni: ${ingredients.join(", ")}.`));
    else if (step) speak(stepSpeech(idx + 1, total, step.instruction, step.pauses, step.durationSeconds));
    else speak("Hai finito. Buon appetito!");
  });

  // lettura automatica al cambio di schermata
  useEffect(() => {
    if (readAloud) readCurrent();
  }, [idx, readAloud, readCurrent]);

  useEffect(() => () => stopSpeaking(), []);

  const go = (d: number) => setIdx((i) => Math.min(total, Math.max(-1, i + d)));

  const updateTimer = (fn: (t: TimerState, now: number) => TimerState) => {
    if (!step?.durationSeconds) return;
    unlockAudio();
    const t = Date.now();
    setTimers((prev) => ({ ...prev, [idx]: fn(prev[idx] ?? createTimer(step.durationSeconds!), t) }));
  };

  const onVoice = useLatest((text: string) => {
    const cmd = parseVoiceCommand(text);
    switch (cmd) {
      case "next":
        go(1);
        break;
      case "previous":
        go(-1);
        break;
      case "repeat":
        readCurrent();
        break;
      case "ingredients":
        setIdx(-1);
        speak(toSpeakable(`Ingredienti: ${ingredients.join(", ")}.`));
        break;
      case "remaining":
        speak(remainingSpeech(timer ? Math.ceil(remainingMs(timer, Date.now()) / 1000) : null, timer ? isRunning(timer) : false));
        break;
      case "startTimer":
        if (timer) {
          updateTimer(start);
          speak("Timer avviato.");
        } else speak("Questo passaggio non ha un timer.");
        break;
      case "pauseTimer":
        if (timer) {
          updateTimer(pause);
          speak("Timer in pausa.");
        }
        break;
      case "stop":
        setVoice(false);
        speak("Comandi vocali disattivati.");
        break;
    }
  });
  const { status: voiceStatus, lastHeard } = useSpeechRecognition(voice, onVoice);

  async function toggleVoice() {
    unlockAudio();
    if (!voice) await enableNotifications();
    setVoice((v) => !v);
  }

  async function enableNotifications() {
    const p = await requestNotificationPermission();
    setNotifState(p === "granted" ? "" : p === "denied" ? "Notifiche bloccate nelle impostazioni del browser: resterà solo l'avviso sonoro." : "");
  }

  const otherRunning = Object.entries(timers)
    .map(([k, t]) => ({ k: Number(k), t }))
    // timer di altri passaggi: in corso, oppure finiti da meno di 2 minuti
    .filter(({ k, t }) => k !== idx && t.endsAt !== null && now - t.endsAt < 120_000);

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-stone-50 dark:bg-stone-950">
      {/* barra superiore */}
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-4 py-2 dark:border-stone-800">
        <Link href={`/ricette/${id}`} className="text-sm font-medium text-stone-600 dark:text-stone-300" onClick={() => stopSpeaking()}>
          ✕ Esci
        </Link>
        <div className="truncate text-sm font-semibold">{data.title}</div>
        <div className="text-xs text-stone-500" title="Schermo sempre acceso">
          {wake === "attivo" ? "☀️ acceso" : wake === "non_supportato" ? "" : "…"}
        </div>
      </div>

      {/* avanzamento */}
      <div className="h-1.5 bg-stone-200 dark:bg-stone-800" aria-hidden>
        <div className="h-full bg-brand-600 transition-all" style={{ width: `${((idx + 1) / (total + 1)) * 100}%` }} />
      </div>

      {/* timer di altri passaggi ancora in corso */}
      {otherRunning.map(({ k, t }) => (
        <button
          key={k}
          type="button"
          onClick={() => setIdx(k)}
          className={`flex items-center justify-between px-4 py-2 text-sm font-medium ${isDone(t, now) ? "animate-pulse bg-red-600 text-white" : "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"}`}
        >
          <span>⏱ Passaggio {k + 1}</span>
          <span className="font-mono text-base">{isDone(t, now) ? "FINITO" : formatClock(remainingMs(t, now))}</span>
        </button>
      ))}

      {/* contenuto */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-2xl space-y-5">
          {idx === -1 && (
            <>
              <h1 className="text-3xl font-bold">Ingredienti</h1>
              <p className="text-lg text-stone-500">Per {servings} porzioni</p>
              <ul className="space-y-3 text-2xl leading-snug">
                {ingredients.map((i, k) => (
                  <li key={k} className="flex gap-3">
                    <span className="text-brand-600">•</span>
                    {i}
                  </li>
                ))}
              </ul>
            </>
          )}

          {step && (
            <>
              <div className="text-lg font-semibold text-brand-600">
                Passaggio {idx + 1} di {total}
              </div>
              <p className="text-3xl font-bold leading-snug sm:text-4xl">{step.instruction}</p>
              {step.mode !== null && (
                <div className="flex flex-wrap gap-2 text-xl">
                  <Big>{step.modeLabel ?? MODE_LABELS[step.mode]}</Big>
                  {step.powerWatts && <Big>{step.powerLabel ?? ""} {step.powerWatts} W</Big>}
                  {step.temperatureC && <Big>{step.temperatureC} °C</Big>}
                  {step.accessory && <Big>🧰 {step.accessory}</Big>}
                </div>
              )}
              {timer && (
                <div className={`rounded-3xl p-5 text-center ${isDone(timer, now) ? "animate-pulse bg-red-600 text-white" : "bg-white shadow dark:bg-stone-900"}`}>
                  <div className="font-mono text-7xl font-bold tabular-nums sm:text-8xl" aria-live="off">
                    {isDone(timer, now) ? "Fatto!" : formatClock(remainingMs(timer, now))}
                  </div>
                  {step.durationMaxSeconds && <div className="mt-1 text-sm opacity-80">Fino a {formatDuration(step.durationMaxSeconds)} se serve</div>}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {isRunning(timer) ? (
                      <button type="button" className="btn-secondary min-h-16 text-xl" onClick={() => updateTimer(pause)}>
                        ⏸ Pausa
                      </button>
                    ) : (
                      <button type="button" className="btn-primary min-h-16 text-xl" onClick={() => { void enableNotifications(); updateTimer(start); }}>
                        ▶ {timer.remainingMs < timer.durationMs && timer.remainingMs > 0 ? "Riprendi" : "Avvia"}
                      </button>
                    )}
                    <button type="button" className="btn-secondary min-h-16 text-xl" onClick={() => updateTimer((t, n) => addSeconds(t, 30, n))}>
                      +30 s
                    </button>
                    <button type="button" className="btn-secondary min-h-16 text-xl" onClick={() => updateTimer((t) => reset(t))}>
                      ↺ Azzera
                    </button>
                  </div>
                </div>
              )}
              {step.container && <p className="text-xl text-stone-700 dark:text-stone-300">Contenitore: {step.container}</p>}
              {step.pauses.length > 0 && (
                <ul className="list-disc space-y-1 pl-6 text-xl text-stone-700 dark:text-stone-300">
                  {step.pauses.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              {step.note && <p className="text-lg text-stone-600 dark:text-stone-400">💡 {step.note}</p>}
              {step.scaled && <p className="text-base text-amber-700 dark:text-amber-300">Tempo adattato a {servings} porzioni: controlla a metà cottura.</p>}

            </>
          )}

          {idx === total && (
            <div className="space-y-4 text-center">
              <div className="text-7xl">🍽️</div>
              <h1 className="text-3xl font-bold">Buon appetito!</h1>
              <p className="text-lg text-stone-600 dark:text-stone-400">Hai completato tutti i passaggi.</p>
              <Link href={`/ricette/${id}`} className="btn-primary min-h-14 text-lg" onClick={() => stopSpeaking()}>
                Torna alla ricetta
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* voce */}
      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-stone-200 px-4 py-2 text-sm dark:border-stone-800">
        {mounted && speechSynthesisSupported() && (
          <>
            <button type="button" className="btn-secondary min-h-10 px-3 py-1 text-sm" onClick={() => readCurrent()}>
              🔊 Leggi
            </button>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={readAloud} onChange={(e) => setReadAloud(e.target.checked)} className="accent-brand-600" />
              Leggi sempre
            </label>
          </>
        )}
        {!mounted ? null : speechRecognitionSupported() ? (
          <button type="button" aria-pressed={voice} className={`min-h-10 rounded-xl px-3 py-1 text-sm font-semibold ${voice ? "bg-green-600 text-white" : "border border-stone-300 bg-white text-stone-800 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"}`} onClick={toggleVoice}>
            🎙️ {voice ? (voiceStatus === "in_ascolto" ? "In ascolto" : voiceStatus === "errore" ? "Microfono bloccato" : "…") : "Comandi vocali"}
          </button>
        ) : (
          <span className="text-xs text-stone-500">Comandi vocali non disponibili in questo browser (usa Chrome o Edge).</span>
        )}
        {voice && lastHeard && <span className="w-full text-center text-xs text-stone-500">Ho sentito: “{lastHeard}”</span>}
        {voice && <span className="w-full text-center text-xs text-stone-500">Di&apos;: “prossimo passaggio”, “indietro”, “ripeti”, “quanto manca?”, “avvia timer”, “pausa timer”</span>}
        {notifState && <span className="w-full text-center text-xs text-amber-700">{notifState}</span>}
      </div>

      {/* navigazione */}
      <div className="grid grid-cols-2 gap-3 border-t border-stone-200 p-3 dark:border-stone-800">
        <button type="button" className="btn-secondary min-h-16 text-xl" onClick={() => go(-1)} disabled={idx === -1}>
          ◀ Indietro
        </button>
        <button type="button" className="btn-primary min-h-16 text-xl" onClick={() => { unlockAudio(); go(1); }} disabled={idx === total}>
          {idx === -1 ? "Inizia ▶" : idx === total - 1 ? "Fine ✓" : "Avanti ▶"}
        </button>
      </div>
    </div>
  );
}

function Big({ children }: { children: React.ReactNode }) {
  return <span className="rounded-xl bg-brand-50 px-3 py-1.5 font-semibold text-brand-700 dark:bg-stone-800 dark:text-brand-100">{children}</span>;
}
