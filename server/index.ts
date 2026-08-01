import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import path from "node:path";
import { getPatientContext } from "./context.js";
import { chat, type ChatMessage } from "./chat.js";
import { generateStory } from "./story.js";
import { checkCoverage } from "./stedi.js";
import { retrieve } from "./moss.js";
import { attachVoiceBridge } from "./voice.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Generated storybook illustrations (written by server/story.ts)
app.use("/illustrations", express.static(path.join(process.cwd(), "data", "illustrations"), { maxAge: "1y" }));

// Request log: method, path, status, duration
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.path} → ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    integrations: {
      medplum: Boolean(process.env.MEDPLUM_CLIENT_ID),
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      deepgram: Boolean(process.env.DEEPGRAM_API_KEY),
      moss: Boolean(process.env.MOSS_API_KEY),
      stedi: Boolean(process.env.STEDI_TEST_API_KEY),
    },
  });
});

// The child's chart, flattened for the UI + agent
app.get("/api/context", async (_req, res) => {
  try {
    const ctx = await getPatientContext();
    if (!ctx) {
      res.status(404).json({ error: "No patient found. Run `npm run seed` first." });
      return;
    }
    res.json(ctx);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Text conversation (voice fallback) — Claude grounded by Moss + FHIR
app.post("/api/chat", async (req, res) => {
  try {
    const messages = (req.body?.messages ?? []) as ChatMessage[];
    const ctx = await getPatientContext();
    const result = await chat(ctx, messages);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Generate the storybook and file it back to the chart
app.post("/api/story", async (req, res) => {
  try {
    const ctx = await getPatientContext();
    if (!ctx) {
      res.status(404).json({ error: "No patient found. Run `npm run seed` first." });
      return;
    }
    const conversation = (req.body?.conversation ?? []) as { role: string; content: string }[];
    const fears = ((req.body?.fears ?? []) as unknown[]).filter((f): f is string => typeof f === "string").slice(0, 10);
    const result = await generateStory(ctx, conversation, fears);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Parent-facing coverage summary (Stedi test mode or mock)
app.get("/api/coverage", async (_req, res) => {
  try {
    const ctx = await getPatientContext();
    res.json(await checkCoverage(ctx));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Debug: inspect what retrieval returns for a query
app.get("/api/retrieve", async (req, res) => {
  const q = String(req.query.q ?? "");
  res.json(await retrieve(q, 4));
});

// Read a storybook page aloud (Deepgram Aura TTS → mp3)
app.post("/api/narrate", async (req, res) => {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    res.status(503).json({ error: "DEEPGRAM_API_KEY not set" });
    return;
  }
  const text = String(req.body?.text ?? "").slice(0, 1200);
  if (!text.trim()) {
    res.status(400).json({ error: "text required" });
    return;
  }
  try {
    const dg = await fetch("https://api.deepgram.com/v1/speak?model=aura-2-thalia-en", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Token ${key}` },
      body: JSON.stringify({ text }),
    });
    if (!dg.ok) {
      res.status(502).json({ error: `Deepgram TTS failed (${dg.status}): ${await dg.text()}` });
      return;
    }
    res.setHeader("content-type", dg.headers.get("content-type") ?? "audio/mpeg");
    res.setHeader("cache-control", "no-store");
    res.send(Buffer.from(await dg.arrayBuffer()));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

const port = Number(process.env.API_PORT ?? 8787);
const httpServer = createServer(app);
attachVoiceBridge(httpServer);
httpServer.listen(port, () => {
  console.log(`🧸 BraveTales server on http://localhost:${port}`);
});
