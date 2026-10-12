import { generatePuzzle } from './generator.js';
import { createRandom, hashString } from './random.js';
import { TALL_TUBE_CAPACITY, TUBE_CAPACITY } from './rules.js';

/**
 * How a puzzle is dealt and played.
 * @typedef {object} PuzzleSettings
 * @property {number} colorCount
 * @property {number} emptyTubeCount empty full-size tubes
 * @property {number} halfTubeCount empty tubes that hold only HALF_TUBE_SIZE units
 * @property {number} oneWayTubeCount empty tubes that take liquid but never give it back
 * @property {number} crackedTubeCount empty tubes that can be poured into only a few times
 * @property {number} lockedTubeCount filled tubes locked until their key color is complete
 * @property {number} oilColorCount colors that are oil and float on top of the water
 * @property {number} capacity units of each color, and what a full-size tube holds
 * @property {boolean} hiddenColors whether only the top unit of each tube shows at first
 * @property {number | null} undoLimit moves the player may take back; null for no limit
 */

const PLAIN = Object.freeze({
  halfTubeCount: 0,
  oneWayTubeCount: 0,
  crackedTubeCount: 0,
  lockedTubeCount: 0,
  oilColorCount: 0,
  capacity: TUBE_CAPACITY,
  hiddenColors: false,
  undoLimit: null
});

export const DAILY_COLOR_COUNT = 7;
/** @type {Readonly<PuzzleSettings>} */
export const DAILY_SETTINGS = Object.freeze({
  ...PLAIN,
  colorCount: DAILY_COLOR_COUNT,
  emptyTubeCount: 2
});

/** @typedef {'limitedUndo' | 'oneWayTube' | 'tallTubes' | 'hiddenColors' | 'crackedTube'
 *   | 'lockedTube' | 'halfTube' | 'oil'} SpecialRule */

/** The board rules, in the order the stages bring them in. */
export const BOARD_RULES = Object.freeze([
  'oneWayTube',
  'tallTubes',
  'hiddenColors',
  'crackedTube',
  'lockedTube',
  'halfTube',
  'oil'
]);

/**
 * The stages of the game. Each one after the first brings in one rule: it comes on its own
 * first, then mixed with rules of the stages before, in parts that get harder. The undo limit
 * tightens as the rules pile up.
 *
 * A part lists its levels (`count`), the colors rising across it, rules every level of it
 * adds (`also`), a range of rules drawn for each level (`pick`), and a rule whose tube comes
 * twice (`twice`). Drawn rules are fixed by the level number, so every player gets the same.
 *
 * Difficulty was set by how often random play still solves a board (see the README), and by
 * keeping every level quick to deal.
 */
export const STAGES = Object.freeze([
  {
    id: 'easy',
    rule: null,
    undoLimit: null,
    parts: [
      { count: 5, colors: [3, 3] },
      { count: 10, colors: [4, 5] }
    ]
  },
  {
    id: 'oneWay',
    rule: 'oneWayTube',
    undoLimit: 4,
    parts: [
      { count: 5, colors: [5, 6] },
      { count: 10, colors: [6, 8] },
      { count: 5, colors: [9, 10] }
    ]
  },
  {
    id: 'tall',
    rule: 'tallTubes',
    undoLimit: 4,
    parts: [
      { count: 5, colors: [5, 6] },
      { count: 10, colors: [6, 7], also: ['oneWayTube'] },
      { count: 10, colors: [7, 8], also: ['oneWayTube'] }
    ]
  },
  {
    id: 'hidden',
    rule: 'hiddenColors',
    undoLimit: 3,
    parts: [
      { count: 5, colors: [5, 6] },
      { count: 10, colors: [6, 7], pick: { from: ['tallTubes', 'oneWayTube'], count: [1, 1] } },
      { count: 15, colors: [6, 8], also: ['tallTubes', 'oneWayTube'] }
    ]
  },
  {
    id: 'cracked',
    rule: 'crackedTube',
    undoLimit: 3,
    parts: [
      { count: 5, colors: [6, 7] },
      { count: 15, colors: [6, 7], pick: { from: ['tallTubes', 'hiddenColors'], count: [1, 2] } },
      {
        count: 15,
        colors: [6, 8],
        pick: { from: ['oneWayTube', 'tallTubes', 'hiddenColors'], count: [2, 3] }
      }
    ]
  },
  {
    id: 'locked',
    rule: 'lockedTube',
    undoLimit: 3,
    parts: [
      { count: 5, colors: [6, 7] },
      { count: 15, colors: [7, 7], pick: { from: ['crackedTube', 'oneWayTube'], count: [1, 1] } },
      { count: 20, colors: [7, 9], twice: 'lockedTube' }
    ]
  },
  {
    id: 'half',
    rule: 'halfTube',
    undoLimit: 3,
    parts: [
      { count: 5, colors: [5, 6] },
      { count: 20, colors: [4, 5], also: ['tallTubes'] },
      {
        count: 20,
        colors: [6, 7],
        pick: { from: ['lockedTube', 'crackedTube', 'hiddenColors'], count: [2, 3] }
      }
    ]
  },
  {
    id: 'oil',
    rule: 'oil',
    undoLimit: 3,
    parts: [
      { count: 5, colors: [4, 5] },
      { count: 20, colors: [4, 5], pick: { from: ['oneWayTube', 'halfTube'], count: [1, 1] } },
      {
        count: 25,
        colors: [4, 5],
        pick: {
          from: [
            'oneWayTube',
            'tallTubes',
            'hiddenColors',
            'crackedTube',
            'lockedTube',
            'halfTube'
          ],
          count: [2, 3]
        }
      }
    ]
  }
]);

