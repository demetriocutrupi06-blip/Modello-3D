import { describe, expect, it } from "vitest";
import { isPublicPath, safeEqual, sessionToken } from "../auth";

describe("sessionToken", () => {
  it("è stabile per la stessa password e cambia con la password", async () => {
    const a = await sessionToken("pizza123");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await sessionToken("pizza123")).toBe(a);
    expect(await sessionToken("pizza124")).not.toBe(a);
  });
});

describe("safeEqual", () => {
  it("confronta stringhe", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });
});

describe("isPublicPath", () => {
  it("lascia libere solo la pagina di accesso e i file dell'app", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/icons/icon-192.png")).toBe(true);
    expect(isPublicPath("/_next/static/x.js")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/api/ovens")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
  });
});
