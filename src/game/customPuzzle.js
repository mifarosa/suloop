import { CRACKED_TUBE_FILLS } from './generator.js';
import { Board, HALF_TUBE_SIZE, TALL_TUBE_CAPACITY, TUBE_CAPACITY } from './rules.js';
import { bestOfTries, solveShortest } from './shortest.js';
import { solve } from './solver.js';

// A custom puzzle may have no solution at all, and a search for the shortest one would then
// go through every position it can reach; a quick search for any solution goes first, and
// both stay small.
const ANY_SOLUTION_LIMIT = 200_000;
const SHORTEST_SOLUTION_LIMIT = 120_000;

/**
 * Puzzles players make themselves in the editor, and the codes that carry them.
 *
 * A custom puzzle lists its tubes in order, each with its kind, its colors (bottom first) and
 * the key color of its lock, if any. Every color it uses has `capacity` units, as in the
 * levels; oil colors float, so the editor keeps every tube's oil on top of its water.
 *
 * @typedef {'plain' | 'half' | 'oneWay' | 'cracked'} TubeKind
 * @typedef {{ kind: TubeKind, colors: number[], lock: number | null }} CustomTube
 * @typedef {object} CustomPuzzle
 * @property {number} capacity units of each color: 4, or 5 for tall tubes
 * @property {CustomTube[]} tubes
 * @property {number[]} oil colors that are oil
 * @property {boolean} hidden whether only the top unit of each tube shows at first
 * @property {number | null} undoLimit null for no limit
 */

export const TUBE_KINDS = Object.freeze(['plain', 'half', 'oneWay', 'cracked']);
/** Colors a custom puzzle can use: as many as the hardest levels. */
export const CUSTOM_COLOR_COUNT = 10;
export const MAX_TUBES = 16;
export const UNDO_LIMITS = Object.freeze([null, 5, 4, 3, 2, 1, 0]);
const CODE_VERSION = 1;
const KIND_LETTERS = { plain: 'p', half: 'h', oneWay: 'o', cracked: 'c' };

/** An empty puzzle of `count` plain tubes. */
export function emptyPuzzle(count = 5) {
  return {
    capacity: TUBE_CAPACITY,
    tubes: Array.from({ length: count }, () => tube('plain')),
    oil: [],
    hidden: false,
    undoLimit: null
  };
}

/** How many units a tube of the puzzle holds. */
export function sizeOf(puzzle, { kind }) {
  return kind === 'half' ? HALF_TUBE_SIZE : puzzle.capacity;
}

