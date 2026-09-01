import { useEffect, useState } from "react";
import {
  emptyAirAmbulance,
  emptyAmbulance,
  emptyHospital,
  emptyMedicalPlan,
  type MedicalPlanPayload
} from "@medical/domain";
import { api } from "./api";

type Props = {
  incidentId: string;
  incidentName?: string;
  incidentNumber?: string;
};

export function MedicalPlanPanel({ incidentId, incidentName, incidentNumber }: Props) {
  const [plan, setPlan] = useState<MedicalPlanPayload>(emptyMedicalPlan());
  const [rosterHint, setRosterHint] = useState<{ name: string; position: string; callSign: string; status: string }[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    api<any>(`/api/incidents/${incidentId}/medical-plan`)
      .then((data) => {
        if (cancelled) return;
        setPlan(data.plan);
        setRosterHint(data.rosterHint ?? []);
        setUpdatedAt(data.updatedAt ? new Date(data.updatedAt).toLocaleString() : null);
        setUpdatedBy(data.updatedBy);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load medical plan");
      });
    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  function patch<K extends keyof MedicalPlanPayload>(key: K, value: MedicalPlanPayload[K]) {
    setPlan((p) => ({ ...p, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await api<any>(`/api/incidents/${incidentId}/medical-plan`, {
        method: "PUT",
        body: JSON.stringify(plan)
      });
      setPlan(res.plan);
      setUpdatedAt(res.updatedAt ? new Date(res.updatedAt).toLocaleString() : null);
      setUpdatedBy(res.updatedBy);
      setMessage("Medical Plan saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function printPlan() {
    const prev = document.title;
    const stamp = new Date().toISOString().slice(0, 10);
    document.title = `ICS-206_${incidentName || "incident"}_${stamp}`.replace(/\s+/g, "-");
    window.print();
    document.title = prev;
  }

  return (
    <div className="card medical-plan-root">
      <div className="print-only medical-plan-banner">
        <div className="mono" style={{ fontSize: 10, letterSpacing: ".1em", color: "#b8461d", textTransform: "uppercase" }}>
          ICS 206 / 206 WF · Medical Plan
        </div>
        <div style={{ marginTop: 4, font: "600 18px IBM Plex Sans" }}>
          {incidentName || "Incident"}
          {incidentNumber ? ` · ${incidentNumber}` : ""}
        </div>
        <div className="mono" style={{ marginTop: 4, fontSize: 11, color: "#6f6558" }}>
          Operational period: {plan.opPeriod || "—"} · Printed {new Date().toLocaleString()}
        </div>
      </div>

      <div className="no-print" style={{ display: "flex", gap: 10, padding: "12px 16px", borderBottom: "1px solid #eee7dc", background: "#fbf8f3", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ font: "600 12px IBM Plex Sans", flex: 1 }}>
          Medical Plan (ICS 206-style) — edit, save, then print for the IAP / trailer
        </div>
        <button type="button" className="chip" onClick={() => void save()} disabled={saving} style={{ border: "1px solid #e2691f", background: "#e2691f", color: "#fff", padding: "7px 12px" }}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="chip" onClick={printPlan} style={{ border: "1px solid #1c1814", background: "#1c1814", color: "#fff", padding: "7px 12px" }}>
          Print / Save PDF
        </button>
      </div>

      {(message || error || updatedAt) && (
        <div className="no-print" style={{ padding: "10px 16px", borderBottom: "1px solid #f0eae0", fontSize: 12.5, color: error ? "#a3381f" : "#2f6b45" }}>
          {error || message}
          {!error && updatedAt ? <span style={{ color: "#8b8072" }}> · Last saved {updatedAt}{updatedBy ? ` by ${updatedBy}` : ""}</span> : null}
        </div>
      )}

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 18 }}>
        <section className="plan-section">
          <h3>1. Header</h3>
          <div className="plan-grid-2">
            <label>
              Operational period
              <input value={plan.opPeriod} onChange={(e) => patch("opPeriod", e.target.value)} placeholder="e.g. Aug 31 – Sep 1 · 0600–0600" />
            </label>
            <label>
              Prepared by (MEDL)
              <input value={plan.preparedBy} onChange={(e) => patch("preparedBy", e.target.value)} />
            </label>
            <label>
              Reviewed by (SOF)
              <input value={plan.reviewedBy} onChange={(e) => patch("reviewedBy", e.target.value)} />
            </label>
          </div>
        </section>

        <section className="plan-section">
          <div className="plan-section-head">
            <h3>2. Ambulance services</h3>
            <button type="button" className="chip no-print" onClick={() => patch("ambulances", [...plan.ambulances, emptyAmbulance()])} style={{ border: "1px solid #e0d6c7", background: "#fff" }}>
              + Add
            </button>
          </div>
          {plan.ambulances.map((a, i) => (
            <div key={i} className="plan-card">
              <div className="plan-grid-2">
                <label>Name<input value={a.name} onChange={(e) => {
                  const next = [...plan.ambulances];
                  next[i] = { ...a, name: e.target.value };
                  patch("ambulances", next);
                }} /></label>
                <label>Phone / dispatch<input value={a.phone} onChange={(e) => {
                  const next = [...plan.ambulances];
                  next[i] = { ...a, phone: e.target.value };
                  patch("ambulances", next);
                }} /></label>
                <label>Address<input value={a.address} onChange={(e) => {
                  const next = [...plan.ambulances];
                  next[i] = { ...a, address: e.target.value };
                  patch("ambulances", next);
                }} /></label>
                <label>EMS frequency<input value={a.frequency} onChange={(e) => {
                  const next = [...plan.ambulances];
                  next[i] = { ...a, frequency: e.target.value };
                  patch("ambulances", next);
                }} /></label>
              </div>
              <label className="plan-check no-print">
                <input type="checkbox" checked={a.als} onChange={(e) => {
                  const next = [...plan.ambulances];
                  next[i] = { ...a, als: e.target.checked };
                  patch("ambulances", next);
                }} /> ALS capable
              </label>
              <div className="print-only mono" style={{ fontSize: 11, marginTop: 4 }}>ALS: {a.als ? "Yes" : "No"}</div>
              {plan.ambulances.length > 1 && (
                <button type="button" className="chip no-print" onClick={() => patch("ambulances", plan.ambulances.filter((_, j) => j !== i))} style={{ marginTop: 8, border: "1px solid #e0d6c7", background: "#fff" }}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </section>

        <section className="plan-section">
          <div className="plan-section-head">
            <h3>3. Air ambulance</h3>
            <button type="button" className="chip no-print" onClick={() => patch("airAmbulances", [...plan.airAmbulances, emptyAirAmbulance()])} style={{ border: "1px solid #e0d6c7", background: "#fff" }}>
              + Add
            </button>
          </div>
          {plan.airAmbulances.map((a, i) => (
            <div key={i} className="plan-card">
              <div className="plan-grid-2">
                <label>Name / call sign<input value={a.name} onChange={(e) => {
                  const next = [...plan.airAmbulances];
                  next[i] = { ...a, name: e.target.value };
                  patch("airAmbulances", next);
                }} /></label>
                <label>Phone<input value={a.phone} onChange={(e) => {
                  const next = [...plan.airAmbulances];
                  next[i] = { ...a, phone: e.target.value };
                  patch("airAmbulances", next);
                }} /></label>
                <label>Aircraft type<input value={a.aircraftType} onChange={(e) => {
                  const next = [...plan.airAmbulances];
                  next[i] = { ...a, aircraftType: e.target.value };
                  patch("airAmbulances", next);
                }} /></label>
                <label>Capability<input value={a.capability} onChange={(e) => {
                  const next = [...plan.airAmbulances];
                  next[i] = { ...a, capability: e.target.value };
                  patch("airAmbulances", next);
                }} /></label>
              </div>
            </div>
          ))}
        </section>

        <section className="plan-section">
          <div className="plan-section-head">
            <h3>4. Hospitals</h3>
            <button type="button" className="chip no-print" onClick={() => patch("hospitals", [...plan.hospitals, emptyHospital()])} style={{ border: "1px solid #e0d6c7", background: "#fff" }}>
              + Add
            </button>
          </div>
          {plan.hospitals.map((h, i) => (
            <div key={i} className="plan-card">
              <div className="plan-grid-2">
                <label>Name<input value={h.name} onChange={(e) => {
                  const next = [...plan.hospitals];
                  next[i] = { ...h, name: e.target.value };
                  patch("hospitals", next);
                }} /></label>
                <label>Trauma level<input value={h.traumaLevel} onChange={(e) => {
                  const next = [...plan.hospitals];
                  next[i] = { ...h, traumaLevel: e.target.value };
                  patch("hospitals", next);
                }} placeholder="I–IV" /></label>
                <label style={{ gridColumn: "1 / -1" }}>Address<input value={h.address} onChange={(e) => {
                  const next = [...plan.hospitals];
                  next[i] = { ...h, address: e.target.value };
                  patch("hospitals", next);
                }} /></label>
                <label>Helipad lat<input value={h.helipadLat} onChange={(e) => {
                  const next = [...plan.hospitals];
                  next[i] = { ...h, helipadLat: e.target.value };
                  patch("hospitals", next);
                }} /></label>
                <label>Helipad lon<input value={h.helipadLon} onChange={(e) => {
                  const next = [...plan.hospitals];
                  next[i] = { ...h, helipadLon: e.target.value };
                  patch("hospitals", next);
                }} /></label>
                <label>Travel time air<input value={h.travelAir} onChange={(e) => {
                  const next = [...plan.hospitals];
                  next[i] = { ...h, travelAir: e.target.value };
                  patch("hospitals", next);
                }} /></label>
                <label>Travel time ground<input value={h.travelGround} onChange={(e) => {
                  const next = [...plan.hospitals];
                  next[i] = { ...h, travelGround: e.target.value };
                  patch("hospitals", next);
                }} /></label>
              </div>
              <div className="no-print" style={{ display: "flex", gap: 14, marginTop: 8 }}>
                <label className="plan-check"><input type="checkbox" checked={h.helipad} onChange={(e) => {
                  const next = [...plan.hospitals];
                  next[i] = { ...h, helipad: e.target.checked };
                  patch("hospitals", next);
                }} /> Helipad</label>
                <label className="plan-check"><input type="checkbox" checked={h.burnCenter} onChange={(e) => {
                  const next = [...plan.hospitals];
                  next[i] = { ...h, burnCenter: e.target.checked };
                  patch("hospitals", next);
                }} /> Burn center</label>
              </div>
              <div className="print-only mono" style={{ fontSize: 11, marginTop: 4 }}>
                Helipad: {h.helipad ? "Yes" : "No"} · Burn: {h.burnCenter ? "Yes" : "No"}
              </div>
            </div>
          ))}
        </section>

        <section className="plan-section">
          <h3>5. Area / aid station capability</h3>
          <label>
            EMS responders & capability
            <textarea rows={3} value={plan.aidStations} onChange={(e) => patch("aidStations", e.target.value)} placeholder="e.g. ICP aid station staffed by…" />
          </label>
          <label style={{ marginTop: 10, display: "block" }}>
            Equipment available on scene
            <textarea rows={2} value={plan.equipment} onChange={(e) => patch("equipment", e.target.value)} />
          </label>
        </section>

        <section className="plan-section">
          <h3>6. Emergency procedures</h3>
          <label>
            Procedures / contacts
            <textarea rows={5} value={plan.emergencyProcedures} onChange={(e) => patch("emergencyProcedures", e.target.value)} placeholder="Who to call, channels, transport decision process…" />
          </label>
          <label style={{ marginTop: 10, display: "block" }}>
            Special notes
            <textarea rows={2} value={plan.specialNotes} onChange={(e) => patch("specialNotes", e.target.value)} />
          </label>
        </section>

        {rosterHint.length > 0 && (
          <section className="plan-section no-print">
            <h3>Roster hint (from check-ins — copy into sections as needed)</h3>
            <div style={{ fontSize: 12, color: "#6f6558" }}>
              {rosterHint.map((r) => (
                <div key={`${r.name}-${r.position}`} style={{ padding: "4px 0", borderBottom: "1px solid #f4efe6" }}>
                  <b>{r.name}</b> · {r.position} · {r.callSign} · {r.status}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="print-only" style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #e3dbcf", fontSize: 12 }}>
          <div>Prepared by: <b>{plan.preparedBy || "________________"}</b></div>
          <div style={{ marginTop: 6 }}>Reviewed by (SOF): <b>{plan.reviewedBy || "________________"}</b></div>
        </div>
      </div>
    </div>
  );
}
