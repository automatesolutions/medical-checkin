import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb, migrate, resetDbCache, seed } from "@medical/db";
import { Store } from "./store.js";
import type { FormPayload } from "@medical/domain";

process.env.PGLITE_PATH = mkdtempSync(join(tmpdir(), "mci-"));
resetDbCache();

const person = (over: Partial<FormPayload> = {}): FormPayload => ({
  resourceOrderRaw: "E-9001",
  email: "t@example.com",
  firstName: "Test",
  lastName: "User",
  position: "Ambo",
  trainee: "No",
  firstAssignment: "No",
  arduousQualified: "Yes",
  experience: [],
  capabilities: ["BLS"],
  phone: "555-0101",
  dateAssigned: "2026-08-21",
  isReassignment: "No",
  reassignmentFrom: "",
  firstWorkDay: "2026-08-21",
  assignmentLength: 14,
  travelTimeHome: "1",
  flightRequired: "No",
  vehicleType: "Agency",
  fourByFour: "No",
  vehicleLicense: "NONE",
  company: "Test Ambulance",
  homeStreet: "1 St",
  city: "Bend",
  state: "OR",
  zip: "97701",
  supervisorPhone: "1",
  emergencyContactName: "E",
  emergencyContactPhone: "2",
  eeraContract: "X",
  otherIcsQualifications: "",
  medicalCertification: "EMT-B",
  medicalDirectorName: "D",
  medicalDirectorPhone: "3",
  ...over
});

let store: Store;

beforeAll(async () => {
  await migrate();
  const { db } = await getDb();
  store = new Store(db);
  await store.createCleanIncident({
    name: "Test Fire",
    number: "OR-TST-000001",
    timezone: "America/Los_Angeles",
    fireEmail: "test@firenet.gov",
    actor: "test"
  });
});

