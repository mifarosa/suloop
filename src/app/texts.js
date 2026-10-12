/** Every piece of text the player sees, in one place. */

const dayAndMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });

const stageNames = {
  easy: 'Kolay',
  oneWay: 'Tek Yönlü',
  tall: 'Uzun Tüp',
  hidden: 'Gizli Renk',
  cracked: 'Çatlak Tüp',
  locked: 'Kilitli Tüp',
  half: 'Yarım Tüp',
  oil: 'Yağ',
  master: 'Usta'
};
const stageRules = {
  easy: 'Düz tüpler',
  oneWay: 'Tek yönlü tüp',
  tall: '5 birimlik uzun tüp',
  hidden: 'Alttaki renkler gizli',
  cracked: '3 kez dolan çatlak tüp',
  locked: 'Anahtar renkli buzlu tüp',
  half: '2 birimlik yarım tüp',
  oil: 'Hep üstte duran yağ',
  master: 'Sonsuz · her seviyede 3–4 kural'
};
const moves = (count) => `${count} hamle`;
// Rules that change the board get a word in the subtitle; the undo limit shows on its button.
const ruleTags = {
  hiddenColors: 'Gizli renk',
  tallTubes: 'Uzun tüp',
  halfTube: 'Yarım tüp',
  oneWayTube: 'Tek yönlü',
  crackedTube: 'Çatlak tüp',
  lockedTube: 'Kilitli tüp',
  oil: 'Yağ'
};
const ruleIntros = {
  limitedUndo: ({ undoLimit }) =>
    `Bu aşamada ${undoLimit} geri alma hakkın var; baştan başlayınca yenilenir.`,
  hiddenColors: () => 'Gizli renkler: alttaki renkler, üstündekiler döküldükçe görünür.',
  tallTubes: ({ capacity }) => `Uzun tüpler: her tüp ${capacity} birim alır.`,
  halfTube: () => 'Yarım tüp yalnızca 2 birim alır; bitirmek için boş kalmalı.',
  oneWayTube: () => 'Tek yönlü tüp: içine dökebilirsin ama dışına dökemezsin.',
  crackedTube: () => 'Çatlak tüp: içine yalnızca 3 kez dökebilirsin, dışına her zaman.',
  lockedTube: () => 'Kilitli tüp: kilidindeki renkte bir tüp tamamlanınca buzu çözülür.',
  oil: () => 'Yağ suyun üstünde durur: su yağın altına geçer, yağ kalkmadan altındaki su dökülmez.'
};

export const texts = {
  levelTitle: (level) => `Seviye ${level}`,
  dailyTitle: (date, solved) =>
    `Günün bulmacası · ${dayAndMonth.format(date)}${solved ? ' ✓' : ''}`,
  moves,
  stageName: (stageId) => stageNames[stageId],
  levelSubtitle: (stageId, rules, moveCount) =>
    [
      stageNames[stageId],
      ...rules.filter((rule) => rule in ruleTags).map((rule) => ruleTags[rule]),
      moves(moveCount)
    ].join(' · '),
  ruleIntro: (rule, settings) => ruleIntros[rule](settings),
  undo: (undosLeft) => (undosLeft === null ? 'Geri al' : `Geri al (${undosLeft})`),
  solvedIn: (count) => `${count} hamlede çözdün.`,
  stageOpened: (stageId) => `Yeni aşama: ${stageNames[stageId]}!`,
  nextLevel: 'Sonraki seviye',
  backToLevels: 'Devam et',
  hintMove: (from, to) => `${from + 1}. tüpten ${to + 1}. tüpe dök.`,
  hintDeadEnd: 'Buradan çözüm bulunamadı. Birkaç hamle geri al.',
  hintDeadEndNoUndo: 'Buradan çözüm bulunamadı ve geri alma hakkın bitti. Baştan başla.',

  // The level list
  dailyCardTitle: 'Günün bulmacası',
  dailyCardDate: (date) => dayAndMonth.format(date),
  dailyCardAction: (solved) => (solved ? 'Çözüldü ✓' : 'Oyna'),
  stageDetail: (stageId, undoLimit) =>
    `${stageRules[stageId]} · ${undoLimit === null ? 'sınırsız' : undoLimit} geri alma`,
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
