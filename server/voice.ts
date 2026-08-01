/**
 * Voice bridge: browser mic ⇄ Deepgram Voice Agent.
 *
 * Protocol (browser side):
 *   binary frames  → 16kHz linear16 PCM mic audio (forwarded to Deepgram)
 *   binary frames  ← 24kHz linear16 PCM TTS audio (forwarded from Deepgram)
 *   JSON frames    ← bridge + agent events:
 *     {type:"voice-ready"}                        agent configured, mic can start
 *     {type:"voice-unavailable", reason}          no key / upstream failure → fall back to text
 *     {type:"transcript", role, content}          conversation text (both roles)
 *     {type:"barge-in"}                           user started speaking → stop playback now
 *     {type:"fear-noted", fear}                   agent called note_fear()
 *     {type:"story-requested"}                    agent called start_storybook()
 *     {type:"agent-state", state}                 listening | thinking | speaking
 *
 * The agent is grounded with the same chart context + Moss retrievals as text
 * chat, and exposes two client-side functions so the conversation itself can
 * drive the product: note_fear (structured fear capture, filed into the story
 * prompt later) and start_storybook (voice-triggered generation).
 */
import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "node:http";
import { getPatientContext } from "./context.js";
import { agentSystemPrompt } from "./chat.js";
import { retrieve } from "./moss.js";

const DEEPGRAM_AGENT_URL = "wss://agent.deepgram.com/v1/agent/converse";
const KEEPALIVE_MS = 8000;

/**
 * Think-model fallback chain. Deepgram's managed LLM roster changes over time
 * (probed 2026-08: anthropic/claude-sonnet-4-5, open_ai/gpt-4o-mini are live),
 * so if the preferred model is rejected we retry with the next candidate
 * instead of failing the call. Override the first choice with
 * DEEPGRAM_THINK_PROVIDER / DEEPGRAM_THINK_MODEL.
 */
function thinkCandidates(): { type: string; model: string }[] {
  const candidates: { type: string; model: string }[] = [];
  if (process.env.DEEPGRAM_THINK_PROVIDER && process.env.DEEPGRAM_THINK_MODEL) {
    candidates.push({ type: process.env.DEEPGRAM_THINK_PROVIDER, model: process.env.DEEPGRAM_THINK_MODEL });
  }
  candidates.push({ type: "anthropic", model: "claude-sonnet-4-5" }, { type: "open_ai", model: "gpt-4o-mini" });
  return candidates;
}

interface AgentFunctionCall {
  id: string;
  name: string;
  arguments: string;
  client_side?: boolean;
}

