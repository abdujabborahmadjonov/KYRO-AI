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
  illustration_url?: string;
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
  generated: "openai" | "claude" | "demo-fallback";
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

export interface StorySummary {
  id: string;
  date: string | null;
  title: string;
  dedication: string;
  pageCount: number;
  cover: string | null;
  coverEmoji: string;
  fears: string[];
  story: Story;
}

export const api = {
  stories: () => fetch("/api/stories").then((r) => json<StorySummary[]>(r)),
  storyById: (id: string) =>
    fetch(`/api/story/${id}`).then((r) => json<{ story: Story; documentReferenceId: string }>(r)),
  context: () => fetch("/api/context").then((r) => json<PatientContext>(r)),
  chat: (messages: ChatMessage[]) =>
    fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages }),
    }).then((r) => json<{ reply: string; sources: string[]; fears: string[] }>(r)),
  narrate: async (text: string): Promise<Blob> => {
    const r = await fetch("/api/narrate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `HTTP ${r.status}`);
    }
    return r.blob();
  },
  story: (conversation: ChatMessage[], fears: string[] = []) =>
    fetch("/api/story", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversation, fears }),
    }).then((r) => json<StoryResult>(r)),
  coverage: () => fetch("/api/coverage").then((r) => json<CoverageSummary>(r)),
};
