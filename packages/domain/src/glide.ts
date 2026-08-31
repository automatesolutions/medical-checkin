import { addDays } from "./normalize.js";
import type { GlideState } from "./types.js";

export const GLIDE_COLORS: Record<GlideState, { hex: string; bg: string; fg: string; dot: string }> = {
  Green: { hex: "#3f8f5e", bg: "#e2f0e6", fg: "#2f6b45", dot: "#3f8f5e" },
  Yellow: { hex: "#d1a02a", bg: "#fbf0d4", fg: "#8a6512", dot: "#d1a02a" },
  Red: { hex: "#c4452c", bg: "#fbe3dd", fg: "#a3381f", dot: "#c4452c" },
  LWD: { hex: "#b8461d", bg: "#f6ddd2", fg: "#8f3413", dot: "#b8461d" },
  "DMB/TVL": { hex: "#5b53a3", bg: "#e6e3f2", fg: "#4a4380", dot: "#5b53a3" },
  Gray: { hex: "#a09a90", bg: "#edeae4", fg: "#777066", dot: "#a09a90" },
  REVIEW: { hex: "#e2691f", bg: "#1c1814", fg: "#f4b183", dot: "#e2691f" }
};

/** Inclusive workdays remaining: LWD − today + 1. */
export function workdaysRemaining(lastWorkDay: string, today: string): number {
  const a = Date.parse(`${lastWorkDay}T12:00:00Z`);
  const b = Date.parse(`${today}T12:00:00Z`);
  return Math.round((a - b) / 86400000) + 1;
}

export function glideStateFromRemaining(n: number | null, opts?: { forceReview?: boolean; complete?: boolean }): GlideState {
  if (opts?.forceReview || n === null || Number.isNaN(n)) return "REVIEW";
  if (opts?.complete) return "Gray";
  if (n >= 8) return "Green";
  if (n >= 4) return "Yellow";
  if (n >= 2) return "Red";
  if (n === 1) return "LWD";
  if (n === 0) return "DMB/TVL";
  return "Gray";
}

export function rollingDays(today: string, count = 14): string[] {
  return Array.from({ length: count }, (_, i) => addDays(today, i));
}
