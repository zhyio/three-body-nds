/* =====================================================================
 *  ui.js —— NDS 风格叙事 UI：对话框、逐字打字、字幕、标题卡、黑边、章节title
 *  文字与对话框绘制在高分辨率叠层（display.beginUI），保持清晰精致；
 *  黑边等"画面构图"元素仍绘制在像素缓冲上。
 * ===================================================================== */
(function (global) {
  'use strict';
  const HE = global.HE;
  const G = HE.G;
  const { clamp, lerp, easeOut, easeInOut } = HE.math;

  // 字体栈：正文用清秀无衬线（中文优先 PingFang/雅黑），标题略带间距
  const F_BODY = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  const F_TITLE = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';

  function UI(display, audio, sfx) {
    this.d = display; this.A = audio; this.sfx = sfx;
    this.ctx = display.ctx;         // 像素缓冲（仅黑边）

    this.box = null;
    this.subtitle = null;
    this.titleCard = null;
    this.chapter = null;
    this.roll = null;
    this.letterbox = 0;
    this.charDelay = 0.048;
    this._blink = 0;
    this.log = [];          // 对白记录（{speaker,text,color}）
    this.fast = false;      // 快进：更快打字 + 弱化打字音
    this.hud = null;        // 幕进度 {actIndex, actTotal, actName}
    this.logOpen = false;   // 记录面板开关
    this._logScroll = 0;    // 记录面板滚动位置
    this._logMax = 0;       // 记录面板最大滚动量
    this.autoPlay = false;  // 自动播放
    this.paused = false;    // 暂停
  }

  // 暂停/自动/快进状态由 main 设置
  UI.prototype.setPaused = function (p) { this.paused = !!p; };
  UI.prototype.setAuto = function (p) { this.autoPlay = !!p; };
  UI.prototype.setFast = function (p) { this.fast = !!p; };

  UI.prototype.say = function (speaker, text, color, portrait) {
    this.box = { speaker, text, color: color || '#c2ede4', shown: 0, done: false, t: 0, portrait: portrait || null, appear: 0 };
    // 记入对白记录（旁白与角色台词都记，去掉纯空文本）
    if (text && text.trim()) this.log.push({ speaker: speaker || '', text, color: color || '#c2ede4' });
  };
  UI.prototype.clearBox = function () { this.box = null; };
  UI.prototype.setSubtitle = function (text) { this.subtitle = text ? { text, a: 0, target: 1 } : (this.subtitle && (this.subtitle.target = 0), this.subtitle); };
  UI.prototype.hideSubtitle = function () { if (this.subtitle) this.subtitle.target = 0; };
  UI.prototype.showTitle = function (main, sub) { this.titleCard = { main, sub, a: 0, target: 1, t: 0 }; };
  UI.prototype.hideTitle = function () { if (this.titleCard) this.titleCard.target = 0; };
  UI.prototype.showChapter = function (no, name) { this.chapter = { no, name, a: 0, target: 1, t: 0 }; };
  UI.prototype.hideChapter = function () { if (this.chapter) this.chapter.target = 0; };
  // 片尾滚动字幕：lines 为 {t:'文本', s:'kind'} 数组；s 可为 'q'(引言) 'h'(大标题) 'r'(职员) 'g'(小字)
  UI.prototype.showRoll = function (lines, speed) { this.roll = { lines, y: HE.IH + 6, speed: speed || 12, a: 0, done: false }; };
  UI.prototype.rollDone = function () { return this.roll && this.roll.done; };
  UI.prototype.hideRoll = function () { this.roll = null; };
  UI.prototype.boxDone = function () { return this.box && this.box.done; };

  UI.prototype.update = function (dt) {
    this._blink += dt;
    if (this.box) {
      this.box.appear = Math.min(1, this.box.appear + dt * 6);
      if (!this.box.done) {
        this.box.t += dt;
        const total = this.box.text.length;
        const delay = this.fast ? this.charDelay * 0.35 : this.charDelay;
        const target = Math.floor(this.box.t / delay);
        if (target > this.box.shown) {
          const ch = this.box.text[this.box.shown];
          this.box.shown = Math.min(total, target);
          if (ch && ch.trim() && this.sfx && !this.fast && (this.box.shown % 2 === 0)) this.sfx.blip(false);
        }
        if (this.box.shown >= total) this.box.done = true;
      }
    }
    if (this.subtitle) {
      this.subtitle.a += ((this.subtitle.target) - this.subtitle.a) * (1 - Math.exp(-6 * dt));
      if (this.subtitle.target === 0 && this.subtitle.a < 0.02) this.subtitle = null;
    }
    if (this.titleCard) {
      this.titleCard.t += dt;
      this.titleCard.a += ((this.titleCard.target) - this.titleCard.a) * (1 - Math.exp(-4 * dt));
      if (this.titleCard.target === 0 && this.titleCard.a < 0.02) this.titleCard = null;
    }
    if (this.chapter) {
      this.chapter.t += dt;
      this.chapter.a += ((this.chapter.target) - this.chapter.a) * (1 - Math.exp(-5 * dt));
      if (this.chapter.target === 0 && this.chapter.a < 0.02) this.chapter = null;
    }
    if (this.roll) {
      this.roll.a = Math.min(1, this.roll.a + dt * 0.6);
      this.roll.y -= this.roll.speed * dt;
      // 全部滚出顶部后标记完成
      if (this.roll.y + this._rollHeight(this.roll) < -6) this.roll.done = true;
    }
  };

  UI.prototype._rollHeight = function (roll) {
    let h = 0;
    for (const ln of roll.lines) h += (ln.gap != null ? ln.gap : (ln.s === 'h' ? 22 : ln.s === 'q' ? 16 : 13));
    return h;
  };

  UI.prototype.setLetterbox = function (v) { this.letterbox = v; };

  UI.prototype.draw = function () {
    const W = HE.IW, H = HE.IH;

    // 黑边画在像素缓冲（构图元素）
    if (this.letterbox > 0) {
      const bh = Math.round(this.letterbox * 22);
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, W, bh);
      this.ctx.fillRect(0, H - bh, W, bh);
    }

    // 其余 UI 画在高分辨率叠层
    const ctx = this.d.beginUI();
    if (!ctx) return;
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';

    if (this.subtitle && this.subtitle.a > 0.02) this._drawSubtitle(ctx, W, H);
    if (this.box) this._drawBox(ctx, W, H);
    if (this.chapter && this.chapter.a > 0.02) this._drawChapter(ctx, W, H);
    if (this.titleCard && this.titleCard.a > 0.02) this._drawTitle(ctx, W, H);
    if (this.roll) this._drawRoll(ctx, W, H);
    // HUD：幕进度（左上，半透明；记录面板/片尾时隐藏）
    if (this.hud && !this.logOpen && !this.roll) this._drawHud(ctx, W, H);
    if (this.autoPlay && !this.logOpen) this._drawAutoBadge(ctx, W, H);
    if (this.logOpen) this._drawLogPanel(ctx, W, H);
    if (this.paused && !this.logOpen) this._drawPauseOverlay(ctx, W, H);
  };

  // 由 main 设置的 HUD 数据：{actIndex, actTotal, actName}
  UI.prototype.setHud = function (o) { this.hud = o; };

  // ---------- 幕进度 HUD ----------
  UI.prototype._drawHud = function (ctx, W, H) {
    const h = this.hud;
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.font = `600 6.5px ${F_TITLE}`;
    ctx.textAlign = 'left';
    const label = `第 ${['一', '二', '三'][h.actIndex] || (h.actIndex + 1)} 幕 / 共 ${h.actTotal} 幕`;
    ctx.fillStyle = 'rgba(4,8,14,0.5)';
    this._roundRect(ctx, 4, 4, ctx.measureText(label).width + 10, 11, 2); ctx.fill();
    ctx.fillStyle = '#9fb0c8';
    ctx.fillText(label, 9, 12);
    // 三段进度点
    for (let i = 0; i < h.actTotal; i++) {
      ctx.fillStyle = i <= h.actIndex ? '#e08a6a' : 'rgba(160,176,200,0.35)';
      ctx.beginPath(); ctx.arc(11 + i * 6, 19, 1.6, 0, 7); ctx.fill();
    }
    ctx.restore();
  };

  UI.prototype._drawAutoBadge = function (ctx, W, H) {
    ctx.save();
    ctx.globalAlpha = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(this._blink * 3));
    ctx.font = `600 6px ${F_TITLE}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#7fd0b0';
    ctx.fillText('▶ 自动', W - 6, 12);
    ctx.restore();
  };

  // ---------- 暂停遮罩 ----------
  UI.prototype._drawPauseOverlay = function (ctx, W, H) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#04060c';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e8eef4';
    ctx.font = `700 13px ${F_TITLE}`;
    ctx.textAlign = 'center';
    ctx.fillText('暂 停', W / 2, H / 2 - 2);
    ctx.globalAlpha = 0.7;
    ctx.font = `400 6.5px ${F_BODY}`;
    ctx.fillStyle = '#9fb0c8';
    ctx.fillText('轻触继续 · 或按 P / 空格', W / 2, H / 2 + 12);
    ctx.restore();
  };

  // ---------- 对白记录面板 ----------
  UI.prototype.toggleLog = function () { this.logOpen = !this.logOpen; this._logScroll = 0; return this.logOpen; };
  UI.prototype.scrollLog = function (dy) { if (this.logOpen) this._logScroll = clamp(this._logScroll + dy, 0, this._logMax || 0); };
  UI.prototype._drawLogPanel = function (ctx, W, H) {
    ctx.save();
    ctx.fillStyle = 'rgba(4,6,12,0.92)';
    ctx.fillRect(0, 0, W, H);
    // 标题
    ctx.fillStyle = '#e8eef4';
    ctx.font = `700 9px ${F_TITLE}`;
    ctx.textAlign = 'left';
    ctx.fillText('对白记录', 10, 14);
    ctx.textAlign = 'right';
    ctx.globalAlpha = 0.6;
    ctx.font = `400 6px ${F_BODY}`;
    ctx.fillStyle = '#8fa0b8';
    ctx.fillText('轻触空白处 / 按 L 关闭', W - 8, 13);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(120,140,170,0.3)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(8, 18); ctx.lineTo(W - 8, 18); ctx.stroke();

    // 内容区裁剪
    const top = 22, bot = H - 6, lh = 12;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, top, W, bot - top); ctx.clip();
    let y = top + 4 - (this._logScroll || 0);
    ctx.textAlign = 'left';
    const log = this.log || [];
    for (const e of log) {
      // 说话人
      ctx.font = `700 6.5px ${F_TITLE}`;
      ctx.fillStyle = e.color || '#c8d4e0';
      const who = e.speaker ? e.speaker + '：' : '';
      const whoW = ctx.measureText(who).width;
      if (who) ctx.fillText(who, 10, y + 6);
      // 文本（换行）
      ctx.font = `400 6.5px ${F_BODY}`;
      ctx.fillStyle = '#d6dee8';
      const lines = this._wrapCount(ctx, e.text, W - 20 - whoW);
      let first = true;
      for (const ln of lines) {
        ctx.fillText(ln, first ? 10 + whoW : 10, y + 6);
        y += lh; first = false;
      }
      if (lines.length === 0) y += lh;
      y += 2;
    }
    this._logMax = Math.max(0, (y + (this._logScroll || 0)) - bot + 4);
    ctx.restore();

    // 滚动提示
    if ((this._logMax || 0) > 0) {
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#8fa0b8';
      ctx.font = `400 6px ${F_BODY}`; ctx.textAlign = 'center';
      ctx.fillText('▲▼ 滚动', W / 2, H - 2);
    }
    ctx.restore();
  };

  // 返回按 maxW 折行后的行数组（供记录面板用）
  UI.prototype._wrapCount = function (ctx, str, maxW) {
    const out = []; let line = '';
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '\n') { out.push(line); line = ''; continue; }
      const test = line + ch;
      if (ctx.measureText(test).width > maxW) { out.push(line); line = ch; }
      else line = test;
    }
    if (line) out.push(line);
    return out;
  };

  // ---------- 片尾滚动字幕 ----------
  UI.prototype._drawRoll = function (ctx, W, H) {
    const roll = this.roll;
    ctx.save();
    ctx.globalAlpha = clamp(roll.a, 0, 1);
    ctx.textAlign = 'center';
    let y = roll.y;
    for (const ln of roll.lines) {
      const gap = ln.gap != null ? ln.gap : (ln.s === 'h' ? 22 : ln.s === 'q' ? 16 : 13);
      // 只画进入可视区的行（顶/底各留 8px 淡出）
      if (y > -10 && y < H + 10) {
        let edge = 1;
        if (y < 24) edge = clamp(y / 24, 0, 1);
        else if (y > H - 16) edge = clamp((H - y) / 16, 0, 1);
        ctx.globalAlpha = clamp(roll.a, 0, 1) * edge;
        if (ln.s === 'h') {          // 大标题
          ctx.font = `700 13px ${F_TITLE}`;
          ctx.shadowColor = 'rgba(150,60,50,0.7)'; ctx.shadowBlur = 6;
          ctx.fillStyle = '#f2e8dc';
          ctx.fillText(ln.t, W / 2, y);
          ctx.shadowBlur = 0;
        } else if (ln.s === 'q') {   // 引言（斜体感，暖白）
          ctx.font = `italic 400 8px ${F_BODY}`;
          ctx.fillStyle = '#d8c4b0';
          ctx.fillText(ln.t, W / 2, y);
        } else if (ln.s === 'g') {   // 小字/致谢
          ctx.font = `400 6.5px ${F_BODY}`;
          ctx.fillStyle = '#8a94ac';
          ctx.fillText(ln.t, W / 2, y);
        } else {                      // 职员条目
          ctx.font = `400 8px ${F_BODY}`;
          ctx.fillStyle = '#c4d2dc';
          ctx.fillText(ln.t, W / 2, y);
        }
      }
      y += gap;
    }
    ctx.restore();
  };

  // ---------- 字幕（旁白） ----------
  // 对话框出现时，字幕上移到画面顶部（避免遮挡）；否则贴底居中。
  UI.prototype._drawSubtitle = function (ctx, W, H) {
    const a = clamp(this.subtitle.a, 0, 1);
    const boxUp = !!this.box;
    // 目标位置平滑过渡
    if (this._subY == null) this._subY = boxUp ? 16 : H - 18;
    const targetY = boxUp ? 16 : H - 18;
    this._subY += (targetY - this._subY) * 0.2;
    const y = this._subY;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `500 8px ${F_BODY}`;
    ctx.textAlign = 'center';
    const tw = ctx.measureText(this.subtitle.text).width;
    // 柔和底衬（胶囊形）
    const padX = 16, bgY = y - 9, bgH = 15, bgX = W / 2 - tw / 2 - padX, bgW = tw + padX * 2;
    const grd = ctx.createLinearGradient(bgX, 0, bgX + bgW, 0);
    grd.addColorStop(0, 'rgba(6,10,18,0)');
    grd.addColorStop(0.5, boxUp ? 'rgba(6,10,18,0.72)' : 'rgba(6,10,18,0.55)');
    grd.addColorStop(1, 'rgba(6,10,18,0)');
    ctx.fillStyle = grd;
    this._roundRect(ctx, bgX, bgY, bgW, bgH, bgH / 2); ctx.fill();
    // 顶部细分割线（仅上置时）：与画面呼应
    if (boxUp) {
      ctx.strokeStyle = 'rgba(160,200,220,0.25)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(W / 2 - tw / 2 - 6, y + 5); ctx.lineTo(W / 2 + tw / 2 + 6, y + 5); ctx.stroke();
    }
    // 文本+微光
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 3;
    ctx.fillStyle = '#eef4f8';
    ctx.fillText(this.subtitle.text, W / 2, y);
    ctx.restore();
  };

  // ---------- 对话框 ----------
  UI.prototype._drawBox = function (ctx, W, H) {
    const ap = easeOut(this.box.appear);
    const bw = W - 32, bh = 42;
    const bx = 16, by = H - 50 + (1 - ap) * 6;
    const col = this.box.color;
    ctx.save();
    ctx.globalAlpha = ap;

    // 投影
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    // 框体渐变
    const g = ctx.createLinearGradient(0, by, 0, by + bh);
    g.addColorStop(0, 'rgba(16,26,42,0.94)');
    g.addColorStop(1, 'rgba(9,15,26,0.96)');
    ctx.fillStyle = g;
    this._roundRect(ctx, bx, by, bw, bh, 4); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    // 双描边 + 角标
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = this._alpha(col, 0.85);
    this._roundRect(ctx, bx + 0.6, by + 0.6, bw - 1.2, bh - 1.2, 4); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    this._roundRect(ctx, bx + 2.4, by + 2.4, bw - 4.8, bh - 4.8, 3); ctx.stroke();
    this._corners(ctx, bx + 2.4, by + 2.4, bw - 4.8, bh - 4.8, 4, this._alpha(col, 0.9));

    // 名牌
    let textX = bx + 12;
    if (this.box.speaker) {
      ctx.font = `700 8px ${F_TITLE}`;
      const nameW = ctx.measureText(this.box.speaker).width;
      const chip = 12, pad = 8, tagW = nameW + pad * 2 + (this.box.portrait ? chip + 4 : 0);
      const tx = bx + 8, ty = by - 8;
      // 名牌底
      const ng = ctx.createLinearGradient(tx, 0, tx + tagW, 0);
      ng.addColorStop(0, this._alpha(col, 0.95));
      ng.addColorStop(1, this._alpha(col, 0.75));
      ctx.fillStyle = ng;
      this._roundRect(ctx, tx, ty, tagW, 13, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 0.6;
      this._roundRect(ctx, tx + 0.5, ty + 0.5, tagW - 1, 12, 3); ctx.stroke();
      // 头像点缀（小圆）
      let nmeX = tx + pad;
      if (this.box.portrait) {
        const cxp = tx + pad + chip / 2 - 2, cyp = ty + 6.5;
        ctx.fillStyle = 'rgba(10,16,26,0.6)';
        ctx.beginPath(); ctx.arc(cxp, cyp, chip / 2, 0, 7); ctx.fill();
        this._portrait(ctx, this.box.portrait, cxp, cyp, chip / 2 - 1);
        nmeX = tx + pad + chip;
      }
      ctx.fillStyle = '#0c1420';
      ctx.textAlign = 'left';
      ctx.fillText(this.box.speaker, nmeX, ty + 9.4);
    }

    // 正文（逐字，自动换行）
    const shown = this.box.text.slice(0, this.box.shown);
    ctx.fillStyle = '#eaf2f6';
    ctx.font = `400 8.4px ${F_BODY}`;
    ctx.textAlign = 'left';
    this._wrap(ctx, shown, bx + 11, by + 15, bw - 22, 11.5);

    // 继续箭头
    if (this.box.done) {
      const bob = Math.sin(this._blink * 5) * 1.2;
      const ax = bx + bw - 12, ay = by + bh - 8 + bob;
      ctx.globalAlpha = ap * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(this._blink * 5)));
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + 6, ay); ctx.lineTo(ax + 3, ay + 4); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };

  // ---------- 章节卡 ----------
  UI.prototype._drawChapter = function (ctx, W, H) {
    const a = clamp(this.chapter.a, 0, 1);
    const cy = H / 2;
    const sweep = easeInOut(clamp(this.chapter.t / 0.8, 0, 1)) * a;
    ctx.save();
    ctx.globalAlpha = a;
    // 暗带
    const g = ctx.createLinearGradient(0, cy - 30, 0, cy + 30);
    g.addColorStop(0, 'rgba(4,8,14,0)');
    g.addColorStop(0.5, 'rgba(4,8,14,0.82)');
    g.addColorStop(1, 'rgba(4,8,14,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, cy - 30, W, 60);
    // 装饰横线（从中心展开）
    const half = (W * 0.34) * sweep;
    ctx.strokeStyle = 'rgba(200,237,228,0.6)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(W / 2 - half, cy - 15); ctx.lineTo(W / 2 + half, cy - 15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2 - half, cy + 15); ctx.lineTo(W / 2 + half, cy + 15); ctx.stroke();
    // 中点菱形
    ctx.fillStyle = 'rgba(143,214,200,0.9)';
    [W / 2 - half, W / 2 + half].forEach((x) => { ctx.save(); ctx.translate(x, cy - 15); ctx.rotate(Math.PI / 4); ctx.fillRect(-1.3, -1.3, 2.6, 2.6); ctx.restore(); });
    // 文字
    ctx.textAlign = 'center';
    ctx.font = `600 7px ${F_TITLE}`;
    ctx.fillStyle = '#8fd6c8';
    ctx.save(); ctx.letterSpacing && (ctx.letterSpacing = '2px');
    ctx.fillText(this.chapter.no, W / 2, cy - 4);
    ctx.restore();
    ctx.font = `700 12px ${F_TITLE}`;
    ctx.shadowColor = 'rgba(60,120,140,0.8)'; ctx.shadowBlur = 6;
    ctx.fillStyle = '#f2f8fa';
    ctx.fillText(this.chapter.name, W / 2, cy + 9);
    ctx.restore();
  };

  // ---------- 标题卡（片头/尾） ----------
  UI.prototype._drawTitle = function (ctx, W, H) {
    const a = clamp(this.titleCard.a, 0, 1);
    const rise = (1 - easeOut(a)) * 4;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.globalAlpha = a;
    ctx.font = `700 17px ${F_TITLE}`;
    ctx.shadowColor = 'rgba(70,130,150,0.9)'; ctx.shadowBlur = 10;
    ctx.fillStyle = '#f5fafc';
    ctx.fillText(this.titleCard.main, W / 2, H / 2 - 6 + rise);
    ctx.shadowBlur = 0;
    if (this.titleCard.sub) {
      ctx.globalAlpha = a * 0.9;
      ctx.font = `400 7px ${F_BODY}`;
      ctx.fillStyle = '#a8c8d2';
      ctx.fillText(this.titleCard.sub, W / 2, H / 2 + 12 + rise);
    }
    ctx.restore();
  };

  // ---------- 头像小像素画（画进小圆） ----------
  UI.prototype._portrait = function (ctx, kind, cx, cy, r) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.clip();
    let skin = '#f0dcc0', hair = '#5a4636', glasses = false, alien = false;
    if (kind === 'ye') { skin = '#e6c49a'; hair = '#1e1a18'; glasses = true; }        // 青年叶文洁
    else if (kind === 'yeOld') { skin = '#e4c8a4'; hair = '#b8b4b0'; }                  // 老年叶文洁
    else if (kind === 'lis' || kind === 'listener') { skin = '#8aa0b8'; hair = '#20303e'; alien = true; } // 三体监听员（青灰肤）
    else if (kind === 'guard') { skin = '#7a90a8'; hair = '#101820'; alien = true; }
    // 底色背光（外星人偏冷）
    ctx.fillStyle = alien ? '#0e1a24' : '#241c1a';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = skin; ctx.fillRect(cx - r, cy - r * 0.2, r * 2, r * 1.4);
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, 7); ctx.fill();
    // 头发/颅顶
    ctx.fillStyle = hair; ctx.fillRect(cx - r * 0.85, cy - r, r * 1.7, r * 0.7);
    if (!alien) { ctx.fillRect(cx - r * 0.85, cy - r * 0.5, r * 0.28, r * 0.7); ctx.fillRect(cx + r * 0.57, cy - r * 0.5, r * 0.28, r * 0.7); } // 鬓角
    // 眼
    ctx.fillStyle = alien ? '#bfe6ff' : '#2a2a30';
    ctx.fillRect(cx - r * 0.35, cy - r * 0.05, 1.2, alien ? 1 : 1.4);
    ctx.fillRect(cx + r * 0.15, cy - r * 0.05, 1.2, alien ? 1 : 1.4);
    // 眼镜（知识分子叶文洁）
    if (glasses) {
      ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 0.6;
      ctx.strokeRect(cx - r * 0.42, cy - r * 0.1, r * 0.42, r * 0.42);
      ctx.strokeRect(cx + r * 0.05, cy - r * 0.1, r * 0.42, r * 0.42);
      ctx.beginPath(); ctx.moveTo(cx - r * 0.0, cy + r * 0.08); ctx.lineTo(cx + r * 0.05, cy + r * 0.08); ctx.stroke();
    }
    ctx.restore();
  };

  // ---------- 工具 ----------
  UI.prototype._wrap = function (ctx, str, x, y, maxW, lineH) {
    let line = '', yy = y;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '\n') { ctx.fillText(line, x, yy); line = ''; yy += lineH; continue; }
      const test = line + ch;
      if (ctx.measureText(test).width > maxW) { ctx.fillText(line, x, yy); line = ch; yy += lineH; }
      else line = test;
    }
    if (line) ctx.fillText(line, x, yy);
  };

  UI.prototype._roundRect = function (ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // 四角短线装饰
  UI.prototype._corners = function (ctx, x, y, w, h, len, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 0.8;
    const c = [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]];
    for (const [px, py, sx, sy] of c) {
      ctx.beginPath();
      ctx.moveTo(px + sx * len, py); ctx.lineTo(px, py); ctx.lineTo(px, py + sy * len);
      ctx.stroke();
    }
  };

  UI.prototype._alpha = function (hex, a) {
    const c = HE.color.parse(hex);
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  };

  HE.UI = UI;
})(window);
