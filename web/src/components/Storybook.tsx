import { useEffect, useRef, useState } from "react";
import { api, type StoryPage, type StoryResult } from "../lib/api";

const PALETTES = [
  ["#ff9a7b", "#ff5e7e"],
  ["#ffd54f", "#ff8a65"],
  ["#4dd0c4", "#aed581"],
  ["#f48fb1", "#b388ff"],
  ["#81d4fa", "#4dd0c4"],
];

function Illustration({ emoji, prompt, index }: { emoji: string; prompt: string; index: number }) {
  const [a, b] = PALETTES[index % PALETTES.length];
  const id = `grad-${index}`;
  return (
    <svg viewBox="0 0 400 300" role="img" aria-label={prompt} className="illustration">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={a} />
          <stop offset="100%" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="400" height="300" rx="20" fill={`url(#${id})`} />
      <circle cx="340" cy="55" r="26" fill="#fff" opacity="0.35" />
      <circle cx="60" cy="240" r="40" fill="#fff" opacity="0.2" />
      <circle cx="380" cy="270" r="18" fill="#fff" opacity="0.25" />
      <text x="200" y="172" textAnchor="middle" fontSize="104">
        {emoji}
      </text>
    </svg>
  );
}

/** Real illustration when one was generated, SVG placeholder otherwise. */
function PageArt({ page, index }: { page: StoryPage; index: number }) {
  const [failed, setFailed] = useState(false);
  if (page.illustration_url && !failed) {
    return (
      <img
        className="illustration"
        src={page.illustration_url}
        alt={page.illustration_prompt}
        onError={() => setFailed(true)}
      />
    );
  }
  return <Illustration emoji={page.illustration_emoji} prompt={page.illustration_prompt} index={index} />;
}

/** "Read to me" — Deepgram Aura narration of the current page, cached per page. */
function useNarration() {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "unavailable">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef(new Map<string, string>()); // text → object URL

  useEffect(
    () => () => {
      audioRef.current?.pause();
      cacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const stop = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setState("idle");
  };

  const play = async (text: string) => {
    if (state === "playing" || state === "loading") {
      stop();
      return;
    }
    setState("loading");
    try {
      let url = cacheRef.current.get(text);
      if (!url) {
        const blob = await api.narrate(text);
        url = URL.createObjectURL(blob);
        cacheRef.current.set(text, url);
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setState("idle");
      await audio.play();
      setState("playing");
    } catch {
      setState("unavailable");
    }
  };

  return { state, play, stop };
}

export function Storybook({ result, generating }: { result: StoryResult | null; generating: boolean }) {
  const [page, setPage] = useState(0);
  const narration = useNarration();

  const goTo = (p: number) => {
    narration.stop();
    setPage(p);
  };

  if (generating) {
    return (
      <div className="card storybook empty">
        <h2>📖 The Storybook</h2>
        <p className="muted">Weaving the chart, the child's fears, and real clinical facts into a story…</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="card storybook empty">
        <h2>📖 The Storybook</h2>
        <p className="muted">
          Talk with Kyro first (or don't — it works either way), then hit{" "}
          <strong>Generate the storybook</strong>. The finished book is filed back to the chart as a
          DocumentReference + Communication.
        </p>
      </div>
    );
  }

  const { story } = result;
  const current = story.pages[Math.min(page, story.pages.length - 1)];

  return (
    <div className="card storybook">
      <h2>
        📖 {story.title}
        <span className="book-actions">
          <button
            className="mini"
            onClick={() => void narration.play(current.text)}
            disabled={narration.state === "unavailable"}
            title={narration.state === "unavailable" ? "Narration needs DEEPGRAM_API_KEY" : "Read this page aloud"}
          >
            {narration.state === "playing" ? "⏹ Stop" : narration.state === "loading" ? "…" : "🔊 Read to me"}
          </button>
          <button className="mini" onClick={() => window.print()} title="Print the whole book">
            🖨️ Print
          </button>
        </span>
      </h2>
      <p className="dedication">{story.dedication}</p>

      <div className="book-spread">
        <PageArt page={current} index={page} />
        <div className="book-right">
          <p className="page-text">{current.text}</p>
          <div className="pager">
            <button onClick={() => goTo(Math.max(0, page - 1))} disabled={page === 0}>
              ← Back
            </button>
            <span>
              Page {Math.min(page + 1, story.pages.length)} of {story.pages.length}
            </span>
            <button onClick={() => goTo(Math.min(story.pages.length - 1, page + 1))} disabled={page >= story.pages.length - 1}>
              Next →
            </button>
          </div>
        </div>
      </div>

      <div className="filed">
        <h3>Filed back to the chart ✅</h3>
        <ul>
          {result.documentReferenceId && (
            <li>
              <code>DocumentReference/{result.documentReferenceId}</code> — the storybook itself
            </li>
          )}
          {result.communicationId && (
            <li>
              <code>Communication/{result.communicationId}</code> — what the child was told
            </li>
          )}
          <li className="muted">
            Fears addressed: {story.fears_addressed.join(", ") || "—"} · Generated via{" "}
            {result.generated === "openai"
              ? "GPT-4o + gpt-image-1"
              : result.generated === "claude"
                ? "Claude"
                : "demo fallback (set OPENAI_API_KEY or ANTHROPIC_API_KEY for live generation)"}
          </li>
        </ul>
      </div>

      {/* Print-only rendering of the complete book, one page per sheet */}
      <div className="print-book" aria-hidden="true">
        <div className="print-page print-cover">
          <h1>{story.title}</h1>
          <p>{story.dedication}</p>
        </div>
        {story.pages.map((p, i) => (
          <div className="print-page" key={p.page_number}>
            <PageArt page={p} index={i} />
            <p>{p.text}</p>
            <span className="print-num">{p.page_number}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
