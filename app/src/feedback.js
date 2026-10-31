import * as Haptics from 'expo-haptics';

/** The feel of the game on a phone: a light tap for most things, a stronger one for a win. */
export function createFeedback() {
  let haptics = true;
  const feel = (action) => () => {
    if (haptics) action();
  };
  return {
    configure: (settings) => {
      haptics = settings.haptics;
    },
    pick: feel(() => Haptics.selectionAsync()),
    putDown: () => {},
    reject: feel(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
    undo: feel(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
    hint: feel(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
    win: feel(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
  };
}
