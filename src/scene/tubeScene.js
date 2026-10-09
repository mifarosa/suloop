import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  PMREMGenerator,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Animator } from './animator.js';
import { createStreamGeometry } from './geometry.js';
import { arrangeTubes, frameCamera } from './layout.js';
import { createStreamMaterial } from './materials.js';
import * as motions from './motions.js';
import { animatePour } from './pour.js';
import { createTubeResources, TubeView } from './tubeView.js';

const CAMERA_FOV = 35;
const DEFAULT_GLASS_COLOR = '#ffffff';
// Rendering above 2x costs battery on phones without a visible difference.
const MAX_PIXEL_RATIO = 2;

/**
 * The 3D view of the board. It knows how to show and animate tubes, and reports taps;
 * it knows nothing about the rules of the game.
 */
export class TubeScene {
  #canvas;
  #renderer;
  #scene;
  #camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.1, 200);
  #root = new Group();
  #resources = createTubeResources();
  #stream = new Mesh(createStreamGeometry(), createStreamMaterial());
  #glassColor = new Color(DEFAULT_GLASS_COLOR);
  #animator = new Animator();
  #raycaster = new Raycaster();
  #pointer = new Vector2();
  /** @type {TubeView[]} */
  #tubes = [];
  #bounds = null;
  #pouring = false;
  #layoutPending = false;
  #onTubeTap = () => {};

  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.#canvas = canvas;
    this.#renderer = createRenderer(canvas);
    this.#scene = createLitScene(this.#renderer);
    this.#stream.visible = false;
    this.#scene.add(this.#root, this.#stream);

    canvas.addEventListener('pointerdown', (event) => this.#handlePointerDown(event));
    new ResizeObserver(() => this.#resize()).observe(canvas);
    this.#resize();
    this.#renderer.setAnimationLoop(() => this.#renderFrame());
  }

  /** @param {(index: number) => void} listener called with the index of the tapped tube */
  onTubeTap(listener) {
    this.#onTubeTap = listener;
  }

  /** Replaces every tube, e.g. for a new puzzle. */
  showPuzzle(tubes) {
    this.#animator.stopAll();
    for (const tube of this.#tubes) {
      this.#root.remove(tube.group);
      tube.dispose();
    }

    this.#tubes = tubes.map((colors, index) => {
      const tube = new TubeView(index, this.#resources, this.#glassColor);
      tube.showColors(colors);
      this.#root.add(tube.group);
      return tube;
    });
    this.#layout();
  }

  /** Shows new contents at once, without animation, e.g. after an undo or a restart. */
  showContents(tubes) {
    this.#animator.stopAll();
    this.#tubes.forEach((tube, index) => {
      tube.showColors(tubes[index]);
      tube.resetPose();
      tube.setGlow(0);
    });
  }

  /** @param {string} color any CSS color */
  setGlassColor(color) {
    this.#glassColor.set(color || DEFAULT_GLASS_COLOR);
    for (const tube of this.#tubes) tube.setGlassColor(this.#glassColor);
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
  }

  #layout() {
    if (this.#tubes.length === 0) return;

    const { positions, bounds } = arrangeTubes(this.#tubes.length, this.#camera.aspect);
    this.#tubes.forEach((tube, index) =>
      tube.group.position.set(positions[index].x, positions[index].y, 0)
    );
    this.#bounds = bounds;
    this.#fitCamera();
  }

  #fitCamera() {
    if (!this.#bounds) return;

    const { position, target } = frameCamera(this.#bounds, this.#camera.fov, this.#camera.aspect);
    this.#camera.position.set(position.x, position.y, position.z);
    this.#camera.lookAt(target.x, target.y, target.z);
  }

  #resize() {
    const width = this.#canvas.clientWidth;
    const height = this.#canvas.clientHeight;
    if (!width || !height) return;

    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();

    // Moving tubes in the middle of a pour would break its path; rearrange them afterwards.
    if (this.#pouring) {
      this.#layoutPending = true;
      this.#fitCamera();
    } else {
      this.#layout();
    }
  }

  #handlePointerDown(event) {
    const rect = this.#canvas.getBoundingClientRect();
    this.#pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.#raycaster.setFromCamera(this.#pointer, this.#camera);

    const hits = this.#raycaster.intersectObjects(
      this.#tubes.map((tube) => tube.hitArea),
      false
    );
    if (hits.length > 0) this.#onTubeTap(hits[0].object.userData.tubeIndex);
  }

  #renderFrame() {
    this.#animator.tick();
    this.#renderer.render(this.#scene, this.#camera);
  }
}

function createRenderer(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.toneMapping = ACESFilmicToneMapping;
  return renderer;
}

/** A soft studio room for the glass to reflect, plus a key light and a sky fill. */
function createLitScene(renderer) {
  const scene = new Scene();

  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();

  const keyLight = new DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(3, 8, 6);
  scene.add(keyLight, new HemisphereLight(0xdde6ff, 0x202030, 0.5));
  return scene;
}
