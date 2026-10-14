import { Animator } from './animator.js';
import { TUBE_CAPACITY } from '../game/rules.js';
import { LIFT_HEIGHT, TUBE_RADIUS } from './dimensions.js';
import { arrangeTubes, fitToView } from './layout.js';
import { confettiColors, LIQUID_COLORS } from './palette.js';
import * as motions from './motions.js';
import { animatePour } from './pour.js';
import { loadSavedRatio, QualityGovernor, saveRatio } from './quality.js';
import { createLayers, drawScene, drawSceneLayers } from './renderer.js';
import { TubeView } from './tubeView.js';

/**
 * How the scene is drawn: the color of the glass, the CSS color of each liquid color id, and
 * a color the glass glows in (null for none).
 * @typedef {{ glassColor: string, palette: string[], glassGlow: string | null, symbols?: boolean }} Look
 */
const DEFAULT_LOOK = Object.freeze({
  glassColor: '#ffffff',
  palette: LIQUID_COLORS,
  glassGlow: null,
  symbols: false
});
// Sharp on 2x screens; 3x would more than double the pixels to fill for no visible gain.
const MAX_PIXEL_RATIO = 2;
// Taps count a little around a tube and above it, where a lifted tube floats.
const TAP_HALF_WIDTH = TUBE_RADIUS * 1.5;
const TAP_MARGIN = 0.2;

/** A transparent canvas right over `canvas`, which keeps receiving the taps. */
function createOverlay(canvas) {
  const overlay = document.createElement('canvas');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.className = 'scene-moving';
  canvas.after(overlay);
  return overlay;
}

/**
 * The board, drawn on a 2D canvas. It knows how to show and animate tubes, and reports
 * taps; it knows nothing about the rules of the game.
 */