/** Units of each color on the board, by color. */
export function colorCounts(puzzle) {
  const counts = new Map();
  for (const { colors } of puzzle.tubes) {
    for (const color of colors) counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  return counts;
}

/**
 * Adds a unit of `color` to a tube, where liquid poured in would end up: oil on top, water
 * under any oil.
 * @returns {CustomPuzzle | null} null when the tube is full
 */
export function withUnitAdded(puzzle, index, color) {
  const target = puzzle.tubes[index];
  if (!target || target.colors.length >= sizeOf(puzzle, target)) return null;
  const colors = target.colors.slice();
  const isOil = puzzle.oil.includes(color);
  let at = colors.length;
  if (!isOil) while (at > 0 && puzzle.oil.includes(colors[at - 1])) at--;
  colors.splice(at, 0, color);
  return replaceTube(puzzle, index, { ...target, colors });
}

/** Takes the top unit off a tube. @returns {CustomPuzzle | null} null when it is empty */
export function withUnitRemoved(puzzle, index) {
  const target = puzzle.tubes[index];
  if (!target || target.colors.length === 0) return null;
  return replaceTube(puzzle, index, { ...target, colors: target.colors.slice(0, -1) });
}

/**
 * Locks a plain tube with `color` as its key, or unlocks it when that is its key already.
 * @returns {CustomPuzzle | null} null for a tube that cannot be locked
 */
export function withLockToggled(puzzle, index, color) {
  const target = puzzle.tubes[index];
  if (!target || target.kind !== 'plain') return null;
  return replaceTube(puzzle, index, { ...target, lock: target.lock === color ? null : color });
}

/** Makes `color` oil or water again; the oil in every tube rises to the top. */
export function withOilToggled(puzzle, color) {
  const oil = puzzle.oil.includes(color)
    ? puzzle.oil.filter((other) => other !== color)
    : [...puzzle.oil, color].sort((a, b) => a - b);
  return floatOil({ ...puzzle, oil });
}

/** Adds an empty tube of the given kind at the end. @returns {CustomPuzzle | null} */
export function withTubeAdded(puzzle, kind) {
  if (puzzle.tubes.length >= MAX_TUBES || !TUBE_KINDS.includes(kind)) return null;
  return { ...puzzle, tubes: [...puzzle.tubes, tube(kind)] };
}

/** Removes a tube. @returns {CustomPuzzle | null} null when two or fewer are left */
export function withTubeRemoved(puzzle, index) {
  if (puzzle.tubes.length <= 2 || !puzzle.tubes[index]) return null;
  return { ...puzzle, tubes: puzzle.tubes.filter((_, i) => i !== index) };
}

/** Switches between tubes of 4 and tall tubes of 5; liquid that no longer fits is dropped. */
export function withCapacity(puzzle, capacity) {
  const resized = { ...puzzle, capacity };
  return {
    ...resized,
    tubes: puzzle.tubes.map((t) => ({ ...t, colors: t.colors.slice(0, sizeOf(resized, t)) }))
  };
}

/**
 * Deals `colorCount` colors at random into the plain tubes and empties the others. Plain
 * tubes are added when there are too few, so two tubes are left over to pour into (as far as
 * the tube limit allows). No tube starts complete.
 * @param {() => number} random
 */
export function withRandomFill(puzzle, colorCount, random) {
  const tubes = puzzle.tubes.map((t) => ({ ...t, colors: [] }));
  while (tubes.length < Math.min(colorCount + 2, MAX_TUBES)) tubes.push(tube('plain'));
  const plain = tubes.filter((t) => t.kind === 'plain').length;
  const count = Math.min(colorCount, plain, CUSTOM_COLOR_COUNT);

  const capacity = puzzle.capacity;
  for (let attempt = 0; attempt < 50; attempt++) {
    const units = [];
    for (let color = 0; color < count; color++) {
      for (let i = 0; i < capacity; i++) units.push(color);
    }
    for (let i = units.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [units[i], units[j]] = [units[j], units[i]];
    }
    let next = 0;
    const filled = tubes.map((t) => {
      if (t.kind !== 'plain' || next >= count) return { ...t, colors: [] };
      const colors = units.slice(next * capacity, (next + 1) * capacity);
      next++;
      return { ...t, colors };
    });
    const dealt = floatOil({
      ...puzzle,
      tubes: filled,
      oil: puzzle.oil.filter((color) => color < count)
    });
    if (!dealt.tubes.some((t) => t.colors.length > 0 && isComplete(dealt, t))) return dealt;
  }
  return floatOil({ ...puzzle, tubes, oil: puzzle.oil.filter((color) => color < count) });
}

/**
 * What keeps a puzzle from being played, if anything.
 * @returns {Array<{ code: string, color?: number, count?: number, tube?: number }>}
 */
export function problemsOf(puzzle) {
  const problems = [];
  const counts = colorCounts(puzzle);
  if (counts.size < 2) problems.push({ code: 'tooFewColors' });
  for (const [color, count] of [...counts].sort((a, b) => a[0] - b[0])) {
    if (count !== puzzle.capacity) problems.push({ code: 'colorCount', color, count });
  }
  puzzle.tubes.forEach((t, index) => {
    if (t.lock === null) return;
    if (!counts.has(t.lock)) problems.push({ code: 'lockKeyMissing', tube: index });
    else if (t.colors.includes(t.lock)) problems.push({ code: 'lockKeyInside', tube: index });
  });
  if (
    problems.length === 0 &&
    puzzle.tubes.every((t) => t.colors.length === 0 || isComplete(puzzle, t))
  ) {
    problems.push({ code: 'alreadySolved' });
  }
  return problems;
}

/**
 * The tubes and the rules of a custom puzzle, as the game plays them.
 * @returns {{ tubes: number[][], board: Board }}
 */
export function boardOf(puzzle) {
  const locks = {};
  const cracked = {};
  const oneWay = [];
  puzzle.tubes.forEach((t, index) => {
    if (t.lock !== null) locks[index] = t.lock;
    if (t.kind === 'cracked') cracked[index] = CRACKED_TUBE_FILLS;
    if (t.kind === 'oneWay') oneWay.push(index);
  });
  const halves = puzzle.tubes.some((t) => t.kind === 'half');
  return {
    tubes: puzzle.tubes.map((t) => t.colors.slice()),
    board: new Board({
      capacity: puzzle.capacity,
      sizes: halves ? puzzle.tubes.map((t) => sizeOf(puzzle, t)) : null,
      oilColors: puzzle.oil,
      oneWay,
      cracked,
      locks
    })
  };
}

/**
 * Whether a custom puzzle can be solved, and in how few moves.
 * @param {CustomPuzzle} puzzle
 * @returns {{ moves: number, proven: boolean } | null} null when no solution turned up, which
 *   for a very large puzzle may only mean the search gave up
 */
export function fewestMovesOf(puzzle) {
  const { tubes, board } = boardOf(puzzle);
  const any = solve(tubes, { board, maxNodes: ANY_SOLUTION_LIMIT });
  if (!any) return null;
  const shortest = solveShortest(tubes, { board, maxNodes: SHORTEST_SOLUTION_LIMIT });
  // Too big to search for the shortest: the best of a few tries, never longer than the first.
  if (!shortest) {
    const tries = bestOfTries(tubes, board, ANY_SOLUTION_LIMIT);
    return { moves: Math.min(any.length, tries?.moves ?? any.length), proven: false };
  }
  return { moves: shortest.length, proven: true };
}

/** The special rules a custom puzzle uses, by the names the levels use for them. */
export function rulesOf(puzzle) {
  const has = (kind) => puzzle.tubes.some((t) => t.kind === kind);
  return [
    puzzle.undoLimit !== null && 'limitedUndo',
    has('oneWay') && 'oneWayTube',
    puzzle.capacity === TALL_TUBE_CAPACITY && 'tallTubes',
    puzzle.hidden && 'hiddenColors',
    has('cracked') && 'crackedTube',
    puzzle.tubes.some((t) => t.lock !== null) && 'lockedTube',
    has('half') && 'halfTube',
    puzzle.oil.length > 0 && 'oil'
  ].filter(Boolean);
}

/**
 * A short code that carries a puzzle: its JSON, in URL-safe base64.
 * @param {CustomPuzzle} puzzle
 */
export function encodePuzzle(puzzle) {
  const data = {
    v: CODE_VERSION,
    c: puzzle.capacity,
    t: puzzle.tubes.map((t) => t.colors.map((color) => color.toString(36)).join('')),
    k: puzzle.tubes.map((t) => KIND_LETTERS[t.kind]).join('')
  };
  const locks = Object.fromEntries(
    puzzle.tubes.flatMap((t, index) => (t.lock === null ? [] : [[index, t.lock]]))
  );
  if (Object.keys(locks).length > 0) data.l = locks;
  if (puzzle.oil.length > 0) data.o = puzzle.oil;
  if (puzzle.hidden) data.h = 1;
  if (puzzle.undoLimit !== null) data.u = puzzle.undoLimit;
  return btoa(JSON.stringify(data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Reads a puzzle from a code, a link that holds one, or the JSON itself. Whatever comes in
 * is checked piece by piece, since anyone can write a code by hand.
 * @param {string} text
 * @returns {CustomPuzzle | null} null when it is not a puzzle
 */
export function decodePuzzle(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  const fromLink = trimmed.match(/[#&?]bulmaca=([\w-]+)/);
  let data;
  try {
    if (trimmed.startsWith('{')) data = JSON.parse(trimmed);
    else {
      const code = (fromLink ? fromLink[1] : trimmed).replace(/-/g, '+').replace(/_/g, '/');
      data = JSON.parse(atob(code));
    }
  } catch {
    return null;
  }
  return puzzleFromData(data);
}

function puzzleFromData(data) {
  if (!data || typeof data !== 'object' || data.v !== CODE_VERSION) return null;
  const capacity = data.c;
  if (capacity !== TUBE_CAPACITY && capacity !== TALL_TUBE_CAPACITY) return null;
  if (!Array.isArray(data.t) || typeof data.k !== 'string') return null;
  if (data.t.length < 2 || data.t.length > MAX_TUBES || data.k.length !== data.t.length)
    return null;

  const letters = Object.fromEntries(Object.entries(KIND_LETTERS).map(([kind, l]) => [l, kind]));
  const tubes = [];
  for (let i = 0; i < data.t.length; i++) {
    const kind = letters[data.k[i]];
    if (!kind || typeof data.t[i] !== 'string' || !/^[0-9a-z]*$/.test(data.t[i])) return null;
    const colors = [...data.t[i]].map((digit) => parseInt(digit, 36));
    if (colors.some((color) => color >= CUSTOM_COLOR_COUNT)) return null;
    tubes.push({ kind, colors, lock: null });
  }
  const puzzle = {
    capacity,
    tubes,
    oil: [],
    hidden: data.h === 1,
    undoLimit: data.u === undefined ? null : data.u
  };
  if (!UNDO_LIMITS.includes(puzzle.undoLimit)) return null;
  if (tubes.some((t) => t.colors.length > sizeOf(puzzle, t))) return null;

  if (data.l !== undefined) {
    if (!data.l || typeof data.l !== 'object') return null;
    for (const [key, color] of Object.entries(data.l)) {
      const index = Number(key);
      const target = tubes[index];
      if (!Number.isInteger(index) || !target || target.kind !== 'plain') return null;
      if (!Number.isInteger(color) || color < 0 || color >= CUSTOM_COLOR_COUNT) return null;
      target.lock = color;
    }
  }
  if (data.o !== undefined) {
    if (!Array.isArray(data.o)) return null;
    if (
      data.o.some((color) => !Number.isInteger(color) || color < 0 || color >= CUSTOM_COLOR_COUNT)
    ) {
      return null;
    }
    puzzle.oil = [...new Set(data.o)].sort((a, b) => a - b);
  }
  return floatOil(puzzle);
}

function tube(kind) {
  return { kind, colors: [], lock: null };
}

function replaceTube(puzzle, index, replacement) {
  return { ...puzzle, tubes: puzzle.tubes.map((t, i) => (i === index ? replacement : t)) };
}

function isComplete(puzzle, { colors }) {
  return colors.length === puzzle.capacity && colors.every((color) => color === colors[0]);
}

/** Lets the oil in every tube rise above its water, keeping the order within each. */
function floatOil(puzzle) {
  const isOil = (color) => puzzle.oil.includes(color);
  return {
    ...puzzle,
    tubes: puzzle.tubes.map((t) => ({
      ...t,
      colors: [...t.colors.filter((color) => !isOil(color)), ...t.colors.filter(isOil)]
    }))
  };
}
