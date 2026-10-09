import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameController } from '../src/app/controller.js';
import { createLevelPuzzle } from '../src/game/levels.js';
import { solve } from '../src/game/solver.js';

function fakeScene() {
  return {
    showPuzzle: vi.fn(),
    showContents: vi.fn(),
    setLifted: vi.fn(),
    shake: vi.fn(),
    hop: vi.fn(),
    highlight: vi.fn(),
    celebrate: vi.fn(async () => {}),
    pour: vi.fn(async () => {})
  };
}

function fakeHud() {
  return {
    render: vi.fn(),
    showToast: vi.fn(),
    showWin: vi.fn(),
    hideWin: vi.fn()
  };
}

const TODAY = new Date(2026, 9, 9, 12, 0);

describe('GameController', () => {
  let scene;
  let hud;
  let saved;

  function createController(progress = { mode: 'level', level: 1, dailyDone: null }) {
    const controller = new GameController({
      scene,
      hud,
      progress,
      saveProgress: (value) => saved.push(value),
      now: () => TODAY
    });
    controller.start();
    return controller;
  }

  async function playSolution(controller, tubes) {
    for (const [from, to] of solve(tubes)) {
      await controller.tapTube(from);
      await controller.tapTube(to);
    }
  }

  const lastRender = () => hud.render.mock.lastCall[0];

  beforeEach(() => {
    scene = fakeScene();
    hud = fakeHud();
    saved = [];
  });

  it('starts the saved level', () => {
    createController({ mode: 'level', level: 3, dailyDone: null });

    expect(scene.showPuzzle).toHaveBeenCalledWith(createLevelPuzzle(3));
    expect(lastRender()).toEqual({
      title: 'Seviye 3',
      moves: '0 hamle',
      canUndo: false,
      modeLabel: 'Günlük'
    });
  });

  it('lifts a tube on the first tap and pours on the second', async () => {
    const controller = createController();
    const [from, to] = solve(createLevelPuzzle(1))[0];

    await controller.tapTube(from);
    expect(scene.setLifted).toHaveBeenCalledWith(from, true);

    await controller.tapTube(to);
    expect(scene.pour).toHaveBeenCalledWith(from, to, expect.any(Number), expect.any(Array));
    expect(lastRender()).toMatchObject({ moves: '1 hamle', canUndo: true });
  });

  it('advances to the next level after a win', async () => {
    const controller = createController();
    await playSolution(controller, createLevelPuzzle(1));

    expect(scene.celebrate).toHaveBeenCalledOnce();
    expect(saved.at(-1)).toMatchObject({ mode: 'level', level: 2 });
    expect(hud.showWin).toHaveBeenCalledWith({
      message: expect.stringMatching(/^\d+ hamlede çözdün\.$/),
      continueLabel: 'Sonraki seviye'
    });

    controller.continueAfterWin();
    expect(scene.showPuzzle).toHaveBeenLastCalledWith(createLevelPuzzle(2));
    expect(lastRender().title).toBe('Seviye 2');
  });

  it('marks the daily puzzle as solved and returns to the levels', async () => {
    const controller = createController({ mode: 'daily', level: 4, dailyDone: null });
    expect(lastRender().title).toBe('Günün bulmacası · 9 Ekim');

    await playSolution(controller, scene.showPuzzle.mock.lastCall[0]);
    expect(saved.at(-1)).toEqual({ mode: 'daily', level: 4, dailyDone: '2026-10-09' });
    expect(hud.showWin).toHaveBeenCalledWith(
      expect.objectContaining({ continueLabel: 'Seviyelere dön' })
    );

    controller.continueAfterWin();
    expect(saved.at(-1)).toMatchObject({ mode: 'level', level: 4 });
  });

  it('ignores restart once the puzzle is solved', async () => {
    const controller = createController();
    await playSolution(controller, createLevelPuzzle(1));
    scene.showContents.mockClear();

    controller.restart();
    expect(scene.showContents).not.toHaveBeenCalled();
  });

  it('ignores taps while a pour is playing', async () => {
    let finishPour;
    scene.pour.mockImplementation(() => new Promise((resolve) => (finishPour = resolve)));
    const controller = createController();
    const [from, to] = solve(createLevelPuzzle(1))[0];

    await controller.tapTube(from);
    const pouring = controller.tapTube(to);
    await controller.tapTube(from);
    expect(scene.setLifted).toHaveBeenCalledTimes(1);

    finishPour();
    await pouring;
  });

  it('undoes a move and shows the previous board', async () => {
    const controller = createController();
    const [from, to] = solve(createLevelPuzzle(1))[0];
    await controller.tapTube(from);
    await controller.tapTube(to);

    controller.undo();
    expect(scene.showContents).toHaveBeenLastCalledWith(createLevelPuzzle(1));
    expect(lastRender()).toMatchObject({ moves: '0 hamle', canUndo: false });
  });

  it('points out the next move as a hint', () => {
    const controller = createController();
    const [from, to] = solve(createLevelPuzzle(1))[0];

    controller.showHint();
    expect(scene.highlight).toHaveBeenCalledWith([from, to]);
    expect(hud.showToast).toHaveBeenCalledWith(`${from + 1}. tüpten ${to + 1}. tüpe dök.`);
  });

  it('switches to the daily puzzle and saves the choice', () => {
    const controller = createController();
    controller.toggleMode();

    expect(saved.at(-1)).toMatchObject({ mode: 'daily' });
    expect(lastRender().modeLabel).toBe('Seviyeler');
  });
});
