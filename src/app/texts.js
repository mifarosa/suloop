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
const ruleNames = {
  basics: 'Nasıl oynanır',
  limitedUndo: 'Sınırlı geri alma',
  oneWayTube: 'Tek yönlü tüp',
  tallTubes: 'Uzun tüp',
  hiddenColors: 'Gizli renkler',
  crackedTube: 'Çatlak tüp',
  lockedTube: 'Kilitli tüp',
  halfTube: 'Yarım tüp',
  oil: 'Yağ'
};
const ruleTexts = {
  basics: () =>
    'Bir tüpe dokun, sonra başka bir tüpe: üstteki renk oraya dökülür. Sıvı boş bir tüpe ya da ' +
    'aynı rengin üstüne dökülebilir. Tek renkle dolan tüpün kapağı kapanır; hepsi kapanınca ' +
    'ya da boş kalınca kazanırsın.',
  limitedUndo: ({ undoLimit }) =>
    `Bu aşamada her seviyede ${undoLimit} geri alma hakkın var; baştan başlayınca yenilenir. ` +
    'Hakların bitince kazandığın ekstra geri almalar kullanılır.',
  hiddenColors: () => 'Alttaki renkler gizli; üstündekiler döküldükçe görünür.',
  tallTubes: ({ capacity }) =>
    `Her tüp ${capacity} birim alır, her renkten de ${capacity} birim var.`,
  halfTube: () => 'Yalnızca 2 birim alır, bir rengin tamamı sığmaz; bitirmek için boş kalmalı.',
  oneWayTube: () => 'İçine dökebilirsin ama dışına dökemezsin. İçine tek bir renk koy.',
  crackedTube: () => 'İçine yalnızca 3 kez dökebilirsin, dışına her zaman.',
  lockedTube: () =>
    'Buzla kaplı; kilidindeki renkte bir tüp tamamlanınca buzu çözülür ve kullanılabilir.',
  oil: () => 'Suyun üstünde durur: su yağın altına geçer, yağ kalkmadan altındaki su dökülmez.'
};
const winTitles = ['Tebrikler!', 'Tebrikler!', 'Harika!', 'Mükemmel!'];

export const texts = {
  levelTitle: (level) => `Seviye ${level}`,
  dailyTitle: (date, solved) =>
    `Günün bulmacası · ${dayAndMonth.format(date)}${solved ? ' ✓' : ''}`,
  moves,
  stageName: (stageId) => stageNames[stageId],
  /** The stage, then the rules the level adds; past two, just how many (the info has them). */
  levelSubtitle: (stageId, rules, moveCount) => {
    const tags = rules.filter((rule) => rule in ruleTags).map((rule) => ruleTags[rule]);
    return [
      stageNames[stageId],
      ...(tags.length > 2 ? [`${tags.length} kural`] : tags),
      moves(moveCount)
    ].join(' · ');
  },
  ruleName: (rule) => ruleNames[rule],
  ruleText: (rule, settings) => ruleTexts[rule](settings),

  // The toolbar
  /** The undos left on the undo button: none for no limit, spare ones after a plus. */
  undoCount: (undosLeft, spareUndos) =>
    undosLeft === null ? null : spareUndos > 0 ? `${undosLeft}+${spareUndos}` : `${undosLeft}`,
  undoLabel: (undosLeft, spareUndos) =>
    undosLeft === null
      ? 'Geri al'
      : `Geri al: bu seviyede ${undosLeft} hak` +
        (spareUndos > 0 ? `, ${spareUndos} ekstra geri alma` : ''),
  hintLabel: (hints) => `İpucu: ${hints} hakkın var`,
  spareUndoUsed: (left) => `Ekstra geri alma kullandın; ${left} kaldı.`,
  noHints: 'İpucu hakkın kalmadı. Günün bulmacasını çözünce 1 ipucu kazanırsın.',
  hintMove: (from, to) => `${from + 1}. tüpten ${to + 1}. tüpe dök.`,
  hintDeadEnd: 'Buradan çözüm yok. Birkaç hamle geri al; ipucu hakkın gitmedi.',
  hintDeadEndNoUndo: 'Buradan çözüm yok ve geri alma hakkın bitti. Baştan başla.',

  // The win dialog
  winTitle: (stars) => winTitles[stars],
  starsLabel: (stars) => `3 yıldızdan ${stars}`,
  yourMoves: 'Hamlen',
  fewestMoves: (proven) => (proven ? 'En az' : 'En kısa bulunan'),
  stageOpened: (stageId) => `Yeni aşama açıldı: ${stageNames[stageId]}!`,
  earnedUndo: 'İlk kez 3 yıldız: +1 ekstra geri alma!',
  earnedHint: 'Günün bulmacası: +1 ipucu!',
  attemptsTitle: 'Son denemeler',
  attemptMoves: (moves) => `${moves} hamle`,
  replay: 'Tekrar et',
  nextLevel: 'Sonraki seviye',
  backToLevels: 'Devam et',

  // The rules dialog: new rules as a level starts, or every rule of the level from (i)
  newRulesTitle: (count) => (count > 1 ? 'Yeni kurallar' : 'Yeni kural'),
  gotIt: 'Anladım',
  close: 'Kapat',
  rulesHeading: 'Kurallar',
  starsHeading: 'Yıldızlar',
  starRule: (stars, fewest, limit) =>
    [`Daha fazla hamle`, `${limit} hamleye kadar`, `${fewest} hamle (en az)`][stars - 1],
  fewestPending: 'En az hamle hesaplanıyor…',
  suppliesHeading: 'Hakların',
  undoSupply: (undoLimit, undosLeft) =>
    undoLimit === null
      ? 'Bu seviyede geri alma sınırsız.'
      : `Bu seviyede ${undoLimit} geri alma hakkından ${undosLeft} tanesi kaldı.`,
  spareUndoSupply: (count) =>
    `${count} ekstra geri alman var. Bir seviyeyi ilk kez 3 yıldızla geçtikçe 1 tane daha kazanırsın.`,
  hintSupply: (count) =>
    `${count} ipucun var. Günün bulmacasını çözünce 1 tane daha kazanırsın; ` +
    'geri alınca harcanan ipucu geri gelmez.',
  noAttempts: 'Bu seviyeyi henüz çözmedin.',

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

  levelTileLabel: (level, state, stars) =>
    ({
      solved: `Seviye ${level}, çözüldü${stars > 0 ? `, ${stars} yıldız` : ''}`,
      open: `Seviye ${level}`,
      locked: `Seviye ${level}, kilitli`
    })[state]
};
