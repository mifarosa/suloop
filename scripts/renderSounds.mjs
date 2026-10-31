/**
 * Writes the sounds of the app (app/assets/sounds/*.wav) from app/src/synth.js. Run it with
 * `npm run sounds` whenever the sounds change.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { renderSounds, toWav } from './synth.mjs';

const directory = new URL('../app/assets/sounds/', import.meta.url);
mkdirSync(directory, { recursive: true });
let total = 0;
for (const [name, samples] of Object.entries(renderSounds())) {
  const bytes = toWav(samples);
  writeFileSync(new URL(`${name}.wav`, directory), bytes);
  total += bytes.length;
}
console.log(`Wrote the sounds of the app (${Math.round(total / 1024)} KB).`);
