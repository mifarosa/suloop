import { describe, expect, it } from 'vitest';
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
});
