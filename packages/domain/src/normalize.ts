export function normalizeResourceOrder(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "").replace(/-+/g, "-");
  const m = /^([EO])-?(\d+[A-Z0-9]*)$/.exec(s);
  return m ? `${m[1]}-${m[2]}` : s;
}

export function normalizeCompany(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export function isoDate(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function addDays(iso: string, days: number): string {
  const [y, mo, d] = iso.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, mo - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function formatShortDate(iso: string): string {
  const [y, mo, d] = iso.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