/** Master levels go on forever, each with a few rules drawn from all of them. */
export const MASTER_STAGE = Object.freeze({
  id: 'master',
  rule: null,
  undoLimit: 3,
  pick: { from: BOARD_RULES, count: [3, 4] },
  colors: [5, 7]
});

const stageLevelCount = (stage) => stage.parts.reduce((sum, part) => sum + part.count, 0);

/** Levels in the stages; every level after them is a master level. */
export const STAGE_LEVEL_COUNT = STAGES.reduce((sum, stage) => sum + stageLevelCount(stage), 0);

/** The first level of each stage, by stage index. */
export const STAGE_STARTS = Object.freeze(
  STAGES.map(
    (_, index) => 1 + STAGES.slice(0, index).reduce((sum, s) => sum + stageLevelCount(s), 0)
  )
);

export const MAX_COLOR_COUNT = Math.max(
  DAILY_COLOR_COUNT,
  ...STAGES.flatMap((stage) => stage.parts.map((part) => part.colors[1])),
  MASTER_STAGE.colors[1]
);

/** Seeds to try for one puzzle. Almost every puzzle comes from the first one. */
const SEED_ATTEMPTS = 10;

export function isMasterLevel(level) {
  return level > STAGE_LEVEL_COUNT;
}

/** The stage a level belongs to, or MASTER_STAGE after the stages. */
export function stageOfLevel(level) {
  return isMasterLevel(level) ? MASTER_STAGE : STAGES[stageIndexOfLevel(level)];
}

/** How many levels a stage has; master levels never end. */
export function levelCountOf(stage) {
  return stage === MASTER_STAGE ? Infinity : stageLevelCount(stage);
}

function stageIndexOfLevel(level) {
  let index = STAGE_STARTS.length - 1;
  while (STAGE_STARTS[index] > level) index--;
  return index;
}

/**
 * How a level is dealt and played.
 * @param {number} level 1 or more
 * @returns {Readonly<PuzzleSettings>}
 */
export function levelSettings(level) {
  // Drawn rules and colors come from a seed of their own, so they never change a deal.
  const random = createRandom(hashString(`rules-${level}`));
  if (isMasterLevel(level)) {
    const rules = drawRules(random, MASTER_STAGE.pick);
    const [fewest, most] = MASTER_STAGE.colors;
    // More rules and oil leave room for fewer colors.
    const colorCount = Math.max(
      fewest,
      most - (rules.length - 3) - (rules.includes('oil') ? 1 : 0) - Math.floor(random() * 2)
    );
    return buildSettings({ colorCount, rules, undoLimit: MASTER_STAGE.undoLimit });
  }

  const stageIndex = stageIndexOfLevel(level);
  const stage = STAGES[stageIndex];
  let position = level - STAGE_STARTS[stageIndex];
  const part = stage.parts.find((candidate) => (position -= candidate.count) < 0);
  const step = position + part.count;
  const [from, to] = part.colors;
  const colorCount = from + Math.floor((step * (to - from + 1)) / part.count);
  const rules = [
    ...(stage.rule ? [stage.rule] : []),
    ...(part.also ?? []),
    ...(part.pick ? drawRules(random, part.pick) : [])
  ];
  return buildSettings({ colorCount, rules, undoLimit: stage.undoLimit, twice: part.twice });
}

