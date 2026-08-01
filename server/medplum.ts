/**
 * FHIR access layer.
 *
 * With MEDPLUM_CLIENT_ID/SECRET set, this talks to a real Medplum project via
 * client-credentials auth. Without them, it falls back to a tiny in-memory
 * FHIR store persisted to data/mock-fhir.json so `npm run seed` + demos work
 * with zero credentials.
 */
import { MedplumClient } from "@medplum/core";
import type { Resource, ResourceType } from "@medplum/fhirtypes";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

export interface FhirStore {
  mode: "medplum" | "mock";
  createResource<T extends Resource>(resource: T): Promise<T>;
  search<T extends Resource>(resourceType: ResourceType, query?: Record<string, string>): Promise<T[]>;
}

const MOCK_PATH = path.join(process.cwd(), "data", "mock-fhir.json");

class MockFhirStore implements FhirStore {
  mode = "mock" as const;
  private resources: Resource[] = [];

  constructor() {
    if (existsSync(MOCK_PATH)) {
      try {
        this.resources = JSON.parse(readFileSync(MOCK_PATH, "utf8"));
      } catch {
        this.resources = [];
      }
    }
  }

  private persist() {
    mkdirSync(path.dirname(MOCK_PATH), { recursive: true });
    writeFileSync(MOCK_PATH, JSON.stringify(this.resources, null, 2));
  }

  async createResource<T extends Resource>(resource: T): Promise<T> {
    const created = { ...resource, id: resource.id ?? randomUUID() };
    // Upsert by id so re-seeding doesn't duplicate
    this.resources = this.resources.filter(
      (r) => !(r.resourceType === created.resourceType && r.id === created.id),
    );
    this.resources.push(created);
    this.persist();
    return created;
  }

  async search<T extends Resource>(resourceType: ResourceType): Promise<T[]> {
    return this.resources.filter((r) => r.resourceType === resourceType) as T[];
  }
}

class MedplumFhirStore implements FhirStore {
  mode = "medplum" as const;
  private client: MedplumClient;
  private loginPromise: Promise<unknown> | null = null;

  constructor(baseUrl: string, private clientId: string, private clientSecret: string) {
    this.client = new MedplumClient({ baseUrl });
  }

  private async ensureLogin() {
    if (!this.loginPromise) {
      this.loginPromise = this.client.startClientLogin(this.clientId, this.clientSecret);
    }
    await this.loginPromise;
  }

  async createResource<T extends Resource>(resource: T): Promise<T> {
    await this.ensureLogin();
    return this.client.createResource(resource);
  }

  async search<T extends Resource>(resourceType: ResourceType, query?: Record<string, string>): Promise<T[]> {
    await this.ensureLogin();
    const bundle = await this.client.search(resourceType, query);
    return (bundle.entry ?? []).map((e) => e.resource as T);
  }
}

let store: FhirStore | null = null;

export function getFhirStore(): FhirStore {
  if (!store) {
    const { MEDPLUM_CLIENT_ID, MEDPLUM_CLIENT_SECRET, MEDPLUM_BASE_URL } = process.env;
    store =
      MEDPLUM_CLIENT_ID && MEDPLUM_CLIENT_SECRET
        ? new MedplumFhirStore(MEDPLUM_BASE_URL || "https://api.medplum.com/", MEDPLUM_CLIENT_ID, MEDPLUM_CLIENT_SECRET)
        : new MockFhirStore();
  }
  return store;
}
