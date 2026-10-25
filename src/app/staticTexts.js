/**
 * The Turkish of the texts that sit in index.html (which is written in English): for each
 * element, picked by a CSS selector, its text and/or the labels it carries. The dynamic texts
 * come from the dictionaries in texts/; these are only what the page starts out with.
 *
 * @typedef {{ text?: string, label?: string, title?: string, placeholder?: string }} Translation
 * @type {Array<[string, Translation]>}
 */
export const TURKISH_STATIC = [
  ['#scene', { label: 'Oyun alanı' }],
  ['#settings-open', { label: 'Ayarlar' }],
  ['.coffee-icon', { label: 'Bana bir kahve ısmarla', title: 'Bana bir kahve ısmarla' }],
  ['#info', { label: 'Bu seviyenin kuralları' }],
  ['.toolbar', { label: 'Hamleler' }],
  ['#undo span:not(.count)', { text: 'Geri al' }],
  ['#hint span:not(.count)', { text: 'İpucu' }],
  ['#restart span', { text: 'Baştan' }],
  ['.win-stats div:first-child dt', { text: 'Hamlen' }],
  ['#win-attempts-section h3', { text: 'Son denemeler' }],
  ['#replay', { text: 'Tekrar et' }],
  ['#win-leaderboard', { text: 'Sıralama' }],
  ['#win-levels', { text: 'Seviyeler' }],
  ['#levels-title', { text: 'Seviyeler' }],
  ['#levels-close', { label: 'Kapat' }],
  ['#leaderboard-open', { label: 'Günlük sıralama' }],
  ['.level-menu-footer .coffee', { text: '☕ Kahve ısmarla' }],
  ['#leaderboard-title', { text: 'Günlük sıralama' }],
  ['#leaderboard-close', { label: 'Kapat' }],
  ['#editor-title', { text: 'Bulmaca atölyesi' }],
  ['#editor-close', { label: 'Kapat' }],
  ['#editor-board', { label: 'Tasarladığın tahta' }],
  ['.editor-tools', { label: 'Tüpe dokununca' }],
  ['[data-tool="add"]', { text: 'Renk koy' }],
  ['[data-tool="remove"]', { text: 'Üstten al' }],
  ['[data-tool="lock"]', { text: 'Kilit' }],
  ['[data-tool="delete"]', { text: 'Tüpü sil' }],
  ['#editor-palette', { label: 'Renk' }],
  ['label:has(#editor-oil) > span', { text: 'Seçili renk yağ olsun' }],
  ['.editor-section:nth-of-type(1) h3', { text: 'Tüp ekle' }],
  ['[data-add="plain"]', { text: 'Tüp' }],
  ['[data-add="half"]', { text: 'Yarım' }],
  ['[data-add="oneWay"]', { text: 'Tek yönlü' }],
  ['[data-add="cracked"]', { text: 'Çatlak' }],
  ['.editor-section:nth-of-type(2) h3', { text: 'Kurallar' }],
  ['label:has(#editor-tall) > span', { text: 'Uzun tüpler (5 birim)' }],
  ['label:has(#editor-hidden) > span', { text: 'Gizli renkler' }],
  ['label:has(#editor-undo) > span', { text: 'Geri alma hakkı' }],
  ['.editor-section:nth-of-type(3) h3', { text: 'Hızlı başla' }],
  ['#editor-colors', { label: 'Renk sayısı' }],
  ['#editor-random', { text: 'Rastgele doldur' }],
  ['#editor-clear', { text: 'Boşalt' }],
  ['.editor-section:nth-of-type(4) h3', { text: 'Paylaş' }],
  ['#editor-code', { label: 'Bulmaca kodu' }],
  ['#editor-share', { text: 'Bağlantıyı kopyala' }],
  [
    '#editor-import-input',
    { label: 'Bulmaca kodu yükle', placeholder: 'Kod, bağlantı ya da JSON' }
  ],
  ['#editor-import button', { text: 'Yükle' }],
  ['#editor-play', { text: 'Dene ▶' }],
  ['#settings-title', { text: 'Ayarlar' }],
  ['#settings-close', { label: 'Kapat' }],
  ['.language-picker legend', { text: 'Dil' }],
  ['.theme-picker:not(.language-picker) legend', { text: 'Tema' }],
  [
    '.theme-picker:not(.language-picker) .theme-option:nth-of-type(1) > span:last-child',
    { text: 'Klasik Laboratuvar' }
  ],
  [
    '.theme-picker:not(.language-picker) .theme-option:nth-of-type(2) > span:last-child',
    { text: 'Neon Gece' }
  ],
  [
    '.theme-picker:not(.language-picker) .theme-option:nth-of-type(3) > span:last-child',
    { text: 'Kokteyl Bar' }
  ],
  ['label:has(#setting-sound) > span', { text: 'Sesler' }],
  ['label:has(#setting-haptics) > span', { text: 'Titreşim' }],
  ['#haptics-note', { text: 'Bu cihaz titreşimi desteklemiyor.' }],
  ['label:has(#setting-symbols) > span', { text: 'Renklere sembol ekle' }],
  ['#symbols-note', { text: 'Renkleri ayırt etmek zorsa her rengin üstüne bir şekil çizer.' }],
  ['#account-title', { text: 'Hesap' }],
  ['#account-signin span', { text: 'Google ile giriş yap' }],
  ['#account-name-input', { label: 'Kullanıcı adı' }],
  ['#account-name-form button', { text: 'Kaydet' }],
  ['#account-signout', { text: 'Çıkış yap' }],
  ['#account-delete', { text: 'Hesabımı sil' }],
  ['#install-app', { text: 'Uygulama olarak yükle' }],
  ['#settings .coffee', { text: '☕ Kahve ısmarla' }],
  ['#rules-close', { label: 'Kapat' }],
  ['#title', { text: 'Seviye 1' }],
  ['#subtitle', { text: 'Kolay · 0 hamle' }],
  ['#levels-open', { text: 'Seviyeler' }],
  ['#share-result', { text: 'Sonucu paylaş' }],
  ['#watch-solution', { text: 'Çözümü izle' }],
  ['#rules-action', { text: 'Anladım' }],
  [
    '#account-note',
    {
      text: 'İlerlemen bu cihazda duruyor. Giriş yaparsan hesabında saklanır, diğer cihazlarında da gelir.'
    }
  ],
  ['.splash-tagline', { text: 'Su sıralama bulmaca oyunu' }]
];
/** * Puts the Turkish texts on the page. * @param {ParentNode} root * @param {Array<[string, Translation]>} [translations] * @returns {string[]} the selectors that matched nothing, so a test can catch a stale list */ export function applyStaticTexts(
  root,
  translations = TURKISH_STATIC
) {
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
