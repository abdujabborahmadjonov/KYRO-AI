/**
 * Story generation + filing back to the chart.
 *
 * Generation priority: OpenAI (GPT-4o story + gpt-image-1 illustrations) →
 * Anthropic Claude (story, SVG illustrations) → canned demo story. The result
 * is written to Medplum as a DocumentReference + Communication linked to the
 * planned Encounter.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Communication, DocumentReference, Encounter } from "@medplum/fhirtypes";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { PatientContext } from "./context.js";
import { getFhirStore } from "./medplum.js";
import { retrieve } from "./moss.js";
import { hasOpenAI, openaiStructured, openaiImage } from "./openai.js";

export interface StoryPage {
  page_number: number;
  text: string;
  illustration_prompt: string;
  illustration_emoji: string;
  /** Set when a real illustration was generated; UI falls back to SVG otherwise. */
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

const STORY_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    dedication: { type: "string" },
    pages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          page_number: { type: "integer" },
          text: { type: "string" },
          illustration_prompt: { type: "string" },
          illustration_emoji: { type: "string" },
        },
        required: ["page_number", "text", "illustration_prompt", "illustration_emoji"],
        additionalProperties: false,
      },
    },
    fears_addressed: { type: "array", items: { type: "string" } },
    clinical_facts_used: { type: "array", items: { type: "string" } },
  },
  required: ["title", "dedication", "pages", "fears_addressed", "clinical_facts_used"],
  additionalProperties: false,
} as const;

let anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

/** A story is usable if it has a title and at least one well-formed page. */
function isUsableStory(story: unknown): story is Story {
  const s = story as Story;
  return (
    Boolean(s) &&
    typeof s.title === "string" &&
    Array.isArray(s.pages) &&
    s.pages.length > 0 &&
    s.pages.every((p) => typeof p.text === "string" && typeof p.illustration_emoji === "string")
  );
}

const SYSTEM_PROMPT =
  `You write personalized, clinically-grounded illustrated storybooks that prepare children for medical procedures. ` +
  `The child is the hero of their own real, upcoming procedure. Address their specific fears head-on with honesty and warmth. ` +
  `Every clinical claim must be consistent with the provided patient-education facts — what comforts the child must also be true. ` +
  `Write at the reading level of a child of the given age. 8-10 short pages. Their real care team appears as characters by name. ` +
  `Never promise "it won't hurt" if it might — reframe honestly (e.g. "a quick pinch, then it's done"). ` +
  `illustration_prompt fields should describe a single warm scene, mentioning the child hero and consistent character details.`;

function buildUserPrompt(
  ctx: PatientContext,
  transcript: string,
  fears: string[],
  facts: string,
): string {
  const careTeamList = ctx.careTeam.map((m) => `${m.name} (${m.role})`).join(", ") || "the care team";
  return (
    `PATIENT CHART (FHIR):\n` +
    `- Name: ${ctx.name} (call them ${ctx.firstName})\n` +
    `- Age: ${ctx.ageYears ?? "unknown"}\n` +
    `- Procedure: ${ctx.procedure}${ctx.procedureDate ? ` on ${ctx.procedureDate}` : ""}\n` +
    `- Condition: ${ctx.condition ?? "n/a"}\n` +
    `- Care team: ${careTeamList}\n\n` +
    `FEARS CAPTURED DURING THE CONVERSATION (address each one in the story):\n${fears.length ? fears.map((f) => `- ${f}`).join("\n") : "(none captured explicitly — infer from the transcript)"}\n\n` +
    `CONVERSATION WITH THE CHILD (their fears, in their own words):\n${transcript || "(no conversation yet — write a generally reassuring story for this procedure)"}\n\n` +
    `CLINICALLY ACCURATE PATIENT-EDUCATION FACTS (ground every claim in these):\n${facts}\n\n` +
    `Write the storybook now.`
  );
}

const ILLUSTRATIONS_DIR = path.join(process.cwd(), "data", "illustrations");
const MAX_ILLUSTRATED_PAGES = 8;
const IMAGE_CONCURRENCY = 3;

