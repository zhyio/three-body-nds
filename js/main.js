/* =====================================================================
 *  main.js —— 《三体》入口：装配、状态机、主循环、输入、控制栏、生命周期
 * ===================================================================== */
(function (global) {
  'use strict';
  const HE = global.HE;
  const E = HE.math;

  const State = { BOOT: 0, PLAYING: 1, END: 2 };
  const ACT_NAMES = ['红岸', '三体世界', '回答'];

  // 性能档位：high(全特效) / standard(降扫描线暗角) / eco(省电,30fps,关bloom)
  const TIERS = {
    high:     { fps: 60, scan: 1.0,  vignMul: 1.0, bloom: true,  grain: 1.0 },
    standard: { fps: 60, scan: 0.5,  vignMul: 0.7, bloom: true,  grain: 0.6 },
    eco:      { fps: 30, scan: 0.25, vignMul: 0.5, bloom: false, grain: 0.3 },
  };

  function Game() {
    this.canvas = document.getElementById('screen');
    this.uiCanvas = document.getElementById('ui');
    this.display = new HE.Display(this.canvas, this.uiCanvas);
    this.audio = new HE.Audio();
    this.seq = null; this.sfx = null;
    this.ui = null; this.stage = null; this.runner = null;
    this.state = State.BOOT;
    this.last = 0;
    this.acts = [];
    this.actIndex = 0;
    this.started = false;
    this._raf = null;

    // 交互状态
    this._lastAdvance = 0;       // 上次推进时间戳（防抖）
    this._advanceGap = 200;      // ms 防抖窗口
    this.paused = false;
    this.hidden = false;         // 页面是否在后台
    this.autoPlay = false;
    this._autoTimer = 0;
    this._acc = 0;               // 帧率节流累加器

    // 显示档位
    this.reducedMotion = global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.tierName = this._autoTier();
    this.tier = TIERS[this.tierName];
    this._fpsSamples = []; this._fpsCheckT = 0;
    this._srLen = 0;
  }

  // 依据设备粗判初始档位
  Game.prototype._autoTier = function () {
    const nav = global.navigator || {};
    const cores = nav.hardwareConcurrency || 4;
    const mem = nav.deviceMemory || 4;
    const mobile = /Mobi|Android|iPhone|iPad/i.test(nav.userAgent || '');
    if (this.reducedMotion) return 'eco';
    if (cores <= 4 || mem <= 3 || mobile) return 'standard';
    return 'high';
  };

  Game.prototype._applyTier = function () {
    // 把档位映射到 display 的后期强度上限
    this.display.tier = this.tier;
    this.display.reducedMotion = this.reducedMotion;
    HE._reducedMotion = this.reducedMotion;
  };

  // 视差驱动：指针（桌面）+ 设备方向（移动）→ 归一化到 (-1..1)，喂给 stage
  Game.prototype._bindParallax = function () {
    if (this.reducedMotion) return;
    const el = (this.canvas && this.canvas.parentElement) || window;
    const feed = (nx, ny) => { if (this.stage && this.stage.setParallax) this.stage.setParallax(nx, ny); };
    if (el.addEventListener) {
      el.addEventListener('pointermove', (e) => {
        const r = (el.getBoundingClientRect && el.getBoundingClientRect()) || { left: 0, top: 0, width: innerWidth, height: innerHeight };
        const nx = ((e.clientX - r.left) / (r.width || 1)) * 2 - 1;
        const ny = ((e.clientY - r.top) / (r.height || 1)) * 2 - 1;
        feed(Math.max(-1, Math.min(1, nx)), Math.max(-1, Math.min(1, ny)));
      });
      el.addEventListener('pointerleave', () => feed(0, 0));
    }
    if (window.addEventListener && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma == null) return;
        feed(Math.max(-1, Math.min(1, e.gamma / 30)), Math.max(-1, Math.min(1, ((e.beta || 0) - 45) / 30)));
      });
    }
  };

  Game.prototype.boot = function () {
    // 全局错误 -> 失败提示（避免只看到黑屏）
    window.addEventListener('error', (e) => this._showFail(e && e.message));
    window.addEventListener('unhandledrejection', (e) => this._showFail(e && e.reason && e.reason.message));
    this._applyTier();
    this._drawBootScreen();
    window.addEventListener('keydown', (e) => this._onKey(e));
    // 画面点击：仅在“屏幕区域”推进，控制栏按钮单独处理
    const screenArea = (this.canvas && this.canvas.parentElement) ||
      document.getElementById('screenWrap') || window;
    if (screenArea && screenArea.addEventListener) screenArea.addEventListener('pointerdown', (e) => this._onScreenPointer(e));
    this._buildControls();
    this._bindLifecycle();
    this._bindParallax();
    if (this.reducedMotion) this.tierName = 'eco', this.tier = TIERS.eco, this._applyTier();
  };

  /* ---------------- 生命周期：后台暂停 ---------------- */
  Game.prototype._bindLifecycle = function () {
    document.addEventListener('visibilitychange', () => {
      const hidden = document.hidden;
      this.hidden = hidden;
      if (hidden) {
        if (this.audio.suspendContext) this.audio.suspendContext();
      } else {
        this.last = performance.now();  // 防止 dt 跳变
        if (!this.paused && this.audio.resumeContext) this.audio.resumeContext();
      }
    });
  };

  /* ---------------- 启动画面 ---------------- */
  Game.prototype._drawBootScreen = function () {
    const d = this.display;
    const t = performance.now() / 1000;
    const ctx = d.ctx;
    HE.G.ditherV(ctx, 0, 0, 320, 180, '#05060f', '#0c1020', 12);
    if (!this._bootStars) {
      const r = HE.rng(31); this._bootStars = [];
      for (let i = 0; i < 60; i++) this._bootStars.push({ x: r() * 320, y: r() * 180, p: r() * 6.28, s: r() < 0.18 ? 2 : 1 });
    }
    for (const s of this._bootStars) {
      ctx.globalAlpha = 0.2 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.5 + s.p));
      HE.G.rect(ctx, s.x, s.y, s.s, s.s, '#bcd0ee');
    }
    ctx.globalAlpha = 1;
    const suns = [[136, 66, '#ffd24a', 0.5, 0], [160, 60, '#ff7a3a', 0.37, 2], [184, 70, '#ff5a4a', 0.63, 4]];
    for (const [bx, by, c, sp, ph] of suns) {
      const x = bx + Math.sin(t * sp + ph) * 10, y = by + Math.cos(t * sp * 0.8 + ph) * 4;
      ctx.globalAlpha = 0.35;
      HE.G.gradR(ctx, x, y, 18, 'rgba(255,180,90,0.5)', 'rgba(255,120,40,0)');
      ctx.globalAlpha = 1;
      HE.G.disc(ctx, x, y, 3.4, c);
      HE.G.disc(ctx, x - 1, y - 1, 1.6, '#ffe9a0');
    }
    const u = d.beginUI();
    if (u) {
      u.textAlign = 'center'; u.textBaseline = 'alphabetic';
      u.shadowColor = 'rgba(150,60,50,0.8)'; u.shadowBlur = 10;
      u.fillStyle = '#f0e2d4';
      u.font = '700 17px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
      u.fillText('三 体', 160, 116);
      u.shadowBlur = 0;
      u.globalAlpha = 0.85;
      u.fillStyle = '#c8a08a';
      u.font = '400 7px "PingFang SC","Microsoft YaHei",sans-serif';
      u.fillText('第 一 部 · 地球往事', 160, 130);
      u.globalAlpha = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2.5));
      u.fillStyle = '#8fa0c0';
      u.font = '400 7.5px "PingFang SC","Microsoft YaHei",sans-serif';
      u.fillText('轻触屏幕 / 按任意键  开始', 160, 149);
      u.globalAlpha = 0.7;
      u.fillStyle = '#5a6a86';
      u.font = '400 6.5px "PingFang SC","Microsoft YaHei",sans-serif';
      u.fillText('建议全屏 · 佩戴耳机', 160, 162);
      u.globalAlpha = 1;
    }
    d.present(1 / 60);
    if (!this.started) this._raf = requestAnimationFrame(() => this._drawBootScreen());
  };

  /* ---------------- 开场 ---------------- */
  Game.prototype._userStart = function () {
    if (this.started) return;
    this.started = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    this.audio.init();
    this.audio.resume();
    this.seq = new HE.Sequencer(this.audio);
    this.sfx = new HE.SFX(this.audio);
    this.ui = new HE.UI(this.display, this.audio, this.sfx);
    this.stage = new HE.Stage(this.display, this.audio, this.ui, this.sfx);
    this.stage.music = { play: (n) => this.seq.play(HE.SCORE[n]), stop: () => this.seq.stop() };
    this.runner = new HE.Runner(this.stage);
    this.acts = [HE.PLAY.act1, HE.PLAY.act2, HE.PLAY.act3];
    this.actIndex = 0;
    this.state = State.PLAYING;
    this._startAct();
    this.last = performance.now();
    this._showControls(true);
    this._loop();
  };

  Game.prototype._startAct = function () {
    const gen = this.acts[this.actIndex];
    this.runner.finished = false;
    this.runner.run(gen);
    this.ui.setHud({ actIndex: this.actIndex, actTotal: this.acts.length, actName: ACT_NAMES[this.actIndex] });
  };

  // 跳到指定幕（从头重播该幕）
  Game.prototype._gotoAct = function (i) {
    if (!this.started || i < 0 || i >= this.acts.length) return;
    this.seq.stop();
    this.stage.clearActors();
    this.stage.fg.p.length = 0; this.stage.particles.p.length = 0;
    this.stage._starRain = false; this.stage._waveOut = false;
    this.ui.clearBox(); this.ui.hideSubtitle(); this.ui.hideRoll();
    this.stage._transition = 0;
    this.actIndex = i;
    this.state = State.PLAYING;
    this._startAct();
  };

  /* ---------------- 输入 ---------------- */
  Game.prototype._onKey = function (e) {
    if (!this.started) { this._userStart(); return; }
    const k = e.key.toLowerCase();
    if (k === 'enter' || k === ' ' || k === 'z') { e.preventDefault(); this._advance(); }
    else if (k === 'f') this._toggleFullscreen();
    else if (k === 'm') this._toggleMute();
    else if (k === 'p') this._togglePause();
    else if (k === 'a') this._toggleAuto();
    else if (k === 'l') this._toggleLog();
    else if (k === 'r') this._gotoAct(this.actIndex);        // 重播当前幕
    else if (k === 'arrowright') this._nextAct();
    else if (k === 'arrowleft') this._gotoAct(this.actIndex - 1);
    else if (k === '1' || k === '2' || k === '3') this._gotoAct(+k - 1);
  };

  // 屏幕区域点击：推进对白（带防抖）；记录面板打开时点击关闭
  Game.prototype._onScreenPointer = function (e) {
    if (!this.started) { this._userStart(); return; }
    if (this.ui.logOpen) { this.ui.toggleLog(); return; }
    if (this.paused) { this._togglePause(); return; }
    this._advance();
  };

  Game.prototype._advance = function () {
    const now = performance.now();
    if (now - this._lastAdvance < this._advanceGap) return;  // 防抖
    this._lastAdvance = now;
    if (this.runner) this.runner.pressAdvance();
  };

  Game.prototype._nextAct = function () {
    if (this.actIndex < this.acts.length - 1) this._gotoAct(this.actIndex + 1);
  };

  Game.prototype._toggleFullscreen = function () {
    const el = document.documentElement;
    if (!document.fullscreenElement) { if (el.requestFullscreen) el.requestFullscreen(); }
    else if (document.exitFullscreen) document.exitFullscreen();
  };

  Game.prototype._toggleMute = function () {
    const m = this.audio.toggleMuted();
    this._setBtn('mute', m ? '🔇' : '🔊', m ? '取消静音' : '静音');
  };

  Game.prototype._togglePause = function () {
    this.paused = !this.paused;
    this.ui.setPaused(this.paused);
    if (this.paused) { if (this.audio.suspendContext) this.audio.suspendContext(); }
    else { this.last = performance.now(); if (!this.hidden && this.audio.resumeContext) this.audio.resumeContext(); }
    this._setBtn('pause', this.paused ? '▶' : '⏸', this.paused ? '继续' : '暂停');
  };

  Game.prototype._toggleAuto = function () {
    this.autoPlay = !this.autoPlay;
    this.ui.setAuto(this.autoPlay);
    this._autoTimer = 0;
    this._setBtn('auto', this.autoPlay ? '⏩' : '▶▶', this.autoPlay ? '自动:开' : '自动播放');
  };

  Game.prototype._toggleFast = function () {
    this.ui.fast = !this.ui.fast;
    this._setBtn('fast', this.ui.fast ? '»»' : '»', this.ui.fast ? '快进:开' : '快进');
  };

  Game.prototype._toggleLog = function () {
    const open = this.ui.toggleLog();
    this._setBtn('log', open ? '✕' : '☰', open ? '关闭记录' : '对白记录');
  };

  Game.prototype._cycleTier = function () {
    const order = ['high', 'standard', 'eco'];
    this.tierName = order[(order.indexOf(this.tierName) + 1) % 3];
    this.tier = TIERS[this.tierName];
    this._applyTier();
    const lbl = { high: '画质:高', standard: '画质:标准', eco: '画质:省电' }[this.tierName];
    this._setBtn('tier', this.tierName === 'high' ? '◆' : this.tierName === 'standard' ? '◈' : '◇', lbl);
  };

  /* ---------------- 控制栏（DOM 按钮，可触摸） ---------------- */
  Game.prototype._buildControls = function () {
    const bar = document.getElementById('controls');
    if (!bar || !bar.appendChild || typeof document.createElement !== 'function') return;
    // 无头环境：createElement 返回的 stub 没有 setAttribute，直接跳过
    const probe = document.createElement('button');
    if (!probe || typeof probe.setAttribute !== 'function') return;
    this._btns = {};
    const defs = [
      ['pause', '⏸', '暂停', () => this._togglePause()],
      ['auto', '▶▶', '自动播放', () => this._toggleAuto()],
      ['fast', '»', '快进', () => this._toggleFast()],
      ['log', '☰', '对白记录', () => this._toggleLog()],
      ['mute', '🔊', '静音', () => this._toggleMute()],
      ['tier', '◆', '画质', () => this._cycleTier()],
      ['full', '⛶', '全屏', () => this._toggleFullscreen()],
      ['replay', '↺', '重播本幕', () => this._gotoAct(this.actIndex)],
    ];
    for (const [id, icon, label, fn] of defs) {
      const b = document.createElement('button');
      b.className = 'ctl-btn';
      b.textContent = icon;
      b.setAttribute('aria-label', label);
      b.title = label + '（' + this._hint(id) + '）';
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); });  // 不触发屏幕推进
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      bar.appendChild(b);
      this._btns[id] = b;
    }
    // 自动隐藏：无操作 3.5s 后淡出（移动端）；hover/触摸唤出
    this._ctlHideT = 0;
    const wake = () => { bar.classList.remove('hidden'); this._ctlHideT = 0; };
    ['pointermove', 'pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, wake));
  };

  Game.prototype._hint = function (id) {
    return { pause: 'P', auto: 'A', fast: '—', log: 'L', mute: 'M', tier: '—', full: 'F', replay: 'R' }[id] || '';
  };
  Game.prototype._setBtn = function (id, icon, label) {
    const b = this._btns && this._btns[id];
    if (!b) return;
    b.textContent = icon;
    b.setAttribute('aria-label', label);
    b.title = label + '（' + this._hint(id) + '）';
  };
  Game.prototype._showControls = function (on) {
    const bar = document.getElementById('controls');
    if (bar) bar.style.display = on ? 'flex' : 'none';
  };

  // 失败提示：把异常显示出来，而不是只留黑屏
  Game.prototype._showFail = function (msg) {
    const el = document.getElementById('fail');
    const m = document.getElementById('failMsg');
    if (m && msg) m.textContent = String(msg);
    if (el) el.style.display = 'flex';
    if (this._raf) cancelAnimationFrame(this._raf);
  };

  // 无障碍：把最新对白同步到屏幕阅读器 live region
  Game.prototype._updateSrLog = function () {
    if (!this.ui) return;
    const n = this.ui.log.length;
    if (n === this._srLen) return;
    this._srLen = n;
    const el = document.getElementById('srLog');
    if (el && n > 0) {
      const e = this.ui.log[n - 1];
      el.textContent = (e.speaker ? e.speaker + '：' : '') + e.text;
    }
  };

  /* ---------------- 主循环 ---------------- */
  Game.prototype._loop = function () {
    requestAnimationFrame(() => this._loop());
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 后台或暂停：不渲染、不推进（音频已挂起）
    if (this.hidden) return;
    if (this.paused) { this.ui.update(0); this.stage.render(); this.display.present(0); return; }

    // 帧率节流（eco 档 30fps）
    const target = this.tier.fps;
    if (target < 60) {
      this._acc += dt;
      const step = 1 / target;
      if (this._acc < step) return;
      dt = this._acc; this._acc = 0;
      if (dt > 0.08) dt = 0.08;
    }

    // 自动播放：对白打完后停留一段时间自动推进
    if (this.autoPlay && this.state === State.PLAYING && this.runner.waiting &&
        this.runner.waiting.type === 'box' && this.ui.boxDone()) {
      this._autoTimer += dt;
      const dwell = this.ui.fast ? 0.7 : 1.8;
      if (this._autoTimer >= dwell) { this._autoTimer = 0; this.runner.pressAdvance(); }
    } else if (!this.ui.boxDone || !this.ui.boxDone()) {
      this._autoTimer = 0;
    }

    // 尾声星尘
    if (this.stage._starRain && Math.random() < (this.reducedMotion ? 0.2 : 0.5)) {
      this.stage.fg.emit({
        x: Math.random() * 320, y: -4,
        vx: (Math.random() - 0.5) * 4, vy: 8 + Math.random() * 12,
        life: 7, size: Math.random() < 0.2 ? 2 : 1,
        c: Math.random() < 0.3 ? '#bcd0ee' : '#ffffff', g: 0.8, a0: 0.85, kind: 'star',
      });
      if (Math.random() < 0.03 && this.sfx) this.sfx.star();
    }

    if (this.state === State.PLAYING) {
      this.runner.update(dt);
      this.stage.update(dt);
      this.stage.render();
      if (this.runner.done && !this.runner.finished) {
        this.actIndex++;
        if (this.actIndex < this.acts.length) this._startAct();
        else this.state = State.END;
      }
      if (this.runner.finished) this.state = State.END;
    } else if (this.state === State.END) {
      this.stage.update(dt);
      this.stage.render();
    }

    this.display.present(dt);
    this._sampleFps(now);
    this._updateSrLog();
  };

  // 自动降档：若 high/standard 持续掉帧则降一档
  Game.prototype._sampleFps = function (now) {
    if (this.reducedMotion) return;
    this._fpsSamples.push(now);
    while (this._fpsSamples.length && now - this._fpsSamples[0] > 1000) this._fpsSamples.shift();
    if (now - this._fpsCheckT < 3000) return;
    this._fpsCheckT = now;
    const fps = this._fpsSamples.length;
    if (fps > 0 && fps < 40 && this.tierName !== 'eco') {
      this._cycleTier();  // 掉档
    }
  };

  window.addEventListener('DOMContentLoaded', () => {
    const g = new Game();
    g.boot();
    global.__HE_GAME = g;
  });
})(window);
