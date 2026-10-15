import { fewestMovesOfPuzzle, solutionOfPuzzle } from '../game/puzzleFewest.js';

/**
 * Returns functions that work out the fewest moves of a puzzle, or a solution of it, in a
 * background worker, so the search never makes the game stutter, and remember the answers.
 * Without workers (or if the worker fails) they work the answer out on the page instead. They
 * never reject.
 * @returns {{
 *   fewest: (puzzle: { level: number } | { day: string } | { custom: object }) =>
 *     Promise<{ moves: number, proven: boolean } | null>,
 *   solution: (puzzle: { level: number }) => Promise<Array<[number, number]> | null>
 * }}
 */
export function createPuzzleSolver() {
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
      started.addEventListener('message', ({ data }) => {
        waiting.get(data.id)?.resolve('solution' in data ? data.solution : data.fewest);
        waiting.delete(data.id);
      });
      started.addEventListener('error', () => {
        // Answer whatever was asked on the page, and stop using the worker.
        worker = null;
        for (const { puzzle, want, resolve } of waiting.values()) {
          resolve(workOutHere(puzzle, want));
        }
        waiting.clear();
      });
      return started;
    } catch {
      return null;
    }
  }

  function ask(puzzle, want) {
    const key = JSON.stringify([want, puzzle]);
    if (!answers.has(key)) {
      answers.set(
        key,
        worker
          ? new Promise((resolve) => {
              const id = nextId++;
              waiting.set(id, { puzzle, want, resolve });
              worker.postMessage({ id, puzzle, want });
            })
          : Promise.resolve().then(() => workOutHere(puzzle, want))
      );
    }
    return answers.get(key);
  }

  return {
    fewest: (puzzle) => ask(puzzle, 'fewest'),
    solution: (puzzle) => ask(puzzle, 'solution')
  };
}

function workOutHere(puzzle, want) {
  try {
    return want === 'solution' ? solutionOfPuzzle(puzzle) : fewestMovesOfPuzzle(puzzle);
  } catch {
    return null;
  }
}
