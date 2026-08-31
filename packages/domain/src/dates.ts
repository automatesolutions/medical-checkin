import { addDays, isoDate } from "./normalize.js";

export type AssignmentInputs = {
  firstWorkDay: string | null | undefined;
  assignmentLength: number | null | undefined;
  extensionDays: number | null | undefined;
};

export type AssignmentDates = {
  lastWorkDay: string | null;
  dmbStart: string | null;
  valid: boolean;
};

/** Last Work Day = First Work Day + Assignment Length − 1 + Extension Days. DMB = LWD + 1. */
export function calculateAssignmentDates(input: AssignmentInputs): AssignmentDates {
  const fwd = input.firstWorkDay ? isoDate(input.firstWorkDay) : null;
  const length = input.assignmentLength;
  const ext = input.extensionDays ?? 0;
  if (!fwd || length == null || !Number.isInteger(length) || length < 1 || !Number.isInteger(ext) || ext < 0) {
    return { lastWorkDay: null, dmbStart: null, valid: false };
  }
  const lastWorkDay = addDays(fwd, length - 1 + ext);
  return { lastWorkDay, dmbStart: addDays(lastWorkDay, 1), valid: true };
}

export function effectiveAssignment(
  submitted: { firstWorkDay: string; assignmentLength: number },
  overrides: { firstWorkDay?: string | null; assignmentLength?: number | null; extensionDays?: number | null }
) {
  const firstWorkDay = overrides.firstWorkDay || submitted.firstWorkDay;
  const assignmentLength = overrides.assignmentLength ?? submitted.assignmentLength;
  const extensionDays = overrides.extensionDays ?? 0;
  return { firstWorkDay, assignmentLength, extensionDays };
}
