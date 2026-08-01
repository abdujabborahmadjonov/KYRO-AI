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

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StoryPage {
  page_number: number;
  text: string;
  illustration_prompt: string;
  illustration_emoji: string;
}

export interface Story {
  title: string;
  dedication: string;
  pages: StoryPage[];
  fears_addressed: string[];
  clinical_facts_used: string[];
}

export interface StoryResult {
  story: Story;
  documentReferenceId?: string;
  communicationId?: string;
  generated: "claude" | "demo-fallback";
}

export interface CoverageSummary {
  planName: string;
  covered: boolean;
  copay: string;
  deductibleRemaining: string;
  plainLanguage: string;
  source: "stedi-test" | "mock";
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  context: () => fetch("/api/context").then((r) => json<PatientContext>(r)),
  chat: (messages: ChatMessage[]) =>
    fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages }),
    }).then((r) => json<{ reply: string; sources: string[] }>(r)),
  story: (conversation: ChatMessage[], fears: string[] = []) =>
    fetch("/api/story", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversation, fears }),
    }).then((r) => json<StoryResult>(r)),
  coverage: () => fetch("/api/coverage").then((r) => json<CoverageSummary>(r)),
};
