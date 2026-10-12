import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameController } from '../src/app/controller.js';
import { decodeProgressCode, encodeProgressCode } from '../src/app/progressCode.js';
import { tubeSizes } from '../src/game/generator.js';
import {
  CHAPTER_LEVEL_COUNT,
  createLevelPuzzle,
  levelSettings,
  LEVELS_PER_CHAPTER
} from '../src/game/levels.js';
import { HIDDEN } from '../src/game/rules.js';
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
  let saved;

  function createController(progress = {}) {
    const controller = new GameController({
      scene,
      hud,
      menu,
      transfer,
      progress: { mode: 'level', solved: 0, current: 1, dailyDone: null, ...progress },
      saveProgress: (value) => saved.push(value),
      now: () => TODAY
    });
    controller.start();
    return controller;
  }

  /** Plays a level's solution, or the solution of plain tubes (such as a daily puzzle). */
  async function playSolution(controller, puzzle) {
    const { tubes, board } = Array.isArray(puzzle) ? { tubes: puzzle } : puzzle;
    for (const [from, to] of solve(tubes, { board })) {
      await controller.tapTube(from);
      await controller.tapTube(to);
    }
  }

  const lastRender = () => hud.render.mock.lastCall[0];
  const lastMenu = () => menu.show.mock.lastCall[0];
  const tile = (level) => lastMenu().chapters.flatMap((chapter) => chapter.levels)[level - 1];

  beforeEach(() => {
    scene = fakeScene();
    hud = fakeHud();
    menu = fakeMenu();
    transfer = fakeTransfer();
    saved = [];
  });

  it('starts the saved level', () => {
    createController({ solved: 5, current: 3 });

    expect(scene.showPuzzle).toHaveBeenCalledWith(...shownBoard(3));
    expect(lastRender()).toEqual({
      title: 'Seviye 3',
      subtitle: 'Kolay · 0 hamle',
      canUndo: false,
      undoLabel: 'Geri al'
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
    await playSolution(controller, createLevelPuzzle(1));

    expect(scene.celebrate).toHaveBeenCalledOnce();
    expect(saved.at(-1)).toMatchObject({ mode: 'level', solved: 1, current: 2 });
    expect(hud.showWin).toHaveBeenCalledWith({
      message: expect.stringMatching(/^\d+ hamlede çözdün\.$/),
      continueLabel: 'Sonraki seviye'
    });

    controller.continueAfterWin();
    expect(scene.showPuzzle).toHaveBeenLastCalledWith(...shownBoard(2));
    expect(lastRender().title).toBe('Seviye 2');
  });

  it('marks the daily puzzle as solved and returns to the levels', async () => {
    const controller = createController({ mode: 'daily', solved: 3, current: 4 });
    expect(lastRender().title).toBe('Günün bulmacası · 9 Ekim');

    await playSolution(controller, scene.showPuzzle.mock.lastCall[0]);
    expect(saved.at(-1)).toEqual({
      mode: 'daily',
      solved: 3,
      current: 4,
      dailyDone: '2026-10-09'
    });
    expect(hud.showWin).toHaveBeenCalledWith(
      expect.objectContaining({ continueLabel: 'Devam et' })
    );

    controller.continueAfterWin();
    expect(saved.at(-1)).toMatchObject({ mode: 'level', current: 4 });
    expect(scene.showPuzzle).toHaveBeenLastCalledWith(...shownBoard(4));
  });

  it('announces the next chapter after its last level', async () => {
    const controller = createController({ solved: 14, current: LEVELS_PER_CHAPTER });
    await playSolution(controller, createLevelPuzzle(LEVELS_PER_CHAPTER));

    expect(hud.showWin.mock.lastCall[0].message).toMatch(/Orta seviyeler açıldı!$/);
  });

  it('does not announce a chapter again when an old level is replayed', async () => {
    const controller = createController({ solved: 20, current: LEVELS_PER_CHAPTER });
    await playSolution(controller, createLevelPuzzle(LEVELS_PER_CHAPTER));

    expect(hud.showWin.mock.lastCall[0].message).toMatch(/^\d+ hamlede çözdün\.$/);
    expect(saved.at(-1)).toMatchObject({ solved: 20, current: LEVELS_PER_CHAPTER + 1 });
  });

  it('opens the master levels after the last chapter, and goes on after them', async () => {
    const controller = createController({ solved: 59, current: CHAPTER_LEVEL_COUNT });
    await playSolution(controller, createLevelPuzzle(CHAPTER_LEVEL_COUNT));

    expect(hud.showWin.mock.lastCall[0]).toEqual({
      message: expect.stringMatching(/Usta seviyeler açıldı!$/),
      continueLabel: 'Sonraki seviye'
    });
    controller.continueAfterWin();
    expect(lastRender()).toEqual({
      title: 'Seviye 61',
      subtitle: 'Usta · 0 hamle',
      canUndo: false,
      undoLabel: 'Geri al (3)'
    });
  });

  it('does not announce anything at the end of a block of master levels', async () => {
    const controller = createController({ solved: 74, current: 75 });
    await playSolution(controller, createLevelPuzzle(75));

    expect(hud.showWin.mock.lastCall[0].message).toMatch(/^\d+ hamlede çözdün\.$/);
    expect(saved.at(-1)).toMatchObject({ solved: 75, current: 76 });
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

  it('undoes a move and shows the previous board', async () => {
    const controller = createController();
    const [from, to] = solve(createLevelPuzzle(1).tubes)[0];
    await controller.tapTube(from);
    await controller.tapTube(to);

    controller.undo();
    expect(scene.showContents).toHaveBeenLastCalledWith(createLevelPuzzle(1).tubes);
    expect(lastRender()).toMatchObject({ subtitle: 'Kolay · 0 hamle', canUndo: false });
  });

  it('points out the next move as a hint', () => {
    const controller = createController();
    const [from, to] = solve(createLevelPuzzle(1).tubes)[0];

    controller.showHint();
    expect(scene.highlight).toHaveBeenCalledWith([from, to]);
    expect(hud.showToast).toHaveBeenCalledWith(`${from + 1}. tüpten ${to + 1}. tüpe dök.`);
  });

  it('lists the levels as solved, open or locked', () => {
    const controller = createController({ solved: 3, current: 2 });
    controller.showLevels();

    expect(lastMenu().chapters.map((chapter) => chapter.name)).toEqual([
      'Kolay',
      'Orta',
      'Zor',
      'Uzman',
      'Usta'
    ]);
    expect(lastMenu().chapters[0]).toMatchObject({ detail: '3–5 renk', progress: '3/15' });
    expect(lastMenu().chapters[3].detail).toBe('6–7 renk · tek boş tüp');
    expect([1, 3, 4, 5].map((level) => tile(level).state)).toEqual([
      'solved',
      'solved',
      'open',
      'locked'
    ]);
    expect(tile(2)).toMatchObject({ playing: true, label: 'Seviye 2, çözüldü' });
    expect(tile(5).label).toBe('Seviye 5, kilitli');
    expect(lastMenu().daily).toMatchObject({ solved: false, playing: false, action: 'Oyna' });
  });

  it('shows the master levels a block at a time, up to the furthest open level', () => {
    const masterLevels = () =>
      lastMenu()
        .chapters.at(-1)
        .levels.map((tile) => tile.level);
    const controller = createController({ solved: 3, current: 4 });
    controller.showLevels();
    expect(masterLevels()).toEqual(range(61, 75));
    expect(lastMenu().chapters.at(-1)).toMatchObject({
      detail: 'Sonsuz · 3 geri alma · her seviyede özel bir kural',
      progress: '0 çözüldü'
    });

    createController({ solved: 75, current: 76 }).showLevels();
    expect(masterLevels()).toEqual(range(61, 90));
    expect(lastMenu().chapters.at(-1).progress).toBe('15 çözüldü');
    expect(tile(76).state).toBe('open');
    expect(tile(77).state).toBe('locked');
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

    it('lets a master level take back three moves, and a restart gives them back', async () => {
      const controller = createController({ solved: 60, current: 61 });
      expect(lastRender().undoLabel).toBe('Geri al (3)');

      for (let i = 0; i < 3; i++) {
        await pourOnce(controller, 61);
        controller.undo();
      }
      expect(lastRender()).toMatchObject({ undoLabel: 'Geri al (0)' });

      await pourOnce(controller, 61);
      expect(lastRender().canUndo).toBe(false);
      scene.showContents.mockClear();
      controller.undo();
      expect(scene.showContents).not.toHaveBeenCalled();

      controller.restart();
      expect(lastRender()).toMatchObject({ undoLabel: 'Geri al (3)', canUndo: false });
    });

    it('explains the limit at the first master level', () => {
      createController({ solved: 60, current: 61 });
      expect(hud.showToast).toHaveBeenCalledWith(
        'Usta seviyelerinde 3 geri alma hakkın var; baştan başlayınca yenilenir.',
        { long: true }
      );
    });

    it('leaves the chapters and the daily puzzle without a limit', () => {
      createController({ solved: 59, current: 60 });
      expect(lastRender().undoLabel).toBe('Geri al');
      createController({ mode: 'daily' });
      expect(lastRender().undoLabel).toBe('Geri al');
    });
  });

  describe('half tubes', () => {
    it('gives the scene a short tube and names it', () => {
      createController({ solved: 70, current: 67 });

      const [, { sizes }] = scene.showPuzzle.mock.lastCall;
      expect(sizes.at(-1)).toBe(2);
      expect(sizes.slice(0, -1).every((size) => size === 4)).toBe(true);
      expect(lastRender().subtitle).toBe('Usta · Yarım tüp · 0 hamle');
      expect(hud.showToast).toHaveBeenCalledWith(expect.stringMatching(/^Yarım tüp/), {
        long: true
      });
    });

    it('can be solved by tapping', async () => {
      const controller = createController({ solved: 66, current: 67 });
      const moves = solve(createLevelPuzzle(67).tubes, { board: createLevelPuzzle(67).board });
      for (const [from, to] of moves) {
        await controller.tapTube(from);
        await controller.tapTube(to);
      }
      expect(scene.celebrate).toHaveBeenCalledOnce();
    });
  });

  describe('hidden colors and tall tubes', () => {
    it('shows only the top colors on a hidden-color level and names the rule', () => {
      createController({ solved: 70, current: 65 });

      const [shown, options] = scene.showPuzzle.mock.lastCall;
      const real = createLevelPuzzle(65).tubes;
      expect(options).toMatchObject({ sizes: tubeSizes(levelSettings(65)) });
      shown.forEach((tube, i) => {
        expect(tube.length).toBe(real[i].length);
        if (tube.length > 0) expect(tube.at(-1)).toBe(real[i].at(-1));
        expect(tube.slice(0, -1).every((color) => color === HIDDEN)).toBe(true);
      });
      expect(lastRender().subtitle).toBe('Usta · Gizli renk · 0 hamle');
    });

    it('gives a tall-tube level its capacity', () => {
      createController({ solved: 70, current: 66 });

      expect(scene.showPuzzle).toHaveBeenLastCalledWith(...shownBoard(66));
      expect(lastRender().subtitle).toBe('Usta · Uzun tüp · 0 hamle');
    });

    it('names both rules when a level has both', () => {
      createController({ solved: 70, current: 68 });
      expect(lastRender().subtitle).toBe('Usta · Gizli renk · Uzun tüp · 0 hamle');
    });

    it('explains a rule at the first level that uses it, and only there', () => {
      createController({ solved: 70, current: 65 });
      expect(hud.showToast).toHaveBeenCalledWith(expect.stringMatching(/^Gizli renkler:/), {
        long: true
      });

      hud.showToast.mockClear();
      createController({ solved: 80, current: 77 });
      expect(hud.showToast).not.toHaveBeenCalled();
    });

    it('can be solved by tapping, with the real colors underneath', async () => {
      const controller = createController({ solved: 67, current: 68 });
      await playSolution(controller, createLevelPuzzle(68));
      expect(scene.celebrate).toHaveBeenCalledOnce();
      expect(saved.at(-1)).toMatchObject({ solved: 68, current: 69 });
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
      controller.importProgress(encodeProgressCode(72));

      expect(saved.at(-1)).toMatchObject({ mode: 'level', solved: 72, current: 73 });
      expect(scene.showPuzzle).toHaveBeenLastCalledWith(...shownBoard(73));
      expect(transfer.hide).toHaveBeenCalled();
      expect(hud.showToast).toHaveBeenCalledWith('İlerleme yüklendi: 72 seviye çözülmüş.');
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
      for (const level of [73, 74, 75, 76]) createController({ solved: 80, current: level });
      const calls = scene.showPuzzle.mock.calls.slice(-4).map(([, options]) => options);

      expect(calls[0].kinds.some((kind) => kind.oneWay)).toBe(true);
      expect(calls[1].kinds.some((kind) => kind.fills === 3)).toBe(true);
      expect(calls[2].kinds.some((kind) => kind.lockKey !== null)).toBe(true);
      expect(calls[3].oilColors).toHaveLength(1);
    });

    it('names the rule of each new kind of tube and explains it once', () => {
      const subtitles = {
        73: 'Usta · Tek yönlü · 0 hamle',
        74: 'Usta · Çatlak tüp · 0 hamle',
        75: 'Usta · Kilitli tüp · 0 hamle',
        76: 'Usta · Yağ · 0 hamle'
      };
      for (const [level, subtitle] of Object.entries(subtitles)) {
        hud.showToast.mockClear();
        createController({ solved: 80, current: Number(level) });
        expect(lastRender().subtitle).toBe(subtitle);
        expect(hud.showToast).toHaveBeenCalledOnce();
      }
    });

    it('melts the lock only once the opening pour has landed', async () => {
      const controller = createController({ solved: 80, current: 75 });
      const { tubes, board } = createLevelPuzzle(75);
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
      for (const level of [73, 74, 75, 76, 77, 78, 79, 80]) {
        scene.celebrate.mockClear();
        const controller = createController({ solved: 80, current: level });
        await playSolution(controller, createLevelPuzzle(level));
        expect(scene.celebrate).toHaveBeenCalledOnce();
      }
    });
  });
});
