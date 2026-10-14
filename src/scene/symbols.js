/**
 * A symbol for each liquid color, drawn over the liquid for players who cannot tell the
 * colors apart. Each has a different outline, so none is mistaken for another even in grey.
 */

/** The symbols as text, in color order, e.g. for the editor's color chips. */
export const SYMBOL_CHARS = ['●', '▲', '■', '◆', '★', '✚', '✖', '⬢', '◯', '▬', '❤', '☾'];

/**
 * Draws the symbol of `color`, centered at the origin, about `size` units across, in white
 * with a dark rim so it shows on light and dark colors alike.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} color
 * @param {number} size
 */
export function drawSymbol(ctx, color, size) {
  const r = size / 2;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = size * 0.12;
  ctx.beginPath();
  switch (color % SYMBOL_CHARS.length) {
    case 0: // circle
      ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      break;
    case 1: // triangle
      polygon(ctx, [
        [0, -r],
        [r, r * 0.8],
        [-r, r * 0.8]
      ]);
      break;
    case 2: // square
      ctx.rect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
      break;
    case 3: // diamond
      polygon(ctx, [
        [0, -r],
        [r, 0],
        [0, r],
        [-r, 0]
      ]);
      break;
    case 4: // star
      polygon(ctx, star(r, r * 0.45, 5));
      break;
    case 5: // plus
      polygon(ctx, cross(r, r * 0.35));
      break;
    case 6: // cross
      polygon(
        ctx,
        cross(r, r * 0.35).map(([x, y]) => [(x - y) * Math.SQRT1_2, (x + y) * Math.SQRT1_2])
      );
      break;
    case 7: // hexagon
      polygon(ctx, star(r, r, 6));
      break;
    case 8: // ring
      ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      ctx.moveTo(r * 0.4, 0);
      ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2, true);
      break;
    case 9: // bar
      ctx.rect(-r, -r * 0.3, r * 2, r * 0.6);
      break;
    case 10: // heart
      ctx.moveTo(0, r * 0.9);
      ctx.bezierCurveTo(-r * 1.3, r * 0.1, -r * 0.8, -r * 0.9, 0, -r * 0.3);
      ctx.bezierCurveTo(r * 0.8, -r * 0.9, r * 1.3, r * 0.1, 0, r * 0.9);
      break;
    default: // crescent
      ctx.arc(0, 0, r * 0.9, Math.PI * 0.35, Math.PI * 1.65);
      ctx.arc(r * 0.35, 0, r * 0.7, Math.PI * 1.45, Math.PI * 0.55, true);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.fill('evenodd');
  ctx.restore();
}

function polygon(ctx, points) {
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
}

/** The points of a star, or a regular polygon when both radii are the same. */
function star(outer, inner, points) {
  return Array.from({ length: points * (outer === inner ? 1 : 2) }, (_, i) => {
    const count = outer === inner ? points : points * 2;
    const radius = outer === inner || i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
}

function cross(length, width) {
  return [
    [-width, -length],
    [width, -length],
    [width, -width],
    [length, -width],
    [length, width],
    [width, width],
    [width, length],
    [-width, length],
    [-width, width],
    [-length, width],
    [-length, -width],
    [-width, -width]
  ];
}
