import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@medical/db";
import {
  auditEvents,
  counters,
  documentStatuses,
  incidents,
  medicalPlans,
  people,
  resourceInstances,
  responses
} from "@medical/db";
import {
  DOCUMENT_TYPES,
  calculateAssignmentDates,
  effectiveAssignment,
  emptyMedicalPlan,
  formatShortDate,
  glideStateFromRemaining,
  matchResource,
  nextDocumentStatus,
  normalizeMedicalPlan,
  normalizeResourceOrder,
  openDocumentCount,
  payloadContainsFileHint,
  reconcileCounts,
  requiredDocumentChecklist,
  rollingDays,
  validateFormPayload,
  workdaysRemaining,
  type DocumentStatusValue,
  type DocumentType,
  type FormPayload,
  type MedicalPlanPayload,
  type OperationalStatus,
  type PersonOverrides,
  type ResourceCandidate
} from "@medical/domain";
import { id } from "./ids.js";
import { calendarToday } from "./today.js";

const intakeLocks = new Map<string, Promise<unknown>>();

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = intakeLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  intakeLocks.set(
    key,
    prev.then(() => gate)
  );
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

export class Store {
  constructor(private db: Db) {}

  async nextFormsId(incidentId: string) {
    const key = `forms-response:${incidentId}`;
    const existing = await this.db.select().from(responses).where(eq(responses.incidentId, incidentId));
    const maxExisting = existing.reduce((m, r) => {
      const n = Number(String(r.formsResponseId).replace(/\D/g, ""));
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    const rows = await this.db.select().from(counters).where(eq(counters.key, key));
    const next = Math.max(rows[0]?.value ?? 0, maxExisting) + 1;
    if (rows[0]) {
      await this.db.update(counters).set({ value: next }).where(eq(counters.key, key));
    } else {
      await this.db.insert(counters).values({ key, value: next });
    }
    return `R-${String(next).padStart(4, "0")}`;
  }

  async audit(input: {
    entityType: string;
    entityId: string;
    kind: string;
    actor: string;
    before?: unknown;
    after?: unknown;
  }) {
    await this.db.insert(auditEvents).values({
      id: id(),
      entityType: input.entityType,
      entityId: input.entityId,
      kind: input.kind,
      actor: input.actor,
      before: input.before ?? null,
      after: input.after ?? null
    });
  }

  async getIncidentBySlug(slug: string) {
    const rows = await this.db.select().from(incidents).where(eq(incidents.slug, slug));
    return rows[0] ?? null;
  }

  async getIncident(id_: string) {
    const rows = await this.db.select().from(incidents).where(eq(incidents.id, id_));
    return rows[0] ?? null;
  }

  async listIncidents() {
    return this.db.select().from(incidents);
  }

  async createCleanIncident(input: {
    name: string;
    number: string;
    timezone: string;
    fireEmail: string;
    opPeriod?: string;
    actor: string;
  }) {
    const slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const rec = {
      id: id(),
      slug,
      name: input.name,
      number: input.number,
      opPeriod: input.opPeriod ?? "OP 1",
      timezone: input.timezone,
      fireEmail: input.fireEmail,
      formUrl: `/c/${slug}`,
      status: "open",
      pinnedToday: null as string | null
    };
    await this.db.insert(incidents).values(rec);
    await this.audit({ entityType: "incident", entityId: rec.id, kind: "create", actor: input.actor, after: rec });
    return rec;
  }

  async closeIncident(incidentId: string, actor: string) {
    const before = await this.getIncident(incidentId);
    await this.db.update(incidents).set({ status: "closed" }).where(eq(incidents.id, incidentId));
    await this.audit({ entityType: "incident", entityId: incidentId, kind: "close", actor, before, after: { status: "closed" } });
  }

  async patchIncident(incidentId: string, patch: Partial<{ name: string; number: string; opPeriod: string; timezone: string; fireEmail: string; pinnedToday: string | null }>, actor: string) {
    const before = await this.getIncident(incidentId);
    await this.db.update(incidents).set(patch).where(eq(incidents.id, incidentId));
    await this.audit({ entityType: "incident", entityId: incidentId, kind: "patch", actor, before, after: patch });
    return this.getIncident(incidentId);
  }

  private async candidates(incidentId: string): Promise<ResourceCandidate[]> {
    const resources = await this.db.select().from(resourceInstances).where(eq(resourceInstances.incidentId, incidentId));
    const folks = await this.db.select().from(people).where(eq(people.incidentId, incidentId));
    return resources.map((r) => ({
      id: r.id,
      callSign: r.callSign,
      company: r.company,
      resourceOrderRaw: r.resourceOrderRaw,
      resourceOrderNormalized: r.resourceOrderNormalized,
      type: r.type as ResourceCandidate["type"],
      dateAssigned: r.dateAssigned,
      isProvisional: r.isProvisional,
      personnelCount: folks.filter((p) => p.resourceInstanceId === r.id).length
    }));
  }

  async submit(slug: string, raw: Partial<FormPayload>, actor = "public-form") {
    const incident = await this.getIncidentBySlug(slug);
    if (!incident) throw Object.assign(new Error("Incident not found"), { status: 404 });
    if (incident.status !== "open") throw Object.assign(new Error("Incident is closed"), { status: 410 });
    const parsed = validateFormPayload(raw);
    if (!parsed.ok) throw Object.assign(new Error("Invalid form"), { status: 400, errors: parsed.errors });
    if (payloadContainsFileHint(parsed.value)) {
      throw Object.assign(new Error("File links and uploads are not allowed"), { status: 400 });
    }
    const payload = parsed.value;
    const lockKey = `${incident.id}:${normalizeResourceOrder(payload.resourceOrderRaw)}:${payload.company}:${payload.dateAssigned}`;
    return withLock(lockKey, async () => {
      const formsResponseId = await this.nextFormsId(incident.id);
      const responseId = id();
      const personId = id();
      await this.db.insert(responses).values({
        id: responseId,
        incidentId: incident.id,
        formsResponseId,
        payload
      });
      const decision = matchResource(
        {
          incidentId: incident.id,
          resourceOrderRaw: payload.resourceOrderRaw,
          company: payload.company,
          dateAssigned: payload.dateAssigned
        },
        await this.candidates(incident.id)
      );

      let resourceInstanceId: string | null = null;
      let status: OperationalStatus = "Checked In - Needs Assignment";
      if (decision.kind === "link") {
        resourceInstanceId = decision.resourceId;
      } else if (decision.kind === "provisional") {
        resourceInstanceId = id();
        await this.db.insert(resourceInstances).values({
          id: resourceInstanceId,
          incidentId: incident.id,
          callSign: "—",
          company: payload.company,
          resourceOrderRaw: payload.resourceOrderRaw,
          resourceOrderNormalized: normalizeResourceOrder(payload.resourceOrderRaw),
          type: payload.position,
          dateAssigned: payload.dateAssigned,
          state: "Checked In - Needs Assignment",
          isProvisional: true
        });
      } else {
        status = "Needs Resource Review";
      }

      await this.db.insert(people).values({
        id: personId,
        incidentId: incident.id,
        responseId,
        resourceInstanceId,
        status,
        overrides: {}
      });

      const docs = requiredDocumentChecklist(payload.capabilities);
      for (const t of DOCUMENT_TYPES) {
        await this.db.insert(documentStatuses).values({
          id: id(),
          personId,
          documentType: t,
          status: docs[t]
        });
      }

      await this.audit({
        entityType: "response",
        entityId: responseId,
        kind: "intake",
        actor,
        after: { formsResponseId, personId, decision: decision.kind, resourceInstanceId }
      });

      return { formsResponseId, personId, resourceInstanceId, status, decision: decision.kind };
    });
  }

  async derivedPerson(person: typeof people.$inferSelect, payload: FormPayload, resource: typeof resourceInstances.$inferSelect | null, docs: (typeof documentStatuses.$inferSelect)[], incident: typeof incidents.$inferSelect) {
    const overrides = (person.overrides ?? {}) as PersonOverrides;
    const eff = effectiveAssignment(
      { firstWorkDay: payload.firstWorkDay, assignmentLength: payload.assignmentLength },
      overrides
    );
    const dates = calculateAssignmentDates(eff);
    const today = calendarToday(incident.timezone, incident.pinnedToday);
    const forceReview = person.status === "Needs Resource Review" || !dates.valid;
    const remaining = dates.valid && dates.lastWorkDay ? workdaysRemaining(dates.lastWorkDay, today) : null;
    const complete = person.status === "Released" || person.status === "Cancelled";
    const gp = glideStateFromRemaining(remaining, { forceReview, complete });
    const docMap = Object.fromEntries(docs.map((d) => [d.documentType, d.status])) as Record<DocumentType, DocumentStatusValue>;
    return {
      id: person.id,
      incidentId: person.incidentId,
      responseId: person.responseId,
      resourceInstanceId: person.resourceInstanceId,
      status: person.status,
      overrides,
      submitted: payload,
      effective: {
        division: overrides.division ?? "",
        camp: overrides.camp ?? "",
        callSign: overrides.callSign ?? resource?.callSign ?? "—",
        firstWorkDay: eff.firstWorkDay,
        assignmentLength: eff.assignmentLength,
        extensionDays: eff.extensionDays
      },
      calculated: {
        lastWorkDay: dates.lastWorkDay,
        dmbStart: dates.dmbStart,
        workdaysRemaining: remaining,
        glidePathState: gp
      },
      resource,
      docs: docMap,
      openDocs: openDocumentCount(docMap),
      today
    };
  }

  async loadPeople(incidentId: string) {
    const incident = await this.getIncident(incidentId);
    if (!incident) throw Object.assign(new Error("Incident not found"), { status: 404 });
    const [plist, rlist, dlist, slist] = await Promise.all([
      this.db.select().from(people).where(eq(people.incidentId, incidentId)),
      this.db.select().from(resourceInstances).where(eq(resourceInstances.incidentId, incidentId)),
      this.db.select().from(documentStatuses),
      this.db.select().from(responses).where(eq(responses.incidentId, incidentId))
    ]);
    const rmap = new Map(rlist.map((r) => [r.id, r]));
    const smap = new Map(slist.map((s) => [s.id, s]));
    const derived = [];
    for (const p of plist) {
      const resp = smap.get(p.responseId);
      if (!resp) continue;
      const docs = dlist.filter((d) => d.personId === p.id);
      derived.push(await this.derivedPerson(p, resp.payload as FormPayload, p.resourceInstanceId ? rmap.get(p.resourceInstanceId) ?? null : null, docs, incident));
    }
    return { incident, resources: rlist, people: derived, responses: slist };
  }

  async roster(incidentId: string) {
    const data = await this.loadPeople(incidentId);
    const counts = reconcileCounts({
      resources: data.resources.map((r) => ({ id: r.id, state: r.state })),
      people: data.people.map((p) => ({ id: p.id, resourceInstanceId: p.resourceInstanceId, status: p.status }))
    });
    return {
      ...data,
      counts: {
        ...counts,
        peopleByResource: Object.fromEntries(counts.peopleByResource)
      }
    };
  }

  async personDetail(personId: string) {
    const [p] = await this.db.select().from(people).where(eq(people.id, personId));
    if (!p) throw Object.assign(new Error("Person not found"), { status: 404 });
    const data = await this.loadPeople(p.incidentId);
    const row = data.people.find((x) => x.id === personId);
    const [resp] = await this.db.select().from(responses).where(eq(responses.id, p.responseId));
    return { person: row, formsResponseId: resp?.formsResponseId, incident: data.incident };
  }

  async patchOverrides(personId: string, patch: PersonOverrides, actor: string) {
    const [p] = await this.db.select().from(people).where(eq(people.id, personId));
    if (!p) throw Object.assign(new Error("Person not found"), { status: 404 });
    const before = p.overrides;
    const next = { ...(p.overrides as object), ...patch } as PersonOverrides;
    for (const [k, v] of Object.entries(patch)) {
      if (v === "" || v === null) (next as Record<string, unknown>)[k] = null;
    }
    const status = patch.operationalStatus ?? p.status;
    await this.db.update(people).set({ overrides: next, status }).where(eq(people.id, personId));
    if (patch.callSign && p.resourceInstanceId) {
      await this.db.update(resourceInstances).set({ callSign: patch.callSign }).where(eq(resourceInstances.id, p.resourceInstanceId));
    }
    await this.audit({ entityType: "person", entityId: personId, kind: "override", actor, before, after: next });
    const [frozen] = await this.db.select().from(responses).where(eq(responses.id, p.responseId));
    return { overrides: next, payload: frozen?.payload };
  }

  async cycleDocument(personId: string, documentType: DocumentType, actor: string) {
    const rows = await this.db.select().from(documentStatuses).where(and(eq(documentStatuses.personId, personId), eq(documentStatuses.documentType, documentType)));
    let row = rows[0];
    if (!row) {
      row = {
        id: id(),
        personId,
        documentType,
        status: "Not Required",
        verifier: null,
        verifiedAt: null,
        notes: null
      };
      await this.db.insert(documentStatuses).values(row);
    }
    const status = nextDocumentStatus(row.status as DocumentStatusValue);
    const verifiedAt = status === "Verified" ? new Date() : null;
    const verifier = status === "Verified" ? actor : row.verifier;
    await this.db
      .update(documentStatuses)
      .set({ status, verifier, verifiedAt })
      .where(eq(documentStatuses.id, row.id));
    await this.audit({ entityType: "document", entityId: row.id, kind: "status", actor, before: row.status, after: status });
    return { status, verifier, verifiedAt };
  }

  async reviewLink(personId: string, resourceId: string, actor: string) {
    const [p] = await this.db.select().from(people).where(eq(people.id, personId));
    if (!p) throw Object.assign(new Error("Person not found"), { status: 404 });
    await this.db.update(people).set({ resourceInstanceId: resourceId, status: "Checked In - Needs Assignment" }).where(eq(people.id, personId));
    await this.audit({ entityType: "person", entityId: personId, kind: "review-link", actor, before: { resourceInstanceId: p.resourceInstanceId }, after: { resourceId } });
  }

  async reviewProvisional(personId: string, actor: string) {
    const [p] = await this.db.select().from(people).where(eq(people.id, personId));
    if (!p) throw Object.assign(new Error("Person not found"), { status: 404 });
    const [resp] = await this.db.select().from(responses).where(eq(responses.id, p.responseId));
    const payload = resp!.payload as FormPayload;
    const rid = id();
    await this.db.insert(resourceInstances).values({
      id: rid,
      incidentId: p.incidentId,
      callSign: "—",
      company: payload.company,
      resourceOrderRaw: payload.resourceOrderRaw,
      resourceOrderNormalized: normalizeResourceOrder(payload.resourceOrderRaw),
      type: payload.position,
      dateAssigned: payload.dateAssigned,
      state: "Checked In - Needs Assignment",
      isProvisional: true
    });
    await this.db.update(people).set({ resourceInstanceId: rid, status: "Checked In - Needs Assignment" }).where(eq(people.id, personId));
    await this.audit({ entityType: "person", entityId: personId, kind: "review-provisional", actor, after: { rid } });
    return { resourceInstanceId: rid };
  }

  async reviewQueue(incidentId: string) {
    const data = await this.loadPeople(incidentId);
    const candidates = await this.candidates(incidentId);
    const cards = data.people
      .filter((p) => p.status === "Needs Resource Review")
      .map((p) => {
        const decision = matchResource(
          {
            incidentId,
            resourceOrderRaw: p.submitted.resourceOrderRaw,
            company: p.submitted.company,
            dateAssigned: p.submitted.dateAssigned
          },
          candidates
        );
        return {
          personId: p.id,
          name: `${p.submitted.firstName} ${p.submitted.lastName}`,
          meta: `${p.submitted.position} · ${p.submitted.medicalCertification} · ${p.submitted.phone}`,
          reason: decision.kind === "review" ? decision.reason : "The system could not safely determine which resource this person belongs to.",
          candidates: decision.kind === "review" ? decision.candidates : candidates.filter((c) => c.resourceOrderNormalized === normalizeResourceOrder(p.submitted.resourceOrderRaw))
        };
      });
    return { cards };
  }

  async glide(incidentId: string) {
    const data = await this.roster(incidentId);
    const today = calendarToday(data.incident.timezone, data.incident.pinnedToday);
    const days = rollingDays(today, 14);
    const rows = data.people.map((p) => ({
      id: p.id,
      callSign: p.resource?.callSign ?? "—",
      name: `${p.submitted.firstName} ${p.submitted.lastName}`,
      gp: p.calculated.glidePathState,
      fwd: p.effective.firstWorkDay,
      lwd: p.calculated.lastWorkDay,
      dmb: p.calculated.dmbStart,
      days: days.map((iso) => {
        if (!p.effective.firstWorkDay || !p.calculated.lastWorkDay || !p.calculated.dmbStart) {
          return { iso, mark: iso === today ? "?" : "", state: "REVIEW" as const };
        }
        if (iso < p.effective.firstWorkDay) return { iso, mark: "", state: null };
        if (iso > p.calculated.dmbStart) return { iso, mark: "", state: "Gray" as const };
        if (iso === p.calculated.dmbStart) return { iso, mark: "DMB", state: "DMB/TVL" as const };
        if (iso === p.calculated.lastWorkDay) return { iso, mark: "LWD", state: "LWD" as const };
        const left = workdaysRemaining(p.calculated.lastWorkDay, iso);
        return { iso, mark: "", state: glideStateFromRemaining(left) };
      })
    }));
    return {
      today,
      startLabel: formatShortDate(today),
      days,
      rows,
      totals: {
        activeResources: data.counts.activeResources,
        activePersonnel: data.counts.activePersonnel,
        yellow: data.people.filter((p) => p.calculated.glidePathState === "Yellow").length,
        red: data.people.filter((p) => p.calculated.glidePathState === "Red").length,
        lwdDmb: data.people.filter((p) => ["LWD", "DMB/TVL"].includes(p.calculated.glidePathState)).length,
        review: data.people.filter((p) => p.calculated.glidePathState === "REVIEW").length
      }
    };
  }

  async assertNoOldData(newIncidentId: string, oldIncidentId: string) {
    const peopleNew = await this.db.select().from(people).where(eq(people.incidentId, newIncidentId));
    const peopleOld = await this.db.select().from(people).where(eq(people.incidentId, oldIncidentId));
    const overlap = peopleNew.filter((p) => peopleOld.some((o) => o.id === p.id || o.responseId === p.responseId));
    return overlap.length === 0 && peopleNew.length === 0;
  }

  async getMedicalPlan(incidentId: string) {
    const inc = await this.getIncident(incidentId);
    if (!inc) throw Object.assign(new Error("Incident not found"), { status: 404 });
    const rows = await this.db.select().from(medicalPlans).where(eq(medicalPlans.incidentId, incidentId));
    const plan = rows[0]
      ? normalizeMedicalPlan(rows[0].payload as MedicalPlanPayload, inc.opPeriod)
      : emptyMedicalPlan(inc.opPeriod);
    const roster = await this.roster(incidentId);
    const rosterHint = roster.people
      .filter((p) => ["Ambo", "REMS", "EMPF", "MEDL/MEDLt"].includes(p.submitted.position))
      .map((p) => ({
        name: `${p.submitted.firstName} ${p.submitted.lastName}`,
        position: p.submitted.position,
        callSign: p.resource?.callSign ?? "—",
        status: p.status
      }));
    return {
      incident: {
        id: inc.id,
        name: inc.name,
        number: inc.number,
        opPeriod: inc.opPeriod,
        timezone: inc.timezone,
        fireEmail: inc.fireEmail
      },
      plan,
      updatedAt: rows[0]?.updatedAt ?? null,
      updatedBy: rows[0]?.updatedBy ?? null,
      rosterHint
    };
  }

  async saveMedicalPlan(incidentId: string, raw: Partial<MedicalPlanPayload>, actor: string) {
    const inc = await this.getIncident(incidentId);
    if (!inc) throw Object.assign(new Error("Incident not found"), { status: 404 });
    const plan = normalizeMedicalPlan(raw, inc.opPeriod);
    const existing = await this.db.select().from(medicalPlans).where(eq(medicalPlans.incidentId, incidentId));
    const now = new Date();
    if (existing[0]) {
      await this.db
        .update(medicalPlans)
        .set({ payload: plan, updatedAt: now, updatedBy: actor })
        .where(eq(medicalPlans.id, existing[0].id));
      await this.audit({
        entityType: "medical_plan",
        entityId: existing[0].id,
        kind: "update",
        actor,
        before: existing[0].payload,
        after: plan
      });
      return { id: existing[0].id, plan, updatedAt: now, updatedBy: actor };
    }
    const rec = { id: id(), incidentId, payload: plan, updatedAt: now, updatedBy: actor };
    await this.db.insert(medicalPlans).values(rec);
    await this.audit({
      entityType: "medical_plan",
      entityId: rec.id,
      kind: "create",
      actor,
      before: null,
      after: plan
    });
    return { id: rec.id, plan, updatedAt: now, updatedBy: actor };
  }
}

export { sql };
