/* =====================================================================
 *  play.js —— 剧本：《三体》第一部 · 三幕小剧场
 *  改编自刘慈欣《三体》。以 generator 协程编排镜头/灯光/台词/走位。
 *
 *  第一幕  红岸        —— 绝望中的叶文洁，向太阳发出人类的第一声呼唤
 *  第二幕  三体世界     —— 三日凌空、脱水与文明的轮回；孤独的监听员
 *  第三幕  回答         —— "不要回答！" 与那个改变人类命运的按键
 * ===================================================================== */
(function (global) {
  'use strict';
  const HE = global.HE;
  const E = HE.math;

  // 台词颜色
  const C_YE = '#c8e0d8';     // 叶文洁
  const C_LIS = '#a8c8e0';    // 三体监听员
  const C_SYS = '#8affa0';    // 系统/电波（绿）
  const C_WARN = '#ff6a5a';   // 警告（红）
  const C_NARR = '#e8f0f4';   // 旁白

  const wait = (s) => ({ wait: s });
  const box = () => ({ waitBox: true });
  const key = () => ({ waitKey: true });
  const act = (fn) => ({ fn });
  const tween = (dur, on, ease, then) => ({ tween: { dur, on, ease, then } });

  /* =================================================================
   *  第一幕：红岸
   * ================================================================= */
  function* act1(S, R) {
    const ui = S.ui, sfx = S.sfx;
    S.setScene('redcoast');
    S.sunTrack.snap(0.0);       // 深夜
    S.cam.reset();
    S.bright.snap(1); S.vign.snap(0.4);
    S.setGrade([30, 40, 80], [180, 200, 255], 0.35, 8);
    S.env.beam = false;

    // 飘雪
    S._snow = true;

    ui.showChapter('第 一 幕', '红 岸');
    S.music.play('act1');
    yield wait(3.6);
    ui.hideChapter();
    yield wait(0.8);

    ui.setLetterbox(1);
    ui.setSubtitle('二十世纪七十年代，大兴安岭。雷达峰之巅，红岸基地。');
    yield wait(3.4);
    ui.setSubtitle('这里是共和国最高机密——一座对着星空的巨型天线。');
    yield wait(3.6);
    ui.hideSubtitle();
    yield wait(0.6);

    // 叶文洁走入雪夜，站到天线下
    const ye = S.addActor('ye', 'ye');
    ye.x = 30; ye.y = 150; ye.scale = 1.35; ye.face = 1; ye.walking = true;
    yield tween(3.6, (p) => {
      ye.x = E.lerp(30, 150, E.easeInOut(p));
      if (p > 0.02 && p < 0.98 && Math.random() < 0.2) sfx.step();
    }, (x) => x, () => { ye.walking = false; });
    yield wait(0.6);

    ui.say('叶文洁', '（她刚刚失去了一切。父亲、信仰、这个时代对她的每一次背叛……）', C_YE, 'ye');
    yield box();
    ui.say('叶文洁', '（在这座与世隔绝的基地里，她偶然发现了一个秘密——）', C_YE, 'ye');
    yield box();

    // 镜头推向控制室的屏幕：太阳能反射增益
    yield tween(2.0, (p) => {
      S.cam.zoom = E.lerp(1, 1.5, E.easeInOut(p));
      S.cam.cy = E.lerp(90, 70, E.easeInOut(p));
    });
    ui.say('叶文洁', '太阳……太阳可以作为天线的放大器。以恒星的能量，把电波射向整个宇宙。', C_YE, 'ye');
    yield box();
    ye.setEmote('shock', 2);
    yield wait(0.4);

    // 切到控制室内景
    yield tween(1.2, (p) => { S._transition = E.easeIn(p); S._transColor = '#0a0e16'; });
    S.setScene('control');
    S.clearActors();
    const ye2 = S.addActor('ye', 'ye');
    ye2.x = 150; ye2.y = 150; ye2.scale = 1.5; ye2.face = 1;
    S.cam.reset();
    S.vign.set(0.45, 3);
    S.setGrade([20, 40, 60], [150, 220, 255], 0.4, 4);
    yield tween(1.2, (p) => { S._transition = 1 - E.easeOut(p); });
    yield wait(0.6);

    ui.say('叶文洁', '（屏幕上，是发给太阳的坐标。发射键，就在指尖之下。）', C_YE, 'ye');
    yield box();
    ui.setSubtitle('她想起了这些年的一切。人对人的残忍，是否真能靠人类自己终结？');
    yield wait(3.6);
    ui.hideSubtitle();

    ui.say('叶文洁', '也许……我们这个物种，需要一种外来的力量，来干预这疯狂的世界。', C_YE, 'ye');
    yield box();

    // 按下发射键：心跳、警示灯、蓄能
    ye2.armRaise = 0;
    yield tween(1.4, (p) => { ye2.armRaise = E.easeInOut(p); });
    sfx.heartbeat();
    yield wait(0.5); sfx.heartbeat();
    yield wait(0.5);
    sfx.transmit && sfx.transmit();
    S.d.fx.flash = 0.5;
    yield tween(0.5, (p) => { S.d.fx.flash = 0.5 * (1 - p); });

    ui.setSubtitle('一束以恒星为放大器的电波，射向了茫茫太空。');
    yield wait(3.2);
    ui.hideSubtitle();

    // 切到太阳：能量蓄满、电波被放大射出
    yield tween(1.6, (p) => { S._transition = E.easeIn(p); S._transColor = '#1a0e06'; });
    S.setScene('sun');
    S.clearActors();
    S.sunTrack.snap(0.2);
    S.cam.reset();
    S.vign.set(0.3, 3);
    S.setGrade([60, 20, 10], [255, 210, 130], 0.4, 4);
    S.bloom.set(0.4, 3);
    yield tween(1.6, (p) => { S._transition = 1 - E.easeOut(p); });

    ui.setSubtitle('太阳，如约将这声呼唤放大了亿万倍。');
    yield tween(4.5, (p) => { S.sunTrack.set(0.9, 5); }, (x) => x);
    sfx.transmit && sfx.transmit();
    yield wait(1.6);
    ui.hideSubtitle();

    ui.say('叶文洁', '（发出去了。这个信号，将用九年时间，飞过四光年。）', C_YE, 'ye');
    yield box();
    ui.say('叶文洁', '（那时的我以为，宇宙不会有任何回答。）', C_YE, 'ye');
    yield box();

    // 转场第二幕
    ui.hideSubtitle();
    S._snow = false;
    yield tween(3.0, (p) => {
      S.bloom.set(0.1, 3);
      S._transition = E.easeIn(p);
      S._transColor = '#0a0612';
    });
    S.music.stop();
    yield wait(0.8);
  }

  HE.PLAY = { act1 };
})(window);
