import { Hono } from "hono";
import { cors } from "hono/cors";
import { getDb } from "@medical/db";
import QRCode from "qrcode";
import { Store } from "./store.js";
import {
  DOCUMENT_TYPES,
  type DocumentType,
  type FormPayload,
  type MedicalPlanPayload,
  type PersonOverrides
} from "@medical/domain";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export async function createApp() {
  const { db } = await getDb();
  const store = new Store(db);
  const mode = process.env.SERVICE_MODE || "all";
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: (origin) => origin || "*",
      allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
      allowHeaders: ["Content-Type", "X-Goog-Authenticated-User-Email", "X-Dev-Actor"]
    })
  );

  const actor = (c: { req: { header: (n: string) => string | undefined } }) => {
    const iap = c.req.header("x-goog-authenticated-user-email");
    if (iap) return iap.replace(/^accounts\.google\.com:/i, "");
    return c.req.header("x-dev-actor") || process.env.DEV_ACTOR_EMAIL || "dev@local";
  };

  const fail = (err: unknown) => {
    const e = err as { status?: number; message?: string; errors?: unknown };
    return { status: e.status ?? 500, body: { error: e.message ?? "Error", errors: e.errors } };
  };

  app.get("/health", (c) => c.json({ ok: true, mode }));

  if (mode === "all" || mode === "checkin") {
    app.get("/api/public/incidents/:slug", async (c) => {
      const inc = await store.getIncidentBySlug(c.req.param("slug"));
      if (!inc) return c.json({ error: "Not found" }, 404);
      return c.json({
        slug: inc.slug,
        name: inc.name,
        number: inc.number,
        fireEmail: inc.fireEmail,
        timezone: inc.timezone,
        status: inc.status
      });
    });

    app.post("/api/public/incidents/:slug/responses", async (c) => {
      try {
        const body = (await c.req.json()) as Partial<FormPayload>;
        const result = await store.submit(c.req.param("slug"), body);
        return c.json({
          ok: true,
          formsResponseId: result.formsResponseId,
          fireEmail: (await store.getIncidentBySlug(c.req.param("slug")))?.fireEmail
        });
      } catch (err) {
        const f = fail(err);
        return c.json(f.body, f.status as 400);
      }
    });
  }

  if (mode === "all" || mode === "admin") {
    const admin = new Hono();
    admin.use("*", async (c, next) => {
      if (mode === "admin" && process.env.REQUIRE_IAP === "1") {
        if (!c.req.header("x-goog-authenticated-user-email") && !c.req.header("x-dev-actor")) {
          return c.json({ error: "Unauthorized" }, 401);
        }
      }
      await next();
    });

    admin.get("/me", (c) => c.json({ email: actor(c) }));
    admin.get("/incidents", async (c) => c.json(await store.listIncidents()));
    admin.post("/incidents", async (c) => {
      const body = await c.req.json();
      const rec = await store.createCleanIncident({ ...body, actor: actor(c) });
      return c.json(rec, 201);
    });
    admin.patch("/incidents/:id", async (c) => {
      const rec = await store.patchIncident(c.req.param("id"), await c.req.json(), actor(c));
      return c.json(rec);
    });
    admin.post("/incidents/:id/close", async (c) => {
      await store.closeIncident(c.req.param("id"), actor(c));
      return c.json({ ok: true });
    });
    admin.get("/incidents/:id/roster", async (c) => c.json(await store.roster(c.req.param("id"))));
    admin.get("/incidents/:id/glide", async (c) => c.json(await store.glide(c.req.param("id"))));
    admin.get("/incidents/:id/review", async (c) => c.json(await store.reviewQueue(c.req.param("id"))));
    admin.get("/incidents/:id/documents", async (c) => {
      const data = await store.roster(c.req.param("id"));
      return c.json({
        types: DOCUMENT_TYPES,
        rows: data.people.map((p) => ({
          personId: p.id,
          name: `${p.submitted.firstName} ${p.submitted.lastName}`,
          sub: `${p.resource?.callSign ?? "—"} · ${p.submitted.position}`,
          docs: p.docs,
          verifier: Object.values(p.docs).includes("Verified") ? actor(c) : "—"
        })),
        fireEmail: data.incident.fireEmail
      });
    });
    admin.get("/incidents/:id/qr", async (c) => {
      const inc = await store.getIncident(c.req.param("id"));
      if (!inc) return c.json({ error: "Not found" }, 404);
      const base = process.env.PUBLIC_CHECKIN_ORIGIN || "http://localhost:5174";
      const url = `${base.replace(/\/$/, "")}/c/${inc.slug}`;
      const png = await QRCode.toDataURL(url, { margin: 1, width: 256 });
      return c.json({ url, png });
    });
    admin.get("/incidents/:id/medical-plan", async (c) => {
      try {
        return c.json(await store.getMedicalPlan(c.req.param("id")));
      } catch (err) {
        const f = fail(err);
        return c.json(f.body, f.status as 404);
      }
    });
    admin.put("/incidents/:id/medical-plan", async (c) => {
      try {
        const body = (await c.req.json()) as Partial<MedicalPlanPayload>;
        return c.json(await store.saveMedicalPlan(c.req.param("id"), body, actor(c)));
      } catch (err) {
        const f = fail(err);
        return c.json(f.body, f.status as 404);
      }
    });
    admin.get("/people/:id", async (c) => c.json(await store.personDetail(c.req.param("id"))));
    admin.patch("/people/:id/overrides", async (c) => {
      const body = (await c.req.json()) as PersonOverrides;
      return c.json(await store.patchOverrides(c.req.param("id"), body, actor(c)));
    });
    admin.post("/people/:id/review/link", async (c) => {
      const { resourceId } = (await c.req.json()) as { resourceId: string };
      await store.reviewLink(c.req.param("id"), resourceId, actor(c));
      return c.json({ ok: true });
    });
    admin.post("/people/:id/review/provisional", async (c) => {
      return c.json(await store.reviewProvisional(c.req.param("id"), actor(c)));
    });
    admin.post("/people/:id/documents/:type/cycle", async (c) => {
      const type = decodeURIComponent(c.req.param("type")) as DocumentType;
      return c.json(await store.cycleDocument(c.req.param("id"), type, actor(c)));
    });

    app.route("/api", admin);
  }

  app.notFound(async (c) => {
    const root = process.env.STATIC_DIR;
    if (!root) return c.json({ error: "Not found" }, 404);
    const reqPath = c.req.path === "/" ? "/index.html" : c.req.path;
    const file = join(root, reqPath.replace(/^\//, ""));
    const fallback = join(root, "index.html");
    const target = existsSync(file) && !reqPath.endsWith("/") ? file : fallback;
    if (!existsSync(target)) return c.json({ error: "Not found" }, 404);
    const buf = readFileSync(target);
    const ext = target.split(".").pop();
    const types: Record<string, string> = {
      html: "text/html",
      js: "text/javascript",
      css: "text/css",
      svg: "image/svg+xml",
      png: "image/png",
      json: "application/json"
    };
    return c.body(buf, 200, { "Content-Type": types[ext ?? ""] ?? "application/octet-stream" });
  });

  return { app, store };
}
