import { describe, expect, it, vi } from 'vitest';
import { MAX_COLOR_COUNT } from '../src/game/levels.js';
import { Animator, easeInOutCubic, linear } from '../src/scene/animator.js';
import { advancePieces, launchPieces } from '../src/scene/confetti.js';
import { HIDDEN } from '../src/game/rules.js';
import {
  ROW_GAP,
  SEGMENT_HEIGHT,
  TUBE_HEIGHT,
  TUBE_RADIUS,
  TUBE_SPACING,
  tubeHeight
} from '../src/scene/dimensions.js';
import { arrangeTubes, fitToView } from '../src/scene/layout.js';
import { CONFETTI_COLORS, HIDDEN_COLOR, LIQUID_COLORS } from '../src/scene/palette.js';
import { closeCap, openCap } from '../src/scene/motions.js';
import { animatePour } from '../src/scene/pour.js';
import { createRandom } from '../src/game/random.js';
import { drawScene } from '../src/scene/renderer.js';
import { TubeView } from '../src/scene/tubeView.js';

describe('palette', () => {
  it('has a distinct color for every color a level can use', () => {
    expect(new Set(LIQUID_COLORS).size).toBeGreaterThanOrEqual(MAX_COLOR_COUNT);
  });
});

describe('arrangeTubes', () => {
  const rowsOf = ({ positions }) => {
    const rows = new Map();
    for (const { x, y } of positions) rows.set(y, [...(rows.get(y) ?? []), x]);
    return [...rows.values()];
  };

  it('keeps a small board on one centered row', () => {
    const { positions } = arrangeTubes(5, 1);
    expect(positions.map((p) => p.x)).toEqual([-2, -1, 0, 1, 2].map((n) => n * TUBE_SPACING));
    expect(new Set(positions.map((p) => p.y)).size).toBe(1);
  });

  it('splits a board into even rows on a narrow screen', () => {
    const rows = rowsOf(arrangeTubes(9, 0.5));
    expect(rows.map((row) => row.length)).toEqual([3, 3, 3]);
  });

  it('centers a shorter last row', () => {
    const rows = rowsOf(arrangeTubes(7, 0.5));
    expect(rows.map((row) => row.length)).toEqual([4, 3]);
    expect(rows[1][0] + rows[1][2]).toBeCloseTo(0);
  });

  it('uses longer rows on wide screens', () => {
    expect(rowsOf(arrangeTubes(12, 1.8)).map((row) => row.length)).toEqual([6, 6]);
  });
});

describe('fitToView', () => {
  const { bounds } = arrangeTubes(5, 1);
  const toScreenY = (view, y) => view.originY - y * view.scale;

  it('keeps the whole arrangement on screen, below the HUD', () => {
    const view = fitToView(bounds, 390, 844, 110);
    expect(toScreenY(view, bounds.top)).toBeGreaterThan(110);
    expect(toScreenY(view, bounds.bottom)).toBeLessThan(844);
    expect((bounds.width / 2) * view.scale).toBeLessThan(390 / 2);
  });

  it('centers the arrangement horizontally', () => {
    expect(fitToView(bounds, 800, 600).originX).toBe(400);
  });

  it('does not blow tubes up on very large screens', () => {
    const huge = fitToView(bounds, 5000, 4000);
    const large = fitToView(bounds, 2500, 2000);
    expect(huge.scale).toBe(large.scale);
  });
});

