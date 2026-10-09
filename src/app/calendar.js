/**
 * The local calendar date as "YYYY-MM-DD". The daily puzzle changes at the player's
 * midnight, not at UTC midnight.
 * @param {Date} date
 */
export function localDateKey(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
