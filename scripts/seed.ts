/**
 * Seed a demo patient with a scheduled procedure:
 * Maya Rivera, age 6 — abdominal MRI next Tuesday with Dr. Chen.
 * Writes to Medplum when credentials are set, otherwise to the local mock store.
 */
import "dotenv/config";
import type {
  Appointment,
  CareTeam,
  Condition,
  Patient,
  Practitioner,
  ServiceRequest,
} from "@medplum/fhirtypes";
import { getFhirStore } from "../server/medplum.js";

function nextTuesday(): Date {
  const d = new Date();
  d.setDate(d.getDate() + ((9 - d.getDay()) % 7 || 7));
  d.setHours(10, 0, 0, 0);
  return d;
}

async function main() {
  const store = getFhirStore();
  console.log(`Seeding demo patient (${store.mode} mode)...`);

  const birthDate = new Date();
  birthDate.setFullYear(birthDate.getFullYear() - 6);

  const patient = await store.createResource<Patient>({
    resourceType: "Patient",
    id: "demo-maya",
    name: [{ given: ["Maya"], family: "Rivera" }],
    birthDate: birthDate.toISOString().slice(0, 10),
    gender: "female",
  });

  const drChen = await store.createResource<Practitioner>({
    resourceType: "Practitioner",
    id: "demo-dr-chen",
    name: [{ prefix: ["Dr."], given: ["Alice"], family: "Chen" }],
  });

  const nurseSam = await store.createResource<Practitioner>({
    resourceType: "Practitioner",
    id: "demo-nurse-sam",
    name: [{ given: ["Sam"], family: "Okafor" }],
  });

  await store.createResource<CareTeam>({
    resourceType: "CareTeam",
    id: "demo-careteam",
    subject: { reference: `Patient/${patient.id}` },
    participant: [
      { member: { reference: `Practitioner/${drChen.id}`, display: "Dr. Alice Chen" }, role: [{ text: "Pediatric Radiologist" }] },
      { member: { reference: `Practitioner/${nurseSam.id}`, display: "Sam Okafor" }, role: [{ text: "MRI Technologist" }] },
    ],
  });

  await store.createResource<Condition>({
    resourceType: "Condition",
    id: "demo-condition",
    subject: { reference: `Patient/${patient.id}` },
    code: {
      text: "Recurrent abdominal pain",
      coding: [{ system: "http://snomed.info/sct", code: "102614006", display: "Recurrent abdominal pain" }],
    },
    clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
  });

  const when = nextTuesday();

  await store.createResource<ServiceRequest>({
    resourceType: "ServiceRequest",
    id: "demo-servicerequest",
    status: "active",
    intent: "order",
    subject: { reference: `Patient/${patient.id}` },
    requester: { reference: `Practitioner/${drChen.id}` },
    occurrenceDateTime: when.toISOString(),
    code: {
      text: "MRI of abdomen without contrast",
      coding: [{ system: "http://www.ama-assn.org/go/cpt", code: "74181", display: "MRI abdomen w/o contrast" }],
    },
  });

  await store.createResource<Appointment>({
    resourceType: "Appointment",
    id: "demo-appointment",
    status: "booked",
    start: when.toISOString(),
    end: new Date(when.getTime() + 45 * 60 * 1000).toISOString(),
    serviceType: [{ text: "Pediatric MRI" }],
    participant: [
      { actor: { reference: `Patient/${patient.id}`, display: "Maya Rivera" }, status: "accepted" },
      { actor: { reference: `Practitioner/${drChen.id}`, display: "Dr. Alice Chen" }, status: "accepted" },
    ],
  });

  console.log(`✅ Seeded: Maya Rivera (6), abdominal MRI on ${when.toDateString()} with Dr. Chen.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
