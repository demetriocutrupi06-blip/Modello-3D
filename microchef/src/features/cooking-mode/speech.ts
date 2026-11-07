/**
 * Comandi vocali e testi da leggere ad alta voce, in italiano. Funzioni pure.
 */

export type VoiceCommand = "next" | "previous" | "repeat" | "remaining" | "startTimer" | "pauseTimer" | "ingredients" | "stop";

const COMMANDS: { cmd: VoiceCommand; re: RegExp }[] = [
  { cmd: "remaining", re: /quanto (manca|ci vuole|resta|rimane)|tempo (rimanente|restante)|a che punto/ },
  { cmd: "startTimer", re: /(avvia|fai partire|parti|inizia|start|riprendi|accendi).{0,12}\b(timer|conto|tempo)|^(avvia|start|via)$/ },
  { cmd: "pauseTimer", re: /(pausa|metti in pausa|ferma|stop|blocca).{0,12}\b(timer|conto|tempo)|^pausa$/ },
  { cmd: "next", re: /(prossim|successiv|avanti|vai avanti|passaggio dopo|continua|fatto)/ },
  { cmd: "previous", re: /(indietro|precedente|torna|passaggio prima)/ },
  { cmd: "repeat", re: /(ripeti|rileggi|ancora una volta|leggi|cosa devo fare|non ho capito)/ },
  { cmd: "ingredients", re: /ingredient/ },
  { cmd: "stop", re: /(smetti di ascoltare|basta comandi|disattiva (la )?voce)/ },
];

export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const t = transcript
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.,!?]/g, "")
    .trim();
  if (!t) return null;
  return COMMANDS.find((c) => c.re.test(t))?.cmd ?? null;
}

/** Durata detta a voce: "4 minuti e 30 secondi", "un minuto", "45 secondi". */
export function spokenDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const parts: string[] = [];
  if (h) parts.push(h === 1 ? "un'ora" : `${h} ore`);
  if (m) parts.push(m === 1 ? "un minuto" : `${m} minuti`);
  if (r || parts.length === 0) parts.push(r === 1 ? "un secondo" : `${r} secondi`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}` : parts[0];
}

/** Rende leggibili per la sintesi vocale sigle e simboli. */
export function toSpeakable(text: string): string {
  return text
    .replace(/(\d+)\s*°\s*C/g, "$1 gradi")
    .replace(/(\d+)\s*W\b/g, "$1 watt")
    .replace(/\bCb-(\d)/g, "C B $1")
    .replace(/(\d+) min (\d+) s\b/g, "$1 minuti e $2 secondi")
    .replace(/(\d+) h (\d+) min\b/g, "$1 ore e $2 minuti")
    .replace(/(\d+) min\b/g, "$1 minuti")
    .replace(/(\d+) s\b/g, "$1 secondi")
    .replace(/\s*\+\s*/g, " più ")
    .replace(/[📖⏱🧰💡⚠️]/gu, "");
}

export function stepSpeech(n: number, total: number, instruction: string, pauses: string[], timerSeconds: number | null): string {
  const parts = [`Passaggio ${n} di ${total}.`, instruction];
  if (pauses.length) parts.push(pauses.join(". ") + ".");
  if (timerSeconds) parts.push(`Quando sei pronto, di' "avvia timer" per ${spokenDuration(timerSeconds)}.`);
  return toSpeakable(parts.join(" "));
}

export function remainingSpeech(remainingSeconds: number | null, running: boolean): string {
  if (remainingSeconds === null) return "Questo passaggio non ha un timer.";
  if (remainingSeconds === 0) return "Il tempo è finito.";
  return `${running ? "Mancano" : "Il timer è in pausa, mancano"} ${spokenDuration(remainingSeconds)}.`;
}
