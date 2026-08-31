import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

function staticResponse(reqPath: string): Response | null {
  const root = process.env.STATIC_DIR;
  if (!root) return null;
  const path = reqPath === "/" ? "/index.html" : reqPath;
  const file = join(root, path.replace(/^\//, ""));
  const fallback = join(root, "index.html");
  const target = existsSync(file) && !path.endsWith("/") ? file : fallback;
  if (!existsSync(target)) return null;
  const buf = readFileSync(target);
  const ext = target.split(".").pop();
  const types: Record<string, string> = {
    html: "text/html; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    css: "text/css; charset=utf-8",
    svg: "image/svg+xml",
    png: "image/png",
    json: "application/json"
  };
  return new Response(buf, {
    status: 200,
    headers: { "Content-Type": types[ext ?? ""] ?? "application/octet-stream" }
  });
}

// Bind PORT immediately and serve the web UI even while DB bootstrap runs.
const boot = new Hono();
boot.get("/health", (c) => c.json(bootPayload()));
boot.all("/api/*", (c) => c.json({ ...bootPayload(), error: lastError || "API not ready" }, 503));
boot.all("*", async (c) => {
  const staticRes = staticResponse(c.req.path);
  if (staticRes) return staticRes;
  return c.json(bootPayload());
});

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
    stage = "importing-db";
    console.log("bootstrap: import @medical/db");
    const { getDb, incidents, migrate, seed } = await withTimeout(
      import("@medical/db"),
      15000,
      "import @medical/db"
    );

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

    stage = "importing-app";
    console.log("bootstrap: import createApp");
    const { createApp } = await withTimeout(import("./app.js"), 15000, "import createApp");

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
