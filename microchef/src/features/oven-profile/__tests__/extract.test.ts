import { describe, expect, it, vi } from "vitest";
import type { LlmCall } from "@/lib/llm/types";
import { extractOvenProfile, formatSectionsForPrompt } from "../extract";
import { samsungProfile } from "./fixtures/samsung-profile";

const sections = [
  { id: "p3-istruzioni-di-sicurezza", title: "Istruzioni di sicurezza", pageFrom: 3, pageTo: 3, text: "Non accendere il forno vuoto.", order: 0 },
  { id: "p14-livelli-di-potenza", title: "Livelli di potenza", pageFrom: 14, pageTo: 14, text: "ALTO 100 % 900 W", order: 1 },
  { id: "p39-codice-errore", title: "Codice errore", pageFrom: 39, pageTo: 39, text: "E-24 surriscaldamento", order: 2 },
];

const reply = (obj: unknown) => {
  const text = JSON.stringify(obj);
  return { text, stopReason: "end_turn", content: [{ type: "text" as const, text }] };
};

describe("extractOvenProfile", () => {
  it("passa al modello le sezioni con i loro id e normalizza il risultato", async () => {
    const call = vi.fn<LlmCall>().mockResolvedValueOnce(reply(samsungProfile));
    const p = await extractOvenProfile({ call, sections, modelHint: "MC28H5015AW" });
    expect(p.powerLevels[0].watts).toBe(900);
    const userText = JSON.stringify(call.mock.calls[0][0].messages[0].content);
    expect(userText).toContain('id=\\"p14-livelli-di-potenza\\"');
    expect(userText).toContain("MC28H5015AW");
  });

  it("riprova se il modello cita una sezione che non esiste", async () => {
    const invented = { ...samsungProfile, errorCodes: [{ ...samsungProfile.errorCodes[0], source: "p40-errori" }] };
    const call = vi.fn<LlmCall>().mockResolvedValueOnce(reply(invented)).mockResolvedValueOnce(reply(samsungProfile));
    const p = await extractOvenProfile({ call, sections });
    expect(call).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(call.mock.calls[1][0].messages[2].content)).toContain("p40-errori");
    expect(p.errorCodes[0].source).toBe("p39-codice-errore");
  });
});

describe("formatSectionsForPrompt", () => {
  it("indica pagina singola o intervallo", () => {
    const out = formatSectionsForPrompt([{ id: "a", title: 'Titolo "x"', pageFrom: 2, pageTo: 4, text: "t" }]);
    expect(out).toContain('pagine="pp. 2-4"');
    expect(out).toContain("titolo=\"Titolo 'x'\"");
  });
});
