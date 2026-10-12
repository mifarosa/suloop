import { hashString } from '../game/random.js';

/**
 * Progress codes carry the number of solved levels to another device, or back after the
 * browser lost it: a short code such as "2FQ7M", or a link ending in "#ilerleme=2FQ7M".
 *
 * A code is the solved count followed by a check value, written in Crockford's base 32. It has
 * no I, L, O or U, so it is hard to misread, and the check catches a mistyped code (only one
 * in 32,768 slips through).
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const BASE = ALPHABET.length;
const CHECK_RANGE = BASE ** 3;
// Ten digits are 50 bits, well inside the integers a JavaScript number holds exactly.
const MAX_CODE_LENGTH = 10;
const LINK_KEY = 'ilerleme';

/** @param {number} solved */
export function encodeProgressCode(solved) {
  let value = solved * CHECK_RANGE + checkValue(solved);
  let code = '';
  do {
    code = ALPHABET[value % BASE] + code;
    value = Math.floor(value / BASE);
  } while (value > 0);
  return code;
}

/**
 * Reads a code as the player may have typed it: in any case, with spaces or dashes, and with
 * the letters O, I and L standing for the digits they look like.
 * @param {string} text
 * @returns {number | null} the solved count, or null when the text is not a valid code
 */
export function decodeProgressCode(text) {
  const code = String(text)
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (code.length === 0 || code.length > MAX_CODE_LENGTH) return null;

  let value = 0;
  for (const char of code) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) return null;
    value = value * BASE + digit;
  }
  const solved = Math.floor(value / CHECK_RANGE);
  return value % CHECK_RANGE === checkValue(solved) ? solved : null;
}

/**
 * @param {string} pageUrl the address of the game
 * @param {string} code
 */
export function progressLink(pageUrl, code) {
  const url = new URL(pageUrl);
  url.hash = `${LINK_KEY}=${code}`;
  return url.href;
}

/**
 * @param {string} pageUrl
 * @returns {string | null} the code in a progress link, or null for any other address
 */
export function codeInLink(pageUrl) {
  const prefix = `#${LINK_KEY}=`;
  const { hash } = new URL(pageUrl);
  if (!hash.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(hash.slice(prefix.length));
  } catch {
    return ''; // A broken escape such as "%E0"; it then reads as an invalid code.
  }
}

function checkValue(solved) {
  return hashString(`suloop-progress-${solved}`) % CHECK_RANGE;
}
