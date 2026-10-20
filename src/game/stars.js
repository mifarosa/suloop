/**
 * Stars for a solved puzzle, by how close the player came to the fewest moves: three for the
 * fewest (or one more in a long puzzle), two for a few more, one for any solution.
 */

export const MAX_STARS = 3;

/** From this many fewest moves on, one move over the fewest still earns three stars. */
const LONG_PUZZLE = 10;

/** The most moves that still earn three stars: the fewest, and one more in a long puzzle. */
export function threeStarLimit(fewest) {
  return fewest >= LONG_PUZZLE ? fewest + 1 : fewest;
}

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
  if (moves <= threeStarLimit(fewest)) return 3;
  if (moves <= twoStarLimit(fewest)) return 2;
  return 1;
}
