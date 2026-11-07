"use client";
/**
 * Accesso alle API del browser usate dalla modalità cucina, con controlli di disponibilità:
 * Wake Lock (schermo acceso), Web Audio (allarme), Notification, Vibration, Web Speech (voce).
 */
import { useCallback, useEffect, useRef, useState } from "react";

// ---------- schermo sempre acceso ----------

export function useWakeLock(enabled: boolean): "attivo" | "non_supportato" | "inattivo" {
  const [state, setState] = useState<"attivo" | "non_supportato" | "inattivo">("inattivo");
  useEffect(() => {
    if (!enabled) return;
    if (!("wakeLock" in navigator)) {
      setState("non_supportato");
      return;
    }
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) return void lock.release();
        setState("attivo");
        lock.addEventListener("release", () => setState("inattivo"));
      } catch {
        setState("inattivo");
      }
    };
    // il blocco viene rilasciato quando la scheda va in background: lo riprendiamo al ritorno
    const onVisible = () => document.visibilityState === "visible" && acquire();
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [enabled]);
  return state;
}

// ---------- allarme sonoro ----------

let audioCtx: AudioContext | null = null;

/** Da chiamare dentro un gesto dell'utente (clic): i browser bloccano l'audio partito da solo. */
export function unlockAudio() {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
  } catch {
    // audio non disponibile
  }
}

export function playAlarm(repeats = 3) {
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    const t0 = ctx.currentTime + 0.05;
    for (let r = 0; r < repeats; r++) {
      for (let i = 0; i < 3; i++) {
        const start = t0 + r * 1.2 + i * 0.22;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.18);
      }
    }
  } catch {
    // audio non disponibile
  }
  if ("vibrate" in navigator) navigator.vibrate([400, 150, 400, 150, 400]);
}

// ---------- notifiche ----------

export async function requestNotificationPermission(): Promise<NotificationPermission | "non_supportato"> {
  if (!("Notification" in window)) return "non_supportato";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

export async function notify(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: "/icons/icon-192.png", tag: "microchef-timer" });
    else new Notification(title, { body, icon: "/icons/icon-192.png", tag: "microchef-timer" });
  } catch {
    // alcuni browser mobili accettano solo le notifiche dal service worker
  }
}

// ---------- sintesi vocale ----------

export function speechSynthesisSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string) {
  if (!speechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "it-IT";
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("it"));
  if (voice) u.voice = voice;
  u.rate = 1;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (speechSynthesisSupported()) window.speechSynthesis.cancel();
}

// ---------- riconoscimento vocale ----------

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}

function getRecognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechRecognitionSupported() {
  return getRecognitionCtor() !== null;
}

/**
 * Ascolto continuo in italiano. Chiama onTranscript per ogni frase riconosciuta.
 * Si riavvia da solo quando il browser interrompe l'ascolto (succede dopo pochi secondi di silenzio).
 */
export function useSpeechRecognition(enabled: boolean, onTranscript: (text: string) => void) {
  const [status, setStatus] = useState<"spento" | "in_ascolto" | "errore" | "non_supportato">("spento");
  const [lastHeard, setLastHeard] = useState("");
  const cb = useRef(onTranscript);
  cb.current = onTranscript;

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!enabled) {
      setStatus(Ctor ? "spento" : "non_supportato");
      return;
    }
    if (!Ctor) {
      setStatus("non_supportato");
      return;
    }
    let active = true;
    const rec = new Ctor();
    rec.lang = "it-IT";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const text = e.results[i][0].transcript.trim();
          setLastHeard(text);
          cb.current(text);
        }
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        active = false;
        setStatus("errore");
      }
    };
    rec.onend = () => {
      if (active) {
        try {
          rec.start();
        } catch {
          // già avviato
        }
      } else setStatus((s) => (s === "errore" ? s : "spento"));
    };
    try {
      rec.start();
      setStatus("in_ascolto");
    } catch {
      setStatus("errore");
    }
    return () => {
      active = false;
      rec.stop();
    };
  }, [enabled]);

  return { status, lastHeard };
}

/** Rende stabile una callback che legge sempre lo stato più recente. */
export function useLatest<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback(((...args: Parameters<T>) => ref.current(...args)) as T, []);
}
