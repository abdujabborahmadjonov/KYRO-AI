import { useEffect, useRef, useState } from "react";
import { api, type ChatMessage, type PatientContext } from "../lib/api";
import { VoiceSession } from "../lib/voice";

interface Props {
  ctx: PatientContext | null;
  conversation: ChatMessage[];
  setConversation: (msgs: ChatMessage[]) => void;
  fears: string[];
  onFear: (fear: string) => void;
  onStoryRequested: () => void;
}

type VoiceState = "off" | "connecting" | "live" | "unavailable";
type AgentState = "listening" | "thinking" | "speaking";

const AGENT_STATE_LABEL: Record<AgentState, string> = {
  listening: "👂 listening",
  thinking: "💭 thinking",
  speaking: "🗣️ speaking",
};

export function ChatPanel({ ctx, conversation, setConversation, fears, onFear, onStoryRequested }: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("off");
  const [agentState, setAgentState] = useState<AgentState>("listening");
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const voiceRef = useRef<VoiceSession | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation]);

  useEffect(() => () => voiceRef.current?.stop(), []);

  const greet = ctx
    ? `Hi ${ctx.firstName}! I heard you're visiting ${ctx.careTeam[0]?.name ?? "the doctor"} soon for ${ctx.procedure.toLowerCase()}. What are you wondering about?`
    : "Hi! Once the chart loads I'll know all about your visit. What are you wondering about?";

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const next: ChatMessage[] = [...conversation, { role: "user", content: text.trim() }];
    setConversation(next);
    setInput("");
    setBusy(true);
    try {
      const { reply, fears: detected } = await api.chat(next);
      setConversation([...next, { role: "assistant", content: reply }]);
      detected.forEach(onFear);
    } catch (e) {
      setConversation([...next, { role: "assistant", content: `(error: ${(e as Error).message})` }]);
    } finally {
      setBusy(false);
    }
  };

  const toggleVoice = async () => {
    if (voiceState === "live" || voiceState === "connecting") {
      voiceRef.current?.stop();
      setVoiceState("off");
      return;
    }
    setVoiceState("connecting");
    setVoiceNote(null);
    const session = new VoiceSession({
      onReady: () => setVoiceState("live"),
      onUnavailable: (reason) => {
        setVoiceState("unavailable");
        setVoiceNote(reason);
      },
      onTranscript: (role, text) => {
        if (!text.trim()) return;
        setConversation([...conversationRef.current, { role, content: text }]);
      },
      onFear,
      onStoryRequested,
      onAgentState: setAgentState,
      onClose: () => setVoiceState((s) => (s === "live" || s === "connecting" ? "off" : s)),
    });
    voiceRef.current = session;
    await session.start();
  };

  return (
    <div className="card chat">
      <h2>
        🎙️ Talk with Kyro{" "}
        {voiceState === "live" && <span className="pill medplum">{AGENT_STATE_LABEL[agentState]}</span>}
        <button
          className={`mic ${voiceState}`}
          onClick={toggleVoice}
          title={voiceState === "unavailable" ? voiceNote ?? "" : "Toggle voice"}
        >
          {voiceState === "live" ? "⏹ stop voice" : voiceState === "connecting" ? "…" : "🎤 voice"}
        </button>
      </h2>
      {voiceState === "unavailable" && <div className="banner">{voiceNote}</div>}
      {fears.length > 0 && (
        <div className="fears">
          {fears.map((f) => (
            <span key={f} className="fear-chip" title="Fear captured from the conversation">
              😟 {f}
            </span>
          ))}
        </div>
      )}
      <div className="messages" ref={scrollRef}>
        <div className="msg assistant">{greet}</div>
        {conversation.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.content}
          </div>
        ))}
        {busy && <div className="msg assistant muted">…</div>}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type what the child says… (e.g. “is it loud?”)"
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
