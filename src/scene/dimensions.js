import { TUBE_CAPACITY } from '../game/rules.js';

// Sizes in world units. A tube stands on its group origin and holds TUBE_CAPACITY segments.

export const TUBE_RADIUS = 0.42;
export const LIQUID_RADIUS = 0.37;
/** Gap between the bottom of the glass and the lowest liquid segment. */
export const LIQUID_FLOOR = 0.05;
export const SEGMENT_HEIGHT = 0.62;
/** Room above the liquid when the tube is full. */
const HEADROOM = 0.4;
export const TUBE_HEIGHT = LIQUID_FLOOR + SEGMENT_HEIGHT * TUBE_CAPACITY + HEADROOM;

/** Horizontal distance between neighboring tube centers. */
export const TUBE_SPACING = 1.3;
/** Vertical distance between rows of tubes. */
export const ROW_SPACING = TUBE_HEIGHT + 1;

/** How far a selected tube rises. */
export const LIFT_HEIGHT = 0.55;
/** Tilt of a pouring tube, in radians. */
export const POUR_TILT = 1;
