import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameController } from '../src/app/controller.js';
import { INITIAL_PROGRESS } from '../src/app/progress.js';
import { decodeProgressCode, encodeProgressCode } from '../src/app/progressCode.js';
import { tubeSizes } from '../src/game/generator.js';
import { boardOf, withRandomFill, emptyPuzzle } from '../src/game/customPuzzle.js';
import { createDailyPuzzle, createLevelPuzzle, levelSettings } from '../src/game/levels.js';
import { createRandom } from '../src/game/random.js';
import { HIDDEN } from '../src/game/rules.js';
import { fewestMoves, solveShortest } from '../src/game/shortest.js';
import { solve } from '../src/game/solver.js';

function fakeScene() {
  return {
    showPuzzle: vi.fn(),
    showContents: vi.fn(),
    showTubeStates: vi.fn(),
    setLifted: vi.fn(),
    shake: vi.fn(),
    hop: vi.fn(),
    highlight: vi.fn(),
    celebrate: vi.fn(async () => {}),
    pour: vi.fn(async () => {})
  };
}

function fakeRules() {
  return { show: vi.fn(), hide: vi.fn(), isShowingInfo: false };
}

/** Works out the fewest moves at once, as the worker would in the background. */
function findFewestMoves({ level, day, custom }) {
  const { tubes, board } = custom
    ? boardOf(custom)
    : level !== undefined
      ? createLevelPuzzle(level)
      : createDailyPuzzle(day);
  return Promise.resolve(fewestMoves(tubes, { board }));
}

function fakeHud() {
  return {
    render: vi.fn(),
    showToast: vi.fn(),
    showWin: vi.fn(),
    hideWin: vi.fn()
  };
}

function fakeMenu() {
  return { show: vi.fn(), hide: vi.fn() };
}

function fakeTransfer() {
  return { show: vi.fn(), hide: vi.fn(), showError: vi.fn() };
}

const TODAY = new Date(2026, 9, 9, 12, 0);

/** What the scene is given for a level: the board and each tube's size. */
const shownBoard = (level) => [
  createLevelPuzzle(level).tubes,
  expect.objectContaining({ sizes: tubeSizes(levelSettings(level)) })
];

const range = (first, last) => Array.from({ length: last - first + 1 }, (_, i) => first + i);

