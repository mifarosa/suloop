import { HIDDEN } from '../game/rules.js';
import { LIQUID_FLOOR, LIQUID_RADIUS, SEGMENT_HEIGHT, TUBE_RADIUS } from './dimensions.js';
import { tiltedLayers } from './liquid.js';
import { drawSymbol } from './symbols.js';
import { HIDDEN_COLOR, HIDDEN_MARK_COLOR, ICE_COLOR, LIQUID_COLORS, LOCK_INK } from './palette.js';

const GLASS_FILL_OPACITY = 0.07;
const GLASS_LINE_OPACITY = 0.5;
const GLASS_LINE_WIDTH = 0.045;
const RIM_OVERHANG = 0.05;
const STREAM_WIDTH = 0.11;
const GLOW_RGB = '255, 214, 120';
// Segments overlap a hair so no background line shows between two colors.
const SEAM = 0.01;
const HIDDEN_MARK_SIZE = 0.36;
const MARK_FONT_FAMILY = "'Bricolage Grotesque', 'Segoe UI', system-ui, sans-serif";
/** Below this tilt a tube counts as upright and its liquid is drawn as plain bands. */
const UPRIGHT = 0.001;
/** Where the badges of special tubes (lock, fills left, one-way arrow) sit above the rim. */
const BADGE_HEIGHT = 0.26;
/** The cap of a complete tube: a plug inside the mouth under a lid wider than the rim. */
const CAP = {
  plugDepth: 0.12,
  lidHeight: 0.17,
  lidOverhang: 0.09,
  knobWidth: 0.24,
  knobHeight: 0.07
};
/** How far above the mouth a cap starts its drop, and ends up when it comes off. */
const CAP_DROP = 0.75;

/**
 * Draws the whole board. Everything is described in world units (see dimensions.js);
 * `view` maps them to pixels: x grows to the right of originX, y grows up from originY.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} scene
 * @param {number} scene.width view size in CSS pixels
 * @param {number} scene.height
 * @param {import('./tubeView.js').TubeView[]} scene.tubes
 * @param {Iterable<{ visible: boolean, color: number, x: number, top: number, bottom: number }>} scene.streams
 * @param {{ scale: number, originX: number, originY: number }} scene.view
 * @param {string} scene.glassColor any CSS color
 * @param {(color: number) => boolean} [scene.isOil]
 * @param {string[]} [scene.palette] the CSS color of each liquid color id
 * @param {string | null} [scene.glassGlow] a CSS color the glass glows in, e.g. for neon
 * @param {boolean} [scene.symbols] draw a symbol on every color, for players who cannot tell
 *   the colors apart
 */
export function drawScene(
  ctx,
  {
    width,
    height,
    tubes,
    streams,
    view,
    glassColor,
    isOil = () => false,
    palette = LIQUID_COLORS,
    glassGlow = null,
    symbols = false
  }
) {
  const look = { glassColor, palette, glassGlow, symbols };
  ctx.clearRect(0, 0, width, height);
  for (const tube of inDrawOrder(tubes)) drawTube(ctx, tube, view, look, isOil);
  for (const stream of streams) if (stream.visible) drawStream(ctx, stream, view, palette);
}

/** Tubes that moved away from rest are drawn last, so a pouring tube passes in front. */
function inDrawOrder(tubes) {
  const displacement = ({ body, height }) =>
    Math.abs(body.x) + Math.abs(body.y - height) + Math.abs(body.tilt);
  return tubes.slice().sort((a, b) => displacement(a) - displacement(b));
}

function drawTube(ctx, tube, view, look, isOil) {
  const { scale, originX, originY } = view;
  ctx.save();
  // Move to the mouth and tilt around it, then down to the base. From here on one unit is
  // one world unit and y points down, so heights above the base are negative.
  ctx.translate(originX + (tube.x + tube.body.x) * scale, originY - (tube.y + tube.body.y) * scale);
  ctx.rotate(-tube.body.tilt);
  ctx.translate(0, tube.height * scale);
  ctx.scale(scale, scale);

  if (Math.abs(tube.body.tilt) < UPRIGHT) drawLiquid(ctx, tube, scale, isOil, look);
  else drawTiltedLiquid(ctx, tube, look.palette);
  drawGlass(ctx, tube, look);
  if (tube.ice > 0) drawIce(ctx, tube);
  // A cap hides the badge: what made the tube special no longer matters once it is complete.
  if (tube.cap < 1) drawBadge(ctx, tube, look, 1 - Math.min(1, tube.cap));
  if (tube.cap > 0) drawCap(ctx, tube, look.palette);
  ctx.restore();
}

