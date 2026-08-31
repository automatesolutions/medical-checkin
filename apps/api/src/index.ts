import { createServer } from "node:http";
import { Hono } from "hono";
import { getRequestListener } from "@hono/node-server";

const port = Number(process.env.PORT || 8787);
const hostname = "0.0.0.0";

// Bind PORT immediately — before DB / app imports — so Cloud Run startup checks pass.
const boot = new Hono();
boot.get("/health", (c) => c.json({ ok: true, starting: true }));
boot.all("*", (c) => c.json({ ok: true, starting: true }));

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
    const { getDb, incidents, migrate, seed } = await import("@medical/db");
    const { createApp } = await import("./app.js");

    await migrate();
    if (process.env.AUTO_SEED !== "0") {
      const { db } = await getDb();
      const rows = await db.select().from(incidents);
      if (rows.length === 0) await seed();
    }

    const { app } = await createApp();
    listener = getRequestListener(app.fetch);
    console.log("database init complete");
  } catch (err) {
    console.error("startup bootstrap failed", err);
  }
}
