# 🧸 KYRO AI

**KYRO AI (BraveTales) — voice-powered, chart-aware storybooks that prepare kids for their real procedures, generated from their actual medical record and filed back into it.**

Built at the Medplum Hackathon @ Y Combinator · August 2026

---

## The Problem

Every year, millions of children undergo medical procedures they don't understand. Pediatric procedural anxiety isn't just sad — it's clinical: anxious kids need more sedation, move during imaging, refuse masks and IVs, and carry medical fear into adulthood. Child life specialists — the professionals who prepare kids for procedures — exist in fewer than half of US hospitals, and almost never in outpatient clinics.

Meanwhile, the information needed to prepare each child perfectly — their exact procedure, their age, their condition, their care team's names — is already sitting in the EHR. Nobody uses it.

## The Solution

BraveTales is a voice agent that talks with a child and parent before a scheduled procedure, learns what the child is scared of, and generates a personalized, clinically-grounded illustrated storybook where **the child is the hero of their own real, upcoming procedure** — then files it to the chart so the care team knows exactly what the child was told.

It's not a generic storybook generator. Every story is built from the patient's **actual FHIR data** and grounded in **real pediatric patient-education content**, so what comforts the child is also what's true.

## How It Works

```
┌─────────────┐   voice    ┌──────────────┐   FHIR    ┌─────────────┐
│ Child +     │──────────▶│  Deepgram     │──────────▶│  Medplum    │
│ Parent      │◀──────────│  Voice Agent  │◀──────────│  (EHR)      │
└─────────────┘   TTS      └──────┬───────┘           └──────┬──────┘
                                  │ retrieval                │ writes
                                  ▼                          ▼
                           ┌──────────────┐          ┌──────────────┐
                           │  Moss        │          │ Storybook +  │
                           │  (sub-10ms   │          │ DocumentRef  │
                           │  ped-ed      │          │ + Coverage   │
                           │  corpus)     │          │ summary      │
                           └──────────────┘          └──────────────┘
```

1. **Pull the truth from the chart.** BraveTales reads the child's upcoming `Appointment` / `ServiceRequest`, their `Condition`, age, and care team (`CareTeam`, `Practitioner`) from **Medplum**.
2. **Talk to the child.** A **Deepgram** voice agent (Flux + Aura TTS) has a short, gentle conversation: *"I heard you're visiting Dr. Chen on Tuesday for a picture of your tummy! What are you wondering about?"* The child's fears — the loud machine, the needle, being away from mom — are captured in their own words.
3. **Ground every fact.** During the conversation and story generation, **Moss** retrieves from an embedded corpus of real pediatric patient-education material at conversational speed — so when the agent answers *"will it hurt?"*, the answer is clinically accurate, instantly.
4. **Generate the story.** Claude writes a story at the child's reading level where the child is the protagonist, their fears are addressed head-on, and their *real* care team appears as characters. Illustrations rendered per-page.
5. **File it back — this is the part no storybook app does.** The book is stored to Medplum as a `DocumentReference`, plus a `Communication` record of what the child was told. The care team walks in knowing what the child expects.
6. **Prepare the parent too.** A **Stedi** eligibility check (test mode) produces a plain-language coverage summary — *"Your plan covers this; expect a $40 copay."*

## Tech Stack

| Layer | Technology |
|---|---|
| EHR / FHIR datastore | [Medplum](https://www.medplum.com) (TypeScript SDK) — in-memory mock FHIR store fallback |
| Speech-to-text / voice agent | [Deepgram](https://deepgram.com) Voice Agent (Flux) — text-chat fallback |
| Text-to-speech | Deepgram Aura |
| Real-time retrieval (ped-ed corpus) | [Moss](https://moss.dev) — local BM25 fallback |
| Coverage / eligibility | [Stedi](https://www.stedi.com) Healthcare APIs (test mode, 270/271) — mock 271 fallback |
| Story generation | Claude (Anthropic API, structured outputs) — canned demo story fallback |
| Frontend | React + Vite |
| Server | Express + WebSocket voice bridge |

**Every integration has a keyless mock fallback** — the full demo flow works with zero API keys, and each layer upgrades to the real service when its key is present in `.env`.

## Quickstart

```bash
npm install

# Environment (optional — everything mocks without keys)
cp .env.example .env
# Fill in any of: MEDPLUM_CLIENT_ID, MEDPLUM_CLIENT_SECRET,
#                 ANTHROPIC_API_KEY, DEEPGRAM_API_KEY, MOSS_API_KEY, STEDI_TEST_API_KEY

# Seed a demo patient with a scheduled procedure (Maya, 6, abdominal MRI Tuesday)
npm run seed

# Index the pediatric education corpus (local BM25 + Moss if key set)
npm run index-corpus

# Run — server on :8787, web on :5173 (landing page at /, demo app at /app)
npm run dev
```

> 🖼️ Mascot art: drop your generated mascot images into `web/public/mascots/` as
> `checkup.png` and `nurse.png` — the landing page picks them up automatically
> (it shows an SVG fallback until then).

## Deploy (Render, free tier)

The repo ships a [render.yaml](render.yaml) blueprint — one long-running Node service that
serves the built frontend, the API, and the voice WebSocket, and auto-seeds the demo chart
on first boot.

1. Sign in at [render.com](https://render.com) with GitHub and grant access to this repo.
2. **New → Blueprint** → select `KYRO-AI` → **Apply**.
3. In the service's **Environment** tab, paste `OPENAI_API_KEY` and `DEEPGRAM_API_KEY`
   (both optional — the app mocks whatever is missing).

Notes for the free tier: the instance sleeps after ~15 min idle (first request wakes it),
and the disk is ephemeral — generated stories/illustrations reset on redeploys. Connect
Medplum credentials for durable, chart-native storage.

Local production run: `npm run build && npm start`.

## Demo Flow (3 minutes)

1. Show the chart panel: *Maya, age 6, MRI scheduled Tuesday with Dr. Chen.*
2. Talk to BraveTales (voice with a Deepgram key, or text): say you're scared of "the loud tunnel."
3. Hit **Generate the storybook**: *"Maya and the Space Tunnel"* — starring Maya and Dr. Chen, with the MRI sounds explained as rocket engines.
4. Point at the "Filed back to the chart" panel: the `DocumentReference` and `Communication` IDs on Maya's chart; the parent's coverage summary is on the left.

## What's Real vs. Mocked

- ✅ Real when keys are set: Medplum FHIR reads/writes, Claude story + conversation, Deepgram streaming voice, Moss retrieval, Stedi test-mode eligibility
- 🔶 Always mocked: patient data (synthetic demo patient), phone trigger (manual for demo)

## Roadmap

- Multilingual stories (Deepgram Nova-3 multilingual) — the child hears the call in their home language
- Post-procedure follow-up call: *"You did it! How was the space tunnel?"* → `QuestionnaireResponse`
- Clinician dashboard: anxiety flags surfaced to the care team pre-procedure
- Per-page image generation replacing the SVG illustration placeholders

## License

MIT