/** Generate real illustrations for the first pages; best-effort per page. */
async function illustrate(story: Story, ctx: PatientContext): Promise<void> {
  const bookId = randomUUID().slice(0, 8);
  const dir = path.join(ILLUSTRATIONS_DIR, bookId);
  mkdirSync(dir, { recursive: true });

  const style =
    `Children's storybook illustration, warm watercolor style, soft pastel colors, gentle and reassuring mood, no text or letters. ` +
    `The hero is a ${ctx.ageYears ?? 6}-year-old child named ${ctx.firstName}.`;

  const pages = story.pages.slice(0, MAX_ILLUSTRATED_PAGES);
  const queue = [...pages.entries()];

  const worker = async () => {
    while (queue.length) {
      const [i, page] = queue.shift()!;
      const png = await openaiImage(`${style} Scene: ${page.illustration_prompt}`);
      if (png) {
        const file = `page-${page.page_number}.png`;
        writeFileSync(path.join(dir, file), png);
        story.pages[i].illustration_url = `/illustrations/${bookId}/${file}`;
      }
    }
  };
  await Promise.all(Array.from({ length: IMAGE_CONCURRENCY }, worker));
}

export async function generateStory(
  ctx: PatientContext,
  conversation: { role: string; content: string }[],
  fears: string[] = [],
): Promise<StoryResult> {
  const transcript = conversation.map((m) => `${m.role === "user" ? "Child/Parent" : "Agent"}: ${m.content}`).join("\n");

  // Ground the story in real ped-ed content about this procedure + expressed fears
  const grounding = await retrieve(`${ctx.procedure} ${fears.join(" ")} ${transcript.slice(-500)}`, 5);
  const facts = grounding.map((g) => `[${g.source}] ${g.text}`).join("\n\n");
  const userPrompt = buildUserPrompt(ctx, transcript, fears, facts);

  let story: Story | null = null;
  let generated: StoryResult["generated"] = "demo-fallback";

  // 1. OpenAI: GPT-4o story + gpt-image-1 illustrations
  if (hasOpenAI()) {
    try {
      const parsed = await openaiStructured<Story>(SYSTEM_PROMPT, userPrompt, STORY_SCHEMA, "storybook");
      if (isUsableStory(parsed)) {
        parsed.pages = parsed.pages.sort((a, b) => a.page_number - b.page_number).slice(0, 12);
        story = parsed;
        generated = "openai";
      } else {
        console.warn("[story] OpenAI output failed validation");
      }
    } catch (err) {
      console.error("[story] OpenAI generation failed:", String(err).slice(0, 300));
    }
  }

  // 2. Anthropic Claude
  const claude = getAnthropic();
  if (!story && claude) {
    try {
      const stream = claude.messages.stream({
        model: "claude-opus-5",
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        output_config: { format: { type: "json_schema", schema: STORY_SCHEMA } },
        messages: [{ role: "user", content: userPrompt }],
      });
      const message = await stream.finalMessage();
      if (message.stop_reason !== "refusal") {
        const text = message.content.find((b) => b.type === "text")?.text ?? "{}";
        const parsed = JSON.parse(text);
        if (isUsableStory(parsed)) {
          parsed.pages = parsed.pages.sort((a: StoryPage, b: StoryPage) => a.page_number - b.page_number).slice(0, 12);
          story = parsed;
          generated = "claude";
        }
      }
    } catch (err) {
      console.error("[story] Claude generation failed:", String(err).slice(0, 300));
    }
  }

  // 3. Canned demo story
  if (!story) {
    story = demoStory(ctx);
    generated = "demo-fallback";
  }

  // Real illustrations whenever OpenAI images are available (best-effort)
  if (hasOpenAI()) {
    try {
      await illustrate(story, ctx);
    } catch (err) {
      console.warn("[story] illustration pass failed:", String(err).slice(0, 200));
    }
  }

  // File it back — this is the part no storybook app does.
  const { documentReferenceId, communicationId } = await fileToChart(ctx, story, transcript);
  return { story, documentReferenceId, communicationId, generated };
}

