import { describe, expect, it } from 'vitest';
import { loadSavedRatio, QualityGovernor, saveRatio } from '../src/scene/quality.js';

const frames = (governor, milliseconds, count) => {
  let result = null;
  for (let i = 0; i < count; i++) result = governor.record(milliseconds) ?? result;
  return result;
};

describe('QualityGovernor', () => {
  it('keeps the resolution while frames come quickly', () => {
    const governor = new QualityGovernor({ ratio: 2 });
    expect(frames(governor, 16.7, 400)).toBeNull();
    expect(governor.ratio).toBe(2);
  });

  it('steps down after about a second of slow frames, and again while they stay slow', () => {
    const governor = new QualityGovernor({ ratio: 2 });
    expect(frames(governor, 26, 39)).toBeNull();
    expect(frames(governor, 26, 40)).toBe(1.75);
    expect(frames(governor, 26, 40)).toBe(1.5);
    expect(governor.ratio).toBe(1.5);
  });

  it('steps down twice as far when frames are very slow', () => {
    const governor = new QualityGovernor({ ratio: 2 });
    expect(frames(governor, 50, 40)).toBe(1.5);
  });

  it('never goes below the floor, and starts no higher than the screen has', () => {
    const governor = new QualityGovernor({ ratio: 1.25 });
    expect(frames(governor, 60, 40)).toBe(1);
    expect(frames(governor, 60, 200)).toBeNull();
    expect(governor.ratio).toBe(1);
    expect(new QualityGovernor({ ratio: 0.5 }).ratio).toBe(1);
  });

  it('does not count pauses as slow frames', () => {
    const governor = new QualityGovernor({ ratio: 2 });
    expect(frames(governor, 3000, 100)).toBeNull();
    expect(frames(governor, 16.7, 100)).toBeNull();
  });

  it('judges the average, so a few hiccups do not matter', () => {
    const governor = new QualityGovernor({ ratio: 2 });
    for (let i = 0; i < 38; i++) governor.record(16.7);
    governor.record(100);
    expect(governor.record(100)).toBeNull();
    expect(governor.ratio).toBe(2);
  });
});

describe('the saved resolution', () => {
  const storage = () => {
    const items = new Map();
    return {
      getItem: (key) => items.get(key) ?? null,
      setItem: (key, value) => items.set(key, value)
    };
  };

  it('is remembered for the next visit', () => {
    const kept = storage();
    expect(loadSavedRatio(kept)).toBeNull();
    saveRatio(1.5, kept);
    expect(loadSavedRatio(kept)).toBe(1.5);
  });

  it('is ignored when it makes no sense or storage fails', () => {
    const kept = storage();
    kept.setItem('suloop:resolution:v1', '40');
    expect(loadSavedRatio(kept)).toBeNull();
    expect(loadSavedRatio(null)).toBeNull();
    expect(
      loadSavedRatio({
        getItem: () => {
          throw new Error('blocked');
        }
      })
    ).toBeNull();
  });
});
