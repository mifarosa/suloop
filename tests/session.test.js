import { describe, expect, it } from 'vitest';
import { HIDDEN } from '../src/game/rules.js';
import { GameSession } from '../src/game/session.js';

// Two moves from solved: pour tube 1 into tube 0, then tube 2 into tube 3.
const nearlySolved = () => [[0, 0, 0], [1, 1, 1, 0], [1], []];

describe('GameSession', () => {
  it('picks a tube up on the first tap and puts it down on a second tap', () => {
    const session = new GameSession(nearlySolved());

    expect(session.tap(1)).toEqual({ type: 'selected', tube: 1 });
    expect(session.selected).toBe(1);
    expect(session.tap(1)).toEqual({ type: 'deselected', tube: 1 });
    expect(session.selected).toBeNull();
  });

  it('rejects picking up an empty or complete tube', () => {
    const session = new GameSession([[0, 0, 0, 0], []]);

    expect(session.tap(0)).toEqual({ type: 'rejected', tube: 0 });
    expect(session.tap(1)).toEqual({ type: 'rejected', tube: 1 });
    expect(session.selected).toBeNull();
  });

  it('drops the selection when the pour is not allowed', () => {
    const session = new GameSession(nearlySolved());
    session.tap(2);

    expect(session.tap(0)).toEqual({ type: 'blocked', from: 2, to: 0 });
    expect(session.selected).toBeNull();
    expect(session.moveCount).toBe(0);
  });

  it('pours, counts the move and reports a filled tube', () => {
    const session = new GameSession(nearlySolved());
    session.tap(1);

    expect(session.tap(0)).toEqual({
      type: 'poured',
      from: 1,
      to: 0,
      amount: 1,
      filled: true,
      solved: false
    });
    expect(session.tubes[0]).toEqual([0, 0, 0, 0]);
    expect(session.moveCount).toBe(1);
  });

  it('reports the solving move and then ignores taps', () => {
    const session = new GameSession(nearlySolved());
    session.tap(1);
    session.tap(0);
    session.tap(1);

    expect(session.tap(2)).toMatchObject({ type: 'poured', solved: true });
    expect(session.solved).toBe(true);
    expect(session.canUndo).toBe(false);
    expect(session.tap(3)).toEqual({ type: 'ignored' });
  });

  it('undoes the last move and clears the selection', () => {
    const session = new GameSession(nearlySolved());
    session.tap(1);
    session.tap(0);
    session.tap(2);

    expect(session.undo()).toBe(true);
    expect(session.tubes).toEqual(nearlySolved());
    expect(session.selected).toBeNull();
    expect(session.undo()).toBe(false);
  });

  it('restarts from the initial board', () => {
    const session = new GameSession(nearlySolved());
    session.tap(1);
    session.tap(0);
    session.restart();

    expect(session.tubes).toEqual(nearlySolved());
    expect(session.moveCount).toBe(0);
  });

  it('is not affected by later changes to the board it was created with', () => {
    const board = nearlySolved();
    const session = new GameSession(board);
    board[0].push(9);

    expect(session.tubes).toEqual(nearlySolved());
  });

  it('suggests a move that leads to a solution', () => {
    const session = new GameSession(nearlySolved());
    expect(session.hint()).toEqual([1, 0]);
  });

  it('has no hint in a dead end', () => {
    const session = new GameSession([
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
      const session = new GameSession(board(), { hiddenColors: true });
      expect(session.visibleTubes).toEqual([[H, H, 1], [H, 0], [H, H, 0], [], [H, H, H, 1]]);
    });

    it('shows a unit once everything above it is poured off', () => {
      const session = new GameSession(board(), { hiddenColors: true });
      session.tap(0);
      session.tap(3);

      expect(session.visibleTubes[0]).toEqual([H, 2]);
      expect(session.visibleTubes[3]).toEqual([1]);
    });

    it('pours hidden units of the same color along, and shows them where they land', () => {
      const session = new GameSession([[1, 2, 2], [2], [0, 1, 0, 1], [0, 0, 1, 2]], {
        hiddenColors: true
      });
      session.tap(0);
      expect(session.tap(1)).toMatchObject({ type: 'poured', amount: 2 });

      expect(session.visibleTubes[0]).toEqual([1]);
      expect(session.visibleTubes[1]).toEqual([2, 2, 2]);
    });

    it('does not hide again what was seen, after an undo or a restart', () => {
      const session = new GameSession(board(), { hiddenColors: true });
      session.tap(0);
      session.tap(3);
      session.undo();
      expect(session.visibleTubes[0]).toEqual([H, 2, 1]);

      session.restart();
      expect(session.visibleTubes[0]).toEqual([H, 2, 1]);
    });

    it('shows all of a tube once it is complete', () => {
      const session = new GameSession(
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
      const session = new GameSession(board(), { hiddenColors: true });
      expect(session.hint()).not.toBeNull();
    });
  });

  describe('with tall tubes', () => {
    it('fills a tube to five units, and only then counts it complete', () => {
      const session = new GameSession([[0, 0, 0, 0], [1, 0], [1, 1, 1, 1], []], { capacity: 5 });

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
});
