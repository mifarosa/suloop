import { describe, expect, it } from 'vitest';
import { MAX_COLOR_COUNT } from '../src/game/levels.js';
import { Animator, easeInOutCubic, linear } from '../src/scene/animator.js';
import { HIDDEN } from '../src/game/rules.js';
import {
  ROW_GAP,
  SEGMENT_HEIGHT,
  TUBE_HEIGHT,
  TUBE_SPACING,
  tubeHeight
} from '../src/scene/dimensions.js';
import { arrangeTubes, fitToView } from '../src/scene/layout.js';
import { HIDDEN_COLOR, LIQUID_COLORS } from '../src/scene/palette.js';
import { animatePour } from '../src/scene/pour.js';
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
  // Drives the animator with a fake clock until the pour has finished.
  async function play(animator, promise) {
    let done = false;
    promise.then(() => (done = true));
    let now = performance.now();
    for (let i = 0; i < 500 && !done; i++) {
      now += 50;
      animator.tick(now);
      await new Promise((resolve) => setTimeout(resolve, 0));
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

describe('drawScene', () => {
  // A stand-in canvas context that accepts every drawing call and records fills and text.
  function recordingContext() {
    const fills = [];
    const texts = [];
    const record = {
      fillRect: (...args) => fills.push({ style: ctx.fillStyle, args }),
      fillText: (text) => texts.push(text)
    };
    const ctx = new Proxy(
      { fills, texts },
      {
        get: (target, name) => (name in target ? target[name] : (record[name] ?? (() => {}))),
        set: (target, name, value) => ((target[name] = value), true)
      }
    );
    return ctx;
  }

  const sceneWith = (tubes) => ({
    width: 400,
    height: 800,
    tubes,
    stream: { visible: false, color: 0, x: 0, top: 0, bottom: 0 },
    view: { scale: 50, originX: 200, originY: 600 },
    glassColor: '#ffffff'
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
      stream: { visible: true, color: 7, x: 0, top: 4, bottom: 2 * SEGMENT_HEIGHT },
      view: { scale: 50, originX: 200, originY: 600 },
      glassColor: '#ffffff'
    });

    const styles = ctx.fills.map((fill) => fill.style);
    expect(styles).toContain(LIQUID_COLORS[2]);
    expect(styles).toContain(LIQUID_COLORS[5]);
    expect(styles.at(-1)).toBe(LIQUID_COLORS[7]);
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
