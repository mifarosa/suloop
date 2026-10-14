import { hashString } from '../game/random.js';
import { MAX_STARS } from '../game/stars.js';
import { MAX_SPARE_UNDOS } from './economy.js';

/**
 * Everything that is worth carrying to another device, packed into a link: the solved
 * levels and the best stars of each, the hints and spare undos, and the results of the daily
 * puzzle (which make the streak). The short codes of progressCode.js carry the solved levels
 * only and still work; a snapshot is what the share link holds.
 *
 * A snapshot is a few bytes of numbers: a version, then the solved count, hints, spare
 * undos, the best stars of each level at two bits a level, the last solved daily puzzle and
 * the daily results, each as day number, moves, seconds and stars. Numbers are written as
 * varints (seven bits a byte). The bytes end with a check value and are written in URL-safe
 * base64, so a snapshot can sit in a link.
 *
 * @typedef {object} Snapshot
 * @property {number} solved
 * @property {number | null} hints null when the code does not carry them (a short code)
 * @property {number | null} spareUndos
 * @property {number[]} bests best stars of levels 1, 2, … (0 for none), as many as solved
 * @property {string | null} dailyDone date key of the last solved daily puzzle
 * @property {Record<string, { moves: number, seconds: number, stars: number }>} daily
 */

const VERSION = 2;
const CHECK_BYTES = 3;
const DAY_MS = 86_400_000;
/** Day 0 of the day numbers; no daily puzzle is older. */
const EPOCH = Date.UTC(2024, 0, 1);
/** Far more than any player has solved; keeps a made-up code from making a huge array. */
const MAX_SOLVED = 100_000;
const MAX_DAILY = 400;

/**
 * @param {import('./progress.js').Progress} progress
 * @param {Record<string, { moves: number, seconds: number, stars: number }>} daily
 * @returns {string}
 */
export function encodeSnapshot(progress, daily) {
  const bytes = [VERSION];
  writeVarint(bytes, progress.solved);
  writeVarint(bytes, progress.hints);
  writeVarint(bytes, progress.spareUndos);

  for (let level = 1; level <= progress.solved; level += 4) {
    let packed = 0;
    for (let i = 0; i < 4; i++) {
      packed |= (progress.records[level + i]?.best ?? 0) << (i * 2);
    }
    bytes.push(packed);
  }

  writeVarint(bytes, progress.dailyDone ? dayNumber(progress.dailyDone) + 1 : 0);
  const days = Object.keys(daily).sort().slice(-MAX_DAILY);
  writeVarint(bytes, days.length);
  for (const day of days) {
    writeVarint(bytes, dayNumber(day));
    writeVarint(bytes, daily[day].moves);
    writeVarint(bytes, daily[day].seconds);
    bytes.push(daily[day].stars);
  }

  const check = checkOf(bytes);
  for (let i = 0; i < CHECK_BYTES; i++) bytes.push((check >> (i * 8)) & 0xff);
  return toBase64Url(bytes);
}

/**
 * @param {string} text a snapshot, or a link that ends with one
 * @returns {Snapshot | null} null when the text is not a sound snapshot
 */
