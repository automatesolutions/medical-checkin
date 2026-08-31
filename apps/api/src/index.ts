import { createServer } from "node:http";
import { Hono } from "hono";
import { getRequestListener } from "@hono/node-server";

const port = Number(process.env.PORT || 8787);
const hostname = "0.0.0.0";

let starting = true;
let stage = "boot";
let lastError: string | null = null;

function bootPayload() {
  return {
    ok: true,
    starting,
    stage,
    databaseUrlSet: Boolean(process.env.DATABASE_URL),
    usesCloudSqlSocket: (process.env.DATABASE_URL || "").includes("/cloudsql/"),
    error: lastError
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

// Bind PORT immediately — before DB / app imports — so Cloud Run startup checks pass.
const boot = new Hono();
boot.get("/health", (c) => c.json(bootPayload()));
boot.all("*", (c) => c.json(bootPayload()));

let listener = getRequestListener(boot.fetch);
const server = createServer((req, res) => listener(req, res));

server.listen(port, hostname, () => {
  console.log(`api listening on ${hostname}:${port}`);
  void bootstrap();
});

async function bootstrap() {
  const url = process.env.DATABASE_URL || "";
  console.log(
    JSON.stringify({
      msg: "db_env",
      databaseUrlSet: Boolean(url),
      scheme: url.split(":")[0] || null,
      usesCloudSqlSocket: url.includes("/cloudsql/"),
      serviceMode: process.env.SERVICE_MODE || "all"
    })
  );

  try {
    stage = "importing";
    const { getDb, incidents, migrate, seed } = await import("@medical/db");
    const { createApp } = await import("./app.js");

    stage = "migrating";
    console.log("bootstrap: migrate start");
    await withTimeout(migrate(), 20000, "migrate");
    console.log("bootstrap: migrate done");

    if (process.env.AUTO_SEED !== "0") {
      stage = "seeding";
      const { db } = await getDb();
      const rows = await withTimeout(db.select().from(incidents), 15000, "seed-check");
      if (rows.length === 0) {
        await withTimeout(seed(), 30000, "seed");
      }
      console.log("bootstrap: seed done");
    }

    stage = "creating-app";
    const { app } = await createApp();
    listener = getRequestListener(app.fetch);
    starting = false;
    stage = "ready";
    lastError = null;
    console.log("database init complete");
  } catch (err) {
    lastError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    stage = "failed";
    console.error("startup bootstrap failed", err);
  }
}
