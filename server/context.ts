/**
 * Pulls the child's chart (Patient, Appointment, ServiceRequest, Condition,
 * CareTeam/Practitioner) and flattens it into the context the voice agent and
 * story generator work from.
 */
import type {
  Appointment,
  CareTeam,
  Condition,
  Patient,
  Practitioner,
  ServiceRequest,
} from "@medplum/fhirtypes";
import { getFhirStore } from "./medplum.js";

export interface PatientContext {
  patientId?: string;
  name: string;
  firstName: string;
  ageYears: number | null;
  procedure: string;
  procedureDate: string | null;
  condition: string | null;
  careTeam: { name: string; role: string }[];
  fhirMode: "medplum" | "mock";
}

function humanName(p?: { name?: { given?: string[]; family?: string }[] }): string {
  const n = p?.name?.[0];
  if (!n) return "Unknown";
  return [n.given?.join(" "), n.family].filter(Boolean).join(" ");
}

export async function getPatientContext(): Promise<PatientContext | null> {
  const store = getFhirStore();
  const patients = await store.search<Patient>("Patient");
  const patient = patients[0];
  if (!patient) return null;

  const [appointments, serviceRequests, conditions, careTeams, practitioners] = await Promise.all([
    store.search<Appointment>("Appointment"),
    store.search<ServiceRequest>("ServiceRequest"),
    store.search<Condition>("Condition"),
    store.search<CareTeam>("CareTeam"),
    store.search<Practitioner>("Practitioner"),
  ]);

  const appointment = appointments[0];
  const sr = serviceRequests[0];
  const condition = conditions[0];
  const careTeam = careTeams[0];

  const ageYears = patient.birthDate
    ? Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  const practitionerById = new Map(practitioners.map((p) => [`Practitioner/${p.id}`, p]));
  const team = (careTeam?.participant ?? []).map((part) => {
    const ref = part.member?.reference ?? "";
    const pract = practitionerById.get(ref);
    return {
      name: pract ? humanName(pract) : part.member?.display ?? "Care team member",
      role: part.role?.[0]?.text ?? part.role?.[0]?.coding?.[0]?.display ?? "Clinician",
    };
  });

  return {
    patientId: patient.id,
    name: humanName(patient),
    firstName: patient.name?.[0]?.given?.[0] ?? "friend",
    ageYears,
    procedure:
      sr?.code?.text ??
      sr?.code?.coding?.[0]?.display ??
      appointment?.serviceType?.[0]?.text ??
      "an upcoming procedure",
    procedureDate: appointment?.start ?? sr?.occurrenceDateTime ?? null,
    condition: condition?.code?.text ?? condition?.code?.coding?.[0]?.display ?? null,
    careTeam: team,
    fhirMode: store.mode,
  };
}
