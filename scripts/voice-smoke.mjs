// Headless smoke test for the voice bridge: validates the Deepgram Agent
// handshake, greeting transcript, and TTS audio without a browser mic.
import { WebSocket } from "ws";

const ws = new WebSocket("ws://localhost:8787/ws/voice");
ws.binaryType = "arraybuffer";

let audioBytes = 0;
let ready = false;
const events = [];

const silence = Buffer.alloc(3200); // 100ms of 16kHz linear16 silence
let micTimer = null;

ws.on("open", () => console.log("[test] connected to bridge"));

ws.on("message", (data, isBinary) => {
  if (isBinary || data instanceof ArrayBuffer) {
    audioBytes += data.byteLength ?? data.length;
    return;
  }
  const msg = JSON.parse(data.toString());
  events.push(msg.type);
  if (msg.type === "voice-ready") {
    ready = true;
    console.log("[test] ✅ voice-ready — Deepgram accepted Settings (key + payload valid)");
    // stream silence like a quiet mic so the agent pipeline runs
    micTimer = setInterval(() => ws.readyState === 1 && ws.send(silence), 100);
  } else if (msg.type === "transcript") {
    console.log(`[test] 💬 ${msg.role}: ${msg.content}`);
  } else if (msg.type === "voice-unavailable") {
    console.log(`[test] ❌ voice-unavailable: ${msg.reason}`);
  } else {
    console.log(`[test] event: ${msg.type}${msg.state ? " → " + msg.state : ""}`);
  }
});

ws.on("close", (code) => console.log(`[test] closed (${code})`));
ws.on("error", (e) => console.log("[test] error:", e.message));

setTimeout(() => {
  if (micTimer) clearInterval(micTimer);
  console.log("\n[test] RESULT:");
  console.log("  ready:", ready);
  console.log("  tts audio bytes received:", audioBytes);
  console.log("  events:", [...new Set(events)].join(", "));
  ws.close();
  process.exit(ready && audioBytes > 0 ? 0 : 1);
}, 15000);
