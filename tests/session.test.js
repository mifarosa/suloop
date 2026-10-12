import { describe, expect, it } from 'vitest';
import { Board, HIDDEN } from '../src/game/rules.js';
import { createLevelPuzzle } from '../src/game/levels.js';
import { createRandom } from '../src/game/random.js';
import { GameSession } from '../src/game/session.js';

// Two moves from solved: pour tube 1 into tube 0, then tube 2 into tube 3.
const nearlySolved = () => [[0, 0, 0], [1, 1, 1, 0], [1], []];

describe('GameSession', () => {
  it('picks a tube up on the first tap and puts it down on a second tap', () => {
    const session = new GameSession(new Board(), nearlySolved());

    expect(session.tap(1)).toEqual({ type: 'selected', tube: 1 });
    expect(session.selected).toBe(1);
    expect(session.tap(1)).toEqual({ type: 'deselected', tube: 1 });
    expect(session.selected).toBeNull();
  });

  it('rejects picking up an empty or complete tube', () => {
    const session = new GameSession(new Board(), [[0, 0, 0, 0], []]);

    expect(session.tap(0)).toEqual({ type: 'rejected', tube: 0 });
    expect(session.tap(1)).toEqual({ type: 'rejected', tube: 1 });
    expect(session.selected).toBeNull();
  });

  it('drops the selection when the pour is not allowed', () => {
    const session = new GameSession(new Board(), nearlySolved());
    session.tap(2);

    expect(session.tap(0)).toEqual({ type: 'blocked', from: 2, to: 0 });
    expect(session.selected).toBeNull();
    expect(session.moveCount).toBe(0);
  });

  it('pours, counts the move and reports a filled tube', () => {
    const session = new GameSession(new Board(), nearlySolved());
    session.tap(1);

    expect(session.tap(0)).toEqual({
      type: 'poured',
      from: 1,
      to: 0,
      amount: 1,
      filled: true,
      solved: false,
      unlocked: []
    });
    expect(session.tubes[0]).toEqual([0, 0, 0, 0]);
    expect(session.moveCount).toBe(1);
  });

  it('reports the solving move and then ignores taps', () => {
    const session = new GameSession(new Board(), nearlySolved());
    session.tap(1);
    session.tap(0);
    session.tap(1);

    expect(session.tap(2)).toMatchObject({ type: 'poured', solved: true });
    expect(session.solved).toBe(true);
    expect(session.canUndo).toBe(false);
    expect(session.tap(3)).toEqual({ type: 'ignored' });
  });

  it('undoes the last move and clears the selection', () => {
    const session = new GameSession(new Board(), nearlySolved());
    session.tap(1);
    session.tap(0);
    session.tap(2);

    expect(session.undo()).toMatchObject({ from: 1, to: 0, amount: 1, onTop: true });
    expect(session.tubes).toEqual(nearlySolved());
    expect(session.selected).toBeNull();
    expect(session.undo()).toBeNull();
  });

  it('counts a hint as a move, which neither an undo nor a new move takes back', () => {
    const session = new GameSession(new Board(), nearlySolved());
    session.countHint();
    expect(session.moveCount).toBe(1);
    session.tap(1);
    session.tap(0);
    expect(session.moveCount).toBe(2);
    session.undo();
    expect(session.moveCount).toBe(1);
    expect(session.hasMoves).toBe(false);

    session.restart();
    expect(session.moveCount).toBe(0);
  });

  it('takes a move back with a spare undo once the limit is used up', () => {
    const session = new GameSession(new Board(), [[0, 1], [1, 0], [], []], { undoLimit: 1 });
    session.tap(0);
    session.tap(2);
    session.tap(1);
    session.tap(3);
    session.undo();
    expect(session.canUndo).toBe(false);
    expect(session.undo()).toBeNull();

    expect(session.undo({ spare: true })).toMatchObject({ from: 0, to: 2 });
    expect(session.undosLeft).toBe(0);
    expect(session.undo({ spare: true })).toBeNull();
  });

  it('says when poured water sank under oil, out of sight', () => {
    const board = new Board({ oilColors: [2] });
    const session = new GameSession(board, [[0, 2], [1, 0], [1], []]);
    session.tap(1);
    session.tap(0);
    session.tap(2);
    session.tap(3);

    expect(session.history.map((move) => move.onTop)).toEqual([false, true]);
  });

  it('restarts from the initial board', () => {
    const session = new GameSession(new Board(), nearlySolved());
    session.tap(1);
    session.tap(0);
    session.restart();

    expect(session.tubes).toEqual(nearlySolved());
    expect(session.moveCount).toBe(0);
  });

  it('is not affected by later changes to the board it was created with', () => {
    const board = nearlySolved();
    const session = new GameSession(new Board(), board);
    board[0].push(9);

    expect(session.tubes).toEqual(nearlySolved());
  });

  it('suggests a move that leads to a solution', () => {
    const session = new GameSession(new Board(), nearlySolved());
    expect(session.hint()).toEqual([1, 0]);
  });

  it('has no hint in a dead end', () => {
    const session = new GameSession(new Board(), [
      [0, 1, 0, 1],
      [1, 0, 1, 0]
    ]);
    expect(session.hint()).toBeNull();
  });

  describe('with hidden colors', () => {
    const H = HIDDEN;
    // Tube 0 holds two greens under the visible blue; tube 1 holds blue under red.
    const board = () => [[2, 2, 1], [1, 0], [0, 0, 0], [], [2, 2, 1, 1]];

    it('shows only the top unit of each tube at first', () => {
      const session = new GameSession(new Board(), board(), { hiddenColors: true });
      expect(session.visibleTubes).toEqual([[H, H, 1], [H, 0], [H, H, 0], [], [H, H, H, 1]]);
    });

    it('shows a unit once everything above it is poured off', () => {
      const session = new GameSession(new Board(), board(), { hiddenColors: true });
      session.tap(0);
      session.tap(3);

      expect(session.visibleTubes[0]).toEqual([H, 2]);
      expect(session.visibleTubes[3]).toEqual([1]);
    });

    it('pours hidden units of the same color along, and shows them where they land', () => {
      const session = new GameSession(new Board(), [[1, 2, 2], [2], [0, 1, 0, 1], [0, 0, 1, 2]], {
        hiddenColors: true
      });
      session.tap(0);
      expect(session.tap(1)).toMatchObject({ type: 'poured', amount: 2 });

      expect(session.visibleTubes[0]).toEqual([1]);
      expect(session.visibleTubes[1]).toEqual([2, 2, 2]);
    });

    it('does not hide again what was seen, after an undo or a restart', () => {
      const session = new GameSession(new Board(), board(), { hiddenColors: true });
      session.tap(0);
      session.tap(3);
      session.undo();
      expect(session.visibleTubes[0]).toEqual([H, 2, 1]);

      session.restart();
      expect(session.visibleTubes[0]).toEqual([H, 2, 1]);
    });

    it('shows all of a tube once it is complete', () => {
      const session = new GameSession(
        new Board(),
        [
          [0, 0, 0],
          [1, 0],
          [1, 1, 1]
        ],
        { hiddenColors: true }
      );
      session.tap(1);
      expect(session.tap(0)).toMatchObject({ type: 'poured', filled: true });

      expect(session.visibleTubes[0]).toEqual([0, 0, 0, 0]);
    });

    it('hints with the real colors', () => {
      const session = new GameSession(new Board(), board(), { hiddenColors: true });
      expect(session.hint()).not.toBeNull();
    });
  });

  describe('with tall tubes', () => {
    it('fills a tube to five units, and only then counts it complete', () => {
      const session = new GameSession(new Board({ capacity: 5 }), [
        [0, 0, 0, 0],
        [1, 0],
        [1, 1, 1, 1],
        []
      ]);

      expect(session.tap(0)).toEqual({ type: 'selected', tube: 0 });
      session.tap(0);
      session.tap(1);
      expect(session.tap(0)).toMatchObject({
        type: 'poured',
        amount: 1,
        filled: true,
        solved: false
      });
      session.tap(1);
      expect(session.tap(2)).toMatchObject({ type: 'poured', filled: true, solved: true });
    });
  });

  describe('with special tubes', () => {
    it('will not pick up a one-way or a locked tube', () => {
      const board = new Board({ oneWay: [1], locks: { 2: 0 } });
      const session = new GameSession(board, [[0, 0, 0], [1], [1, 1, 1], [0]]);

      expect(session.tap(1)).toEqual({ type: 'rejected', tube: 1 });
      expect(session.tap(2)).toEqual({ type: 'rejected', tube: 2 });
      expect(session.isLocked(2)).toBe(true);
    });

    it('reports the tubes a pour unlocked', () => {
      const board = new Board({ locks: { 2: 0 } });
      const session = new GameSession(board, [[0, 0, 0], [1], [1, 1, 1], [0]]);
      session.tap(3);

      expect(session.tap(0)).toMatchObject({ type: 'poured', filled: true, unlocked: [2] });
      expect(session.isLocked(2)).toBe(false);
      session.tap(2);
      expect(session.tap(1)).toMatchObject({ type: 'poured', solved: true });
    });

    it('counts down the fills of a cracked tube, and gives them back on undo', () => {
      const board = new Board({ cracked: { 2: 3 } });
      const session = new GameSession(board, [[1, 0], [0, 0, 0], [], [1, 1, 1]]);
      session.tap(0);
      session.tap(2);
      expect(session.fills[2]).toBe(2);

      session.undo();
      expect(session.fills[2]).toBe(3);
    });
  });
});

