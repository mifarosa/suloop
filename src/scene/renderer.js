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
  for (const tube of inDrawOrder(tubes)) {
    if (!drawFromSprite(ctx, tube, view, look, isOil)) drawTube(ctx, tube, view, look, isOil);
  }
  for (const stream of streams) if (stream.visible) drawStream(ctx, stream, view, palette);
}

/**
 * What the layered drawing remembers between frames (see drawSceneLayers).
 * @returns {{ board: string | null, stamped: Map<object, string>, moving: object[] | null }}
 */
export function createLayers() {
  return { board: null, stamped: new Map(), moving: null };
}

/**
 * Draws the board on two canvases that lie on top of each other. Tubes standing still are
 * stamped on `still`, and only when one of them changes; tubes that move, and the liquid
 * falling between them, are drawn on `moving`, where only the area they cover is wiped and
 * painted again. A phone then repaints a small part of the screen in a frame instead of all
 * of it, which is what keeps the pouring smooth at full sharpness.
 *
 * @param {CanvasRenderingContext2D} still
 * @param {CanvasRenderingContext2D} moving
 * @param {ReturnType<typeof createLayers>} layers
 * @param {Parameters<typeof drawScene>[1]} scene same as for drawScene
 */
export function drawSceneLayers(
  still,
  moving,
  layers,
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
  const resting = tubes.filter(isAtRest);
  const restingSet = new Set(resting);
  const flying = tubes.filter((tube) => !restingSet.has(tube));

  // Anything that changes every tube at once starts the still layer afresh.
  const board = [width, height, view.scale, view.originX, view.originY, still.canvas.width]
    .concat(glassColor, glassGlow, symbols, palette.join(''))
    .concat(tubes.map((tube) => `${tube.x},${tube.y},${tube.size}`))
    .join('|');
  if (layers.board !== board) {
    still.clearRect(0, 0, width, height);
    layers.board = board;
    layers.stamped.clear();
  }
  updateStillLayer(still, layers, resting, tubes, view, look, isOil);

  // The wiped area covers where the moving things were and where they are now.
  const area = unionOf([...(layers.moving ?? []), ...flying.map((tube) => reachOf(tube, view))]);
  layers.moving = [
    ...flying.map((tube) => reachOf(tube, view)),
    ...[...streams].filter((stream) => stream.visible).map((stream) => streamBox(stream, view))
  ];
  const wiped = unionOf([...(area ? [area] : []), ...layers.moving]);
  if (wiped) {
    moving.clearRect(wiped.x, wiped.y, wiped.width, wiped.height);
    layers.moving = [wiped];
  }
  for (const tube of inDrawOrder(flying)) {
    if (!drawFromSprite(moving, tube, view, look, isOil)) drawTube(moving, tube, view, look, isOil);
  }
  for (const stream of streams) if (stream.visible) drawStream(moving, stream, view, palette);
}

/**
 * Brings the still layer up to date: wipes the places of tubes that began to move or changed
 * and stamps the resting tubes there again.
 */
function updateStillLayer(ctx, layers, resting, tubes, view, look, isOil) {
  const pixelsPerUnit = Math.round(ctx.getTransform().a * view.scale * 4) / 4;
  const changed = [];
  for (const tube of tubes) {
    const key = resting.includes(tube) ? spriteKey(tube, look, isOil, pixelsPerUnit) : null;
    const before = layers.stamped.get(tube) ?? null;
    if (key === before) continue;
    changed.push(spriteBox(tube, view, 0, tube.height));
    if (key === null) layers.stamped.delete(tube);
    else layers.stamped.set(tube, key);
  }
  if (changed.length === 0) return;

  ctx.save();
  ctx.beginPath();
  for (const box of changed) ctx.rect(box.x, box.y, box.width, box.height);
  ctx.clip();
  for (const box of changed) ctx.clearRect(box.x, box.y, box.width, box.height);
  for (const tube of resting) {
    const box = spriteBox(tube, view, 0, tube.height);
    if (!changed.some((other) => overlaps(box, other))) continue;
    const sprite = spriteOf(ctx, tube, view, look, isOil);
    ctx.drawImage(sprite, box.x, box.y, box.width, box.height);
  }
  ctx.restore();
}

/** A tube that stands in its place and looks the same in every frame. */
function isAtRest(tube) {
  return (
    isSettled(tube) && Math.abs(tube.body.x) < 1e-6 && Math.abs(tube.body.y - tube.height) < 1e-6
  );
}

/** The box around a moving tube as it is tilted now, with room for its cap, badge and glow. */
function reachOf(tube, view) {
  const { scale, originX, originY } = view;
  const { side, top, bottom } = SPRITE_MARGIN;
  const pivotX = originX + (tube.x + tube.body.x) * scale;
  const pivotY = originY - (tube.y + tube.body.y) * scale;
  const cos = Math.cos(-tube.body.tilt);
  const sin = Math.sin(-tube.body.tilt);
  const xs = [];
  const ys = [];
  for (const across of [-(TUBE_RADIUS + side), TUBE_RADIUS + side]) {
    for (const along of [-top, tube.height + bottom]) {
      xs.push(pivotX + (across * cos - along * sin) * scale);
      ys.push(pivotY + (across * sin + along * cos) * scale);
    }
  }
  const left = Math.min(...xs);
  const upper = Math.min(...ys);
  return {
    x: left,
    y: upper,
    width: Math.max(...xs) - left,
    height: Math.max(...ys) - upper
  };
}

function streamBox(stream, view) {
  const half = (STREAM_WIDTH + 0.1) * view.scale;
  return {
    x: view.originX + stream.x * view.scale - half,
    y: view.originY - stream.top * view.scale - half,
    width: half * 2,
    height: (stream.top - stream.bottom) * view.scale + half * 2
  };
}

