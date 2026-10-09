import {
  LIQUID_FLOOR,
  LIQUID_RADIUS,
  SEGMENT_HEIGHT,
  TUBE_HEIGHT,
  TUBE_RADIUS
} from './dimensions.js';
import { LIQUID_COLORS } from './palette.js';

const GLASS_FILL_OPACITY = 0.07;
const GLASS_LINE_OPACITY = 0.5;
const GLASS_LINE_WIDTH = 0.045;
const RIM_OVERHANG = 0.05;
const STREAM_HALF_WIDTH = 0.06;
const GLOW_RGB = '255, 214, 120';
// Segments overlap a hair so no background line shows between two colors.
const SEAM = 0.01;

/**
 * Draws the whole board. Everything is described in world units (see dimensions.js);
 * `view` maps them to pixels: x grows to the right of originX, y grows up from originY.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} scene
 * @param {number} scene.width view size in CSS pixels
 * @param {number} scene.height
 * @param {import('./tubeView.js').TubeView[]} scene.tubes
 * @param {{ visible: boolean, color: number, x: number, top: number, bottom: number }} scene.stream
 * @param {{ scale: number, originX: number, originY: number }} scene.view
 * @param {string} scene.glassColor any CSS color
 */
export function drawScene(ctx, { width, height, tubes, stream, view, glassColor }) {
  ctx.clearRect(0, 0, width, height);
  for (const tube of inDrawOrder(tubes)) drawTube(ctx, tube, view, glassColor);
  if (stream.visible) drawStream(ctx, stream, view);
}

/** Tubes that moved away from rest are drawn last, so a pouring tube passes in front. */
function inDrawOrder(tubes) {
  const displacement = ({ body }) =>
    Math.abs(body.x) + Math.abs(body.y - TUBE_HEIGHT) + Math.abs(body.tilt);
  return tubes.slice().sort((a, b) => displacement(a) - displacement(b));
}

function drawTube(ctx, tube, view, glassColor) {
  const { scale, originX, originY } = view;
  ctx.save();
  // Move to the mouth and tilt around it, then down to the base. From here on one unit is
  // one world unit and y points down, so heights above the base are negative.
  ctx.translate(originX + (tube.x + tube.body.x) * scale, originY - (tube.y + tube.body.y) * scale);
  ctx.rotate(-tube.body.tilt);
  ctx.translate(0, TUBE_HEIGHT * scale);
  ctx.scale(scale, scale);

  drawLiquid(ctx, tube);
  drawGlass(ctx, tube.glow, glassColor);
  ctx.restore();
}

function drawLiquid(ctx, tube) {
  ctx.save();
  tubeOutline(ctx, LIQUID_RADIUS, LIQUID_FLOOR);
  ctx.closePath();
  ctx.clip();

  let surface = 0;
  for (const { color, slot, fill } of tube.segments) {
    if (fill <= 0) continue;
    const bottom = LIQUID_FLOOR + slot * SEGMENT_HEIGHT;
    const top = bottom + SEGMENT_HEIGHT * fill;
    surface = Math.max(surface, top);
    ctx.fillStyle = LIQUID_COLORS[color];
    // The lowest segment reaches into the rounded bottom; the clip shapes it.
    const drawFrom = slot === 0 ? 0 : bottom - SEAM;
    ctx.fillRect(-LIQUID_RADIUS, -top, LIQUID_RADIUS * 2, top - drawFrom);
  }

  // A light stripe on the left and a shade on the right make the liquid look round.
  if (surface > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(-LIQUID_RADIUS * 0.72, -surface, LIQUID_RADIUS * 0.22, surface);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
    ctx.fillRect(LIQUID_RADIUS * 0.5, -surface, LIQUID_RADIUS * 0.5, surface);
  }
  ctx.restore();
}

function drawGlass(ctx, glow, glassColor) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (glow > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(${GLOW_RGB}, ${glow})`;
    ctx.shadowBlur = 24 * glow;
    ctx.strokeStyle = `rgba(${GLOW_RGB}, ${glow})`;
    ctx.lineWidth = GLASS_LINE_WIDTH * 3;
    tubeOutline(ctx, TUBE_RADIUS, 0);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = glassColor;
  ctx.strokeStyle = glassColor;
  ctx.globalAlpha = GLASS_FILL_OPACITY + glow * 0.1;
  tubeOutline(ctx, TUBE_RADIUS, 0);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = GLASS_LINE_OPACITY;
  ctx.lineWidth = GLASS_LINE_WIDTH;
  tubeOutline(ctx, TUBE_RADIUS, 0);
  ctx.stroke();

  ctx.lineWidth = GLASS_LINE_WIDTH * 1.6;
  ctx.beginPath();
  ctx.moveTo(-TUBE_RADIUS - RIM_OVERHANG, -TUBE_HEIGHT);
  ctx.lineTo(TUBE_RADIUS + RIM_OVERHANG, -TUBE_HEIGHT);
  ctx.stroke();
  ctx.restore();
}

/** An open tube with a rounded bottom, `floor` units above the base. */
function tubeOutline(ctx, radius, floor) {
  const bendY = -(floor + radius);
  ctx.beginPath();
  ctx.moveTo(-radius, -TUBE_HEIGHT);
  ctx.lineTo(-radius, bendY);
  ctx.arc(0, bendY, radius, Math.PI, 0, true);
  ctx.lineTo(radius, -TUBE_HEIGHT);
}

function drawStream(ctx, stream, view) {
  const { scale, originX, originY } = view;
  ctx.fillStyle = LIQUID_COLORS[stream.color];
  ctx.fillRect(
    originX + (stream.x - STREAM_HALF_WIDTH) * scale,
    originY - stream.top * scale,
    STREAM_HALF_WIDTH * 2 * scale,
    (stream.top - stream.bottom) * scale
  );
}
