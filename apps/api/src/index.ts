import { serve } from "@hono/node-server";
import { getDb, incidents, migrate, seed } from "@medical/db";
import { createApp } from "./app.js";

const port = Number(process.env.PORT || 8787);
const hostname = "0.0.0.0";

function logDbEnv() {
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
}

logDbEnv();

// Open PORT before DB work so Cloud Run startup checks can succeed.
const { app } = await createApp();
serve({ fetch: app.fetch, port, hostname }, () => {
  console.log(`api listening on ${hostname}:${port} mode=${process.env.SERVICE_MODE || "all"}`);
});

try {
  await migrate();
  if (process.env.AUTO_SEED !== "0") {
    const { db } = await getDb();
    const rows = await db.select().from(incidents);
    if (rows.length === 0) await seed();
  }
  console.log("database init complete");
} catch (err) {
  console.error("startup database init failed", err);
  // Stay up so revision logs remain available; API routes that need DB will error.
}
