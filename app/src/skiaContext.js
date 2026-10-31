import { parseColor } from './color.js';

const TAU = Math.PI * 2;

/**
 * Just enough of a `CanvasRenderingContext2D` to draw the board with the same code as the
 * website (src/scene/renderer.js), on top of React Native Skia. Each frame is recorded into a
 * picture: the first `clearRect` over the whole canvas starts it, and it is handed to
 * `onPicture` once the code that draws has finished.
 *
 * `skia` is the `@shopify/react-native-skia` module (a stand-in in tests).
 */
export class SkiaContext2D {
  fillStyle = '#000000';
  strokeStyle = '#000000';
  lineWidth = 1;
  globalAlpha = 1;
  lineCap = 'butt';
  lineJoin = 'miter';
  textAlign = 'start';
  textBaseline = 'alphabetic';
  font = '10px sans-serif';

  #skia;
  #size;
  #onPicture;
  #fontFor;
  #recorder = null;
  #canvas = null;
  #path = null;
  #current = null;
  #stack = [];
  #flushQueued = false;

  /**
   * @param {object} skia
   * @param {object} options
   * @param {() => { width: number, height: number }} options.size the canvas size in pixels
   * @param {(picture: object) => void} options.onPicture
   * @param {(size: number, bold: boolean) => object} options.fontFor a Skia font of a size
   */
  constructor(skia, { size, onPicture, fontFor }) {
    this.#skia = skia;
    this.#size = size;
    this.#onPicture = onPicture;
    this.#fontFor = fontFor;
  }

  // The board is drawn in dp, which Skia uses too, so the pixel ratio needs no scaling.
  setTransform() {}

  clearRect(x, y, width, height) {
    const size = this.#size();
    if (this.#canvas || x > 0 || y > 0 || width < size.width || height < size.height) return;
    this.#recorder = this.#skia.Skia.PictureRecorder();
    this.#canvas = this.#recorder.beginRecording(
      this.#skia.Skia.XYWHRect(0, 0, size.width, size.height)
    );
    this.#stack = [];
    this.#queueFlush();
  }

