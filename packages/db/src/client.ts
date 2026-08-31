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
    const client = postgres(url, { max: 8, connect_timeout: 15 });
    const db = drizzlePg(client, { schema });
    cached = {
      db,
      migrateSql: async (sql) => {
        await client.unsafe(sql);
      }
    };
    return cached;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL must be set to a postgres:// URL in production (Cloud SQL Unix socket form recommended)."
    );
  }
  // Local/dev fallback: in-memory when unset, or file path when PGLITE_PATH is set.
  const file = process.env.PGLITE_PATH;
  if (file) {
    mkdirSync(dirname(resolve(file)), { recursive: true });
  }
  const pglite = file ? new PGlite(resolve(file)) : new PGlite();
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
