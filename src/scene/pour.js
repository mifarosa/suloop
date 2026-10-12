import { easeInOutCubic, linear } from './animator.js';
import { LIQUID_FLOOR, SEGMENT_HEIGHT, TUBE_RADIUS } from './dimensions.js';
import { tiltToPour } from './liquid.js';
import { bodyKey } from './motions.js';

const APPROACH_MS = 260;
const RETURN_MS = 240;
const FLOW_BASE_MS = 160;
const FLOW_PER_UNIT_MS = 120;
/** Time the liquid takes to fall from the lip into the target. */
const FALL_MS = 90;
/** How far above the target's mouth the lip of the pouring tube stays. */
const LIP_ABOVE_TARGET = 0.45;
/** How far from the target's middle the stream falls, toward the side the source is on. */
const STREAM_OFFSET = 0.14;
/** Extra tilt past the point where the liquid reaches the lip, so it actually flows. */
const FLOW_TILT = 0.07;
const MAX_TILT = 1.52;

/**
 * Animates pouring `amount` units from `source` into `target` in three steps: the source
 * moves over the target and tilts until its liquid reaches the lip, the liquid flows in a
 * stream while the source tilts further as it empties, and the source goes back. The lip
 * stays put above the target the whole time, as when pouring by hand. Segments are only
 * drained and filled here; afterwards the caller rebuilds both tubes from the game state.
 *
 * @param {object} pour
 * @param {import('./animator.js').Animator} pour.animator
 * @param {{ visible: boolean, color: number, x: number, top: number, bottom: number }} pour.stream
 *   the falling liquid, in world units; hidden when not pouring
 * @param {import('./tubeView.js').TubeView} pour.source
 * @param {import('./tubeView.js').TubeView} pour.target
 * @param {number} pour.amount
 * @param {(color: number) => boolean} [pour.isOil] oil floats: water poured into a tube sinks
 *   under its oil
 * @param {{ cancelled: boolean }} [pour.handle] set `cancelled` to stop the pour where it is
 * @param {(flow: { duration: number, amount: number }) => void} [pour.onFlow] called as the
 *   liquid starts to run, with how long it runs (ms)
 */
export async function animatePour({
  animator,
  stream,
  source,
  target,
  amount,
  isOil = () => false,
  handle = { cancelled: false },
  onFlow = () => {}
}) {
  // Pour toward the target from the side that faces the screen center, so the tilted tube
  // stays in view; tilting toward +x is a negative (clockwise) tilt.
  const side = target.x >= 0 ? 1 : -1;
  const lip = {
    x: target.x - side * STREAM_OFFSET,
    y: target.y + target.height + LIP_ABOVE_TARGET
  };
  const unitsBefore = source.layers.reduce((sum, layer) => sum + layer.units, 0);
  const tiltFor = (units, extra) =>
    -side * Math.min(tiltToPour(source.height, units) + extra, MAX_TILT);
  const poseAt = (tilt) => poseWithLipAt(source, lip, side, tilt);

  await moveBody(animator, source, poseAt(tiltFor(unitsBefore, 0)), APPROACH_MS);
  if (handle.cancelled) return;

  await flow({
    animator,
    stream,
    source,
    target,
    amount,
    isOil,
    lip,
    tiltFor,
    poseAt,
    unitsBefore,
    onFlow
  });
  if (handle.cancelled) return;

  await moveBody(animator, source, { x: 0, y: source.height, tilt: 0 }, RETURN_MS);
}

/** Where the body (its origin is the mouth's middle) has to be for the lip to sit at `lip`. */
function poseWithLipAt(source, lip, side, tilt) {
  // The lip is the mouth's corner on the pouring side, turned with the tube.
  const lipX = side * TUBE_RADIUS;
  return {
    x: lip.x - lipX * Math.cos(tilt) - source.x,
    y: lip.y - lipX * Math.sin(tilt) - source.y,
    tilt
  };
}

function moveBody(animator, tube, to, duration) {
  const { body } = tube;
  const from = { ...body };
  return animator.run(
    duration,
    (t) => {
      body.x = from.x + (to.x - from.x) * t;
      body.y = from.y + (to.y - from.y) * t;
      body.tilt = from.tilt + (to.tilt - from.tilt) * t;
    },
    { ease: easeInOutCubic, key: bodyKey(tube) }
  );
}

async function flow({
  animator,
  stream,
  source,
  target,
  amount,
  isOil,
  lip,
  tiltFor,
  poseAt,
  unitsBefore,
  onFlow
}) {
  const color = source.topColor;
  const outgoing = source.segments
    .slice()
    .sort((a, b) => a.slot - b.slot)
    .slice(-amount);
  // A pour takes the whole same-colored run, hidden units included; they show as they leave.
  for (const segment of outgoing) segment.color = color;

  // Water sinks under the target's oil, which rises as the water comes in.
  const floating = isOil(color) ? [] : target.segments.filter((segment) => isOil(segment.color));
  const firstSlot = target.colors.length - floating.length;
  const floatingSlots = floating.map((segment) => segment.slot);
  const incoming = [];
  for (let i = 0; i < amount; i++) {
    const segment = target.addSegment(color, firstSlot + i);
    segment.fill = 0;
    incoming.push(segment);
  }

  const duration = FLOW_BASE_MS + amount * FLOW_PER_UNIT_MS;
  onFlow({ duration, amount });
  // The liquid leaves the source during the first part and lands in the target during the
  // last part; in between, the stream hangs from the lip.
  const fall = Math.min(0.3, FALL_MS / duration);
  stream.color = color;
  stream.x = lip.x;
  stream.visible = true;

  await animator.run(
    duration,
    (t) => {
      const left = amount * clamp01(t / (1 - fall));
      const landed = amount * clamp01((t - fall) / (1 - fall));

      outgoing.forEach((segment, i) => {
        segment.fill = 1 - clamp01(left - (amount - 1 - i));
      });
      incoming.forEach((segment, i) => {
        segment.fill = clamp01(landed - i);
      });
      floating.forEach((segment, i) => {
        segment.slot = floatingSlots[i] + landed;
      });

      // Tilt further as the tube empties, so the liquid keeps reaching the lip.
      const pose = poseAt(tiltFor(unitsBefore - left, FLOW_TILT * clamp01(t * 6)));
      Object.assign(source.body, pose);

      // The stream's front falls at the start, and its tail falls at the end.
      const surface = target.y + LIQUID_FLOOR + (firstSlot + landed) * SEGMENT_HEIGHT;
      const head = clamp01(t / fall);
      const tail = clamp01((t - (1 - fall)) / fall);
      stream.top = lip.y - (lip.y - surface) * tail * tail;
      stream.bottom = lip.y - (lip.y - surface) * head * head;
    },
    { ease: linear, key: bodyKey(source) }
  );

  stream.visible = false;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}
