import { describe, expect, it } from 'vitest';
import {
  LIQUID_FLOOR,
  LIQUID_RADIUS,
  SEGMENT_HEIGHT,
  TUBE_HEIGHT
} from '../src/scene/dimensions.js';
import {
  area,
  clipBelow,
  levelForArea,
  tiltedLayers,
  tiltToPour,
  tubeInside,
  unitsToArea,
  upInTube
} from '../src/scene/liquid.js';

const inside = tubeInside(TUBE_HEIGHT);

describe('tube geometry', () => {
  it('measures a square', () => {
    expect(
      area([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 0, y: 2 }
      ])
    ).toBe(4);
  });

  it('clips a polygon to what lies below a line', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 }
    ];
    expect(area(clipBelow(square, { x: 0, y: 1 }, 0.5))).toBeCloseTo(1);
  });

  it('holds a straight-walled unit above the rounded bottom', () => {
    const oneUnit = unitsToArea(inside, 2) - unitsToArea(inside, 1);
    expect(oneUnit).toBeCloseTo(2 * LIQUID_RADIUS * SEGMENT_HEIGHT, 5);
  });

  it('finds the level that holds an amount', () => {
    const up = { x: 0, y: 1 };
    const level = levelForArea(inside, up, unitsToArea(inside, 3));
    expect(level).toBeCloseTo(LIQUID_FLOOR + 3 * SEGMENT_HEIGHT, 3);
  });
});

describe('tiltedLayers', () => {
  const layers = [
    { color: 1, units: 2 },
    { color: 2, units: 1 }
  ];

  it('stacks the layers flat in an upright tube', () => {
    const [top, bottom] = tiltedLayers(TUBE_HEIGHT, layers, 0);
    expect(top.color).toBe(2);
    expect(top.top).toBeCloseTo(LIQUID_FLOOR + 3 * SEGMENT_HEIGHT, 3);
    expect(bottom.top).toBeCloseTo(LIQUID_FLOOR + 2 * SEGMENT_HEIGHT, 3);
  });

  it('keeps every layer as large in a tilted tube as upright', () => {
    const [top, bottom] = tiltedLayers(TUBE_HEIGHT, layers, 0.8);
    expect(area(bottom.polygon)).toBeCloseTo(unitsToArea(inside, 2), 3);
    expect(area(top.polygon)).toBeCloseTo(unitsToArea(inside, 3), 3);
  });

  it('keeps the surface level: its two ends sit at the same world height', () => {
    const tilt = 0.8;
    const [top] = tiltedLayers(TUBE_HEIGHT, layers, tilt);
    const up = upInTube(tilt);
    const onSurface = top.polygon.filter((p) => Math.abs(p.x * up.x + p.y * up.y - top.top) < 1e-6);
    expect(onSurface.length).toBeGreaterThanOrEqual(2);
  });
});

describe('tiltToPour', () => {
  it('tilts a full tube least and a nearly empty one almost flat', () => {
    // A full tube pours once the narrow room above the liquid tips over: about 47 degrees.
    const full = tiltToPour(TUBE_HEIGHT, 4);
    expect(full).toBeGreaterThan(0.7);
    expect(full).toBeLessThan(0.9);
    expect(tiltToPour(TUBE_HEIGHT, 2)).toBeGreaterThan(full);
    expect(tiltToPour(TUBE_HEIGHT, 1)).toBeGreaterThan(1.4);
    expect(tiltToPour(TUBE_HEIGHT, 0)).toBeCloseTo(Math.PI / 2, 2);
  });

  it('brings the surface to the lip', () => {
    const tilt = tiltToPour(TUBE_HEIGHT, 2);
    const up = upInTube(tilt);
    const surface = levelForArea(inside, up, unitsToArea(inside, 2));
    const lip = -LIQUID_RADIUS * up.x + TUBE_HEIGHT * up.y;
    expect(surface).toBeCloseTo(lip, 3);
  });
});
