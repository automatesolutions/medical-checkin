import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate, resetDbCache } from "@medical/db";
import { createApp } from "./app.js";

process.env.PGLITE_PATH = mkdtempSync(join(tmpdir(), "mci-fire-"));
process.env.SERVICE_MODE = "all";
delete process.env.PUBLIC_CHECKIN_ORIGIN;
resetDbCache();

describe("incident fire email + QR API", () => {
  let app: Awaited<ReturnType<typeof createApp>>["app"];

  beforeAll(async () => {
    await migrate();
    ({ app } = await createApp());
  });

  it("rejects create without fireEmail", async () => {
    const res = await app.request("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Dev-Actor": "test@local" },
      body: JSON.stringify({ name: "No Email", number: "OR-1", timezone: "UTC" })
    });
    expect(res.status).toBe(400);
  });

  it("creates with explicit fireEmail and warns on QR when origin unset", async () => {
    const create = await app.request("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Dev-Actor": "test@local" },
      body: JSON.stringify({
        name: "Little Giant",
        number: "OR-LG-000001",
        timezone: "America/Los_Angeles",
        fireEmail: "2026.Littlegiant.medical@firenet.gov"
      })
    });
    expect(create.status).toBe(201);
    const rec = await create.json();
    expect(rec.fireEmail).toBe("2026.Littlegiant.medical@firenet.gov");
    expect(rec.slug).toBe("little-giant");

    const qr = await app.request(`/api/incidents/${rec.id}/qr`, {
      headers: { "X-Dev-Actor": "test@local" }
    });
    expect(qr.status).toBe(200);
    const body = await qr.json();
    expect(body.url).toBe("http://localhost:5174/c/little-giant");
    expect(body.originConfigured).toBe(false);
    expect(body.warning).toMatch(/PUBLIC_CHECKIN_ORIGIN/i);

    const patched = await app.request(`/api/incidents/${rec.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Dev-Actor": "test@local" },
      body: JSON.stringify({ fireEmail: "2026.littlegiant.medical@firenet.gov" })
    });
    expect(patched.status).toBe(200);
    expect((await patched.json()).fireEmail).toBe("2026.littlegiant.medical@firenet.gov");

    const closed = await app.request(`/api/incidents/${rec.id}/close`, {
      method: "POST",
      headers: { "X-Dev-Actor": "test@local" }
    });
    expect(closed.status).toBe(200);

    const reopened = await app.request(`/api/incidents/${rec.id}/reopen`, {
      method: "POST",
      headers: { "X-Dev-Actor": "test@local" }
    });
    expect(reopened.status).toBe(200);
    expect((await reopened.json()).status).toBe("open");
  });
});