export class TubeScene {
  #canvas;
  #context;
  /** A canvas over the first one for what moves, so the board under it is not repainted. */
  #movingCanvas;
  #movingContext;
  #layers = createLayers();
  #getTopInset;
  #getBottomInset;
  #confetti;
  #animator = new Animator(() => this.#requestRender());
  /** @type {TubeView[]} */
  #tubes = [];
  /** Pours being animated, by the index of each tube they involve. */
  #pours = new Map();
  /** The falling liquid of every pour being animated. */
  #streams = new Set();
  #isOil = () => false;
  /** @type {Look} */
  #look = DEFAULT_LOOK;
  #size = { width: 0, height: 0 };
  #view = { scale: 1, originX: 0, originY: 0 };
  #bounds = null;
  #layoutPending = false;
  #frameRequested = false;
  #lastFrameAt = null;
  #quality = new QualityGovernor({
    ratio: Math.min(
      loadSavedRatio() ?? Infinity,
      Math.min(globalThis.devicePixelRatio || 1, MAX_PIXEL_RATIO)
    )
  });
  #onTubeTap = () => {};
  #onCue = () => {};

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} [options]
   * @param {() => number} [options.getTopInset] pixels at the top covered by the HUD
   * @param {() => number} [options.getBottomInset] pixels at the bottom covered by the toolbar
   * @param {{ burst: () => void }} [options.confetti] thrown when a puzzle is solved
   * @param {boolean} [options.layered] draw what moves on a second canvas laid over the
   *   first, which only works for a canvas that fills the page
   */
  constructor(
    canvas,
    { getTopInset = () => 0, getBottomInset = () => 0, confetti = null, layered = false } = {}
  ) {
    this.#canvas = canvas;
    this.#context = canvas.getContext('2d', { desynchronized: true });
    if (layered) {
      this.#movingCanvas = createOverlay(canvas);
      this.#movingContext = this.#movingCanvas.getContext('2d', { desynchronized: true });
    }
    this.#getTopInset = getTopInset;
    this.#getBottomInset = getBottomInset;
    this.#confetti = confetti;

    canvas.addEventListener('pointerdown', (event) => this.#handlePointerDown(event));
    new ResizeObserver(() => this.#resize()).observe(canvas);
    this.#resize();
  }

  /** @param {(index: number) => void} listener called with the index of the tapped tube */
  onTubeTap(listener) {
    this.#onTubeTap = listener;
  }

  /**
   * Listens for moments worth a sound: liquid starting to run (`flow`, with its duration in
   * ms and the units), a cap landing (`capOn`) or coming off (`capOff`), ice melting (`melt`).
   * @param {(cue: { type: string, duration?: number, amount?: number }) => void} listener
   */
  onCue(listener) {
    this.#onCue = listener;
  }

  /**
   * Replaces every tube, e.g. for a new puzzle.
   * @param {number[][]} tubes colors bottom first; HIDDEN for a unit not seen yet
   * @param {object} [options]
   * @param {number[]} [options.sizes] units each tube holds
   * @param {number[]} [options.oilColors] colors that are oil
   * @param {Array<{ oneWay?: boolean, lockKey?: number | null, fills?: number | null }>}
   *   [options.kinds] what is special about each tube (see TubeView)
   */
  showPuzzle(tubes, { sizes = tubes.map(() => TUBE_CAPACITY), oilColors = [], kinds = [] } = {}) {
    this.#cancelPours();
    const oil = new Set(oilColors);
    this.#isOil = (color) => oil.has(color);
    this.#tubes = tubes.map((colors, index) => {
      const tube = new TubeView(index, sizes[index], kinds[index]);
      tube.showColors(colors);
      return tube;
    });
    this.#layout();
    this.#requestRender();
  }

  /** Shows new contents at once, without animation, e.g. after an undo or a restart. */
  showContents(tubes) {
    this.#cancelPours();
    this.#tubes.forEach((tube, index) => {
      tube.showColors(tubes[index]);
      tube.resetPose();
      tube.setGlow(0);
    });
    this.#requestRender();
  }

  /**
   * Shows how many fills each cracked tube has left, which tubes are locked and which are
   * complete and so capped. Ice melts off a tube that just opened, and caps go on and come
   * off with a little animation; a tube in the middle of a pour gets its cap when the pour
   * ends. The rest changes at once.
   * @param {Array<{ fills: number | null, locked: boolean, capped?: boolean }>} states one per
   *   tube
   * @param {{ instant?: boolean }} [options] instant: put caps on and off without animating,
   *   e.g. after a restart
   */
  showTubeStates(states, { instant = false } = {}) {
    states.forEach(({ fills, locked, capped = false }, index) => {
      const tube = this.#tubes[index];
      tube.fills = fills;
      this.#setCapped(tube, capped, instant);
      if (tube.lockKey === null) return;
      if (!locked && tube.ice === 1) {
        motions.melt(this.#animator, tube);
        this.#onCue({ type: 'melt' });
      } else if (locked) tube.ice = 1;
    });
    this.#requestRender();
  }

  /** @param {Partial<Look>} look */
  setLook(look) {
    this.#look = { ...DEFAULT_LOOK, ...look };
    this.#confetti?.setColors?.(confettiColors(this.#look.palette));
    this.#requestRender();
  }

  setLifted(index, lifted) {
    this.#finishPour(index);
    return motions.lift(this.#animator, this.#tubes[index], lifted);
  }

  shake(index) {
    this.#finishPour(index);
    return motions.shake(this.#animator, this.#tubes[index]);
  }

  /** A small jump; skipped while the tube is busy in a newer pour. */
  hop(index) {
    if (this.#pours.has(index)) return Promise.resolve();
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

  /** Makes the tubes jump one after another and throws confetti; resolves once they land. */
  celebrate() {
    for (const index of [...this.#pours.keys()]) this.#finishPour(index);
    this.#confetti?.burst();
    return motions.celebrate(this.#animator, this.#tubes);
  }

  /**
   * Animates a pour, then shows the two tubes as they are after the move. Pours between
   * other tubes can run at the same time; a pour that needs a tube still busy in an earlier
   * one first finishes that one at once.
   * @param {number} from
   * @param {number} to
   * @param {number} amount units poured
   * @param {number[][]} tubesAfter the whole board after the pour
   */
  async pour(from, to, amount, tubesAfter) {
    this.#finishPour(from);
    this.#finishPour(to);
    const stream = { visible: false, color: 0, x: 0, top: 0, bottom: 0 };
    const handle = { from, to, tubesAfter, stream, cancelled: false };
    this.#pours.set(from, handle);
    this.#pours.set(to, handle);
    this.#streams.add(stream);

    await animatePour({
      animator: this.#animator,
      stream,
      source: this.#tubes[from],
      target: this.#tubes[to],
      amount,
      isOil: this.#isOil,
      handle,
      onFlow: (flow) => this.#onCue({ type: 'flow', ...flow })
    });
    if (!handle.cancelled) this.#settle(handle);
  }

  #setCapped(tube, capped, instant) {
    if (instant) {
      tube.capped = capped;
      this.#animator.stop(motions.capKey(tube));
      tube.cap = capped ? 1 : 0;
      return;
    }
    if (tube.capped === capped) return;
    tube.capped = capped;
    if (!this.#pours.has(tube.index)) this.#playCap(tube);
  }

  /** Moves a tube's cap toward where it belongs; a cap that lands makes the tube hop. */
  async #playCap(tube) {
    if (tube.cap === (tube.capped ? 1 : 0)) return;
    if (!tube.capped) {
      motions.openCap(this.#animator, tube);
      this.#onCue({ type: 'capOff' });
      return;
    }
    const landing = setTimeout(() => this.#onCue({ type: 'capOn' }), motions.CAP_LANDS_MS);
    await motions.closeCap(this.#animator, tube);
    // A cap whose drop was cut short never landed.
    if (tube.cap !== 1) clearTimeout(landing);
    if (tube.capped && tube.cap === 1 && this.#tubes[tube.index] === tube) this.hop(tube.index);
  }

  /** Jumps a pour that involves the tube at `index` to its end. */
  #finishPour(index) {
    const handle = this.#pours.get(index);
    if (!handle) return;

    handle.cancelled = true;
    this.#animator.stop(motions.bodyKey(this.#tubes[handle.from]));
    this.#settle(handle);
  }

  /** Shows a pour's two tubes as they are after it, at rest. */
  #settle(handle) {
    const { from, to, tubesAfter, stream } = handle;
    const source = this.#tubes[from];
    source.showColors(tubesAfter[from]);
    source.resetPose();
    this.#tubes[to].showColors(tubesAfter[to]);
    stream.visible = false;
    this.#streams.delete(stream);
    this.#pours.delete(from);
    this.#pours.delete(to);
    // Caps that waited for the pour to end.
    this.#playCap(source);
    this.#playCap(this.#tubes[to]);

    if (this.#layoutPending && this.#pours.size === 0) {
      this.#layoutPending = false;
      this.#layout();
    }
    this.#requestRender();
  }

  /** Drops every pour where it is, e.g. before the whole board is replaced. */
  #cancelPours() {
    for (const handle of this.#pours.values()) handle.cancelled = true;
    this.#pours.clear();
    this.#streams.clear();
    this.#animator.stopAll();
  }

  #layout() {
    if (this.#tubes.length === 0) return;

    const { width, height } = this.#size;
    // Rows make room for the tallest tube; shorter ones stand on the same line.
    const tallest = Math.max(...this.#tubes.map((tube) => tube.height));
    const { positions, bounds } = arrangeTubes(this.#tubes.length, width / height, tallest);
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
    this.#view = fitToView(
      this.#bounds,
      width,
      height,
      this.#getTopInset(),
      this.#getBottomInset()
    );
  }

  #resize() {
    const width = this.#canvas.clientWidth;
    const height = this.#canvas.clientHeight;
    if (!width || !height) return;

    const pixelRatio = Math.min(this.#quality.ratio, window.devicePixelRatio || 1);
    this.#canvas.width = Math.round(width * pixelRatio);
    this.#canvas.height = Math.round(height * pixelRatio);
    this.#context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (this.#movingCanvas) {
      this.#movingCanvas.width = this.#canvas.width;
      this.#movingCanvas.height = this.#canvas.height;
      this.#movingContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      this.#layers = createLayers();
    }
    this.#size = { width, height };

    // Moving tubes in the middle of a pour would break its path; rearrange them afterwards.
    if (this.#pours.size > 0) {
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
   * Times the frames while something moves, and lowers the resolution if they come too slowly
   * (see QualityGovernor).
   */
  #watchSpeed() {
    const now = performance.now();
    const previous = this.#lastFrameAt;
    this.#lastFrameAt = this.#animator.isRunning ? now : null;
    if (previous === null) return;

    const ratio = this.#quality.record(now - previous);
    if (ratio !== null) {
      saveRatio(ratio);
      this.#resize();
    }
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
    this.#watchSpeed();
    this.#animator.tick();
    const scene = {
      ...this.#size,
      tubes: this.#tubes,
      streams: this.#streams,
      view: this.#view,
      ...this.#look,
      isOil: this.#isOil
    };
    if (this.#movingContext) {
      drawSceneLayers(this.#context, this.#movingContext, this.#layers, scene);
    } else {
      drawScene(this.#context, scene);
    }
    if (this.#animator.isRunning) this.#requestRender();
  }
}
