import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const incidents = pgTable("incidents", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  number: text("number").notNull(),
  opPeriod: text("op_period").notNull(),
  timezone: text("timezone").notNull(),
  fireEmail: text("fire_email").notNull(),
  formUrl: text("form_url"),
  status: text("status").notNull().default("open"),
  pinnedToday: text("pinned_today"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const responses = pgTable(
  "responses",
  {
    id: text("id").primaryKey(),
    incidentId: text("incident_id")
      .notNull()
      .references(() => incidents.id),
    formsResponseId: text("forms_response_id").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    payload: jsonb("payload").notNull()
  },
  (t) => ({
    uniq: uniqueIndex("responses_incident_forms_id").on(t.incidentId, t.formsResponseId)
  })
);

export const resourceInstances = pgTable("resource_instances", {
  id: text("id").primaryKey(),
  incidentId: text("incident_id")
    .notNull()
    .references(() => incidents.id),
  callSign: text("call_sign").notNull().default("—"),
  company: text("company").notNull(),
  resourceOrderRaw: text("resource_order_raw").notNull(),
  resourceOrderNormalized: text("resource_order_normalized").notNull(),
  type: text("type").notNull(),
  dateAssigned: text("date_assigned").notNull(),
  state: text("state").notNull(),
  isProvisional: boolean("is_provisional").notNull().default(true)
});

export const people = pgTable("people", {
  id: text("id").primaryKey(),
  incidentId: text("incident_id")
    .notNull()
    .references(() => incidents.id),
  responseId: text("response_id")
    .notNull()
    .references(() => responses.id),
  resourceInstanceId: text("resource_instance_id").references(() => resourceInstances.id),
  status: text("status").notNull(),
  overrides: jsonb("overrides").notNull().default({})
});

export const documentStatuses = pgTable("document_statuses", {
  id: text("id").primaryKey(),
  personId: text("person_id")
    .notNull()
    .references(() => people.id),
  documentType: text("document_type").notNull(),
  status: text("status").notNull(),
  verifier: text("verifier"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  notes: text("notes")
});

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  kind: text("kind").notNull(),
  actor: text("actor").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  before: jsonb("before"),
  after: jsonb("after")
});

export const counters = pgTable("counters", {
  key: text("key").primaryKey(),
  value: integer("value").notNull()
});

/** One Medical Plan (ICS 206-style) document per incident; OP period lives in payload. */
export const medicalPlans = pgTable(
  "medical_plans",
  {
    id: text("id").primaryKey(),
    incidentId: text("incident_id")
      .notNull()
      .references(() => incidents.id),
    payload: jsonb("payload").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by").notNull().default("")
  },
  (t) => ({
    uniq: uniqueIndex("medical_plans_incident").on(t.incidentId)
  })
);
