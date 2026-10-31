import { describe, expect, it } from 'vitest';
import { SAMPLE_RATE, pourSeconds, renderSounds, toWav } from '../scripts/synth.mjs';

describe('the sounds of the app', () => {
  const sounds = renderSounds();

  it('has a sound for everything the game does, and a pour for each amount', () => {
    for (const name of [
      'pick',
      'putDown',
      'reject',
      'capOn',
      'capOff',
      'melt',
      'undo',
      'hint',
      'win'
    ]) {
      expect(sounds[name], name).toBeInstanceOf(Float32Array);
    }
    for (let amount = 1; amount <= 5; amount++) expect(sounds[`pour${amount}`]).toBeDefined();
  });

  it('are audible, never clip, and end quietly', () => {
    for (const [name, samples] of Object.entries(sounds)) {
      const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
      expect(peak, name).toBeGreaterThan(0.02);
      expect(peak, name).toBeLessThanOrEqual(1);
      const tail = samples.slice(-200).reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
      expect(tail, name).toBeLessThan(0.02);
    }
  });

  it('pour for as long as the pour runs', () => {
    expect(sounds.pour2.length / SAMPLE_RATE).toBeGreaterThan(pourSeconds(2));
    expect(sounds.pour4.length).toBeGreaterThan(sounds.pour2.length);
  });

  it('are the same every time they are made', () => {
    expect(renderSounds().capOn).toEqual(sounds.capOn);
  });

  it('go into a WAV file with a proper header', () => {
    const wav = toWav(sounds.pick);
    const text = (from, to) => String.fromCharCode(...wav.slice(from, to));
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 12)).toBe('WAVE');
    expect(new DataView(wav.buffer).getUint32(24, true)).toBe(SAMPLE_RATE);
    expect(wav.length).toBe(44 + sounds.pick.length * 2);
  });
});