export function decodeSnapshot(text) {
  const bytes = fromBase64Url(
    String(text)
      .trim()
      .replace(/^.*#ilerleme=/, '')
  );
  if (!bytes || bytes.length < 1 + CHECK_BYTES + 4 || bytes[0] !== VERSION) return null;

  const body = bytes.slice(0, -CHECK_BYTES);
  const check = checkOf(body);
  for (let i = 0; i < CHECK_BYTES; i++) {
    if (bytes[bytes.length - CHECK_BYTES + i] !== ((check >> (i * 8)) & 0xff)) return null;
  }

  const reader = { bytes: body, at: 1 };
  const solved = readVarint(reader);
  const hints = readVarint(reader);
  const spareUndos = readVarint(reader);
  if ([solved, hints, spareUndos].includes(null) || solved > MAX_SOLVED) return null;

  const bests = [];
  for (let level = 1; level <= solved; level += 4) {
    const packed = reader.bytes[reader.at++];
    if (packed === undefined) return null;
    for (let i = 0; i < 4 && level + i <= solved; i++) bests.push((packed >> (i * 2)) & 3);
  }

  const done = readVarint(reader);
  const count = readVarint(reader);
  if (done === null || count === null || count > MAX_DAILY) return null;
  const daily = {};
  for (let i = 0; i < count; i++) {
    const day = readVarint(reader);
    const moves = readVarint(reader);
    const seconds = readVarint(reader);
    const stars = reader.bytes[reader.at++];
    if ([day, moves, seconds].includes(null) || !(stars >= 1 && stars <= MAX_STARS)) return null;
    daily[dayKey(day)] = { moves, seconds, stars };
  }
  if (reader.at !== body.length) return null;

  return {
    solved,
    hints,
    spareUndos: Math.min(spareUndos, MAX_SPARE_UNDOS),
    bests,
    dailyDone: done > 0 ? dayKey(done - 1) : null,
    daily
  };
}

/**
 * Takes a snapshot into this device's progress without ever lowering it: levels solved, the
 * best stars and the daily results only grow. The hints and spare undos come over only when
 * the snapshot is further along, so an old link cannot bring back what was spent.
 * @param {import('./progress.js').Progress} progress
 * @param {Record<string, { moves: number, seconds: number, stars: number, shared?: boolean }>} daily
 * @param {Snapshot} snapshot
 * @returns {{ progress: import('./progress.js').Progress, daily: typeof daily, changed: boolean }}
 */
export function mergeSnapshot(progress, daily, snapshot) {
  const ahead = snapshot.solved > progress.solved;
  const records = { ...progress.records };
  snapshot.bests.forEach((best, i) => {
    const level = i + 1;
    if (best > (records[level]?.best ?? 0)) {
      records[level] = { best, attempts: records[level]?.attempts ?? [] };
    }
  });

  const merged = {
    ...progress,
    solved: Math.max(progress.solved, snapshot.solved),
    current: ahead ? snapshot.solved + 1 : progress.current,
    mode: ahead ? 'level' : progress.mode,
    hints: ahead && snapshot.hints !== null ? snapshot.hints : progress.hints,
    spareUndos: ahead && snapshot.spareUndos !== null ? snapshot.spareUndos : progress.spareUndos,
    dailyDone: [progress.dailyDone, snapshot.dailyDone].filter(Boolean).sort().at(-1) ?? null,
    records
  };
  const mergedDaily = { ...snapshot.daily, ...daily };
  const changed =
    JSON.stringify(merged) !== JSON.stringify(progress) ||
    Object.keys(mergedDaily).length !== Object.keys(daily).length;
  return { progress: merged, daily: mergedDaily, changed };
}

function dayNumber(key) {
  const [year, month, day] = key.split('-').map(Number);
  return Math.max(0, Math.round((Date.UTC(year, month - 1, day) - EPOCH) / DAY_MS));
}

function dayKey(number) {
  const date = new Date(EPOCH + number * DAY_MS);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function writeVarint(bytes, value) {
  let rest = Math.max(0, Math.floor(value));
  while (rest >= 0x80) {
    bytes.push((rest & 0x7f) | 0x80);
    rest = Math.floor(rest / 128);
  }
  bytes.push(rest);
}

/** @returns {number | null} null when the bytes end or the number is absurdly long */
function readVarint(reader) {
  let value = 0;
  for (let shift = 0; shift < 35; shift += 7) {
    const byte = reader.bytes[reader.at++];
    if (byte === undefined) return null;
    value += (byte & 0x7f) * 2 ** shift;
    if (byte < 0x80) return value;
  }
  return null;
}

function checkOf(bytes) {
  return hashString(`suloop-snapshot-${bytes.join(',')}`) & 0xffffff;
}

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(text) {
  if (!/^[\w-]+$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}
