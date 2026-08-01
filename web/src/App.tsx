import { useEffect, useState } from "react";
import { api, type ChatMessage, type PatientContext, type StoryResult } from "./lib/api";
import { ChartPanel } from "./components/ChartPanel";
import { ChatPanel } from "./components/ChatPanel";
import { Storybook } from "./components/Storybook";
import { CoverageCard } from "./components/CoverageCard";

export default function App() {
  const [ctx, setCtx] = useState<PatientContext | null>(null);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [storyResult, setStoryResult] = useState<StoryResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);

  useEffect(() => {
    api.context().then(setCtx).catch((e: Error) => setCtxError(e.message));
  }, []);

  const generateStory = async () => {
    setGenerating(true);
    setStoryError(null);
    try {
      setStoryResult(await api.story(conversation));
    } catch (e) {
      setStoryError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🧸 BraveTales</h1>
        <p>Voice-powered, chart-aware storybooks — the child is the hero of their own real procedure.</p>
      </header>

      {ctxError && (
        <div className="banner error">
          {ctxError} — run <code>npm run seed</code> then refresh.
        </div>
      )}

      <div className="grid">
        <section className="col">
          <ChartPanel ctx={ctx} />
          <CoverageCard />
        </section>

        <section className="col">
          <ChatPanel ctx={ctx} conversation={conversation} setConversation={setConversation} />
          <button className="cta" onClick={generateStory} disabled={generating || !ctx}>
            {generating ? "✨ Writing the story…" : "📖 Generate the storybook"}
          </button>
          {storyError && <div className="banner error">{storyError}</div>}
        </section>

        <section className="col wide">
          <Storybook result={storyResult} generating={generating} />
        </section>
      </div>
    </div>
  );
}
