import * as Haptics from 'expo-haptics';
import { NativeSound } from './sounds.js';

/**
 * What the player hears and feels as they play: a sound and a light buzz for each thing,
 * as the website's Feedback (src/app/feedback.js) does. Each can be turned off in the settings.
 */
export function createFeedback({ sound = new NativeSound() } = {}) {
  let haptics = true;
  const feel = (action) => {
    if (!haptics) return;
    try {
      Promise.resolve(action()).catch(() => {});
    } catch {
      // Phones without a vibration motor say so by throwing; the game goes on.
    }
  };
  const light = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  return {
    /** @param {{ sound: boolean, haptics: boolean }} settings */
    configure(settings) {
      sound.setEnabled(settings.sound);
      haptics = settings.haptics;
    },
    pick() {
      sound.play('pick');
      feel(() => Haptics.selectionAsync());
    },
    putDown() {
      sound.play('putDown');
    },
    reject() {
      sound.play('reject');
      feel(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
    },
    undo() {
      sound.play('undo');
      feel(light);
    },
    hint() {
      sound.play('hint');
      feel(light);
    },
    win() {
      sound.play('win');
      feel(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    },
    /**
     * Something the scene shows, at the moment it shows it.
     * @param {{ type: 'flow', duration: number, amount: number } | { type: 'capOn' | 'capOff' | 'melt' }} cue
     *   duration in milliseconds
     */
    cue(cue) {
      switch (cue.type) {
        case 'flow': {
          sound.pour(cue.amount);
          // A soft patter for as long as the liquid runs.
          const beats = Math.max(2, Math.min(6, Math.round(cue.duration / 110)));
          for (let i = 0; i < beats; i++) setTimeout(() => feel(light), (i * cue.duration) / beats);
          break;
        }
        case 'capOn':
          sound.play('capOn');
          feel(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
          break;
        case 'capOff':
          sound.play('capOff');
          break;
        case 'melt':
          sound.play('melt');
          feel(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));
          break;
      }
    }
  };
}
