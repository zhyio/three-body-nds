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
    this.env = { t: 0, sun: 0, depth: 0 };
    this.t = 0;
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
  }

  Stage.prototype.addActor = function (name, kind) {
    const a = new HE.Actor(kind); this.actors[name] = a; return a;
  };
  Stage.prototype.clearActors = function () { this.actors = {}; };

  Stage.prototype.setScene = function (name) { this.scene = name; };

  Stage.prototype.update = function (dt) {
    this.t += dt;
    this.env.t = this.t;
    this.cam.update(dt);
    this.env.sun = this.sunTrack.update(dt);
    this.env.depth = this.depthTrack.update(dt);
    for (const k in this.actors) this.actors[k].update(dt);
    this.particles.update(dt);
    this.fg.update(dt);

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

    // 转场遮罩（屏幕空间）
    if (this._transition > 0.001) {
      ctx.globalAlpha = this._transition;
      ctx.fillStyle = this._transColor;
      ctx.fillRect(0, 0, HE.IW, HE.IH);
      ctx.globalAlpha = 1;
    }

    // UI（屏幕空间）
    this.ui.draw();
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
