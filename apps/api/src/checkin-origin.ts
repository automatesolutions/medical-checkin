/** Resolve the public check-in base URL used for QR / share links. */
export function resolvePublicCheckinOrigin(env: NodeJS.ProcessEnv = process.env): {
  base: string;
  originConfigured: boolean;
  warning: string | null;
} {
  const configured = (env.PUBLIC_CHECKIN_ORIGIN || "").trim().replace(/\/$/, "");
  const base = configured || "http://localhost:5174";
  const looksLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(base);
  let warning: string | null = null;
  if (!configured) {
    warning =
      "PUBLIC_CHECKIN_ORIGIN is not set on this Admin service. The QR/link uses localhost and will not work for field phones. Set it to the public check-in Cloud Run URL (no trailing slash).";
  } else if (looksLocal) {
    warning =
      "Check-in link points at localhost. Field phones cannot open this. Set PUBLIC_CHECKIN_ORIGIN to the public check-in Cloud Run URL.";
  } else if (/medical-admin/i.test(base)) {
    warning =
      "Check-in link looks like the Admin host. It must be the public check-in service URL (medical-checkin…), not medical-admin.";
  }
  return { base, originConfigured: Boolean(configured), warning };
}
