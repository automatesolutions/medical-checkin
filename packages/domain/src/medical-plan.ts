/** ICS 206 / 206 WF–style Medical Plan payload (MVP structured fields). */

export type AmbulanceService = {
  name: string;
  address: string;
  phone: string;
  frequency: string;
  als: boolean;
};

export type AirAmbulance = {
  name: string;
  phone: string;
  aircraftType: string;
  capability: string;
};

export type Hospital = {
  name: string;
  address: string;
  helipadLat: string;
  helipadLon: string;
  travelAir: string;
  travelGround: string;
  traumaLevel: string;
  burnCenter: boolean;
  helipad: boolean;
};

export type MedicalPlanPayload = {
  opPeriod: string;
  preparedBy: string;
  reviewedBy: string;
  ambulances: AmbulanceService[];
  airAmbulances: AirAmbulance[];
  hospitals: Hospital[];
  /** Area / medical aid station capability narrative */
  aidStations: string;
  equipment: string;
  emergencyProcedures: string;
  specialNotes: string;
};

export function emptyAmbulance(): AmbulanceService {
  return { name: "", address: "", phone: "", frequency: "", als: false };
}

export function emptyAirAmbulance(): AirAmbulance {
  return { name: "", phone: "", aircraftType: "", capability: "" };
}

export function emptyHospital(): Hospital {
  return {
    name: "",
    address: "",
    helipadLat: "",
    helipadLon: "",
    travelAir: "",
    travelGround: "",
    traumaLevel: "",
    burnCenter: false,
    helipad: false
  };
}

export function emptyMedicalPlan(opPeriod = ""): MedicalPlanPayload {
  return {
    opPeriod,
    preparedBy: "",
    reviewedBy: "",
    ambulances: [emptyAmbulance()],
    airAmbulances: [emptyAirAmbulance()],
    hospitals: [emptyHospital()],
    aidStations: "",
    equipment: "",
    emergencyProcedures: "",
    specialNotes: ""
  };
}

export function normalizeMedicalPlan(raw: Partial<MedicalPlanPayload> | null | undefined, fallbackOp = ""): MedicalPlanPayload {
  const base = emptyMedicalPlan(fallbackOp);
  if (!raw || typeof raw !== "object") return base;
  return {
    opPeriod: typeof raw.opPeriod === "string" ? raw.opPeriod : base.opPeriod,
    preparedBy: typeof raw.preparedBy === "string" ? raw.preparedBy : "",
    reviewedBy: typeof raw.reviewedBy === "string" ? raw.reviewedBy : "",
    ambulances: Array.isArray(raw.ambulances) && raw.ambulances.length
      ? raw.ambulances.map((a) => ({
          name: String(a?.name ?? ""),
          address: String(a?.address ?? ""),
          phone: String(a?.phone ?? ""),
          frequency: String(a?.frequency ?? ""),
          als: Boolean(a?.als)
        }))
      : base.ambulances,
    airAmbulances: Array.isArray(raw.airAmbulances) && raw.airAmbulances.length
      ? raw.airAmbulances.map((a) => ({
          name: String(a?.name ?? ""),
          phone: String(a?.phone ?? ""),
          aircraftType: String(a?.aircraftType ?? ""),
          capability: String(a?.capability ?? "")
        }))
      : base.airAmbulances,
    hospitals: Array.isArray(raw.hospitals) && raw.hospitals.length
      ? raw.hospitals.map((h) => ({
          name: String(h?.name ?? ""),
          address: String(h?.address ?? ""),
          helipadLat: String(h?.helipadLat ?? ""),
          helipadLon: String(h?.helipadLon ?? ""),
          travelAir: String(h?.travelAir ?? ""),
          travelGround: String(h?.travelGround ?? ""),
          traumaLevel: String(h?.traumaLevel ?? ""),
          burnCenter: Boolean(h?.burnCenter),
          helipad: Boolean(h?.helipad)
        }))
      : base.hospitals,
    aidStations: typeof raw.aidStations === "string" ? raw.aidStations : "",
    equipment: typeof raw.equipment === "string" ? raw.equipment : "",
    emergencyProcedures: typeof raw.emergencyProcedures === "string" ? raw.emergencyProcedures : "",
    specialNotes: typeof raw.specialNotes === "string" ? raw.specialNotes : ""
  };
}
