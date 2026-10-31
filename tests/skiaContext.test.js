import { describe, expect, it } from 'vitest';
import { parseColor } from '../app/src/color.js';
import { SkiaContext2D } from '../app/src/skiaContext.js';
import { drawScene } from '../src/scene/renderer.js';
import { TubeView } from '../src/scene/tubeView.js';
import { arrangeTubes, fitToView } from '../src/scene/layout.js';
import { HIDDEN } from '../src/game/rules.js';

/** A stand-in for React Native Skia that writes down what it is asked to draw. */
function fakeSkia() {
  const log = [];
  const canvas = {
    save: () => log.push(['save']),
    restore: () => log.push(['restore']),
    translate: (x, y) => log.push(['translate', x, y]),
    scale: (x, y) => log.push(['scale', x, y]),
    rotate: (degrees) => log.push(['rotate', degrees]),
    drawPath: (path, paint) => log.push(['drawPath', path.ops.length, paint.style, paint.color]),
    drawRect: (rect, paint) => log.push(['drawRect', rect, paint.style, paint.color]),
    clipPath: () => log.push(['clip']),
    drawText: (text) => log.push(['text', text])
  };
  const skia = {
    Skia: {
      PictureRecorder: () => ({
        beginRecording: () => canvas,
        finishRecordingAsPicture: () => ({ log: log.splice(0) })
      }),
      XYWHRect: (x, y, width, height) => ({ x, y, width, height }),
      Path: {
        Make: () => {
          const ops = [];
          const path = { ops };
          for (const name of ['moveTo', 'lineTo', 'cubicTo', 'close']) {
            path[name] = (...args) => ops.push([name, ...args]);
          }
          return path;
        }
      },
      Paint: () => {
        const paint = {};
        paint.setAntiAlias = () => {};
        paint.setColor = (color) => (paint.color = color);
        paint.setStyle = (style) => (paint.style = style);
        paint.setStrokeWidth = (width) => (paint.width = width);
        paint.setStrokeCap = () => {};
        paint.setStrokeJoin = () => {};
        return paint;
      },
      Color: (css) => css
    },
    PaintStyle: { Fill: 'fill', Stroke: 'stroke' },
    StrokeCap: { Round: 'round', Butt: 'butt' },
    StrokeJoin: { Round: 'round', Miter: 'miter' },
    ClipOp: { Intersect: 'intersect' }
  };
  return skia;
}

function drawOnce(setUp) {
  const skia = fakeSkia();
  let picture = null;
  const context = new SkiaContext2D(skia, {
    size: () => ({ width: 390, height: 600 }),
    onPicture: (made) => (picture = made),
    fontFor: () => ({ getTextWidth: () => 10 })
  });
  const tubes = setUp();
  const { positions, bounds } = arrangeTubes(tubes.length, 390 / 600, tubes[0].height);
  tubes.forEach((tube, index) => Object.assign(tube, positions[index]));
  const view = fitToView(bounds, 390, 600, 80, 120);
  drawScene(context, {
    width: 390,
    height: 600,
    tubes,
    streams: new Set([{ visible: true, color: 0, x: 0, top: 3, bottom: 1 }]),
    view,
    glassColor: '#ffffff',
    symbols: true
  });
  return new Promise((resolve) => queueMicrotask(() => resolve(picture)));
}

describe('colors', () => {
  it('reads the colors the board is drawn with', () => {
    expect(parseColor('#ff0000')).toEqual([1, 0, 0, 1]);
    expect(parseColor('#f00')).toEqual([1, 0, 0, 1]);
    expect(parseColor('rgba(255, 255, 255, 0.22)')).toEqual([1, 1, 1, 0.22]);
    expect(parseColor('rgba(255, 214, 120, 1)')[3]).toBe(1);
    expect(parseColor('not a color')).toEqual([0, 0, 0, 1]);
  });
});

describe('the Skia context', () => {
  it('draws a whole board with the code of the website', async () => {
    const picture = await drawOnce(() => {
      const plain = new TubeView(0);
      plain.showColors([0, 1, 2, 0]);
      const hidden = new TubeView(1);
      hidden.showColors([HIDDEN, HIDDEN, 3, 4]);
      const locked = new TubeView(2, 4, { lockKey: 0 });
      locked.showColors([1, 1, 1, 1]);
      const capped = new TubeView(3);
      capped.showColors([2, 2, 2, 2]);
      capped.capped = true;
      capped.cap = 1;
      const tilted = new TubeView(4, 5, { oneWay: true, fills: 2 });
      tilted.showColors([0, 1]);
      tilted.body.tilt = 0.6;
      return [plain, hidden, locked, capped, tilted, new TubeView(5)];
    });

    const kinds = picture.log.map((entry) => entry[0]);
    expect(kinds).toContain('drawPath');
    expect(kinds).toContain('clip');
    expect(kinds).toContain('text');
    // Every save has its restore.
    expect(kinds.filter((kind) => kind === 'save')).toHaveLength(
      kinds.filter((kind) => kind === 'restore').length
    );
    // Strokes and fills both appear, with their alpha.
    const styles = new Set(picture.log.filter((e) => e[0] === 'drawPath').map((e) => e[2]));
    expect(styles).toEqual(new Set(['fill', 'stroke']));
    expect(picture.log.some((e) => e[0] === 'drawPath' && /rgba\(.*, 0\.\d+\)/.test(e[3]))).toBe(
      true
    );
  });

  it('turns arcs into curves that start where Canvas would start them', async () => {
    const skia = fakeSkia();
    let picture = null;
    const context = new SkiaContext2D(skia, {
      size: () => ({ width: 100, height: 100 }),
      onPicture: (made) => (picture = made),
      fontFor: () => ({})
    });
    context.clearRect(0, 0, 100, 100);
    context.beginPath();
    context.moveTo(0, 0);
    context.arc(10, 10, 5, 0, Math.PI * 2);
    context.fill();
    await new Promise((resolve) => queueMicrotask(resolve));
    const drawn = picture.log.find((entry) => entry[0] === 'drawPath');
    // moveTo, a line to the arc's start, and four quarter-turn curves for a circle.
    expect(drawn[1]).toBe(2 + 4);
  });

  it('keeps colors and widths apart between save and restore', async () => {
    const skia = fakeSkia();
    let picture = null;
    const context = new SkiaContext2D(skia, {
      size: () => ({ width: 100, height: 100 }),
      onPicture: (made) => (picture = made),
      fontFor: () => ({})
    });
    context.clearRect(0, 0, 100, 100);
    context.fillStyle = '#00ff00';
    context.save();
    context.fillStyle = '#ff0000';
    context.restore();
    context.fillRect(0, 0, 5, 5);
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(picture.log.at(-1)[3]).toBe('rgba(0, 255, 0, 1)');
  });
});
