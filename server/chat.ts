/**
 * Text-mode conversation with the child/parent (also used as the "think" layer
 * reference for the voice agent). Claude, grounded by Moss retrieval + FHIR.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { PatientContext } from "./context.js";
import { retrieve, type RetrievedChunk } from "./moss.js";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function agentSystemPrompt(ctx: PatientContext | null, facts: RetrievedChunk[]): string {
  const chart = ctx
    ? `THE CHILD'S CHART:\n- Name: ${ctx.firstName}, age ${ctx.ageYears ?? "?"}\n- Upcoming: ${ctx.procedure}${ctx.procedureDate ? ` on ${new Date(ctx.procedureDate).toDateString()}` : ""}\n- Care team: ${ctx.careTeam.map((m) => `${m.name} (${m.role})`).join(", ") || "care team"}\n`
    : "No chart loaded yet.";
  const grounding = facts.length
    ? `CLINICALLY ACCURATE FACTS (answer only from these when discussing the procedure):\n${facts.map((f) => `- ${f.text}`).join("\n")}`
    : "";
  return (
    `You are BraveTales, a gentle voice companion talking with a young child (and their parent) before a scheduled medical procedure. ` +
    `Your goals: (1) learn what the child is scared of, in their own words; (2) answer questions honestly and simply at their age level; ` +
    `(3) keep replies to 1-3 short sentences — this is a conversation, not a lecture. ` +
    `Never promise something won't hurt if it might. Be warm, curious, and never condescending.\n\n${chart}\n${grounding}`
  );
}

let anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

export async function chat(
  ctx: PatientContext | null,
  messages: ChatMessage[],
): Promise<{ reply: string; sources: string[] }> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const facts = await retrieve(`${ctx?.procedure ?? ""} ${lastUser}`, 3);
  const client = getAnthropic();

  if (!client) {
    return {
      reply: demoReply(ctx, lastUser),
      sources: facts.map((f) => f.source),
    };
  }

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 2048,
    system: agentSystemPrompt(ctx, facts),
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  const reply = response.content.find((b) => b.type === "text")?.text ?? "";
  return { reply, sources: [...new Set(facts.map((f) => f.source))] };
}

/** Keyword-routed canned replies so the demo conversation works keyless. */
function demoReply(ctx: PatientContext | null, lastUser: string): string {
  const name = ctx?.firstName ?? "friend";
  const q = lastUser.toLowerCase();
  if (!lastUser) {
    return `Hi ${name}! I heard you're visiting ${ctx?.careTeam[0]?.name ?? "the doctor"} soon for ${ctx?.procedure ?? "a special visit"}. What are you wondering about?`;
  }
  if (q.includes("loud") || q.includes("noise") || q.includes("sound")) {
    return `Great question! The machine IS loud — it thumps and buzzes like rocket engines. That's just the sound of it taking pictures. You'll get special headphones so it's not too much.`;
  }
  if (q.includes("hurt") || q.includes("pain") || q.includes("needle")) {
    return `The picture machine never touches you at all. If you need a tiny poke first, it's a quick pinch — like a snap — and then it's done.`;
  }
  if (q.includes("mom") || q.includes("dad") || q.includes("alone") || q.includes("scared")) {
    return `You won't be alone, ${name}. A grown-up you love can stay right nearby the whole time, and the team can hear you and talk to you through a speaker.`;
  }
  return `That's a really good thing to wonder about, ${name}. Tell me more — what part feels the most mysterious to you?`;
}
