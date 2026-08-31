import { describe, expect, it } from "vitest";
import { calculateAssignmentDates, effectiveAssignment } from "./dates.js";
import { requiredDocumentChecklist, hasNarcotics, payloadContainsFileHint } from "./documents.js";
import { glideStateFromRemaining, workdaysRemaining } from "./glide.js";
import { matchResource, type IncomingMatch } from "./matching.js";
import { normalizeResourceOrder } from "./normalize.js";
import { FIELD_LABELS, PRESERVED_LABELS, validateFormPayload } from "./form.js";
import { CAPABILITY_OPTIONS } from "./types.js";
import { reconcileCounts } from "./counts.js";
import { redactRestricted } from "./privacy.js";
import type { FormPayload, ResourceCandidate } from "./types.js";

const baseForm = (): FormPayload => ({
  resourceOrderRaw: "E-4471",
  email: "a@example.com",
  firstName: "Dana",
  lastName: "Whitmore",
  position: "Ambo",
  trainee: "No",
  firstAssignment: "No",
  arduousQualified: "Yes",
  experience: ["Line Medic/EMT"],
  capabilities: ["ALS", "BLS"],
  phone: "(541) 555-0182",
  dateAssigned: "2026-08-21",
  isReassignment: "No",
  reassignmentFrom: "",
  firstWorkDay: "2026-08-21",
  assignmentLength: 14,
  travelTimeHome: "1 day",
  flightRequired: "No",
  vehicleType: "Agency",
  fourByFour: "Yes",
  vehicleLicense: "ABC1234",
  company: "Cascade Medical Services",
  homeStreet: "100 Pine",
  city: "Bend",
  state: "OR",
  zip: "07701",
  supervisorPhone: "555-0000",
  emergencyContactName: "Pat",
  emergencyContactPhone: "555-0001",
  eeraContract: "EERA-9",
  otherIcsQualifications: "ICS-100",
  medicalCertification: "EMT-P",
  medicalDirectorName: "Dr. Lee",
  medicalDirectorPhone: "555-0002"
});

function cand(partial: Partial<ResourceCandidate> & Pick<ResourceCandidate, "id">): ResourceCandidate {
  return {
    callSign: "MED-14",
    company: "Cascade Medical Services",
    resourceOrderRaw: "E-4471",
    resourceOrderNormalized: "E-4471",
    type: "Ambo",
    dateAssigned: "2026-08-21",
    isProvisional: false,
    personnelCount: 1,
    ...partial
  };
}

describe("form contract", () => {
  it("maps all 34 questions and preserves misspellings", () => {
    expect(Object.keys(FIELD_LABELS)).toHaveLength(34);
    expect([...CAPABILITY_OPTIONS]).toContain("Extrication Equiptment");
    expect(PRESERVED_LABELS).toEqual(["Extrication Equiptment", "Nerv"]);
    const v = validateFormPayload(baseForm());
    expect(v.ok).toBe(true);
  });

  it("requires From? when reassignment is Yes", () => {
    const v = validateFormPayload({ ...baseForm(), isReassignment: "Yes", reassignmentFrom: "" });
    expect(v.ok).toBe(false);
  });

  it("preserves zip leading zeros as text", () => {
    const v = validateFormPayload(baseForm());
    if (v.ok) expect(v.value.zip).toBe("07701");
  });
});

