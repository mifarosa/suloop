import { CylinderGeometry, LatheGeometry, TorusGeometry, Vector2 } from 'three';
import {
  LIFT_HEIGHT,
  LIQUID_RADIUS,
  SEGMENT_HEIGHT,
  TUBE_HEIGHT,
  TUBE_RADIUS
} from './dimensions.js';

// Lathe profiles must not touch the axis exactly, or the normals there break.
const AXIS_OFFSET = 1e-4;

/** Quarter circle from the center of a rounded bottom out to the wall. */
function roundedBottomProfile(radius, steps) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const angle = -Math.PI / 2 + (i / steps) * (Math.PI / 2);
    points.push(
      new Vector2(
        Math.max(Math.cos(angle) * radius, AXIS_OFFSET),
        radius + Math.sin(angle) * radius
      )
    );
  }
  return points;
}

/** An open glass tube with a rounded bottom. */
export function createGlassGeometry() {
  const profile = roundedBottomProfile(TUBE_RADIUS, 16);
  profile.push(new Vector2(TUBE_RADIUS, TUBE_HEIGHT));
  return new LatheGeometry(profile, 48);
}

/** The thicker lip around the mouth of the tube. */
export function createRimGeometry() {
  return new TorusGeometry(TUBE_RADIUS, 0.035, 8, 48).rotateX(Math.PI / 2);
}

/** The lowest liquid segment follows the rounded bottom and is closed on top. */
export function createBottomSegmentGeometry() {
  const profile = roundedBottomProfile(LIQUID_RADIUS, 12);
  profile.push(new Vector2(LIQUID_RADIUS, SEGMENT_HEIGHT));
  profile.push(new Vector2(AXIS_OFFSET, SEGMENT_HEIGHT));
  return new LatheGeometry(profile, 40);
}

/** A straight liquid segment, with its origin at the bottom so scaling grows it upwards. */
export function createSegmentGeometry() {
  return new CylinderGeometry(LIQUID_RADIUS, LIQUID_RADIUS, SEGMENT_HEIGHT, 40).translate(
    0,
    SEGMENT_HEIGHT / 2,
    0
  );
}

/** A generous, invisible tap target that also covers a lifted tube. */
export function createHitAreaGeometry() {
  const radius = TUBE_RADIUS * 1.5;
  const height = TUBE_HEIGHT + LIFT_HEIGHT + 0.4;
  return new CylinderGeometry(radius, radius, height, 12).translate(0, height / 2 - 0.2, 0);
}

/** A unit-length stream of liquid, scaled to the distance it falls. */
export function createStreamGeometry() {
  return new CylinderGeometry(0.06, 0.06, 1, 12);
}
