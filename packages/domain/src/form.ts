import {
  CAPABILITY_OPTIONS,
  CERTIFICATIONS,
  EXPERIENCE_OPTIONS,
  POSITIONS,
  VEHICLE_TYPES,
  type FormPayload
} from "./types.js";
import { isoDate } from "./normalize.js";

export const FORM_SECTIONS = [
  { id: 1, name: "Order & identity", range: "Q1–4", keys: ["resourceOrderRaw", "email", "firstName", "lastName"] },
  { id: 2, name: "Position & qualification", range: "Q5–10", keys: ["position", "trainee", "firstAssignment", "arduousQualified", "experience", "capabilities"] },
  { id: 3, name: "Assignment dates", range: "Q11–18", keys: ["phone", "dateAssigned", "isReassignment", "reassignmentFrom", "firstWorkDay", "assignmentLength", "travelTimeHome", "flightRequired"] },
  { id: 4, name: "Travel & vehicle", range: "Q17–21", keys: ["travelTimeHome", "flightRequired", "vehicleType", "fourByFour", "vehicleLicense"] },
  { id: 5, name: "Home agency", range: "Q22–30", keys: ["company", "homeStreet", "city", "state", "zip", "supervisorPhone", "emergencyContactName", "emergencyContactPhone", "eeraContract"] },
  { id: 6, name: "Certification", range: "Q31–34", keys: ["otherIcsQualifications", "medicalCertification", "medicalDirectorName", "medicalDirectorPhone"] }
] as const;

export const FIELD_LABELS: Record<keyof FormPayload, string> = {
  resourceOrderRaw: "Resource Order # - O or E #",
  email: "Email - YOUR EMAIL",
  firstName: "First Name",
  lastName: "Last Name",
  position: "Position",
  trainee: "Are you a trainee in this position?",
  firstAssignment: "Is this your first assignment in this position?",
  arduousQualified: "Are you currently Arduous qualified?",
  experience: "Experience/Proficiency - check all that apply",
  capabilities: "Capabilities and Preparedness - check all that apply",
  phone: "Phone #",
  dateAssigned: "Date assigned to incident",
  isReassignment: "Is this a reassignment?",
  reassignmentFrom: "From?",
  firstWorkDay: "First work day",
  assignmentLength: "Length of Assignment",
  travelTimeHome: "Travel time home",
  flightRequired: "Flight required?",
  vehicleType: "Type of vehicle",
  fourByFour: "4X4?",
  vehicleLicense: "Vehicle License #",
  company: "Company Name",
  homeStreet: "Home Agency Street Address",
  city: "City",
  state: "State",
  zip: "Zip",
  supervisorPhone: "Supervisor phone number",
  emergencyContactName: "Emergency contact name",
  emergencyContactPhone: "Emergency contact #",
  eeraContract: "EERA #, Contract #",
  otherIcsQualifications: "Other ICS Qualifications",
  medicalCertification: "Medical Certification",
  medicalDirectorName: "Medical Director NAME",
  medicalDirectorPhone: "Medical Director phone number"
};

export const PRESERVED_LABELS = ["Extrication Equiptment", "Nerv"] as const;

export type ValidationError = { field: keyof FormPayload; message: string };

