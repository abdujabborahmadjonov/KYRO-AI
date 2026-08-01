import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { getPatientContext } from "./context.js";
import { chat, type ChatMessage } from "./chat.js";
import { generateStory } from "./story.js";
import { checkCoverage } from "./stedi.js";
import { retrieve } from "./moss.js";
import { attachVoiceBridge } from "./voice.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

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
    const result = await generateStory(ctx, conversation);
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

const port = Number(process.env.API_PORT ?? 8787);
const httpServer = createServer(app);
attachVoiceBridge(httpServer);
httpServer.listen(port, () => {
  console.log(`🧸 BraveTales server on http://localhost:${port}`);
});
