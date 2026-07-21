/* =====================================================================
 *  带上她的眼睛 · NDS 美学小剧场
 *  engine.js —— 像素渲染引擎、数学工具、相机、灯光后期
 *  内部分辨率 320x180 (16:9)，全屏 nearest-neighbor 放大保持像素质感
 * ===================================================================== */
(function (global) {
  'use strict';
  const HE = (global.HE = global.HE || {});

  const IW = 320, IH = 180;
  HE.IW = IW; HE.IH = IH;

  // ---------- 数学工具 ----------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, v) => (b - a === 0 ? 0 : (v - a) / (b - a));
  const smooth = (t) => t * t * (3 - 2 * t);
  const easeIn = (t) => t * t;
  const easeOut = (t) => 1 - (1 - t) * (1 - t);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInCubic = (t) => t * t * t;
  HE.math = { clamp, lerp, inv, smooth, easeIn, easeOut, easeInOut, easeOutCubic, easeInCubic };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  HE.rng = mulberry32;

  // ---------- 颜色 ----------
  const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
  const rgba = (r, g, b, a) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
  function parse(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function mix(h1, h2, t) {
    const a = typeof h1 === 'string' ? parse(h1) : h1;
    const b = typeof h2 === 'string' ? parse(h2) : h2;
    return rgb(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
  }
  HE.color = { rgb, rgba, parse, mix };

  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  HE.BAYER = BAYER;

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { canvas: c, ctx };
  }
  HE.makeCanvas = makeCanvas;

  // ---------- 像素绘制原语 ----------
  const G = {
    px(ctx, x, y, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); },
    rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); },
    hline(ctx, x, y, w, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, 1); },
    vline(ctx, x, y, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, h | 0); },
    disc(ctx, cx, cy, r, c) {
      ctx.fillStyle = c;
      const r2 = r * r;
      for (let y = -r; y <= r; y++) {
        const w = Math.floor(Math.sqrt(Math.max(0, r2 - y * y)));
        if (w >= 0) ctx.fillRect((cx - w) | 0, (cy + y) | 0, 2 * w + 1, 1);
      }
    },
    ring(ctx, cx, cy, r, c, thick) {
      thick = thick || 1;
      const steps = Math.max(10, (r * 6.5) | 0);
      ctx.fillStyle = c;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        ctx.fillRect((cx + Math.cos(a) * r) | 0, (cy + Math.sin(a) * r) | 0, thick, thick);
      }
    },
    line(ctx, x0, y0, x1, y1, c) {
      ctx.fillStyle = c;
      x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        ctx.fillRect(x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    },
    gradV(ctx, x, y, w, h, cTop, cBot) {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, cTop); g.addColorStop(1, cBot);
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    },
    gradR(ctx, cx, cy, r, cIn, cOut) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, cIn); g.addColorStop(1, cOut);
      ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    },
    // 竖直抖动渐变，带复古分色带感
    ditherV(ctx, x, y, w, h, cTop, cBot, bands) {
      bands = bands || 10;
      const top = parse(cTop), bot = parse(cBot);
      for (let j = 0; j < h; j++) {
        const t = j / (h - 1 || 1);
        const q = t * bands;
        const lo = Math.floor(q) / bands;
        const hi = Math.min(1, (Math.floor(q) + 1) / bands);
        const frac = q - Math.floor(q);
        const cLo = [lerp(top[0], bot[0], lo), lerp(top[1], bot[1], lo), lerp(top[2], bot[2], lo)];
        const cHi = [lerp(top[0], bot[0], hi), lerp(top[1], bot[1], hi), lerp(top[2], bot[2], hi)];
        for (let i = 0; i < w; i++) {
          const thr = (BAYER[(y + j) & 3][(x + i) & 3] + 0.5) / 16;
          const c = frac > thr ? cHi : cLo;
          ctx.fillStyle = rgb(c[0], c[1], c[2]);
          ctx.fillRect(x + i, y + j, 1, 1);
        }
      }
    },
  };
  HE.G = G;

  // ---------- 相机 ----------
  function Camera() {
    this.cx = IW / 2; this.cy = IH / 2; this.zoom = 1;
    this.shakeAmp = 0; this._sx = 0; this._sy = 0; this._t = 0;
  }
  Camera.prototype.reset = function () { this.cx = IW / 2; this.cy = IH / 2; this.zoom = 1; this.shakeAmp = 0; };
  Camera.prototype.shake = function (a) { this.shakeAmp = Math.max(this.shakeAmp, a); };
  Camera.prototype.update = function (dt) {
    this._t += dt;
    if (this.shakeAmp > 0.02) {
      this._sx = (Math.sin(this._t * 61) + Math.sin(this._t * 43.3)) * 0.5 * this.shakeAmp;
      this._sy = (Math.sin(this._t * 57.7) + Math.sin(this._t * 71.1)) * 0.5 * this.shakeAmp;
      this.shakeAmp *= Math.exp(-dt * 5.5);
    } else { this.shakeAmp = 0; this._sx = 0; this._sy = 0; }
  };
  // 把相机变换应用到 ctx（绘制世界前调用）
  Camera.prototype.apply = function (ctx) {
    ctx.save();
    ctx.translate(IW / 2 + this._sx, IH / 2 + this._sy);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.cx, -this.cy);
  };
  Camera.prototype.restore = function (ctx) { ctx.restore(); };
  HE.Camera = Camera;

  // ---------- 补间/时间线 ----------
  // Timeline：注册 (start, dur, fn(p), ease) 段落，按全局时间驱动
  function Timeline() { this.segs = []; this.t = 0; }
  Timeline.prototype.add = function (start, dur, fn, ease) {
    this.segs.push({ start, dur, fn, ease: ease || ((x) => x), done: false });
    return this;
  };
  Timeline.prototype.at = function (start, fn) {
    this.segs.push({ start, dur: 0, fn: () => fn(), ease: (x) => x, once: true, done: false });
    return this;
  };
  Timeline.prototype.seek = function (t) { this.t = t; };
  Timeline.prototype.update = function (t) {
    this.t = t;
    for (const s of this.segs) {
      if (s.dur === 0) {
        if (t >= s.start && !s.done) { s.fn(); s.done = true; }
        continue;
      }
      if (t >= s.start && t <= s.start + s.dur) {
        s.fn(s.ease(clamp((t - s.start) / s.dur, 0, 1)));
      } else if (t > s.start + s.dur && !s.done) {
        s.fn(s.ease(1)); s.done = true;
      } else if (t < s.start) {
        s.done = false;
      }
    }
  };
  HE.Timeline = Timeline;

  // ---------- 值追踪器（平滑跟随目标，用于相机运镜） ----------
  function Track(v) { this.v = v; this.target = v; this.k = 4; }
  Track.prototype.set = function (t, k) { this.target = t; if (k != null) this.k = k; };
  Track.prototype.snap = function (v) { this.v = v; this.target = v; };
  Track.prototype.update = function (dt) {
    const a = 1 - Math.exp(-this.k * dt);
    this.v += (this.target - this.v) * a;
    return this.v;
  };
  HE.Track = Track;

  global.HE = HE;
})(window);
