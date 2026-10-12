import { HIDDEN } from '../game/rules.js';
import { tubeHeight } from './dimensions.js';
import { drawScene } from './renderer.js';
import { TubeView } from './tubeView.js';

// Room above the tallest tube for a badge or a cap, and below it for the rounded bottom.
const HEADROOM = 0.75;
const FOOTROOM = 0.15;
const MAX_PIXEL_RATIO = 2;
/** The sample tubes all fit the height of a tall tube, so they share one scale. */
const WORLD_HEIGHT = tubeHeight(5) + HEADROOM + FOOTROOM;

/** A sample tube for each rule that has one, drawn just like on the board. */
const SAMPLES = {
  basics: () => sample(4, [1, 1, 1, 1], { capped: true }),
  oneWayTube: () => sample(4, [2, 2], { kind: { oneWay: true } }),
  tallTubes: () => sample(5, [0, 3, 1, 2, 4]),
  hiddenColors: () => sample(4, [HIDDEN, HIDDEN, HIDDEN, 5]),
  crackedTube: () => sample(4, [7], { kind: { fills: 3 }, fills: 2 }),
  lockedTube: () => sample(4, [1, 4, 2, 0], { kind: { lockKey: 3 } }),
  halfTube: () => sample(2, [6, 6]),
  oil: () => sample(4, [1, 1, 6, 6], { oil: [6] })
};

/** Whether `rule` has a sample tube to draw. */
export function hasRuleIcon(rule) {
  return rule in SAMPLES;
}

/**
 * Draws the sample tube of a rule on a small canvas, sized by CSS.
 * @param {HTMLCanvasElement} canvas
 * @param {string} rule
 * @param {import('./tubeScene.js').Look} look
 */
export function drawRuleIcon(canvas, rule, look) {
  const { tube, oil } = SAMPLES[rule]();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;

  const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const scale = height / WORLD_HEIGHT;
  drawScene(ctx, {
    width,
    height,
    tubes: [tube],
    streams: [],
    view: { scale, originX: width / 2, originY: height - FOOTROOM * scale },
    ...look,
    isOil: (color) => oil.includes(color)
  });
}

function sample(
  size,
  colors,
  { kind = {}, fills = kind.fills ?? null, capped = false, oil = [] } = {}
) {
  const tube = new TubeView(0, size, kind);
  tube.showColors(colors);
  tube.fills = fills;
  tube.capped = capped;
  tube.cap = capped ? 1 : 0;
  return { tube, oil };
}
