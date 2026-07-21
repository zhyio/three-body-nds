/* =====================================================================
 *  actors.js —— 《三体》像素角色（个性鲜明的简单模型）+ 粒子系统
 *  叶文洁(ye,红岸时期,军大衣) / 老年叶文洁(yeOld) /
 *  三体监听员(listener,孤独的和平主义者) / 三体士兵(guard) /
 *  脱水者(dryman,乱纪元卷成纤维的人形) / 大史式军人(soldier 备用)
 * ===================================================================== */
(function (global) {
  'use strict';
  const HE = global.HE;
  const G = HE.G;
  const { lerp, clamp } = HE.math;

  function shadow(ctx, x, y, w, a) {
    ctx.fillStyle = `rgba(0,0,0,${a || 0.25})`;
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function Actor(kind) {
    this.kind = kind;
    this.x = 160; this.y = 120;
    this.face = 1;
    this.scale = 1;
    this.breath = Math.random() * 6.28;
    this.armRaise = 0;
    this.headTilt = 0;
    this.walk = 0;
    this.walking = false;
    this.alpha = 1;
    this.emote = null;
    this.emoteT = 0;
  }
  Actor.prototype.setEmote = function (e, dur) { this.emote = e; this.emoteT = dur || 2; };
  Actor.prototype.update = function (dt) {
    this.breath += dt * 2;
    if (this.walking) this.walk += dt * 9; else this.walk *= Math.exp(-dt * 8);
    if (this.emoteT > 0) { this.emoteT -= dt; if (this.emoteT <= 0) this.emote = null; }
  };

  Actor.prototype.draw = function (ctx, t) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    const bob = Math.sin(this.breath) * 0.6 * this.scale;
    const wob = Math.sin(this.walk) * 2 * this.scale;
    shadow(ctx, this.x, this.y + 1, 9 * this.scale, 0.28 * this.alpha);
    ctx.translate(this.x, this.y + bob);
    ctx.scale(this.face * this.scale, this.scale);
    if (this.kind === 'ye') this._drawYe(ctx, wob, t);
    else if (this.kind === 'yeOld') this._drawYeOld(ctx, wob, t);
    else if (this.kind === 'listener') this._drawListener(ctx, wob, t);
    else if (this.kind === 'guard') this._drawGuard(ctx, wob, t);
    else if (this.kind === 'dryman') this._drawDryman(ctx, wob, t);
    ctx.scale(this.face, 1);
    this._drawEmote(ctx, t);
    ctx.restore();
  };

  /* ---------- 叶文洁（青年，红岸时期）：军绿大衣，齐耳短发，眼镜，沉静而破碎 ---------- */
  Actor.prototype._drawYe = function (ctx, wob, t) {
    const legK = Math.sin(this.walk);
    // 腿 + 军靴
    G.rect(ctx, -4, -8, 3, 8 + legK * 1.4, '#39402e');
    G.rect(ctx, -4, -8, 1, 8 + legK * 1.4, '#464e38');
    G.rect(ctx, 1, -8, 3, 8 - legK * 1.4, '#2e3426');
    G.rect(ctx, -4, -1 + legK * 1.4, 4, 2, '#181a12');
    G.rect(ctx, 1, -1 - legK * 1.4, 4, 2, '#121409');
    // 军大衣（挺括收腰 + 明暗 + 腰带）
    G.rect(ctx, -6, -24, 12, 17, '#4a5238');
    G.rect(ctx, -6, -24, 12, 3, '#5a6446');       // 肩高光
    G.rect(ctx, -6, -24, 2, 17, '#525a40');
    G.rect(ctx, 4, -24, 2, 17, '#3c4430');        // 侧阴影
    G.rect(ctx, -6, -10, 12, 3, '#3a4030');       // 下摆阴影
    G.rect(ctx, -6, -15, 12, 2, '#33381f');       // 腰带
    G.px(ctx, 0, -14, '#c8a24a');                 // 皮带扣
    G.vline(ctx, 0, -23, 15, '#3a4030');          // 门襟
    G.vline(ctx, -1, -23, 15, '#556046');         // 门襟高光
    G.px(ctx, 0, -21, '#6a6a3a'); G.px(ctx, 0, -18, '#6a6a3a'); // 铜扣
    // 大翻领
    G.rect(ctx, -6, -24, 3, 5, '#5a6446'); G.rect(ctx, 3, -24, 3, 5, '#3c4430');
    // 手臂
    const ar = this.armRaise;
    ctx.save();
    ctx.translate(5, -22);
    ctx.rotate(-ar * 1.3);
    G.rect(ctx, -1, 0, 3, 12 - ar * 2, '#464e38');
    G.rect(ctx, -1, 0, 1, 12 - ar * 2, '#525a40');
    G.rect(ctx, -1, 9 - ar * 2, 3, 1.5, '#33381f');
    if (ar > 0.4) G.disc(ctx, 0, 11 - ar * 2, 1.6, '#e6c49a');
    ctx.restore();
    G.rect(ctx, -6, -22, 3, 12, '#3c4430');
    // 脖 + 围巾
    G.rect(ctx, -2, -25, 4, 2, '#c8a882');
    G.rect(ctx, -3, -25, 6, 2, '#7a3238');        // 红围巾（一点暖色）
    // 头（沉静的脸，明暗）
    G.disc(ctx, 0, -28, 4.6, '#e6c49a');
    G.disc(ctx, -1, -28, 3.6, '#f0d2a8');
    G.px(ctx, 3, -27, '#d2ac80');                 // 下颌阴影
    // 齐耳短发（那个时代的知识女性）
    G.rect(ctx, -5, -33, 10, 5, '#1e1a18');
    G.rect(ctx, -5, -33, 10, 1, '#2e2824');       // 发顶高光
    G.rect(ctx, -6, -30, 2, 5, '#1e1a18');        // 左鬓
    G.rect(ctx, 4, -30, 2, 5, '#181410');         // 右鬓（阴影）
    G.px(ctx, -5, -25, '#1e1a18'); G.px(ctx, 5, -25, '#181410');
    // 眼镜（知识分子标志）
    G.rect(ctx, 0, -29, 5, 3, 'rgba(180,200,220,0.18)');
    ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 0.6;
    ctx.strokeRect(0.5, -28.5, 2, 2); ctx.strokeRect(3, -28.5, 2, 2);
    G.px(ctx, 2.5, -27, '#2a2a30');               // 镜梁
    // 眼（低垂，忧郁）
    G.px(ctx, 1, -28, '#2a2028'); G.px(ctx, 4, -28, '#2a2028');
    G.px(ctx, 3, -25, '#b5806a');                 // 抿唇
  };

  /* ---------- 老年叶文洁：华发，风衣，凝望夕阳的"人类的落日" ---------- */
  Actor.prototype._drawYeOld = function (ctx, wob, t) {
    G.rect(ctx, -4, -8, 3, 8, '#33343c');
    G.rect(ctx, 1, -8, 3, 8, '#2a2b32');
    G.rect(ctx, -4, -1, 4, 2, '#161620'); G.rect(ctx, 1, -1, 4, 2, '#111119');
    // 风衣
    G.rect(ctx, -6, -24, 12, 17, '#3e4450');
    G.rect(ctx, -6, -24, 12, 3, '#4e5460');
    G.rect(ctx, -6, -24, 2, 17, '#464c58');
    G.rect(ctx, 4, -24, 2, 17, '#343a46');
    G.rect(ctx, -6, -10, 12, 3, '#2e3440');
    G.vline(ctx, 0, -23, 15, '#2e3440');
    const ar = this.armRaise;
    ctx.save(); ctx.translate(5, -22); ctx.rotate(-ar * 1.2);
    G.rect(ctx, -1, 0, 3, 12 - ar * 2, '#3a4048');
    if (ar > 0.4) G.disc(ctx, 0, 11 - ar * 2, 1.6, '#e0c8a8');
    ctx.restore();
    G.rect(ctx, -6, -22, 3, 12, '#343a46');
    G.rect(ctx, -2, -25, 4, 2, '#d8bba0');
    // 头
    G.disc(ctx, 0, -28, 4.6, '#e4c8a4');
    G.disc(ctx, -1, -28, 3.6, '#eed4b0');
    // 华发（灰白，挽起）
    G.rect(ctx, -5, -33, 10, 5, '#b8b4b0');
    G.rect(ctx, -5, -33, 10, 1, '#d0ccc8');
    G.rect(ctx, -6, -30, 2, 4, '#a8a4a0');
    G.rect(ctx, 4, -30, 2, 4, '#989490');
    // 眼（苍老，望向远方）
    G.px(ctx, 1, -28, '#3a3038'); G.px(ctx, 4, -28, '#3a3038');
    G.px(ctx, 2, -25, '#9a7058');
    // 皱纹暗示
    G.px(ctx, 2, -26, '#cbab84');
  };

  /* ---------- 三体监听员 1379 号：孤独的和平主义者，简朴长袍，疲惫 ---------- */
  Actor.prototype._drawListener = function (ctx, wob, t) {
    // 长袍（垂坠）
    for (let i = 0; i < 9; i++) {
      const yy = -22 + i * 1.7;
      const half = 4 + i * 0.5;
      G.rect(ctx, -half, yy, half * 2, 2, HE.color.mix('#3a4652', '#2a333e', i / 9));
    }
    G.rect(ctx, -6, -8, 12, 2, '#222a34');        // 袍摆阴影
    // 袍身高光
    G.rect(ctx, -4, -22, 2, 14, '#4a5866');
    // 束带
    G.rect(ctx, -5, -15, 10, 1.5, '#5a4636');
    // 手臂（拢在袖中）
    const ar = this.armRaise;
    ctx.save(); ctx.translate(4, -20); ctx.rotate(-ar * 1.2);
    G.rect(ctx, -1, 0, 3, 11, '#333d48');
    if (ar > 0.4) G.disc(ctx, 0, 11, 1.6, '#bcd0d8');
    ctx.restore();
    G.rect(ctx, -5, -20, 3, 11, '#2c3540');
    // 头（三体人此处以拟人化呈现：偏冷肤色，深邃眼）
    G.rect(ctx, -2, -22, 4, 2, '#9cb0b8');
    G.disc(ctx, 0, -25, 4.4, '#aec2c8');
    G.disc(ctx, -1, -25, 3.4, '#c0d2d6');
    // 兜帽
    G.rect(ctx, -5, -30, 10, 5, '#2c3540');
    G.rect(ctx, -5, -30, 10, 1, '#3a4652');
    G.rect(ctx, -6, -27, 2, 5, '#28313c');
    G.rect(ctx, 4, -27, 2, 5, '#28313c');
    // 眼（大而忧郁，微光）
    G.px(ctx, 1, -25, '#1e2a30'); G.px(ctx, 1, -24, '#1e2a30');
    G.px(ctx, 3, -25, '#1e2a30'); G.px(ctx, 3, -24, '#1e2a30');
    G.px(ctx, 1, -25, '#7fb0c0');                 // 眼中微光（怜悯）
    G.px(ctx, 3, -22, '#8a9aa0');
  };

  /* ---------- 三体士兵/执政官：冷硬盔甲，肃杀 ---------- */
  Actor.prototype._drawGuard = function (ctx, wob, t) {
    const legK = Math.sin(this.walk);
    G.rect(ctx, -4, -8, 4, 8 + legK, '#2a2e36');
    G.rect(ctx, 1, -8, 4, 8 - legK, '#22262e');
    G.rect(ctx, -5, -1 + legK, 5, 2, '#14161c'); G.rect(ctx, 1, -1 - legK, 5, 2, '#0f1116');
    // 铠甲（板层 + 冷金属高光）
    G.rect(ctx, -7, -25, 14, 18, '#3c4450');
    G.rect(ctx, -7, -25, 14, 3, '#525c6a');
    G.rect(ctx, -7, -25, 2, 18, '#48505e');
    G.rect(ctx, 5, -25, 2, 18, '#2e3641');
    G.hline(ctx, -7, -19, 14, '#2a313b');         // 甲片接缝
    G.hline(ctx, -7, -14, 14, '#2a313b');
    G.hline(ctx, -7, -10, 14, '#2a313b');
    // 胸章（冷蓝能量核）
    const pl = 0.5 + 0.5 * Math.sin(t * 3);
    G.rect(ctx, -2, -21, 4, 4, '#101820');
    G.px(ctx, 0, -19, HE.color.mix('#2a4a6a', '#5aa0ff', pl));
    // 肩甲
    G.rect(ctx, -8, -25, 3, 4, '#586272'); G.rect(ctx, 5, -25, 3, 4, '#48505e');
    // 手臂 + 长械
    const ar = this.armRaise;
    ctx.save(); ctx.translate(6, -23); ctx.rotate(-ar * 1.1);
    G.rect(ctx, -1, 0, 3, 13, '#3a424e');
    ctx.restore();
    G.rect(ctx, -7, -23, 3, 13, '#333b46');
    G.vline(ctx, 8, -28, 22, '#4a5260');          // 长戟杆
    G.rect(ctx, 7, -30, 3, 4, '#6a7484');         // 戟刃
    // 头盔（面甲，只露冷光眼缝）
    G.disc(ctx, 0, -29, 5, '#48505e');
    G.disc(ctx, -1, -30, 3, '#5a6472');
    G.rect(ctx, -4, -29, 8, 2, '#101820');        // 眼缝
    ctx.globalAlpha = 0.5 + pl * 0.5; G.rect(ctx, -3, -29, 2, 1, '#5aa0ff'); G.rect(ctx, 1, -29, 2, 1, '#5aa0ff'); ctx.globalAlpha = 1;
    G.vline(ctx, 0, -35, 3, '#586272');           // 盔顶脊
  };

  /* ---------- 脱水者：乱纪元中脱水卷成的人形纤维（横陈或立起的干卷） ---------- */
  Actor.prototype._drawDryman = function (ctx, wob, t) {
    // 一卷脱水的人形——像干枯的画卷立着
    G.rect(ctx, -3, -22, 6, 22, '#8a6a4a');       // 主体
    G.rect(ctx, -3, -22, 2, 22, '#9a7a58');       // 高光
    G.rect(ctx, 1, -22, 2, 22, '#6a4e34');        // 阴影
    // 卷纹（脱水的褶皱）
    for (let i = 0; i < 7; i++) { G.hline(ctx, -3, -20 + i * 3, 6, '#5a4028'); }
    // 隐约的脸廓（顶端）
    G.disc(ctx, 0, -23, 3, '#9a7a58');
    G.px(ctx, -1, -23, '#4a3020'); G.px(ctx, 1, -23, '#4a3020'); // 凹陷的眼
    G.px(ctx, 0, -21, '#4a3020');
    // 底部微微展开
    G.rect(ctx, -4, -2, 8, 2, '#6a4e34');
  };

  Actor.prototype._drawEmote = function (ctx, t) {
    if (!this.emote) return;
    const y = -40 + Math.sin(t * 4) * 1.2;
    if (this.emote === 'joy') {
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + t * 2; G.px(ctx, Math.cos(a) * 5, y + Math.sin(a) * 5, '#ffe36e'); }
    } else if (this.emote === 'shock') {
      G.rect(ctx, -1, y - 4, 2, 5, '#ff6b6b'); G.px(ctx, -1, y + 3, '#ff6b6b'); G.px(ctx, 1, y + 3, '#ff6b6b');
    } else if (this.emote === 'sad' || this.emote === 'tear') {
      G.disc(ctx, 3, y + 2, 1.6, '#7fd0ff');
    } else if (this.emote === 'anger') {
      // 愤怒符号（十字青筋）
      G.rect(ctx, -3, y - 3, 2, 2, '#ff5a4a'); G.rect(ctx, 1, y - 3, 2, 2, '#ff5a4a');
      G.rect(ctx, -1, y - 4, 2, 1, '#ff5a4a'); G.rect(ctx, -1, y, 2, 1, '#ff5a4a');
    } else if (this.emote === 'note') {
      G.rect(ctx, 0, y - 4, 2, 6, '#c2ede4'); G.disc(ctx, 0, y + 2, 2, '#c2ede4');
    }
  };

  HE.Actor = Actor;

  /* ===================================================================
   *  粒子系统（复用：雪/火星/星尘/电波环/热浪）
   * =================================================================== */
  function Particles(max) { this.max = max || 120; this.p = []; }
  Particles.prototype.emit = function (o) {
    if (this.p.length > this.max) this.p.shift();
    this.p.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: 1, age: 0, size: 1, c: '#fff', g: 0, kind: 'dot', tw: Math.random() * 6.28 }, o));
  };
  Particles.prototype.update = function (dt) {
    for (let i = this.p.length - 1; i >= 0; i--) {
      const q = this.p[i];
      q.age += dt;
      q.vy += q.g * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.age >= q.life) this.p.splice(i, 1);
    }
  };
  Particles.prototype.draw = function (ctx) {
    for (const q of this.p) {
      const k = 1 - q.age / q.life;
      ctx.globalAlpha = clamp(k, 0, 1) * (q.a0 || 1);
      if (q.kind === 'star') {
        const tw = 0.5 + 0.5 * Math.sin(q.tw + q.age * 6);
        ctx.globalAlpha *= tw;
        G.px(ctx, q.x, q.y, q.c);
        if (q.size > 1) { G.px(ctx, q.x - 1, q.y, q.c); G.px(ctx, q.x + 1, q.y, q.c); G.px(ctx, q.x, q.y - 1, q.c); G.px(ctx, q.x, q.y + 1, q.c); }
      } else if (q.kind === 'ring') {
        HE.G.ring(ctx, q.x, q.y, (1 - k) * q.size, q.c);
      } else {
        if (q.size <= 1) G.px(ctx, q.x, q.y, q.c);
        else G.disc(ctx, q.x, q.y, q.size, q.c);
      }
    }
    ctx.globalAlpha = 1;
  };
  HE.Particles = Particles;
})(window);
