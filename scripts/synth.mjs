/**
 * The sounds of the game, worked out sample by sample: the same sounds the website makes with
 * Web Audio (src/app/sound.js), with the same pitches, lengths and volumes, so the app can
 * play them as small files. Run `npm run sounds` (scripts/renderSounds.mjs) to write them.
 */

export const SAMPLE_RATE = 22050;
const MASTER = 0.6;
const FLOOR = 0.0001;

function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A buffer of silence long enough for `seconds`, to mix sounds into. */
function silence(seconds) {
  return new Float32Array(Math.ceil(seconds * SAMPLE_RATE));
}

/** Fades in over a few milliseconds and out by the end, so nothing clicks. */
function envelopeAt(t, duration, volume) {
  const attack = Math.min(0.012, duration / 3);
  if (t < 0 || t > duration) return 0;
  if (t < attack) return FLOOR * (volume / FLOOR) ** (t / attack);
  return volume * (FLOOR / volume) ** ((t - attack) / (duration - attack));
}

function wave(type, phase) {
  if (type === 'triangle') return (2 / Math.PI) * Math.asin(Math.sin(phase));
  return Math.sin(phase);
}

/** A short wave gliding from one pitch to another. */
function chirp(out, at, from, to, duration, volume, type = 'sine') {
  const start = Math.round(at * SAMPLE_RATE);
  const length = Math.round((duration + 0.02) * SAMPLE_RATE);
  let phase = 0;
  for (let i = 0; i < length && start + i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    const frequency = from * (to / from) ** Math.min(t / duration, 1);
    phase += (2 * Math.PI * frequency) / SAMPLE_RATE;
    out[start + i] += wave(type, phase) * envelopeAt(t, duration, volume);
  }
}

const tone = (out, at, frequency, duration, volume, type) =>
  chirp(out, at, frequency, frequency, duration, volume, type);

/** A two pole filter (RBJ): `kind` is 'bandpass' or 'highpass'. */
function biquad(kind, frequency, q) {
  const w = (2 * Math.PI * Math.min(frequency, SAMPLE_RATE * 0.45)) / SAMPLE_RATE;
  const alpha = Math.sin(w) / (2 * q);
  const cos = Math.cos(w);
  let b0, b1, b2;
  if (kind === 'bandpass') {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
  } else {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = (1 + cos) / 2;
  }
  const a0 = 1 + alpha;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 };
}

/** Noise through a filter whose pitch moves, with a volume envelope; returns what it made. */
function filteredNoise(random, seconds, { kind, q, from, to, exponential, volume, wobble = 0 }) {
  const out = silence(seconds + 0.02);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    const progress = Math.min(t / seconds, 1);
    const frequency = exponential ? from * (to / from) ** progress : from + (to - from) * progress;
    const c = biquad(kind, frequency, q);
    const x0 = random() * 2 - 1;
    const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    const wobbleGain = wobble ? wobble * Math.sin(2 * Math.PI * 14 * t) : 0;
    out[i] = y0 * Math.max(0, envelopeAt(t, seconds, volume) + wobbleGain);
  }
  return out;
}

function mixIn(out, at, source) {
  const start = Math.round(at * SAMPLE_RATE);
  for (let i = 0; i < source.length && start + i < out.length; i++) out[start + i] += source[i];
}

/** A tiny burst of bright noise. */
function click(out, random, at, volume, frequency) {
  mixIn(
    out,
    at,
    filteredNoise(random, 0.025, {
      kind: 'highpass',
      q: 0.7071,
      from: frequency,
      to: frequency,
      exponential: true,
      volume
    })
  );
}

const make = (seconds, build, seed) => {
  const out = silence(seconds);
  build(out, randomSource(seed));
  for (let i = 0; i < out.length; i++) out[i] *= MASTER;
  return out;
};

/** Seconds a pour of `amount` units runs, as in src/scene/pour.js. */
export const pourSeconds = (amount) => (160 + 120 * amount) / 1000;

/** @returns {Record<string, Float32Array>} every sound, by name */
export function renderSounds() {
  const sounds = {
    pick: make(0.1, (out) => chirp(out, 0.005, 880, 620, 0.06, 0.18), 1),
    putDown: make(0.1, (out) => chirp(out, 0.005, 560, 420, 0.06, 0.12), 2),
    reject: make(
      0.3,
      (out) => {
        chirp(out, 0.005, 180, 120, 0.12, 0.2, 'triangle');
        chirp(out, 0.075, 160, 110, 0.1, 0.12, 'triangle');
      },
      3
    ),
    capOn: make(
      0.2,
      (out, random) => {
        chirp(out, 0.005, 260, 150, 0.09, 0.3);
        click(out, random, 0.005, 0.12, 3000);
      },
      4
    ),
    capOff: make(0.15, (out) => chirp(out, 0.005, 320, 720, 0.08, 0.18), 5),
    melt: make(
      0.4,
      (out, random) => {
        for (let i = 0; i < 5; i++)
          click(out, random, 0.005 + i * 0.045 + random() * 0.02, 0.08, 4500);
      },
      6
    ),
    undo: make(
      0.3,
      (out, random) =>
        mixIn(
          out,
          0.005,
          filteredNoise(random, 0.22, {
            kind: 'bandpass',
            q: 2,
            from: 2200,
            to: 500,
            exponential: true,
            volume: 0.12
          })
        ),
      7
    ),
    hint: make(
      0.4,
      (out) => {
        tone(out, 0.005, 1320, 0.12, 0.07);
        tone(out, 0.095, 1760, 0.16, 0.07);
      },
      8
    ),
    win: make(
      1.3,
      (out) => {
        [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) =>
          tone(out, 0.005 + i * 0.11, frequency, 0.5, 0.12, 'triangle')
        );
        tone(out, 0.445, 1567.98, 0.7, 0.05);
      },
      9
    )
  };
  // Liquid running into a tube, one sound for each amount of units; longer for more.
  for (let amount = 1; amount <= 5; amount++) {
    const seconds = pourSeconds(amount);
    sounds[`pour${amount}`] = make(
      seconds + 0.1,
      (out, random) => {
        mixIn(
          out,
          0.005,
          filteredNoise(random, seconds, {
            kind: 'bandpass',
            q: 1.4,
            from: 700,
            to: 1300,
            exponential: false,
            volume: 0.16,
            wobble: 0.05
          })
        );
        const bubbles = Math.round(3 + amount * 3);
        for (let i = 0; i < bubbles; i++) {
          const t = (i + random() * 0.8) / bubbles;
          const pitch = 320 + 520 * t + random() * 60;
          chirp(out, 0.005 + t * seconds, pitch, pitch * 1.6, 0.05, 0.05);
        }
      },
      20 + amount
    );
  }
  return sounds;
}

/** A mono 16-bit WAV file for the samples. */
export function toWav(samples) {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset, value) =>
    [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => {
    view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true);
  });
  return bytes;
}
