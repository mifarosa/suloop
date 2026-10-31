/**
 * A CSS color as [red, green, blue, alpha], each 0 to 1. Understands what the board is drawn
 * with: #rgb, #rrggbb, #rrggbbaa, rgb() and rgba().
 * @param {string} css
 * @returns {[number, number, number, number]}
 */
export function parseColor(css) {
  const text = String(css).trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,8})$/.exec(text);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3 || digits.length === 4) {
      digits = [...digits].map((digit) => digit + digit).join('');
    }
    if (digits.length === 6 || digits.length === 8) {
      const part = (index) => parseInt(digits.slice(index * 2, index * 2 + 2), 16) / 255;
      return [part(0), part(1), part(2), digits.length === 8 ? part(3) : 1];
    }
  }
  const functional = /^rgba?\(([^)]*)\)$/.exec(text);
  if (functional) {
    const parts = functional[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    if (parts.length >= 3 && parts.every((value) => Number.isFinite(value))) {
      const alpha = parts.length >= 4 ? parts[3] : 1;
      return [parts[0] / 255, parts[1] / 255, parts[2] / 255, alpha];
    }
  }
  // Anything else is drawn black rather than breaking the frame.
  return [0, 0, 0, 1];
}