/** Liquid in an upright tube: level bands, one per segment. */
function drawLiquid(ctx, tube, scale, isOil, { palette, symbols }) {
  ctx.save();
  tubeOutline(ctx, LIQUID_RADIUS, LIQUID_FLOOR, tube.height);
  ctx.closePath();
  ctx.clip();

  let surface = 0;
  for (const { color, slot, fill } of tube.segments) {
    if (fill <= 0) continue;
    const bottom = LIQUID_FLOOR + slot * SEGMENT_HEIGHT;
    const top = bottom + SEGMENT_HEIGHT * fill;
    surface = Math.max(surface, top);
    ctx.fillStyle = colorOf(color, palette);
    // The lowest segment reaches into the rounded bottom; the clip shapes it.
    const drawFrom = slot === 0 ? 0 : bottom - SEAM;
    ctx.fillRect(-LIQUID_RADIUS, -top, LIQUID_RADIUS * 2, top - drawFrom);
    if (color === HIDDEN && fill === 1) drawHiddenMark(ctx, (bottom + top) / 2, scale);
    else if (symbols && color !== HIDDEN && fill === 1) {
      ctx.save();
      ctx.translate(0, -(bottom + top) / 2);
      drawSymbol(ctx, color, SEGMENT_HEIGHT * 0.5);
      ctx.restore();
    }
    if (isOil(color)) drawOilShine(ctx, bottom, top);
  }

  if (surface > 0) drawRoundness(ctx, surface);
  ctx.restore();
}

/**
 * Liquid in a tilted tube: every layer keeps a level surface, so the liquid stays flat while
 * the glass turns around it (see liquid.js).
 */