export function validateFormPayload(raw: Partial<FormPayload>): { ok: true; value: FormPayload } | { ok: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const req = (field: keyof FormPayload, v: unknown) => {
    if (v == null || String(v).trim() === "") errors.push({ field, message: "Required" });
  };

  req("resourceOrderRaw", raw.resourceOrderRaw);
  req("email", raw.email);
  if (raw.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.email)) {
    errors.push({ field: "email", message: "Enter a valid email" });
  }
  req("firstName", raw.firstName);
  req("lastName", raw.lastName);
  if (!raw.position || !POSITIONS.includes(raw.position)) {
    errors.push({ field: "position", message: "Select a position" });
  }
  for (const f of ["trainee", "firstAssignment", "arduousQualified", "isReassignment", "flightRequired", "fourByFour"] as const) {
    if (raw[f] !== "Yes" && raw[f] !== "No") errors.push({ field: f, message: "Yes or No" });
  }
  if (raw.isReassignment === "Yes") req("reassignmentFrom", raw.reassignmentFrom);
  if (!isoDate(String(raw.dateAssigned ?? ""))) errors.push({ field: "dateAssigned", message: "Date required" });
  if (!isoDate(String(raw.firstWorkDay ?? ""))) errors.push({ field: "firstWorkDay", message: "Date required" });
  const length = Number(raw.assignmentLength);
  if (!Number.isInteger(length) || length < 1) {
    errors.push({ field: "assignmentLength", message: "Positive whole number" });
  }
  req("phone", raw.phone);
  req("company", raw.company);
  if (!raw.vehicleType || !VEHICLE_TYPES.includes(raw.vehicleType)) {
    errors.push({ field: "vehicleType", message: "Select vehicle type" });
  }
  if (!raw.medicalCertification || !CERTIFICATIONS.includes(raw.medicalCertification)) {
    errors.push({ field: "medicalCertification", message: "Select certification" });
  }

  const experience = Array.isArray(raw.experience) ? raw.experience.filter((x) => (EXPERIENCE_OPTIONS as readonly string[]).includes(x)) : [];
  const capabilities = Array.isArray(raw.capabilities)
    ? raw.capabilities.filter((x) => (CAPABILITY_OPTIONS as readonly string[]).includes(x))
    : [];

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      resourceOrderRaw: String(raw.resourceOrderRaw).trim(),
      email: String(raw.email).trim(),
      firstName: String(raw.firstName).trim(),
      lastName: String(raw.lastName).trim(),
      position: raw.position!,
      trainee: raw.trainee as "Yes" | "No",
      firstAssignment: raw.firstAssignment as "Yes" | "No",
      arduousQualified: raw.arduousQualified as "Yes" | "No",
      experience,
      capabilities,
      phone: String(raw.phone).trim(),
      dateAssigned: isoDate(String(raw.dateAssigned))!,
      isReassignment: raw.isReassignment as "Yes" | "No",
      reassignmentFrom: raw.isReassignment === "Yes" ? String(raw.reassignmentFrom ?? "").trim() : "",
      firstWorkDay: isoDate(String(raw.firstWorkDay))!,
      assignmentLength: length,
      travelTimeHome: String(raw.travelTimeHome ?? "").trim(),
      flightRequired: raw.flightRequired as "Yes" | "No",
      vehicleType: raw.vehicleType!,
      fourByFour: raw.fourByFour as "Yes" | "No",
      vehicleLicense: String(raw.vehicleLicense ?? "").trim(),
      company: String(raw.company).trim(),
      homeStreet: String(raw.homeStreet ?? "").trim(),
      city: String(raw.city ?? "").trim(),
      state: String(raw.state ?? "").trim(),
      zip: String(raw.zip ?? "").trim(),
      supervisorPhone: String(raw.supervisorPhone ?? "").trim(),
      emergencyContactName: String(raw.emergencyContactName ?? "").trim(),
      emergencyContactPhone: String(raw.emergencyContactPhone ?? "").trim(),
      eeraContract: String(raw.eeraContract ?? "").trim(),
      otherIcsQualifications: String(raw.otherIcsQualifications ?? "").trim(),
      medicalCertification: raw.medicalCertification!,
      medicalDirectorName: String(raw.medicalDirectorName ?? "").trim(),
      medicalDirectorPhone: String(raw.medicalDirectorPhone ?? "").trim()
    }
  };
}

export function emptyForm(): Partial<FormPayload> {
  return {
    experience: [],
    capabilities: [],
    trainee: "No",
    firstAssignment: "No",
    arduousQualified: "No",
    isReassignment: "No",
    flightRequired: "No",
    fourByFour: "No",
    assignmentLength: 14
  };
}
