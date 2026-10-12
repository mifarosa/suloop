import { linear } from './animator.js';
import { LIQUID_FLOOR, POUR_TILT, SEGMENT_HEIGHT } from './dimensions.js';
import { bodyKey } from './motions.js';

const APPROACH_MS = 340;
const RETURN_MS = 320;
const FLOW_BASE_MS = 220;
const FLOW_PER_UNIT_MS = 160;

/**
 * Animates pouring `amount` units from `source` into `target` in three steps:
 * the source moves above the target and tilts, the liquid flows through a stream,
 * and the source goes back. Segments are only drained and filled here; afterwards
 * the caller rebuilds both tubes from the game state.
 *
 * @param {object} pour
 * @param {import('./animator.js').Animator} pour.animator
 * @param {{ visible: boolean, color: number, x: number, top: number, bottom: number }} pour.stream
 *   the falling liquid, in world units; hidden when not pouring
 * @param {import('./tubeView.js').TubeView} pour.source
 * @param {import('./tubeView.js').TubeView} pour.target
 * @param {number} pour.amount
 */
export async function animatePour({ animator, stream, source, target, amount }) {
  // Come from the side that faces the screen center, so the tilted tube stays in view.
  const side = target.x >= 0 ? 1 : -1;
  const aboveTarget = {
    x: target.x - source.x - side * 0.25,
    y: target.y + target.height - source.y + 0.75,
    tilt: -side * POUR_TILT
  };
  const atRest = { x: 0, y: source.height, tilt: 0 };

  await moveBody(animator, source, aboveTarget, APPROACH_MS);
  await flow({ animator, stream, source, target, amount, side });
  await moveBody(animator, source, atRest, RETURN_MS);
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
    { key: bodyKey(tube) }
  );
}

async function flow({ animator, stream, source, target, amount, side }) {
  const outgoing = source.segments.slice(-amount);
  // A pour takes the whole same-colored run, hidden units included; they show as they leave.
  for (const segment of outgoing) segment.color = source.topColor;
  const firstFreeSlot = target.colors.length;
  const incoming = [];
  for (let i = 0; i < amount; i++) {
    const segment = target.addSegment(source.topColor, firstFreeSlot + i);
    segment.fill = 0;
    incoming.push(segment);
  }

  // The body's origin is the tube mouth, where the stream starts.
  const mouth = { x: source.x + source.body.x, y: source.y + source.body.y };
  stream.color = source.topColor;
  stream.visible = true;

  await animator.run(
    FLOW_BASE_MS + amount * FLOW_PER_UNIT_MS,
    (t) => {
      const poured = t * amount;

      // The source empties from the top down while the target fills from the bottom up.
      outgoing.forEach((segment, i) => {
        segment.fill = 1 - clamp01(poured - (amount - 1 - i));
      });
      incoming.forEach((segment, i) => {
        segment.fill = clamp01(poured - i);
      });

      // The stream reaches from the mouth down to the rising liquid surface in the target.
      const surface = target.y + LIQUID_FLOOR + (firstFreeSlot + poured) * SEGMENT_HEIGHT;
      stream.x = mouth.x + side * 0.1;
      stream.bottom = surface;
      stream.top = Math.max(surface + 0.01, mouth.y - 0.05);
    },
    { ease: linear, key: bodyKey(source) }
  );

  stream.visible = false;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}
