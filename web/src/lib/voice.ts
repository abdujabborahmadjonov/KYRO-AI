/**
 * Browser side of the voice bridge.
 *
 * Capture: mic → AudioWorklet → Float32 → linear resample to 16kHz → Int16 PCM
 * frames over /ws/voice. Playback: 24kHz Int16 PCM from the server, scheduled
 * gaplessly on a dedicated AudioContext and instantly cancellable on barge-in.
 */
export interface VoiceCallbacks {
  onReady: () => void;
  onUnavailable: (reason: string) => void;
  onTranscript: (role: "user" | "assistant", text: string) => void;
  onFear?: (fear: string) => void;
  onStoryRequested?: () => void;
  onAgentState?: (state: "listening" | "thinking" | "speaking") => void;
  onClose: () => void;
}

const WORKLET_SOURCE = `
class PcmCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
`;

/** Linear resample a Float32 buffer between sample rates. */
function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const outLength = Math.floor((input.length * toRate) / fromRate);
  const output = new Float32Array(outLength);
  const ratio = fromRate / toRate;
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const left = Math.floor(pos);
    const right = Math.min(left + 1, input.length - 1);
    const frac = pos - left;
    output[i] = input[left] * (1 - frac) + input[right] * frac;
  }
  return output;
}

function floatToPcm16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;

export class VoiceSession {
  private ws: WebSocket | null = null;
  private captureCtx: AudioContext | null = null;
  private playbackCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private playhead = 0;
  private scheduled: AudioBufferSourceNode[] = [];
  private stopped = false;

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
      let msg: { type?: string; [k: string]: unknown };
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }
      switch (msg.type) {
        case "voice-ready":
          this.callbacks.onReady();
          void this.startMic();
          break;
        case "voice-unavailable":
          this.callbacks.onUnavailable(String(msg.reason ?? "voice unavailable"));
          this.stop();
          break;
        case "transcript":
          this.callbacks.onTranscript(msg.role === "user" ? "user" : "assistant", String(msg.content ?? ""));
          break;
        case "barge-in":
          this.cancelPlayback();
          break;
        case "fear-noted":
          this.callbacks.onFear?.(String(msg.fear ?? ""));
          break;
        case "story-requested":
          this.callbacks.onStoryRequested?.();
          break;
        case "agent-state":
          this.callbacks.onAgentState?.(msg.state as "listening" | "thinking" | "speaking");
          break;
      }
    };
    this.ws.onclose = () => {
      if (!this.stopped) this.callbacks.onClose();
    };
    this.ws.onerror = () => {
      if (!this.stopped) this.callbacks.onUnavailable("voice connection failed");
    };
  }

  private async startMic() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      this.callbacks.onUnavailable(`microphone permission denied (${String(err)})`);
      this.stop();
      return;
    }

    this.captureCtx = new AudioContext();
    const workletUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "application/javascript" }));
    try {
      await this.captureCtx.audioWorklet.addModule(workletUrl);
    } finally {
      URL.revokeObjectURL(workletUrl);
    }

    const source = this.captureCtx.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(this.captureCtx, "pcm-capture");
    const contextRate = this.captureCtx.sampleRate;

    this.workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      const pcm = floatToPcm16(resample(e.data, contextRate, INPUT_RATE));
      this.ws.send(pcm.buffer);
    };
    source.connect(this.workletNode);
    // Keep the graph alive without echoing the mic to speakers
    const silent = this.captureCtx.createGain();
    silent.gain.value = 0;
    this.workletNode.connect(silent);
    silent.connect(this.captureCtx.destination);
  }

  private playPcm(buffer: ArrayBuffer) {
    if (buffer.byteLength < 2) return;
    if (!this.playbackCtx) this.playbackCtx = new AudioContext();
    const ctx = this.playbackCtx;

    const pcm = new Int16Array(buffer);
    const floats = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) floats[i] = pcm[i] / 0x8000;
    const samples = resample(floats, OUTPUT_RATE, ctx.sampleRate);

    const audioBuffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    audioBuffer.copyToChannel(new Float32Array(samples), 0);

    const src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    this.playhead = Math.max(this.playhead, now + 0.02);
    src.start(this.playhead);
    this.playhead += audioBuffer.duration;
    this.scheduled.push(src);
    src.onended = () => {
      this.scheduled = this.scheduled.filter((s) => s !== src);
    };
  }

  /** Barge-in: the child spoke — silence the agent immediately. */
  private cancelPlayback() {
    for (const src of this.scheduled) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    this.scheduled = [];
    this.playhead = 0;
  }

  stop() {
    this.stopped = true;
    this.cancelPlayback();
    this.workletNode?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.captureCtx?.close().catch(() => {});
    this.playbackCtx?.close().catch(() => {});
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.close();
    this.ws = null;
    this.captureCtx = null;
    this.playbackCtx = null;
    this.stream = null;
    this.workletNode = null;
    this.playhead = 0;
  }
}
