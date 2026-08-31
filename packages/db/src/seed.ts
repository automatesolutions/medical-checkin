import { migrate } from "./migrate.js";
import { getDb } from "./client.js";
import { auditEvents, counters, documentStatuses, incidents, people, resourceInstances, responses } from "./schema.js";
import { DOCUMENT_TYPES, requiredDocumentChecklist, type FormPayload } from "@medical/domain";

function payload(partial: Partial<FormPayload> & Pick<FormPayload, "firstName" | "lastName" | "position" | "company" | "resourceOrderRaw" | "dateAssigned" | "firstWorkDay" | "phone" | "medicalCertification">): FormPayload {
  return {
    email: `${partial.firstName[0]!.toLowerCase()}.${partial.lastName.toLowerCase().replace(/[^a-z]/g, "")}@example.com`,
    trainee: "No",
    firstAssignment: "No",
    arduousQualified: "Yes",
    experience: ["Line Medic/EMT"],
    capabilities: ["ALS", "BLS"],
    isReassignment: "No",
    reassignmentFrom: "",
    assignmentLength: 14,
    travelTimeHome: "1 day",
    flightRequired: "No",
    vehicleType: "Agency",
    fourByFour: "Yes",
    vehicleLicense: "RESTRICTED-PLATE",
    homeStreet: "100 Agency Rd",
    city: "Bend",
    state: "OR",
    zip: "97701",
    supervisorPhone: "555-0100",
    emergencyContactName: "Restricted contact",
    emergencyContactPhone: "555-0199",
    eeraContract: "EERA-SEED",
    otherIcsQualifications: "ICS-100",
    medicalDirectorName: "Restricted director",
    medicalDirectorPhone: "555-0188",
    ...partial
  };
}

