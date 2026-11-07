import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

/**
 * In locale: file SQLite (DATABASE_URL).
 * Online (Vercel): database Turso, compatibile con SQLite, tramite l'adattatore libSQL.
 */
function createClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    process.env.DATABASE_URL ??= "file:./unused.db"; // richiesto dallo schema, ignorato con l'adattatore
    return new PrismaClient({ adapter: new PrismaLibSQL({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN }) });
  }
  return new PrismaClient();
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
