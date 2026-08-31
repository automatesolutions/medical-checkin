export const POSITIONS = [
  "Ambo",
  "EMPF",
  "EMTF",
  "REMS",
  "Medical Support Trailer",
  "MEDL/MEDLt",
  "IMS"
] as const;
export type Position = (typeof POSITIONS)[number];

export const VEHICLE_TYPES = ["Agency", "Rental", "POV", "Nerv"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const CERTIFICATIONS = ["EMT-B", "EMT-I", "EMT-P", "RN", "Other"] as const;
export type Certification = (typeof CERTIFICATIONS)[number];

export const EXPERIENCE_OPTIONS = [
  "Line Medic/EMT",
  "medical support of an aircraft (on or off fireline)",
  "SAR",
  "Camp medical experience",
  "Spike Camp medical experience",
  "Short Haul",
  "Portable Radio experience",
  "Avenza/Field maps/Maps"
] as const;

export const CAPABILITY_OPTIONS = [
  "ALS",
  "BLS",
  "Spike",
  "Hiking in tough terrain",
  "Extrication Equiptment",
  "Reach and Treat",
  "Technical Rescue",
  "Narcotics"
] as const;

export const YES_NO = ["Yes", "No"] as const;

export const OPERATIONAL_STATUSES = [
  "Checked In - Needs Assignment",
  "Needs Resource Review",
  "Enroute",
  "Active",
  "DMB/Travel",
  "Released",
  "Cancelled"
] as const;
export type OperationalStatus = (typeof OPERATIONAL_STATUSES)[number];

export const DOCUMENT_TYPES = [
  "Contract",
  "Driver's License",
  "NREMT",
  "Med Director letter"
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = [
  "Not Required",
  "Requested",
  "Received",
  "Verified",
  "Rejected",
  "Expired"
] as const;
export type DocumentStatusValue = (typeof DOCUMENT_STATUSES)[number];

export const GLIDE_STATES = [
  "Green",
  "Yellow",
  "Red",
  "LWD",
  "DMB/TVL",
  "Gray",
  "REVIEW"
] as const;
export type GlideState = (typeof GLIDE_STATES)[number];

export const RESOURCE_TYPES = POSITIONS;
export type ResourceType = Position;

export const RESTRICTED_FIELD_KEYS = [
  "homeStreet",
  "city",
  "state",
  "zip",
  "vehicleLicense",
  "supervisorPhone",
  "emergencyContactName",
  "emergencyContactPhone",
  "eeraContract",
  "medicalDirectorName",
  "medicalDirectorPhone"
] as const;

export type FormPayload = {
  resourceOrderRaw: string;
  email: string;
  firstName: string;
  lastName: string;
  position: Position;
  trainee: "Yes" | "No";
  firstAssignment: "Yes" | "No";
  arduousQualified: "Yes" | "No";
  experience: string[];
  capabilities: string[];
  phone: string;
  dateAssigned: string;
  isReassignment: "Yes" | "No";
  reassignmentFrom: string;
  firstWorkDay: string;
  assignmentLength: number;
  travelTimeHome: string;
  flightRequired: "Yes" | "No";
  vehicleType: VehicleType;
  fourByFour: "Yes" | "No";
  vehicleLicense: string;
  company: string;
  homeStreet: string;
  city: string;
  state: string;
  zip: string;
  supervisorPhone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  eeraContract: string;
  otherIcsQualifications: string;
  medicalCertification: Certification;
  medicalDirectorName: string;
  medicalDirectorPhone: string;
};

export type PersonOverrides = {
  division?: string | null;
  camp?: string | null;
  callSign?: string | null;
  firstWorkDay?: string | null;
  assignmentLength?: number | null;
  extensionDays?: number | null;
  operationalStatus?: OperationalStatus | null;
  notes?: string | null;
};

export type ResourceCandidate = {
  id: string;
  callSign: string;
  company: string;
  resourceOrderRaw: string;
  resourceOrderNormalized: string;
  type: ResourceType;
  dateAssigned: string;
  isProvisional: boolean;
  personnelCount: number;
};

export type MatchDecision =
  | { kind: "link"; resourceId: string }
  | { kind: "provisional" }
  | { kind: "review"; reason: string; candidates: ResourceCandidate[] };
