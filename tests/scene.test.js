import { describe, expect, it } from 'vitest';
import { MAX_COLOR_COUNT } from '../src/game/levels.js';
import { Animator, easeInOutCubic, linear } from '../src/scene/animator.js';
import { TUBE_SPACING } from '../src/scene/dimensions.js';
import { arrangeTubes, frameCamera } from '../src/scene/layout.js';
import { LIQUID_COLORS } from '../src/scene/palette.js';

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

describe('frameCamera', () => {
  it('moves back further on a narrow screen to fit the width', () => {
    const { bounds } = arrangeTubes(5, 1);
    const narrow = frameCamera(bounds, 35, 0.5);
    const wide = frameCamera(bounds, 35, 2);
    expect(narrow.position.z).toBeGreaterThan(wide.position.z);
  });

  it('looks slightly down at the tubes', () => {
    const { bounds } = arrangeTubes(5, 1);
    const { position, target } = frameCamera(bounds, 35, 1);
    expect(position.y).toBeGreaterThan(target.y);
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
  });
});
