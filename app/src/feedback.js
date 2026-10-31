import * as Haptics from 'expo-haptics';

/** The feel of the game on a phone: a light tap for most things, a stronger one for a win. */
export const feedback = {
  pick: () => Haptics.selectionAsync(),
  putDown: () => {},
  reject: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  undo: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  hint: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  win: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
};
