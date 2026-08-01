import { useEffect, useState } from "react";
import { api, type StorySummary, type StoryResult } from "./lib/api";
import { Mascot } from "./components/Mascot";
import { Storybook } from "./components/Storybook";
import { useBackgroundMusic } from "./lib/music";

function StoryCard({ s, onOpen }: { s: StorySummary; onOpen: () => void }) {
  const when = s.date
    ? new Date(s.date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";
  return (
    <button className="story-card" onClick={onOpen} title={`Read "${s.title}"`}>
      {s.cover ? (
        <img className="story-cover" src={s.cover} alt="" />
      ) : (
        <div className="story-cover story-cover-emoji">{s.coverEmoji}</div>
      )}
      <div className="story-card-body">
        <h3>{s.title}</h3>
        <p className="dedication">{s.dedication}</p>
        <p className="muted">
          {s.pageCount} pages{when ? ` · ${when}` : ""}
        </p>
        {s.fears.length > 0 && (
          <div className="fears">
            {s.fears.slice(0, 3).map((f) => (
              <span key={f} className="fear-chip">
                😟 {f}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

export function StoryLibrary() {
  const [stories, setStories] = useState<StorySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<StorySummary | null>(null);
  const music = useBackgroundMusic();

  useEffect(() => {
    api.stories().then(setStories).catch((e: Error) => setError(e.message));
  }, []);

  const openResult: StoryResult | null = open
    ? { story: open.story, documentReferenceId: open.id, generated: "openai" }
    : null;

  return (
    <div className="app">
      <nav className="topbar">
        <div className="brand">
          <Mascot size={44} />
          <h1 className="logo">
            <span>K</span>
            <span>y</span>
            <span>r</span>
            <span>o</span>
          </h1>
          <span className="tagline">📚 Story library</span>
        </div>
        <div className="nav-right">
          <button className="mini" onClick={music.toggle} title="Background music">
            {music.enabled ? "🎵 music on" : "🔇 music off"}
          </button>
          <a className="nav-pill-link" href="/app">
            ← Back to the demo
          </a>
        </div>
      </nav>

      {error && <div className="banner error">{error}</div>}

      {open ? (
        <div className="library-reader">
          <button className="mini" onClick={() => setOpen(null)}>
            ← All stories
          </button>
          <Storybook result={openResult} generating={false} />
        </div>
      ) : (
        <>
          <p className="library-intro">
            Every storybook Kyro has ever written — for you and everyone else — read straight back off the chart
            (each one is a <code>DocumentReference</code>).
          </p>
          {!stories && !error && <div className="card">Loading the bookshelf…</div>}
          {stories && stories.length === 0 && (
            <div className="card">
              No stories yet — <a href="/app">generate the first one</a>!
            </div>
          )}
          {stories && stories.length > 0 && (
            <div className="library-grid">
              {stories.map((s) => (
                <StoryCard key={s.id} s={s} onOpen={() => setOpen(s)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
