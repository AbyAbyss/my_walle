import type { Animation } from "./animation";

const MASTER_GAIN = 0.16;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);
  }
  return ctx;
}

async function resumeIfNeeded(): Promise<void> {
  const c = getCtx();
  if (c.state === "suspended") {
    await c.resume().catch(() => {});
  }
}

function now(): number {
  return getCtx().currentTime;
}

/** Rising sine “tweet” burst — one syllable. */
function duduSyllable(t0: number, baseHz: number) {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  const dur = 0.055;
  osc.frequency.setValueAtTime(baseHz * 0.75, t0);
  osc.frequency.exponentialRampToValueAtTime(baseHz * 1.65, t0 + dur * 0.92);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(master!);
  osc.start(t0);
  osc.stop(t0 + dur + 0.015);
}

/** Soft noise grain behind long chirps (very quiet). */
function duduNoiseGrain(t0: number, dur: number) {
  const c = getCtx();
  const bufSize = c.sampleRate * dur;
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.35;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2400;
  bp.Q.value = 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.04, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(master!);
  src.start(t0);
  src.stop(t0 + dur);
}

export function playDuduShort(enabled: boolean, syllables: number): void {
  if (!enabled) return;
  void resumeIfNeeded().then(() => {
    const n = Math.max(1, Math.min(3, Math.floor(syllables)));
    const t0 = now();
    const bases = [1750, 2100, 1550];
    for (let i = 0; i < n; i++) {
      duduSyllable(t0 + i * 0.095, bases[i % bases.length]!);
    }
  });
}

export function playDuduLong(enabled: boolean): void {
  if (!enabled) return;
  void resumeIfNeeded().then(() => {
    const t0 = now();
    const pattern = [0, 0.1, 0.2, 0.32, 0.44];
    const bases = [1650, 1950, 1800, 2200, 1700];
    pattern.forEach((off, i) => {
      duduSyllable(t0 + off, bases[i]!);
    });
    duduNoiseGrain(t0, 0.38);
  });
}

function robotBeep(
  t0: number,
  freq: number,
  dur: number,
  type: OscillatorType = "square",
) {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  const filt = c.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = 3200;
  filt.Q.value = 0.7;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.14, t0 + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(filt);
  filt.connect(gain);
  gain.connect(master!);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function robotSweep(t0: number, f0: number, f1: number, dur: number) {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  const filt = c.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = 4000;
  osc.type = "triangle";
  osc.frequency.setValueAtTime(f0, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(filt);
  filt.connect(gain);
  gain.connect(master!);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** One-shot SFX for WALLE mascot animations. */
export function playWalleAnimation(enabled: boolean, animation: Animation): void {
  if (!enabled || animation === "none" || animation === "hover_look") return;
  void resumeIfNeeded().then(() => {
    const t0 = now();
    switch (animation) {
      case "pet": {
        robotBeep(t0, 660, 0.07);
        robotBeep(t0 + 0.1, 880, 0.08);
        break;
      }
      case "dance": {
        const notes = [523, 659, 784, 880, 1046];
        notes.forEach((hz, i) => robotBeep(t0 + i * 0.09, hz, 0.065, "square"));
        break;
      }
      case "wave": {
        robotSweep(t0, 400, 900, 0.14);
        break;
      }
      case "thumbs_up": {
        robotBeep(t0, 520, 0.06);
        robotBeep(t0 + 0.07, 780, 0.09, "triangle");
        break;
      }
      case "confused": {
        robotBeep(t0, 300, 0.1);
        robotBeep(t0 + 0.14, 280, 0.12);
        break;
      }
      case "excited_run": {
        for (let i = 0; i < 6; i++) {
          robotBeep(t0 + i * 0.055, 600 + i * 90, 0.04);
        }
        break;
      }
      case "stretch": {
        robotSweep(t0, 220, 520, 0.18);
        robotBeep(t0 + 0.2, 600, 0.07);
        break;
      }
      default:
        break;
    }
  });
}
