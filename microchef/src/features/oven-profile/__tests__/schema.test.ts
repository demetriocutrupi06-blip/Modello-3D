import { describe, expect, it } from "vitest";
import { OvenProfile, emptyProfile, normalizeProfile, validateProfile } from "../schema";
import { samsungProfile, samsungSectionIds } from "./fixtures/samsung-profile";

describe("OvenProfile", () => {
  it("accetta un profilo completo e quello vuoto", () => {
    expect(OvenProfile.safeParse(samsungProfile).success).toBe(true);
    expect(OvenProfile.safeParse(emptyProfile()).success).toBe(true);
  });

  it("rifiuta modalità sconosciute", () => {
    const bad = { ...samsungProfile, modes: [{ ...samsungProfile.modes[0], id: "frittura" }] };
    expect(OvenProfile.safeParse(bad).success).toBe(false);
  });
});

describe("validateProfile", () => {
  it("non segnala errori su un profilo coerente", () => {
    expect(validateProfile(samsungProfile, samsungSectionIds)).toEqual([]);
  });

  it("segnala le citazioni a sezioni inesistenti", () => {
    const p = { ...samsungProfile, errorCodes: [{ ...samsungProfile.errorCodes[0], source: "p99-inventata" }] };
    expect(validateProfile(p, samsungSectionIds)).toEqual([expect.stringContaining('"p99-inventata" non esiste')]);
  });

  it("segnala potenze non plausibili o incoerenti", () => {
    const p = { ...samsungProfile, maxOutputWatts: 800 };
    expect(validateProfile(p, samsungSectionIds)).toEqual([expect.stringContaining("maxOutputWatts (800)")]);
    const q = { ...samsungProfile, powerLevels: [{ label: "X", percent: 150, watts: -1 }] };
    expect(validateProfile(q, samsungSectionIds)).toHaveLength(2);
  });
});

describe("normalizeProfile", () => {
  it("ordina i livelli dal più alto e ricava la potenza massima se manca", () => {
    const p = normalizeProfile({ ...samsungProfile, maxOutputWatts: null });
    expect(p.powerLevels.map((l) => l.watts)).toEqual([900, 600, 450, 300, 180, 100]);
    expect(p.maxOutputWatts).toBe(900);
  });
});
