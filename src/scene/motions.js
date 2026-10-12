import { linear } from './animator.js';
import { LIFT_HEIGHT } from './dimensions.js';

const DURATION_MS = {
  lift: 160,
  shake: 320,
  hop: 380,
  pulse: 1400,
  celebrationJump: 450,
  celebrationStagger: 70
};

/**
 * Animation key for everything that moves a tube's body, so that a new motion (a lift,
 * a hop, a pour) always replaces the previous one instead of fighting it.
 */
export function bodyKey(tube) {
  return `body-${tube.index}`;
}

/**
 * @param {import('./animator.js').Animator} animator
 * @param {import('./tubeView.js').TubeView} tube
 * @param {boolean} lifted
 */
export function lift(animator, tube, lifted) {
  const { body } = tube;
  const from = body.y;
  const to = tube.height + (lifted ? LIFT_HEIGHT : 0);
  return animator.run(
    DURATION_MS.lift,
    (t) => {
      body.y = from + (to - from) * t;
    },
    { key: bodyKey(tube) }
  );
}

/** A quick sideways wobble that says "not here". */
export function shake(animator, tube) {
  const { body } = tube;
  return animator.run(
    DURATION_MS.shake,
    (t) => {
      body.x = Math.sin(t * Math.PI * 6) * 0.08 * (1 - t);
    },
    { ease: linear, key: `shake-${tube.index}` }
  );
}

/** A small jump, played when a tube becomes complete. */
export function hop(animator, tube) {
  return jump(animator, tube, 0.35, DURATION_MS.hop);
}

/** Makes the glass of the given tubes glow three times. */
export function pulse(animator, tubes) {
  return animator.run(
    DURATION_MS.pulse,
    (t) => {
      const glow = Math.sin(t * Math.PI * 3) ** 2;
      for (const tube of tubes) tube.setGlow(glow);
    },
    { ease: linear, key: 'pulse' }
  );
}

/** A wave of jumps from the first tube to the last. */
export function celebrate(animator, tubes) {
  return Promise.all(
    tubes.map((tube, i) =>
      wait(i * DURATION_MS.celebrationStagger).then(() =>
        jump(animator, tube, 0.6, DURATION_MS.celebrationJump)
      )
    )
  );
}

function jump(animator, tube, height, duration) {
  const { body } = tube;
  return animator.run(
    duration,
    (t) => {
      body.y = tube.height + Math.sin(t * Math.PI) * height;
    },
    { ease: linear, key: bodyKey(tube) }
  );
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
