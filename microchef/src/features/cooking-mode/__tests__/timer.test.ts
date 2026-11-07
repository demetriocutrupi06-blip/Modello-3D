import { describe, expect, it } from "vitest";
import { addSeconds, createTimer, formatClock, isDone, isRunning, pause, remainingMs, reset, start } from "../timer";

describe("timer", () => {
  it("conta alla rovescia sugli orari assoluti", () => {
    let t = createTimer(90);
    expect(isRunning(t)).toBe(false);
    t = start(t, 1_000);
    expect(remainingMs(t, 31_000)).toBe(60_000);
    expect(isDone(t, 91_000)).toBe(true);
    expect(remainingMs(t, 200_000)).toBe(0);
  });

  it("si mette in pausa e riparte da dove era", () => {
    let t = start(createTimer(60), 0);
    t = pause(t, 20_000);
    expect(remainingMs(t, 999_999)).toBe(40_000);
    t = start(t, 100_000);
    expect(remainingMs(t, 110_000)).toBe(30_000);
  });

  it("aggiunge tempo anche dopo la fine e si azzera", () => {
    let t = start(createTimer(10), 0);
    t = addSeconds(t, 30, 50_000);
    expect(remainingMs(t, 50_000)).toBe(30_000);
    expect(t.notified).toBe(false);
    expect(remainingMs(reset(t), 0)).toBe(10_000);
  });

  it("start e pause sono idempotenti", () => {
    const t = start(createTimer(10), 0);
    expect(start(t, 5_000)).toBe(t);
    const p = pause(t, 2_000);
    expect(pause(p, 3_000)).toBe(p);
  });
});

describe("formatClock", () => {
  it.each([
    [270_000, "04:30"],
    [500, "00:01"],
    [0, "00:00"],
    [3_900_000, "1:05:00"],
  ])("%s ms → %s", (ms, out) => expect(formatClock(ms)).toBe(out));
});
