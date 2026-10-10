/** Every piece of text the player sees, in one place. */

const dayAndMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });

const chapterNames = { easy: 'Kolay', medium: 'Orta', hard: 'Zor', expert: 'Uzman' };
const moves = (count) => `${count} hamle`;

export const texts = {
  levelTitle: (level) => `Seviye ${level}`,
  dailyTitle: (date, solved) =>
    `Günün bulmacası · ${dayAndMonth.format(date)}${solved ? ' ✓' : ''}`,
  moves,
  chapterName: (chapterId) => chapterNames[chapterId],
  levelSubtitle: (chapterId, moveCount) => `${chapterNames[chapterId]} · ${moves(moveCount)}`,
  solvedIn: (count) => `${count} hamlede çözdün.`,
  chapterOpened: (chapterId) => `${chapterNames[chapterId]} seviyeler açıldı!`,
  allLevelsSolved: 'Bütün seviyeleri bitirdin!',
  nextLevel: 'Sonraki seviye',
  playAgain: 'Tekrar oyna',
  backToLevels: 'Devam et',
  hintMove: (from, to) => `${from + 1}. tüpten ${to + 1}. tüpe dök.`,
  hintDeadEnd: 'Buradan çözüm bulunamadı. Birkaç hamle geri al.',

  // The level list
  dailyCardTitle: 'Günün bulmacası',
  dailyCardDate: (date) => dayAndMonth.format(date),
  dailyCardAction: (solved) => (solved ? 'Çözüldü ✓' : 'Oyna'),
  chapterDetail: ({ minColors, maxColors, emptyTubeCount }) =>
    `${minColors}–${maxColors} renk${emptyTubeCount === 1 ? ' · tek boş tüp' : ''}`,
  chapterProgress: (solved, total) => `${solved}/${total}`,
  levelTileLabel: (level, state) =>
    ({
      solved: `Seviye ${level}, çözüldü`,
      open: `Seviye ${level}`,
      locked: `Seviye ${level}, kilitli`
    })[state]
};
