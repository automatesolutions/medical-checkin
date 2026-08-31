import { getDb } from "./client.js";

export const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS incidents (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  number text NOT NULL,
  op_period text NOT NULL,
  timezone text NOT NULL,
  fire_email text NOT NULL,
  form_url text,
  status text NOT NULL DEFAULT 'open',
  pinned_today text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS responses (
  id text PRIMARY KEY,
  incident_id text NOT NULL REFERENCES incidents(id),
  forms_response_id text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS responses_incident_forms_id ON responses (incident_id, forms_response_id);
CREATE TABLE IF NOT EXISTS resource_instances (
  id text PRIMARY KEY,
  incident_id text NOT NULL REFERENCES incidents(id),
  call_sign text NOT NULL DEFAULT '—',
  company text NOT NULL,
  resource_order_raw text NOT NULL,
  resource_order_normalized text NOT NULL,
  type text NOT NULL,
  date_assigned text NOT NULL,
  state text NOT NULL,
  is_provisional boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS people (
  id text PRIMARY KEY,
  incident_id text NOT NULL REFERENCES incidents(id),
  response_id text NOT NULL REFERENCES responses(id),
  resource_instance_id text REFERENCES resource_instances(id),
  status text NOT NULL,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS document_statuses (
  id text PRIMARY KEY,
  person_id text NOT NULL REFERENCES people(id),
  document_type text NOT NULL,
  status text NOT NULL,
  verifier text,
  verified_at timestamptz,
  notes text
);
CREATE TABLE IF NOT EXISTS audit_events (
  id text PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  kind text NOT NULL,
  actor text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  "before" jsonb,
  "after" jsonb
);
CREATE TABLE IF NOT EXISTS counters (
  key text PRIMARY KEY,
  value integer NOT NULL
);
`;

export async function migrate() {
  const { migrateSql } = await getDb();
  await migrateSql(MIGRATION_SQL);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("migrate.ts")) {
  migrate().then(() => {
    console.log("migrated");
  });
}
