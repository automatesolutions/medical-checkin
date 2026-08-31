import { serve } from "@hono/node-server";
import { getDb, incidents, migrate, seed } from "@medical/db";
import { createApp } from "./app.js";

const port = Number(process.env.PORT || 8787);
const hostname = "0.0.0.0";

try {
  await migrate();
  if (process.env.AUTO_SEED !== "0") {
    const { db } = await getDb();
    const rows = await db.select().from(incidents);
    if (rows.length === 0) await seed();
  }
} catch (err) {
  console.error("startup database init failed", err);
  process.exit(1);
}

const { app } = await createApp();
serve({ fetch: app.fetch, port, hostname }, () => {
  console.log(`api listening on ${hostname}:${port} mode=${process.env.SERVICE_MODE || "all"}`);
});
