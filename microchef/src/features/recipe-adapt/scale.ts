import { formatDuration, roundCookingSeconds } from "@/features/power-converter/logic";
import { scaleCookingSeconds } from "@/features/portions/logic";
import type { AdaptedStep } from "./schema";

/** Al microonde il tempo dipende dalla quantità; in convezione e grill molto meno (conta lo spessore). */
export function scalesWithQuantity(s: Pick<AdaptedStep, "mode">): boolean {
  return s.mode === "microwave" || s.mode === "defrost" || s.mode === "steam" || (s.mode?.startsWith("combi") ?? false);
}

/** Durate e pause di un passaggio per un dato rapporto di porzioni (nuove / originali). */
export function scaleStep(s: AdaptedStep, ratio: number) {
  const scaled = ratio !== 1 && s.durationSeconds !== null && scalesWithQuantity(s);
  const durationSeconds = s.durationSeconds && scaled ? scaleCookingSeconds(s.durationSeconds, ratio, roundCookingSeconds) : s.durationSeconds;
  const durationMaxSeconds = s.durationMaxSeconds && scaled ? scaleCookingSeconds(s.durationMaxSeconds, ratio, roundCookingSeconds) : s.durationMaxSeconds;
  const pauses = scaled && durationSeconds
    ? s.pauses.map((p) => p.replace(/dopo circa [^)]+/, `dopo circa ${formatDuration(roundCookingSeconds(durationSeconds / 2))}`))
    : s.pauses;
  // aggiorna anche il tempo scritto nell'istruzione ("per 10 min" → "per 15 min 30 s")
  let instruction = s.instruction;
  if (scaled && s.durationSeconds && durationSeconds) {
    if (s.durationMaxSeconds && durationMaxSeconds) {
      instruction = instruction.replace(`${formatDuration(s.durationSeconds)}-${formatDuration(s.durationMaxSeconds)}`, `${formatDuration(durationSeconds)}-${formatDuration(durationMaxSeconds)}`);
    }
    instruction = instruction.replace(formatDuration(s.durationSeconds), formatDuration(durationSeconds));
  }
  return { scaled, durationSeconds, durationMaxSeconds, pauses, instruction };
}
