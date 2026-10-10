import './styles.css';
import { GameController } from './app/controller.js';
import { Hud } from './app/hud.js';
import { LevelMenu } from './app/levelMenu.js';
import { loadProgress, saveProgress } from './app/progress.js';
import { watchGlassColor } from './app/theme.js';
import { TubeScene } from './scene/tubeScene.js';

const scene = new TubeScene(document.querySelector('#scene'), {
  getTopInset: () => document.querySelector('.hud').getBoundingClientRect().bottom
});
const hud = new Hud(document);
const menu = new LevelMenu(document);
const controller = new GameController({
  scene,
  hud,
  menu,
  progress: loadProgress(),
  saveProgress
});

scene.onTubeTap((index) => controller.tapTube(index));
hud.bindActions({
  onUndo: () => controller.undo(),
  onHint: () => controller.showHint(),
  onRestart: () => controller.restart(),
  onShowLevels: () => controller.showLevels(),
  onContinue: () => controller.continueAfterWin(),
  onContinueToLevels: () => controller.continueToLevels()
});
menu.bindActions({
  onPickLevel: (level) => controller.playLevel(level),
  onPickDaily: () => controller.playDaily(),
  onClose: () => controller.closeLevels()
});
watchGlassColor((color) => scene.setGlassColor(color));

controller.start();
