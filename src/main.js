import './styles.css';
import { GameController } from './app/controller.js';
import { Hud } from './app/hud.js';
import { loadProgress, saveProgress } from './app/progress.js';
import { watchGlassColor } from './app/theme.js';
import { TubeScene } from './scene/tubeScene.js';

const scene = new TubeScene(document.querySelector('#scene'), {
  getTopInset: () => document.querySelector('.hud').getBoundingClientRect().bottom
});
const hud = new Hud(document);
const controller = new GameController({ scene, hud, progress: loadProgress(), saveProgress });

scene.onTubeTap((index) => controller.tapTube(index));
hud.bindActions({
  onUndo: () => controller.undo(),
  onHint: () => controller.showHint(),
  onRestart: () => controller.restart(),
  onToggleMode: () => controller.toggleMode(),
  onContinue: () => controller.continueAfterWin()
});
watchGlassColor((color) => scene.setGlassColor(color));

controller.start();
