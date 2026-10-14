import { getLanguage } from './i18n.js';
import { en } from './texts/en.js';
import { tr } from './texts/tr.js';

const DICTIONARIES = { tr, en };

/**
 * Every piece of text the player sees. It reads from the dictionary of the language in use at
 * the moment a text is asked for; a text missing in one language falls back to Turkish.
 */
export const texts = new Proxy(
  {},
  {
    get: (_, key) => DICTIONARIES[getLanguage()][key] ?? tr[key],
    has: (_, key) => key in tr
  }
);
