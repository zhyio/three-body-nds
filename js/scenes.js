/* =====================================================================
 *  scenes.js —— 《三体》场景美术
 *  红岸基地(雪山天线) / 红岸控制室 / 太阳(放大器) / 三体世界(三日凌空) / 宇宙深空
 *  每个场景暴露 draw(ctx, env)；env 含 t, sun(时段/能量 0..1), depth(混乱/乱纪元 0..1)
 * ===================================================================== */
(function (global) {
  'use strict';
  const HE = global.HE;
  const G = HE.G;
  const { lerp, clamp, smooth } = HE.math;

  const Scenes = {};

  // 确定性星场
  function makeStars(seed, n, w, h) {
    const r = HE.rng(seed); const arr = [];
    for (let i = 0; i < n; i++) arr.push({ x: r() * w, y: r() * h, s: r() < 0.15 ? 2 : 1, ph: r() * 6.28, c: r() < 0.12 ? '#bfd4ff' : (r() < 0.2 ? '#ffe6c8' : '#ffffff') });
    return arr;
  }

  /* ============ 红岸基地：雪山之巅的巨型抛物面天线（夜） ============ */
  const rcStars = makeStars(11, 80, 320, 110);
  Scenes.redcoast = function (ctx, env) {
    const t = env.t, dawn = env.sun || 0; // 0 深夜 -> 1 破晓
    // 天空：深夜墨蓝 -> 破晓青紫
    const top = HE.color.mix('#070b1e', '#2a2648', dawn);
    const mid = HE.color.mix('#0e1430', '#5a4668', dawn);
    const bot = HE.color.mix('#141a38', '#c88a72', dawn);
    G.ditherV(ctx, 0, 0, 320, 70, top, mid, 14);
    G.ditherV(ctx, 0, 64, 320, 40, mid, bot, 10);

    // 星空（破晓时渐隐）
    ctx.globalAlpha = 1 - dawn * 0.9;
    for (const s of rcStars) {
      const tw = 0.4 + 0.6 * Math.sin(t * 2 + s.ph);
      ctx.globalAlpha = (1 - dawn * 0.9) * tw;
      G.rect(ctx, s.x, s.y, s.s, s.s, s.c);
    }
    ctx.globalAlpha = 1;

    // 极光带（红岸的诡谲夜空）
    ctx.globalAlpha = 0.16 * (1 - dawn);
    for (let i = 0; i < 3; i++) {
      const yy = 26 + i * 10 + Math.sin(t * 0.4 + i) * 4;
      G.ditherV(ctx, 0, yy, 320, 14, 'rgba(60,200,150,0)', i % 2 ? '#3ad89a' : '#4a9ad8', 6);
    }
    ctx.globalAlpha = 1;

    // 远山雪脊（两层）
    const far = HE.color.mix('#20263f', '#6a5a70', dawn);
    ctx.fillStyle = far; ctx.beginPath(); ctx.moveTo(0, 96);
    for (let x = 0; x <= 320; x += 8) ctx.lineTo(x, 84 + Math.sin(x * 0.02 + 1) * 8 + Math.sin(x * 0.06) * 4);
    ctx.lineTo(320, 130); ctx.lineTo(0, 130); ctx.fill();
    // 远山积雪高光
    ctx.globalAlpha = 0.5;
    for (let x = 0; x <= 320; x += 3) { const y = 84 + Math.sin(x * 0.02 + 1) * 8 + Math.sin(x * 0.06) * 4; G.px(ctx, x, y, HE.color.mix('#8090b0', '#f0d0c0', dawn)); }
    ctx.globalAlpha = 1;

    // 近山（基地所在，深色）+ 雪地
    ctx.fillStyle = HE.color.mix('#141830', '#2a2438', dawn); ctx.beginPath(); ctx.moveTo(0, 112);
    for (let x = 0; x <= 320; x += 10) ctx.lineTo(x, 106 + Math.sin(x * 0.03 + 4) * 5);
    ctx.lineTo(320, 180); ctx.lineTo(0, 180); ctx.fill();
    // 雪地渐变（近处积雪更亮，与夜色拉开对比）
    G.ditherV(ctx, 0, 120, 320, 60, HE.color.mix('#546082', '#8a84a0', dawn), HE.color.mix('#252c46', '#403a58', dawn), 10);
    // 天线基座周围的月光反照高光
    ctx.globalAlpha = 0.5;
    for (let x = 0; x < 320; x += 2) { const tw = 0.5 + 0.5 * Math.sin(x * 0.3); ctx.globalAlpha = 0.12 + 0.1 * tw; G.px(ctx, x, 121 + (x % 3), HE.color.mix('#8898c0', '#f0e0d0', dawn)); }
    ctx.globalAlpha = 1;
    // 雪地上稀疏脚印/岩石
    const rr = HE.rng(77);
    for (let i = 0; i < 24; i++) { const x = rr() * 320, y = 128 + rr() * 48; ctx.globalAlpha = 0.4; G.px(ctx, x, y, '#121a1a'); }
    ctx.globalAlpha = 1;

    // === 巨型抛物面天线（红岸标志） ===
    const bx = 210, by = 116;
    // 支撑塔架
    ctx.fillStyle = '#2a2e3c';
    G.rect(ctx, bx - 3, by - 4, 6, 40, '#2a2e3c');
    for (let i = 0; i < 5; i++) { G.line(ctx, bx - 3, by + i * 8, bx + 3, by + 4 + i * 8, '#20242e'); G.line(ctx, bx + 3, by + i * 8, bx - 3, by + 4 + i * 8, '#20242e'); }
    // 抛物面（大碟，微微仰向天空）
    ctx.save();
    ctx.translate(bx, by - 6);
    ctx.rotate(-0.35);
    // 碟盘（椭圆多层）
    for (let i = 6; i >= 0; i--) {
      const rw = 34 - i * 1.5, rh = 13 - i * 0.6;
      ctx.fillStyle = ['#4a5266', '#5a6278', '#6a7288', '#565e72', '#464e60', '#3a4152', '#2e3442'][i];
      ctx.beginPath(); ctx.ellipse(0, 0, rw, rh, 0, 0, 6.2832); ctx.fill();
    }
    // 碟面辐条
    ctx.strokeStyle = 'rgba(30,34,44,0.7)'; ctx.lineWidth = 0.7;
    for (let a = 0; a < 6; a++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 32, Math.sin(a) * 12); ctx.stroke(); }
    // 馈源臂 + 馈源
    ctx.strokeStyle = '#20242e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -16); ctx.stroke();
    G.disc(ctx, 0, -16, 2.5, '#6a7288');
    // 发射时馈源亮起（能量脉冲）
    const em = clamp((env.sun || 0), 0, 1);
    if (env.beam) {
      const pl = 0.5 + 0.5 * Math.sin(t * 8);
      ctx.globalAlpha = pl; G.disc(ctx, 0, -16, 3.5, '#ff5a4a'); ctx.globalAlpha = 1;
    }
    ctx.restore();
    // 塔基警示灯
    const bl = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.globalAlpha = bl; G.px(ctx, bx, by + 34, '#ff4a4a'); ctx.globalAlpha = 1;

    // 发射波束（指向天顶的红色电波，仅 env.beam 时）
    if (env.beam) {
      ctx.save();
      ctx.translate(bx, by - 22);
      ctx.rotate(-0.35);
      for (let i = 0; i < 5; i++) {
        const yy = -10 - i * 8 - (t * 40 % 8);
        ctx.globalAlpha = (0.5 - i * 0.08) * (0.6 + 0.4 * Math.sin(t * 6 - i));
        G.ring(ctx, 0, yy, 4 + i * 2, '#ff6a5a', 1);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // 基地小屋（左下，暖灯）
    G.rect(ctx, 30, 128, 34, 20, '#232838');
    G.rect(ctx, 30, 126, 34, 3, '#333a4e');
    G.rect(ctx, 30, 124, 16, 3, '#2a3040');   // 屋顶偏
    for (let i = 0; i < 3; i++) { const lit = (i !== 1) || (Math.sin(t * 2) > -0.5); ctx.globalAlpha = lit ? 1 : 0.3; G.rect(ctx, 36 + i * 9, 133, 4, 4, '#ffd27a'); }
    ctx.globalAlpha = 1;
  };

  /* ============ 红岸控制室（室内，冷光仪表） ============ */
  Scenes.control = function (ctx, env) {
    const t = env.t;
    // 墙面
    G.ditherV(ctx, 0, 0, 320, 180, '#141a26', '#0c1018', 12);
    // 后墙巨型示波/星图屏
    G.rect(ctx, 20, 16, 130, 74, '#0a1420');
    G.rect(ctx, 20, 16, 130, 74, '#0a1420');
    ctx.strokeStyle = '#2a3a4a'; ctx.lineWidth = 1; ctx.strokeRect(20, 16, 130, 74);
    // 屏上的太阳频谱波形（缓动正弦）
    ctx.strokeStyle = '#3ad89a'; ctx.lineWidth = 0.8; ctx.beginPath();
    for (let x = 0; x <= 130; x += 2) {
      const y = 53 + Math.sin(x * 0.15 + t * 2) * 8 * Math.sin(x * 0.03 + t) + (Math.sin(x * 0.7 + t * 5) * 2);
      x === 0 ? ctx.moveTo(22 + x, y) : ctx.lineTo(22 + x, y);
    }
    ctx.stroke();
    // 屏上网格
    ctx.strokeStyle = 'rgba(60,120,90,0.18)'; ctx.lineWidth = 0.5;
    for (let gx = 20; gx <= 150; gx += 14) { ctx.beginPath(); ctx.moveTo(gx, 16); ctx.lineTo(gx, 90); ctx.stroke(); }
    for (let gy = 16; gy <= 90; gy += 14) { ctx.beginPath(); ctx.moveTo(20, gy); ctx.lineTo(150, gy); ctx.stroke(); }

    // 右侧机柜阵列（闪烁指示灯）
    for (let c = 0; c < 3; c++) {
      const cx = 172 + c * 46;
      G.rect(ctx, cx, 20, 40, 92, '#1c2230');
      G.rect(ctx, cx, 20, 40, 3, '#28303f');
      for (let r0 = 0; r0 < 7; r0++) for (let cc = 0; cc < 4; cc++) {
        const bl = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * (3 + cc) + r0 * 1.3 + c));
        ctx.globalAlpha = bl;
        G.rect(ctx, cx + 5 + cc * 8, 28 + r0 * 11, 3, 3, ['#7fffa0', '#7fd0ff', '#ffd27a', '#ff8a7a'][(r0 + cc + c) % 4]);
      }
      ctx.globalAlpha = 1;
      // 磁带机转盘
      ctx.save(); ctx.translate(cx + 12, 100); ctx.rotate(t * 2); G.ring(ctx, 0, 0, 5, '#4a5060', 1); ctx.restore();
      ctx.save(); ctx.translate(cx + 28, 100); ctx.rotate(-t * 2); G.ring(ctx, 0, 0, 5, '#4a5060', 1); ctx.restore();
    }

    // 前景控制台（叶文洁的操作台）
    G.ditherV(ctx, 0, 132, 320, 48, '#2a3040', '#1a1e2a', 8);
    G.rect(ctx, 0, 130, 320, 3, '#3a4254');
    // 台面按键与拨杆
    for (let i = 0; i < 16; i++) {
      const x = 20 + i * 18;
      G.rect(ctx, x, 140, 12, 6, i % 3 === 0 ? '#3a4a5a' : '#2e3644');
      const bl = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 4 + i));
      ctx.globalAlpha = bl; G.px(ctx, x + 5, 142, ['#ff5a4a', '#7fffa0', '#ffd27a'][i % 3]); ctx.globalAlpha = 1;
    }
    // 那个红色的发射键（醒目）
    const rp = 0.5 + 0.5 * Math.sin(t * 2.5);
    G.rect(ctx, 250, 150, 20, 14, '#3a1a1a');
    ctx.globalAlpha = 0.5 + rp * 0.5; G.rect(ctx, 253, 153, 14, 8, '#ff3a2a'); ctx.globalAlpha = 1;
    G.rect(ctx, 253, 153, 14, 2, '#ff8a6a');
  };

  /* ============ 太阳（发射放大器：能量渐强的恒星特写） ============ */
  Scenes.sun = function (ctx, env) {
    const t = env.t, e = env.sun || 0; // 能量 0..1
    // 深空底
    G.ditherV(ctx, 0, 0, 320, 180, '#1a0e08', '#0a0604', 10);
    const cx = 160, cy = 92, R = lerp(46, 60, e);
    // 日冕辉光
    ctx.globalAlpha = 0.4 + e * 0.4;
    G.gradR(ctx, cx, cy, R * 2.4, HE.color.rgba(255, 180, 90, 0.5), 'rgba(255,120,40,0)');
    ctx.globalAlpha = 1;
    // 日面（多层湍流）
    G.disc(ctx, cx, cy, R, '#ff8a2e');
    const rr = HE.rng(51);
    for (let i = 0; i < 60; i++) {
      const a = rr() * 6.28, d = rr() * R;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      const pulse = 0.4 + 0.6 * Math.sin(t * 3 + i);
      ctx.globalAlpha = 0.6;
      G.disc(ctx, x, y, 2 + rr() * 4, HE.color.mix('#ff5a1e', '#ffe27a', pulse));
    }
    ctx.globalAlpha = 1;
    // 高亮核心
    G.disc(ctx, cx - 4, cy - 4, R * 0.4, '#ffe9a0');
    // 日珥（边缘喷发，能量越高越活跃）
    for (let i = 0; i < 10; i++) {
      const a = t * 0.5 + i * 0.63;
      const fl = (0.5 + 0.5 * Math.sin(t * 4 + i)) * (0.5 + e);
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      ctx.globalAlpha = fl * 0.8;
      G.disc(ctx, x, y, 2 + fl * 4, '#ff7a3a');
    }
    ctx.globalAlpha = 1;
    // 能量满时的共振环（电波被恒星放大）
    if (e > 0.6) {
      for (let i = 0; i < 4; i++) {
        const rp = ((t * 30 + i * 20) % 90);
        ctx.globalAlpha = (1 - rp / 90) * (e - 0.6) * 2.2;
        G.ring(ctx, cx, cy, R + rp, '#ffcf6a', 1);
      }
      ctx.globalAlpha = 1;
    }
  };

  /* ============ 三体世界：三日凌空、荒芜大地、金字塔 ============
   * depth: 乱纪元程度 0(恒纪元/单日) -> 1(三日凌空/烈焰)
   */
  const triStars = makeStars(23, 60, 320, 90);
  Scenes.trisolaris = function (ctx, env) {
    const t = env.t, chaos = env.depth || 0;
    // 天空：恒纪元幽蓝 -> 乱纪元血红
    const top = HE.color.mix('#1a1a3e', '#3a0a12', chaos);
    const bot = HE.color.mix('#3a2a4a', '#c8481e', chaos);
    G.ditherV(ctx, 0, 0, 320, 120, top, bot, 16);
    // 星空（乱纪元被强光冲淡）
    ctx.globalAlpha = 0.8 * (1 - chaos);
    for (const s of triStars) { const tw = 0.4 + 0.6 * Math.sin(t * 2 + s.ph); ctx.globalAlpha = (1 - chaos) * tw; G.rect(ctx, s.x, s.y, s.s, s.s, s.c); }
    ctx.globalAlpha = 1;

    // === 三颗太阳（不同大小/相位，缓慢游移） ===
    const suns = [
      { bx: 60, by: 34, r: lerp(6, 15, chaos), c: '#ff7a3a', sp: 0.13, ph: 0 },
      { bx: 180, by: 26, r: lerp(4, 20, chaos), c: '#ffd24a', sp: 0.09, ph: 2 },
      { bx: 260, by: 44, r: lerp(3, 12, chaos), c: '#ff5a4a', sp: 0.17, ph: 4 },
    ];
    for (const s of suns) {
      const x = s.bx + Math.sin(t * s.sp + s.ph) * 30;
      const y = s.by + Math.cos(t * s.sp * 0.7 + s.ph) * 8;
      // 大范围灼热光晕（乱纪元时刺目）
      ctx.globalAlpha = 0.4 + chaos * 0.5;
      G.gradR(ctx, x, y, s.r * 4, HE.color.rgba(255, 190, 110, 0.55), 'rgba(255,120,40,0)');
      ctx.globalAlpha = 0.25 + chaos * 0.35;
      G.gradR(ctx, x, y, s.r * 2.2, HE.color.rgba(255, 230, 160, 0.7), 'rgba(255,150,60,0)');
      ctx.globalAlpha = 1;
      // 日面 + 炽白核心
      G.disc(ctx, x, y, s.r, s.c);
      G.disc(ctx, x, y, s.r * 0.7, HE.color.mix(s.c, '#ffe9a0', 0.6));
      G.disc(ctx, x - s.r * 0.25, y - s.r * 0.25, s.r * 0.45, '#fff2c8');
      // 十字星芒（乱纪元强光）
      const fl = (0.6 + 0.4 * Math.sin(t * 3 + s.ph)) * (0.4 + chaos);
      ctx.globalAlpha = fl * 0.7; ctx.strokeStyle = HE.color.rgba(255, 235, 180, 0.9); ctx.lineWidth = 1;
      const ray = s.r * (2 + chaos * 1.5);
      ctx.beginPath(); ctx.moveTo(x - ray, y); ctx.lineTo(x + ray, y); ctx.moveTo(x, y - ray); ctx.lineTo(x, y + ray); ctx.stroke();
      ctx.globalAlpha = 1;
      s._x = x; s._y = y;
    }

    // 大地（干裂荒漠，乱纪元被烤成炽红）
    const gTop = HE.color.mix('#5a4636', '#9a3a1a', chaos);
    const gBot = HE.color.mix('#2e241a', '#4a1808', chaos);
    G.ditherV(ctx, 0, 112, 320, 68, gTop, gBot, 12);
    // 地平线灼热辉光带（烈日烤地）
    ctx.globalAlpha = 0.35 + chaos * 0.5;
    G.gradR(ctx, 160, 114, 220, HE.color.rgba(255, 180, 90, 0.5 * (0.4 + chaos)), 'rgba(255,120,40,0)');
    ctx.globalAlpha = 0.5 + chaos * 0.4;
    G.hline(ctx, 0, 112, 320, HE.color.mix('#a89a6a', '#ffb060', chaos));
    ctx.globalAlpha = 1;
    // 地表受光鳞光（热浪闪烁的碎高光）
    const hl = HE.rng(120);
    for (let i = 0; i < 40; i++) {
      const x = hl() * 320, y = 114 + hl() * 30;
      const tw = 0.4 + 0.6 * Math.sin(t * 4 + i * 1.3);
      ctx.globalAlpha = (0.15 + chaos * 0.4) * tw;
      G.px(ctx, x, y, HE.color.mix('#c8b080', '#ffd090', chaos));
    }
    ctx.globalAlpha = 1;
    // 干裂纹理
    const cr = HE.rng(88);
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 30; i++) {
      const x = cr() * 320, y = 118 + cr() * 58, len = 4 + cr() * 14;
      G.line(ctx, x, y, x + len - 7, y + (cr() < 0.5 ? 2 : -2), '#1a0e08');
    }
    ctx.globalAlpha = 1;

    // 金字塔（三体文明的建筑，剪影带受光面）
    function pyramid(px, base, h, lit) {
      ctx.fillStyle = HE.color.mix('#241c26', '#3a1810', chaos);
      ctx.beginPath(); ctx.moveTo(px, 120 - h); ctx.lineTo(px - base, 122); ctx.lineTo(px + base, 122); ctx.fill();
      // 受光面
      ctx.fillStyle = HE.color.mix('#3a3040', '#7a3a1e', chaos); ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(px, 120 - h); ctx.lineTo(px - base, 122); ctx.lineTo(px, 122); ctx.fill();
      ctx.globalAlpha = 1;
      // 塔身砖线
      ctx.strokeStyle = 'rgba(10,6,4,0.5)'; ctx.lineWidth = 0.5;
      for (let i = 1; i < 4; i++) { const yy = 120 - h + (h * i / 4); const bw = base * (i / 4); ctx.beginPath(); ctx.moveTo(px - bw, yy); ctx.lineTo(px + bw, yy); ctx.stroke(); }
    }
    pyramid(90, 20, 34, true);
    pyramid(230, 26, 46, true);
    pyramid(150, 14, 22, true);
  };

  /* ============ 宇宙深空（尾声/警告：4 光年外的注视） ============ */
  const spaceStars = makeStars(1024, 110, 320, 180);
  Scenes.space = function (ctx, env) {
    const t = env.t;
    G.ditherV(ctx, 0, 0, 320, 180, '#07091a', '#141838', 12);
    // 星云（冷紫/暗红交错，更浓更亮）
    ctx.globalAlpha = 0.34;
    G.gradR(ctx, 90, 60, 140, 'rgba(110,84,180,0.7)', 'rgba(110,84,180,0)');
    G.gradR(ctx, 210, 120, 150, 'rgba(178,78,110,0.6)', 'rgba(178,78,110,0)');
    ctx.globalAlpha = 0.22;
    G.gradR(ctx, 60, 130, 100, 'rgba(72,130,180,0.6)', 'rgba(72,130,180,0)');
    G.gradR(ctx, 250, 40, 90, 'rgba(150,120,200,0.5)', 'rgba(150,120,200,0)');
    ctx.globalAlpha = 1;
    // 银河尘带（斜向的淡星尘）
    const dr = HE.rng(555);
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 120; i++) { const p = dr(); const x = p * 320, y = 40 + p * 110 + (dr() - 0.5) * 40; G.px(ctx, x, y, '#8a9ad0'); }
    ctx.globalAlpha = 1;
    // 星
    for (const s of spaceStars) {
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + s.ph);
      ctx.globalAlpha = 0.5 + 0.5 * tw; G.rect(ctx, s.x, s.y, s.s, s.s, s.c);
      if (s.s > 1) { ctx.globalAlpha = tw * 0.6; G.px(ctx, s.x - 1, s.y, s.c); G.px(ctx, s.x + 1, s.y, s.c); G.px(ctx, s.x, s.y - 1, s.c); G.px(ctx, s.x, s.y + 1, s.c); }
    }
    ctx.globalAlpha = 1;
    // 两三颗明亮的近星（带光晕十字，提亮画面）
    [[70, 50, '#eaf2ff'], [255, 130, '#ffe6c8']].forEach(([x, y, c], i) => {
      const tw = 0.6 + 0.4 * Math.sin(t * 1.8 + i * 2);
      ctx.globalAlpha = 0.3 * tw; G.gradR(ctx, x, y, 10, HE.color.rgba(200, 220, 255, 0.6), 'rgba(200,220,255,0)');
      ctx.globalAlpha = tw; G.disc(ctx, x, y, 1.6, c);
      ctx.globalAlpha = tw * 0.7; ctx.strokeStyle = c; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke();
      ctx.globalAlpha = 1;
    });
    // 三体星系：远处三颗聚在一起的小太阳（暗示"那边"）
    if (env.showTri) {
      const cx = 250, cy = 40;
      [[0, 0, '#ffd24a'], [5, 3, '#ff7a3a'], [-3, 5, '#ff5a4a']].forEach(([dx, dy, c]) => {
        const tw = 0.6 + 0.4 * Math.sin(t * 3 + dx);
        ctx.globalAlpha = tw; G.disc(ctx, cx + dx, cy + dy, 2, c);
      });
      ctx.globalAlpha = 0.3; G.gradR(ctx, cx, cy, 16, 'rgba(255,180,90,0.4)', 'rgba(255,120,40,0)'); ctx.globalAlpha = 1;
    }
  };

  HE.Scenes = Scenes;
})(window);
