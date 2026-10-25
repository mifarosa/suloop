import './styles.css';
import { GameController } from './app/controller.js';
import { DailyBoard } from './app/dailyBoard.js';
import { EditorDialog } from './app/editorDialog.js';
import { loadDailyRecord, saveDailyRecord } from './app/dailyResults.js';
import { Feedback } from './app/feedback.js';
import { createPuzzleSolver } from './app/fewestMoves.js';
import { Hud } from './app/hud.js';
import { LeaderboardDialog } from './app/leaderboardDialog.js';
import { LevelMenu } from './app/levelMenu.js';
import { loadProgress, saveProgress } from './app/progress.js';
import { RulesDialog } from './app/rulesDialog.js';
import { setLanguage } from './app/i18n.js';
import { loadSettings, saveSettings } from './app/settings.js';
import { applyStaticTexts } from './app/staticTexts.js';
import { SettingsDialog } from './app/settingsDialog.js';
import { createThemer } from './app/theme.js';
import { texts } from './app/texts.js';
import { decodePuzzle } from './game/customPuzzle.js';
import { AccountPanel } from './app/accountPanel.js';
import { Account } from './cloud/account.js';
import { CloudSync } from './cloud/cloudSync.js';
import { createDailyStore } from './cloud/dailyStore.js';
import { CLOUD_CONFIGURED } from './cloud/config.js';
import { createFirebaseBackend } from './cloud/firebaseBackend.js';
import { Confetti } from './scene/confetti.js';
import { TubeScene } from './scene/tubeScene.js';

// The language comes first: every text below is drawn in it.
let settings = loadSettings();
setLanguage(settings.language);
document.documentElement.lang = settings.language;
if (settings.language === 'en') {
  document.title = 'suloop · Water sort puzzle';
  applyStaticTexts(document);
}

