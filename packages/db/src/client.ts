import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import postgres from "postgres";
import * as schema from "./schema.js";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type Db = ReturnType<typeof drizzlePglite<typeof schema>> | ReturnType<typeof drizzlePg<typeof schema>>;

let cached: { db: Db; migrateSql: (sql: string) => Promise<void> } | null = null;

export function resetDbCache() {
  cached = null;
}

export async function getDb(): Promise<{ db: Db; migrateSql: (sql: string) => Promise<void> }> {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (url && url.startsWith("postgres")) {
    const client = postgres(url, { max: 8 });
    const db = drizzlePg(client, { schema });
    cached = {
      db,
      migrateSql: async (sql) => {
        await client.unsafe(sql);
      }
    };
    return cached;
  }
  const file = process.env.PGLITE_PATH || resolve(process.cwd(), ".data/checkin");
  mkdirSync(dirname(file), { recursive: true });
  const pglite = new PGlite(file);
  await pglite.waitReady;
  const db = drizzlePglite(pglite, { schema });
  cached = {
    db,
    migrateSql: async (sql) => {
      await pglite.exec(sql);
    }
  };
  return cached;
}

export { schema };
