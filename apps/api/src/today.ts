export function calendarToday(timezone: string, pinned?: string | null): string {
  if (pinned) return pinned;
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date());
}