const scene = new TubeScene(document.querySelector('#scene'), {
  getTopInset: () => document.querySelector('.hud').getBoundingClientRect().bottom,
  getBottomInset: () =>
    innerHeight - document.querySelector('.toolbar').getBoundingClientRect().top,
  confetti: new Confetti(document.querySelector('#confetti')),
  layered: true
});
const feedback = new Feedback();
const themer = createThemer((look) => scene.setLook(look));
const hud = new Hud(document);
const menu = new LevelMenu(document);
const rules = new RulesDialog(document, { getLook: () => themer.look() });
const settingsDialog = new SettingsDialog(document);
const leaderboardDialog = new LeaderboardDialog(document);
// The daily leaderboard is shared when the build has a Firebase project (see cloud/dailyStore.js).
// The account keeps progress in the cloud; it hears about every change made on this device.
let cloudSync = null;
let account = null;
const dailyBoard = new DailyBoard({
  record: loadDailyRecord(),
  save: (record) => {
    saveDailyRecord(record);
    cloudSync?.schedule();
  },
  service: CLOUD_CONFIGURED ? createDailyStore() : null
});
const { fewest: findFewestMoves, solution: findSolution } = createPuzzleSolver();
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
  rules,
  findFewestMoves,
  findSolution,
  feedback,
  onDailySolved: (day, result) => dailyBoard.record(day, result),
  getDailySummary: (today) => dailyBoard.summary(today),
  leaderboardOnline: dailyBoard.online,
  onEditPuzzle: (puzzle) => editor.show(puzzle),
  progress: loadProgress(),
  saveProgress: (progress) => {
    saveProgress(progress);
    cloudSync?.schedule();
  }
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
  onWatchSolution: () => controller.watchSolution(),
  onContinueToLevels: () => controller.continueToLevels(),
  onLeaderboard: () => showLeaderboard()
});
menu.bindActions({
  onPickLevel: (level) => controller.playLevel(level),
  onPickDaily: () => controller.playDaily(),
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
  const state = account?.state;
  leaderboardDialog.show(await dailyBoard.view(new Date()), {
    signedIn: state?.status === 'ready' && Boolean(state.username),
    username: state?.username ?? null
  });
}
leaderboardDialog.bindActions({
  onSignIn: () => {
    leaderboardDialog.hide();
    settingsDialog.show(settings, device());
  },
  onPlayDaily: () => {
    leaderboardDialog.hide();
    controller.playDaily();
  },
  onClose: () => leaderboardDialog.hide()
});

// The account: signing in with Google, and progress kept with it (see cloud/).
if (CLOUD_CONFIGURED) setUpAccount();

function setUpAccount() {
  const panel = new AccountPanel(document);
  const backend = createFirebaseBackend();
  account = new Account(backend);
  cloudSync = new CloudSync({
    account,
    backend,
    getLocal: () => ({ progress: controller.progress(), daily: dailyBoard.results() }),
    apply: ({ progress, daily }) => {
      dailyBoard.mergeResults(daily);
      controller.applyProgress(progress);
    }
  });

  let message = null;
  const render = () => panel.render(account.state, cloudSync.status, message);
  account.onChange(() => {
    // A username is the next thing a new player has to do.
    if (account.state.status === 'needsName') panel.focusName();
    // The username is the name on the daily leaderboard; what waited for one is shared now.
    if (account.state.status === 'ready' && account.state.username) {
      dailyBoard.setName(account.state.username, new Date());
    }
    render();
  });
  cloudSync.onStatus(render);
  panel.bindActions({
    onSignIn: () => {
      message = null;
      account.signIn();
    },
    onSignOut: () => account.signOut(),
    onDelete: async () => {
      if (!confirm(texts.accountDeleteConfirm)) return;
      await account.deleteAccount();
    },
    onSaveName: async (name) => {
      const result = await account.claimUsername(name);
      message =
        result === 'ok'
          ? null
          : {
              invalid: texts.usernameInvalid,
              taken: texts.usernameTaken,
              failed: texts.usernameFailed
            }[result];
      render();
    },
    onRetry: () => {
      if (cloudSync.status === 'failed') cloudSync.syncNow();
    }
  });
  panel.enable();
  render();
  // An earlier session is picked up once the board has been drawn.
  setTimeout(() => account.restore().catch(() => {}), 1500);
}

// Sounds, vibration and the scene's moments that go with them.
scene.onCue((cue) => feedback.cue(cue));
// Browsers start audio only from a tap; catch every tap before the game handles it.
document.addEventListener('pointerdown', () => feedback.unlock(), { capture: true });

// iOS Safari zooms on a double tap and a pinch whatever the page asks; the game is an app.
let lastTouchEnd = 0;
document.addEventListener(
  'touchend',
  (event) => {
    const now = Date.now();
    if (now - lastTouchEnd < 350) event.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false }
);
document.addEventListener('gesturestart', (event) => event.preventDefault());

// Settings: the theme, sounds and vibration, and installing the game as an app.
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
    const languageChanged = change.language !== undefined && change.language !== settings.language;
    settings = { ...settings, ...change };
    saveSettings(settings);
    // Every text is drawn in the language it was set with, so a new one starts the page afresh.
    if (languageChanged) {
      location.reload();
      return;
    }
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
announceNews();

/** Tells the player once about what is new since they last played. */
function announceNews() {
  const key = 'suloop.news';
  const current = 'daily-rules';
  try {
    if (globalThis.localStorage?.getItem(key) === current) return;
    globalThis.localStorage?.setItem(key, current);
  } catch {
    // Without storage the note would come every time; leave it out.
    return;
  }
  setTimeout(() => hud.showToast(texts.newsDailyRules, { long: true }), 800);
}

/** Takes a puzzle someone shared, as in "…/suloop/#bulmaca=…"; it works for links opened here or pasted in. */
function openLink() {
  if (!/#bulmaca=/.test(location.hash)) return;

  const sharedPuzzle = decodePuzzle(location.hash);
  // Drop the code from the address, so a reload or a bookmark does not bring it back.
  history.replaceState(null, '', location.pathname + location.search);
  if (sharedPuzzle) controller.playCustom(sharedPuzzle);
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
