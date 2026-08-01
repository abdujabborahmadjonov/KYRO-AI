import { useState } from "react";
import { Mascot } from "./components/Mascot";

/** Image from /public/mascots with a friendly SVG fallback until the file exists. */
function MascotPhoto({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="mascot-fallback" role="img" aria-label={alt}>
        <Mascot size={180} />
      </div>
    );
  }
  return <img className="mascot-photo" src={src} alt={alt} onError={() => setFailed(true)} />;
}

const STEPS = [
  {
    icon: "🎙️",
    tint: "tint-coral",
    title: "Kyro talks with your child",
    text: "A gentle voice agent chats about the upcoming visit and learns what your child is scared of — in their own words.",
  },
  {
    icon: "📚",
    tint: "tint-teal",
    title: "Every answer is true",
    text: "Answers are grounded in real pediatric patient-education material, so what comforts your child is also what's accurate.",
  },
  {
    icon: "📖",
    tint: "tint-yellow",
    title: "A storybook starring them",
    text: "Kyro writes an illustrated story where your child is the hero of their own real procedure — with their real care team as characters.",
  },
  {
    icon: "🏥",
    tint: "tint-purple",
    title: "Filed back to the chart",
    text: "The story and what your child was told are saved to the medical record, so the care team walks in already knowing what to expect.",
  },
];

export function Landing() {
  return (
    <div className="landing">
      <nav className="topbar">
        <div className="brand">
          <Mascot size={44} />
          <h1 className="logo">
            <span>K</span>
            <span>y</span>
            <span>r</span>
            <span>o</span>
          </h1>
        </div>
        <div className="nav-actions">
          <a className="nav-link" href="https://github.com/abdujabborahmadjonov/KYRO-AI" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className="button-link" href="/app">
            Try the demo
          </a>
        </div>
      </nav>

      <section className="hero-split">
        <div className="hero-copy">
          <h2>
            Every brave kid deserves <em>their own</em> story.
          </h2>
          <p>
            Kyro talks with your child before a medical procedure, learns what they're scared of, and turns their real
            visit into a personalized storybook — where they're the hero.
          </p>
          <div className="hero-ctas">
            <a className="button-link big" href="/app">
              📖 Try the demo
            </a>
            <a className="button-link big ghost" href="#how">
              How it works
            </a>
          </div>
          <p className="trust-line">
            Built on real medical records (FHIR) · Clinically-grounded answers · Voice-first for ages 3–10
          </p>
        </div>
        <div className="hero-art">
          <MascotPhoto src="/mascots/checkup.png" alt="Kyro the friendly pink monster giving a child a gentle checkup" />
        </div>
      </section>

      <section className="steps" id="how">
        <h3>How Kyro works</h3>
        <div className="step-grid">
          {STEPS.map((s, i) => (
            <div className="step-card" key={s.title}>
              <div className={`step-icon ${s.tint}`}>{s.icon}</div>
              <span className="step-num">{i + 1}</span>
              <h4>{s.title}</h4>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="feature-split">
        <div className="feature-art">
          <MascotPhoto src="/mascots/nurse.png" alt="Kyro dressed as a nurse waving to a smiling child in a hospital bed" />
        </div>
        <div className="feature-copy">
          <h3>Calmer kids. Calmer parents. Happier care teams.</h3>
          <ul>
            <li>
              <strong>😟 → 😊 Fears, addressed head-on.</strong> The loud machine, the needle, being away from mom —
              Kyro captures each fear and the story answers it honestly.
            </li>
            <li>
              <strong>👪 Parents get clarity too.</strong> A plain-language insurance summary: what's covered, what it
              costs, no surprises.
            </li>
            <li>
              <strong>🩺 Zero extra work for clinicians.</strong> The care team does nothing — and gains a documented
              record of exactly how the child was prepared.
            </li>
          </ul>
          <a className="button-link big" href="/app">
            See it in action →
          </a>
        </div>
      </section>

      <section className="tech-strip">
        <span>Powered by</span>
        <div className="tech-chips">
          <span className="tech-chip">Medplum FHIR</span>
          <span className="tech-chip">Deepgram Voice</span>
          <span className="tech-chip">Claude</span>
          <span className="tech-chip">Moss Retrieval</span>
          <span className="tech-chip">Stedi Eligibility</span>
        </div>
      </section>

      <footer className="footer">
        <Mascot size={36} />
        <span>Kyro · Brave stories for brave kids · Built at the Medplum Hackathon @ YC 2026</span>
      </footer>
    </div>
  );
}
