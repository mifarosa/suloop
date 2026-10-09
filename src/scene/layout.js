import { LIFT_HEIGHT, ROW_SPACING, TUBE_HEIGHT, TUBE_RADIUS, TUBE_SPACING } from './dimensions.js';

/** Empty space kept around the tubes, in world units. */
const FRAME_MARGIN = 0.9;
/** Extra room above the tubes so the top row stays clear of the HUD. */
const HUD_ROOM = 1;
/** How much the camera looks down at the tubes, as a share of its distance. */
const CAMERA_RISE = 0.18;

/** Narrow screens get shorter rows, so the tubes stay large enough to tap. */
function maxTubesPerRow(aspect) {
  if (aspect < 0.75) return 4;
  if (aspect < 1.2) return 5;
  return 7;
}

/**
 * Arranges tubes in centered rows of equal length, the last row possibly shorter.
 * @param {number} count
 * @param {number} aspect width / height of the view
 * @returns {{ positions: Array<{ x: number, y: number }>, bounds: { width: number, top: number, bottom: number } }}
 */
export function arrangeTubes(count, aspect) {
  const rows = Math.ceil(count / maxTubesPerRow(aspect));
  const perRow = Math.ceil(count / rows);

  const positions = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const column = i % perRow;
    const tubesInRow = Math.min(perRow, count - row * perRow);
    positions.push({ x: (column - (tubesInRow - 1) / 2) * TUBE_SPACING, y: -row * ROW_SPACING });
  }

  const bounds = {
    width: (perRow - 1) * TUBE_SPACING + TUBE_RADIUS * 2,
    top: TUBE_HEIGHT + LIFT_HEIGHT,
    bottom: -(rows - 1) * ROW_SPACING
  };
  return { positions, bounds };
}

/**
 * Places the camera so the whole arrangement fits the view, looking slightly down.
 * @param {{ width: number, top: number, bottom: number }} bounds
 * @param {number} fov vertical field of view, in degrees
 * @param {number} aspect
 */
export function frameCamera(bounds, fov, aspect) {
  const width = bounds.width + FRAME_MARGIN * 2;
  const height = bounds.top - bounds.bottom + FRAME_MARGIN * 2 + HUD_ROOM;
  const tanHalfFov = Math.tan((fov * Math.PI) / 360);
  const distance = Math.max(height / 2 / tanHalfFov, width / 2 / (tanHalfFov * aspect));
  const centerY = (bounds.top + bounds.bottom) / 2 + HUD_ROOM / 2;

  return {
    position: { x: 0, y: centerY + distance * CAMERA_RISE, z: distance },
    target: { x: 0, y: centerY, z: 0 }
  };
}