export async function seed() {
  await migrate();
  const { db } = await getDb();

  const existing = await db.select().from(incidents);
  if (existing.some((i) => i.slug === "bearclaw-creek")) {
    console.log("seed already present");
    return;
  }

  const incidentId = "inc-bearclaw";
  await db.insert(incidents).values({
    id: incidentId,
    slug: "bearclaw-creek",
    name: "Bearclaw Creek",
    number: "OR-WIF-000412",
    opPeriod: "OP 14 · Aug 30",
    timezone: "America/Los_Angeles",
    fireEmail: "2026.bearclawcreek@firenet.gov",
    formUrl: "/c/bearclaw-creek",
    status: "open",
    pinnedToday: "2026-08-30"
  });

  const resources = [
    { id: "r1", callSign: "MED-14", company: "Cascade Medical Services", ro: "E-4471", type: "Ambo", date: "2026-08-21", state: "Active", provisional: false },
    { id: "r2", callSign: "REMS-3", company: "Ridgeline Rescue Group", ro: "O-2208", type: "REMS", date: "2026-08-24", state: "Active", provisional: false },
    { id: "r3", callSign: "MED-22", company: "Basin EMS Contracting", ro: "E-4512", type: "EMPF", date: "2026-09-01", state: "Enroute", provisional: false },
    { id: "r5", callSign: "MEDL", company: "Agency", ro: "O-1004", type: "MEDL/MEDLt", date: "2026-08-18", state: "Active", provisional: false }
  ];

  for (const r of resources) {
    await db.insert(resourceInstances).values({
      id: r.id,
      incidentId,
      callSign: r.callSign,
      company: r.company,
      resourceOrderRaw: r.ro,
      resourceOrderNormalized: r.ro,
      type: r.type,
      dateAssigned: r.date,
      state: r.state,
      isProvisional: r.provisional
    });
  }

  const rows: {
    id: string;
    rid: string | null;
    status: string;
    p: FormPayload;
    overrides: Record<string, unknown>;
    docs: Record<string, string>;
  }[] = [
    {
      id: "p1",
      rid: "r1",
      status: "Active",
      p: payload({
        firstName: "Dana",
        lastName: "Whitmore",
        position: "Ambo",
        company: "Cascade Medical Services",
        resourceOrderRaw: "E-4471",
        dateAssigned: "2026-08-21",
        firstWorkDay: "2026-08-21",
        phone: "(541) 555-0182",
        medicalCertification: "EMT-P",
        capabilities: ["ALS", "BLS", "Extrication Equiptment"]
      }),
      overrides: { division: "Div A", camp: "ICP Spike 2" },
      docs: { Contract: "Verified", "Driver's License": "Verified", NREMT: "Verified" }
    },
    {
      id: "p2",
      rid: "r1",
      status: "Active",
      p: payload({
        firstName: "Marcus",
        lastName: "Ellery",
        position: "Ambo",
        company: "Cascade Medical Services",
        resourceOrderRaw: "E-4471",
        dateAssigned: "2026-08-21",
        firstWorkDay: "2026-08-21",
        phone: "(541) 555-0113",
        medicalCertification: "EMT-B",
        capabilities: ["ALS", "BLS", "Extrication Equiptment", "Narcotics"]
      }),
      overrides: { division: "Div A", camp: "ICP Spike 2", extensionDays: 2 },
      docs: { Contract: "Verified", "Driver's License": "Received", NREMT: "Requested", "Med Director letter": "Requested" }
    },
    {
      id: "p3",
      rid: "r2",
      status: "Active",
      p: payload({
        firstName: "Priya",
        lastName: "Raman",
        position: "REMS",
        company: "Ridgeline Rescue Group",
        resourceOrderRaw: "O-2208",
        dateAssigned: "2026-08-24",
        firstWorkDay: "2026-08-24",
        phone: "(208) 555-0177",
        medicalCertification: "EMT-P",
        capabilities: ["ALS", "Narcotics"]
      }),
      overrides: { division: "Div Z", camp: "Bearclaw ICP" },
      docs: { Contract: "Verified", NREMT: "Verified", "Med Director letter": "Requested" }
    },
    {
      id: "p4",
      rid: "r2",
      status: "Active",
      p: payload({
        firstName: "Tomas",
        lastName: "Iriarte",
        position: "REMS",
        company: "Ridgeline Rescue Group",
        resourceOrderRaw: "O-2208",
        dateAssigned: "2026-08-24",
        firstWorkDay: "2026-08-24",
        phone: "(208) 555-0164",
        medicalCertification: "EMT-I"
      }),
      overrides: { division: "Div Z", camp: "Bearclaw ICP" },
      docs: { Contract: "Verified", NREMT: "Verified" }
    },
    {
      id: "p5",
      rid: "r2",
      status: "Active",
      p: payload({
        firstName: "Casey",
        lastName: "Bloom",
        position: "REMS",
        company: "Ridgeline Rescue Group",
        resourceOrderRaw: "O-2208",
        dateAssigned: "2026-08-24",
        firstWorkDay: "2026-08-24",
        phone: "(208) 555-0198",
        medicalCertification: "RN"
      }),
      overrides: { division: "Div Z", camp: "Bearclaw ICP" },
      docs: { Contract: "Received", NREMT: "Verified" }
    },
    {
      id: "p6",
      rid: "r2",
      status: "Active",
      p: payload({
        firstName: "Hollis",
        lastName: "Vandeman",
        position: "REMS",
        company: "Ridgeline Rescue Group",
        resourceOrderRaw: "O-2208",
        dateAssigned: "2026-08-24",
        firstWorkDay: "2026-08-24",
        phone: "(208) 555-0121",
        medicalCertification: "EMT-P"
      }),
      overrides: { division: "Div Z", camp: "Bearclaw ICP" },
      docs: { Contract: "Verified", NREMT: "Expired" }
    },
    {
      id: "p7",
      rid: "r3",
      status: "Enroute",
      p: payload({
        firstName: "Ilse",
        lastName: "Nakagawa",
        position: "EMPF",
        company: "Basin EMS Contracting",
        resourceOrderRaw: "E-4512",
        dateAssigned: "2026-09-01",
        firstWorkDay: "2026-09-01",
        phone: "(503) 555-0146",
        medicalCertification: "EMT-P"
      }),
      overrides: {},
      docs: { Contract: "Requested" }
    },
    {
      id: "p8",
      rid: null,
      status: "Needs Resource Review",
      p: {
        ...payload({
          firstName: "Robert",
          lastName: "Sayles",
          position: "Ambo",
          company: "Juniper Ridge Ambulance",
          resourceOrderRaw: "E-4471",
          dateAssigned: "2026-08-29",
          firstWorkDay: "2026-08-29",
          assignmentLength: 14,
          phone: "(541) 555-0155",
          medicalCertification: "EMT-B"
        }),
        firstWorkDay: ""
      },
      overrides: {},
      docs: { Contract: "Requested" }
    },
    {
      id: "p9",
      rid: "r5",
      status: "Active",
      p: payload({
        firstName: "Ann",
        lastName: "Kessler-Roe",
        position: "MEDL/MEDLt",
        company: "Agency",
        resourceOrderRaw: "O-1004",
        dateAssigned: "2026-08-18",
        firstWorkDay: "2026-08-18",
        assignmentLength: 21,
        phone: "(541) 555-0100",
        medicalCertification: "RN"
      }),
      overrides: { division: "ICP", camp: "Bearclaw ICP" },
      docs: { Contract: "Verified" }
    }
  ];

  let n = 0;
  for (const row of rows) {
    n += 1;
    const responseId = `resp-${row.id}`;
    const formsResponseId = `R-${String(n).padStart(4, "0")}`;
    const p = { ...row.p };
    await db.insert(responses).values({
      id: responseId,
      incidentId,
      formsResponseId,
      payload: p
    });
    await db.insert(people).values({
      id: row.id,
      incidentId,
      responseId,
      resourceInstanceId: row.rid,
      status: row.status,
      overrides: row.overrides
    });
    const checklist = requiredDocumentChecklist(p.capabilities);
    for (const t of DOCUMENT_TYPES) {
      await db.insert(documentStatuses).values({
        id: `doc-${row.id}-${t.replace(/\W/g, "").toLowerCase()}`,
        personId: row.id,
        documentType: t,
        status: row.docs[t] ?? checklist[t]
      });
    }
  }

  await db.insert(counters).values({ key: `forms-response:${incidentId}`, value: n });
  await db.insert(auditEvents).values({
    id: "audit-seed",
    entityType: "incident",
    entityId: incidentId,
    kind: "seed",
    actor: "system",
    before: null,
    after: { slug: "bearclaw-creek" }
  });
  console.log("seeded Bearclaw Creek");
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seed();
}
