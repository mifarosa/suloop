import { Group, Mesh } from 'three';
import { LIQUID_FLOOR, SEGMENT_HEIGHT, TUBE_HEIGHT } from './dimensions.js';
import {
  createBottomSegmentGeometry,
  createGlassGeometry,
  createHitAreaGeometry,
  createRimGeometry,
  createSegmentGeometry
} from './geometry.js';
import {
  createGlassMaterial,
  createHitAreaMaterial,
  createLiquidMaterials,
  GLASS_OPACITY
} from './materials.js';

/** Geometries and materials that every tube shares; create them once per scene. */
export function createTubeResources() {
  return {
    glassGeometry: createGlassGeometry(),
    rimGeometry: createRimGeometry(),
    segmentGeometry: createSegmentGeometry(),
    bottomSegmentGeometry: createBottomSegmentGeometry(),
    hitAreaGeometry: createHitAreaGeometry(),
    hitAreaMaterial: createHitAreaMaterial(),
    liquidMaterials: createLiquidMaterials()
  };
}

/**
 * The meshes of one tube, arranged so each kind of motion has its own node:
 *
 *   group  – placed by the layout
 *   └ body – lifted, shaken and tilted; its origin is the mouth, so a pour tilts around it
 *     └ inner – shifted back down so the glass and the liquid stand on the group origin
 */
export class TubeView {
  /**
   * @param {number} index position of the tube on the board
   * @param {ReturnType<typeof createTubeResources>} resources
   * @param {import('three').Color} glassColor
   */
  constructor(index, resources, glassColor) {
    this.index = index;
    this.resources = resources;

    this.group = new Group();
    this.body = new Group();
    this.inner = new Group();
    this.body.position.y = TUBE_HEIGHT;
    this.inner.position.y = -TUBE_HEIGHT;
    this.body.add(this.inner);
    this.group.add(this.body);

    this.glassMaterial = createGlassMaterial(glassColor);
    const rim = new Mesh(resources.rimGeometry, this.glassMaterial);
    rim.position.y = TUBE_HEIGHT;
    this.inner.add(new Mesh(resources.glassGeometry, this.glassMaterial), rim);

    this.hitArea = new Mesh(resources.hitAreaGeometry, resources.hitAreaMaterial);
    this.hitArea.userData.tubeIndex = index;
    this.group.add(this.hitArea);

    /** @type {Mesh[]} liquid segments, bottom first */
    this.segments = [];
    /** @type {number[]} colors shown, bottom first */
    this.colors = [];
  }

  get topColor() {
    return this.colors[this.colors.length - 1];
  }

  /** Rebuilds the liquid to show `colors`, bottom first. */
  showColors(colors) {
    for (const segment of this.segments) this.inner.remove(segment);
    this.segments = [];
    colors.forEach((color, slot) => this.addSegment(color, slot));
    this.colors = colors.slice();
  }

  /** Adds one liquid segment at the given slot (0 = bottom) and returns it. */
  addSegment(color, slot) {
    const { bottomSegmentGeometry, segmentGeometry, liquidMaterials } = this.resources;
    const segment = new Mesh(
      slot === 0 ? bottomSegmentGeometry : segmentGeometry,
      liquidMaterials[color]
    );
    segment.position.y = LIQUID_FLOOR + slot * SEGMENT_HEIGHT;
    this.inner.add(segment);
    this.segments.push(segment);
    return segment;
  }

  /** Puts the tube back upright in its resting place. */
  resetPose() {
    this.body.position.set(0, TUBE_HEIGHT, 0);
    this.body.rotation.z = 0;
  }

  setGlassColor(color) {
    this.glassMaterial.color.copy(color);
  }

  /** @param {number} amount 0 for plain glass, 1 for fully lit */
  setGlow(amount) {
    this.glassMaterial.emissive.setRGB(amount * 0.45, amount * 0.4, amount * 0.15);
    this.glassMaterial.opacity = GLASS_OPACITY + amount * 0.3;
  }

  dispose() {
    this.glassMaterial.dispose();
  }
}
