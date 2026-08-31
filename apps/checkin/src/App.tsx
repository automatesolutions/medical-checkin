import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CAPABILITY_OPTIONS,
  CERTIFICATIONS,
  EXPERIENCE_OPTIONS,
  FIELD_LABELS,
  FORM_SECTIONS,
  POSITIONS,
  VEHICLE_TYPES,
  emptyForm,
  type FormPayload
} from "@medical/domain";

function slugFromPath() {
  const m = location.pathname.match(/\/c\/([^/]+)/);
  if (m) return m[1]!;
  const q = new URLSearchParams(location.search).get("incident");
  return q || "bearclaw-creek";
}

export function App() {
  const slug = useMemo(slugFromPath, []);
  const [incident, setIncident] = useState<any>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Partial<FormPayload>>(emptyForm());
  const [done, setDone] = useState<{ formsResponseId: string; fireEmail: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/public/incidents/${slug}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || "Not found");
        return r.json();
      })
      .then(setIncident)
      .catch((e) => setError(e.message));
  }, [slug]);

  function set<K extends keyof FormPayload>(k: K, v: FormPayload[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggle(listKey: "experience" | "capabilities", value: string) {
    const cur = (form[listKey] as string[]) || [];
    set(listKey, (cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value]) as never);
  }

  async function submit() {
    setFieldErrors({});
    const res = await fetch(`/api/public/incidents/${slug}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const body = await res.json();
    if (!res.ok) {
      const map: Record<string, string> = {};
      for (const e of body.errors ?? []) map[e.field] = e.message;
      setFieldErrors(map);
      setError(body.error || "Please correct the form");
      return;
    }
    setDone({ formsResponseId: body.formsResponseId, fireEmail: body.fireEmail });
  }

  if (error && !incident) {
    return (
      <div className="shell">
        <div className="hdr"><div style={{ font: "600 19px IBM Plex Sans" }}>{error === "Incident is closed" || incident?.status === "closed" ? "This incident is closed" : error}</div></div>
      </div>
    );
  }
  if (!incident) return <div className="shell"><div className="hdr">Loading…</div></div>;
  if (incident.status !== "open") {
    return (
      <div className="shell">
        <div className="hdr">
          <div className="mono" style={{ fontSize: 10, letterSpacing: ".1em", color: "#e2691f" }}>MEDICAL CHECK-IN</div>
          <div style={{ marginTop: 8, font: "600 19px IBM Plex Sans" }}>{incident.name}</div>
        </div>
        <div style={{ padding: 18 }} className="note">This incident is closed. New submissions are not accepted.</div>
      </div>
    );
  }
  if (done) {
    return (
      <div className="shell">
        <div className="hdr">
          <div style={{ fontSize: 10, letterSpacing: ".1em", color: "#e2691f", fontFamily: "IBM Plex Mono" }}>CONFIRMED</div>
          <div style={{ marginTop: 8, font: "600 19px IBM Plex Sans" }}>{incident.name}</div>
        </div>
        <div style={{ padding: 18 }}>
          <p>Your check-in is stored once. Response id <b>{done.formsResponseId}</b>.</p>
          <p className="note">Do not upload files here. Email Contract or Agreement, Driver’s License, NREMT, State license, and — if you selected Narcotics — the Letter from Medical Director to <b>{done.fireEmail}</b>.</p>
        </div>
      </div>
    );
  }

  const section = FORM_SECTIONS[step];
  const field = (k: keyof FormPayload, node: ReactNode) => (
    <div key={k}>
      <label>{FIELD_LABELS[k]}{node}</label>
      {fieldErrors[k] && <div className="err">{fieldErrors[k]}</div>}
    </div>
  );

  return (
    <div className="shell">
      <div className="hdr">
        <div style={{ font: "600 9.5px IBM Plex Mono", letterSpacing: ".1em", color: "#e2691f" }}>MEDICAL CHECK-IN</div>
        <div style={{ marginTop: 8, font: "600 19px IBM Plex Sans" }}>{incident.name}</div>
        <div style={{ marginTop: 5, font: "400 10.5px IBM Plex Mono", color: "#a79c8d" }}>{incident.number}</div>
      </div>
      <div style={{ padding: "14px 18px 0" }}>
        <div className="note">Check in for yourself only. Every ambulance and REMS member submits a separate response. This form does not collect patient or clinical information.</div>
        <div style={{ marginTop: 14, font: "600 9.5px IBM Plex Mono", letterSpacing: ".09em", color: "#9a8f80" }}>STEP {step + 1} OF 6 · {section.name.toUpperCase()}</div>
        <div className="pips">{FORM_SECTIONS.map((_, i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>
      </div>
      <div style={{ padding: "0 18px" }}>
        {step === 0 && (
          <>
            {field("resourceOrderRaw", <input value={form.resourceOrderRaw ?? ""} onChange={(e) => set("resourceOrderRaw", e.target.value)} />)}
            {field("email", <input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />)}
            {field("firstName", <input value={form.firstName ?? ""} onChange={(e) => set("firstName", e.target.value)} />)}
            {field("lastName", <input value={form.lastName ?? ""} onChange={(e) => set("lastName", e.target.value)} />)}
          </>
        )}
        {step === 1 && (
          <>
            {field("position", <select value={form.position ?? ""} onChange={(e) => set("position", e.target.value as FormPayload["position"])}><option value="">Select</option>{POSITIONS.map((p) => <option key={p}>{p}</option>)}</select>)}
            {field("trainee", <select value={form.trainee} onChange={(e) => set("trainee", e.target.value as "Yes" | "No")}><option>No</option><option>Yes</option></select>)}
            {field("firstAssignment", <select value={form.firstAssignment} onChange={(e) => set("firstAssignment", e.target.value as "Yes" | "No")}><option>No</option><option>Yes</option></select>)}
            {field("arduousQualified", <select value={form.arduousQualified} onChange={(e) => set("arduousQualified", e.target.value as "Yes" | "No")}><option>No</option><option>Yes</option></select>)}
            <label>{FIELD_LABELS.experience}</label>
            <div className="checks">{EXPERIENCE_OPTIONS.map((o) => <label key={o}><input type="checkbox" checked={(form.experience ?? []).includes(o)} onChange={() => toggle("experience", o)} />{o}</label>)}</div>
            <label>{FIELD_LABELS.capabilities}</label>
            <div className="checks">{CAPABILITY_OPTIONS.map((o) => <label key={o}><input type="checkbox" checked={(form.capabilities ?? []).includes(o)} onChange={() => toggle("capabilities", o)} />{o}</label>)}</div>
          </>
        )}
        {step === 2 && (
          <>
            {field("phone", <input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />)}
            {field("dateAssigned", <input type="date" value={form.dateAssigned ?? ""} onChange={(e) => set("dateAssigned", e.target.value)} />)}
            {field("isReassignment", <select value={form.isReassignment} onChange={(e) => set("isReassignment", e.target.value as "Yes" | "No")}><option>No</option><option>Yes</option></select>)}
            {form.isReassignment === "Yes" && field("reassignmentFrom", <input value={form.reassignmentFrom ?? ""} onChange={(e) => set("reassignmentFrom", e.target.value)} />)}
            {field("firstWorkDay", <input type="date" value={form.firstWorkDay ?? ""} onChange={(e) => set("firstWorkDay", e.target.value)} />)}
            {field("assignmentLength", <input type="number" min={1} value={form.assignmentLength ?? 14} onChange={(e) => set("assignmentLength", Number(e.target.value))} />)}
            {field("travelTimeHome", <input value={form.travelTimeHome ?? ""} onChange={(e) => set("travelTimeHome", e.target.value)} />)}
            {field("flightRequired", <select value={form.flightRequired} onChange={(e) => set("flightRequired", e.target.value as "Yes" | "No")}><option>No</option><option>Yes</option></select>)}
          </>
        )}
        {step === 3 && (
          <>
            {field("vehicleType", <select value={form.vehicleType ?? ""} onChange={(e) => set("vehicleType", e.target.value as FormPayload["vehicleType"])}><option value="">Select</option>{VEHICLE_TYPES.map((v) => <option key={v}>{v}</option>)}</select>)}
            {field("fourByFour", <select value={form.fourByFour} onChange={(e) => set("fourByFour", e.target.value as "Yes" | "No")}><option>No</option><option>Yes</option></select>)}
            {field("vehicleLicense", <input value={form.vehicleLicense ?? ""} onChange={(e) => set("vehicleLicense", e.target.value)} />)}
          </>
        )}
        {step === 4 && (
          <>
            {field("company", <input value={form.company ?? ""} onChange={(e) => set("company", e.target.value)} />)}
            {field("homeStreet", <input value={form.homeStreet ?? ""} onChange={(e) => set("homeStreet", e.target.value)} />)}
            {field("city", <input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />)}
            {field("state", <input value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} />)}
            {field("zip", <input value={form.zip ?? ""} onChange={(e) => set("zip", e.target.value)} />)}
            {field("supervisorPhone", <input value={form.supervisorPhone ?? ""} onChange={(e) => set("supervisorPhone", e.target.value)} />)}
            {field("emergencyContactName", <input value={form.emergencyContactName ?? ""} onChange={(e) => set("emergencyContactName", e.target.value)} />)}
            {field("emergencyContactPhone", <input value={form.emergencyContactPhone ?? ""} onChange={(e) => set("emergencyContactPhone", e.target.value)} />)}
            {field("eeraContract", <input value={form.eeraContract ?? ""} onChange={(e) => set("eeraContract", e.target.value)} />)}
          </>
        )}
        {step === 5 && (
          <>
            {field("otherIcsQualifications", <input value={form.otherIcsQualifications ?? ""} onChange={(e) => set("otherIcsQualifications", e.target.value)} />)}
            {field("medicalCertification", <select value={form.medicalCertification ?? ""} onChange={(e) => set("medicalCertification", e.target.value as FormPayload["medicalCertification"])}><option value="">Select</option>{CERTIFICATIONS.map((c) => <option key={c}>{c}</option>)}</select>)}
            {field("medicalDirectorName", <input value={form.medicalDirectorName ?? ""} onChange={(e) => set("medicalDirectorName", e.target.value)} />)}
            {field("medicalDirectorPhone", <input value={form.medicalDirectorPhone ?? ""} onChange={(e) => set("medicalDirectorPhone", e.target.value)} />)}
          </>
        )}
      </div>
      {error && <div className="err" style={{ padding: "8px 18px" }}>{error}</div>}
      <div className="row">
        <button className="btn ghost" onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</button>
        {step < 5 ? (
          <button className="btn primary" onClick={() => setStep((s) => s + 1)}>Continue</button>
        ) : (
          <button className="btn primary" onClick={submit}>Submit check-in</button>
        )}
      </div>
      <div className="foot">Do not upload files. Email Contract, Driver’s License, NREMT, State license, and — if you selected Narcotics — the Medical Director letter to {incident.fireEmail}.</div>
    </div>
  );
}