async function fileToChart(ctx: PatientContext, story: Story, transcript: string) {
  const store = getFhirStore();
  const subject = ctx.patientId ? { reference: `Patient/${ctx.patientId}` } : undefined;

  // Link to the planned visit when one exists — "linked to the Encounter" is
  // the part that makes this chart-native rather than an app silo.
  const encounters = await store.search<Encounter>("Encounter");
  const encounterRef = encounters[0]?.id ? { reference: `Encounter/${encounters[0].id}` } : undefined;

  const docRef = await store.createResource<DocumentReference>({
    resourceType: "DocumentReference",
    status: "current",
    type: { text: "Pre-procedure preparation storybook" },
    subject,
    date: new Date().toISOString(),
    description: `Personalized preparation storybook: "${story.title}"`,
    context: encounterRef ? { encounter: [encounterRef] } : undefined,
    content: [
      {
        attachment: {
          contentType: "application/json",
          data: Buffer.from(JSON.stringify(story)).toString("base64"),
          title: story.title,
        },
      },
    ],
  });

  const communication = await store.createResource<Communication>({
    resourceType: "Communication",
    status: "completed",
    subject,
    encounter: encounterRef,
    sent: new Date().toISOString(),
    topic: { text: "Pre-procedure preparation — what the child was told" },
    payload: [
      {
        contentString:
          `Kyro prepared ${ctx.firstName} for: ${ctx.procedure}.\n` +
          `Fears addressed: ${story.fears_addressed.join("; ") || "none surfaced"}.\n` +
          `Clinical facts conveyed: ${story.clinical_facts_used.join("; ")}.\n` +
          (transcript ? `Conversation excerpt:\n${transcript.slice(0, 1500)}` : ""),
      },
    ],
  });

  return { documentReferenceId: docRef.id, communicationId: communication.id };
}

/** Canned demo story so the flow works with zero API keys. */
function demoStory(ctx: PatientContext): Story {
  const n = ctx.firstName;
  const dr = ctx.careTeam[0]?.name ?? "Dr. Chen";
  return {
    title: `${n} and the Space Tunnel`,
    dedication: `For ${n}, the bravest explorer we know.`,
    fears_addressed: ["the loud machine", "being away from mom"],
    clinical_facts_used: [
      "MRI machines are loud but never touch you",
      "Parents can usually stay nearby during an MRI",
      "Holding still helps the pictures come out clear",
    ],
    pages: [
      { page_number: 1, text: `${n} had a special mission: a trip to see ${dr} for pictures of their tummy — from the inside!`, illustration_prompt: "child with a mission badge outside a friendly hospital", illustration_emoji: "🏥" },
      { page_number: 2, text: `The picture machine is called an MRI. It looks like a big donut... or maybe a space tunnel.`, illustration_prompt: "a friendly MRI scanner drawn like a space tunnel", illustration_emoji: "🚀" },
      { page_number: 3, text: `"Will it be loud?" asked ${n}. "Yes!" said ${dr}. "It thumps and buzzes like rocket engines. That's the sound of it taking pictures."`, illustration_prompt: "doctor explaining with rocket sounds around", illustration_emoji: "🔊" },
      { page_number: 4, text: `${n} got special headphones, like real astronauts wear. The rumbling became a spaceship soundtrack.`, illustration_prompt: "child wearing big headphones smiling", illustration_emoji: "🎧" },
      { page_number: 5, text: `The tunnel never touches you. It just hums and takes pictures while you rest, still as a statue.`, illustration_prompt: "child lying still inside the tunnel with stars", illustration_emoji: "✨" },
      { page_number: 6, text: `And guess who stayed close the whole time? Mom — right there, the whole mission through.`, illustration_prompt: "parent waving from beside the scanner", illustration_emoji: "💛" },
      { page_number: 7, text: `${n} held so still that the pictures came out perfectly. "Textbook flying," said ${dr}.`, illustration_prompt: "doctor giving a thumbs up at picture screens", illustration_emoji: "🖼️" },
      { page_number: 8, text: `Mission complete! ${n} the space explorer — officially the bravest kid in the whole hospital.`, illustration_prompt: "child with a bravery medal and confetti", illustration_emoji: "🏅" },
    ],
  };
}
