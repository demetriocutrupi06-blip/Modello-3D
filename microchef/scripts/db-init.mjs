// Crea le tabelle nel database Turso al primo avvio (eseguito durante la build su Vercel).
// Se TURSO_DATABASE_URL non è impostata (uso in locale con SQLite) non fa nulla.
// Lo schema SQL è generato da prisma/schema.prisma con:
//   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/init.sql
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.log("db-init: TURSO_DATABASE_URL non impostata, salto (database locale).");
  process.exit(0);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const existing = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Oven'");
if (existing.rows.length > 0) {
  console.log("db-init: tabelle già presenti.");
} else {
  await client.executeMultiple(readFileSync(new URL("../prisma/init.sql", import.meta.url), "utf8"));
  console.log("db-init: tabelle create.");
}
client.close();
