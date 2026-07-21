/* =====================================================================
 *  director.js —— 导演系统：场景状态、演出步骤(step)驱动、相机/灯光编排
 *  演出以"节拍脚本"推进：每个 beat 是一个 {t, fn} 或等待条件。
 *  这里提供 Stage（舞台：持有场景、角色、粒子、相机、灯光），
 *  以及一个协程式的脚本运行器 Script（支持 wait/say/tween 等）。
 * ===================================================================== */
(function (global) {
  'use strict';
  const HE = global.HE;
  const { lerp, clamp, easeInOut, easeOut, easeIn, smooth } = HE.math;

  /* ---------- 舞台 ---------- */
  function Stage(display, audio, ui, sfx) {
    this.d = display; this.A = audio; this.ui = ui; this.sfx = sfx;
    this.ctx = display.ctx;
    this.cam = new HE.Camera();
    this.actors = {};
    this.particles = new HE.Particles(260);
    this.fg = new HE.Particles(160);  // 前景粒子（花粉/星尘）
    this.scene = 'grass';
    this.env = { t: 0, sun: 0, depth: 0, px: 0, py: 0 };  // px/py: 视差偏移(-1..1)
    this.t = 0;
    // 视差目标（由指针/设备方向驱动，平滑跟随）
    this.pxTrack = new HE.Track(0); this.pyTrack = new HE.Track(0);
    this._pxTarget = 0; this._pyTarget = 0;
    // 对话框出现时压暗背景（0..1）
    this.dimTrack = new HE.Track(0);
    // 关键停顿帧：整体动画减速系数（1 正常，趋近 0 近乎静止）
    this.slowmo = new HE.Track(1);
    // 灯光/后期目标值（用 Track 平滑）
    this.tintTrack = { r: new HE.Track(0), g: new HE.Track(0), b: new HE.Track(0), a: new HE.Track(0) };
    this.bright = new HE.Track(1);
    this.vign = new HE.Track(0.35);
    this.bloom = new HE.Track(0);
    this.gradeA = new HE.Track(0);
    this.grade = { shadow: [40, 40, 70], high: [255, 240, 210] };
    this.sunTrack = new HE.Track(0);
    this.depthTrack = new HE.Track(0);
    this._transition = 0;   // 转场遮罩 0..1
    this._transColor = '#000';
    this._transMode = 'fade';  // 'fade' | 'dissolve' | 'signal'（信号干扰/频谱）
    // 视差与减速控制
    this.setParallax = function (x, y) { this._pxTarget = x; this._pyTarget = y; };
    this.setDim = function (v, k) { this.dimTrack.set(v, k); };
    this.setSlowmo = function (v, k) { this.slowmo.set(v, k); };
    this.setTransMode = function (m) { this._transMode = m || 'fade'; };
  }

  Stage.prototype.addActor = function (name, kind) {
    const a = new HE.Actor(kind); this.actors[name] = a; return a;
  };
  Stage.prototype.clearActors = function () { this.actors = {}; };

  Stage.prototype.setScene = function (name) { this.scene = name; };

  Stage.prototype.update = function (dt) {
    // 关键停顿帧：用 slowmo 缩放"世界时间"（UI/控制仍走真实 dt）
    const sm = this.slowmo.update(dt);
    const wdt = dt * sm;
    this.t += wdt;
    this.env.t = this.t;
    this.cam.update(wdt);
    this.env.sun = this.sunTrack.update(dt);
    this.env.depth = this.depthTrack.update(dt);
    for (const k in this.actors) this.actors[k].update(wdt);
    this.particles.update(wdt);
    this.fg.update(wdt);

    // 视差偏移（平滑跟随指针/设备方向；reduced-motion 时归零）
    if (HE._reducedMotion) { this._pxTarget = 0; this._pyTarget = 0; }
    this.pxTrack.set(this._pxTarget, 3); this.pyTrack.set(this._pyTarget, 3);
    this.env.px = this.pxTrack.update(dt);
    this.env.py = this.pyTrack.update(dt);

    // 对话框出现时自动压暗背景（除非脚本已显式设过更高的 dim 目标）
    if (this._autoDim !== false) this.dimTrack.set(this.ui && this.ui.box ? 0.32 : 0, 4);
    this.env.dim = this.dimTrack.update(dt);

    // 灯光后期
    const fx = this.d.fx;
    const a = this.tintTrack.a.update(dt);
    fx.tint = [this.tintTrack.r.update(dt), this.tintTrack.g.update(dt), this.tintTrack.b.update(dt)];
    fx.tintA = a;
    fx.brightness = this.bright.update(dt);
    fx.vignette = this.vign.update(dt);
    fx.bloom = this.bloom.update(dt);
    fx.grade = { shadow: this.grade.shadow, high: this.grade.high, a: this.gradeA.update(dt) };
    this.ui.update(dt);
  };

  Stage.prototype.render = function () {
    const ctx = this.ctx;
    this.d.clear('#000');
    this.cam.apply(ctx);
    // 背景场景
    HE.Scenes[this.scene](ctx, this.env);
    // 背景粒子（在角色后）
    this.particles.draw(ctx);
    // 角色（按 y 排序）
    const arr = Object.values(this.actors).filter((a) => a.visible !== false).sort((a, b) => a.y - b.y);
    for (const a of arr) a.draw(ctx, this.t);
    // 前景粒子
    this.fg.draw(ctx);
    this.cam.restore(ctx);

    // 对话框压暗（屏幕空间，位于 UI 之下——让角色/场景仍可辨识）
    if (this.env.dim > 0.01) {
      ctx.globalAlpha = this.env.dim;
      ctx.fillStyle = '#04050c';
      ctx.fillRect(0, 0, HE.IW, HE.IH);
      ctx.globalAlpha = 1;
    }

    // 转场（屏幕空间）：fade / dissolve(像素溶解) / signal(信号干扰+频谱)
    if (this._transition > 0.001) this._drawTransition(ctx);

    // UI（屏幕空间）
    this.ui.draw();
  };

  // 转场绘制
  Stage.prototype._drawTransition = function (ctx) {
    const p = this._transition, W = HE.IW, H = HE.IH;
    const mode = HE._reducedMotion ? 'fade' : this._transMode;
    if (mode === 'dissolve') {
      // 像素溶解：按有序抖动阈值逐格填充，边缘带扫描亮线
      ctx.fillStyle = this._transColor;
      const cell = 4, cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
      for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
        // 确定性伪随机阈值（棋盘 + 斜向推进）
        const thr = ((gx * 7 + gy * 13) % 16) / 16 * 0.7 + (gy / rows) * 0.3;
        if (thr < p) { ctx.fillRect(gx * cell, gy * cell, cell, cell); }
        else if (thr < p + 0.06) { ctx.globalAlpha = 0.5; ctx.fillRect(gx * cell, gy * cell, cell, cell); ctx.globalAlpha = 1; }
      }
    } else if (mode === 'signal') {
      // 信号干扰：底色 + 水平错位噪条 + 底部频谱线（监听系统母题）
      ctx.globalAlpha = Math.min(1, p * 1.1);
      ctx.fillStyle = this._transColor; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      const t = this.t;
      // 错位横向扫描噪条
      const bands = 10;
      for (let i = 0; i < bands; i++) {
        const yy = ((i / bands) * H + (t * 40) % H) % H;
        const jig = Math.sin(t * 30 + i * 2.3) * 6 * p;
        ctx.globalAlpha = 0.10 + 0.16 * p;
        ctx.fillStyle = i % 2 ? '#9fd0ff' : '#ff8a6a';
        ctx.fillRect(jig, yy, W, 1.5);
      }
      // 底部频谱（像监听终端的实时波形）
      ctx.globalAlpha = 0.5 * Math.min(1, p * 1.5);
      ctx.strokeStyle = '#7fffc8'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0; x <= W; x += 3) {
        const y = H - 14 + Math.sin(x * 0.25 + t * 6) * 6 * Math.sin(x * 0.03 + t * 2) + Math.sin(x * 0.9 + t * 12) * 2;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      // 纯色淡入淡出
      ctx.globalAlpha = p;
      ctx.fillStyle = this._transColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  };

  // 便捷灯光设置
  Stage.prototype.setTint = function (rgb, a, k) {
    if (rgb) { this.tintTrack.r.set(rgb[0], k); this.tintTrack.g.set(rgb[1], k); this.tintTrack.b.set(rgb[2], k); }
    this.tintTrack.a.set(a, k);
  };
  Stage.prototype.setGrade = function (shadow, high, a, k) {
    if (shadow) this.grade.shadow = shadow;
    if (high) this.grade.high = high;
    this.gradeA.set(a, k);
  };
  HE.Stage = Stage;

  /* ---------- 协程脚本运行器 ----------
   * 用 generator 写演出脚本：yield 一个"指令对象"，运行器解释它。
   * 指令： {wait:秒} | {waitBox:true} | {waitKey:true} | {fn:()=>{}} | {tween:{...}}
   */
  function Runner(stage) {
    this.stage = stage;
    this.gen = null;
    this.waiting = null;   // {type, ...}
    this.tween = null;
    this.done = false;
    this.skip = false;     // 快进整个演出
    this.advance = false;  // 用户按键推进
  }
  Runner.prototype.run = function (genFn) {
    this.gen = genFn(this.stage, this);
    this.done = false;
    this._next();
  };
  Runner.prototype._next = function (val) {
    if (this.done) return;
    const r = this.gen.next(val);
    if (r.done) { this.done = true; this.waiting = null; return; }
    const cmd = r.value || {};
    if (cmd.tween) { this._startTween(cmd.tween); this.waiting = { type: 'tween' }; }
    else if (cmd.wait != null) { this.waiting = { type: 'time', t: 0, dur: cmd.wait }; }
    else if (cmd.waitBox) { this.waiting = { type: 'box' }; }
    else if (cmd.waitKey) { this.waiting = { type: 'key' }; }
    else if (cmd.fn) { cmd.fn(); this._next(); }
    else { this._next(); }
  };
  Runner.prototype._startTween = function (tw) {
    // tw: {dur, ease, on:(p)=>{}, from, to} 简化：on(p)
    this.tween = { t: 0, dur: tw.dur, ease: tw.ease || easeInOut, on: tw.on, then: tw.then };
  };
  Runner.prototype.pressAdvance = function () { this.advance = true; };
  Runner.prototype.update = function (dt) {
    if (this.done || !this.waiting) return;
    // 快进：缩短等待
    const speed = this.skip ? 8 : 1;
    dt *= speed;
    const w = this.waiting;
    if (w.type === 'time') {
      w.t += dt;
      if (this.advance && w.dur > 0.4) w.t = w.dur; // 允许跳过长等待
      if (w.t >= w.dur) { this.advance = false; this._next(); }
    } else if (w.type === 'tween') {
      const tw = this.tween;
      tw.t += dt;
      const p = clamp(tw.t / tw.dur, 0, 1);
      tw.on(tw.ease(p));
      if (p >= 1) { this.tween = null; if (tw.then) tw.then(); this._next(); }
    } else if (w.type === 'box') {
      if (this.stage.ui.boxDone()) {
        // 打字完成后，等用户推进或自动停留
        if (this.advance) { this.advance = false; this.stage.sfx && this.stage.sfx.page(); this._next(); }
      } else if (this.advance) {
        // 立即显示全部
        if (this.stage.ui.box) { this.stage.ui.box.shown = this.stage.ui.box.text.length; this.stage.ui.box.done = true; }
        this.advance = false;
      }
    } else if (w.type === 'key') {
      if (this.advance) { this.advance = false; this._next(); }
    }
  };
  HE.Runner = Runner;
})(window);
