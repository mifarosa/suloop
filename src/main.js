import './styles.css';
import { GameController } from './app/controller.js';
import { createFewestMovesFinder } from './app/fewestMoves.js';
import { Hud } from './app/hud.js';
import { LevelMenu } from './app/levelMenu.js';
import { loadProgress, saveProgress } from './app/progress.js';
import { codeInLink } from './app/progressCode.js';
import { RulesDialog } from './app/rulesDialog.js';
import { watchGlassColor } from './app/theme.js';
import { TransferDialog } from './app/transferDialog.js';
import { Confetti } from './scene/confetti.js';
import { TubeScene } from './scene/tubeScene.js';

const scene = new TubeScene(document.querySelector('#scene'), {
  getTopInset: () => document.querySelector('.hud').getBoundingClientRect().bottom,
  getBottomInset: () =>
    innerHeight - document.querySelector('.toolbar').getBoundingClientRect().top,
  confetti: new Confetti(document.querySelector('#confetti'))
});
let glassColor = '';
const hud = new Hud(document);
const menu = new LevelMenu(document);
const transfer = new TransferDialog(document);
const rules = new RulesDialog(document, { getGlassColor: () => glassColor });
const controller = new GameController({
  scene,
  hud,
  menu,
  transfer,
  rules,
  findFewestMoves: createFewestMovesFinder(),
  progress: loadProgress(),
  saveProgress
});

scene.onTubeTap((index) => controller.tapTube(index));
hud.bindActions({
  onUndo: () => controller.undo(),
  onHint: () => controller.showHint(),
  onRestart: () => controller.restart(),
  onInfo: () => controller.showInfo(),
  onShowLevels: () => controller.showLevels(),
  onContinue: () => controller.continueAfterWin(),
  onReplay: () => controller.replay(),
  onContinueToLevels: () => controller.continueToLevels()
});
menu.bindActions({
  onPickLevel: (level) => controller.playLevel(level),
  onPickDaily: () => controller.playDaily(),
  onTransfer: () => controller.showTransfer(),
  onClose: () => controller.closeLevels()
});
transfer.bindActions({
  onImport: (code) => controller.importProgress(code),
  onClose: () => controller.closeTransfer()
});
rules.bindActions({ onClose: () => controller.closeRules() });
watchGlassColor((color) => {
  glassColor = color;
  scene.setGlassColor(color);
});
controller.start();

/** Takes the progress from a link like "…/suloop/#ilerleme=2FQ7M", opened here or pasted in. */
function importProgressFromLink() {
  const code = codeInLink(location.href);
  if (code === null) return;

  // Drop the code from the address, so a reload or a bookmark does not bring it back.
  history.replaceState(null, '', location.pathname + location.search);
  controller.importProgress(code, { fromLink: true });
}
importProgressFromLink();
window.addEventListener('hashchange', importProgressFromLink);
