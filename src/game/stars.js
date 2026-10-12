/**
 * Stars for a solved puzzle, by how close the player came to the fewest moves: three for the
 * fewest, two for a few more, one for any solution.
 */

export const MAX_STARS = 3;

/** The most moves that still earn two stars: the fewest plus a fifth, and at least two more. */
export function twoStarLimit(fewest) {
  return fewest + Math.max(2, Math.ceil(fewest / 5));
}

/**
 * @param {number} moves the player's moves
 * @param {number} fewest the fewest moves that solve the puzzle
 * @returns {1 | 2 | 3}
 */
export function starsFor(moves, fewest) {
  if (moves <= fewest) return 3;
  if (moves <= twoStarLimit(fewest)) return 2;
  return 1;
}
