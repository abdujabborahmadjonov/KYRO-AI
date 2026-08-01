/**
 * Voice bridge: browser mic ⇄ Deepgram Voice Agent (Flux/Nova-3 STT + Aura TTS,
 * Claude as the "think" layer), grounded with the same system prompt + chart
 * context as text chat.
 *
 * Browser connects to ws://.../ws/voice and sends 16kHz linear16 PCM frames;
 * we forward to Deepgram's agent socket and relay TTS audio + transcript
 * events back. Without DEEPGRAM_API_KEY the socket replies with a
 * `voice-unavailable` message and the UI falls back to text chat.
 */
import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "node:http";
import { getPatientContext } from "./context.js";
import { agentSystemPrompt } from "./chat.js";
import { retrieve } from "./moss.js";

const DEEPGRAM_AGENT_URL = "wss://agent.deepgram.com/v1/agent/converse";

export function attachVoiceBridge(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/voice" });

  wss.on("connection", async (browser) => {
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) {
      browser.send(JSON.stringify({ type: "voice-unavailable", reason: "DEEPGRAM_API_KEY not set — using text chat" }));
      return;
    }

    const ctx = await getPatientContext();
    const facts = await retrieve(ctx?.procedure ?? "hospital visit preparation", 5);

    const deepgram = new WebSocket(DEEPGRAM_AGENT_URL, { headers: { Authorization: `Token ${key}` } });

    deepgram.on("open", () => {
      deepgram.send(
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
              provider: { type: "anthropic", model: "claude-opus-5" },
              prompt: agentSystemPrompt(ctx, facts),
            },
            speak: { provider: { type: "deepgram", model: "aura-2-thalia-en" } },
            greeting: ctx
              ? `Hi ${ctx.firstName}! I heard you're visiting ${ctx.careTeam[0]?.name ?? "the doctor"} soon. What are you wondering about?`
              : "Hi there! I'm here to talk about your upcoming visit. What are you wondering about?",
          },
        }),
      );
      browser.send(JSON.stringify({ type: "voice-ready" }));
    });

    // Deepgram → browser: binary = TTS audio, text = agent events (transcripts etc.)
    deepgram.on("message", (data, isBinary) => {
      if (browser.readyState !== WebSocket.OPEN) return;
      if (isBinary) {
        browser.send(data, { binary: true });
      } else {
        browser.send(data.toString());
      }
    });

    // Browser → Deepgram: binary = mic PCM, text = control messages
    browser.on("message", (data, isBinary) => {
      if (deepgram.readyState !== WebSocket.OPEN) return;
      deepgram.send(data, { binary: isBinary });
    });

    const closeBoth = () => {
      if (deepgram.readyState === WebSocket.OPEN) deepgram.close();
      if (browser.readyState === WebSocket.OPEN) browser.close();
    };
    browser.on("close", closeBoth);
    deepgram.on("close", closeBoth);
    deepgram.on("error", (err) => {
      if (browser.readyState === WebSocket.OPEN) {
        browser.send(JSON.stringify({ type: "voice-unavailable", reason: String(err) }));
      }
      closeBoth();
    });
  });
}