describe('undo on boards with every kind of tube', () => {
  /** Everything an undo has to bring back exactly. */
  const snapshot = (session) => ({
    tubes: session.tubes.map((tube) => tube.slice()),
    fills: session.fills.slice(),
    locked: session.tubes.map((_, index) => session.isLocked(index)),
    complete: session.tubes.map((tube) => session.board.isComplete(tube))
  });

  it.each([130, 150, 180, 200, 240, 263, 270])(
    'brings level %i back exactly, move by move',
    (level) => {
      const { tubes, board } = createLevelPuzzle(level);
      const session = new GameSession(board, tubes);
      const random = createRandom(level);
      const states = [snapshot(session)];

      // Random legal moves, so pours fill, crack, unlock and complete tubes along the way.
      // The solving move is left out: a solved game takes nothing back.
      const pours = () =>
        tubes
          .flatMap((_, from) => tubes.map((_, to) => [from, to]))
          .filter(
            ([from, to]) =>
              board.canPourFrom(session.position, from) &&
              board.canPour(session.position, from, to) &&
              !board.isSolved(board.pour(session.position, from, to).position)
          );
      for (let moves = 0; moves < 40; moves++) {
        const options = pours();
        if (options.length === 0) break;
        const [from, to] = options[Math.floor(random() * options.length)];
        session.tap(from);
        session.tap(to);
        states.push(snapshot(session));
      }
      expect(states.length).toBeGreaterThan(5);

      while (states.length > 1) {
        states.pop();
        expect(session.undo()).not.toBeNull();
        expect(snapshot(session)).toEqual(states.at(-1));
      }
      expect(session.undo()).toBeNull();
    }
  );
});
