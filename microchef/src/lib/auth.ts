/**
 * Accesso con un'unica password condivisa (variabile APP_PASSWORD).
 * Il cookie di sessione contiene un HMAC della password: chi non la conosce non può crearlo,
 * e cambiando la password tutte le sessioni esistenti decadono. Usa solo Web Crypto,
 * quindi funziona sia nel middleware (edge) sia nelle API (Node).
 */

export const SESSION_COOKIE = "mc_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // un anno: sul telefono si accede una volta sola

export async function sessionToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("microchef-session-v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Confronto a tempo costante, per non rivelare quanti caratteri coincidono. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Percorsi raggiungibili senza password (pagina di accesso e file necessari per installare l'app). */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/api/login" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/_next/")
  );
}