function drawTiltedLiquid(ctx, tube, palette) {
  const layers = tube.layers;
  if (layers.length === 0) return;

  ctx.save();
  const shapes = tiltedLayers(tube.height, layers, tube.body.tilt);
  for (const { color, polygon } of shapes) {
    ctx.fillStyle = colorOf(color, palette);
    ctx.beginPath();
    polygon.forEach(({ x, y }, i) => (i === 0 ? ctx.moveTo(x, -y) : ctx.lineTo(x, -y)));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function colorOf(color, palette) {
  return color === HIDDEN ? HIDDEN_COLOR : palette[color];
}

/** A light stripe on the left and a shade on the right make the liquid look round. */
function drawRoundness(ctx, surface) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.fillRect(-LIQUID_RADIUS * 0.72, -surface, LIQUID_RADIUS * 0.22, surface);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
  ctx.fillRect(LIQUID_RADIUS * 0.5, -surface, LIQUID_RADIUS * 0.5, surface);
}

/** Oil looks glossy: a bright line along its top and a few bubbles caught inside. */
function drawOilShine(ctx, bottom, top) {
  const height = top - bottom;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillRect(-LIQUID_RADIUS, -top, LIQUID_RADIUS * 2, Math.min(0.05, height));
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  for (const [x, y, radius] of [
    [-0.12, 0.3, 0.05],
    [0.1, 0.55, 0.035],
    [0.02, 0.75, 0.025]
  ]) {
    const cy = bottom + height * y;
    if (cy + radius > top) continue;
    ctx.beginPath();
    ctx.arc(x, -cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A question mark in the middle of a segment whose color is not known yet. */
function drawHiddenMark(ctx, centerY, scale) {
  ctx.save();
  ctx.translate(0, -centerY);
  // Back to pixels for the text: a font a fraction of a pixel tall renders poorly.
  ctx.scale(1 / scale, 1 / scale);
  ctx.font = `700 ${HIDDEN_MARK_SIZE * scale}px ${MARK_FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = HIDDEN_MARK_COLOR;
  ctx.fillText('?', 0, 0);
  ctx.restore();
}

function drawGlass(ctx, tube, { glassColor, glassGlow }) {
  const { glow, height } = tube;
  // A cracked tube that cannot take any more liquid looks spent.
  const spent = tube.fills === 0;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (glow > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(${GLOW_RGB}, ${glow})`;
    ctx.shadowBlur = 24 * glow;
    ctx.strokeStyle = `rgba(${GLOW_RGB}, ${glow})`;
    ctx.lineWidth = GLASS_LINE_WIDTH * 3;
    tubeOutline(ctx, TUBE_RADIUS, 0, height);
    ctx.stroke();
    ctx.restore();
  }

  if (glassGlow) {
    // Neon glass: a soft halo of light around the outline.
    ctx.save();
    ctx.shadowColor = glassGlow;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = glassGlow;
    ctx.lineWidth = GLASS_LINE_WIDTH;
    tubeOutline(ctx, TUBE_RADIUS, 0, height);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = glassColor;
  ctx.strokeStyle = glassColor;
  ctx.globalAlpha = GLASS_FILL_OPACITY + glow * 0.1;
  tubeOutline(ctx, TUBE_RADIUS, 0, height);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = spent ? GLASS_LINE_OPACITY * 0.5 : GLASS_LINE_OPACITY;
  ctx.lineWidth = GLASS_LINE_WIDTH;
  tubeOutline(ctx, TUBE_RADIUS, 0, height);
  ctx.stroke();

  ctx.lineWidth = GLASS_LINE_WIDTH * 1.6;
  ctx.beginPath();
  if (tube.oneWay) {
    // A one-way tube has a funnel for a mouth.
    const flare = 0.13;
    ctx.moveTo(-TUBE_RADIUS - flare, -height - flare);
    ctx.lineTo(-TUBE_RADIUS, -height);
    ctx.moveTo(TUBE_RADIUS + flare, -height - flare);
    ctx.lineTo(TUBE_RADIUS, -height);
  } else {
    ctx.moveTo(-TUBE_RADIUS - RIM_OVERHANG, -height);
    ctx.lineTo(TUBE_RADIUS + RIM_OVERHANG, -height);
  }
  ctx.stroke();

  if (tube.fills !== null) drawCracks(ctx, height, spent);
  ctx.restore();
}

/** Jagged cracks in the glass of a cracked tube; more of them once it is spent. */
function drawCracks(ctx, height, spent) {
  const r = TUBE_RADIUS;
  const cracks = [
    [
      [-r, 0.55],
      [-r + 0.13, 0.5],
      [-r + 0.06, 0.43],
      [-r + 0.19, 0.37]
    ],
    [
      [r, 0.3],
      [r - 0.11, 0.26],
      [r - 0.05, 0.2]
    ]
  ];
  if (spent) {
    cracks.push([
      [-r, 0.82],
      [-r + 0.17, 0.76],
      [-r + 0.1, 0.7],
      [r - 0.12, 0.64],
      [r, 0.6]
    ]);
  }
  ctx.lineWidth = GLASS_LINE_WIDTH * 0.8;
  ctx.globalAlpha = 0.85;
  for (const crack of cracks) {
    ctx.beginPath();
    crack.forEach(([x, y], i) =>
      i === 0 ? ctx.moveTo(x, -height * y) : ctx.lineTo(x, -height * y)
    );
    ctx.stroke();
  }
}

/** Frost over a locked tube, fading as the ice melts. */
function drawIce(ctx, tube) {
  ctx.save();
  ctx.globalAlpha = tube.ice;
  ctx.fillStyle = ICE_COLOR;
  tubeOutline(ctx, TUBE_RADIUS, 0, tube.height);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = GLASS_LINE_WIDTH;
  ctx.beginPath();
  for (const y of [0.25, 0.55]) {
    ctx.moveTo(-TUBE_RADIUS * 0.6, -tube.height * (y + 0.12));
    ctx.lineTo(TUBE_RADIUS * 0.4, -tube.height * y);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * The sign above a special tube: a padlock in the key color on a locked tube, the fills left
 * on a cracked tube, and an arrow pointing in on a one-way tube.
 */
function drawBadge(ctx, tube, { glassColor, palette }, opacity) {
  const y = -tube.height - BADGE_HEIGHT;
  ctx.save();
  ctx.globalAlpha = opacity;
  if (tube.lockKey !== null && tube.ice > 0) {
    ctx.globalAlpha = opacity * tube.ice;
    ctx.fillStyle = palette[tube.lockKey];
    ctx.beginPath();
    ctx.arc(0, y, 0.2, 0, Math.PI * 2);
    ctx.fill();
    drawPadlock(ctx, y);
  } else if (tube.fills !== null) {
    ctx.strokeStyle = glassColor;
    ctx.fillStyle = glassColor;
    ctx.lineWidth = GLASS_LINE_WIDTH;
    ctx.globalAlpha = opacity * 0.8;
    const count = tube.maxFills;
    for (let i = 0; i < count; i++) {
      ctx.beginPath();
      ctx.arc((i - (count - 1) / 2) * 0.17, y, 0.055, 0, Math.PI * 2);
      if (i < tube.fills) ctx.fill();
      else ctx.stroke();
    }
  } else if (tube.oneWay) {
    ctx.fillStyle = glassColor;
    ctx.globalAlpha = opacity * 0.7;
    ctx.beginPath();
    ctx.moveTo(-0.13, y - 0.08);
    ctx.lineTo(0.13, y - 0.08);
    ctx.lineTo(0, y + 0.08);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * The cap of a complete tube, in the color it holds. It drops in from above as `tube.cap`
 * goes from 0 to 1, a little past 1 while it presses in, and lifts away as it goes back.
 */
function drawCap(ctx, tube, palette) {
  const { plugDepth, lidHeight, lidOverhang, knobWidth, knobHeight } = CAP;
  const lift = (1 - tube.cap) * CAP_DROP;
  const mouth = -tube.height - lift;
  const lidHalf = TUBE_RADIUS + lidOverhang;
  const color = palette[tube.topColor] ?? HIDDEN_COLOR;

  ctx.save();
  ctx.globalAlpha = Math.min(1, tube.cap * 1.6);
  ctx.lineWidth = GLASS_LINE_WIDTH * 0.8;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';

  // The plug, in the mouth, darker since it sits in the shade of the lid.
  ctx.fillStyle = color;
  ctx.fillRect(-LIQUID_RADIUS, mouth, LIQUID_RADIUS * 2, plugDepth);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(-LIQUID_RADIUS, mouth, LIQUID_RADIUS * 2, plugDepth);

  ctx.fillStyle = color;
  roundedRect(
    ctx,
    -knobWidth / 2,
    mouth - lidHeight - knobHeight,
    knobWidth,
    knobHeight + 0.04,
    0.03
  );
  ctx.fill();
  ctx.stroke();
  roundedRect(ctx, -lidHalf, mouth - lidHeight, lidHalf * 2, lidHeight, 0.06);
  ctx.fill();
  ctx.stroke();

  // Light along the top and shade along the bottom make the lid look solid.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fillRect(-lidHalf + 0.07, mouth - lidHeight + 0.035, lidHalf * 2 - 0.14, 0.04);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.fillRect(-lidHalf + 0.03, mouth - 0.05, lidHalf * 2 - 0.06, 0.04);
  ctx.restore();
}

/** A rectangle with rounded corners; drawn by hand, as older browsers lack roundRect. */
function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawPadlock(ctx, centerY) {
  ctx.fillStyle = LOCK_INK;
  ctx.strokeStyle = LOCK_INK;
  ctx.lineWidth = 0.035;
  ctx.fillRect(-0.075, centerY - 0.02, 0.15, 0.11);
  ctx.beginPath();
  ctx.arc(0, centerY - 0.02, 0.05, Math.PI, 0);
  ctx.stroke();
}

/** An open tube of the given height with a rounded bottom, `floor` units above the base. */
function tubeOutline(ctx, radius, floor, height) {
  const bendY = -(floor + radius);
  ctx.beginPath();
  ctx.moveTo(-radius, -height);
  ctx.lineTo(-radius, bendY);
  ctx.arc(0, bendY, radius, Math.PI, 0, true);
  ctx.lineTo(radius, -height);
}

/** The falling liquid: a line with round ends, from the lip down to the surface below. */
function drawStream(ctx, stream, view, palette) {
  if (stream.top - stream.bottom <= 0) return;

  const { scale, originX, originY } = view;
  const x = originX + stream.x * scale;
  ctx.save();
  ctx.strokeStyle = palette[stream.color];
  ctx.lineWidth = STREAM_WIDTH * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, originY - stream.top * scale);
  ctx.lineTo(x, originY - stream.bottom * scale);
  ctx.stroke();
  ctx.restore();
}
