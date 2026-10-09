import { Vector3 } from 'three';
import { linear } from './animator.js';
import { LIQUID_FLOOR, POUR_TILT, SEGMENT_HEIGHT, TUBE_HEIGHT } from './dimensions.js';
import { bodyKey } from './motions.js';

const APPROACH_MS = 340;
const RETURN_MS = 320;
const FLOW_BASE_MS = 220;
const FLOW_PER_UNIT_MS = 160;

// A zero scale cannot be inverted by three.js, so an "empty" segment is just very flat.
const FLAT = 1e-4;

/**
 * Animates pouring `amount` units from `source` into `target` in three steps:
 * the source moves above the target and tilts, the liquid flows through a stream,
 * and the source goes back. Segments are only scaled here; afterwards the caller
 * rebuilds both tubes from the game state.
 *
 * @param {object} pour
 * @param {import('./animator.js').Animator} pour.animator
 * @param {import('three').Mesh} pour.stream the falling liquid, hidden when not pouring
 * @param {import('./tubeView.js').TubeView} pour.source
 * @param {import('./tubeView.js').TubeView} pour.target
 * @param {number} pour.amount
 */
export async function animatePour({ animator, stream, source, target, amount }) {
  // Come from the side that faces the screen center, so the tilted tube stays in view.
  const side = target.group.position.x >= 0 ? 1 : -1;
  const offset = new Vector3().subVectors(target.group.position, source.group.position);
  const aboveTarget = new Vector3(offset.x - side * 0.25, offset.y + TUBE_HEIGHT + 0.75, 0.3);
  const atRest = new Vector3(0, TUBE_HEIGHT, 0);

  await moveBody(animator, source, aboveTarget, -side * POUR_TILT, APPROACH_MS);
  await flow({ animator, stream, source, target, amount, side });
  await moveBody(animator, source, atRest, 0, RETURN_MS);
}

function moveBody(animator, tube, toPosition, toTilt, duration) {
  const { body } = tube;
  const fromPosition = body.position.clone();
  const fromTilt = body.rotation.z;
  return animator.run(
    duration,
    (t) => {
      body.position.lerpVectors(fromPosition, toPosition, t);
      body.rotation.z = fromTilt + (toTilt - fromTilt) * t;
    },
    { key: bodyKey(tube) }
  );
}

async function flow({ animator, stream, source, target, amount, side }) {
  const outgoing = source.segments.slice(-amount);
  const firstFreeSlot = target.colors.length;
  const incoming = [];
  for (let i = 0; i < amount; i++) {
    const segment = target.addSegment(source.topColor, firstFreeSlot + i);
    segment.scale.y = FLAT;
    incoming.push(segment);
  }

  // The body's origin is the tube mouth, where the stream starts.
  const mouth = source.body.getWorldPosition(new Vector3());
  const targetBase = target.group.position;
  stream.material.color.copy(outgoing[outgoing.length - 1].material.color);
  stream.visible = true;

  await animator.run(
    FLOW_BASE_MS + amount * FLOW_PER_UNIT_MS,
    (t) => {
      const poured = t * amount;

      // The source empties from the top down while the target fills from the bottom up.
      outgoing.forEach((segment, i) => {
        const order = amount - 1 - i;
        segment.scale.y = Math.max(FLAT, 1 - clamp01(poured - order));
      });
      incoming.forEach((segment, i) => {
        segment.scale.y = Math.max(FLAT, clamp01(poured - i));
      });

      // The stream reaches from the mouth down to the rising liquid surface in the target.
      const surface = targetBase.y + LIQUID_FLOOR + (firstFreeSlot + poured) * SEGMENT_HEIGHT;
      const length = Math.max(0.01, mouth.y - 0.05 - surface);
      stream.scale.set(1, length, 1);
      stream.position.set(mouth.x + side * 0.1, surface + length / 2, targetBase.z + 0.05);
    },
    { ease: linear, key: bodyKey(source) }
  );

  stream.visible = false;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}
