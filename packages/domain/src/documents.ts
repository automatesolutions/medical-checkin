import { DOCUMENT_STATUSES, DOCUMENT_TYPES, type DocumentStatusValue, type DocumentType } from "./types.js";

export const DOCUMENT_STYLE: Record<
  DocumentStatusValue,
  { bg: string; fg: string; border: string }
> = {
  "Not Required": { bg: "#f2efe9", fg: "#8b8072", border: "#e3dbcf" },
  Requested: { bg: "#fbf0d4", fg: "#8a6512", border: "#ecdcae" },
  Received: { bg: "#e7eef7", fg: "#3b5a80", border: "#d2dfee" },
  Verified: { bg: "#e2f0e6", fg: "#2f6b45", border: "#c6e2ce" },
  Rejected: { bg: "#fbe3dd", fg: "#a3381f", border: "#f0cabf" },
  Expired: { bg: "#f6ddd2", fg: "#8f3413", border: "#eec4ad" }
};

export function hasNarcotics(capabilities: string[]): boolean {
  return capabilities.includes("Narcotics");
}

export function requiredDocumentChecklist(capabilities: string[]): Record<DocumentType, DocumentStatusValue> {
  return {
    Contract: "Requested",
    "Driver's License": "Requested",
    NREMT: "Requested",
    "Med Director letter": hasNarcotics(capabilities) ? "Requested" : "Not Required"
  };
}

export function nextDocumentStatus(current: DocumentStatusValue): DocumentStatusValue {
  const i = DOCUMENT_STATUSES.indexOf(current);
  return DOCUMENT_STATUSES[(i + 1) % DOCUMENT_STATUSES.length]!;
}

export function openDocumentCount(statuses: Partial<Record<DocumentType, DocumentStatusValue>>): number {
  return DOCUMENT_TYPES.filter((t) => {
    const s = statuses[t];
    return s && s !== "Verified" && s !== "Not Required";
  }).length;
}

const FILE_HINT = /(https?:\/\/|www\.|\.pdf\b|attachment|upload|file:\/\/|gs:\/\/)/i;

export function payloadContainsFileHint(payload: unknown): boolean {
  return JSON.stringify(payload).search(FILE_HINT) !== -1;
}