describe("RFC completion via store", () => {
  it("one valid response creates exactly one person", async () => {
    const r = await store.submit("test-fire", person({ firstName: "One", lastName: "Only", email: "one@x.com" }));
    const roster = await store.roster((await store.getIncidentBySlug("test-fire"))!.id);
    expect(r.personId).toBeTruthy();
    expect(roster.people.filter((p) => p.id === r.personId)).toHaveLength(1);
    expect(roster.responses.filter((x) => x.formsResponseId === r.formsResponseId)).toHaveLength(1);
  });

  it("two ambulance responses with one clear match share one resource", async () => {
    const slug = "two-ambo";
    await store.createCleanIncident({
      name: "Two Ambo",
      number: "OR-TST-000002",
      timezone: "UTC",
      fireEmail: "a@b.co",
      actor: "test"
    });
    const a = await store.submit(slug, person({ firstName: "A", lastName: "Ambo", email: "a@x.com", company: "Co A", resourceOrderRaw: "E-1111" }));
    const b = await store.submit(slug, person({ firstName: "B", lastName: "Ambo", email: "b@x.com", company: "Co A", resourceOrderRaw: "E-1111" }));
    expect(a.resourceInstanceId).toBeTruthy();
    expect(b.resourceInstanceId).toBe(a.resourceInstanceId);
    const roster = await store.roster((await store.getIncidentBySlug(slug))!.id);
    expect(roster.counts.resourceCount).toBe(1);
    expect(roster.counts.personnelCount).toBe(2);
  });

  it("four REMS responses create one resource and four people", async () => {
    const slug = "four-rems";
    await store.createCleanIncident({
      name: "Four Rems",
      number: "OR-TST-000003",
      timezone: "UTC",
      fireEmail: "a@b.co",
      actor: "test"
    });
    const ids = [];
    for (const n of ["W", "X", "Y", "Z"]) {
      ids.push(
        await store.submit(
          slug,
          person({
            firstName: n,
            lastName: "Rems",
            email: `${n}@x.com`,
            position: "REMS",
            company: "Ridgeline Rescue Group",
            resourceOrderRaw: "O-2208",
            dateAssigned: "2026-08-24",
            firstWorkDay: "2026-08-24"
          })
        )
      );
    }
    expect(new Set(ids.map((i) => i.resourceInstanceId)).size).toBe(1);
    const roster = await store.roster((await store.getIncidentBySlug(slug))!.id);
    expect(roster.counts.resourceCount).toBe(1);
    expect(roster.counts.personnelCount).toBe(4);
  });

  it("ambiguous match lands in review and does not merge", async () => {
    const slug = "ambig";
    await store.createCleanIncident({
      name: "Ambig",
      number: "OR-TST-000004",
      timezone: "UTC",
      fireEmail: "a@b.co",
      actor: "test"
    });
    await store.submit(slug, person({ company: "Cascade Medical Services", resourceOrderRaw: "E-4471", email: "c@x.com", firstName: "C" }));
    const r = await store.submit(slug, person({ company: "Juniper Ridge Ambulance", resourceOrderRaw: "E-4471", email: "j@x.com", firstName: "J" }));
    expect(r.status).toBe("Needs Resource Review");
    expect(r.resourceInstanceId).toBeNull();
    const roster = await store.roster((await store.getIncidentBySlug(slug))!.id);
    expect(roster.counts.resourceCount).toBe(1);
    expect(roster.people.filter((p) => p.status === "Needs Resource Review")).toHaveLength(1);
  });

  it("later rotation same order number is a new instance", async () => {
    const slug = "rotation";
    await store.createCleanIncident({
      name: "Rotation",
      number: "OR-TST-000005",
      timezone: "UTC",
      fireEmail: "a@b.co",
      actor: "test"
    });
    const a = await store.submit(slug, person({ dateAssigned: "2026-08-21", firstWorkDay: "2026-08-21", email: "r1@x.com", firstName: "R1" }));
    const b = await store.submit(slug, person({ dateAssigned: "2026-09-20", firstWorkDay: "2026-09-20", email: "r2@x.com", firstName: "R2" }));
    expect(a.resourceInstanceId).not.toBe(b.resourceInstanceId);
    const roster = await store.roster((await store.getIncidentBySlug(slug))!.id);
    expect(roster.resources).toHaveLength(2);
    expect(roster.resources[0]!.id).toBe(a.resourceInstanceId);
  });

  it("admin edits do not mutate stored response", async () => {
    const slug = "override";
    await store.createCleanIncident({
      name: "Override",
      number: "OR-TST-000006",
      timezone: "UTC",
      fireEmail: "a@b.co",
      actor: "test"
    });
    const r = await store.submit(slug, person({ firstWorkDay: "2026-08-21", assignmentLength: 14, email: "o@x.com", firstName: "Ov" }));
    const before = (await store.personDetail(r.personId)).person!.submitted.firstWorkDay;
    const patched = await store.patchOverrides(r.personId, { firstWorkDay: "2026-08-25", assignmentLength: 10 }, "admin@test");
    expect(patched.payload).toMatchObject({ firstWorkDay: "2026-08-21", assignmentLength: 14 });
    expect(before).toBe("2026-08-21");
    const after = await store.personDetail(r.personId);
    expect(after.person!.effective.firstWorkDay).toBe("2026-08-25");
    expect(after.person!.submitted.firstWorkDay).toBe("2026-08-21");
  });

  it("narcotics creates required medical director letter", async () => {
    const slug = "narcs";
    await store.createCleanIncident({
      name: "Narcs",
      number: "OR-TST-000007",
      timezone: "UTC",
      fireEmail: "a@b.co",
      actor: "test"
    });
    const r = await store.submit(slug, person({ capabilities: ["Narcotics"], email: "n@x.com", firstName: "Nar" }));
    const d = await store.personDetail(r.personId);
    expect(d.person!.docs["Med Director letter"]).toBe("Requested");
  });

  it("rejects file-like payload", async () => {
    await expect(
      store.submit("test-fire", person({ otherIcsQualifications: "see https://files.example/doc.pdf", email: "f@x.com", firstName: "File" }))
    ).rejects.toThrow(/File/);
  });

  it("concurrent submits do not lose rows or double-merge badly", async () => {
    const slug = "load";
    await store.createCleanIncident({
      name: "Load",
      number: "OR-TST-000008",
      timezone: "UTC",
      fireEmail: "a@b.co",
      actor: "test"
    });
    const jobs = Array.from({ length: 8 }, (_, i) =>
      store.submit(
        slug,
        person({
          firstName: `L${i}`,
          lastName: "Load",
          email: `l${i}@x.com`,
          company: "Load Co",
          resourceOrderRaw: "E-7777"
        })
      )
    );
    const results = await Promise.all(jobs);
    expect(new Set(results.map((r) => r.personId)).size).toBe(8);
    expect(new Set(results.map((r) => r.formsResponseId)).size).toBe(8);
    const roster = await store.roster((await store.getIncidentBySlug(slug))!.id);
    expect(roster.counts.personnelCount).toBe(8);
    expect(roster.counts.resourceCount).toBe(1);
  });

  it("close and new incident carry no old responses", async () => {
    const old = (await store.getIncidentBySlug("test-fire"))!;
    await store.closeIncident(old.id, "test");
    const neu = await store.createCleanIncident({
      name: "Fresh Start",
      number: "OR-TST-000099",
      timezone: "UTC",
      fireEmail: "fresh@firenet.gov",
      actor: "test"
    });
    expect(await store.assertNoOldData(neu.id, old.id)).toBe(true);
  });
});

describe("schema has no file columns", () => {
  it("does not define upload or public file-link fields", async () => {
    const { db } = await getDb();
    const tables = await db.execute(`
      select column_name from information_schema.columns
      where table_schema = 'public'
    `);
    const names = JSON.stringify(tables).toLowerCase();
    expect(names).not.toMatch(/attachment|upload|file_url|gcs_|blob/);
  });
});

describe("seed isolation", () => {
  it("seed function is available", () => {
    expect(typeof seed).toBe("function");
  });
});
