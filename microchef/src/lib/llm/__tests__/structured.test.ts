import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { extractJson, generateStructured, LlmOutputError, LlmRefusalError, toJsonSchema } from "../structured";
import type { LlmCall, LlmResponse } from "../types";

const Schema = z.object({ watts: z.number(), label: z.string() });

function reply(text: string, stopReason = "end_turn"): LlmResponse {
  return { text, stopReason, content: [{ type: "text", text }] };
}

function fakeCall(...responses: LlmResponse[]) {
  const call = vi.fn<LlmCall>();
  responses.forEach((r) => call.mockResolvedValueOnce(r));
  return call;
}

const base = { schema: Schema, system: "sys", content: [{ type: "text" as const, text: "ciao" }] };

describe("generateStructured", () => {
  it("restituisce il JSON valido al primo tentativo", async () => {
    const call = fakeCall(reply('{"watts": 900, "label": "ALTO"}'));
    await expect(generateStructured({ ...base, call })).resolves.toEqual({ watts: 900, label: "ALTO" });
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0][0].jsonSchema).toMatchObject({ type: "object" });
  });

  it("riprova una volta, rimandando la risposta e gli errori", async () => {
    const call = fakeCall(reply('{"watts": "tanti", "label": "ALTO"}'), reply('{"watts": 900, "label": "ALTO"}'));
    await expect(generateStructured({ ...base, call })).resolves.toEqual({ watts: 900, label: "ALTO" });
    expect(call).toHaveBeenCalledTimes(2);
    const retry = call.mock.calls[1][0].messages;
    expect(retry.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(JSON.stringify(retry[2].content)).toContain("watts");
  });

  it("dopo due risposte non valide solleva LlmOutputError", async () => {
    const call = fakeCall(reply("non è json"), reply('{"watts": 1}'));
    await expect(generateStructured({ ...base, call })).rejects.toBeInstanceOf(LlmOutputError);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("usa anche i controlli aggiuntivi per decidere se riprovare", async () => {
    const call = fakeCall(reply('{"watts": 5000, "label": "X"}'), reply('{"watts": 800, "label": "X"}'));
    const validate = (v: { watts: number }) => (v.watts > 3000 ? ["watts troppo alto"] : []);
    await expect(generateStructured({ ...base, call, validate })).resolves.toEqual({ watts: 800, label: "X" });
  });

  it("tratta una risposta troncata come non valida", async () => {
    const call = fakeCall(reply('{"watts": 9', "max_tokens"), reply('{"watts": 900, "label": "ALTO"}'));
    await expect(generateStructured({ ...base, call })).resolves.toMatchObject({ watts: 900 });
  });

  it("non riprova in caso di rifiuto", async () => {
    const call = fakeCall(reply("", "refusal"));
    await expect(generateStructured({ ...base, call })).rejects.toBeInstanceOf(LlmRefusalError);
    expect(call).toHaveBeenCalledTimes(1);
  });
});

describe("extractJson", () => {
  it("tollera i blocchi di codice markdown", () => {
    expect(extractJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });
});

describe("toJsonSchema", () => {
  it("produce oggetti chiusi con tutti i campi obbligatori", () => {
    const js = toJsonSchema(Schema) as { additionalProperties: boolean; required: string[] };
    expect(js.additionalProperties).toBe(false);
    expect(js.required).toEqual(["watts", "label"]);
  });
});
