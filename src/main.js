import './styles.css';
import { GameController } from './app/controller.js';
import { DailyBoard } from './app/dailyBoard.js';
import { EditorDialog } from './app/editorDialog.js';
import { loadDailyRecord, saveDailyRecord } from './app/dailyResults.js';
import { Feedback } from './app/feedback.js';
import { createFewestMovesFinder } from './app/fewestMoves.js';
import { Hud } from './app/hud.js';
import { createLeaderboard } from './app/leaderboard.js';
import { LeaderboardDialog } from './app/leaderboardDialog.js';
import { LevelMenu } from './app/levelMenu.js';
import { loadProgress, saveProgress } from './app/progress.js';
import { codeInLink } from './app/progressCode.js';
import { RulesDialog } from './app/rulesDialog.js';
import { loadSettings, saveSettings } from './app/settings.js';
import { SettingsDialog } from './app/settingsDialog.js';
import { createThemer } from './app/theme.js';
import { texts } from './app/texts.js';
import { TransferDialog } from './app/transferDialog.js';
import { decodePuzzle } from './game/customPuzzle.js';
import { Confetti } from './scene/confetti.js';
import { TubeScene } from './scene/tubeScene.js';

const scene = new TubeScene(document.querySelector('#scene'), {
  getTopInset: () => document.querySelector('.hud').getBoundingClientRect().bottom,
  getBottomInset: () =>
    innerHeight - document.querySelector('.toolbar').getBoundingClientRect().top,
  confetti: new Confetti(document.querySelector('#confetti'))
});
const feedback = new Feedback();
const themer = createThemer((look) => scene.setLook(look));
const hud = new Hud(document);
const menu = new LevelMenu(document);
const transfer = new TransferDialog(document);
const rules = new RulesDialog(document, { getLook: () => themer.look() });
const settingsDialog = new SettingsDialog(document);
const leaderboardDialog = new LeaderboardDialog(document);
// The daily leaderboard is shared when the build has a Supabase project (see leaderboard.js).
const dailyBoard = new DailyBoard({
  record: loadDailyRecord(),
  save: saveDailyRecord,
  service: createLeaderboard({
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY
  })
});
const findFewestMoves = createFewestMovesFinder();
// The editor draws the board being made with a scene of its own.
const editor = new EditorDialog(document, {
  scene: new TubeScene(document.querySelector('#editor-board')),
  findFewestMoves,
  getLook: () => themer.look()
});
const controller = new GameController({
  scene,
  hud,
  menu,
  transfer,
  rules,
  findFewestMoves,
  feedback,
  onDailySolved: (day, result) => dailyBoard.record(day, result),
  getDailySummary: (today) => dailyBoard.summary(today),
  dailyResults: {
    results: () => dailyBoard.results(),
    merge: (results) => dailyBoard.mergeResults(results)
  },
  leaderboardOnline: dailyBoard.online,
  onEditPuzzle: (puzzle) => editor.show(puzzle),
  progress: loadProgress(),
  saveProgress
});

scene.onTubeTap((index) => controller.tapTube(index));
hud.bindActions({
  onUndo: () => controller.undo(),
  onHint: () => controller.showHint(),
  onRestart: () => controller.restart(),
  onInfo: () => controller.showInfo(),
  onSettings: () => settingsDialog.show(settings, device()),
  onShowLevels: () => controller.showLevels(),
  onContinue: () => controller.continueAfterWin(),
  onReplay: () => controller.replay(),
  onContinueToLevels: () => controller.continueToLevels(),
  onLeaderboard: () => showLeaderboard()
});
menu.bindActions({
  onPickLevel: (level) => controller.playLevel(level),
  onPickDaily: () => controller.playDaily(),
  onTransfer: () => controller.showTransfer(),
  onLeaderboard: () => {
    controller.closeLevels();
    showLeaderboard();
  },
  onEditor: () => {
    controller.closeLevels();
    editor.show();
  },
  onClose: () => controller.closeLevels()
});
transfer.bindActions({
  onImport: (code) => controller.importProgress(code),
  onClose: () => controller.closeTransfer()
});
rules.bindActions({ onClose: () => controller.closeRules() });

editor.bindActions({
  onPlay: (puzzle) => {
    editor.hide();
    controller.playCustom(puzzle, { fromEditor: true });
  },
  onClose: () => editor.hide()
});

// Without a shared leaderboard there is nothing to rank; the daily card shows the streak.
document.querySelector('#leaderboard-open').hidden = !dailyBoard.online;

async function showLeaderboard() {
  leaderboardDialog.showLoading();
  leaderboardDialog.show(await dailyBoard.view(new Date()));
}
leaderboardDialog.bindActions({
  onSetName: async (name) => {
    if (await dailyBoard.setName(name, new Date())) showLeaderboard();
  },
  onPlayDaily: () => {
    leaderboardDialog.hide();
    controller.playDaily();
  },
  onClose: () => leaderboardDialog.hide()
});

// Sounds, vibration and the scene's moments that go with them.
scene.onCue((cue) => feedback.cue(cue));
// Browsers start audio only from a tap; catch every tap before the game handles it.
document.addEventListener('pointerdown', () => feedback.unlock(), { capture: true });

// Settings: the theme, sounds and vibration, and installing the game as an app.
let settings = loadSettings();
let installPrompt = null;
const device = () => ({ canVibrate: feedback.canVibrate, canInstall: installPrompt !== null });
function applySettings() {
  themer.apply(settings.theme, settings.symbols);
  feedback.configure(settings);
}
window.addEventListener('beforeinstallprompt', (event) => {
  // Offered from the settings instead of the browser's own banner.
  event.preventDefault();
  installPrompt = event;
});
settingsDialog.bindActions({
  onChange: (change) => {
    settings = { ...settings, ...change };
    saveSettings(settings);
    applySettings();
    settingsDialog.render(settings, device());
  },
  onInstall: () => {
    installPrompt?.prompt();
    installPrompt = null;
    settingsDialog.render(settings, device());
  },
  onClose: () => settingsDialog.hide()
});
applySettings();
controller.start();

/**
 * Takes what a link carries: progress, as in "…/suloop/#ilerleme=2FQ7M", or a puzzle someone
 * shared, as in "…/suloop/#bulmaca=…". It works for links opened here or pasted in.
 */
function openLink() {
  const code = codeInLink(location.href);
  const sharedPuzzle = /#bulmaca=/.test(location.hash) ? decodePuzzle(location.hash) : undefined;
  if (code === null && sharedPuzzle === undefined) return;

  // Drop the code from the address, so a reload or a bookmark does not bring it back.
  history.replaceState(null, '', location.pathname + location.search);
  if (code !== null) controller.importProgress(code, { fromLink: true });
  else if (sharedPuzzle) controller.playCustom(sharedPuzzle);
  else hud.showToast(texts.sharedPuzzleInvalid);
}
openLink();
window.addEventListener('hashchange', openLink);

// Offline play and installing as an app; only the built game has a service worker.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Without it the game still works online.
    });
  });
}
