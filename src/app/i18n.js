/**
 * The language the game is shown in. It is set once, before anything is drawn, from the
 * settings; changing it later reloads the page, so no text is ever left in the old language.
 */

export const LANGUAGES = Object.freeze(['tr', 'en']);

let current = 'tr';

/** @param {string} language one of LANGUAGES */
export function setLanguage(language) {
  current = LANGUAGES.includes(language) ? language : 'tr';
}

export function getLanguage() {
  return current;
}

/**
 * The language of the browser, as far as the game has one: Turkish for Turkish browsers,
 * English for all the others.
 * @param {{ language?: string } | undefined} [nav]
 */
export function browserLanguage(nav = globalThis.navigator) {
  return String(nav?.language ?? '')
    .toLowerCase()
    .startsWith('tr')
    ? 'tr'
    : 'en';
}
