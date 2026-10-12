/**
 * Liquid colors, indexed by the color ids used in puzzles. They are picked to stay easy to
 * tell apart on both the dark and the light background.
 */
export const LIQUID_COLORS = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#22c55e', // green
  '#eab308', // yellow
  '#a855f7', // purple
  '#f97316', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
  '#92400e', // brown
  '#94a3b8', // gray
  '#84cc16', // lime
  '#1e3a8a' // navy
];

/** A unit whose color the player has not seen yet: a dark, neutral fill with a question mark. */
export const HIDDEN_COLOR = '#3b4260';
export const HIDDEN_MARK_COLOR = '#c9d1ee';

/** Frost over a locked tube, and the ink of the padlock drawn on its key color. */
export const ICE_COLOR = 'rgba(190, 225, 255, 0.55)';
export const LOCK_INK = '#0b1430';

/** Confetti: the brightest liquid colors, so it matches the tubes it celebrates. */
export const CONFETTI_COLORS = [0, 1, 2, 3, 4, 5, 6, 7, 10].map((color) => LIQUID_COLORS[color]);