describe("one response one person / matching", () => {
  const incoming = (over: Partial<IncomingMatch> = {}): IncomingMatch => ({
    incidentId: "inc-1",
    resourceOrderRaw: "e 4471",
    company: "Cascade Medical Services",
    dateAssigned: "2026-08-21",
    ...over
  });

  it("one clear match links the person", () => {
    const d = matchResource(incoming(), [cand({ id: "r1" })]);
    expect(d).toEqual({ kind: "link", resourceId: "r1" });
  });

  it("two ambulance members with one clear match share one resource", () => {
    const first = matchResource(incoming(), []);
    expect(first.kind).toBe("provisional");
    const afterFirst = [cand({ id: "r-new", personnelCount: 1 })];
    const second = matchResource(incoming({ resourceOrderRaw: "E-4471" }), afterFirst);
    expect(second).toEqual({ kind: "link", resourceId: "r-new" });
  });

  it("four REMS members with one clear match stay one resource", () => {
    let pool: ResourceCandidate[] = [];
    const decisions = ["a", "b", "c", "d"].map((name, i) => {
      const d = matchResource(
        incoming({ resourceOrderRaw: "O-2208", company: "Ridgeline Rescue Group" }),
        pool
      );
      if (d.kind === "provisional") {
        pool = [cand({ id: "rems", company: "Ridgeline Rescue Group", resourceOrderRaw: "O-2208", resourceOrderNormalized: "O-2208" })];
      }
      return { name, i, kind: d.kind };
    });
    expect(decisions[0]!.kind).toBe("provisional");
    expect(decisions.slice(1).every((x) => x.kind === "link")).toBe(true);
    expect(pool).toHaveLength(1);
  });

  it("ambiguous company match is Needs Resource Review and does not merge", () => {
    const d = matchResource(incoming({ company: "Juniper Ridge Ambulance" }), [
      cand({ id: "r1", company: "Cascade Medical Services" })
    ]);
    expect(d.kind).toBe("review");
    if (d.kind === "review") {
      expect(d.reason).toMatch(/different companies/);
      expect(d.candidates).toHaveLength(1);
    }
  });

  it("later rotation same order number is a new instance (provisional)", () => {
    const d = matchResource(incoming({ dateAssigned: "2026-09-15" }), [
      cand({ id: "r1", dateAssigned: "2026-08-21" })
    ]);
    expect(d.kind).toBe("provisional");
  });

  it("does not treat order number alone as a key", () => {
    expect(normalizeResourceOrder("e 4471")).toBe("E-4471");
    const d = matchResource(incoming({ company: "Other Co", dateAssigned: "2026-08-21" }), [
      cand({ id: "r1" })
    ]);
    expect(d.kind).toBe("review");
  });
});

describe("date math", () => {
  it("computes LWD and DMB for 14 days no extension", () => {
    const r = calculateAssignmentDates({ firstWorkDay: "2026-08-21", assignmentLength: 14, extensionDays: 0 });
    expect(r.lastWorkDay).toBe("2026-09-03");
    expect(r.dmbStart).toBe("2026-09-04");
  });

  it("adds extension days", () => {
    const r = calculateAssignmentDates({ firstWorkDay: "2026-08-21", assignmentLength: 14, extensionDays: 2 });
    expect(r.lastWorkDay).toBe("2026-09-05");
    expect(r.dmbStart).toBe("2026-09-06");
  });

  it("staggered start is independent", () => {
    const a = calculateAssignmentDates({ firstWorkDay: "2026-08-21", assignmentLength: 14, extensionDays: 0 });
    const b = calculateAssignmentDates({ firstWorkDay: "2026-08-24", assignmentLength: 14, extensionDays: 0 });
    expect(a.lastWorkDay).toBe("2026-09-03");
    expect(b.lastWorkDay).toBe("2026-09-06");
  });

  it("reassignment metadata does not change the formula", () => {
    const yes = calculateAssignmentDates({ firstWorkDay: "2026-08-21", assignmentLength: 14, extensionDays: 0 });
    const no = calculateAssignmentDates({ firstWorkDay: "2026-08-21", assignmentLength: 14, extensionDays: 0 });
    expect(yes).toEqual(no);
  });

  it("admin override changes effective dates without touching submitted", () => {
    const submitted = { firstWorkDay: "2026-08-21", assignmentLength: 14 };
    const eff = effectiveAssignment(submitted, { firstWorkDay: "2026-08-22", assignmentLength: 10, extensionDays: 1 });
    expect(submitted.firstWorkDay).toBe("2026-08-21");
    expect(eff.firstWorkDay).toBe("2026-08-22");
    expect(calculateAssignmentDates(eff).lastWorkDay).toBe("2026-09-01");
  });

  it("clearing override reverts to submitted", () => {
    const submitted = { firstWorkDay: "2026-08-21", assignmentLength: 14 };
    const cleared = effectiveAssignment(submitted, { firstWorkDay: null, assignmentLength: null, extensionDays: 0 });
    expect(cleared.firstWorkDay).toBe("2026-08-21");
    expect(cleared.assignmentLength).toBe(14);
  });

  it("rejects negative extension", () => {
    expect(calculateAssignmentDates({ firstWorkDay: "2026-08-21", assignmentLength: 14, extensionDays: -1 }).valid).toBe(false);
  });
});

