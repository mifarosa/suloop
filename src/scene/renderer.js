import { HIDDEN } from '../game/rules.js';
import { LIQUID_FLOOR, LIQUID_RADIUS, SEGMENT_HEIGHT, TUBE_RADIUS } from './dimensions.js';
import { tiltedLayers } from './liquid.js';
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
 */
export function drawScene(
  ctx,
  { width, height, tubes, streams, view, glassColor, isOil = () => false }
) {
  ctx.clearRect(0, 0, width, height);
  for (const tube of inDrawOrder(tubes)) drawTube(ctx, tube, view, glassColor, isOil);
  for (const stream of streams) if (stream.visible) drawStream(ctx, stream, view);
}

/** Tubes that moved away from rest are drawn last, so a pouring tube passes in front. */
function inDrawOrder(tubes) {
  const displacement = ({ body, height }) =>
    Math.abs(body.x) + Math.abs(body.y - height) + Math.abs(body.tilt);
  return tubes.slice().sort((a, b) => displacement(a) - displacement(b));
}

function drawTube(ctx, tube, view, glassColor, isOil) {
  const { scale, originX, originY } = view;
  ctx.save();
  // Move to the mouth and tilt around it, then down to the base. From here on one unit is
  // one world unit and y points down, so heights above the base are negative.
  ctx.translate(originX + (tube.x + tube.body.x) * scale, originY - (tube.y + tube.body.y) * scale);
  ctx.rotate(-tube.body.tilt);
  ctx.translate(0, tube.height * scale);
  ctx.scale(scale, scale);

  if (Math.abs(tube.body.tilt) < UPRIGHT) drawLiquid(ctx, tube, scale, isOil);
  else drawTiltedLiquid(ctx, tube);
  drawGlass(ctx, tube, glassColor);
  if (tube.ice > 0) drawIce(ctx, tube);
  drawBadge(ctx, tube, glassColor);
  ctx.restore();
}

/** Liquid in an upright tube: level bands, one per segment. */
function drawLiquid(ctx, tube, scale, isOil) {
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
    ctx.fillStyle = colorOf(color);
    // The lowest segment reaches into the rounded bottom; the clip shapes it.
    const drawFrom = slot === 0 ? 0 : bottom - SEAM;
    ctx.fillRect(-LIQUID_RADIUS, -top, LIQUID_RADIUS * 2, top - drawFrom);
    if (color === HIDDEN && fill === 1) drawHiddenMark(ctx, (bottom + top) / 2, scale);
    if (isOil(color)) drawOilShine(ctx, bottom, top);
  }

  if (surface > 0) drawRoundness(ctx, surface);
  ctx.restore();
}

/**
 * Liquid in a tilted tube: every layer keeps a level surface, so the liquid stays flat while
 * the glass turns around it (see liquid.js).
 */
function drawTiltedLiquid(ctx, tube) {
  const layers = tube.layers;
  if (layers.length === 0) return;

  ctx.save();
  const shapes = tiltedLayers(tube.height, layers, tube.body.tilt);
  for (const { color, polygon } of shapes) {
    ctx.fillStyle = colorOf(color);
    ctx.beginPath();
    polygon.forEach(({ x, y }, i) => (i === 0 ? ctx.moveTo(x, -y) : ctx.lineTo(x, -y)));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function colorOf(color) {
  return color === HIDDEN ? HIDDEN_COLOR : LIQUID_COLORS[color];
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

function drawGlass(ctx, tube, glassColor) {
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
function drawBadge(ctx, tube, glassColor) {
  const y = -tube.height - BADGE_HEIGHT;
  ctx.save();
  if (tube.lockKey !== null && tube.ice > 0) {
    ctx.globalAlpha = tube.ice;
    ctx.fillStyle = LIQUID_COLORS[tube.lockKey];
    ctx.beginPath();
    ctx.arc(0, y, 0.2, 0, Math.PI * 2);
    ctx.fill();
    drawPadlock(ctx, y);
  } else if (tube.fills !== null) {
    ctx.strokeStyle = glassColor;
    ctx.fillStyle = glassColor;
    ctx.lineWidth = GLASS_LINE_WIDTH;
    ctx.globalAlpha = 0.8;
    const count = tube.maxFills;
    for (let i = 0; i < count; i++) {
      ctx.beginPath();
      ctx.arc((i - (count - 1) / 2) * 0.17, y, 0.055, 0, Math.PI * 2);
      if (i < tube.fills) ctx.fill();
      else ctx.stroke();
    }
  } else if (tube.oneWay) {
    ctx.fillStyle = glassColor;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(-0.13, y - 0.08);
    ctx.lineTo(0.13, y - 0.08);
    ctx.lineTo(0, y + 0.08);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
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
function drawStream(ctx, stream, view) {
  if (stream.top - stream.bottom <= 0) return;

  const { scale, originX, originY } = view;
  const x = originX + stream.x * scale;
  ctx.save();
  ctx.strokeStyle = LIQUID_COLORS[stream.color];
  ctx.lineWidth = STREAM_WIDTH * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, originY - stream.top * scale);
  ctx.lineTo(x, originY - stream.bottom * scale);
  ctx.stroke();
  ctx.restore();
}
