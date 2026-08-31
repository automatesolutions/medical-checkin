import { RESTRICTED_FIELD_KEYS, type FormPayload } from "./types.js";

export const QUICK_VIEW_SAFE_KEYS = [
  "firstName",
  "lastName",
  "position",
  "medicalCertification",
  "phone",
  "company",
  "resourceOrderRaw",
  "dateAssigned",
  "firstWorkDay",
  "assignmentLength",
  "isReassignment",
  "reassignmentFrom"
] as const;

export function redactRestricted<T extends Partial<FormPayload>>(payload: T): T {
  const copy = { ...payload };
  for (const k of RESTRICTED_FIELD_KEYS) {
    if (k in copy) (copy as Record<string, unknown>)[k] = "Restricted";
  }
  return copy;
}

export function publicIncidentView(incident: {
  name: string;
  number: string;
  fireEmail: string;
  timezone: string;
  status: string;
  slug: string;
}) {
  return incident;
}