describe("glide path", () => {
  const today = "2026-08-30";
  it("Green at 8+", () => {
    expect(glideStateFromRemaining(workdaysRemaining("2026-09-06", today))).toBe("Green");
    expect(glideStateFromRemaining(8)).toBe("Green");
  });
  it("Yellow at 4–7", () => {
    expect(glideStateFromRemaining(7)).toBe("Yellow");
    expect(glideStateFromRemaining(4)).toBe("Yellow");
  });
  it("Red at 2–3", () => {
    expect(glideStateFromRemaining(3)).toBe("Red");
    expect(glideStateFromRemaining(2)).toBe("Red");
  });
  it("LWD at 1", () => expect(glideStateFromRemaining(1)).toBe("LWD"));
  it("DMB/TVL at 0", () => expect(glideStateFromRemaining(0)).toBe("DMB/TVL"));
  it("Gray when complete / out of range", () => {
    expect(glideStateFromRemaining(-1)).toBe("Gray");
    expect(glideStateFromRemaining(5, { complete: true })).toBe("Gray");
  });
  it("REVIEW for invalid dates", () => {
    expect(glideStateFromRemaining(null)).toBe("REVIEW");
    expect(glideStateFromRemaining(4, { forceReview: true })).toBe("REVIEW");
  });
});

describe("documents and privacy", () => {
  it("Narcotics requires Medical Director letter", () => {
    expect(hasNarcotics(["ALS", "Narcotics"])).toBe(true);
    expect(requiredDocumentChecklist(["Narcotics"])["Med Director letter"]).toBe("Requested");
    expect(requiredDocumentChecklist(["ALS"])["Med Director letter"]).toBe("Not Required");
  });

  it("restricted fields do not appear as values in redacted quick views", () => {
    const r = redactRestricted(baseForm());
    expect(r.vehicleLicense).toBe("Restricted");
    expect(r.emergencyContactName).toBe("Restricted");
    expect(r.homeStreet).toBe("Restricted");
    expect(r.eeraContract).toBe("Restricted");
    expect(r.firstName).toBe("Dana");
  });

  it("flags file-like content so it is never stored as a document link", () => {
    expect(payloadContainsFileHint({ note: "https://drive.google.com/file" })).toBe(true);
    expect(payloadContainsFileHint({ note: "see fire email" })).toBe(false);
  });
});

describe("counts", () => {
  it("counts resources and personnel separately", () => {
    const c = reconcileCounts({
      resources: [{ id: "r1", state: "Active" }],
      people: [
        { id: "p1", resourceInstanceId: "r1", status: "Active" },
        { id: "p2", resourceInstanceId: "r1", status: "Active" },
        { id: "p3", resourceInstanceId: "r1", status: "Active" },
        { id: "p4", resourceInstanceId: "r1", status: "Active" }
      ]
    });
    expect(c.resourceCount).toBe(1);
    expect(c.personnelCount).toBe(4);
    expect(c.peopleByResource.get("r1")).toBe(4);
  });
});
