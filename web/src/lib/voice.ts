/**
 * Browser side of the voice bridge: capture mic as 16kHz linear16 PCM, stream
 * over /ws/voice, play returned 24kHz TTS audio, surface transcript events.
 * Falls back cleanly (onUnavailable) when the server has no Deepgram key.
 */
export interface VoiceCallbacks {
  onReady: () => void;
  onUnavailable: (reason: string) => void;
  onTranscript: (role: "user" | "assistant", text: string) => void;
  onClose: () => void;
}

export class VoiceSession {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private playhead = 0;

  constructor(private callbacks: VoiceCallbacks) {}

  async start() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    this.ws = new WebSocket(`${proto}://${location.host}/ws/voice`);
    this.ws.binaryType = "arraybuffer";

    this.ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.playPcm(event.data);
        return;
      }
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "voice-unavailable") {
          this.callbacks.onUnavailable(msg.reason ?? "voice unavailable");
          this.stop();
        } else if (msg.type === "voice-ready") {
          this.callbacks.onReady();
          void this.startMic();
        } else if (msg.type === "ConversationText" && msg.content) {
          this.callbacks.onTranscript(msg.role === "user" ? "user" : "assistant", msg.content);
        }
      } catch {
        // ignore non-JSON text frames
      }
    };
    this.ws.onclose = () => this.callbacks.onClose();
  }

  private async startMic() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } });
    this.audioCtx = new AudioContext({ sampleRate: 16000 });
    const source = this.audioCtx.createMediaStreamSource(this.stream);
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        pcm[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
      }
      this.ws.send(pcm.buffer);
    };
    source.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);
  }

  private playPcm(buffer: ArrayBuffer) {
    if (!this.audioCtx) this.audioCtx = new AudioContext({ sampleRate: 16000 });
    const outputRate = 24000;
    const pcm = new Int16Array(buffer);
    const audioBuffer = this.audioCtx.createBuffer(1, pcm.length, outputRate);
    const channel = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768;
    const src = this.audioCtx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(this.audioCtx.destination);
    const now = this.audioCtx.currentTime;
    this.playhead = Math.max(this.playhead, now);
    src.start(this.playhead);
    this.playhead += audioBuffer.duration;
  }

  stop() {
    this.processor?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioCtx?.close().catch(() => {});
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.close();
    this.ws = null;
    this.audioCtx = null;
    this.stream = null;
    this.processor = null;
    this.playhead = 0;
  }
}
