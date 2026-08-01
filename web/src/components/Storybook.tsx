import { useState } from "react";
import type { StoryResult } from "../lib/api";

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

export function Storybook({ result, generating }: { result: StoryResult | null; generating: boolean }) {
  const [page, setPage] = useState(0);

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
      <h2>📖 {story.title}</h2>
      <p className="dedication">{story.dedication}</p>

      <div className="book-spread">
        <Illustration emoji={current.illustration_emoji} prompt={current.illustration_prompt} index={page} />
        <div className="book-right">
          <p className="page-text">{current.text}</p>
          <div className="pager">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              ← Back
            </button>
            <span>
              Page {Math.min(page + 1, story.pages.length)} of {story.pages.length}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(story.pages.length - 1, p + 1))}
              disabled={page >= story.pages.length - 1}
            >
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
            {result.generated === "claude" ? "Claude" : "demo fallback (set ANTHROPIC_API_KEY for live generation)"}
          </li>
        </ul>
      </div>
    </div>
  );
}