  save() {
    this.#stack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      globalAlpha: this.globalAlpha,
      lineCap: this.lineCap,
      lineJoin: this.lineJoin,
      textAlign: this.textAlign,
      textBaseline: this.textBaseline,
      font: this.font
    });
    this.#canvas?.save();
  }

  restore() {
    const state = this.#stack.pop();
    if (state) Object.assign(this, state);
    this.#canvas?.restore();
  }

  translate(x, y) {
    this.#canvas?.translate(x, y);
  }

  scale(x, y) {
    this.#canvas?.scale(x, y);
  }

  /** @param {number} angle radians */
  rotate(angle) {
    this.#canvas?.rotate((angle * 180) / Math.PI, 0, 0);
  }

  beginPath() {
    this.#path = this.#skia.Skia.Path.Make();
    this.#current = null;
  }

  closePath() {
    this.#path?.close();
  }

  moveTo(x, y) {
    this.#ensurePath().moveTo(x, y);
    this.#current = { x, y };
  }

  lineTo(x, y) {
    if (!this.#current) return this.moveTo(x, y);
    this.#path.lineTo(x, y);
    this.#current = { x, y };
  }

  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
    if (!this.#current) this.moveTo(c1x, c1y);
    this.#path.cubicTo(c1x, c1y, c2x, c2y, x, y);
    this.#current = { x, y };
  }

  rect(x, y, width, height) {
    this.moveTo(x, y);
    this.lineTo(x + width, y);
    this.lineTo(x + width, y + height);
    this.lineTo(x, y + height);
    this.closePath();
  }

  /** A circular arc, as Canvas draws it: a line joins it to where the path was. */
  arc(cx, cy, radius, start, end, counterclockwise = false) {
    let sweep = end - start;
    if (counterclockwise) {
      if (sweep > 0) sweep -= Math.ceil(sweep / TAU) * TAU;
      sweep = Math.max(sweep, -TAU);
    } else {
      if (sweep < 0) sweep += Math.ceil(-sweep / TAU) * TAU;
      sweep = Math.min(sweep, TAU);
    }
    const first = { x: cx + radius * Math.cos(start), y: cy + radius * Math.sin(start) };
    if (this.#current) this.lineTo(first.x, first.y);
    else this.moveTo(first.x, first.y);
    this.#arcSegments(cx, cy, radius, start, sweep);
  }

  /** The rounded corner of Canvas: an arc of `radius` between the lines to (x1,y1) and (x2,y2). */
  arcTo(x1, y1, x2, y2, radius) {
    const from = this.#current ?? { x: x1, y: y1 };
    if (!this.#current) this.moveTo(x1, y1);
    const ax = from.x - x1;
    const ay = from.y - y1;
    const bx = x2 - x1;
    const by = y2 - y1;
    const lengthA = Math.hypot(ax, ay);
    const lengthB = Math.hypot(bx, by);
    const cross = ax * by - ay * bx;
    if (radius === 0 || lengthA === 0 || lengthB === 0 || Math.abs(cross) < 1e-9) {
      this.lineTo(x1, y1);
      return;
    }
    const cosAngle = (ax * bx + ay * by) / (lengthA * lengthB);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    const tangent = radius / Math.tan(angle / 2);
    const startPoint = { x: x1 + (ax / lengthA) * tangent, y: y1 + (ay / lengthA) * tangent };
    const endPoint = { x: x1 + (bx / lengthB) * tangent, y: y1 + (by / lengthB) * tangent };
    // The center sits on the bisector, `radius` away from both lines.
    const bisectorX = ax / lengthA + bx / lengthB;
    const bisectorY = ay / lengthA + by / lengthB;
    const bisectorLength = Math.hypot(bisectorX, bisectorY);
    const distance = radius / Math.sin(angle / 2);
    const cx = x1 + (bisectorX / bisectorLength) * distance;
    const cy = y1 + (bisectorY / bisectorLength) * distance;
    const startAngle = Math.atan2(startPoint.y - cy, startPoint.x - cx);
    const endAngle = Math.atan2(endPoint.y - cy, endPoint.x - cx);
    let sweep = endAngle - startAngle;
    if (cross < 0) {
      // Turning one way.
      if (sweep < 0) sweep += TAU;
      if (sweep > Math.PI) sweep -= TAU;
    } else {
      if (sweep > 0) sweep -= TAU;
      if (sweep < -Math.PI) sweep += TAU;
    }
    this.lineTo(startPoint.x, startPoint.y);
    this.#arcSegments(cx, cy, radius, startAngle, sweep);
  }

  fill() {
    if (this.#path) this.#canvas?.drawPath(this.#path, this.#paint('fill'));
  }

  stroke() {
    if (this.#path) this.#canvas?.drawPath(this.#path, this.#paint('stroke'));
  }

  fillRect(x, y, width, height) {
    this.#canvas?.drawRect(this.#skia.Skia.XYWHRect(x, y, width, height), this.#paint('fill'));
  }

  clip() {
    if (this.#path) this.#canvas?.clipPath(this.#path, this.#skia.ClipOp.Intersect, true);
  }

  fillText(text, x, y) {
    if (!this.#canvas) return;
    const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? '10');
    const bold = /\b(bold|[6-9]00)\b/.test(this.font);
    const font = this.#fontFor(size, bold);
    const width = font.getTextWidth?.(text) ?? font.measureText?.(text)?.width ?? 0;
    const dx = this.textAlign === 'center' ? -width / 2 : this.textAlign === 'right' ? -width : 0;
    const dy = this.textBaseline === 'middle' ? size * 0.35 : 0;
    this.#canvas.drawText(text, x + dx, y + dy, this.#paint('fill'), font);
  }

  #ensurePath() {
    if (!this.#path) this.beginPath();
    return this.#path;
  }

  /** Appends a circular arc as cubic curves (at most a quarter turn each). */
  #arcSegments(cx, cy, radius, start, sweep) {
    const pieces = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
    const step = sweep / pieces;
    const k = (4 / 3) * Math.tan(step / 4);
    let angle = start;
    for (let i = 0; i < pieces; i++) {
      const next = angle + step;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const cosB = Math.cos(next);
      const sinB = Math.sin(next);
      this.bezierCurveTo(
        cx + radius * (cosA - k * sinA),
        cy + radius * (sinA + k * cosA),
        cx + radius * (cosB + k * sinB),
        cy + radius * (sinB - k * cosB),
        cx + radius * cosB,
        cy + radius * sinB
      );
      angle = next;
    }
  }

  #paint(kind) {
    const { Skia, PaintStyle, StrokeCap, StrokeJoin } = this.#skia;
    const paint = Skia.Paint();
    const [r, g, b, a] = parseColor(kind === 'fill' ? this.fillStyle : this.strokeStyle);
    paint.setAntiAlias(true);
    const channel = (value) => Math.round(value * 255);
    paint.setColor(
      Skia.Color(`rgba(${channel(r)}, ${channel(g)}, ${channel(b)}, ${a * this.globalAlpha})`)
    );
    if (kind === 'stroke') {
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(this.lineWidth);
      paint.setStrokeCap(this.lineCap === 'round' ? StrokeCap.Round : StrokeCap.Butt);
      paint.setStrokeJoin(this.lineJoin === 'round' ? StrokeJoin.Round : StrokeJoin.Miter);
    } else {
      paint.setStyle(PaintStyle.Fill);
    }
    return paint;
  }

  /** Hands the recorded frame on once the drawing code has run to its end. */
  #queueFlush() {
    if (this.#flushQueued) return;
    this.#flushQueued = true;
    queueMicrotask(() => {
      this.#flushQueued = false;
      if (!this.#canvas) return;
      const picture = this.#recorder.finishRecordingAsPicture();
      this.#canvas = null;
      this.#recorder = null;
      this.#onPicture(picture);
    });
  }
}
