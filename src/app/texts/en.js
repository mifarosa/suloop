/** Every piece of text the player sees, in English. Same keys as tr.js. */

const dayAndMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' });

const stageNames = {
  easy: 'Easy',
  oneWay: 'One-Way',
  tall: 'Tall Tube',
  hidden: 'Hidden Color',
  cracked: 'Cracked Tube',
  locked: 'Locked Tube',
  half: 'Half Tube',
  oil: 'Oil',
  master: 'Mixed'
};
const stageRules = {
  easy: 'Plain tubes',
  oneWay: 'One-way tube',
  tall: 'Tall tube of 5 units',
  hidden: 'Colors below are hidden',
  cracked: 'Cracked tube that fills 3 times',
  locked: 'Icy tube with a key color',
  half: 'Half tube of 2 units',
  oil: 'Oil that always floats on top',
  master: '3–4 mixed rules in every level'
};
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const moves = (count) => plural(count, 'move', 'moves');
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
  hiddenColors: 'Hidden color',
  tallTubes: 'Tall tube',
  halfTube: 'Half tube',
  oneWayTube: 'One-way',
  crackedTube: 'Cracked tube',
  lockedTube: 'Locked tube',
  oil: 'Oil'
};
const ruleNames = {
  basics: 'How to play',
  limitedUndo: 'Limited undo',
  oneWayTube: 'One-way tube',
  tallTubes: 'Tall tube',
  hiddenColors: 'Hidden colors',
  crackedTube: 'Cracked tube',
  lockedTube: 'Locked tube',
  halfTube: 'Half tube',
  oil: 'Oil'
};
const ruleTexts = {
  basics: () =>
    'Tap a tube, then another: the top color is poured into it. Liquid can go into an empty ' +
    'tube or onto the same color. A tube filled with one color gets a cap; you win when all ' +
    'of them are capped or empty.',
  limitedUndo: ({ undoLimit }) =>
    `In this stage every level gives you ${undoLimit} undos; a restart gives them back. ` +
    'When they run out, the spare undos you earned are used.',
  hiddenColors: () => 'The colors below are hidden; they show as the ones above are poured off.',
  tallTubes: ({ capacity }) =>
    `Every tube holds ${capacity} units, and there are ${capacity} units of every color.`,
  halfTube: () => 'It holds only 2 units, so no color fits in whole; it has to end up empty.',
  oneWayTube: () => 'You can pour into it but never out of it. Put only one color in it.',
  crackedTube: () => 'You can pour into it only 3 times, but out of it always.',
  lockedTube: () =>
    'It is covered in ice; once a tube of the key color is complete, the ice melts and you can use it.',
  oil: () =>
    'It floats on water: water slips under the oil, and water under oil cannot be poured out.'
};
const winTitles = ['Well done!', 'Well done!', 'Great!', 'Perfect!'];

