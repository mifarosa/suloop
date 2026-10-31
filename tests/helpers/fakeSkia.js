/** A stand-in for React Native Skia that writes down what it is asked to draw. */
export function fakeSkia() {
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
