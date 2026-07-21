/* =====================================================================
 *  main.js —— 《三体》入口：装配、状态机、主循环、输入、标题画面
 * ===================================================================== */
(function (global) {
  'use strict';
  const HE = global.HE;
  const E = HE.math;

  const State = { BOOT: 0, TITLE: 1, PLAYING: 2, END: 3 };

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
  }

  Game.prototype.boot = function () {
    this._drawBootScreen();
    window.addEventListener('keydown', (e) => this._onKey(e));
    window.addEventListener('pointerdown', () => {
      if (!this.started) this._userStart(); else this._advance();
    });
  };

  Game.prototype._drawBootScreen = function () {
    const d = this.display;
    const t = performance.now() / 1000;
    const ctx = d.ctx;
    // 深空背景 + 星点
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
    // 三颗太阳缓慢游移（三体母题）
    const suns = [[136, 66, '#ffd24a', 0.5, 0], [160, 60, '#ff7a3a', 0.37, 2], [184, 70, '#ff5a4a', 0.63, 4]];
    for (const [bx, by, c, sp, ph] of suns) {
      const x = bx + Math.sin(t * sp + ph) * 10, y = by + Math.cos(t * sp * 0.8 + ph) * 4;
      ctx.globalAlpha = 0.35;
      HE.G.gradR(ctx, x, y, 18, 'rgba(255,180,90,0.5)', 'rgba(255,120,40,0)');
      ctx.globalAlpha = 1;
      HE.G.disc(ctx, x, y, 3.4, c);
      HE.G.disc(ctx, x - 1, y - 1, 1.6, '#ffe9a0');
    }

    // 高清叠层文字
    const u = d.beginUI();
    if (u) {
      u.textAlign = 'center'; u.textBaseline = 'alphabetic';
      u.shadowColor = 'rgba(150,60,50,0.8)'; u.shadowBlur = 10;
      u.fillStyle = '#f0e2d4';
      u.font = '700 17px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
      u.fillText('三 体', 160, 118);
      u.shadowBlur = 0;
      u.globalAlpha = 0.85;
      u.fillStyle = '#c8a08a';
      u.font = '400 7px "PingFang SC","Microsoft YaHei",sans-serif';
      u.fillText('第 一 部 · 地球往事', 160, 132);
      u.globalAlpha = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2.5));
      u.fillStyle = '#8fa0c0';
      u.font = '400 7.5px "PingFang SC","Microsoft YaHei",sans-serif';
      u.fillText('轻触屏幕 / 按任意键  开始', 160, 150);
      u.globalAlpha = 0.7;
      u.fillStyle = '#5a6a86';
      u.font = '400 6.5px "PingFang SC","Microsoft YaHei",sans-serif';
      u.fillText('建议全屏 · 佩戴耳机', 160, 163);
      u.globalAlpha = 1;
    }
    d.present(1 / 60);
    if (!this.started) this._raf = requestAnimationFrame(() => this._drawBootScreen());
  };

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
    this._loop();
  };

  Game.prototype._startAct = function () {
    const gen = this.acts[this.actIndex];
    this.runner.finished = false;
    this.runner.run(gen);
  };

  Game.prototype._onKey = function (e) {
    if (!this.started) { this._userStart(); return; }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z') { e.preventDefault(); this._advance(); }
    else if (e.key === 'f' || e.key === 'F') { this._toggleFullscreen(); }
    else if (e.key === 'm' || e.key === 'M') { this.audio.muted = !this.audio.muted; }
    else if (e.key === 'r' || e.key === 'R') { location.reload(); }
  };

  Game.prototype._advance = function () { if (this.runner) this.runner.pressAdvance(); };

  Game.prototype._toggleFullscreen = function () {
    const el = document.documentElement;
    if (!document.fullscreenElement) { if (el.requestFullscreen) el.requestFullscreen(); }
    else if (document.exitFullscreen) document.exitFullscreen();
  };

  Game.prototype._loop = function () {
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;

    // 尾声：星尘缓缓飘落（宇宙的注视）
    if (this.stage && this.stage._starRain && Math.random() < 0.5) {
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
    requestAnimationFrame(() => this._loop());
  };

  window.addEventListener('DOMContentLoaded', () => {
    const g = new Game();
    g.boot();
    global.__HE_GAME = g;
  });
})(window);
