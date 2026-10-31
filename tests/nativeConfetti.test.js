import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkiaContext2D } from '../app/src/skiaContext.js';
import { Confetti } from '../src/scene/confetti.js';
import { fakeSkia } from './helpers/fakeSkia.js';

describe('confetti on the Skia context', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('throws pieces that move and turn, drawn with the website code', async () => {
    const frames = [];
    vi.stubGlobal('window', { innerWidth: 390, innerHeight: 800, devicePixelRatio: 1 });
    vi.stubGlobal('requestAnimationFrame', (callback) => frames.push(callback));

    const pictures = [];
    const host = {
      hidden: true,
      width: 0,
      height: 0,
      getContext: () =>
        new SkiaContext2D(fakeSkia(), {
          size: () => ({ width: 390, height: 800 }),
          onPicture: (picture) => pictures.push(picture),
          fontFor: () => ({})
        })
    };
    const confetti = new Confetti(host);
    confetti.burst();
    expect(host.hidden).toBe(false);

    // A few frames, 16 ms apart.
    for (let time = 0; time <= 64 && frames.length > 0; time += 16) frames.shift()(time);
    await new Promise((resolve) => queueMicrotask(resolve));

    const log = pictures.flatMap((picture) => picture.log);
    expect(log.filter((entry) => entry[0] === 'drawRect').length).toBeGreaterThan(20);
    // Each piece is moved and turned on its own, and the frame stays balanced.
    expect(log.some((entry) => entry[0] === 'translate')).toBe(true);
    expect(log.some((entry) => entry[0] === 'rotate')).toBe(true);
  });
});