describe('GameController', () => {
  let scene;
  let hud;
  let menu;
  let transfer;
  let rules;
  let saved;

  function createController(
    progress = {},
    { clock = () => TODAY, onDailySolved, onEditPuzzle, getDailySummary, leaderboardOnline } = {}
  ) {
    const controller = new GameController({
      scene,
      hud,
      menu,
      transfer,
      rules,
      findFewestMoves,
      onDailySolved,
      onEditPuzzle,
      getDailySummary,
      leaderboardOnline,
      progress: { ...INITIAL_PROGRESS, ...progress },
      saveProgress: (value) => saved.push(value),
      now: clock
    });
    controller.start();
    return controller;
  }

  /**
   * Plays a solution of a level, or of plain tubes (such as a daily puzzle): by default some
   * solution, as the depth-first solver finds it; `shortest` plays one of the fewest moves.
   */
  async function playSolution(controller, puzzle, { shortest = false } = {}) {
    const { tubes, board } = Array.isArray(puzzle) ? { tubes: puzzle } : puzzle;
    const moves = shortest ? solveShortest(tubes, { board }) : solve(tubes, { board });
    for (const [from, to] of moves) {
      await controller.tapTube(from);
      await controller.tapTube(to);
    }
    return moves;
  }

  /** Plays a solution that is longer than the shortest, so it earns fewer stars. */
  async function playLongSolution(controller, level) {
    const { tubes, board } = createLevelPuzzle(level);
    const moves = solve(tubes, { board });
    expect(moves.length).toBeGreaterThan(solveShortest(tubes, { board }).length);
    return playSolution(controller, createLevelPuzzle(level));
  }

  const lastWin = () => hud.showWin.mock.lastCall[0];

  const lastRender = () => hud.render.mock.lastCall[0];
  const lastMenu = () => menu.show.mock.lastCall[0];
  const tile = (level) => lastMenu().chapters.flatMap((chapter) => chapter.levels)[level - 1];

  beforeEach(() => {
    scene = fakeScene();
    hud = fakeHud();
    menu = fakeMenu();
    transfer = fakeTransfer();
    rules = fakeRules();
    saved = [];
  });

  it('starts the saved level', () => {
    createController({ solved: 5, current: 3 });

    expect(scene.showPuzzle).toHaveBeenCalledWith(...shownBoard(3));
    expect(lastRender()).toEqual({
      title: 'Seviye 3',
      subtitle: 'Kolay · 0 hamle',
      canUndo: false,
      undoCount: null,
      undoLabel: 'Geri al',
      hintCount: '2',
      hintLabel: 'İpucu: 2 hakkın var',
      levelsLabel: 'Seviyeler'
    });
  });

  it('lifts a tube on the first tap and pours on the second', async () => {
    const controller = createController();
    const [from, to] = solve(createLevelPuzzle(1).tubes)[0];

    await controller.tapTube(from);
    expect(scene.setLifted).toHaveBeenCalledWith(from, true);

    await controller.tapTube(to);
    expect(scene.pour).toHaveBeenCalledWith(from, to, expect.any(Number), expect.any(Array));
    expect(lastRender()).toMatchObject({ subtitle: 'Kolay · 1 hamle', canUndo: true });
  });

  it('advances to the next level after a win', async () => {
    const controller = createController();
    const moves = await playSolution(controller, createLevelPuzzle(1));

    expect(scene.celebrate).toHaveBeenCalledOnce();
    expect(saved.at(-1)).toMatchObject({ mode: 'level', solved: 1, current: 2 });
    expect(hud.showWin).toHaveBeenCalledWith({
      title: 'Tebrikler!',
      stars: 1,
      moves: moves.length,
      fewest: 9,
      fewestLabel: 'En az',
      notes: [],
      attempts: [{ moves: moves.length, stars: 1 }],
      continueLabel: 'Sonraki seviye',
      leaderboard: false
    });

    controller.continueAfterWin();
    expect(scene.showPuzzle).toHaveBeenLastCalledWith(...shownBoard(2));
    expect(lastRender().title).toBe('Seviye 2');
  });

  it('gives every star for the fewest moves, and nothing more where undos are unlimited', async () => {
    const controller = createController();
    await playSolution(controller, createLevelPuzzle(1), { shortest: true });

    expect(lastWin()).toMatchObject({
      title: 'Mükemmel!',
      stars: 3,
      moves: 9,
      fewest: 9,
      notes: []
    });
    expect(saved.at(-1)).toMatchObject({
      spareUndos: 0,
      records: { 1: { best: 3, attempts: [{ moves: 9, stars: 3 }] } }
    });

    controller.replay();
    expect(scene.showPuzzle).toHaveBeenLastCalledWith(...shownBoard(1));
    await playSolution(controller, createLevelPuzzle(1), { shortest: true });
    expect(lastWin().attempts).toEqual([
      { moves: 9, stars: 3 },
      { moves: 9, stars: 3 }
    ]);
  });

  it('earns a spare undo for the first three stars of a level with limited undo', async () => {
    const controller = createController({ solved: 20, current: 16 });
    await playSolution(controller, createLevelPuzzle(16), { shortest: true });
    expect(lastWin()).toMatchObject({
      stars: 3,
      notes: ['+1 ekstra geri alma']
    });
    expect(saved.at(-1).spareUndos).toBe(1);

    controller.replay();
    await playSolution(controller, createLevelPuzzle(16), { shortest: true });
    expect(lastWin().notes).toEqual([]);
    expect(saved.at(-1).spareUndos).toBe(1);
  });

  it('keeps the last five solutions of a level, newest first, and its best stars', async () => {
    const controller = createController({ solved: 30, current: 5 });
    const long = (await playLongSolution(controller, 5)).length;
    controller.replay();
    await playSolution(controller, createLevelPuzzle(5), { shortest: true });
    for (let i = 0; i < 4; i++) {
      controller.replay();
      await playLongSolution(controller, 5);
    }

    expect(lastWin().attempts).toHaveLength(5);
    expect(lastWin().attempts.map((attempt) => attempt.moves)).toEqual([long, long, long, long, 8]);
    controller.showLevels();
    expect(tile(5)).toMatchObject({ stars: 3, label: 'Seviye 5, çözüldü, 3 yıldız' });
    expect(tile(6).stars).toBe(0);
  });

  it('marks the daily puzzle as solved and returns to the levels', async () => {
    const controller = createController({ mode: 'daily', solved: 3, current: 4 });
    expect(lastRender().title).toBe('Günün bulmacası · 9 Ekim');

    await playSolution(controller, scene.showPuzzle.mock.lastCall[0]);
    expect(saved.at(-1)).toEqual({
      ...INITIAL_PROGRESS,
      mode: 'daily',
      solved: 3,
      current: 4,
      dailyDone: '2026-10-09',
      hints: 3
    });
    expect(lastWin()).toMatchObject({
      notes: ['Günün bulmacası: +1 ipucu!'],
      attempts: null,
      continueLabel: 'Devam et',
      // Without a shared leaderboard there is nothing to rank.
      leaderboard: false
    });

    controller.replay();
    await playSolution(controller, scene.showPuzzle.mock.lastCall[0]);
    expect(lastWin().notes).toEqual([]);
    expect(saved.at(-1).hints).toBe(3);

    controller.continueAfterWin();
    expect(saved.at(-1)).toMatchObject({ mode: 'level', current: 4 });
    expect(scene.showPuzzle).toHaveBeenLastCalledWith(...shownBoard(4));
  });

  it('shows the streak after a daily puzzle, and the leaderboard only when scores are shared', async () => {
    const getDailySummary = () => ({ today: { moves: 20, seconds: 75, stars: 2 }, streak: 4 });
    let controller = createController({ mode: 'daily' }, { getDailySummary });
    await playSolution(controller, scene.showPuzzle.mock.lastCall[0]);
    expect(lastWin()).toMatchObject({
      notes: expect.arrayContaining(['🔥 4 gün üst üste çözdün!']),
      leaderboard: false
    });

    controller.showLevels();
    expect(lastMenu().daily).toMatchObject({
      result: { text: '20 hamle · 1:15', stars: 2 },
      streak: '🔥 4 gün üst üste'
    });

    controller = createController({ mode: 'daily' }, { getDailySummary, leaderboardOnline: true });
    await playSolution(controller, scene.showPuzzle.mock.lastCall[0]);
    expect(lastWin().leaderboard).toBe(true);
  });

  it('shows no result or streak on the daily card before any daily puzzle is solved', () => {
    createController().showLevels();
    expect(lastMenu().daily).toMatchObject({ result: null, streak: null });
  });

  it('reports each daily solution with the time since the puzzle was opened', async () => {
    let time = TODAY.getTime();
    const onDailySolved = vi.fn();
    const controller = createController(
      { mode: 'daily' },
      { clock: () => new Date(time), onDailySolved }
    );
    time += 95_400;
    const moves = await playSolution(controller, scene.showPuzzle.mock.lastCall[0]);

    expect(onDailySolved).toHaveBeenCalledWith('2026-10-09', {
      moves: moves.length,
      seconds: 95,
      stars: lastWin().stars
    });
  });

  it('announces the next stage after the last level of a stage', async () => {
    const controller = createController({ solved: 14, current: 15 });
    await playSolution(controller, createLevelPuzzle(15));

    expect(lastWin().notes).toContain('Yeni aşama açıldı: Tek Yönlü!');
  });

  it('does not announce a stage again when an old level is replayed', async () => {
    const controller = createController({ solved: 20, current: 15 });
    await playSolution(controller, createLevelPuzzle(15));

    expect(lastWin().notes.some((note) => note.startsWith('Yeni aşama'))).toBe(false);
    expect(saved.at(-1)).toMatchObject({ solved: 20, current: 16 });
  });

  it('opens the master levels after the last stage, and goes on after them', async () => {
    const controller = createController({ solved: 259, current: 260 });
    await playSolution(controller, createLevelPuzzle(260));

    expect(lastWin()).toMatchObject({
      notes: expect.arrayContaining(['Yeni aşama açıldı: Usta!']),
      continueLabel: 'Sonraki seviye'
    });
    controller.continueAfterWin();
    expect(lastRender()).toMatchObject({
      title: 'Seviye 261',
      subtitle: expect.stringMatching(/^Usta · .+ · 0 hamle$/),
      undoCount: '3'
    });
  });

  it('does not announce anything at the end of a block of master levels', async () => {
    const controller = createController({ solved: 269, current: 270 });
    await playSolution(controller, createLevelPuzzle(270));

    expect(lastWin().notes.some((note) => note.startsWith('Yeni aşama'))).toBe(false);
    expect(saved.at(-1)).toMatchObject({ solved: 270, current: 271 });
  });

  it('ignores restart once the puzzle is solved', async () => {
    const controller = createController();
    await playSolution(controller, createLevelPuzzle(1));
    scene.showContents.mockClear();

    controller.restart();
    expect(scene.showContents).not.toHaveBeenCalled();
  });

  it('takes the next move while a pour is still playing', async () => {
    const pending = [];
    scene.pour.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    const controller = createController();
    const [[from, to], [nextFrom, nextTo]] = solve(createLevelPuzzle(1).tubes);

    await controller.tapTube(from);
    const pouring = controller.tapTube(to);
    await controller.tapTube(nextFrom);
    const nextPouring = controller.tapTube(nextTo);
    expect(scene.pour).toHaveBeenCalledTimes(2);
    expect(lastRender().subtitle).toBe('Kolay · 2 hamle');

    pending.forEach((resolve) => resolve());
    await Promise.all([pouring, nextPouring]);
  });

  it('holds input back while the win is celebrated', async () => {
    let finishCelebration;
    scene.celebrate.mockImplementation(
      () => new Promise((resolve) => (finishCelebration = resolve))
    );
    const controller = createController();
    const moves = solve(createLevelPuzzle(1).tubes);
    for (const [from, to] of moves.slice(0, -1)) {
      await controller.tapTube(from);
      await controller.tapTube(to);
    }
    const [lastFrom, lastTo] = moves.at(-1);
    await controller.tapTube(lastFrom);
    const winning = controller.tapTube(lastTo);
    await Promise.resolve();

    scene.showContents.mockClear();
    controller.showLevels();
    expect(menu.show).not.toHaveBeenCalled();

    finishCelebration();
    await winning;
  });

  it('shows fills and locks again after an undo', async () => {
    const controller = createController();
    const [from, to] = solve(createLevelPuzzle(1).tubes)[0];
    await controller.tapTube(from);
    await controller.tapTube(to);
    scene.showTubeStates.mockClear();

    controller.undo();
    expect(scene.showTubeStates).toHaveBeenCalledOnce();
  });

  it('undoes a move by pouring it back', async () => {
    const controller = createController();
    const [from, to] = solve(createLevelPuzzle(1).tubes)[0];
    await controller.tapTube(from);
    await controller.tapTube(to);
    const [, , amount] = scene.pour.mock.lastCall;

    controller.undo();
    expect(scene.pour).toHaveBeenLastCalledWith(to, from, amount, createLevelPuzzle(1).tubes);
    expect(scene.showContents).not.toHaveBeenCalled();
    expect(lastRender()).toMatchObject({ subtitle: 'Kolay · 0 hamle', canUndo: false });
  });

  it('changes the board at once on undoing water that sank under oil', async () => {
    // A few moves into level 211 that end by pouring water under oil.
    const { tubes, board } = createLevelPuzzle(211);
    const sinks = (position, [from, to]) =>
      !board.isOil(position.tubes[from].at(-1)) && board.isOil(position.tubes[to].at(-1));
    const findPath = (position, depth) => {
      for (let from = 0; from < tubes.length; from++) {
        for (let to = 0; to < tubes.length; to++) {
          if (!board.canPourFrom(position, from) || !board.canPour(position, from, to)) continue;
          if (sinks(position, [from, to])) return [[from, to]];
          const rest = depth > 1 && findPath(board.pour(position, from, to).position, depth - 1);
          if (rest) return [[from, to], ...rest];
        }
      }
      return null;
    };
    const path = findPath(board.start(tubes), 3);
    expect(path).not.toBeNull();
    const controller = createController({ solved: 260, current: 211 });
    for (const [from, to] of path) {
      await controller.tapTube(from);
      await controller.tapTube(to);
    }
    let before = board.start(tubes);
    for (const move of path.slice(0, -1)) before = board.pour(before, ...move).position;
    scene.pour.mockClear();

    controller.undo();
    expect(scene.pour).not.toHaveBeenCalled();
    expect(scene.showContents).toHaveBeenLastCalledWith(before.tubes);
  });

  it('caps a tube once the pour that completes it is under way, and uncaps it on undo', async () => {
    const controller = createController();
    const { tubes, board } = createLevelPuzzle(1);
    const moves = solveShortest(tubes, { board });
    let position = board.start(tubes);
    for (const [from, to] of moves) {
      position = board.pour(position, from, to).position;
      await controller.tapTube(from);
      await controller.tapTube(to);
      if (board.isComplete(position.tubes[to])) {
        // The scene was given the cap after the pour started, so it waits for the landing.
        expect(scene.pour.mock.invocationCallOrder.at(-1)).toBeLessThan(
          scene.showTubeStates.mock.invocationCallOrder.at(-1)
        );
        expect(scene.showTubeStates.mock.lastCall[0][to].capped).toBe(true);

        controller.undo();
        expect(scene.showTubeStates.mock.lastCall[0][to].capped).toBe(false);
        // The cap comes off before the liquid flows back.
        expect(scene.showTubeStates.mock.invocationCallOrder.at(-1)).toBeLessThan(
          scene.pour.mock.invocationCallOrder.at(-1)
        );
        return;
      }
    }
    throw new Error('No tube was completed');
  });

  it('points out the next move of the shortest solution as a hint, for one hint', () => {
    const controller = createController();
    const { tubes, board } = createLevelPuzzle(1);
    const [from, to] = solveShortest(tubes, { board })[0];

    controller.showHint();
    expect(scene.highlight).toHaveBeenCalledWith([from, to]);
    expect(hud.showToast).toHaveBeenCalledWith(
      `${from + 1}. tüpten ${to + 1}. tüpe dök. (İpucu +1 hamle)`
    );
    expect(saved.at(-1).hints).toBe(1);
    // The hint counts as a move.
    expect(lastRender()).toMatchObject({ hintCount: '1', subtitle: 'Kolay · 1 hamle' });

    // Asking again in the same position costs nothing, neither a hint nor a move.
    controller.showHint();
    expect(scene.highlight).toHaveBeenCalledTimes(2);
    expect(saved.at(-1).hints).toBe(1);
    expect(lastRender().subtitle).toBe('Kolay · 1 hamle');
  });

  it('rates a solution found with a hint one move longer', async () => {
    const controller = createController();
    controller.showHint();
    const [from, to] = scene.highlight.mock.lastCall[0];
    await controller.tapTube(from);
    await controller.tapTube(to);
    const { tubes, board } = createLevelPuzzle(1);
    const rest = solveShortest(board.pour(board.start(tubes), from, to).position, { board });
    for (const [next, target] of rest) {
      await controller.tapTube(next);
      await controller.tapTube(target);
    }

    expect(lastWin()).toMatchObject({ moves: 10, fewest: 9, stars: 2 });
  });

  it('does not give a hint back on undo, and says how to earn one when none is left', async () => {
    const controller = createController({ hints: 1 });
    controller.showHint();
    const [from, to] = scene.highlight.mock.lastCall[0];
    await controller.tapTube(from);
    await controller.tapTube(to);
    controller.undo();
    expect(saved.at(-1).hints).toBe(0);

    // Back in the hinted position: the same hint, still free.
    controller.showHint();
    expect(scene.highlight).toHaveBeenCalledTimes(2);

    await controller.tapTube(from);
    await controller.tapTube(to);
    controller.showHint();
    expect(scene.highlight).toHaveBeenCalledTimes(2);
    expect(hud.showToast).toHaveBeenLastCalledWith(
      'İpucu hakkın kalmadı. Günün bulmacasını çözünce 1 ipucu kazanırsın.',
      { long: true }
    );
    expect(lastRender()).toMatchObject({ hintCount: '0' });
  });

  it('lists the levels by stage, as solved, open or locked', () => {
    const controller = createController({ solved: 3, current: 2 });
    controller.showLevels();

    expect(lastMenu().chapters.map((chapter) => chapter.name)).toEqual([
      'Kolay',
      'Tek Yönlü',
      'Uzun Tüp',
      'Gizli Renk',
      'Çatlak Tüp',
      'Kilitli Tüp',
      'Yarım Tüp',
      'Yağ',
      'Usta'
    ]);
    expect(lastMenu().chapters[0]).toMatchObject({
      detail: 'Düz tüpler · sınırsız geri alma',
      progress: '3/15'
    });
    expect(lastMenu().chapters[1]).toMatchObject({
      detail: 'Tek yönlü tüp · 4 geri alma',
      progress: '0/20'
    });
    expect(lastMenu().chapters[3].detail).toBe('Alttaki renkler gizli · 3 geri alma');
    expect([1, 3, 4, 5].map((level) => tile(level).state)).toEqual([
      'solved',
      'solved',
      'open',
      'locked'
    ]);
    expect(tile(2)).toMatchObject({ playing: true, label: 'Seviye 2, çözüldü', stars: 0 });
    expect(tile(5).label).toBe('Seviye 5, kilitli');
    expect(lastMenu().daily).toMatchObject({ solved: false, playing: false, action: 'Oyna' });
  });

  it('shows the master levels ten at a time, up to the furthest open level', () => {
    const masterLevels = () =>
      lastMenu()
        .chapters.at(-1)
        .levels.map((tile) => tile.level);
    const controller = createController({ solved: 3, current: 4 });
    controller.showLevels();
    expect(masterLevels()).toEqual(range(261, 270));
    expect(lastMenu().chapters.at(-1)).toMatchObject({
      detail: 'Sonsuz · her seviyede 3–4 kural · 3 geri alma',
      progress: '0 çözüldü'
    });

    createController({ solved: 275, current: 276 }).showLevels();
    expect(masterLevels()).toEqual(range(261, 280));
    expect(lastMenu().chapters.at(-1).progress).toBe('15 çözüldü');
    expect(tile(276).state).toBe('open');
    expect(tile(277).state).toBe('locked');
  });

  it('plays a level picked from the list', () => {
    const controller = createController({ solved: 3, current: 4 });
    controller.showLevels();
    controller.playLevel(2);

    expect(saved.at(-1)).toMatchObject({ mode: 'level', current: 2 });
    expect(scene.showPuzzle).toHaveBeenLastCalledWith(...shownBoard(2));
    expect(menu.hide).toHaveBeenCalled();
    expect(lastRender().title).toBe('Seviye 2');
  });

  it('keeps locked levels closed', () => {
    const controller = createController({ solved: 3, current: 4 });
    scene.showPuzzle.mockClear();

    controller.playLevel(5);
    expect(scene.showPuzzle).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
  });

  it('switches to the daily puzzle from the list and saves the choice', () => {
    const controller = createController();
    controller.playDaily();

    expect(saved.at(-1)).toMatchObject({ mode: 'daily' });
    expect(lastRender().title).toBe('Günün bulmacası · 9 Ekim');
    controller.showLevels();
    expect(lastMenu().daily.playing).toBe(true);
  });

  it('moves on after a win and then shows the list with the next level current', async () => {
    const controller = createController();
    await playSolution(controller, createLevelPuzzle(1));

    controller.continueToLevels();
    expect(scene.showPuzzle).toHaveBeenLastCalledWith(...shownBoard(2));
    expect(tile(1).state).toBe('solved');
    expect(tile(2)).toMatchObject({ state: 'open', playing: true });
  });

  describe('limited undo', () => {
    async function pourOnce(controller, level) {
      const [[from, to]] = solve(createLevelPuzzle(level).tubes, {
        board: createLevelPuzzle(level).board
      });
      await controller.tapTube(from);
      await controller.tapTube(to);
      return [from, to];
    }

    it('lets a level take back as many moves as its stage allows, and a restart gives them back', async () => {
      const controller = createController({ solved: 20, current: 16 });
      expect(lastRender()).toMatchObject({
        undoCount: '4',
        undoLabel: 'Geri al: bu seviyede 4 hak'
      });

      for (let i = 0; i < 4; i++) {
        await pourOnce(controller, 16);
        controller.undo();
      }
      expect(lastRender()).toMatchObject({ undoCount: '0' });

      await pourOnce(controller, 16);
      expect(lastRender().canUndo).toBe(false);
      scene.pour.mockClear();
      controller.undo();
      expect(scene.pour).not.toHaveBeenCalled();

      controller.restart();
      expect(lastRender()).toMatchObject({ undoCount: '4', canUndo: false });
    });

    it('spends spare undos once the level runs out, and shows them on the button', async () => {
      const controller = createController({ solved: 20, current: 16, spareUndos: 2 });
      expect(lastRender()).toMatchObject({
        undoCount: '4+2',
        undoLabel: 'Geri al: bu seviyede 4 hak, 2 ekstra geri alma'
      });
      for (let i = 0; i < 4; i++) {
        await pourOnce(controller, 16);
        controller.undo();
      }
      expect(saved).toEqual([]);

      await pourOnce(controller, 16);
      expect(lastRender().canUndo).toBe(true);
      controller.undo();
      expect(saved.at(-1).spareUndos).toBe(1);
      expect(hud.showToast).toHaveBeenLastCalledWith('Ekstra geri alma kullandın; 1 kaldı.');
      expect(lastRender()).toMatchObject({ undoCount: '0+1', subtitle: 'Tek Yönlü · 0 hamle' });

      // A restart gives the level's undos back, but not the spare one.
      controller.restart();
      expect(lastRender().undoCount).toBe('4+1');
    });

    it('explains the limit where it starts and where it tightens', () => {
      const undoRule = () =>
        rules.show.mock.lastCall[0].rules.find((rule) => rule.id === 'limitedUndo');
      createController({ solved: 15, current: 16 });
      expect(undoRule().text).toMatch(/^Bu aşamada her seviyede 4 geri alma hakkın var/);
      createController({ solved: 60, current: 61 });
      expect(undoRule().text).toMatch(/^Bu aşamada her seviyede 3 geri alma hakkın var/);
    });

    it('leaves the easy stage and the daily puzzle without a limit, and spare undos aside', () => {
      createController({ solved: 14, current: 15, spareUndos: 3 });
      expect(lastRender()).toMatchObject({ undoCount: null, undoLabel: 'Geri al' });
      createController({ mode: 'daily', spareUndos: 3 });
      expect(lastRender()).toMatchObject({ undoCount: null, undoLabel: 'Geri al' });
    });
  });

  describe('new rules', () => {
    const shownRules = () => rules.show.mock.lastCall[0];

    it('explains the game on the very first level', () => {
      createController();
      expect(shownRules()).toMatchObject({
        title: 'Yeni kural',
        rules: [{ id: 'basics', name: 'Nasıl oynanır' }],
        action: 'Anladım'
      });
    });

    it('shows the rules a level brings in, until it is solved', () => {
      createController({ solved: 15, current: 16 });
      expect(shownRules()).toMatchObject({
        title: 'Yeni kurallar',
        rules: [{ id: 'limitedUndo' }, { id: 'oneWayTube', name: 'Tek yönlü tüp' }]
      });

      rules.show.mockClear();
      createController({ solved: 20, current: 16 });
      createController({ solved: 20, current: 17 });
      createController({ mode: 'daily' });
      expect(rules.show).not.toHaveBeenCalled();
    });

    it('shows every rule of the level, the stars and the last solutions from the info button', async () => {
      const controller = createController({
        solved: 90,
        current: 80,
        hints: 4,
        spareUndos: 1,
        records: {
          80: {
            best: 2,
            attempts: [
              { moves: 40, stars: 1 },
              { moves: 33, stars: 2 }
            ]
          }
        }
      });
      await Promise.resolve();
      controller.showInfo();

      const fewest = fewestMoves(createLevelPuzzle(80).tubes, {
        board: createLevelPuzzle(80).board
      }).moves;
      expect(shownRules()).toMatchObject({
        title: 'Seviye 80',
        info: true,
        rules: ['basics', 'limitedUndo', 'oneWayTube', 'tallTubes', 'hiddenColors'].map((id) => ({
          id
        })),
        stars: [
          { stars: 3, text: `${fewest} hamle (en az)` },
          { stars: 2, text: expect.stringMatching(/^\d+ hamleye kadar$/) },
          { stars: 1, text: 'Daha fazla hamle' }
        ],
        supplies: [
          'Bu seviyede 3 geri alma hakkından 3 tanesi kaldı.',
          expect.stringMatching(/^1 ekstra geri alman var \(en fazla 9 birikir\)\./),
          expect.stringMatching(/^4 ipucun var\./)
        ],
        attempts: [
          { moves: 33, stars: 2 },
          { moves: 40, stars: 1 }
        ],
        action: 'Kapat'
      });
    });

    it('says the stars are being worked out until the fewest moves are known', () => {
      const controller = createController({ solved: 90, current: 80 });
      controller.showInfo();
      expect(shownRules()).toMatchObject({ stars: null, starsPending: expect.any(String) });
    });
  });

  describe('half tubes', () => {
    it('gives the scene a short tube and explains it', () => {
      createController({ solved: 165, current: 166 });

      const [, { sizes }] = scene.showPuzzle.mock.lastCall;
      expect(sizes.at(-1)).toBe(2);
      expect(sizes.slice(0, -1).every((size) => size === 4)).toBe(true);
      expect(lastRender().subtitle).toBe('Yarım Tüp · 0 hamle');
      expect(rules.show.mock.lastCall[0].rules.map((rule) => rule.id)).toEqual(['halfTube']);
    });

    it('can be solved by tapping', async () => {
      const controller = createController({ solved: 170, current: 166 });
      await playSolution(controller, createLevelPuzzle(166));
      expect(scene.celebrate).toHaveBeenCalledOnce();
    });
  });

  describe('hidden colors and tall tubes', () => {
    it('shows only the top colors on a hidden-color level', () => {
      createController({ solved: 70, current: 61 });

      const [shown, options] = scene.showPuzzle.mock.lastCall;
      const real = createLevelPuzzle(61).tubes;
      expect(options).toMatchObject({ sizes: tubeSizes(levelSettings(61)) });
      shown.forEach((tube, i) => {
        expect(tube.length).toBe(real[i].length);
        if (tube.length > 0) expect(tube.at(-1)).toBe(real[i].at(-1));
        expect(tube.slice(0, -1).every((color) => color === HIDDEN)).toBe(true);
      });
      expect(lastRender().subtitle).toBe('Gizli Renk · 0 hamle');
    });

    it('gives a tall-tube level its capacity', () => {
      createController({ solved: 70, current: 36 });

      expect(scene.showPuzzle).toHaveBeenLastCalledWith(...shownBoard(36));
      expect(scene.showPuzzle.mock.lastCall[1].sizes[0]).toBe(5);
      expect(lastRender().subtitle).toBe('Uzun Tüp · 0 hamle');
    });

    it('names the earlier rules a level mixes in after its stage', () => {
      createController({ solved: 90, current: 45 });
      expect(lastRender().subtitle).toBe('Uzun Tüp · Tek yönlü · 0 hamle');
      createController({ solved: 90, current: 80 });
      expect(lastRender().subtitle).toBe('Gizli Renk · Tek yönlü · Uzun tüp · 0 hamle');
      // Past two, the subtitle only counts them; the info button lists them.
      createController({ solved: 275, current: 270 });
      expect(lastRender().subtitle).toBe('Usta · 4 kural · 0 hamle');
    });

    it('explains a rule at the first level of its stage, and only there', () => {
      createController({ solved: 60, current: 61 });
      expect(rules.show.mock.lastCall[0].rules.map((rule) => rule.id)).toContain('hiddenColors');

      rules.show.mockClear();
      createController({ solved: 61, current: 62 });
      expect(rules.show).not.toHaveBeenCalled();
    });

    it('can be solved by tapping, with the real colors underneath', async () => {
      const controller = createController({ solved: 90, current: 80 });
      await playSolution(controller, createLevelPuzzle(80));
      expect(scene.celebrate).toHaveBeenCalledOnce();
      expect(saved.at(-1)).toMatchObject({ solved: 90, current: 81 });
    });
  });

  describe('carrying progress to another device', () => {
    it('shows the code of the solved levels in place of the level list', () => {
      const controller = createController({ solved: 79, current: 12 });
      controller.showLevels();
      controller.showTransfer();

      expect(menu.hide).toHaveBeenCalled();
      expect(decodeProgressCode(transfer.show.mock.lastCall[0].code)).toBe(79);
    });

    it('takes over progress that is further along and goes to the next level', () => {
      const controller = createController({ solved: 3, current: 2 });
      controller.importProgress(encodeProgressCode(40));

      expect(saved.at(-1)).toMatchObject({ mode: 'level', solved: 40, current: 41 });
      expect(scene.showPuzzle).toHaveBeenLastCalledWith(...shownBoard(41));
      expect(transfer.hide).toHaveBeenCalled();
      expect(hud.showToast).toHaveBeenCalledWith('İlerleme yüklendi: 40 seviye çözülmüş.');
    });

    it('never goes back to progress that is behind', () => {
      const controller = createController({ solved: 85, current: 86 });
      scene.showPuzzle.mockClear();
      controller.importProgress(encodeProgressCode(79));

      expect(saved).toEqual([]);
      expect(scene.showPuzzle).not.toHaveBeenCalled();
      expect(hud.showToast).toHaveBeenCalledWith(
        'Bu cihazda zaten 85 seviye çözülmüş, ilerleme değişmedi.'
      );
    });

    it('says in the dialog when a typed code is wrong', () => {
      const controller = createController({ solved: 5, current: 6 });
      controller.importProgress('ABCDE');

      expect(transfer.showError).toHaveBeenCalledWith('Bu kod geçersiz. Harfleri kontrol et.');
      expect(transfer.hide).not.toHaveBeenCalled();
      expect(saved).toEqual([]);
    });

    it('says in a toast when the code in a link is wrong', () => {
      const controller = createController();
      controller.importProgress('ABCDE', { fromLink: true });

      expect(hud.showToast).toHaveBeenCalledWith('Bu kod geçersiz. Harfleri kontrol et.');
      expect(transfer.showError).not.toHaveBeenCalled();
    });

    it('leaves the daily puzzle for the levels when progress arrives', () => {
      const controller = createController({ mode: 'daily', solved: 0, current: 1 });
      controller.importProgress(encodeProgressCode(20));

      expect(lastRender().title).toBe('Seviye 21');
    });
  });

  describe('special tubes', () => {
    it('tells the scene which tubes are one-way, cracked and locked, and which colors are oil', () => {
      for (const level of [16, 91, 126, 211]) createController({ solved: 260, current: level });
      const calls = scene.showPuzzle.mock.calls.slice(-4).map(([, options]) => options);

      expect(calls[0].kinds.some((kind) => kind.oneWay)).toBe(true);
      expect(calls[1].kinds.some((kind) => kind.fills === 3)).toBe(true);
      expect(calls[2].kinds.some((kind) => kind.lockKey !== null)).toBe(true);
      expect(calls[3].oilColors).toHaveLength(1);
    });

    it('names the stage of each new kind of tube and explains it once', () => {
      const subtitles = {
        16: 'Tek Yönlü · 0 hamle',
        91: 'Çatlak Tüp · 0 hamle',
        126: 'Kilitli Tüp · 0 hamle',
        211: 'Yağ · 0 hamle'
      };
      for (const [level, subtitle] of Object.entries(subtitles)) {
        rules.show.mockClear();
        createController({ solved: Number(level) - 1, current: Number(level) });
        expect(lastRender().subtitle).toBe(subtitle);
        expect(rules.show).toHaveBeenCalledOnce();
      }
    });

    it('melts the lock only once the opening pour has landed', async () => {
      const controller = createController({ solved: 260, current: 126 });
      const { tubes, board } = createLevelPuzzle(126);
      const locked = [...board.locks.keys()][0];
      const showsLocked = () => scene.showTubeStates.mock.lastCall[0][locked].locked;

      let landing;
      scene.pour.mockImplementation(() => new Promise((resolve) => (landing = resolve)));
      const moves = solve(tubes, { board });
      // Play until the move that opens the lock starts.
      let position = board.start(tubes);
      for (const [from, to] of moves) {
        const next = board.pour(position, from, to).position;
        await controller.tapTube(from);
        const pouring = controller.tapTube(to);
        if (!board.isLocked(next, locked)) {
          expect(showsLocked()).toBe(true);
          landing();
          await pouring;
          expect(showsLocked()).toBe(false);
          return;
        }
        landing();
        await pouring;
        position = next;
      }
      throw new Error('The lock never opened');
    });

    it('can solve every new kind of level by tapping', async () => {
      for (const level of [16, 36, 61, 91, 126, 150, 166, 211, 240, 261, 262]) {
        scene.celebrate.mockClear();
        const controller = createController({ solved: 270, current: level });
        await playSolution(controller, createLevelPuzzle(level));
        expect(scene.celebrate).toHaveBeenCalledOnce();
      }
    });
  });

  describe('custom puzzles', () => {
    const custom = () => ({
      ...withRandomFill(emptyPuzzle(6), 4, createRandom(3)),
      undoLimit: 2
    });

    it('plays a puzzle from the editor without touching the progress, and goes back to it', async () => {
      const onEditPuzzle = vi.fn();
      const controller = createController(
        { solved: 5, current: 6, spareUndos: 3 },
        { onEditPuzzle }
      );
      controller.playCustom(custom(), { fromEditor: true });

      expect(scene.showPuzzle).toHaveBeenLastCalledWith(boardOf(custom()).tubes, expect.anything());
      expect(lastRender()).toMatchObject({
        title: 'Senin bulmacan',
        subtitle: '0 hamle',
        undoCount: '2',
        levelsLabel: 'Atölye'
      });

      const moves = await playSolution(controller, boardOf(custom()), { shortest: true });
      expect(lastWin()).toMatchObject({
        stars: 3,
        moves: moves.length,
        attempts: null,
        notes: [],
        continueLabel: 'Atölyeye dön'
      });
      expect(saved).toEqual([]);

      controller.continueAfterWin();
      expect(onEditPuzzle).toHaveBeenCalledWith(custom());
      expect(lastRender().title).toBe('Seviye 6');
    });

    it('gives free hints on your own puzzle, and goes back to the editor from the levels button', () => {
      const onEditPuzzle = vi.fn();
      const controller = createController({ hints: 0 }, { onEditPuzzle });
      controller.playCustom(custom(), { fromEditor: true });
      controller.showHint();
      expect(scene.highlight).toHaveBeenCalled();
      expect(saved).toEqual([]);

      controller.showLevels();
      expect(menu.show).not.toHaveBeenCalled();
      expect(onEditPuzzle).toHaveBeenCalled();
    });

    it('plays a shared puzzle like a level, with its hints counted, and leaves it for the levels', async () => {
      const controller = createController({ solved: 5, current: 6 });
      controller.playCustom(custom());
      expect(lastRender()).toMatchObject({ title: 'Paylaşılan bulmaca', levelsLabel: 'Seviyeler' });
      controller.showHint();
      expect(saved.at(-1).hints).toBe(1);

      await playSolution(controller, boardOf(custom()));
      expect(lastWin().continueLabel).toBe('Devam et');
      controller.continueAfterWin();
      expect(lastRender().title).toBe('Seviye 6');
    });

    it('spends no spare undos on a custom puzzle', async () => {
      const controller = createController({ spareUndos: 4 });
      const puzzle = { ...custom(), undoLimit: 0 };
      controller.playCustom(puzzle, { fromEditor: true });
      const [[from, to]] = solve(boardOf(puzzle).tubes, { board: boardOf(puzzle).board });
      await controller.tapTube(from);
      await controller.tapTube(to);
      expect(lastRender()).toMatchObject({ canUndo: false, undoCount: '0' });
    });
  });
});
