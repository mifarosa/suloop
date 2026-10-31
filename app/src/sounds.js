import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

// Metro needs every file named in the code, so each sound is listed here.
const FILES = {
  pick: require('../assets/sounds/pick.wav'),
  putDown: require('../assets/sounds/putDown.wav'),
  reject: require('../assets/sounds/reject.wav'),
  capOn: require('../assets/sounds/capOn.wav'),
  capOff: require('../assets/sounds/capOff.wav'),
  melt: require('../assets/sounds/melt.wav'),
  undo: require('../assets/sounds/undo.wav'),
  hint: require('../assets/sounds/hint.wav'),
  win: require('../assets/sounds/win.wav'),
  pour1: require('../assets/sounds/pour1.wav'),
  pour2: require('../assets/sounds/pour2.wav'),
  pour3: require('../assets/sounds/pour3.wav'),
  pour4: require('../assets/sounds/pour4.wav'),
  pour5: require('../assets/sounds/pour5.wav')
};

/** Players made for each sound, taken in turn so a sound can start while its last still rings. */
const VOICES = 2;

/**
 * The sounds of the game (src/app/sound.js has them for the website), played from the small
 * files that scripts/renderSounds.mjs writes.
 */
export class NativeSound {
  #players = new Map();
  #turns = new Map();
  #enabled = true;

  constructor() {
    // Quiet when the phone is on silent, and politely beside the music the player has on.
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(
      () => {}
    );
  }

  /** @param {boolean} enabled */
  setEnabled(enabled) {
    this.#enabled = enabled;
  }

  /** @param {string} name one of the sounds above */
  play(name) {
    if (!this.#enabled || !FILES[name]) return;
    try {
      const player = this.#next(name);
      player.seekTo(0);
      player.play();
    } catch {
      // A sound that cannot play must never get in the way of the game.
    }
  }

  /** The sound of liquid running into a tube; the amount picks how long it lasts. */
  pour(amount) {
    this.play(`pour${Math.min(5, Math.max(1, Math.round(amount)))}`);
  }

  #next(name) {
    let players = this.#players.get(name);
    if (!players) {
      players = Array.from({ length: VOICES }, () => createAudioPlayer(FILES[name]));
      this.#players.set(name, players);
      this.#turns.set(name, 0);
    }
    const turn = this.#turns.get(name);
    this.#turns.set(name, (turn + 1) % VOICES);
    return players[turn];
  }
}