export function attachVoiceBridge(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/voice" });

  wss.on("connection", async (browser) => {
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) {
      browser.send(JSON.stringify({ type: "voice-unavailable", reason: "DEEPGRAM_API_KEY not set — using text chat" }));
      return;
    }

    let ctx;
    let facts;
    try {
      ctx = await getPatientContext();
      facts = await retrieve(ctx?.procedure ?? "hospital visit preparation", 5);
    } catch (err) {
      browser.send(JSON.stringify({ type: "voice-unavailable", reason: `context load failed: ${String(err)}` }));
      return;
    }

    const candidates = thinkCandidates();
    const prompt =
      agentSystemPrompt(ctx, facts ?? []) +
      `\n\nTOOLS: When the child names something they're scared of, call note_fear with a short phrase in their words. ` +
      `When the child seems ready (or asks for their story), call start_storybook. Keep talking naturally around tool calls.`;
    const greeting = ctx
      ? `Hi ${ctx.firstName}! I heard you're visiting ${ctx.careTeam[0]?.name ?? "the doctor"} soon. What are you wondering about?`
      : "Hi there! I'm here to talk about your upcoming visit. What are you wondering about?";

    let deepgram: WebSocket | null = null;
    let keepalive: NodeJS.Timeout | null = null;
    let settled = false; // SettingsApplied received on the current attempt
    let finished = false; // bridge torn down, no more retries

    const toBrowser = (msg: object) => {
      if (browser.readyState === WebSocket.OPEN) browser.send(JSON.stringify(msg));
    };

    const teardown = () => {
      finished = true;
      if (keepalive) clearInterval(keepalive);
      keepalive = null;
      if (deepgram && (deepgram.readyState === WebSocket.OPEN || deepgram.readyState === WebSocket.CONNECTING)) {
        deepgram.close();
      }
      if (browser.readyState === WebSocket.OPEN) browser.close();
    };

    const fail = (reason: string) => {
      toBrowser({ type: "voice-unavailable", reason });
      teardown();
    };

    const connect = (candidateIndex: number) => {
      if (finished) return;
      const think = candidates[candidateIndex];
      settled = false;

      const dg = new WebSocket(DEEPGRAM_AGENT_URL, { headers: { Authorization: `Token ${key}` } });
      deepgram = dg;

      /** Rejected settings (usually think model) → try next candidate. */
      const retryOrFail = (reason: string) => {
        if (keepalive) clearInterval(keepalive);
        keepalive = null;
        if (dg.readyState === WebSocket.OPEN) dg.close();
        if (candidateIndex + 1 < candidates.length) {
          console.warn(`[voice] ${think.type}/${think.model} rejected (${reason}); trying next think model`);
          connect(candidateIndex + 1);
        } else {
          fail(reason);
        }
      };

      dg.on("open", () => {
        dg.send(
          JSON.stringify({
            type: "Settings",
            audio: {
              input: { encoding: "linear16", sample_rate: 16000 },
              output: { encoding: "linear16", sample_rate: 24000, container: "none" },
            },
            agent: {
              language: "en",
              listen: { provider: { type: "deepgram", model: "flux-general-en" } },
              think: {
                provider: { type: think.type, model: think.model },
                prompt,
                functions: [
                  {
                    name: "note_fear",
                    description:
                      "Record one specific fear the child expressed, phrased in the child's own words (e.g. 'the loud tunnel', 'needles').",
                    parameters: {
                      type: "object",
                      properties: { fear: { type: "string", description: "The fear, short phrase, child's words" } },
                      required: ["fear"],
                    },
                  },
                  {
                    name: "start_storybook",
                    description:
                      "Begin generating the child's personalized storybook. Call when the conversation has surfaced their fears, or when they ask for the story.",
                    parameters: { type: "object", properties: {} },
                  },
                ],
              },
              speak: { provider: { type: "deepgram", model: "aura-2-thalia-en" } },
              greeting,
            },
          }),
        );
        keepalive = setInterval(() => {
          if (dg.readyState === WebSocket.OPEN) dg.send(JSON.stringify({ type: "KeepAlive" }));
        }, KEEPALIVE_MS);
      });

      dg.on("message", (data, isBinary) => {
        if (browser.readyState !== WebSocket.OPEN) return;

        if (isBinary) {
          browser.send(data, { binary: true });
          return;
        }

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(data.toString());
        } catch {
          return;
        }

        switch (event.type) {
          case "Welcome":
            break;
          case "SettingsApplied":
            settled = true;
            console.log(`[voice] agent live (think: ${think.type}/${think.model})`);
            toBrowser({ type: "voice-ready" });
            break;
          case "ConversationText":
            toBrowser({
              type: "transcript",
              role: event.role === "user" ? "user" : "assistant",
              content: event.content,
            });
            break;
          case "UserStartedSpeaking":
            toBrowser({ type: "barge-in" });
            toBrowser({ type: "agent-state", state: "listening" });
            break;
          case "AgentThinking":
            toBrowser({ type: "agent-state", state: "thinking" });
            break;
          case "AgentStartedSpeaking":
            toBrowser({ type: "agent-state", state: "speaking" });
            break;
          case "AgentAudioDone":
            toBrowser({ type: "agent-state", state: "listening" });
            break;
          case "FunctionCallRequest": {
            const calls = (event.functions ?? []) as AgentFunctionCall[];
            for (const call of calls) {
              let content = "ok";
              try {
                if (call.name === "note_fear") {
                  const args = JSON.parse(call.arguments || "{}") as { fear?: string };
                  if (args.fear) toBrowser({ type: "fear-noted", fear: args.fear });
                  content = "Fear recorded. Acknowledge it warmly and keep the conversation going.";
                } else if (call.name === "start_storybook") {
                  toBrowser({ type: "story-requested" });
                  content =
                    "Storybook generation started — tell the child their very own story is being written right now and will appear on the screen in a moment.";
                } else {
                  content = `Unknown function ${call.name}`;
                }
              } catch (err) {
                content = `error: ${String(err)}`;
              }
              dg.send(JSON.stringify({ type: "FunctionCallResponse", id: call.id, name: call.name, content }));
            }
            break;
          }
          case "Warning":
            console.warn("[voice] Deepgram warning:", event.description ?? event);
            break;
          case "Error": {
            const description = String(event.description ?? "Deepgram agent error");
            if (!settled) {
              retryOrFail(description);
            } else {
              console.error("[voice] Deepgram error mid-session:", description);
              fail(description);
            }
            break;
          }
          default:
            break;
        }
      });

      dg.on("close", (code, reason) => {
        if (finished || dg !== deepgram) return;
        if (!settled) {
          retryOrFail(`Deepgram connection closed (${code}) ${reason.toString()}`.trim());
        } else {
          teardown();
        }
      });

      dg.on("error", (err) => {
        if (finished || dg !== deepgram) return;
        console.error("[voice] Deepgram socket error:", err);
        if (!settled) {
          retryOrFail(String(err));
        } else {
          fail(String(err));
        }
      });
    };

    // Browser → Deepgram: binary mic PCM; JSON control passes through untouched
    browser.on("message", (data, isBinary) => {
      if (deepgram && deepgram.readyState === WebSocket.OPEN && settled) {
        deepgram.send(data, { binary: isBinary });
      }
    });
    browser.on("close", teardown);

    connect(0);
  });
}
