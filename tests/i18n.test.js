import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { getLanguage, LANGUAGES, setLanguage } from '../src/app/i18n.js';
import { normalizeSettings } from '../src/app/settings.js';
import { TURKISH_STATIC } from '../src/app/staticTexts.js';
import { texts } from '../src/app/texts.js';
import { en } from '../src/app/texts/en.js';
import { tr } from '../src/app/texts/tr.js';

afterEach(() => setLanguage('tr'));

describe('texts', () => {
  it('have the same keys in every language', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort());
  });

  it('are functions in both languages, or text in both', () => {
    for (const key of Object.keys(tr)) expect(typeof en[key], key).toBe(typeof tr[key]);
  });

  it('give an English text for everything a Turkish one does, for sample values', () => {
    const samples = {
      levelSubtitle: ['tall', ['oneWayTube', 'tallTubes', 'oil'], 3],
      levelTileLabel: [4, 'solved', 2],
      editorProblem: [{ code: 'colorCount', count: 3, tube: 1 }, 4],
      ruleText: ['limitedUndo', { undoLimit: 3, capacity: 5 }],
      shareDailyText: [new Date(2026, 9, 12), 3, 21, 95, 3]
    };
    for (const [key, args] of Object.entries(samples)) {
      expect(en[key](...args), key).toEqual(expect.any(String));
      expect(en[key](...args), key).not.toBe(tr[key](...args));
    }
  });

  it('read the language in use at the moment they are asked for', () => {
    expect(texts.levelTitle(5)).toBe('Seviye 5');
    setLanguage('en');
    expect(getLanguage()).toBe('en');
    expect(texts.levelTitle(5)).toBe('Level 5');
    expect(texts.moves(1)).toBe('1 move');
    expect(texts.moves(3)).toBe('3 moves');
    setLanguage('de');
    expect(getLanguage()).toBe('en');
  });

  it('write English dates and Turkish dates in their own style', () => {
    const date = new Date(2026, 9, 12);
    expect(tr.dailyCardDate(date)).toBe('12 Ekim');
    expect(en.dailyCardDate(date)).toBe('12 October');
  });
});

describe('the language setting', () => {
  it('is English until the player picks one, whatever the browser says', () => {
    expect(LANGUAGES).toEqual(['tr', 'en']);
    expect(normalizeSettings(undefined).language).toBe('en');
    expect(normalizeSettings({ language: 'xx' }).language).toBe('en');
    expect(normalizeSettings({ language: 'tr' }).language).toBe('tr');
    expect(normalizeSettings({ language: 'en' }).language).toBe('en');
  });
});

describe('the Turkish of the page', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  it('has a selector and a text for every entry', () => {
    const selectors = TURKISH_STATIC.map(([selector]) => selector);
    expect(new Set(selectors).size).toBe(selectors.length);
    for (const [, translation] of TURKISH_STATIC) {
      expect(Object.keys(translation).length).toBeGreaterThan(0);
    }
  });

  it('names elements the page has', () => {
    for (const [selector] of TURKISH_STATIC) {
      const id = /^#([\w-]+)/.exec(selector)?.[1];
      if (id) expect(html, selector).toContain(`id="${id}"`);
    }
  });

  it('is written in English', () => {
    expect(html).toContain('<html lang="en"');
    // The name of the language is the one place that stays Turkish.
    expect(html.replace('Türkçe', '')).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/u);
  });
});
