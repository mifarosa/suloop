/** Every piece of text the player sees, in Turkish. See en.js for English. */

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
/** Seconds as m:ss, or h:mm:ss past an hour. */
const duration = (seconds) => {
  const pad = (value) => String(value).padStart(2, '0');
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = pad(seconds % 60);
  return hours > 0 ? `${hours}:${pad(minutes)}:${rest}` : `${minutes}:${rest}`;
};
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

export const tr = {
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
  customTitle: (fromEditor) => (fromEditor ? 'Senin bulmacan' : 'Paylaşılan bulmaca'),
  /** The rules a custom puzzle uses; past two, just how many. */
  customSubtitle: (rules, moveCount) => {
    const tags = rules.filter((rule) => rule in ruleTags).map((rule) => ruleTags[rule]);
    return [...(tags.length > 2 ? [`${tags.length} kural`] : tags), moves(moveCount)].join(' · ');
  },
  backToEditor: 'Atölyeye dön',

  // The puzzle editor
  editorUndoLimit: (limit) => (limit === null ? 'Sınırsız' : `${limit}`),
  editorColorCount: (count) => `${count} renk`,
  editorSwatch: (color, count, capacity) => `Renk ${color + 1}: ${count}/${capacity} birim`,
  editorProblem: ({ code, count, tube }, capacity) =>
    ({
      tooFewColors: 'En az iki renk koy.',
      colorCount: `Her renkten ${capacity} birim olmalı; birinde ${count} var (kırmızı işaretli).`,
      lockKeyMissing: `${tube + 1}. tüpün kilit rengi tahtada yok.`,
      lockKeyInside: `${tube + 1}. tüpün kilit rengi kendi içinde; o renk hiç tamamlanamaz.`,
      alreadySolved: 'Bu tahta zaten çözülmüş; renkleri karıştır.'
    })[code],
  editorChecking: 'Çözüm aranıyor…',
  editorSolvable: ({ moves, proven }) =>
    proven
      ? `Çözülebilir · en az ${moves} hamle`
      : `Çözülebilir · bulunan en kısa çözüm ${moves} hamle`,
  editorUnsolvable: 'Çözüm bulunamadı. Boş tüp eklemeyi ya da renkleri değiştirmeyi dene.',
  editorShareTitle: 'suloop bulmacam',
  editorLinkCopied: 'Bağlantı kopyalandı ✓',
  editorImportFailed: 'Bu bir bulmaca kodu değil. Kodu ya da bağlantıyı kontrol et.',
  editorImported: 'Bulmaca yüklendi.',
  sharedPuzzleInvalid: 'Bu bulmaca bağlantısı bozuk.',
  editorCardTitle: 'Bulmaca atölyesi',
  editorCardText: 'Kendi bulmacanı yap, kodla paylaş',
  editorCardAction: 'Aç',
  editorButton: 'Atölye',
  levelsButton: 'Seviyeler',
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
  hintMove: (from, to) => `${from + 1}. tüpten ${to + 1}. tüpe dök. (İpucu +1 hamle)`,
  hintDeadEnd: 'Buradan çözüm yok. Birkaç hamle geri al; ipucu hakkın gitmedi.',
  hintDeadEndNoUndo: 'Buradan çözüm yok ve geri alma hakkın bitti. Baştan başla.',

  // The win dialog
  winTitle: (stars) => winTitles[stars],
  starsLabel: (stars) => `3 yıldızdan ${stars}`,
  yourMoves: 'Hamlen',
  fewestMoves: (proven) => (proven ? 'En az' : 'En kısa bulunan'),
  stageOpened: (stageId) => `Yeni aşama açıldı: ${stageNames[stageId]}!`,
  earnedUndo: '+1 ekstra geri alma',
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
  spareUndoSupply: (count, max) =>
    `${count} ekstra geri alman var (en fazla ${max} birikir). Bir seviyeyi ilk kez 3 yıldızla ` +
    'geçtikçe 1 tane daha kazanırsın.',
  hintSupply: (count) =>
    `${count} ipucun var. Her ipucu hamle sayına 1 ekler; geri alınca harcanan ipucu geri ` +
    'gelmez. Günün bulmacasını çözünce 1 tane daha kazanırsın.',
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

  // Sharing a result
  shareResult: 'Sonucu paylaş',
  shareCopied: 'Kopyalandı ✓',
  shareStars: (stars) => '⭐'.repeat(stars) + '☆'.repeat(3 - stars),
  shareLevelText: (level, stars, moves, fewest) =>
    `suloop · Seviye ${level} ${tr.shareStars(stars)}\n${moves} hamle (en az ${fewest})`,
  shareDailyText: (date, stars, moves, seconds, streak) =>
    `suloop · Günün bulmacası, ${dayAndMonth.format(date)} ${tr.shareStars(stars)}\n` +
    `${moves} hamle · ${duration(seconds)}` +
    (streak >= 2 ? ` · 🔥 ${streak} gün` : ''),

  // Watching the solution
  watchSolution: 'Çözümü izle',
  watchPreparing: 'Çözüm hazırlanıyor…',
  watchStep: (done, total) => `Çözümü izliyorsun · ${done}/${total} · dokun`,
  watchTapToStart: 'Çözüm adım adım gösterilecek: tüplerin üstüne dokundukça ilerler.',
  watchNoUndo: 'Çözümü izlerken geri alamazsın.',
  watchNoHint: 'Çözümü izlerken ipucu gerekmez.',
  watchDone: 'Şimdi sen dene: 3 yıldız artık senin!',
  watchFailed: 'Bu seviyenin çözümü şu an gösterilemiyor.',

  // The daily leaderboard
  leaderboardLoading: 'Sıralama yükleniyor…',
  dailyToday: (moves, seconds) => `Bugün: ${moves} hamle · ${duration(seconds)}`,
  dailyNotSolved: 'Bugünkü bulmacayı henüz çözmedin.',
  playDaily: 'Günün bulmacasını oyna',
  dailyStreak: (days) => `🔥 ${days} gün üst üste`,
  dailyStreakNote: (days) => `🔥 ${days} gün üst üste çözdün!`,
  dailyResult: (moves, seconds) => `${moves} hamle · ${duration(seconds)}`,
  leaderboardTop: 'Bugünün en iyileri',
  leaderboardFailed: 'Sıralama yüklenemedi. Bağlantını kontrol et.',
  leaderboardEmpty: 'Bugün henüz kimse sıralamaya girmedi.',
  leaderboardName: 'Sıralamada görünecek adın',
  leaderboardNamePlaceholder: 'Takma ad',
  save: 'Kaydet',
  dailyHistory: 'Son günlerin',
  dailyNoHistory: 'Henüz günün bulmacasını çözmedin.',
  leaderboardLocalOnly: 'Her günün ilk çözümün sayılır.',
  dailyDate: (day) => dayAndMonth.format(new Date(`${day}T12:00:00`)),
  duration,

  levelTileLabel: (level, state, stars) =>
    ({
      solved: `Seviye ${level}, çözüldü${stars > 0 ? `, ${stars} yıldız` : ''}`,
      open: `Seviye ${level}`,
      locked: `Seviye ${level}, kilitli`
    })[state]
};