export const en = {
  levelTitle: (level) => `Level ${level}`,
  dailyTitle: (date, solved) => `Daily puzzle · ${dayAndMonth.format(date)}${solved ? ' ✓' : ''}`,
  moves,
  stageName: (stageId) => stageNames[stageId],
  /** The stage, then the rules the level adds; past two, just how many (the info has them). */
  levelSubtitle: (stageId, rules, moveCount) => {
    const tags = rules.filter((rule) => rule in ruleTags).map((rule) => ruleTags[rule]);
    return [
      stageNames[stageId],
      ...(tags.length > 2 ? [`${tags.length} rules`] : tags),
      moves(moveCount)
    ].join(' · ');
  },
  customTitle: (fromEditor) => (fromEditor ? 'Your puzzle' : 'Shared puzzle'),
  /** The rules a custom puzzle uses; past two, just how many. */
  customSubtitle: (rules, moveCount) => {
    const tags = rules.filter((rule) => rule in ruleTags).map((rule) => ruleTags[rule]);
    return [...(tags.length > 2 ? [`${tags.length} rules`] : tags), moves(moveCount)].join(' · ');
  },
  backToEditor: 'Back to workshop',

  // The puzzle editor
  editorUndoLimit: (limit) => (limit === null ? 'Unlimited' : `${limit}`),
  editorColorCount: (count) => `${count} colors`,
  editorSwatch: (color, count, capacity) => `Color ${color + 1}: ${count}/${capacity} units`,
  editorProblem: ({ code, count, tube }, capacity) =>
    ({
      tooFewColors: 'Use at least two colors.',
      colorCount: `Every color needs ${capacity} units; one has ${count} (marked red).`,
      lockKeyMissing: `The key color of tube ${tube + 1} is not on the board.`,
      lockKeyInside: `The key color of tube ${tube + 1} is inside it, so it could never be completed.`,
      alreadySolved: 'This board is solved already; mix the colors up.'
    })[code],
  editorChecking: 'Looking for a solution…',
  editorSolvable: ({ moves, proven }) =>
    proven
      ? `Solvable · ${moves} moves at the fewest`
      : `Solvable · shortest solution found: ${moves} moves`,
  editorUnsolvable: 'No solution found. Try adding an empty tube or changing the colors.',
  editorShareTitle: 'My Wasorty puzzle',
  editorLinkCopied: 'Link copied ✓',
  editorImportFailed: 'That is not a puzzle code. Check the code or the link.',
  editorImported: 'Puzzle loaded.',
  sharedPuzzleInvalid: 'This puzzle link is broken.',
  editorCardTitle: 'Puzzle workshop',
  editorCardText: 'Make your own puzzle and share it with a code',
  editorCardAction: 'Open',
  editorButton: 'Workshop',
  levelsButton: 'Levels',
  ruleName: (rule) => ruleNames[rule],
  ruleText: (rule, settings) => ruleTexts[rule](settings),

  // The toolbar
  /** The undos left on the undo button: none for no limit, spare ones after a plus. */
  undoCount: (undosLeft, spareUndos) =>
    undosLeft === null ? null : spareUndos > 0 ? `${undosLeft}+${spareUndos}` : `${undosLeft}`,
  undoLabel: (undosLeft, spareUndos) =>
    undosLeft === null
      ? 'Undo'
      : `Undo: ${undosLeft} left in this level` +
        (spareUndos > 0 ? `, ${spareUndos} spare undos` : ''),
  hintLabel: (hints) => `Hint: you have ${hints}`,
  spareUndoUsed: (left) => `You used a spare undo; ${left} left.`,
  noHints: 'You are out of hints. Solve the daily puzzle to earn 1.',
  hintMove: (from, to) => `Pour tube ${from + 1} into tube ${to + 1}. (Hint: +1 move)`,
  hintDeadEnd: 'There is no solution from here. Undo a few moves; your hint was not spent.',
  hintDeadEndNoUndo: 'There is no solution from here and you are out of undos. Restart.',

  // The win dialog
  winTitle: (stars) => winTitles[stars],
  starsLabel: (stars) => `${stars} out of 3 stars`,
  yourMoves: 'Your moves',
  fewestMoves: (proven) => (proven ? 'Fewest' : 'Shortest found'),
  stageOpened: (stageId) => `New stage unlocked: ${stageNames[stageId]}!`,
  earnedUndo: '+1 spare undo',
  newsDailyRules:
    "What's new: the daily puzzle now has special rules too. Today's puzzle changed as well; your earlier results stay.",
  earnedHint: 'Daily puzzle: +1 hint!',
  attemptsTitle: 'Recent attempts',
  attemptMoves: (count) => moves(count),
  replay: 'Play again',
  nextLevel: 'Next level',
  backToLevels: 'Continue',

  // The rules dialog: new rules as a level starts, or every rule of the level from (i)
  newRulesTitle: (count) => (count > 1 ? 'New rules' : 'New rule'),
  gotIt: 'Got it',
  close: 'Close',
  rulesHeading: 'Rules',
  starsHeading: 'Stars',
  starRule: (stars, fewest, threeLimit, limit) =>
    [
      'More moves',
      `Up to ${limit} moves`,
      threeLimit > fewest ? `Up to ${threeLimit} moves` : `${fewest} moves (the fewest)`
    ][stars - 1],
  fewestPending: 'Working out the fewest moves…',
  suppliesHeading: 'Your supplies',
  undoSupply: (undoLimit, undosLeft) =>
    undoLimit === null
      ? 'Undo is unlimited in this level.'
      : `${undosLeft} of this level's ${undoLimit} undos left.`,
  spareUndoSupply: (count, max) =>
    `You have ${count} spare undos (up to ${max} are kept). Solving a level with 3 stars for the ` +
    'first time earns 1 more.',
  hintSupply: (count) =>
    `You have ${count} hints. Each hint adds 1 to your moves, and a spent hint does not come ` +
    'back when you undo. Solving the daily puzzle earns 1 more.',
  noAttempts: 'You have not solved this level yet.',

  // The level list
  dailyCardTitle: 'Daily puzzle',
  dailyCardDate: (date) => dayAndMonth.format(date),
  dailyCardAction: (solved) => (solved ? 'Solved ✓' : 'Play'),
  stageDetail: (stageId, undoLimit) =>
    `${stageRules[stageId]} · ${undoLimit === null ? 'unlimited' : undoLimit} undo`,
  chapterProgress: (solved, total) => `${solved}/${total}`,
  // Copying a result
  copyFailed: 'Could not copy. Write the code down.',

  // The account
  accountSignedIn: 'You are signed in',
  accountSignedInAs: (name) => `Signed in as ${name}`,
  accountSignedOut:
    'Your progress stays on this device. Sign in to keep it in your account and get it on your other devices.',
  accountSyncStatus: (status) =>
    ({
      idle: '',
      syncing: 'Syncing…',
      synced: 'Synced ✓',
      failed: 'Could not sync; it will be tried again shortly.'
    })[status],
  accountNeedsName: 'Pick a username everyone can see.',
  usernameInvalid: '3–20 characters: letters, digits and underscores.',
  usernameTaken: 'That username is taken, try another.',
  usernameFailed: 'Could not save the username. Check your connection.',
  accountError: (code) =>
    ({
      'auth/popup-blocked': 'The sign-in window was blocked. Check your browser’s pop-up setting.',
      'auth/network-request-failed': 'Could not connect. Check your internet.',
      'auth/unauthorized-domain': 'Sign-in is not set up for this address.',
      'invalid-credential': 'The sign-in could not be checked, try again.',
      network: 'Could not reach the server. Check your internet.',
      'delete-failed': 'The account could not be deleted, try again.'
    })[code] ?? 'Something went wrong, try again.',
  accountDeleteConfirm:
    'Delete your account and everything kept in it? The progress on this device stays.',
  cloudProgressLoaded: (solved) => `Progress loaded from your account: ${solved} levels solved.`,

  // The end of the game
  coffee: '☕ Buy me a coffee',
  finishGame: 'Finish',
  shareFinishText: (stars, max) => `Wasorty · I finished all 300 levels! ⭐ ${stars}/${max}`,
  finishTitle: 'You did it!',
  finishText: (total) => `You finished all ${total} levels.`,
  finishStars: 'Stars',
  finishPerfect: 'Perfect levels',
  finishShare: 'Share',
  finishLevels: 'Levels',
  finishedCardTitle: 'Completed',
  finishedCardText: 'You finished all 300 levels',
  finishedCardAction: 'Open',

  // Sharing a result
  shareResult: 'Share result',
  shareCopied: 'Copied ✓',
  shareStars: (stars) => '⭐'.repeat(stars) + '☆'.repeat(3 - stars),
  shareLevelText: (level, stars, moves, fewest) =>
    `Wasorty · Level ${level} ${en.shareStars(stars)}\n${en.moves(moves)} (fewest ${fewest})`,
  shareDailyText: (date, stars, moves, seconds, streak) =>
    `Wasorty · Daily puzzle, ${dayAndMonth.format(date)} ${en.shareStars(stars)}\n` +
    `${en.moves(moves)} · ${duration(seconds)}` +
    (streak >= 2 ? ` · 🔥 ${streak} days` : ''),

  // Watching the solution
  watchSolution: 'Watch the solution',
  watchPreparing: 'Getting the solution ready…',
  watchStep: (done, total) => `Watching the solution · ${done}/${total} · tap`,
  watchTapToStart: 'The solution is shown step by step: tap a tube to go to the next move.',
  watchNoUndo: 'You cannot undo while watching the solution.',
  watchNoHint: 'You do not need a hint while watching the solution.',
  watchDone: 'Now you try: those 3 stars are yours!',
  watchFailed: 'The solution of this level cannot be shown right now.',

  // The daily leaderboard
  leaderboardLoading: 'Loading the leaderboard…',
  dailyToday: (moves, seconds, score) =>
    `Today: ${en.moves(moves)} · ${duration(seconds)}${score === undefined ? '' : ` · ${score} pts`}`,
  dailyNotSolved: 'You have not solved today’s puzzle yet.',
  playDaily: 'Play the daily puzzle',
  dailyStreak: (days) => `🔥 ${days} days in a row`,
  dailyStreakNote: (days) => `🔥 ${days} days in a row!`,
  dailyResult: (moves, seconds) => `${en.moves(moves)} · ${duration(seconds)}`,
  leaderboardTitle: 'Daily leaderboard',
  accountTitle: 'Account',
  leaderboardTop: 'Today’s best',
  leaderboardFailed: 'Could not load the leaderboard. Check your connection.',
  leaderboardSignIn: 'Sign in with Google to join the leaderboard.',
  leaderboardNeedsName: 'Pick a username to join the leaderboard.',
  signInToRank: 'Sign in',
  pickUsername: 'Pick a username',
  leaderboardSending: 'Sending your result to the leaderboard…',
  leaderboardMyRank: (rank) => `Your place: ${rank}.`,
  leaderboardHow:
    'Points: 1000 for solving it in the fewest moves. More moves and a long time take points off; a hint counts as a move.',
  points: (score) => `${score} pts`,
  leaderboardEmpty: 'Nobody is on the leaderboard yet today.',
  save: 'Save',
  dailyHistory: 'Your recent days',
  dailyNoHistory: 'You have not solved a daily puzzle yet.',
  leaderboardLocalOnly: 'The first solution of each day counts.',
  dailyDate: (day) => dayAndMonth.format(new Date(`${day}T12:00:00`)),
  duration,

  levelTileLabel: (level, state, stars) =>
    ({
      solved: `Level ${level}, solved${stars > 0 ? `, ${stars} stars` : ''}`,
      open: `Level ${level}`,
      locked: `Level ${level}, locked`
    })[state]
};
