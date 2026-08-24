// svg.js - a minimal Canvas2D-compatible recorder that emits SVG.
// It lets the same drawing code produce a raster frame or a vector file.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v) => (Math.round(v * 100) / 100).toString();

class Grad {
  constructor(x0, y0, x1, y1) { this.x0 = x0; this.y0 = y0; this.x1 = x1; this.y1 = y1; this.stops = []; }
  addColorStop(offset, color) { this.stops.push([offset, color]); }
}

function mul(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export class SvgCtx {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.defs = [];
    this.body = [];
    this.stack = [];
    this.uid = 0;
    this.d = '';
    this.evenodd = false;
    this._measure = document.createElement('canvas').getContext('2d');
    this.s = {
      fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
      lineCap: 'butt', lineJoin: 'miter', dash: null, font: '10px sans-serif',
      textAlign: 'start', textBaseline: 'alphabetic', m: [1, 0, 0, 1, 0, 0], clip: null,
      shadowColor: 'transparent', shadowBlur: 0, shadowOffsetY: 0, shadowOffsetX: 0,
    };
  }

  /* canvas-style properties proxy onto the state record */
  get fillStyle() { return this.s.fillStyle; }
  set fillStyle(v) { this.s.fillStyle = v; }
  get strokeStyle() { return this.s.strokeStyle; }
  set strokeStyle(v) { this.s.strokeStyle = v; }
  get lineWidth() { return this.s.lineWidth; }
  set lineWidth(v) { this.s.lineWidth = v; }
  get globalAlpha() { return this.s.globalAlpha; }
  set globalAlpha(v) { this.s.globalAlpha = v; }
  get lineCap() { return this.s.lineCap; }
  set lineCap(v) { this.s.lineCap = v; }
  get lineJoin() { return this.s.lineJoin; }
  set lineJoin(v) { this.s.lineJoin = v; }
  get font() { return this.s.font; }
  set font(v) { this.s.font = v; }
  get textAlign() { return this.s.textAlign; }
  set textAlign(v) { this.s.textAlign = v; }
  get textBaseline() { return this.s.textBaseline; }
  set textBaseline(v) { this.s.textBaseline = v; }
  get shadowColor() { return this.s.shadowColor; }
  set shadowColor(v) { this.s.shadowColor = v; }
  get shadowBlur() { return this.s.shadowBlur; }
  set shadowBlur(v) { this.s.shadowBlur = v; }
  get shadowOffsetX() { return this.s.shadowOffsetX; }
  set shadowOffsetX(v) { this.s.shadowOffsetX = v; }
  get shadowOffsetY() { return this.s.shadowOffsetY; }
  set shadowOffsetY(v) { this.s.shadowOffsetY = v; }

  /* state */
  save() { this.stack.push({ ...this.s, m: [...this.s.m] }); }
  restore() { if (this.stack.length) this.s = this.stack.pop(); }
  translate(x, y) { this.s.m = mul(this.s.m, [1, 0, 0, 1, x, y]); }
  rotate(a) { this.s.m = mul(this.s.m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]); }
  scale(x, y) { this.s.m = mul(this.s.m, [x, 0, 0, y, 0, 0]); }
  setTransform(a, b, c, d, e, f) { this.s.m = [a, b, c, d, e, f]; }
  setLineDash(arr) { this.s.dash = arr && arr.length ? arr : null; }
  getLineDash() { return this.s.dash || []; }
  createLinearGradient(x0, y0, x1, y1) { return new Grad(x0, y0, x1, y1); }
  measureText(t) { this._measure.font = this.s.font; return this._measure.measureText(t); }

  /* paths */
  beginPath() { this.d = ''; this.evenodd = false; }
  closePath() { this.d += 'Z '; }
  moveTo(x, y) { this.d += `M${n(x)} ${n(y)} `; }
  // canvas treats lineTo on an empty path as moveTo; SVG drops the subpath without an M
  lineTo(x, y) { this.d += `${this.d ? 'L' : 'M'}${n(x)} ${n(y)} `; }
  quadraticCurveTo(cx, cy, x, y) { this.d += `Q${n(cx)} ${n(cy)} ${n(x)} ${n(y)} `; }
  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) { this.d += `C${n(c1x)} ${n(c1y)} ${n(c2x)} ${n(c2y)} ${n(x)} ${n(y)} `; }
  rect(x, y, w, h) { this.d += `M${n(x)} ${n(y)} h${n(w)} v${n(h)} h${n(-w)} Z `; }

  arc(cx, cy, r, a0, a1, ccw) { this._arc(cx, cy, r, r, a0, a1, ccw); }
  ellipse(cx, cy, rx, ry, rot, a0, a1, ccw) { this._arc(cx, cy, rx, ry, a0, a1, ccw); }

  _arc(cx, cy, rx, ry, a0, a1, ccw) {
    let delta = a1 - a0;
    if (ccw) { if (delta > 0) delta -= Math.PI * 2; } else if (delta < 0) delta += Math.PI * 2;
    const full = Math.abs(delta) >= Math.PI * 2 - 1e-6;
    const x0 = cx + rx * Math.cos(a0), y0 = cy + ry * Math.sin(a0);
    // every arc in this app is a standalone circle or ellipse, so start a subpath
    this.d += `M${n(x0)} ${n(y0)} `;
    if (full) {
      const xm = cx - rx * Math.cos(a0), ym = cy - ry * Math.sin(a0);
      this.d += `A${n(rx)} ${n(ry)} 0 1 1 ${n(xm)} ${n(ym)} A${n(rx)} ${n(ry)} 0 1 1 ${n(x0)} ${n(y0)} `;
      return;
    }
    const end = a0 + delta;
    const x1 = cx + rx * Math.cos(end), y1 = cy + ry * Math.sin(end);
    const large = Math.abs(delta) > Math.PI ? 1 : 0;
    const sweep = delta > 0 ? 1 : 0;
    this.d += `A${n(rx)} ${n(ry)} 0 ${large} ${sweep} ${n(x1)} ${n(y1)} `;
  }

  /* painting */
  _transform() {
    const m = this.s.m;
    if (m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0) return '';
    return ` transform="matrix(${m.map(n).join(' ')})"`;
  }

  _clip() { return this.s.clip ? ` clip-path="url(#${this.s.clip})"` : ''; }

  _paint(value) {
    if (value instanceof Grad) {
      const id = `g${++this.uid}`;
      const stops = value.stops.map(([o, c]) => `<stop offset="${n(o * 100)}%" stop-color="${esc(c)}"/>`).join('');
      this.defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n(value.x0)}" y1="${n(value.y0)}" x2="${n(value.x1)}" y2="${n(value.y1)}">${stops}</linearGradient>`);
      return `url(#${id})`;
    }
    return esc(value);
  }

  fill(rule) {
    if (!this.d) return;
    const fr = rule === 'evenodd' ? ' fill-rule="evenodd"' : '';
    this.body.push(`<path d="${this.d.trim()}" fill="${this._paint(this.s.fillStyle)}"${fr} fill-opacity="${n(this.s.globalAlpha)}"${this._transform()}${this._clip()}/>`);
  }

  stroke() {
    if (!this.d) return;
    const dash = this.s.dash ? ` stroke-dasharray="${this.s.dash.map(n).join(' ')}"` : '';
    this.body.push(`<path d="${this.d.trim()}" fill="none" stroke="${this._paint(this.s.strokeStyle)}" stroke-width="${n(this.s.lineWidth)}" stroke-opacity="${n(this.s.globalAlpha)}" stroke-linecap="${this.s.lineCap}" stroke-linejoin="${this.s.lineJoin}"${dash}${this._transform()}${this._clip()}/>`);
  }

  clip() {
    const id = `c${++this.uid}`;
    this.defs.push(`<clipPath id="${id}"><path d="${this.d.trim()}"/></clipPath>`);
    this.s.clip = id;
  }

  fillRect(x, y, w, h) {
    this.body.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${this._paint(this.s.fillStyle)}" fill-opacity="${n(this.s.globalAlpha)}"${this._transform()}${this._clip()}/>`);
  }

  strokeRect(x, y, w, h) {
    this.body.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="none" stroke="${this._paint(this.s.strokeStyle)}" stroke-width="${n(this.s.lineWidth)}" stroke-opacity="${n(this.s.globalAlpha)}"${this._transform()}${this._clip()}/>`);
  }

  clearRect() { /* the background is painted explicitly */ }

  fillText(text, x, y) {
    const f = this.s.font.match(/(\d+(?:\.\d+)?)px/);
    const size = f ? parseFloat(f[1]) : 12;
    const weight = (this.s.font.match(/^(\d{3})/) || [])[1] || '400';
    const family = this.s.font.split('px').pop().trim() || 'Inter, system-ui, sans-serif';
    const anchor = this.s.textAlign === 'center' ? 'middle' : this.s.textAlign === 'right' ? 'end' : 'start';
    const baseline = this.s.textBaseline === 'middle' ? 'central' : this.s.textBaseline === 'top' ? 'hanging' : 'alphabetic';
    this.body.push(`<text x="${n(x)}" y="${n(y)}" font-family="${esc(family)}" font-size="${n(size)}" font-weight="${weight}" fill="${this._paint(this.s.fillStyle)}" fill-opacity="${n(this.s.globalAlpha)}" text-anchor="${anchor}" dominant-baseline="${baseline}"${this._transform()}${this._clip()}>${esc(text)}</text>`);
  }

  strokeText(text, x, y) { this.fillText(text, x, y); }
  drawImage() { /* not needed for a single frame */ }

  toString() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">
<defs>${this.defs.join('')}</defs>
${this.body.join('\n')}
</svg>`;
  }
}
