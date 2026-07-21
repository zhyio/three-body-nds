/* =====================================================================
 *  play2.js —— 《三体》第二、三幕
 *  第二幕  三体世界     —— 三日凌空、脱水与轮回；孤独的监听员 1379 号
 *  第三幕  回答         —— "不要回答！" 与叶文洁的抉择
 * ===================================================================== */
(function (global) {
  'use strict';
  const HE = global.HE;
  const E = HE.math;

  const C_YE = '#c8e0d8';
  const C_LIS = '#a8c8e0';
  const C_SYS = '#8affa0';
  const C_WARN = '#ff6a5a';
  const C_NARR = '#e8f0f4';

  const wait = (s) => ({ wait: s });
  const box = () => ({ waitBox: true });
  const tween = (dur, on, ease, then) => ({ tween: { dur, on, ease, then } });

  /* =================================================================
   *  第二幕：三体世界
   * ================================================================= */
  function* act2(S, R) {
    const ui = S.ui, sfx = S.sfx;
    S.setScene('trisolaris');
    S.depthTrack.snap(0.15);   // 恒纪元将尽
    S.cam.reset();
    S.bright.snap(1); S.vign.snap(0.4);
    S.setGrade([30, 20, 50], [255, 200, 150], 0.35, 6);

    ui.showChapter('第 二 幕', '三 体 世 界');
    S.music.play('act2');
    yield wait(3.6);
    ui.hideChapter();
    yield wait(0.8);

    ui.setLetterbox(1);
    ui.setSubtitle('四光年之外，一颗被三颗太阳主宰的行星。');
    yield wait(3.2);
    ui.setSubtitle('在这里，文明已经毁灭又重生了两百多次。');
    yield wait(3.4);
    ui.hideSubtitle();
    yield wait(0.6);

    // 监听员立于金字塔前
    const lis = S.addActor('lis', 'listener');
    lis.x = 150; lis.y = 150; lis.scale = 1.4; lis.face = 1;
    yield wait(0.4);

    ui.say('监听员', '（我是三体世界第 1379 号监听员。我在这座监听站里，度过了一生。）', C_LIS, 'lis');
    yield box();
    ui.say('监听员', '（恒纪元短暂而珍贵。乱纪元一到，烈日会把一切烤成灰烬。）', C_LIS, 'lis');
    yield box();

    // 乱纪元降临：三日凌空、热浪、脱水
    ui.setSubtitle('警报——三颗太阳同时升起。乱纪元，来了。');
    sfx.alarm();
    yield tween(5.0, (p) => {
      S.depthTrack.set(1, 5);
      S.setGrade([80, 20, 10], [255, 160, 90], 0.5, 5);
      S.cam.shake(1.5 * p);
    });
    sfx.rumble(3);
    yield wait(1.0);
    ui.hideSubtitle();

    // 热浪粒子
    for (let i = 0; i < 40; i++) {
      S.fg.emit({ x: Math.random() * 320, y: 180, vx: (Math.random() - 0.5) * 4, vy: -12 - Math.random() * 16, life: 3 + Math.random() * 2, size: 1, c: Math.random() < 0.5 ? '#ff8a3a' : '#ffd27a', g: -2, a0: 0.7, kind: 'dot' });
    }

    // 一个脱水者卷起
    const dry = S.addActor('dry', 'dryman');
    dry.x = 210; dry.y = 152; dry.scale = 1.3; dry.alpha = 0;
    yield tween(2.0, (p) => { dry.alpha = p; lis.headTilt = -p * 0.6; });

    ui.say('监听员', '快脱水！把自己卷起来，收进地窖，等待下一个恒纪元……', C_LIS, 'lis');
    yield box();
    ui.say('监听员', '（这就是我们的宿命。永无宁日地，在生与死之间轮回。）', C_LIS, 'lis');
    yield box();

    // 监听员的绝望与渴望——收到了那个信号
    ui.setSubtitle('就在这时，监听站接收到了来自宇宙的第一条信息。');
    yield wait(3.2);
    ui.hideSubtitle();

    sfx.transmit && sfx.transmit();
    S.d.fx.flash = 0.3;
    yield tween(0.6, (p) => { S.d.fx.flash = 0.3 * (1 - p); });
    lis.setEmote('shock', 2.5);

    ui.say('监听员', '一个……适合居住的世界？温暖，稳定，只有一颗太阳……', C_LIS, 'lis');
    yield box();
    ui.say('监听员', '（一个可以让我的族人不再脱水、不再轮回的天堂。地球。）', C_LIS, 'lis');
    yield box();

    // 但监听员是个和平主义者——他做了一个惊人的决定
    yield tween(2.2, (p) => {
      S.cam.zoom = E.lerp(1, 1.5, E.easeInOut(p));
      S.cam.cx = E.lerp(160, 150, E.easeInOut(p));
      S.cam.cy = E.lerp(90, 100, E.easeInOut(p));
    });
    ui.say('监听员', '可如果我回答……三体舰队就会顺着坐标，去毁灭那个美丽的世界。', C_LIS, 'lis');
    yield box();
    ui.say('监听员', '（我不能。我宁愿背叛我的文明，也要拯救那个尚不知情的地球。）', C_LIS, 'lis');
    yield box();
    lis.setEmote('sad', 3);
    yield wait(0.6);

    // 拉回全景，准备发送警告
    yield tween(2.0, (p) => {
      S.cam.zoom = E.lerp(1.5, 1.1, E.easeInOut(p));
      S.cam.cx = E.lerp(150, 160, E.easeInOut(p));
      S.cam.cy = E.lerp(100, 90, E.easeInOut(p));
    });
    ui.setSubtitle('他向着信号的来源，发出了一生中最重要的一句话。');
    yield wait(3.2);
    ui.hideSubtitle();

    // 转场第三幕
    yield tween(3.0, (p) => {
      S._transition = E.easeIn(p);
      S._transColor = '#0a0612';
    });
    S.music.stop();
    yield wait(0.8);
  }

  /* =================================================================
   *  第三幕：回答
   * ================================================================= */
  function* act3(S, R) {
    const ui = S.ui, sfx = S.sfx;
    S.setScene('space');
    S.cam.reset();
    S.bright.snap(1); S.vign.snap(0.5);
    S.setGrade([20, 20, 50], [180, 190, 255], 0.4, 6);
    S.env.showTri = true;

    ui.showChapter('第 三 幕', '回 答');
    S.music.play('act3');
    yield wait(3.6);
    ui.hideChapter();
    yield wait(0.8);

    ui.setLetterbox(1);
    ui.setSubtitle('信号穿越四光年的黑暗，化作屏幕上一行行文字。');
    yield wait(3.4);
    ui.hideSubtitle();

    // 监听员的警告，逐条浮现（绿色系统文字）
    // 第一声警告：时间几近凝固，只有屏幕上的字与心跳（关键停顿帧）
    S.setSlowmo(0.12, 1.5);
    sfx.heartbeat();
    ui.say('⚠ 来自三体', '不要回答！不要回答！不要回答！', C_WARN, null);
    yield box();
    S.setSlowmo(1, 2);
    ui.say('⚠ 来自三体', '这个世界收到了你们的信息。我是这个世界的一个和平主义者。', C_SYS, null);
    yield box();
    ui.say('⚠ 来自三体', '我是你们文明的第一个收听者。是我，把即将到来的毁灭警告给你们。', C_SYS, null);
    yield box();
    ui.say('⚠ 来自三体', '不要回答！不要回答！！不要回答！！！', C_WARN, null);
    yield box();
    ui.say('⚠ 来自三体', '只要不回答，你们的世界就不会暴露方位。这是唯一能拯救你们的方法。', C_SYS, null);
    yield box();

    // 切到地球——叶文洁面对屏幕上的警告（信号干扰转场：这本身就是一次接收）
    S.setTransMode('signal');
    yield tween(1.8, (p) => { S._transition = E.easeIn(p); S._transColor = '#0a0e16'; });
    S.setScene('control');
    S.clearActors();
    const ye = S.addActor('ye', 'ye');
    ye.x = 150; ye.y = 150; ye.scale = 1.5; ye.face = 1;
    S.cam.reset();
    S.vign.set(0.45, 3);
    S.setGrade([20, 40, 60], [150, 220, 255], 0.4, 4);
    S.env.showTri = false;
    yield tween(1.8, (p) => { S._transition = 1 - E.easeOut(p); });
    S.setTransMode('fade');
    yield wait(0.6);

    ui.say('叶文洁', '（一个宇宙文明，在恳求我不要回答。他在拯救我们。）', C_YE, 'ye');
    yield box();
    ui.say('叶文洁', '（可我，看透了人类的一切。我不再相信我们能靠自己变好。）', C_YE, 'ye');
    yield box();

    // 抉择的心跳——世界凝固，只剩心跳（关键停顿帧）
    S.setSlowmo(0.1, 2.5);
    S.vign.set(0.62, 2);
    sfx.heartbeat(); yield wait(1.0); sfx.heartbeat(); yield wait(1.0);

    ui.setSubtitle('她抬起了手。发射键，就在指尖之下。');
    yield tween(2.4, (p) => { ye.armRaise = E.easeInOut(p); });
    yield wait(0.8);
    ui.hideSubtitle();

    // 那句改变人类命运的话
    ui.say('叶文洁', '到这里来吧——我将帮助你们，获得这个世界。', C_YE, 'ye');
    yield box();
    S.setSlowmo(1, 1.5);          // 抉择已定，时间重新流动
    S.vign.set(0.45, 2);

    // 按下：闪光、电波射向星海
    sfx.transmit && sfx.transmit();
    S.d.fx.flash = 0.7;
    S.cam.shake(2);
    yield tween(0.8, (p) => { S.d.fx.flash = 0.7 * (1 - p); });
    yield wait(0.6);

    // 切回宇宙深空：电波射向三体星（信号溶解）
    S.setTransMode('dissolve');
    yield tween(2.0, (p) => { S._transition = E.easeIn(p); S._transColor = '#eaf0ff'; S.d.fx.flash = E.easeInOut(p) * 0.5; });
    S.setScene('space');
    S.clearActors();
    S.cam.reset();
    S.env.showTri = true;
    S.setTint([120, 150, 220], 0.15, 4);
    S.bloom.set(0.35, 4);
    yield tween(2.5, (p) => { S._transition = 1 - E.easeOut(p); S.d.fx.flash = 0.5 * (1 - p); });
    S.setTransMode('fade');

    // 电波环从画面中心射向三体星系
    S._waveOut = true;
    ui.setSubtitle('人类的坐标，就此暴露在了黑暗森林之中。');
    yield wait(3.6);
    ui.hideSubtitle();

    ui.say('叶文洁', '这是人类的落日。', C_YE, null);
    yield box();

    // 尾声：镜头拉远，星海铺满
    yield tween(6.0, (p) => {
      S.cam.cy = E.lerp(90, 78, E.easeInOut(p));
      S.cam.zoom = E.lerp(1, 1.12, E.easeInOut(p));
      S.bloom.set(0.3, 4);
    });
    ui.setSubtitle('四光年外，一支舰队调转了航向。而它们的抵达，将耗时四百年。');
    yield wait(4.0);
    ui.hideSubtitle();

    ui.say('旁白', '「不要回答！」——这是宇宙给人类的第一句忠告，也是最后一次仁慈。', C_NARR, null);
    yield box();

    // 收尾：淡入满天星海，播放片尾曲
    ui.setSubtitle('');
    S._waveOut = false;
    yield tween(4.0, (p) => {
      S.bright.set(1, 4);
      S._transition = E.easeInOut(p);
      S._transColor = '#05060f';
    });
    // 深空星海铺底，星尘缓落
    S.setScene('space');
    S.clearActors();
    S.cam.reset();
    S.env.showTri = true;
    S.setGrade([20, 22, 52], [180, 195, 255], 0.35, 6);
    S.vign.set(0.5, 4);
    yield tween(2.0, (p) => { S._transition = 1 - E.easeOut(p); });
    S._starRain = true;                 // 主循环里的星尘飘落
    S.music.play('title');

    yield wait(1.0);
    ui.setLetterbox(1);

    // 片名卡先亮一下
    ui.showTitle('三 体', '第 一 部 · 地球往事');
    yield wait(4.0);
    ui.hideTitle();
    yield wait(1.2);

    // 滚动职员表（引言 + credits + 致谢）
    ui.showRoll([
      { t: '「不要回答！不要回答！！不要回答！！！」', s: 'q', gap: 20 },
      { t: '—— 一个文明对另一个文明，最后的仁慈', s: 'g', gap: 30 },

      { t: '三  体', s: 'h', gap: 26 },
      { t: '第一部 · 地球往事', s: 'g', gap: 30 },

      { t: '原  著', s: 'g' },
      { t: '刘慈欣《三体》', s: 'r', gap: 24 },

      { t: '音乐动机', s: 'g' },
      { t: '霍尔斯特《行星组曲 · 火星，战争使者》', s: 'r', gap: 24 },

      { t: '登  场', s: 'g' },
      { t: '叶文洁 · 红岸基地', s: 'r' },
      { t: '监听员 1379 号 · 三体世界', s: 'r', gap: 24 },

      { t: '像素美术 · 音效合成 · 演出编排', s: 'g' },
      { t: 'NDS 风格实时小剧场引擎', s: 'r', gap: 34 },

      { t: '致每一个仰望星空，', s: 'q' },
      { t: '并仍愿相信光明的文明', s: 'q', gap: 30 },

      { t: '—— 完 ——', s: 'g', gap: 40 },
    ], 11);

    // 等滚动结束（headless 下 skip 会加速）
    while (!ui.rollDone()) yield wait(0.3);
    yield wait(1.5);
    ui.hideRoll();
    S._starRain = false;
    S.music.stop();
    yield tween(2.5, (p) => { S._transition = E.easeIn(p); S._transColor = '#04050a'; });
    yield wait(0.6);
    R.finished = true;
  }

  HE.PLAY.act2 = act2;
  HE.PLAY.act3 = act3;
})(window);
