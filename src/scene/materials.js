import { DoubleSide, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import { LIQUID_COLORS } from './palette.js';

export const GLASS_OPACITY = 0.22;

/** One material per palette color, shared by every segment of that color. */
export function createLiquidMaterials() {
  return LIQUID_COLORS.map(
    (color) => new MeshStandardMaterial({ color, roughness: 0.3, metalness: 0, side: DoubleSide })
  );
}

/** Each tube gets its own glass so a single tube can glow when it is hinted. */
export function createGlassMaterial(color) {
  return new MeshPhysicalMaterial({
    color,
    roughness: 0.05,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: GLASS_OPACITY,
    side: DoubleSide,
    depthWrite: false
  });
}

/** Draws nothing but can still be hit by a raycast. */
export function createHitAreaMaterial() {
  return new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
}

export function createStreamMaterial() {
  return new MeshStandardMaterial({ roughness: 0.3 });
}
