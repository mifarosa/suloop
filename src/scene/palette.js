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

/** Neon Gece: the same twelve hues, lit up, to glow on a dark night. */
export const NEON_COLORS = [
  '#ff3864', // red
  '#3d7bff', // blue
  '#2bff88', // green
  '#ffe94d', // yellow
  '#b14dff', // purple
  '#ff8a1f', // orange
  '#ff4fd8', // pink
  '#19f0e0', // teal
  '#d9a066', // brown, as warm sand
  '#e4e8ff', // gray, as white light
  '#c6ff1a', // lime
  '#5b4bff' // navy, as indigo
];

/** Kokteyl Bar: the same hues as drinks, warmer, for a bar's amber light. */
export const COCKTAIL_COLORS = [
  '#e63946', // strawberry daiquiri
  '#1e90ff', // blue curaçao
  '#52b788', // mojito
  '#ffd166', // lemonade
  '#9d4edd', // grape
  '#f77f00', // spritz
  '#ff6fae', // cosmopolitan
  '#2ec4b6', // blue lagoon
  '#7f4f24', // cola
  '#efe6d2', // piña colada
  '#a7c957', // lime
  '#5a189a' // blackberry
];

/** Confetti: the brightest colors of a palette, so it matches the tubes it celebrates. */
export function confettiColors(palette = LIQUID_COLORS) {
  return [0, 1, 2, 3, 4, 5, 6, 7, 10].map((color) => palette[color]);
}

export const CONFETTI_COLORS = confettiColors();
