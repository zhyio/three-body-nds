/* =====================================================================
 *  display.js —— 屏幕合成与后期
 *  内部缓冲 -> 灯光层(tint/晕影/光晕) -> 放大到可见 canvas -> 扫描线/CRT
 * ===================================================================== */
(function (global) {
  'use strict';
  const HE = global.HE;
  const { IW, IH } = HE;
  const G = HE.G;

  function Display(visibleCanvas, uiCanvas) {
    this.out = visibleCanvas;
    this.octx = visibleCanvas.getContext('2d');
    this.octx.imageSmoothingEnabled = false;

    // 高分辨率 UI 叠层（文字在此绘制，随缩放保持清晰）
    this.uiCanvas = uiCanvas || null;
    this.uictx = uiCanvas ? uiCanvas.getContext('2d') : null;
    this.uiScale = 1;

    // 内部主缓冲
    const b = HE.makeCanvas(IW, IH);
    this.buf = b.canvas; this.ctx = b.ctx;

    // 灯光/后期临时缓冲
    const l = HE.makeCanvas(IW, IH);
    this.lbuf = l.canvas; this.lctx = l.ctx;

    // 扫描线纹理（一次性生成）
    this.scan = this._buildScanline();

    this.scale = 1; this.ox = 0; this.oy = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // 后期参数（由导演系统设置）
    this.fx = {
      tint: null,        // [r,g,b]
      tintA: 0,          // 0..1
      vignette: 0.35,    // 晕影强度
      brightness: 1,     // 整体亮度
      grade: null,       // 冷暖分级 {shadow:[r,g,b], high:[r,g,b], a}
      aberr: 0,          // 色差
      bloom: 0,          // 泛光强度
      flash: 0,          // 白/黑闪 (正=白, 负=黑)
      grain: 0.05,       // 噪点
    };
    this._t = 0;
  }

  Display.prototype._buildScanline = function () {
    const c = HE.makeCanvas(4, 4);
    const ix = c.ctx.createImageData(4, 4);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const i = (y * 4 + x) * 4;
      const dark = (y % 2 === 1) ? 26 : 0;
      ix.data[i] = 0; ix.data[i + 1] = 0; ix.data[i + 2] = 0; ix.data[i + 3] = dark;
    }
    c.ctx.putImageData(ix, 0, 0);
    return c.canvas;
  };

  Display.prototype.resize = function () {
    const W = window.innerWidth, H = window.innerHeight;
    const s = Math.max(1, Math.floor(Math.min(W / IW, H / IH)));
    this.scale = s;
    this.out.width = IW * s;
    this.out.height = IH * s;
    this.out.style.width = (IW * s) + 'px';
    this.out.style.height = (IH * s) + 'px';
    this.octx.imageSmoothingEnabled = false;

    // UI 叠层：以更高的背景分辨率渲染文字（考虑设备像素比），保持锐利
    if (this.uiCanvas) {
      const dpr = Math.min(2, (window.devicePixelRatio || 1));
      const us = Math.min(8, Math.max(3, s)) * dpr;
      this.uiScale = us;
      this.uiCanvas.width = Math.round(IW * us);
      this.uiCanvas.height = Math.round(IH * us);
      this.uiCanvas.style.width = (IW * s) + 'px';
      this.uiCanvas.style.height = (IH * s) + 'px';
      this.uictx.imageSmoothingEnabled = true;
      this.uictx.imageSmoothingQuality = 'high';
    }
  };

  // 清空 UI 叠层并进入其逻辑坐标系（320x180）
  Display.prototype.beginUI = function () {
    if (!this.uictx) return null;
    this.uictx.setTransform(1, 0, 0, 1, 0, 0);
    this.uictx.clearRect(0, 0, this.uiCanvas.width, this.uiCanvas.height);
    this.uictx.scale(this.uiScale, this.uiScale);
    return this.uictx;
  };

  // 提供给场景绘制的主 ctx
  Display.prototype.clear = function (c) {
    this.ctx.fillStyle = c || '#000';
    this.ctx.fillRect(0, 0, IW, IH);
  };

  // 合成并输出
  Display.prototype.present = function (dt) {
    this._t += dt;
    const fx = this.fx;
    const src = this.ctx;
    // 性能/画质档位（由 main 设置）：缺省全强度
    const tier = this.tier || { scan: 1, vignMul: 1, bloom: true, grain: 1 };

    // --- 灯光层：把主缓冲拷到 lbuf 再叠加分级/色调 ---
    this.lctx.globalCompositeOperation = 'source-over';
    this.lctx.globalAlpha = 1;
    this.lctx.clearRect(0, 0, IW, IH);
    this.lctx.drawImage(this.buf, 0, 0);

    // 冷暖分级（阴影/高光染色）
    if (fx.grade && fx.grade.a > 0) {
      this.lctx.globalCompositeOperation = 'multiply';
      this.lctx.globalAlpha = fx.grade.a;
      this.lctx.fillStyle = HE.color.rgb(fx.grade.shadow[0], fx.grade.shadow[1], fx.grade.shadow[2]);
      this.lctx.fillRect(0, 0, IW, IH);
      this.lctx.globalCompositeOperation = 'screen';
      this.lctx.fillStyle = HE.color.rgb(fx.grade.high[0], fx.grade.high[1], fx.grade.high[2]);
      this.lctx.fillRect(0, 0, IW, IH);
      this.lctx.globalCompositeOperation = 'source-over';
      this.lctx.globalAlpha = 1;
    }

    // 全局色调
    if (fx.tint && fx.tintA > 0) {
      this.lctx.globalCompositeOperation = 'source-over';
      this.lctx.globalAlpha = fx.tintA;
      this.lctx.fillStyle = HE.color.rgb(fx.tint[0], fx.tint[1], fx.tint[2]);
      this.lctx.fillRect(0, 0, IW, IH);
      this.lctx.globalAlpha = 1;
    }

    // 亮度
    if (fx.brightness < 1) {
      this.lctx.globalCompositeOperation = 'multiply';
      const v = (fx.brightness * 255) | 0;
      this.lctx.fillStyle = HE.color.rgb(v, v, v);
      this.lctx.fillRect(0, 0, IW, IH);
      this.lctx.globalCompositeOperation = 'source-over';
    }

    // 晕影
    if (fx.vignette > 0) {
      const vig = fx.vignette * tier.vignMul;
      const g = this.lctx.createRadialGradient(IW / 2, IH / 2, IH * 0.35, IW / 2, IH / 2, IH * 0.85);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${vig})`);
      this.lctx.fillStyle = g;
      this.lctx.fillRect(0, 0, IW, IH);
    }

    // --- 输出到可见 canvas ---
    const s = this.scale;
    const octx = this.octx;
    octx.imageSmoothingEnabled = false;
    octx.clearRect(0, 0, this.out.width, this.out.height);

    // bloom：把亮部放大叠加（用整帧 screen 近似）；省电档关闭
    if (fx.bloom > 0 && tier.bloom) {
      octx.globalAlpha = 1;
      octx.drawImage(this.lbuf, 0, 0, this.out.width, this.out.height);
      octx.globalCompositeOperation = 'lighter';
      octx.globalAlpha = fx.bloom * 0.6;
      const off = 1 * s;
      octx.drawImage(this.lbuf, -off, 0, this.out.width, this.out.height);
      octx.drawImage(this.lbuf, off, 0, this.out.width, this.out.height);
      octx.drawImage(this.lbuf, 0, -off, this.out.width, this.out.height);
      octx.globalCompositeOperation = 'source-over';
      octx.globalAlpha = 1;
    } else if (fx.aberr > 0) {
      // 色差：分通道偏移
      const off = Math.max(1, fx.aberr * s) | 0;
      octx.globalCompositeOperation = 'lighter';
      octx.globalAlpha = 1;
      // 简化：整体画三次带偏移的暗拷贝
      octx.drawImage(this.lbuf, -off, 0, this.out.width, this.out.height);
      octx.drawImage(this.lbuf, off, 0, this.out.width, this.out.height);
      octx.drawImage(this.lbuf, 0, 0, this.out.width, this.out.height);
      octx.globalCompositeOperation = 'source-over';
    } else {
      octx.globalAlpha = 1;
      octx.drawImage(this.lbuf, 0, 0, this.out.width, this.out.height);
    }

    // 扫描线（强度随档位；图案缓存复用）
    if (tier.scan > 0.01) {
      octx.globalAlpha = tier.scan;
      if (!this._scanPat) this._scanPat = octx.createPattern(this.scan, 'repeat');
      const pat = this._scanPat;
      if (pat) {
        const m = (typeof DOMMatrix !== 'undefined') ? new DOMMatrix() : null;
        if (m && pat.setTransform) { m.a = s / 4; m.d = s / 4; pat.setTransform(m); }
        octx.fillStyle = pat;
        octx.fillRect(0, 0, this.out.width, this.out.height);
      }
      octx.globalAlpha = 1;
    }

    // 闪光
    if (fx.flash > 0.001) {
      octx.fillStyle = `rgba(255,255,255,${Math.min(1, fx.flash)})`;
      octx.fillRect(0, 0, this.out.width, this.out.height);
    } else if (fx.flash < -0.001) {
      octx.fillStyle = `rgba(0,0,0,${Math.min(1, -fx.flash)})`;
      octx.fillRect(0, 0, this.out.width, this.out.height);
    }
  };

  HE.Display = Display;
})(window);
