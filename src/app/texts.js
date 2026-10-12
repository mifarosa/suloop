/** Every piece of text the player sees, in one place. */

const dayAndMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });

const chapterNames = {
  easy: 'Kolay',
  medium: 'Orta',
  hard: 'Zor',
  expert: 'Uzman',
  master: 'Usta'
};
const moves = (count) => `${count} hamle`;
// Rules that change the board get a word in the subtitle; the undo limit shows on its button.
const ruleTags = { hiddenColors: 'Gizli renk', tallTubes: 'Uzun tüp', halfTube: 'Yarım tüp' };
const ruleIntros = {
  limitedUndo: ({ undoLimit }) =>
    `Usta seviyelerinde ${undoLimit} geri alma hakkın var; baştan başlayınca yenilenir.`,
  hiddenColors: () => 'Gizli renkler: alttaki renkler, üstündekiler döküldükçe görünür.',
  tallTubes: ({ capacity }) => `Uzun tüpler: her tüp ${capacity} birim alır.`,
  halfTube: () => 'Yarım tüp yalnızca 2 birim alır; bitirmek için boş kalmalı.'
};

export const texts = {
  levelTitle: (level) => `Seviye ${level}`,
  dailyTitle: (date, solved) =>
    `Günün bulmacası · ${dayAndMonth.format(date)}${solved ? ' ✓' : ''}`,
  moves,
  chapterName: (chapterId) => chapterNames[chapterId],
  levelSubtitle: (chapterId, rules, moveCount) =>
    [
      chapterNames[chapterId],
      ...rules.filter((rule) => rule in ruleTags).map((rule) => ruleTags[rule]),
      moves(moveCount)
    ].join(' · '),
  ruleIntro: (rule, settings) => ruleIntros[rule](settings),
  undo: (undosLeft) => (undosLeft === null ? 'Geri al' : `Geri al (${undosLeft})`),
  solvedIn: (count) => `${count} hamlede çözdün.`,
  chapterOpened: (chapterId) => `${chapterNames[chapterId]} seviyeler açıldı!`,
  nextLevel: 'Sonraki seviye',
  backToLevels: 'Devam et',
  hintMove: (from, to) => `${from + 1}. tüpten ${to + 1}. tüpe dök.`,
  hintDeadEnd: 'Buradan çözüm bulunamadı. Birkaç hamle geri al.',
  hintDeadEndNoUndo: 'Buradan çözüm bulunamadı ve geri alma hakkın bitti. Baştan başla.',

  // The level list
  dailyCardTitle: 'Günün bulmacası',
  dailyCardDate: (date) => dayAndMonth.format(date),
  dailyCardAction: (solved) => (solved ? 'Çözüldü ✓' : 'Oyna'),
  chapterDetail: ({ minColors, maxColors, emptyTubeCount }) =>
    `${minColors}–${maxColors} renk${emptyTubeCount === 1 ? ' · tek boş tüp' : ''}`,
  masterDetail: 'Sonsuz · 3 geri alma · gizli renk, uzun ve yarım tüp',
  chapterProgress: (solved, total) => `${solved}/${total}`,
  masterProgress: (solved) => `${solved} çözüldü`,
  // Carrying progress to another device
  linkCopied: 'Kopyalandı ✓',
  copyFailed: 'Kopyalanamadı. Kodu bir yere not al.',
  transferInvalid: 'Bu kod geçersiz. Harfleri kontrol et.',
  transferLoaded: (solved) => `İlerleme yüklendi: ${solved} seviye çözülmüş.`,
  transferUnchanged: (solved) => `Bu cihazda zaten ${solved} seviye çözülmüş, ilerleme değişmedi.`,

  levelTileLabel: (level, state) =>
    ({
      solved: `Seviye ${level}, çözüldü`,
      open: `Seviye ${level}`,
      locked: `Seviye ${level}, kilitli`
    })[state]
};
