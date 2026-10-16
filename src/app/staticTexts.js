/**
 * The English of the texts that sit in index.html (which is written in Turkish): for each
 * element, picked by a CSS selector, its text and/or the labels it carries. The dynamic texts
 * come from the dictionaries in texts/; these are only what the page starts out with.
 *
 * @typedef {{ text?: string, label?: string, title?: string, placeholder?: string }} Translation
 * @type {Array<[string, Translation]>}
 */
export const ENGLISH_STATIC = [
  // The top bar and the toolbar
  ['#scene', { label: 'Game board' }],
  ['#settings-open', { label: 'Settings' }],
  ['.coffee-icon', { label: 'Buy me a coffee', title: 'Buy me a coffee' }],
  ['#info', { label: 'Rules of this level' }],
  ['.toolbar', { label: 'Moves' }],
  ['#undo span:not(.count)', { text: 'Undo' }],
  ['#hint span:not(.count)', { text: 'Hint' }],
  ['#restart span', { text: 'Restart' }],

  // The win dialog
  ['.win-stats div:first-child dt', { text: 'Your moves' }],
  ['#win-attempts-section h3', { text: 'Recent attempts' }],
  ['#replay', { text: 'Play again' }],
  ['#win-leaderboard', { text: 'Leaderboard' }],
  ['#win-levels', { text: 'Levels' }],

  // The level list
  ['#levels-title', { text: 'Levels' }],
  ['#levels-close', { label: 'Close' }],
  ['#leaderboard-open', { label: 'Daily leaderboard' }],
  ['.level-menu-footer .coffee', { text: '☕ Buy me a coffee' }],

  // The daily leaderboard
  ['#leaderboard-title', { text: 'Daily leaderboard' }],
  ['#leaderboard-close', { label: 'Close' }],

  // The puzzle editor
  ['#editor-title', { text: 'Puzzle workshop' }],
  ['#editor-close', { label: 'Close' }],
  ['#editor-board', { label: 'The board you are making' }],
  ['.editor-tools', { label: 'When tapping a tube' }],
  ['[data-tool="add"]', { text: 'Add color' }],
  ['[data-tool="remove"]', { text: 'Take from top' }],
  ['[data-tool="lock"]', { text: 'Lock' }],
  ['[data-tool="delete"]', { text: 'Delete tube' }],
  ['#editor-palette', { label: 'Color' }],
  ['label:has(#editor-oil) > span', { text: 'Make the selected color oil' }],
  ['.editor-section:nth-of-type(1) h3', { text: 'Add a tube' }],
  ['[data-add="plain"]', { text: 'Tube' }],
  ['[data-add="half"]', { text: 'Half' }],
  ['[data-add="oneWay"]', { text: 'One-way' }],
  ['[data-add="cracked"]', { text: 'Cracked' }],
  ['.editor-section:nth-of-type(2) h3', { text: 'Rules' }],
  ['label:has(#editor-tall) > span', { text: 'Tall tubes (5 units)' }],
  ['label:has(#editor-hidden) > span', { text: 'Hidden colors' }],
  ['label:has(#editor-undo) > span', { text: 'Undo allowance' }],
  ['.editor-section:nth-of-type(3) h3', { text: 'Quick start' }],
  ['#editor-colors', { label: 'Number of colors' }],
  ['#editor-random', { text: 'Fill randomly' }],
  ['#editor-clear', { text: 'Empty' }],
  ['.editor-section:nth-of-type(4) h3', { text: 'Share' }],
  ['#editor-code', { label: 'Puzzle code' }],
  ['#editor-share', { text: 'Copy link' }],
  ['#editor-import-input', { placeholder: 'Code, link or JSON', label: 'Load a puzzle code' }],
  ['#editor-import button', { text: 'Load' }],
  ['#editor-play', { text: 'Try ▶' }],

  // The settings
  ['#settings-title', { text: 'Settings' }],
  ['#settings-close', { label: 'Close' }],
  ['.language-picker legend', { text: 'Language' }],
  ['.theme-picker:not(.language-picker) legend', { text: 'Theme' }],
  [
    '.theme-picker:not(.language-picker) .theme-option:nth-of-type(1) > span:last-child',
    { text: 'Classic Lab' }
  ],
  [
    '.theme-picker:not(.language-picker) .theme-option:nth-of-type(2) > span:last-child',
    { text: 'Neon Night' }
  ],
  [
    '.theme-picker:not(.language-picker) .theme-option:nth-of-type(3) > span:last-child',
    { text: 'Cocktail Bar' }
  ],
  ['label:has(#setting-sound) > span', { text: 'Sounds' }],
  ['label:has(#setting-haptics) > span', { text: 'Vibration' }],
  ['#haptics-note', { text: 'This device does not support vibration.' }],
  ['label:has(#setting-symbols) > span', { text: 'Add symbols to colors' }],
  ['#symbols-note', { text: 'Draws a shape on every color, if they are hard to tell apart.' }],
  ['#install-app', { text: 'Install as an app' }],
  ['#settings .coffee', { text: '☕ Buy me a coffee' }],

  // The rules dialog
  ['#rules-close', { label: 'Close' }]
];

/**
 * Puts the English texts on the page.
 * @param {ParentNode} root
 * @param {Array<[string, Translation]>} [translations]
 * @returns {string[]} the selectors that matched nothing, so a test can catch a stale list
 */
export function applyStaticTexts(root, translations = ENGLISH_STATIC) {
  const missing = [];
  for (const [selector, { text, label, title, placeholder }] of translations) {
    const element = root.querySelector(selector);
    if (!element) {
      missing.push(selector);
      continue;
    }
    if (text !== undefined) element.textContent = text;
    if (label !== undefined) element.setAttribute('aria-label', label);
    if (title !== undefined) element.setAttribute('title', title);
    if (placeholder !== undefined) element.setAttribute('placeholder', placeholder);
  }
  return missing;
}
