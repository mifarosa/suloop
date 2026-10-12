import { CONFETTI_COLORS } from './palette.js';

// Distances and speeds are in screen heights (per second), so a burst looks the same on a
// phone and on a desktop; sideways speeds are in screen widths, so pieces cross the screen.
const PIECES_PER_SIDE = 70;
const GRAVITY = 1.3;
/** Air slows pieces down this much per second, which makes them flutter down slowly. */
const DRAG = 4.5;
const RISE = [0.6, 1.25];
const REACH = [0.1, 0.65];
const SWAY = 0.05;
const MAX_DELAY_S = 0.15;
const MAX_AGE_S = 5;
const FADE_S = 1;
const PIECE_SIZE_PX = { width: [6, 10], height: [10, 16] };
const MAX_PIXEL_RATIO = 2;

/**
 * @typedef {object} Piece
 * @property {number} x in CSS pixels
 * @property {number} y in CSS pixels, down from the top
 * @property {number} vx
 * @property {number} vy
 * @property {number} angle radians
 * @property {number} spin radians per second
 * @property {number} flip phase of the piece turning over, radians
 * @property {number} flipSpeed
 * @property {number} sway phase of the side to side drift, radians
 * @property {number} width
 * @property {number} height
 * @property {string} color
 * @property {number} age seconds; negative until the piece is launched
 */

/**
 * Confetti shot from both bottom corners of the screen. It has a canvas of its own over the
 * whole page, so it also falls over the win dialog; the canvas only shows during a burst.
 */
export class Confetti {
  #canvas;
  #context;
  #random;
  /** @type {Piece[]} */
  #pieces = [];
  #size = { width: 0, height: 0, ratio: 1 };
  #frame = null;
  #lastTime = null;

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ random?: () => number }} [options]
   */
  constructor(canvas, { random = Math.random } = {}) {
    this.#canvas = canvas;
    this.#context = canvas.getContext('2d');
    this.#random = random;
    canvas.hidden = true;
  }

  burst() {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    this.#resize();
    this.#pieces.push(...launchPieces(this.#random, this.#size));
    this.#canvas.hidden = false;
    if (this.#frame === null) {
      this.#lastTime = null;
      this.#frame = requestAnimationFrame((time) => this.#tick(time));
    }
  }

  #tick(time) {
    // A long gap (a hidden tab) must not throw the pieces across the screen.
    const dt = this.#lastTime === null ? 0 : Math.min(0.05, (time - this.#lastTime) / 1000);
    this.#lastTime = time;
    this.#pieces = advancePieces(this.#pieces, dt, this.#size);
    this.#draw();

    if (this.#pieces.length > 0) {
      this.#frame = requestAnimationFrame((next) => this.#tick(next));
    } else {
      this.#frame = null;
      this.#canvas.hidden = true;
    }
  }

  #resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (width === this.#size.width && height === this.#size.height && ratio === this.#size.ratio) {
      return;
    }
    this.#size = { width, height, ratio };
    this.#canvas.width = Math.round(width * ratio);
    this.#canvas.height = Math.round(height * ratio);
  }

  #draw() {
    const context = this.#context;
    const { width, height, ratio } = this.#size;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    for (const piece of this.#pieces) {
      if (piece.age < 0) continue;
      const cos = Math.cos(piece.angle);
      const sin = Math.sin(piece.angle);
      // Squashing the piece along its length makes it look like it turns over.
      const turn = Math.cos(piece.flip);
      context.globalAlpha = opacityAt(piece.age);
      context.fillStyle = piece.color;
      context.setTransform(
        ratio * cos,
        ratio * sin,
        -ratio * sin * turn,
        ratio * cos * turn,
        ratio * piece.x,
        ratio * piece.y
      );
      context.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
    }
    context.globalAlpha = 1;
  }
}

/**
 * The pieces of one burst, half from each bottom corner, aimed up and toward the middle.
 * @param {() => number} random
 * @param {{ width: number, height: number }} size of the screen, in CSS pixels
 * @returns {Piece[]}
 */
export function launchPieces(random, { width, height }) {
  const between = ([low, high]) => low + random() * (high - low);
  const pieces = [];
  for (const side of [1, -1]) {
    for (let i = 0; i < PIECES_PER_SIDE; i++) {
      pieces.push({
        x: side === 1 ? 0 : width,
        y: height,
        // With drag, a piece goes about its starting speed / DRAG before it stops.
        vx: side * between(REACH) * width * DRAG,
        vy: -between(RISE) * height * DRAG,
        angle: random() * Math.PI * 2,
        spin: (random() - 0.5) * 12,
        flip: random() * Math.PI * 2,
        flipSpeed: 4 + random() * 8,
        sway: random() * Math.PI * 2,
        width: between(PIECE_SIZE_PX.width),
        height: between(PIECE_SIZE_PX.height),
        color: CONFETTI_COLORS[Math.floor(random() * CONFETTI_COLORS.length)],
        age: -random() * MAX_DELAY_S
      });
    }
  }
  return pieces;
}

/**
 * Moves every piece on by `dt` seconds.
 * @param {Piece[]} pieces
 * @param {number} dt
 * @param {{ width: number, height: number }} size of the screen, in CSS pixels
 * @returns {Piece[]} the pieces still to show: not yet faded out or fallen off the screen
 */
export function advancePieces(pieces, dt, { height }) {
  const gravity = GRAVITY * height;
  const sway = SWAY * height;
  return pieces.filter((piece) => {
    piece.age += dt;
    if (piece.age <= 0) return true;

    piece.vx -= piece.vx * DRAG * dt;
    piece.vy += (gravity - piece.vy * DRAG) * dt;
    piece.x += (piece.vx + Math.sin(piece.age * 3 + piece.sway) * sway) * dt;
    piece.y += piece.vy * dt;
    piece.angle += piece.spin * dt;
    piece.flip += piece.flipSpeed * dt;
    return piece.age < MAX_AGE_S && piece.y < height + piece.height;
  });
}

/** Pieces fade out over their last second. */
function opacityAt(age) {
  return Math.min(1, Math.max(0, (MAX_AGE_S - age) / FADE_S));
}
