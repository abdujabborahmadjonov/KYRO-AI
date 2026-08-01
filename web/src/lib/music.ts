/**
 * Gentle generative background music — a soft music-box arpeggio over the
 * C-major pentatonic scale, at whisper volume. Pure WebAudio: no audio files.
 *
 * Browsers block audio before the first user gesture, so start() arms a
 * one-time pointer/key listener when autoplay is refused. Preference persists
 * in localStorage.
 */
import { useEffect, useState } from "react";

const NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C5 D5 E5 G5 A5 C6
const MASTER_VOLUME = 0.035; // "a silent voice"
const PREF_KEY = "kyro-music";

class MusicBox {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private armed = false;
  playing = false;

  private ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = MASTER_VOLUME;
      this.master.connect(this.ctx.destination);
    }
  }

  private pluck(time: number, freq: number, gain: number) {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain, time + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 2.4);
    osc.connect(env);
    env.connect(this.master);
    osc.start(time);
    osc.stop(time + 2.6);
  }

  private scheduleNext() {
    if (!this.playing || !this.ctx) return;
    const now = this.ctx.currentTime;
    const note = NOTES[Math.floor(Math.random() * NOTES.length)];
    this.pluck(now, note, 1);
    if (Math.random() < 0.3) this.pluck(now + 0.18, NOTES[Math.floor(Math.random() * NOTES.length)], 0.6); // soft echo
    if (Math.random() < 0.15) this.pluck(now, note / 2, 0.5); // occasional low warm note
    this.timer = window.setTimeout(() => this.scheduleNext(), 900 + Math.random() * 1300);
  }

  async start() {
    this.ensureContext();
    try {
      await this.ctx!.resume();
    } catch {
      /* blocked until gesture */
    }
    if (this.ctx!.state !== "running") {
      if (!this.armed) {
        this.armed = true;
        const arm = () => {
          this.armed = false;
          if (localStorage.getItem(PREF_KEY) !== "off") void this.start();
        };
        window.addEventListener("pointerdown", arm, { once: true });
        window.addEventListener("keydown", arm, { once: true });
      }
      return;
    }
    if (this.playing) return;
    this.playing = true;
    this.scheduleNext();
  }

  stop() {
    this.playing = false;
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
    void this.ctx?.suspend().catch(() => {});
  }
}

const musicBox = new MusicBox();

/** Mount in any page root: autostarts (unless muted before) + returns a toggle. */
export function useBackgroundMusic() {
  const [enabled, setEnabled] = useState(localStorage.getItem(PREF_KEY) !== "off");

  useEffect(() => {
    if (enabled) void musicBox.start();
    return () => musicBox.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(PREF_KEY, next ? "on" : "off");
    if (next) void musicBox.start();
    else musicBox.stop();
  };

  return { enabled, toggle };
}
