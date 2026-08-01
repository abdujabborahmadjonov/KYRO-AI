/**
 * Kyro landing page — ported from the published Lovable design
 * (healthykids-landing.lovable.app), rebranded BraveTales → Kyro.
 * Dark plum + cream + amber, Lora serif display, Nunito Sans body.
 */
import { useBackgroundMusic } from "./lib/music";
import { Mascot } from "./components/Mascot";

const STEPS = [
  {
    n: 1,
    title: "Pull the truth from the chart",
    tag: "MEDPLUM",
    text: "Kyro reads the child's upcoming Appointment and ServiceRequest, their Condition, age, and care team (CareTeam, Practitioner) straight from the EHR.",
  },
  {
    n: 2,
    title: "Talk to the child",
    tag: "DEEPGRAM",
    text: "A gentle voice agent (Flux + Aura TTS) opens with what it already knows: “I heard you're visiting Dr. Chen on Tuesday for a picture of your tummy — what are you wondering about?” Fears get captured in the child's own words.",
  },
  {
    n: 3,
    title: "Ground every fact",
    tag: "MOSS",
    text: "Sub-10ms semantic search over an embedded corpus of real pediatric patient-education material, so “will it hurt?” gets a clinically accurate answer at conversational speed.",
  },
  {
    n: 4,
    title: "Generate the story",
    tag: "LLM + IMAGE GEN",
    text: "A story at the child's reading level where they are the protagonist, their fears are addressed head-on, and their real care team appears as characters — illustrated page by page.",
  },
  {
    n: 5,
    title: "File it back to the chart",
    tag: "FHIR WRITE-BACK",
    text: "The book is stored as a DocumentReference linked to the Encounter, plus a Communication record of what the child was told. The care team walks in already knowing what the child expects.",
  },
  {
    n: 6,
    title: "Prepare the parent too",
    tag: "STEDI",
    text: "A test-mode eligibility check (270/271) turns coverage into plain language — “Your plan covers this; expect a $40 copay” — because parental anxiety is half of pediatric anxiety.",
  },
];

const AGENTIC = [
  {
    icon: "🎙️",
    title: "Voice-enabled",
    text: "The entire intake is a natural conversation with a six-year-old — the hardest voice UX there is.",
  },
  {
    icon: "🧬",
    title: "Standards-compliant",
    text: "Reads and writes real FHIR R4: Appointment, ServiceRequest, Condition, CareTeam, DocumentReference, Communication, Coverage.",
  },
  {
    icon: "🩺",
    title: "Zero clinician workload",
    text: "The care team does nothing — and gains a documented record of patient preparation plus a calmer patient.",
  },
  {
    icon: "⚙️",
    title: "Automated end-to-end",
    text: "Triggered by a Medplum Bot when a pediatric procedure is scheduled. The family just answers a call.",
  },
];

const STACK = [
  ["EHR / FHIR DATASTORE", "Medplum — TypeScript SDK, Bots, React components"],
  ["SPEECH-TO-TEXT / VOICE AGENT", "Deepgram Flux + Nova-3"],
  ["TEXT-TO-SPEECH", "Deepgram Aura"],
  ["REAL-TIME RETRIEVAL", "Moss — sub-10ms semantic search over ped-ed corpus"],
  ["COVERAGE / ELIGIBILITY", "Stedi Healthcare APIs (test mode, 270/271)"],
  ["STORY + ILLUSTRATION", "Claude + image generation API"],
  ["FRONTEND", "React + Medplum component library"],
];

const DEMO = [
  "Show the Medplum chart: Maya, age 6, MRI scheduled Tuesday.",
  "The phone rings on stage. Maya answers and says she's scared of “the loud tunnel.”",
  "The story generates live: “Maya and the Space Tunnel,” starring Maya, her stuffed rabbit, and Dr. Chen — MRI sounds explained as rocket engines.",
  "Flip back to Medplum: the DocumentReference is on Maya's chart; the parent's phone shows the coverage summary.",
  "Hand the judges a printed copy.",
];