describe('animatePour', () => {
  // Drives the animator frame by frame on a fake clock until the pour has finished. The clock
  // also stands in for performance.now(), so tweens start at the frame they start in.
  async function play(animator, promise) {
    let done = false;
    promise.then(() => (done = true));
    let now = 1000;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
    try {
      for (let i = 0; i < 500 && !done; i++) {
        now += 16;
        animator.tick(now);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } finally {
      clock.mockRestore();
    }
    return done;
  }

  it('moves the liquid, shows a stream while pouring, and puts the tube back', async () => {
    const animator = new Animator();
    const stream = { visible: false, color: 0, x: 0, top: 0, bottom: 0 };
    const source = new TubeView(0);
    const target = new TubeView(1);
    source.showColors([0, 1, 1]);
    target.showColors([1]);
    target.x = TUBE_SPACING;

    let sawStream = false;
    const original = animator.tick.bind(animator);
    animator.tick = (now) => {
      original(now);
      if (stream.visible) sawStream = stream.top > stream.bottom;
    };

    const finished = await play(
      animator,
      animatePour({ animator, stream, source, target, amount: 2 })
    );

    expect(finished).toBe(true);
    expect(sawStream).toBe(true);
    expect(stream.visible).toBe(false);
    expect(source.segments.map((s) => s.fill)).toEqual([1, 0, 0]);
    expect(target.segments.map((s) => [s.color, s.slot, s.fill])).toEqual([
      [1, 0, 1],
      [1, 1, 1],
      [1, 2, 1]
    ]);
    expect(source.body).toEqual({ x: 0, y: TUBE_HEIGHT, tilt: 0 });
  });

  it('keeps the lip in one place and tilts further as the tube empties', async () => {
    const animator = new Animator();
    const stream = { visible: false, color: 0, x: 0, top: 0, bottom: 0 };
    const source = new TubeView(0);
    const target = new TubeView(1);
    source.showColors([0, 1, 1]);
    target.showColors([1]);
    source.x = -TUBE_SPACING;
    target.x = TUBE_SPACING;

    const poses = [];
    const original = animator.tick.bind(animator);
    animator.tick = (now) => {
      original(now);
      if (stream.visible) poses.push({ ...source.body });
    };
    await play(animator, animatePour({ animator, stream, source, target, amount: 2 }));

    // The target is right of center, so the source pours with its right lip (tilting clockwise).
    const lips = poses.map(({ x, y, tilt }) => ({
      x: source.x + x + TUBE_RADIUS * Math.cos(tilt),
      y: source.y + y + TUBE_RADIUS * Math.sin(tilt)
    }));
    expect(poses.length).toBeGreaterThan(3);
    for (const lip of lips) {
      expect(lip.x).toBeCloseTo(lips[0].x, 6);
      expect(lip.y).toBeCloseTo(lips[0].y, 6);
    }
    const tilts = poses.map((pose) => -pose.tilt);
    expect(tilts.at(-1)).toBeGreaterThan(tilts[0]);
    tilts.slice(1).forEach((tilt, i) => expect(tilt).toBeGreaterThanOrEqual(tilts[i] - 1e-9));
  });

  it('lets water sink under the oil of the target, which rises', async () => {
    const animator = new Animator();
    const stream = { visible: false, color: 0, x: 0, top: 0, bottom: 0 };
    const source = new TubeView(0);
    const target = new TubeView(1);
    source.showColors([2, 1]);
    target.showColors([1, 5]);
    const isOil = (color) => color === 5;

    await play(animator, animatePour({ animator, stream, source, target, amount: 1, isOil }));
    const layers = target.segments.slice().sort((a, b) => a.slot - b.slot);
    expect(layers.map((s) => [s.color, s.slot])).toEqual([
      [1, 0],
      [1, 1],
      [5, 2]
    ]);
  });

  it('shows hidden units of the poured color as they leave', async () => {
    const animator = new Animator();
    const stream = { visible: false, color: 0, x: 0, top: 0, bottom: 0 };
    const source = new TubeView(0);
    const target = new TubeView(1);
    source.showColors([HIDDEN, HIDDEN, 4]);
    target.showColors([]);

    await play(animator, animatePour({ animator, stream, source, target, amount: 2 }));
    expect(source.segments.map((s) => s.color)).toEqual([HIDDEN, 4, 4]);
    expect(target.segments.map((s) => s.color)).toEqual([4, 4]);
  });
});

describe('half tubes', () => {
  it('are shorter, and stand on the same line as the others in their row', () => {
    const half = new TubeView(0, 2);
    expect(half.height).toBeCloseTo(TUBE_HEIGHT - 2 * SEGMENT_HEIGHT);
    expect(half.body.y).toBe(half.height);
  });
});

describe('tall tubes', () => {
  it('are taller by one segment for each extra unit', () => {
    const tall = new TubeView(0, 5);
    expect(tall.height).toBeCloseTo(TUBE_HEIGHT + SEGMENT_HEIGHT);
    expect(tall.body.y).toBe(tall.height);
    expect(tubeHeight(4)).toBe(TUBE_HEIGHT);
  });

  it('get rows spaced for their height', () => {
    const { positions, bounds } = arrangeTubes(9, 0.5, tubeHeight(5));
    const rowYs = [...new Set(positions.map((p) => p.y))];
    expect(rowYs[0] - rowYs[1]).toBeCloseTo(tubeHeight(5) + ROW_GAP);
    expect(bounds.top).toBeGreaterThan(arrangeTubes(9, 0.5).bounds.top);
  });
});

// A stand-in canvas context that accepts every drawing call and records fills and text.
function recordingContext() {
  const fills = [];
  const texts = [];
  const strokes = [];
  const record = {
    fillRect: (...args) => fills.push({ style: ctx.fillStyle, args }),
    fill: () => fills.push({ style: ctx.fillStyle }),
    stroke: () => strokes.push(ctx.strokeStyle),
    fillText: (text) => texts.push(text)
  };
  const ctx = new Proxy(
    { fills, texts, strokes },
    {
      get: (target, name) => (name in target ? target[name] : (record[name] ?? (() => {}))),
      set: (target, name, value) => ((target[name] = value), true)
    }
  );
  return ctx;
}

describe('drawScene', () => {
  const sceneWith = (tubes) => ({
    width: 400,
    height: 800,
    tubes,
    streams: [],
    view: { scale: 50, originX: 200, originY: 600 },
    glassColor: '#ffffff'
  });

  it('draws the liquid of a tilted tube in its colors, with level surfaces', () => {
    const tube = new TubeView(0);
    tube.showColors([2, 5]);
    tube.body.tilt = 0.9;
    const ctx = recordingContext();
    drawScene(ctx, sceneWith([tube]));

    const styles = ctx.fills.map((fill) => fill.style);
    expect(styles).toContain(LIQUID_COLORS[2]);
    expect(styles).toContain(LIQUID_COLORS[5]);
  });

  it('draws a locked tube with a badge in its key color', () => {
    const tube = new TubeView(0, 4, { lockKey: 6 });
    tube.showColors([1, 2]);
    const ctx = recordingContext();
    drawScene(ctx, sceneWith([tube]));

    expect(ctx.fills.map((fill) => fill.style)).toContain(LIQUID_COLORS[6]);
  });

  it('draws a hidden unit as a question mark instead of its color', () => {
    const tube = new TubeView(0);
    tube.showColors([HIDDEN, HIDDEN, 3]);
    const ctx = recordingContext();
    drawScene(ctx, sceneWith([tube]));

    const styles = ctx.fills.map((fill) => fill.style);
    expect(styles.filter((style) => style === HIDDEN_COLOR)).toHaveLength(2);
    expect(styles).toContain(LIQUID_COLORS[3]);
    expect(ctx.texts).toEqual(['?', '?']);
  });

  it('draws each liquid segment and the stream in its own color', () => {
    const tube = new TubeView(0);
    tube.showColors([2, 5]);
    tube.setGlow(0.5);
    const ctx = recordingContext();
    drawScene(ctx, {
      width: 400,
      height: 800,
      tubes: [tube],
      streams: [{ visible: true, color: 7, x: 0, top: 4, bottom: 2 * SEGMENT_HEIGHT }],
      view: { scale: 50, originX: 200, originY: 600 },
      glassColor: '#ffffff'
    });

    const styles = ctx.fills.map((fill) => fill.style);
    expect(styles).toContain(LIQUID_COLORS[2]);
    expect(styles).toContain(LIQUID_COLORS[5]);
    expect(ctx.strokes.at(-1)).toBe(LIQUID_COLORS[7]);
  });
});

describe('caps', () => {
  it('drops onto a complete tube, presses in a little and settles', () => {
    const animator = new Animator();
    const tube = new TubeView(0);
    const start = performance.now();
    const values = [];
    closeCap(animator, tube);
    for (let ms = 0; ms <= 400; ms += 20) {
      animator.tick(start + ms);
      values.push(tube.cap);
    }
    expect(Math.max(...values)).toBeGreaterThan(1);
    expect(values.at(-1)).toBe(1);
  });

  it('lifts off from wherever it is', () => {
    const animator = new Animator();
    const tube = new TubeView(0);
    tube.cap = 0.6;
    const start = performance.now();
    openCap(animator, tube);
    animator.tick(start + 100);
    expect(tube.cap).toBeGreaterThan(0);
    expect(tube.cap).toBeLessThan(0.6);
    animator.tick(start + 250);
    expect(tube.cap).toBe(0);
  });

  it('is drawn in the color of the tube, and hides the badge of a special tube', () => {
    const tube = new TubeView(0, 4, { oneWay: true });
    tube.showColors([4, 4, 4, 4]);
    const scene = {
      width: 400,
      height: 800,
      tubes: [tube],
      streams: [],
      view: { scale: 50, originX: 200, originY: 600 },
      glassColor: '#ffffff'
    };
    const capFills = () => {
      const ctx = recordingContext();
      drawScene(ctx, scene);
      return ctx.fills.filter((fill) => fill.style === LIQUID_COLORS[4]).length;
    };
    const glassFills = () => {
      const ctx = recordingContext();
      drawScene(ctx, scene);
      return ctx.fills.filter((fill) => fill.style === '#ffffff').length;
    };

    const uncapped = { liquid: capFills(), glass: glassFills() };
    tube.cap = 1;
    expect(capFills()).toBeGreaterThan(uncapped.liquid);
    // The one-way arrow is a glass-colored fill; the cap takes its place.
    expect(glassFills()).toBe(uncapped.glass - 1);
  });
});

describe('Animator', () => {
  it('eases from 0 to 1', () => {
    expect([easeInOutCubic(0), easeInOutCubic(0.5), easeInOutCubic(1)]).toEqual([0, 0.5, 1]);
  });

  it('updates a tween each tick and resolves it at the end', async () => {
    const animator = new Animator();
    const start = performance.now();
    const seen = [];
    const done = animator.run(100, (t) => seen.push(t), { ease: linear });

    animator.tick(start + 50);
    animator.tick(start + 1000);
    await done;

    expect(seen[0]).toBeGreaterThan(0.4);
    expect(seen.at(-1)).toBe(1);
  });

  it('ends a running tween when another starts under the same key', async () => {
    const animator = new Animator();
    let firstUpdates = 0;
    const first = animator.run(1000, () => firstUpdates++, { key: 'body' });
    animator.run(1000, () => {}, { key: 'body' });

    await first;
    animator.tick();
    expect(firstUpdates).toBe(0);
  });

  it('resolves every tween when stopped', async () => {
    const animator = new Animator();
    const tweens = [animator.run(1000, () => {}), animator.run(1000, () => {})];
    animator.stopAll();
    await expect(Promise.all(tweens)).resolves.toBeDefined();
    expect(animator.isRunning).toBe(false);
  });

  // The scene only draws while something moves, so it must hear about every new tween,
  // including ones started after an earlier tween finished.
  it('reports each tween that starts, and whether any is still running', async () => {
    let starts = 0;
    const animator = new Animator(() => starts++);
    const start = performance.now();

    const first = animator.run(100, () => {});
    expect(animator.isRunning).toBe(true);

    animator.tick(start + 1000);
    expect(animator.isRunning).toBe(false);

    await first;
    animator.run(100, () => {});
    expect(starts).toBe(2);
    expect(animator.isRunning).toBe(true);
  });
});

describe('confetti', () => {
  const screen = { width: 390, height: 844 };
  const burst = () => launchPieces(createRandom(7), screen);
  /** Runs a burst at 60 frames a second, calling `onFrame` with the time and pieces left. */
  const play = (pieces, onFrame = () => {}) => {
    let time = 0;
    while (pieces.length > 0 && time < 10) {
      pieces = advancePieces(pieces, 1 / 60, screen);
      time += 1 / 60;
      onFrame(time, pieces);
    }
    return time;
  };

  it('shoots half the pieces from each bottom corner, up and toward the middle', () => {
    const pieces = burst();
    const left = pieces.filter((piece) => piece.x === 0);
    const right = pieces.filter((piece) => piece.x === screen.width);
    expect(left.length).toBe(pieces.length / 2);
    expect(right.length).toBe(pieces.length / 2);
    expect(pieces.every((piece) => piece.y === screen.height && piece.vy < 0)).toBe(true);
    expect(left.every((piece) => piece.vx > 0)).toBe(true);
    expect(right.every((piece) => piece.vx < 0)).toBe(true);
    expect(pieces.every((piece) => CONFETTI_COLORS.includes(piece.color))).toBe(true);
  });

  it('flies up over most of the screen and comes down across all of it', () => {
    let highest = Infinity;
    let leftmost = Infinity;
    let rightmost = -Infinity;
    play(burst(), (time, pieces) => {
      for (const piece of pieces) highest = Math.min(highest, piece.y);
      if (time < 1) return;
      for (const piece of pieces) {
        leftmost = Math.min(leftmost, piece.x);
        rightmost = Math.max(rightmost, piece.x);
      }
    });
    expect(highest).toBeLessThan(screen.height * 0.2);
    expect(leftmost).toBeLessThan(screen.width * 0.2);
    expect(rightmost).toBeGreaterThan(screen.width * 0.8);
  });

  it('is gone within a few seconds', () => {
    const duration = play(burst());
    expect(duration).toBeGreaterThan(2);
    expect(duration).toBeLessThanOrEqual(5);
  });

  it('keeps a piece in place until its launch', () => {
    const waiting = burst().filter((piece) => piece.age < -0.05);
    expect(waiting.length).toBeGreaterThan(0);
    const before = waiting.map(({ x, y }) => ({ x, y }));
    advancePieces(waiting, 0.02, screen);
    expect(waiting.map(({ x, y }) => ({ x, y }))).toEqual(before);
  });
});
