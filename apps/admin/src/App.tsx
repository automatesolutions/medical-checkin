import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DOCUMENT_STYLE, DOCUMENT_TYPES, FIELD_LABELS, FORM_SECTIONS, GLIDE_COLORS, formatShortDate, type GlideState } from "@medical/domain";
import { api } from "./api";
import { MedicalPlanPanel } from "./MedicalPlan";

type Tab = "roster" | "glide" | "review" | "docs" | "plan" | "checkin";
const POLL_MS = 8000;
const PAGES: Record<Tab, { kicker: string; title: string; sub: string }> = {
  roster: { kicker: "Working tracker", title: "Personnel roster", sub: "One row per person, grouped under the resource they were ordered on. Submitted values are locked; the ember-marked fields are the only ones the Medical Unit edits." },
  glide: { kicker: "Rolling date view", title: "Glide Path", sub: "Workdays remaining per person, grouped by resource. Landscape, one page wide, legend included." },
  review: { kicker: "Exceptions", title: "Needs Resource Review", sub: "The system could not safely determine which resource these people belong to. Nothing merges without a decision here." },
  docs: { kicker: "Status only", title: "Document tracker", sub: "Files stay in the Fire email. This records status, verifier, and timestamp — nothing else." },
  plan: { kicker: "IAP document", title: "Medical Plan (ICS 206)", sub: "Build the incident Medical Plan for the print trailer / IAP. Save in Admin, then Print / Save PDF. Not a substitute for the official signed NWCG form until reviewed by SOF." },
  checkin: { kicker: "Field-facing", title: "Mobile check-in", sub: "No sign-in, one person per submission, reached by the incident QR code." }
};

function playCheckInChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    osc.stop(ctx.currentTime + 0.28);
    window.setTimeout(() => void ctx.close(), 400);
  } catch {
    /* ignore — autoplay / unsupported */
  }
}

function notifyNewCheckIns(names: string[]) {
  const body =
    names.length === 1 ? `New check-in: ${names[0]}` : `${names.length} new check-ins: ${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""}`;
  playCheckInChime();
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification("Medical Check-In", { body, tag: "medical-checkin-live" });
    } catch {
      /* ignore */
    }
  }
  return body;
}

