import { getLanguage } from '../../src/app/i18n.js';
import { TURKISH_STATIC } from '../../src/app/staticTexts.js';

/**
 * A label the website keeps in its page (and translates by selector, see staticTexts.js): in
 * Turkish the same Turkish text, otherwise the English given here.
 */
export function label(selector, english) {
  if (getLanguage() !== 'tr') return english;
  const entry = TURKISH_STATIC.find(([candidate]) => candidate === selector);
  return entry?.[1].text ?? english;
}
