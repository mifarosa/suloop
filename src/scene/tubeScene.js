import { Animator } from './animator.js';
import { TUBE_CAPACITY } from '../game/rules.js';
import { LIFT_HEIGHT, TUBE_RADIUS } from './dimensions.js';
import { arrangeTubes, fitToView } from './layout.js';
import * as motions from './motions.js';
import { animatePour } from './pour.js';
import { drawScene } from './renderer.js';
import { TubeView } from './tubeView.js';

const DEFAULT_GLASS_COLOR = '#ffffff';
// Sharp on 2x screens; 3x would more than double the pixels to fill for no visible gain.
const MAX_PIXEL_RATIO = 2;
// Taps count a little around a tube and above it, where a lifted tube floats.
const TAP_HALF_WIDTH = TUBE_RADIUS * 1.5;
const TAP_MARGIN = 0.2;

/**
 * The board, drawn on a 2D canvas. It knows how to show and animate tubes, and reports
 * taps; it knows nothing about the rules of the game.
 */
export class TubeScene {
  #canvas;
  #context;
  #getTopInset;
  #animator = new Animator(() => this.#requestRender());
  /** @type {TubeView[]} */
  #tubes = [];
  #stream = { visible: false, color: 0, x: 0, top: 0, bottom: 0 };
  #glassColor = DEFAULT_GLASS_COLOR;
  #size = { width: 0, height: 0 };
  #view = { scale: 1, originX: 0, originY: 0 };
  #bounds = null;
  #pouring = false;
  #layoutPending = false;
  #frameRequested = false;
  #onTubeTap = () => {};

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ getTopInset?: () => number }} [options] pixels at the top covered by the HUD
   */
  constructor(canvas, { getTopInset = () => 0 } = {}) {
    this.#canvas = canvas;
    this.#context = canvas.getContext('2d');
    this.#getTopInset = getTopInset;

    canvas.addEventListener('pointerdown', (event) => this.#handlePointerDown(event));
    new ResizeObserver(() => this.#resize()).observe(canvas);
    this.#resize();
  }

  /** @param {(index: number) => void} listener called with the index of the tapped tube */
  onTubeTap(listener) {
    this.#onTubeTap = listener;
  }

  /**
   * Replaces every tube, e.g. for a new puzzle.
   * @param {number[][]} tubes colors bottom first; HIDDEN for a unit not seen yet
   * @param {{ capacity?: number }} [options] units each tube holds
   */
  showPuzzle(tubes, { capacity = TUBE_CAPACITY } = {}) {
    this.#animator.stopAll();
    this.#tubes = tubes.map((colors, index) => {
      const tube = new TubeView(index, capacity);
      tube.showColors(colors);
      return tube;
    });
    this.#layout();
    this.#requestRender();
  }

  /** Shows new contents at once, without animation, e.g. after an undo or a restart. */
  showContents(tubes) {
    this.#animator.stopAll();
    this.#tubes.forEach((tube, index) => {
      tube.showColors(tubes[index]);
      tube.resetPose();
      tube.setGlow(0);
    });
    this.#requestRender();
  }

  /** @param {string} color any CSS color */
  setGlassColor(color) {
    this.#glassColor = color || DEFAULT_GLASS_COLOR;
    this.#requestRender();
  }

  setLifted(index, lifted) {
    return motions.lift(this.#animator, this.#tubes[index], lifted);
  }

  shake(index) {
    return motions.shake(this.#animator, this.#tubes[index]);
  }

  hop(index) {
    return motions.hop(this.#animator, this.#tubes[index]);
  }

  /** Makes the given tubes glow, to point out a hinted move. */
  highlight(indices) {
    for (const tube of this.#tubes) tube.setGlow(0);
    return motions.pulse(
      this.#animator,
      indices.map((index) => this.#tubes[index])
    );
  }

  celebrate() {
    return motions.celebrate(this.#animator, this.#tubes);
  }

  /**
   * Animates a pour, then shows the board as it is after the move.
   * @param {number} from
   * @param {number} to
   * @param {number} amount units poured
   * @param {number[][]} tubesAfter the whole board after the pour
   */
  async pour(from, to, amount, tubesAfter) {
    this.#pouring = true;
    const source = this.#tubes[from];
    const target = this.#tubes[to];

    await animatePour({ animator: this.#animator, stream: this.#stream, source, target, amount });

    source.showColors(tubesAfter[from]);
    target.showColors(tubesAfter[to]);
    this.#pouring = false;
    if (this.#layoutPending) {
      this.#layoutPending = false;
      this.#layout();
    }
    this.#requestRender();
  }

  #layout() {
    if (this.#tubes.length === 0) return;

    const { width, height } = this.#size;
    const { positions, bounds } = arrangeTubes(
      this.#tubes.length,
      width / height,
      this.#tubes[0].height
    );
    this.#tubes.forEach((tube, index) => {
      tube.x = positions[index].x;
      tube.y = positions[index].y;
    });
    this.#bounds = bounds;
    this.#fitView();
  }

  #fitView() {
    if (!this.#bounds) return;

    const { width, height } = this.#size;
    this.#view = fitToView(this.#bounds, width, height, this.#getTopInset());
  }

  #resize() {
    const width = this.#canvas.clientWidth;
    const height = this.#canvas.clientHeight;
    if (!width || !height) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    this.#canvas.width = Math.round(width * pixelRatio);
    this.#canvas.height = Math.round(height * pixelRatio);
    this.#context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.#size = { width, height };

    // Moving tubes in the middle of a pour would break its path; rearrange them afterwards.
    if (this.#pouring) {
      this.#layoutPending = true;
      this.#fitView();
    } else {
      this.#layout();
    }
    this.#requestRender();
  }

  #handlePointerDown(event) {
    const rect = this.#canvas.getBoundingClientRect();
    const { scale, originX, originY } = this.#view;
    const x = (event.clientX - rect.left - originX) / scale;
    const y = (originY - (event.clientY - rect.top)) / scale;

    const tapped = this.#tubes.find((tube) => {
      const dx = Math.abs(x - tube.x);
      const dy = y - tube.y;
      return (
        dx <= TAP_HALF_WIDTH && dy >= -TAP_MARGIN && dy <= tube.height + LIFT_HEIGHT + TAP_MARGIN
      );
    });
    if (tapped) this.#onTubeTap(tapped.index);
  }

  /**
   * Draws a frame on the next display refresh. Frames keep coming only while something
   * animates, so a board that is just sitting there costs no battery.
   */
  #requestRender() {
    if (this.#frameRequested) return;
    this.#frameRequested = true;
    requestAnimationFrame(() => this.#renderFrame());
  }

  #renderFrame() {
    this.#frameRequested = false;
    this.#animator.tick();
    drawScene(this.#context, {
      ...this.#size,
      tubes: this.#tubes,
      stream: this.#stream,
      view: this.#view,
      glassColor: this.#glassColor
    });
    if (this.#animator.isRunning) this.#requestRender();
  }
}
