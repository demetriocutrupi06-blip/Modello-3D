/**
 * Timer di cottura come stato immutabile basato su orari assoluti (Date.now()):
 * resta preciso anche se la scheda va in background e i setInterval rallentano.
 */

export interface TimerState {
  durationMs: number;
  /** istante di fine se in corso, altrimenti null */
  endsAt: number | null;
  /** tempo rimanente salvato quando è in pausa */
  remainingMs: number;
  /** true quando è già stato segnalato il termine */
  notified: boolean;
}

export function createTimer(seconds: number): TimerState {
  const ms = Math.max(0, Math.round(seconds * 1000));
  return { durationMs: ms, endsAt: null, remainingMs: ms, notified: false };
}

export function isRunning(t: TimerState): boolean {
  return t.endsAt !== null;
}

export function remainingMs(t: TimerState, now: number): number {
  return t.endsAt !== null ? Math.max(0, t.endsAt - now) : t.remainingMs;
}

export function isDone(t: TimerState, now: number): boolean {
  return t.durationMs > 0 && remainingMs(t, now) === 0;
}

export function start(t: TimerState, now: number): TimerState {
  if (t.endsAt !== null) return t;
  const left = t.remainingMs > 0 ? t.remainingMs : t.durationMs;
  return { ...t, endsAt: now + left, remainingMs: left, notified: false };
}

export function pause(t: TimerState, now: number): TimerState {
  if (t.endsAt === null) return t;
  return { ...t, endsAt: null, remainingMs: Math.max(0, t.endsAt - now) };
}

export function reset(t: TimerState): TimerState {
  return createTimer(t.durationMs / 1000);
}

/** Aggiunge (o toglie) tempo, anche a timer finito: utile per "ancora 30 secondi". */
export function addSeconds(t: TimerState, seconds: number, now: number): TimerState {
  const delta = seconds * 1000;
  if (t.endsAt !== null) return { ...t, endsAt: Math.max(now, Math.max(t.endsAt, now) + delta), notified: false };
  return { ...t, remainingMs: Math.max(0, t.remainingMs + delta), notified: false };
}

export function markNotified(t: TimerState): TimerState {
  return { ...t, notified: true };
}

/** "04:30", "1:05:00" */
export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