const ROADMAP = [
  {
    title: "Multilingual stories",
    text: "Deepgram Nova-3 multilingual — the child hears the call in their home language.",
  },
  {
    title: "Post-procedure follow-up",
    text: "“You did it! How was the space tunnel?” → captured as a QuestionnaireResponse.",
  },
  {
    title: "Clinician dashboard",
    text: "Anxiety flags surfaced to the care team before the child arrives.",
  },
];

export function Landing() {
  const music = useBackgroundMusic();
  return (
    <div className="lp">
      <nav className="lp-nav">
        <a className="lp-brand" href="/">
          <Mascot size={38} /> <span>Kyro</span>
        </a>
        <div className="lp-nav-links">
          <a href="#problem">Problem</a>
          <a href="#how">How it works</a>
          <a href="#stack">Stack</a>
          <a href="#demo">Demo</a>
        </div>
        <div className="lp-nav-actions">
          <button className="lp-music" onClick={music.toggle} title="Background music">
            {music.enabled ? "🎵" : "🔇"}
          </button>
          <a className="lp-btn lp-btn-purple" href="/app">
            See the demo
          </a>
        </div>
      </nav>

      {/* Hero */}
      <header className="lp-hero">
        <div className="lp-container lp-hero-grid">
          <div>
            <span className="lp-badge">MEDPLUM HACKATHON · YC · AUG 2026</span>
            <h1>The child is the hero of their own procedure.</h1>
            <p className="lp-lede">
              Kyro is a voice agent that talks with a child before a scheduled procedure, learns what scares them, and
              writes a personalized illustrated storybook from their <strong>actual FHIR chart</strong> — then files it
              back so the care team knows exactly what the child was told.
            </p>
            <div className="lp-ctas">
              <a className="lp-btn lp-btn-amber" href="#how">
                How it works
              </a>
              <a className="lp-btn lp-btn-outline" href="#problem">
                Why it matters
              </a>
            </div>
            <div className="lp-stats">
              <div>
                <strong>&lt;50%</strong>
                <span>of US hospitals have a child life specialist</span>
              </div>
              <div>
                <strong>&lt;10ms</strong>
                <span>grounded retrieval during the call</span>
              </div>
              <div>
                <strong>7</strong>
                <span>FHIR resources read &amp; written</span>
              </div>
            </div>
          </div>
          <img
            className="lp-art"
            src="/landing/hero.jpg"
            alt="Illustration of a child in pajamas holding a stuffed rabbit, floating toward a glowing rocket tunnel"
          />
        </div>
      </header>

      {/* Problem */}
      <section className="lp-section lp-cream" id="problem">
        <div className="lp-container lp-split">
          <div>
            <span className="lp-eyebrow">THE PROBLEM</span>
            <h2>Procedural anxiety isn't just sad — it's clinical.</h2>
            <p>
              Anxious kids need more sedation, move during imaging, and refuse masks and IVs. Many carry medical fear
              into adulthood. Child life specialists exist in fewer than half of US hospitals, and almost never in
              outpatient clinics.
            </p>
            <div className="lp-callout">
              Meanwhile, everything needed to prepare each child perfectly — their exact procedure, their age, their
              condition, their care team's names — is already sitting in the EHR. Nobody uses it.
            </div>
          </div>
          <img
            className="lp-art"
            src="/landing/voice.jpg"
            alt="A parent and child on a phone call with a friendly glowing voice assistant"
          />
        </div>
      </section>

      {/* Solution */}
      <section className="lp-section lp-plum">
        <div className="lp-container lp-split">
          <img
            className="lp-art lp-art-framed"
            src="/landing/book.jpg"
            alt="An open storybook spread showing a doctor character and a small child hero"
          />
          <div>
            <span className="lp-eyebrow">THE SOLUTION</span>
            <h2>Not a generic storybook generator.</h2>
            <p>
              Every story is built from the patient's <strong>actual FHIR data</strong> and grounded in real pediatric
              patient-education content — so what comforts the child is also what's true.
            </p>
            <ul className="lp-sparks">
              <li>The child is the hero of their own real, upcoming procedure.</li>
              <li>Their fears, in their own words, are answered inside the story.</li>
              <li>Their real care team appears as characters they'll recognize.</li>
              <li>The finished book is filed back to the chart, not to an app silo.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="lp-section lp-cream" id="how">
        <div className="lp-container lp-center-head">
          <span className="lp-eyebrow">HOW IT WORKS</span>
          <h2>From the chart, to the child, and back again.</h2>
          <p className="lp-sub">Six steps, triggered automatically the moment a pediatric procedure is scheduled.</p>
        </div>
        <div className="lp-container lp-steps">
          {STEPS.map((s) => (
            <div className="lp-step" key={s.n}>
              <div className="lp-step-num">{s.n}</div>
              <div className="lp-step-card">
                <h3>
                  {s.title} <span className="lp-tag">{s.tag}</span>
                </h3>
                <p>{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Agentic */}
      <section className="lp-section lp-peach">
        <div className="lp-container lp-center-head">
          <span className="lp-eyebrow">AGENTIC HEALTHCARE</span>
          <h2>Why this counts as agentic — not just generative.</h2>
        </div>
        <div className="lp-container lp-agentic-grid">
          {AGENTIC.map((a) => (
            <div className="lp-white-card" key={a.title}>
              <span className="lp-card-icon">{a.icon}</span>
              <h3>{a.title}</h3>
              <p>{a.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech stack */}
      <section className="lp-section lp-cream" id="stack">
        <div className="lp-container lp-center-head">
          <span className="lp-eyebrow">TECH STACK</span>
          <h2>Everything real, wired end-to-end.</h2>
        </div>
        <div className="lp-container lp-stack">
          {STACK.map(([label, value]) => (
            <div className="lp-stack-row" key={label}>
              <span className="lp-stack-label">{label}</span>
              <span className="lp-stack-value">{value}</span>
            </div>
          ))}
        </div>
        <div className="lp-container lp-realmock">
          <div className="lp-white-card">
            <h3>Real</h3>
            <ul>
              <li>✅ Deepgram streaming conversation</li>
              <li>✅ Medplum FHIR reads and writes</li>
              <li>✅ Moss retrieval over the ped-ed corpus</li>
              <li>✅ Stedi test-mode eligibility</li>
              <li>✅ Story and illustration generation</li>
            </ul>
          </div>
          <div className="lp-white-card">
            <h3>Mocked</h3>
            <ul>
              <li>🔶 Patient data (synthetic demo patient)</li>
              <li>🔶 Phone trigger (manual for the demo)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Demo flow */}
      <section className="lp-section lp-plum" id="demo">
        <div className="lp-container lp-center-head">
          <span className="lp-eyebrow">DEMO FLOW</span>
          <h2>Three minutes, one very brave six-year-old.</h2>
        </div>
        <div className="lp-container lp-demo-list">
          {DEMO.map((d, i) => (
            <div className="lp-demo-row" key={i}>
              <span className="lp-demo-num">{String(i + 1).padStart(2, "0")}</span>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roadmap */}
      <section className="lp-section lp-cream">
        <div className="lp-container lp-center-head">
          <span className="lp-eyebrow">ROADMAP</span>
          <h2>Where it goes next.</h2>
        </div>
        <div className="lp-container lp-roadmap">
          {ROADMAP.map((r) => (
            <div className="lp-white-card" key={r.title}>
              <h3>{r.title}</h3>
              <p>{r.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="lp-footer">
        <div className="lp-container">
          <h2>Every child deserves to know what happens next.</h2>
          <p>Built at the Medplum Hackathon @ Y Combinator, August 2026.</p>
          <div className="lp-ctas lp-ctas-center">
            <a className="lp-btn lp-btn-amber" href="/app">
              Try the live demo
            </a>
            <a
              className="lp-btn lp-btn-outline"
              href="https://github.com/abdujabborahmadjonov/KYRO-AI"
              target="_blank"
              rel="noreferrer"
            >
              Read the walkthrough
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