function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** The smallest box that holds all the given boxes, rounded outward; null for none. */
function unionOf(boxes) {
  if (boxes.length === 0) return null;
  const left = Math.floor(Math.min(...boxes.map((box) => box.x)));
  const top = Math.floor(Math.min(...boxes.map((box) => box.y)));
  const right = Math.ceil(Math.max(...boxes.map((box) => box.x + box.width)));
  const bottom = Math.ceil(Math.max(...boxes.map((box) => box.y + box.height)));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

// A tube that only moves as a whole (lifted, shaken, hopping) looks the same in every frame, so
// it is drawn once to a small canvas of its own and that picture is stamped on the board, which
// is a lot cheaper for a phone than redrawing its liquid, glass and caps every frame. Room
// around the tube, in world units, for what sticks out of it: caps, badges, glows, funnels.
const SPRITE_MARGIN = { side: 0.4, top: 0.8, bottom: 0.25 };

/**
 * Draws a tube from its picture, making the picture first or when the tube has changed.
 * @returns {boolean} false when the tube cannot be drawn that way (it is tilted, glowing or in
 *   the middle of an animation of its own) or there is nowhere to keep a picture
 */
function drawFromSprite(ctx, tube, view, look, isOil) {
  if (!canUseSprites(ctx) || !isSettled(tube)) return false;

  const sprite = spriteOf(ctx, tube, view, look, isOil);
  const box = spriteBox(tube, view, tube.body.x, tube.body.y);
  ctx.drawImage(sprite, box.x, box.y, box.width, box.height);
  return true;
}

function canUseSprites(ctx) {
  return typeof document !== 'undefined' && Boolean(ctx.getTransform);
}

/** The picture of a settled tube, made again when anything it shows has changed. */
function spriteOf(ctx, tube, view, look, isOil) {
  const { side, top, bottom } = SPRITE_MARGIN;
  const pixelsPerUnit = Math.round(ctx.getTransform().a * view.scale * 4) / 4;
  const key = spriteKey(tube, look, isOil, pixelsPerUnit);
  if (tube.sprite?.key !== key) {
    const canvas = tube.sprite?.canvas ?? document.createElement('canvas');
    canvas.width = Math.ceil((TUBE_RADIUS + side) * 2 * pixelsPerUnit);
    canvas.height = Math.ceil((top + tube.height + bottom) * pixelsPerUnit);
    // The tube as it would stand at rest, with its mouth `top` units from the top edge.
    const resting = Object.create(tube);
    Object.assign(resting, { x: 0, y: 0, body: { x: 0, y: tube.height, tilt: 0 } });
    const spriteView = {
      scale: pixelsPerUnit,
      originX: canvas.width / 2,
      originY: (top + tube.height) * pixelsPerUnit
    };
    drawTube(canvas.getContext('2d'), resting, spriteView, look, isOil);
    tube.sprite = { key, canvas };
  }
  return tube.sprite.canvas;
}

/** Where the picture of a tube goes on the board, in CSS pixels. */
function spriteBox(tube, view, bodyX, bodyY) {
  const { scale, originX, originY } = view;
  const { side, top, bottom } = SPRITE_MARGIN;
  return {
    x: originX + (tube.x + bodyX - TUBE_RADIUS - side) * scale,
    y: originY - (tube.y + bodyY + top) * scale,
    width: (TUBE_RADIUS + side) * 2 * scale,
    height: (top + tube.height + bottom) * scale
  };
}

/** Whether a tube looks the same in every frame while it moves as a whole. */
function isSettled(tube) {
  const { body, glow, ice, cap } = tube;
  if (Math.abs(body.tilt) >= UPRIGHT || glow !== 0) return false;
  if ((ice !== 0 && ice !== 1) || (cap !== 0 && cap !== 1)) return false;
  // Liquid still draining or filling, or sinking under oil.
  return tube.segments.every(
    (segment, index) =>
      segment.fill === 1 && segment.slot === index && segment.color === tube.colors[index]
  );
}

/** Everything that decides what a tube's picture looks like. */
function spriteKey(tube, look, isOil, pixelsPerUnit) {
  return [
    pixelsPerUnit,
    look.glassColor,
    look.glassGlow,
    look.symbols ? 1 : 0,
    look.palette.join(''),
    tube.size,
    tube.oneWay ? 1 : 0,
    tube.lockKey,
    tube.ice,
    tube.cap,
    tube.fills,
    tube.maxFills,
    tube.colors.map((color) => `${color}${isOil(color) ? 'o' : ''}`).join(',')
  ].join('|');
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

  if (glow > 0) drawHalo(ctx, tube, `rgba(${GLOW_RGB}, 1)`, glow, GLASS_LINE_WIDTH * 3, 0.1);
  // Neon glass: a soft halo of light around the outline.
  if (glassGlow) drawHalo(ctx, tube, glassGlow, 1, GLASS_LINE_WIDTH, 0.07);

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

/**
 * A glow around a tube's outline: a few strokes, each wider and fainter than the last, that
 * fade out like a blur would. A real blur (shadowBlur) costs a phone far more for every
 * frame of every tube than these few lines do.
 * @param {number} strength 0 to 1
 * @param {number} width of the core line
 * @param {number} spread how much wider each outer stroke is, in world units
 */
function drawHalo(ctx, tube, color, strength, width, spread) {
  ctx.save();
  ctx.strokeStyle = color;
  for (let i = 3; i >= 0; i--) {
    ctx.globalAlpha = strength * (i === 0 ? 0.9 : 0.16 / i);
    ctx.lineWidth = width + spread * i;
    tubeOutline(ctx, TUBE_RADIUS, 0, tube.height);
    ctx.stroke();
  }
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
