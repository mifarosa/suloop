/**
 * The player's preferences, kept apart from progress in localStorage: they belong to the
 * device, so carrying progress to another one leaves them behind.
 *
 * @typedef {object} Settings
 * @property {'classic' | 'neon' | 'cocktail'} theme
 * @property {boolean} sound
 * @property {boolean} haptics vibration on phones that have it
 * @property {boolean} symbols a symbol on every color, for players who cannot tell colors apart
 */

const STORAGE_KEY = 'suloop:settings:v1';
export const THEME_IDS = Object.freeze(['classic', 'neon', 'cocktail']);

/** @type {Readonly<Settings>} */
export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'classic',
  sound: true,
  haptics: true,
  symbols: false
});

/** Turns whatever was stored into valid settings, field by field. */
export function normalizeSettings(saved) {
  const data = saved && typeof saved === 'object' ? saved : {};
  return {
    theme: THEME_IDS.includes(data.theme) ? data.theme : DEFAULT_SETTINGS.theme,
    sound: typeof data.sound === 'boolean' ? data.sound : DEFAULT_SETTINGS.sound,
    haptics: typeof data.haptics === 'boolean' ? data.haptics : DEFAULT_SETTINGS.haptics,
    symbols: typeof data.symbols === 'boolean' ? data.symbols : DEFAULT_SETTINGS.symbols
  };
}

/** @returns {Settings} */
export function loadSettings(storage = browserStorage()) {
  try {
    return normalizeSettings(JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** @param {Settings} settings */
export function saveSettings(settings, storage = browserStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
  } catch {
    // Storage can be blocked; the settings then last for this visit only.
  }
}

function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
