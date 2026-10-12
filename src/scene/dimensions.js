import { TUBE_CAPACITY } from '../game/rules.js';

// Sizes in world units. A tube stands on its group origin and holds one segment per unit.

export const TUBE_RADIUS = 0.42;
export const LIQUID_RADIUS = 0.37;
/** Gap between the bottom of the glass and the lowest liquid segment. */
export const LIQUID_FLOOR = 0.05;
export const SEGMENT_HEIGHT = 0.62;
/** Room above the liquid when the tube is full. */
const HEADROOM = 0.4;

/** Height of a tube that holds `capacity` units; tall tubes are taller, not narrower. */
export function tubeHeight(capacity) {
  return LIQUID_FLOOR + SEGMENT_HEIGHT * capacity + HEADROOM;
}

/** Height of a tube of the usual capacity. */
export const TUBE_HEIGHT = tubeHeight(TUBE_CAPACITY);

/** Horizontal distance between neighboring tube centers. */
export const TUBE_SPACING = 1.3;
/** Free space between the top of one row of tubes and the bottom of the next. */
export const ROW_GAP = 1;

/** How far a selected tube rises. */
export const LIFT_HEIGHT = 0.55;
/** Tilt of a pouring tube, in radians. */
export const POUR_TILT = 1;
