/** Every piece of text the player sees, in one place. */

const dayAndMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });

export const texts = {
  levelTitle: (level) => `Seviye ${level}`,
  dailyTitle: (date, solved) =>
    `Günün bulmacası · ${dayAndMonth.format(date)}${solved ? ' ✓' : ''}`,
  moves: (count) => `${count} hamle`,
  showDaily: 'Günlük',
  showLevels: 'Seviyeler',
  solvedIn: (count) => `${count} hamlede çözdün.`,
  nextLevel: 'Sonraki seviye',
  backToLevels: 'Seviyelere dön',
  hintMove: (from, to) => `${from + 1}. tüpten ${to + 1}. tüpe dök.`,
  hintDeadEnd: 'Buradan çözüm bulunamadı. Birkaç hamle geri al.'
};
