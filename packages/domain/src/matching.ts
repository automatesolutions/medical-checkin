import { normalizeCompany, normalizeResourceOrder } from "./normalize.js";
import type { MatchDecision, ResourceCandidate } from "./types.js";

export type IncomingMatch = {
  incidentId: string;
  resourceOrderRaw: string;
  company: string;
  dateAssigned: string;
};

export function matchResource(incoming: IncomingMatch, existing: ResourceCandidate[]): MatchDecision {
  const ro = normalizeResourceOrder(incoming.resourceOrderRaw);
  const company = normalizeCompany(incoming.company);
  const date = incoming.dateAssigned.trim();

  const sameRo = existing.filter(
    (r) => r.resourceOrderNormalized === ro
  );
  const exact = sameRo.filter(
    (r) => normalizeCompany(r.company) === company && r.dateAssigned === date
  );

  if (exact.length === 1) {
    return { kind: "link", resourceId: exact[0]!.id };
  }
  if (exact.length > 1) {
    return {
      kind: "review",
      reason: `More than one resource instance shares order ${incoming.resourceOrderRaw.trim()}, company ${incoming.company.trim()}, and date assigned ${date}.`,
      candidates: exact
    };
  }

  const otherCompanies = sameRo.filter((r) => normalizeCompany(r.company) !== company);
  if (otherCompanies.length > 0) {
    return {
      kind: "review",
      reason: `Resource Order ${incoming.resourceOrderRaw.trim()} matches ${sameRo.length} active instance(s) with different companies. Order number alone is not a sufficient key across rotations, so the link is held for a decision.`,
      candidates: sameRo
    };
  }

  return { kind: "provisional" };
}
