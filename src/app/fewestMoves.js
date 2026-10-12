import { createDailyPuzzle, createLevelPuzzle } from '../game/levels.js';
import { fewestMoves } from '../game/shortest.js';

/**
 * Returns a function that works out the fewest moves of a puzzle in a background worker, so
 * the search never makes the game stutter, and remembers the answers. Without workers (or if
 * the worker fails) it works them out on the page instead. It never rejects.
 * @returns {(puzzle: { level: number } | { day: string }) =>
 *   Promise<{ moves: number, proven: boolean } | null>}
 */
export function createFewestMovesFinder() {
  const answers = new Map();
  const waiting = new Map();
  let nextId = 0;
  let worker = startWorker();

  function startWorker() {
    if (typeof Worker !== 'function') return null;
    try {
      const started = new Worker(new URL('../game/fewestWorker.js', import.meta.url), {
        type: 'module'
      });
      started.addEventListener('message', ({ data: { id, fewest } }) => {
        waiting.get(id)?.resolve(fewest);
        waiting.delete(id);
      });
      started.addEventListener('error', () => {
        // Answer whatever was asked on the page, and stop using the worker.
        worker = null;
        for (const { puzzle, resolve } of waiting.values()) resolve(workOutHere(puzzle));
        waiting.clear();
      });
      return started;
    } catch {
      return null;
    }
  }

  return (puzzle) => {
    const key = JSON.stringify(puzzle);
    if (!answers.has(key)) {
      answers.set(
        key,
        worker
          ? new Promise((resolve) => {
              const id = nextId++;
              waiting.set(id, { puzzle, resolve });
              worker.postMessage({ id, puzzle });
            })
          : Promise.resolve().then(() => workOutHere(puzzle))
      );
    }
    return answers.get(key);
  };
}

function workOutHere(puzzle) {
  try {
    const { tubes, board } =
      puzzle.level !== undefined ? createLevelPuzzle(puzzle.level) : createDailyPuzzle(puzzle.day);
    return fewestMoves(tubes, { board });
  } catch {
    return null;
  }
}
