/**
 * The language the game is shown in: English until the player picks another. It is set once, before anything is drawn, from the
 * settings; changing it later reloads the page, so no text is ever left in the old language.
 */

export const LANGUAGES = Object.freeze(['tr', 'en']);

let current = 'en';

/** @param {string} language one of LANGUAGES */
export function setLanguage(language) {
  current = LANGUAGES.includes(language) ? language : 'en';
}

export function getLanguage() {
  return current;
}
