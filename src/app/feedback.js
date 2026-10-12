import { SoundBoard } from './sound.js';

/** Vibration patterns, in milliseconds: vibrate, pause, vibrate… */
const VIBRATIONS = {
  pick: 8,
  reject: [25, 40, 25],
  pour: 12,
  capOn: [14, 50, 22],
  undo: 10,
  hint: 8,
  win: [20, 70, 20, 70, 45]
};

/**
 * What the player hears and feels as they play: sounds and, on phones that can, a light
 * vibration. Each can be turned off in the settings.
 */
export class Feedback {
  #sound;
  #haptics = true;
  #canVibrate;

  /**
   * @param {object} [options]
   * @param {SoundBoard} [options.sound]
   * @param {(pattern: number | number[]) => void} [options.vibrate]
   */
  constructor({
    sound = new SoundBoard(),
    vibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
      ? (pattern) => navigator.vibrate(pattern)
      : null
  } = {}) {
    this.#sound = sound;
    this.#canVibrate = vibrate;
  }

  /** Whether this device can vibrate at all. */
  get canVibrate() {
    return this.#canVibrate !== null;
  }

  /** @param {{ sound: boolean, haptics: boolean }} settings */
  configure({ sound, haptics }) {
    this.#sound.setEnabled(sound);
    this.#haptics = haptics;
  }

  /** Call on every tap: browsers only start audio from one. */
  unlock() {
    this.#sound.unlock();
  }

  pick() {
    this.#sound.pick();
    this.#vibrate('pick');
  }

  putDown() {
    this.#sound.putDown();
  }

  reject() {
    this.#sound.reject();
    this.#vibrate('reject');
  }

  undo() {
    this.#sound.undo();
    this.#vibrate('undo');
  }

  hint() {
    this.#sound.hint();
    this.#vibrate('hint');
  }

  win() {
    this.#sound.win();
    this.#vibrate('win');
  }

  /**
   * Something the scene shows, at the moment it shows it.
   * @param {{ type: 'flow', duration: number, amount: number } | { type: 'capOn' | 'capOff' | 'melt' }} cue
   *   duration in milliseconds
   */
  cue(cue) {
    switch (cue.type) {
      case 'flow':
        this.#sound.pour(cue.duration / 1000, cue.amount);
        this.#vibrate('pour');
        break;
      case 'capOn':
        this.#sound.capOn();
        this.#vibrate('capOn');
        break;
      case 'capOff':
        this.#sound.capOff();
        break;
      case 'melt':
        this.#sound.melt();
        break;
    }
  }

  #vibrate(name) {
    if (this.#haptics && this.#canVibrate) this.#canVibrate(VIBRATIONS[name]);
  }
}
