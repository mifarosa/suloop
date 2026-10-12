/**
 * Soft, short sounds made on the spot with the Web Audio API, so there is nothing to
 * download: a pop when a tube is picked up, liquid that gurgles and rises in pitch as it
 * fills a tube, the "tok" of a cap, a chime for a win. Everything stays quiet and brief.
 *
 * Browsers let audio start only after a tap, so the context is created on the first
 * `unlock()`, which the page calls on every tap.
 */
export class SoundBoard {
  #context = null;
  #master = null;
  #noise = null;
  #enabled = true;

  /** @param {boolean} enabled */
  setEnabled(enabled) {
    this.#enabled = enabled;
  }

  /** Wakes the audio up; call it from a tap. */
  unlock() {
    if (!this.#enabled) return;
    const context = this.#ensureContext();
    if (context?.state === 'suspended') context.resume().catch(() => {});
  }

  /** A soft pop: a tube is picked up. */
  pick() {
    this.#play((at) => this.#chirp(at, 880, 620, 0.06, 0.18));
  }

  /** A lower pop: a tube is put back down. */
  putDown() {
    this.#play((at) => this.#chirp(at, 560, 420, 0.06, 0.12));
  }

  /** A dull knock: that move is not allowed. */
  reject() {
    this.#play((at) => {
      this.#chirp(at, 180, 120, 0.12, 0.2, 'triangle');
      this.#chirp(at + 0.07, 160, 110, 0.1, 0.12, 'triangle');
    });
  }

  /**
   * Liquid running into a tube: a gurgle of filtered noise, with bubbles that rise in pitch
   * as the tube fills.
   * @param {number} duration seconds
   * @param {number} amount units poured
   */
  pour(duration, amount) {
    this.#play((at) => {
      const context = this.#context;
      const source = context.createBufferSource();
      source.buffer = this.#noiseBuffer();
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.4;
      filter.frequency.setValueAtTime(700, at);
      filter.frequency.linearRampToValueAtTime(1300, at + duration);
      const gain = context.createGain();
      envelope(gain.gain, at, duration, 0.16);
      // A quick wobble in the volume is what makes noise sound like running water.
      const wobble = context.createOscillator();
      wobble.frequency.value = 14;
      const depth = context.createGain();
      depth.gain.value = 0.05;
      wobble.connect(depth).connect(gain.gain);
      source.connect(filter).connect(gain).connect(this.#master);
      source.start(at);
      source.stop(at + duration + 0.05);
      wobble.start(at);
      wobble.stop(at + duration + 0.05);

      const bubbles = Math.round(3 + amount * 3);
      for (let i = 0; i < bubbles; i++) {
        const t = (i + Math.random() * 0.8) / bubbles;
        const pitch = 320 + 520 * t + Math.random() * 60;
        this.#chirp(at + t * duration, pitch, pitch * 1.6, 0.05, 0.05);
      }
    });
  }

  /** A cork going in: a short low "tok" and a click. */
  capOn() {
    this.#play((at) => {
      this.#chirp(at, 260, 150, 0.09, 0.3);
      this.#click(at, 0.12, 3000);
    });
  }

  /** A cork coming out: a rising pop. */
  capOff() {
    this.#play((at) => this.#chirp(at, 320, 720, 0.08, 0.18));
  }

  /** Ice cracking off a tube. */
  melt() {
    this.#play((at) => {
      for (let i = 0; i < 5; i++) this.#click(at + i * 0.045 + Math.random() * 0.02, 0.08, 4500);
    });
  }

  /** A soft whoosh backwards. */
  undo() {
    this.#play((at) => {
      const context = this.#context;
      const source = context.createBufferSource();
      source.buffer = this.#noiseBuffer();
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 2;
      filter.frequency.setValueAtTime(2200, at);
      filter.frequency.exponentialRampToValueAtTime(500, at + 0.22);
      const gain = context.createGain();
      envelope(gain.gain, at, 0.22, 0.12);
      source.connect(filter).connect(gain).connect(this.#master);
      source.start(at);
      source.stop(at + 0.25);
    });
  }

  /** Two light, high notes. */
  hint() {
    this.#play((at) => {
      this.#tone(at, 1320, 0.12, 0.07);
      this.#tone(at + 0.09, 1760, 0.16, 0.07);
    });
  }

  /** A rising chime. */
  win() {
    this.#play((at) => {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) =>
        this.#tone(at + i * 0.11, frequency, 0.5, 0.12, 'triangle')
      );
      this.#tone(at + 0.44, 1567.98, 0.7, 0.05);
    });
  }

  /** Runs `make` with the time to start at, if sound is on and possible. */
  #play(make) {
    if (!this.#enabled) return;
    const context = this.#ensureContext();
    if (!context || context.state !== 'running') return;
    make(context.currentTime + 0.005);
  }

  #ensureContext() {
    if (this.#context) return this.#context;
    const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      this.#context = new AudioContextClass();
    } catch {
      return null;
    }
    this.#master = this.#context.createGain();
    this.#master.gain.value = 0.6;
    this.#master.connect(this.#context.destination);
    return this.#context;
  }

  /** A short sine (or other wave) gliding from one pitch to another. */
  #chirp(at, from, to, duration, volume, type = 'sine') {
    const context = this.#context;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, at);
    oscillator.frequency.exponentialRampToValueAtTime(to, at + duration);
    const gain = context.createGain();
    envelope(gain.gain, at, duration, volume);
    oscillator.connect(gain).connect(this.#master);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  }

  /** A held note with a soft attack and a long fade. */
  #tone(at, frequency, duration, volume, type = 'sine') {
    this.#chirp(at, frequency, frequency, duration, volume, type);
  }

  /** A tiny burst of bright noise. */
  #click(at, volume, frequency) {
    const context = this.#context;
    const source = context.createBufferSource();
    source.buffer = this.#noiseBuffer();
    const filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = frequency;
    const gain = context.createGain();
    envelope(gain.gain, at, 0.025, volume);
    source.connect(filter).connect(gain).connect(this.#master);
    source.start(at, Math.random() * 0.5);
    source.stop(at + 0.04);
  }

  /** One second of white noise, made once. */
  #noiseBuffer() {
    if (this.#noise) return this.#noise;
    const context = this.#context;
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.#noise = buffer;
    return buffer;
  }
}

/** Fades in over a few milliseconds and out by the end, so nothing clicks. */
function envelope(param, at, duration, volume) {
  param.setValueAtTime(0.0001, at);
  param.exponentialRampToValueAtTime(volume, at + Math.min(0.012, duration / 3));
  param.exponentialRampToValueAtTime(0.0001, at + duration);
}