export function App() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [incidentId, setIncidentId] = useState<string>("");
  const [tab, setTab] = useState<Tab>("roster");
  const [filter, setFilter] = useState("All");
  const [roster, setRoster] = useState<any>(null);
  const [glide, setGlide] = useState<any>(null);
  const [review, setReview] = useState<any>(null);
  const [docs, setDocs] = useState<any>(null);
  const [qr, setQr] = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [formStep, setFormStep] = useState(0);
  const [liveNote, setLiveNote] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);
  const incidentIdRef = useRef(incidentId);
  incidentIdRef.current = incidentId;

  const incident = incidents.find((i) => i.id === incidentId) || roster?.incident;

  const refresh = useCallback(async () => {
    const list = await api<any[]>("/api/incidents");
    setIncidents(list);
    const id = incidentIdRef.current || list[0]?.id;
    if (!id) return;
    if (!incidentIdRef.current) setIncidentId(id);
    const [r, g, q, d, qrcode] = await Promise.all([
      api<any>(`/api/incidents/${id}/roster`),
      api<any>(`/api/incidents/${id}/glide`),
      api<any>(`/api/incidents/${id}/review`),
      api<any>(`/api/incidents/${id}/documents`),
      api<any>(`/api/incidents/${id}/qr`)
    ]);
    const peopleList: any[] = r?.people ?? [];
    if (seededRef.current) {
      const newcomers = peopleList.filter((p) => !knownIdsRef.current.has(p.id));
      if (newcomers.length) {
        const names = newcomers.map((p) => `${p.submitted?.firstName ?? ""} ${p.submitted?.lastName ?? ""}`.trim() || "Unknown");
        setLiveNote(notifyNewCheckIns(names));
        setTab("roster");
      }
    } else {
      seededRef.current = true;
    }
    knownIdsRef.current = new Set(peopleList.map((p) => p.id));
    setRoster(r);
    setGlide(g);
    setReview(q);
    setDocs(d);
    setQr(qrcode);
    setLastSyncAt(new Date());
  }, []);

  useEffect(() => {
    seededRef.current = false;
    knownIdsRef.current = new Set();
    refresh().catch(console.error);
  }, [incidentId, refresh]);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      refresh().catch(console.error);
    };
    const id = window.setInterval(tick, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  useEffect(() => {
    if (!liveNote) return;
    const t = window.setTimeout(() => setLiveNote(null), 14000);
    return () => window.clearTimeout(t);
  }, [liveNote]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    api<any>(`/api/people/${selected}`).then(setDetail).catch(console.error);
  }, [selected, roster]);

  const people = roster?.people ?? [];
  const reviewCount = people.filter((p: any) => p.calculated?.glidePathState === "REVIEW").length;
  const nav = [
    { key: "roster" as const, label: "Roster", count: people.length },
    { key: "glide" as const, label: "Glide Path", count: people.filter((p: any) => ["Red", "LWD", "DMB/TVL"].includes(p.calculated?.glidePathState)).length },
    { key: "review" as const, label: "Review queue", count: reviewCount },
    { key: "docs" as const, label: "Documents", count: people.reduce((n: number, p: any) => n + (p.openDocs || 0), 0) },
    { key: "plan" as const, label: "Medical Plan", count: "206" },
    { key: "checkin" as const, label: "Check-in form", count: "QR" }
  ];
  const active = people.filter((p: any) => p.status === "Active").length;
  const counters = [
    { label: "Resources", value: roster?.counts?.activeResources ?? 0, color: "#1c1814" },
    { label: "Personnel", value: active, color: "#1c1814" },
    { label: "Enroute", value: people.filter((p: any) => p.status === "Enroute").length, color: "#3b5a80" },
    { label: "LWD / DMB", value: people.filter((p: any) => ["LWD", "DMB/TVL"].includes(p.calculated?.glidePathState)).length, color: "#b8461d" },
    { label: "Review", value: reviewCount, color: "#e2691f" }
  ];

  const shown = people.filter((p: any) => {
    if (filter === "All") return true;
    if (filter === "Needs Review") return p.status === "Needs Resource Review";
    return p.status === filter;
  });

  const groups = useMemo(() => {
    const resources = roster?.resources ?? [];
    return resources
      .map((r: any) => {
        const plist = shown.filter((p: any) => p.resourceInstanceId === r.id);
        if (!plist.length) return null;
        return { r, plist };
      })
      .filter(Boolean)
      .concat(
        shown.some((p: any) => !p.resourceInstanceId)
          ? [{ r: { id: "unlinked", callSign: "—", company: "Unlinked", resourceOrderRaw: "", type: "", state: "Needs Resource Review" }, plist: shown.filter((p: any) => !p.resourceInstanceId) }]
          : []
      );
  }, [roster, shown]);

  async function saveOverride(field: string, value: string) {
    if (!selected) return;
    const body: Record<string, unknown> = { [field]: value === "" ? null : field === "assignmentLength" || field === "extensionDays" ? Number(value) : value };
    await api(`/api/people/${selected}/overrides`, { method: "PATCH", body: JSON.stringify(body) });
    await refresh();
  }

  async function cycleDoc(personId: string, type: string) {
    await api(`/api/people/${personId}/documents/${encodeURIComponent(type)}/cycle`, { method: "POST" });
    await refresh();
    if (selected) setDetail(await api(`/api/people/${selected}`));
  }

  const previewPerson = people.find((p: any) => p.submitted.lastName === "Ellery") || people[0];
  const page = PAGES[tab];

  return (
    <div className="app">
      {liveNote && (
        <div className="live-toast no-print" role="status">
          <span className="live-toast-pip" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 9.5, letterSpacing: ".08em", textTransform: "uppercase", color: "#f4b183" }}>Live update</div>
            <div style={{ marginTop: 3, font: "600 13px/1.35 IBM Plex Sans" }}>{liveNote}</div>
          </div>
          <button type="button" className="chip" onClick={() => setLiveNote(null)} style={{ border: "1px solid rgba(255,255,255,.2)", background: "transparent", color: "#e8e1d6" }}>
            Dismiss
          </button>
        </div>
      )}
      <nav className="nav">
        <div className="nav-brand">
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div className="nav-dot" />
            <div style={{ font: "600 12.5px/1.1 IBM Plex Sans" }}>Medical Unit</div>
          </div>
          <div style={{ marginTop: 11, font: "600 15px/1.25 IBM Plex Sans", color: "#fff" }}>{incident?.name ?? "—"}</div>
          <div style={{ marginTop: 4, font: "400 10.5px/1.3 IBM Plex Mono", color: "#8e857a" }}>{incident?.number} · {incident?.opPeriod}</div>
          <div className="live-sync no-print" title="Roster refreshes automatically about every 8 seconds while this tab is open">
            <span className="live-sync-dot" />
            Live{lastSyncAt ? ` · ${lastSyncAt.toLocaleTimeString()}` : ""}
          </div>
          {incidents.length > 1 && (
            <select className="no-print" value={incidentId} onChange={(e) => setIncidentId(e.target.value)} style={{ marginTop: 10, width: "100%", background: "#2a241d", color: "#e8e1d6", border: "1px solid #3a332b", borderRadius: 6, padding: 6 }}>
              {incidents.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          )}
        </div>
        <div className="nav-links">
          {nav.map((item) => {
            const on = tab === item.key;
            return (
              <button key={item.key} className="nav-btn" onClick={() => setTab(item.key)} style={{ background: on ? "rgba(226,105,31,.16)" : "transparent", color: on ? "#fff" : "#a79c8d" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: on ? "#e2691f" : "rgba(255,255,255,.18)" }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                <span className="mono" style={{ fontSize: 10, color: on ? "#f4b183" : "#7d7469", background: on ? "rgba(226,105,31,.25)" : "rgba(255,255,255,.06)", padding: "2px 5px", borderRadius: 4 }}>{item.count}</span>
              </button>
            );
          })}
        </div>
        <div className="nav-foot">
          Fire docs email
          <div style={{ color: "#c9bfb1" }}>{incident?.fireEmail}</div>
        </div>
      </nav>
      <main className="main">
        <header className="head">
          <div>
            <div className="kicker">{page.kicker}</div>
            <h1>{page.title}</h1>
            <p className="sub">{page.sub}</p>
          </div>
          <div className="counters">
            {counters.map((c) => (
              <div className="counter" key={c.label}><b style={{ color: c.color }}>{c.value}</b><span>{c.label}</span></div>
            ))}
          </div>
        </header>
        <div className="page">
          {tab === "roster" && (
            <div className="card" style={{ overflowX: "auto" }}>
              <div style={{ display: "flex", gap: 8, minWidth: 780, padding: "11px 14px", borderBottom: "1px solid #eee7dc", background: "#fbf8f3" }}>
                {["All", "Active", "Enroute", "Needs Review"].map((f) => (
                  <button key={f} className="chip" onClick={() => setFilter(f)} style={{ border: `1px solid ${filter === f ? "#1c1814" : "#e0d6c7"}`, background: filter === f ? "#1c1814" : "#fff", color: filter === f ? "#fff" : "#6f6558" }}>{f}</button>
                ))}
                <div style={{ flex: 1 }} />
                <div className="mono" style={{ fontSize: 10.5, color: "#9a8f80" }}>{shown.length} of {people.length} personnel</div>
              </div>
              {groups.map((g: any) => {
                const review = g.r.state === "Needs Resource Review";
                return (
                  <div key={g.r.id} style={{ borderBottom: "1px solid #f0eae0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 780, padding: "9px 14px", background: review ? "#fdf1ea" : "#fbf8f3" }}>
                      <span className="mono" style={{ font: "600 11px/1 IBM Plex Mono", padding: "3px 7px", borderRadius: 5, background: "#1c1814", color: "#f4b183" }}>{g.r.callSign}</span>
                      <span style={{ font: "600 12.5px IBM Plex Sans" }}>{g.r.company}</span>
                      <span className="mono" style={{ fontSize: 11, color: "#8b8072" }}>{g.r.resourceOrderRaw}</span>
                      <span style={{ fontSize: 10.5, color: "#8b8072" }}>{g.r.type} · {g.plist.length} {g.plist.length === 1 ? "person" : "people"}</span>
                      <div style={{ flex: 1 }} />
                      <span style={{ fontSize: 10.5, padding: "3px 8px", borderRadius: 5, background: review ? "#1c1814" : g.r.state === "Enroute" ? "#e7eef7" : "#e2f0e6", color: review ? "#f4b183" : g.r.state === "Enroute" ? "#3b5a80" : "#2f6b45" }}>{g.r.state}</span>
                    </div>
                    {g.plist.map((p: any) => {
                      const gp = p.calculated.glidePathState as GlideState;
                      const c = GLIDE_COLORS[gp];
                      const on = selected === p.id;
                      return (
                        <div key={p.id} onClick={() => setSelected(p.id)} style={{ display: "grid", gridTemplateColumns: "16px minmax(150px,1.5fr) 78px minmax(110px,1fr) minmax(92px,1fr) minmax(120px,1fr) 110px", gap: 12, alignItems: "center", minWidth: 780, padding: "10px 14px 10px 22px", cursor: "pointer", borderLeft: `3px solid ${on ? "#e2691f" : "transparent"}`, background: on ? "#fff8f0" : "#fff" }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot }} />
                          <div>
                            <div style={{ font: "500 13px/1.2 IBM Plex Sans" }}>{p.submitted.firstName} {p.submitted.lastName}</div>
                            <div className="mono" style={{ fontSize: 10.5, color: "#9a8f80" }}>{p.responseId.slice(0, 8)}</div>
                          </div>
                          <div style={{ fontSize: 11, color: "#5e5449" }}>{p.submitted.position}</div>
                          <div className="mono" style={{ fontSize: 11.5, color: "#5e5449" }}>{p.submitted.phone}</div>
                          <div style={{ fontSize: 11, color: "#5e5449" }}>{[p.effective.division, p.effective.camp].filter(Boolean).join(" / ") || "— not assigned"}</div>
                          <div className="mono" style={{ fontSize: 11.5, color: "#5e5449" }}>{p.effective.firstWorkDay && p.calculated.lastWorkDay ? `${formatShortDate(p.effective.firstWorkDay)} → ${formatShortDate(p.calculated.lastWorkDay)}` : "— no dates"}</div>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                            <span className="mono" style={{ fontSize: 10, padding: "3px 6px", borderRadius: 4, background: c.bg, color: c.fg }}>{gp === "REVIEW" ? "REVIEW" : `${p.calculated.workdaysRemaining}d`}</span>
                            <span className="mono" style={{ fontSize: 10, color: "#a89d8d" }}>{p.openDocs ? `${p.openDocs} doc open` : "docs ok"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {tab === "glide" && glide && (
            <div className="card glide-print-root">
              <div className="print-only glide-print-banner">
                <div className="mono" style={{ fontSize: 10, letterSpacing: ".1em", color: "#b8461d", textTransform: "uppercase" }}>Medical Unit · Glide Path</div>
                <div style={{ marginTop: 4, font: "600 18px IBM Plex Sans" }}>{incident?.name || "Incident"}{incident?.number ? ` · ${incident.number}` : ""}</div>
                <div className="mono" style={{ marginTop: 4, fontSize: 11, color: "#6f6558" }}>
                  Rolling 14 days from {glide.startLabel}
                  {incident?.opPeriod ? ` · OP ${incident.opPeriod}` : ""}
                  {" · Printed "}
                  {new Date().toLocaleString()}
                </div>
              </div>
              <div className="no-print" style={{ display: "flex", gap: 14, padding: "12px 16px", borderBottom: "1px solid #eee7dc", background: "#fbf8f3", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ font: "600 12px IBM Plex Sans" }}>Rolling 14 days from {glide.startLabel}</div>
                <div style={{ flex: 1 }} />
                {(["Green", "Yellow", "Red", "LWD", "DMB/TVL", "REVIEW"] as GlideState[]).map((k) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: GLIDE_COLORS[k].dot }} />
                    <span className="mono" style={{ fontSize: 10, color: "#6f6558" }}>{k}</span>
                  </div>
                ))}
                <button
                  type="button"
                  className="chip"
                  onClick={() => {
                    setSelected(null);
                    const prev = document.title;
                    const stamp = new Date().toISOString().slice(0, 10);
                    document.title = `Glide-Path_${incident?.name || "incident"}_${stamp}`.replace(/\s+/g, "-");
                    window.print();
                    document.title = prev;
                  }}
                  style={{ border: "1px solid #1c1814", background: "#1c1814", color: "#fff", padding: "7px 12px" }}
                  title="Opens the system print dialog. Choose Save as PDF or a large-format printer."
                >
                  Print / Save PDF
                </button>
              </div>
              <div className="print-only glide-print-legend" style={{ gap: 14, padding: "8px 0 10px", alignItems: "center", flexWrap: "wrap" }}>
                {(["Green", "Yellow", "Red", "LWD", "DMB/TVL", "REVIEW"] as GlideState[]).map((k) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: GLIDE_COLORS[k].dot }} />
                    <span className="mono" style={{ fontSize: 10, color: "#6f6558" }}>{k}</span>
                  </div>
                ))}
              </div>
              <div className="glide-grid" style={{ borderBottom: "1px solid #eee7dc" }}>
                <div style={{ padding: "8px 14px", font: "600 9.5px IBM Plex Mono", letterSpacing: ".09em", color: "#9a8f80", textTransform: "uppercase" }}>Resource / person</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(14,1fr)" }}>
                  {glide.days.map((iso: string, i: number) => {
                    const d = new Date(iso + "T12:00:00Z");
                    return (
                      <div key={iso} style={{ padding: "8px 0", textAlign: "center", borderLeft: "1px solid #f4efe6", background: i === 0 ? "#fdf1ea" : "#fff" }}>
                        <div className="mono" style={{ fontSize: 10, color: i === 0 ? "#b8461d" : "#5e5449" }}>{d.getUTCDate()}</div>
                        <div className="mono" style={{ fontSize: 9, color: "#a89d8d" }}>{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][d.getUTCDay()]}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {glide.rows.map((r: any) => {
                const c = GLIDE_COLORS[r.gp as GlideState];
                return (
                  <div key={r.id} className="glide-grid" style={{ borderBottom: "1px solid #f4efe6", background: r.gp === "REVIEW" ? "#fdf9f5" : "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 14px" }}>
                      <span className="mono" style={{ fontSize: 9.5, padding: "3px 6px", borderRadius: 4, background: "#f1ece3" }}>{r.callSign}</span>
                      <span style={{ font: "500 12px IBM Plex Sans" }}>{r.name}</span>
                      <div style={{ flex: 1 }} />
                      <span className="mono" style={{ fontSize: 9.5, padding: "3px 6px", borderRadius: 4, background: c.bg, color: c.fg }}>{r.gp === "DMB/TVL" ? "DMB" : r.gp}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(14,1fr)" }}>
                      {r.days.map((cell: any) => {
                        const st = cell.state ? GLIDE_COLORS[cell.state as GlideState] : null;
                        return <div key={cell.iso} className="daycell" style={{ background: st?.bg ?? "#fff", color: st?.fg }}>{cell.mark}</div>;
                      })}
                    </div>
                  </div>
                );
              })}
              <div style={{ display: "flex", gap: 26, padding: "13px 16px", background: "#fbf8f3" }}>
                {[
                  ["Active resources", glide.totals.activeResources, "#1c1814"],
                  ["Active personnel", glide.totals.activePersonnel, "#1c1814"],
                  ["Yellow", glide.totals.yellow, "#8a6512"],
                  ["Red", glide.totals.red, "#a3381f"],
                  ["LWD / DMB", glide.totals.lwdDmb, "#b8461d"],
                  ["Needs review", glide.totals.review, "#e2691f"]
                ].map(([l, v, color]) => (
                  <div key={String(l)}><div className="mono" style={{ fontSize: 16, color: String(color) }}>{v}</div><div style={{ marginTop: 3, fontSize: 9.5, color: "#8b8072" }}>{l}</div></div>
                ))}
              </div>
            </div>
          )}

          {tab === "review" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 900 }}>
              {(review?.cards ?? []).map((rc: any) => (
                <div key={rc.personId} className="card" style={{ borderLeft: "4px solid #e2691f" }}>
                  <div style={{ padding: "14px 18px", borderBottom: "1px solid #f0eae0" }}>
                    <div className="mono" style={{ fontSize: 9.5, letterSpacing: ".1em", color: "#b8461d", textTransform: "uppercase" }}>Ambiguous match — nothing merged</div>
                    <div style={{ marginTop: 8, font: "600 16px IBM Plex Sans" }}>{rc.name}</div>
                    <div className="mono" style={{ marginTop: 4, fontSize: 11.5, color: "#8b8072" }}>{rc.meta}</div>
                  </div>
                  <div style={{ padding: "14px 18px" }}>
                    <div style={{ fontSize: 11.5, color: "#6f6558" }}>{rc.reason}</div>
                    <div style={{ marginTop: 11, display: "flex", flexDirection: "column", gap: 8 }}>
                      {rc.candidates.map((cd: any) => (
                        <div key={cd.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid #e3dbcf", borderRadius: 8 }}>
                          <span className="mono" style={{ fontSize: 10.5, padding: "4px 7px", borderRadius: 5, background: "#1c1814", color: "#f4b183" }}>{cd.callSign}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ font: "500 12.5px IBM Plex Sans" }}>{cd.company}</div>
                            <div className="mono" style={{ fontSize: 10.5, color: "#8b8072" }}>{cd.resourceOrderRaw} · assigned {cd.dateAssigned} · {cd.personnelCount} people linked</div>
                          </div>
                          <button onClick={async () => { await api(`/api/people/${rc.personId}/review/link`, { method: "POST", body: JSON.stringify({ resourceId: cd.id }) }); await refresh(); }} style={{ padding: "6px 12px", borderRadius: 6, border: 0, background: "#1c1814", color: "#fff", cursor: "pointer" }}>Link</button>
                        </div>
                      ))}
                      <button onClick={async () => { await api(`/api/people/${rc.personId}/review/provisional`, { method: "POST" }); await refresh(); }} style={{ alignSelf: "flex-start", padding: "7px 13px", borderRadius: 6, border: "1px dashed #cbbfae", background: "transparent", color: "#6f6558", cursor: "pointer" }}>Create provisional resource instead</button>
                    </div>
                  </div>
                </div>
              ))}
              {!(review?.cards ?? []).length && <div style={{ padding: 34, textAlign: "center", background: "#fff", border: "1px dashed #e0d6c7", borderRadius: 10, color: "#8b8072" }}>Review queue is clear. Every person is linked to exactly one resource instance.</div>}
            </div>
          )}

          {tab === "docs" && docs && (
            <div className="card" style={{ maxWidth: 1040 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr repeat(4,1fr) 1.1fr", padding: "10px 16px", background: "#fbf8f3", borderBottom: "1px solid #eee7dc" }}>
                {["Person", ...DOCUMENT_TYPES, "Verifier"].map((c) => <div key={c} className="mono" style={{ fontSize: 9.5, letterSpacing: ".08em", color: "#9a8f80", textTransform: "uppercase" }}>{c}</div>)}
              </div>
              {docs.rows.map((r: any) => (
                <div key={r.personId} style={{ display: "grid", gridTemplateColumns: "1.4fr repeat(4,1fr) 1.1fr", alignItems: "center", padding: "9px 16px", borderBottom: "1px solid #f4efe6" }}>
                  <div><div style={{ font: "500 12.5px IBM Plex Sans" }}>{r.name}</div><div className="mono" style={{ fontSize: 10.5, color: "#9a8f80" }}>{r.sub}</div></div>
                  {DOCUMENT_TYPES.map((t) => {
                    const st = r.docs[t] || "Not Required";
                    const s = DOCUMENT_STYLE[st as keyof typeof DOCUMENT_STYLE];
                    return <div key={t}><button className="doc-chip" style={{ border: `1px solid ${s.border}`, background: s.bg, color: s.fg }} onClick={() => cycleDoc(r.personId, t)}>{String(st).toUpperCase()}</button></div>;
                  })}
                  <div className="mono" style={{ fontSize: 10.5, color: "#9a8f80", textAlign: "right" }}>{r.verifier}</div>
                </div>
              ))}
              <div style={{ padding: "12px 16px", background: "#faf5ed", fontSize: 11, color: "#8b8072" }}>No attachments, images, or file links are stored here. Documents live in the Fire email at {docs.fireEmail}.</div>
            </div>
          )}

          {tab === "plan" && incidentId && (
            <MedicalPlanPanel
              incidentId={incidentId}
              incidentName={incident?.name}
              incidentNumber={incident?.number}
            />
          )}

          {tab === "checkin" && (
            <div style={{ display: "flex", gap: 26, alignItems: "flex-start" }}>
              <div style={{ width: 330, background: "#1c1814", borderRadius: 26, padding: 11 }}>
                <div style={{ background: "#fbf8f3", borderRadius: 18, overflow: "hidden" }}>
                  <div style={{ padding: "16px 18px", background: "#1c1814", color: "#fff" }}>
                    <div className="mono" style={{ fontSize: 9.5, letterSpacing: ".1em", color: "#e2691f", textTransform: "uppercase" }}>Medical check-in</div>
                    <div style={{ marginTop: 8, font: "600 19px IBM Plex Sans" }}>{incident?.name}</div>
                    <div className="mono" style={{ marginTop: 5, fontSize: 10.5, color: "#a79c8d" }}>{incident?.number}</div>
                  </div>
                  <div style={{ padding: "14px 18px 20px", display: "flex", flexDirection: "column", gap: 13 }}>
                    <div style={{ padding: "11px 12px", background: "#fdf1ea", border: "1px solid #f2ddcd", borderRadius: 8, fontSize: 11.5, color: "#8f3413" }}>Check in for yourself only. Every ambulance and REMS member submits a separate response.</div>
                    <div>
                      <div className="mono" style={{ fontSize: 9.5, letterSpacing: ".09em", color: "#9a8f80", textTransform: "uppercase" }}>Step {formStep + 1} of 6 · {FORM_SECTIONS[formStep].name}</div>
                      <div style={{ marginTop: 7, display: "flex", gap: 3 }}>{FORM_SECTIONS.map((_, i) => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= formStep ? "#e2691f" : "#e3dbcf" }} />)}</div>
                    </div>
                    {previewPerson && FORM_SECTIONS[formStep].keys.map((k) => {
                      const restricted = /street|city|state|zip|license|supervisor|emergency|eera|director/i.test(k);
                      const raw = (previewPerson.submitted as any)[k];
                      const value = restricted ? "Restricted" : Array.isArray(raw) ? raw.join(", ") : String(raw ?? "—");
                      return (
                        <div key={k}>
                          <div style={{ fontSize: 11.5, color: "#3a332b" }}>{FIELD_LABELS[k as keyof typeof FIELD_LABELS]}</div>
                          <div style={{ marginTop: 6, padding: "10px 11px", background: "#fff", border: "1px solid #e3dbcf", borderRadius: 8, fontSize: 12, color: restricted ? "#a89d8d" : "#2a241d", minHeight: 38 }}>{value}</div>
                        </div>
                      );
                    })}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setFormStep((s) => Math.max(0, s - 1))} style={{ padding: "11px 15px", borderRadius: 9, border: "1px solid #e0d6c7", background: "#fff", minHeight: 44 }}>Back</button>
                      <button onClick={() => setFormStep((s) => Math.min(5, s + 1))} style={{ flex: 1, padding: "11px 15px", borderRadius: 9, border: 0, background: "#e2691f", color: "#fff", minHeight: 44 }}>{formStep === 5 ? "Submit check-in" : "Continue"}</button>
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: "#9a8f80" }}>Do not upload files. Email Contract, Driver’s License, NREMT, State license, and — if you selected Narcotics — the Medical Director letter to {incident?.fireEmail}.</div>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, maxWidth: 460, display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="card" style={{ padding: "16px 18px" }}>
                  <div className="mono" style={{ fontSize: 9.5, letterSpacing: ".09em", color: "#9a8f80", textTransform: "uppercase" }}>Incident QR</div>
                  <div style={{ marginTop: 12, display: "flex", gap: 16, alignItems: "center" }}>
                    {qr?.png ? <img src={qr.png} alt="Incident check-in QR" width={96} height={96} style={{ borderRadius: 8, border: "6px solid #fff", outline: "1px solid #e3dbcf" }} /> : <div style={{ width: 96, height: 96, background: "#eee" }} />}
                    <div style={{ fontSize: 11.5, color: "#6f6558" }}>The printed QR encodes only the check-in link. It opens without a Google account, and no respondent can view, search, or export any response.<div className="mono" style={{ marginTop: 8, wordBreak: "break-all" }}>{qr?.url}</div></div>
                  </div>
                  {qr?.warning && (
                    <div style={{ marginTop: 12, padding: "10px 12px", background: "#fdf1ea", border: "1px solid #f2ddcd", borderRadius: 8, fontSize: 11.5, color: "#8f3413" }}>
                      {qr.warning}
                    </div>
                  )}
                  {qr?.url && (
                    <a href={qr.url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: "#b8461d" }}>
                      Open check-in link
                    </a>
                  )}
                </div>
                <div className="card" style={{ padding: "16px 18px" }}>
                  <div className="mono" style={{ fontSize: 9.5, color: "#9a8f80", textTransform: "uppercase" }}>34 questions, 6 sections</div>
                  {FORM_SECTIONS.map((s, i) => (
                    <button key={s.id} onClick={() => setFormStep(i)} style={{ display: "flex", width: "100%", marginTop: 7, padding: "8px 10px", borderRadius: 7, border: `1px solid ${i === formStep ? "#f2ddcd" : "#eee7dc"}`, background: i === formStep ? "#fdf1ea" : "#fff", textAlign: "left", cursor: "pointer" }}>
                      <span className="mono" style={{ width: 16, color: i === formStep ? "#b8461d" : "#a89d8d" }}>{String(i + 1).padStart(2, "0")}</span>
                      <span style={{ flex: 1, font: "500 12px IBM Plex Sans" }}>{s.name}</span>
                      <span className="mono" style={{ fontSize: 10.5, color: "#9a8f80" }}>{s.range}</span>
                    </button>
                  ))}
                </div>
                <IncidentControls
                  incident={incident}
                  onChange={refresh}
                  onCreated={(id) => {
                    setIncidentId(id);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {detail?.person && (
        <aside className="drawer">
          <div style={{ padding: "14px 16px", background: "#1c1814", color: "#fff", position: "sticky", top: 0 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: ".1em", color: "#e2691f", textTransform: "uppercase" }}>{detail.person.resource?.callSign ?? "Unmatched"} · {detail.person.submitted.resourceOrderRaw}</div>
                <div style={{ marginTop: 7, font: "600 16px IBM Plex Sans" }}>{detail.person.submitted.firstName} {detail.person.submitted.lastName}</div>
                <div className="mono" style={{ marginTop: 4, fontSize: 11, color: "#a79c8d" }}>{detail.person.submitted.position} · {detail.person.submitted.medicalCertification} · {detail.formsResponseId}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid rgba(255,255,255,.18)", background: "transparent", color: "#c9bfb1" }}>×</button>
            </div>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 13 }}>
            <div>
              <div className="kicker">Submitted — locked</div>
              {[
                ["Resource Order #", detail.person.submitted.resourceOrderRaw],
                ["Phone", detail.person.submitted.phone],
                ["Date assigned", detail.person.submitted.dateAssigned],
                ["Submitted first work day", detail.person.submitted.firstWorkDay],
                ["Submitted length", `${detail.person.submitted.assignmentLength} days`],
                ["Arduous qualified", detail.person.submitted.arduousQualified]
              ].map(([k, v]) => (
                <div key={String(k)} className="submitted" style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "8px 0", color: "#6f6558" }}><span>{k}</span><span className="mono">{v}</span></div>
              ))}
            </div>
            <div>
              <div className="kicker">Admin fields</div>
              {[
                ["division", "Division", detail.person.effective.division],
                ["camp", "Camp", detail.person.effective.camp],
                ["firstWorkDay", "Eff. first day", detail.person.effective.firstWorkDay],
                ["assignmentLength", "Eff. length", String(detail.person.effective.assignmentLength)],
                ["extensionDays", "Extension days", String(detail.person.effective.extensionDays)]
              ].map(([k, label, v]) => (
                <label key={k} className="admin-field" style={{ display: "block", marginTop: 10, fontSize: 11.5 }}>
                  {label}
                  <input defaultValue={v} key={`${detail.person.id}-${k}-${v}`} onBlur={(e) => saveOverride(k, e.target.value)} />
                </label>
              ))}
              <label className="admin-field" style={{ display: "block", marginTop: 10, fontSize: 11.5 }}>
                Operational status
                <select defaultValue={detail.person.status} key={detail.person.status} onChange={(e) => saveOverride("operationalStatus", e.target.value)}>
                  {["Checked In - Needs Assignment", "Needs Resource Review", "Enroute", "Active", "DMB/Travel", "Released", "Cancelled"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <div className="calc">
              <div className="kicker">Calculated</div>
              <div style={{ marginTop: 8 }}>Last Work Day <b style={{ float: "right" }}>{detail.person.calculated.lastWorkDay ?? "REVIEW"}</b></div>
              <div style={{ marginTop: 6 }}>DMB / Travel start <b style={{ float: "right" }}>{detail.person.calculated.dmbStart ?? "REVIEW"}</b></div>
              <div style={{ marginTop: 6 }}>Glide Path <b style={{ float: "right", color: GLIDE_COLORS[detail.person.calculated.glidePathState as GlideState].fg }}>{detail.person.calculated.glidePathState}{detail.person.calculated.workdaysRemaining != null ? ` · ${detail.person.calculated.workdaysRemaining}d` : ""}</b></div>
              <div className="mono" style={{ marginTop: 10, fontSize: 10, color: "#8b8072" }}>LWD = First work day + assignment length − 1 + extension. DMB = LWD + 1.</div>
            </div>
            <div>
              <div className="kicker">Documents</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {DOCUMENT_TYPES.map((t) => {
                  const st = detail.person.docs[t] || "Not Required";
                  const s = DOCUMENT_STYLE[st as keyof typeof DOCUMENT_STYLE];
                  return <button key={t} className="doc-chip" style={{ border: `1px solid ${s.border}`, background: s.bg, color: s.fg }} onClick={() => cycleDoc(detail.person.id, t)}>{t}: {st}</button>;
                })}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

function IncidentControls({
  incident,
  onChange,
  onCreated
}: {
  incident: any;
  onChange: () => void | Promise<void>;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [newFireEmail, setNewFireEmail] = useState("");
  const [editFireEmail, setEditFireEmail] = useState(incident?.fireEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEditFireEmail(incident?.fireEmail ?? "");
  }, [incident?.id, incident?.fireEmail]);

  if (!incident) return null;

  const fieldStyle = { width: "100%", marginTop: 8, padding: 10, borderRadius: 6, border: "1px solid #e3dbcf", minHeight: 44 } as const;

  return (
    <div className="card no-print" style={{ padding: "16px 18px" }}>
      <div className="mono" style={{ fontSize: 9.5, color: "#9a8f80", textTransform: "uppercase" }}>Incident</div>
      <div style={{ marginTop: 8, fontSize: 12, color: "#6f6558" }}>Status: {incident.status}</div>
      <label style={{ display: "block", marginTop: 12, fontSize: 11.5, color: "#3a332b" }}>
        Fire docs email (this incident)
        <input
          type="email"
          value={editFireEmail}
          onChange={(e) => setEditFireEmail(e.target.value)}
          placeholder="e.g. 2026.Littlegiant.medical@firenet.gov"
          style={fieldStyle}
        />
      </label>
      <button
        style={{ marginTop: 8, minHeight: 44, padding: "8px 12px", borderRadius: 8, border: "1px solid #e3dbcf", background: "#fff", color: "#2a241d" }}
        disabled={busy || !editFireEmail.trim() || editFireEmail.trim() === incident.fireEmail}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api(`/api/incidents/${incident.id}`, {
              method: "PATCH",
              body: JSON.stringify({ fireEmail: editFireEmail.trim() })
            });
            await onChange();
          } catch (e) {
            setError((e as Error).message || "Could not update Fire email");
          } finally {
            setBusy(false);
          }
        }}
      >
        Save Fire email
      </button>
      <button
        style={{ marginTop: 10, minHeight: 44, padding: "8px 12px", borderRadius: 8, border: "1px solid #1c1814", background: "#1c1814", color: "#fff" }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api(`/api/incidents/${incident.id}/close`, { method: "POST" });
            await onChange();
          } catch (e) {
            setError((e as Error).message || "Could not close incident");
          } finally {
            setBusy(false);
          }
        }}
      >
        Close incident
      </button>

      <div style={{ marginTop: 16, font: "600 12px IBM Plex Sans" }}>New clean incident</div>
      <div style={{ marginTop: 6, fontSize: 11, color: "#8b8072", lineHeight: 1.45 }}>
        Starts empty (no people or responses). Set the <b>new</b> fire’s docs email — do not leave the previous fire’s address.
      </div>
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} />
      <input placeholder="Number" value={number} onChange={(e) => setNumber(e.target.value)} style={fieldStyle} />
      <input
        type="email"
        placeholder="Fire docs email for the new fire"
        value={newFireEmail}
        onChange={(e) => setNewFireEmail(e.target.value)}
        style={fieldStyle}
      />
      {incident.fireEmail && (
        <div className="mono" style={{ marginTop: 6, fontSize: 10, color: "#9a8f80" }}>
          Previous fire email (for reference only): {incident.fireEmail}
        </div>
      )}
      {error && (
        <div style={{ marginTop: 8, padding: "8px 10px", background: "#fdf1ea", border: "1px solid #f2ddcd", borderRadius: 8, fontSize: 11.5, color: "#8f3413" }}>
          {error}
        </div>
      )}
      <button
        style={{ marginTop: 8, minHeight: 44, width: "100%", borderRadius: 8, border: 0, background: "#e2691f", color: "#fff", opacity: busy ? 0.7 : 1 }}
        disabled={busy}
        onClick={async () => {
          const trimmedName = name.trim();
          const trimmedNumber = number.trim();
          const trimmedEmail = newFireEmail.trim();
          if (!trimmedName || !trimmedNumber || !trimmedEmail) {
            setError("Name, number, and Fire docs email are required for a new incident.");
            return;
          }
          if (!trimmedEmail.includes("@")) {
            setError("Fire docs email must be a valid email address.");
            return;
          }
          setBusy(true);
          setError(null);
          try {
            const rec = await api<{ id: string }>("/api/incidents", {
              method: "POST",
              body: JSON.stringify({
                name: trimmedName,
                number: trimmedNumber,
                timezone: incident.timezone,
                fireEmail: trimmedEmail
              })
            });
            setName("");
            setNumber("");
            setNewFireEmail("");
            onCreated(rec.id);
          } catch (e) {
            setError((e as Error).message || "Could not create incident");
          } finally {
            setBusy(false);
          }
        }}
      >
        Create clean incident
      </button>
    </div>
  );
}
