import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type Db = ReturnType<typeof drizzlePg<typeof schema>>;

let cached: { db: Db; migrateSql: (sql: string) => Promise<void> } | null = null;

export function resetDbCache() {
  cached = null;
}

/** Cloud SQL docs use postgres://user:pass@/db?host=/cloudsql/... — Node's URL parser
 * requires a hostname, so inject localhost before parsing. */
export function normalizeDatabaseUrl(url: string): string {
  return url.replace(/^(postgres(?:ql)?:\/\/[^@]+)@\//, "$1@localhost/");
}

function createPostgresClient(rawUrl: string) {
  const url = normalizeDatabaseUrl(rawUrl);
  const parsed = new URL(url);
  const socketOrHost = parsed.searchParams.get("host");
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const user = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  // Unix socket path from ?host=/cloudsql/PROJECT:REGION:INSTANCE must win over localhost.
  if (socketOrHost?.startsWith("/")) {
    return postgres({
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      database,
      user,
      password,
      host: socketOrHost
    });
  }
  return postgres({
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    database,
    user,
    password,
    host: parsed.hostname,
    port: Number(parsed.port || 5432)
  });
}

export async function getDb(): Promise<{ db: Db; migrateSql: (sql: string) => Promise<void> }> {
  if (cached) return cached;
  const raw = process.env.DATABASE_URL;
  if (raw && (raw.startsWith("postgres://") || raw.startsWith("postgresql://"))) {
    const client = createPostgresClient(raw);
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

  // Local/dev only: lazy-load PGlite so Cloud Run never loads its WASM module.
  const [{ PGlite }, { drizzle: drizzlePglite }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite")
  ]);
  const file = process.env.PGLITE_PATH;
  if (file) {
    mkdirSync(dirname(resolve(file)), { recursive: true });
  }
  const pglite = file ? new PGlite(resolve(file)) : new PGlite();
  await pglite.waitReady;
  const db = drizzlePglite(pglite, { schema }) as unknown as Db;
  cached = {
    db,
    migrateSql: async (sql) => {
      await pglite.exec(sql);
    }
  };
  return cached;
}

export { schema };