/** Draws between `count[0]` and `count[1]` rules from `from`, in their stage order. */
function drawRules(random, { from, count: [fewest, most] }) {
  const count = fewest + Math.floor(random() * (most - fewest + 1));
  const pool = from.slice();
  const drawn = [];
  while (drawn.length < count && pool.length > 0) {
    drawn.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return BOARD_RULES.filter((rule) => drawn.includes(rule));
}

/**
 * Settings for a board with the given rules. A board has two spare tubes: plain empty ones,
 * or one-way, cracked and half tubes standing in for them; a further one-way, cracked or half
 * tube would make the board easier, not harder. A board with a lock or oil keeps one plain
 * empty tube: without it a locked board is often unsolvable, and an oily one takes the solver
 * seconds to deal.
 */
function buildSettings({ colorCount, rules, undoLimit, twice = null }) {
  const has = (rule) => rules.includes(rule);
  const times = (rule) => (has(rule) ? (rule === twice ? 2 : 1) : 0);
  const specials = times('oneWayTube') + times('crackedTube') + times('halfTube');
  return {
    colorCount,
    emptyTubeCount: Math.max(has('lockedTube') || has('oil') ? 1 : 0, 2 - specials),
    halfTubeCount: times('halfTube'),
    oneWayTubeCount: times('oneWayTube'),
    crackedTubeCount: times('crackedTube'),
    lockedTubeCount: times('lockedTube'),
    oilColorCount: has('oil') ? 1 : 0,
    capacity: has('tallTubes') ? TALL_TUBE_CAPACITY : TUBE_CAPACITY,
    hiddenColors: has('hiddenColors'),
    undoLimit
  };
}

/**
 * The special rules in a puzzle's settings.
 * @param {PuzzleSettings} settings
 * @returns {SpecialRule[]}
 */
export function specialRules(settings) {
  const rules = [];
  if (settings.undoLimit !== null) rules.push('limitedUndo');
  if (settings.oneWayTubeCount > 0) rules.push('oneWayTube');
  if (settings.capacity > TUBE_CAPACITY) rules.push('tallTubes');
  if (settings.hiddenColors) rules.push('hiddenColors');
  if (settings.crackedTubeCount > 0) rules.push('crackedTube');
  if (settings.lockedTubeCount > 0) rules.push('lockedTube');
  if (settings.halfTubeCount > 0) rules.push('halfTube');
  if (settings.oilColorCount > 0) rules.push('oil');
  return rules;
}

/**
 * What a level is the first to bring, so the game can explain it there: the rule of a stage
 * at its first level, and the undo limit wherever it changes.
 * @returns {SpecialRule[]}
 */
export function rulesFirstUsedAt(level) {
  if (isMasterLevel(level)) return [];
  const stageIndex = stageIndexOfLevel(level);
  if (level !== STAGE_STARTS[stageIndex]) return [];

  const stage = STAGES[stageIndex];
  const before = STAGES[stageIndex - 1];
  const news = [];
  if (stage.undoLimit !== null && stage.undoLimit !== before?.undoLimit) news.push('limitedUndo');
  if (stage.rule) news.push(stage.rule);
  return news;
}

/**
 * The puzzle for a numbered level: its tubes and the board's rules. Seeds are derived from
 * the level number, so a level looks the same on every device and after every release.
 * @returns {{ tubes: number[][], board: import('./rules.js').Board }}
 */
export function createLevelPuzzle(level) {
  return dealPuzzle(`level-${level}`, levelSettings(level));
}

/**
 * The daily puzzle, shared by everyone on the same calendar date ("YYYY-MM-DD").
 * @returns {{ tubes: number[][], board: import('./rules.js').Board }}
 */
export function createDailyPuzzle(dateKey) {
  return dealPuzzle(`daily-${dateKey}`, DAILY_SETTINGS);
}

/**
 * Deals from the seed of `key`, or, in the rare case that seed yields no solvable puzzle,
 * from the seeds of "key#1", "key#2" and so on.
 * @param {string} key
 * @param {PuzzleSettings} settings
 */
export function dealPuzzle(key, settings) {
  for (let attempt = 0; attempt < SEED_ATTEMPTS; attempt++) {
    const seedKey = attempt === 0 ? key : `${key}#${attempt}`;
    const puzzle = generatePuzzle(hashString(seedKey), settings);
    if (puzzle) return puzzle;
  }
  throw new Error(`Could not deal a solvable puzzle for ${key}`);
}
