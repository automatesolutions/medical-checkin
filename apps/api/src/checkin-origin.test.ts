import { describe, expect, it } from "vitest";
import { resolvePublicCheckinOrigin } from "./checkin-origin.js";

describe("resolvePublicCheckinOrigin", () => {
  it("warns when PUBLIC_CHECKIN_ORIGIN is unset", () => {
    const r = resolvePublicCheckinOrigin({});
    expect(r.base).toBe("http://localhost:5174");
    expect(r.originConfigured).toBe(false);
    expect(r.warning).toMatch(/PUBLIC_CHECKIN_ORIGIN is not set/i);
  });

  it("warns for localhost origin", () => {
    const r = resolvePublicCheckinOrigin({ PUBLIC_CHECKIN_ORIGIN: "http://localhost:5174/" });
    expect(r.base).toBe("http://localhost:5174");
    expect(r.originConfigured).toBe(true);
    expect(r.warning).toMatch(/localhost/i);
  });

  it("warns when admin host is used by mistake", () => {
    const r = resolvePublicCheckinOrigin({
      PUBLIC_CHECKIN_ORIGIN: "https://medical-admin-669775206679.us-central1.run.app"
    });
    expect(r.warning).toMatch(/Admin host/i);
  });

  it("accepts a public check-in Cloud Run URL", () => {
    const r = resolvePublicCheckinOrigin({
      PUBLIC_CHECKIN_ORIGIN: "https://medical-checkin-669775206679.us-central1.run.app/"
    });
    expect(r.base).toBe("https://medical-checkin-669775206679.us-central1.run.app");
    expect(r.originConfigured).toBe(true);
    expect(r.warning).toBeNull();
  });
});
