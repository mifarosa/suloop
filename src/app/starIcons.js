import { MAX_STARS } from '../game/stars.js';

const STAR_PATH =
  'M12 2.6l2.85 6.08 6.66.78-4.93 4.56 1.3 6.58L12 17.3l-5.88 3.3 1.3-6.58L2.49 9.46l6.66-.78z';

/**
 * A row of stars, `count` of them filled.
 * @param {number} count
 * @param {string} [className]
 * @returns {HTMLSpanElement}
 */
export function starRow(count, className = 'stars') {
  const row = document.createElement('span');
  row.className = className;
  row.setAttribute('aria-hidden', 'true');
  for (let i = 1; i <= MAX_STARS; i++) {
    row.insertAdjacentHTML(
      'beforeend',
      `<svg viewBox="0 0 24 24" class="${i <= count ? 'on' : 'off'}"><path d="${STAR_PATH}"/></svg>`
    );
  }
  return row;
}
