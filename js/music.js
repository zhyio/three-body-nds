/* =====================================================================
 *  music.js —— 序列器 + 三幕配乐 + 音效
 *  主题动机：德沃夏克《自新大陆交响曲》第二乐章 Largo（《念故乡》，公有领域）
 *  改编为 8bit：第一幕田园(大调,明亮) / 第二幕下潜(小调,压迫) / 第三幕永别(完整,升华)
 * ===================================================================== */
(function (global) {
  'use strict';
  const HE = global.HE;

  // 序列器：以 BPM 调度 track（音符数组），每个 step = 一个 16 分音符
  function Sequencer(audio) {
    this.A = audio;
    this.bpm = 100;
    this.playing = false;
    this.lookahead = 0.1;      // 提前调度秒数
    this.timer = null;
    this.tracks = [];
    this.startTime = 0;
    this.stepIdx = 0;
    this.totalSteps = 0;
    this.onDone = null;
    this.loop = false;
  }

  Sequencer.prototype.spb = function () { return 60 / this.bpm / 4; }; // 每 16分音符秒数

  // track: { chan, duty, gain, a,d,s,r, vib, notes:[{s:startStep, len:steps, n:'A4', gain?, slideTo?}], dest }
  Sequencer.prototype.play = function (song) {
    this.stop();
    this.bpm = song.bpm || 100;
    this.tracks = song.tracks.map((t) => ({ def: t, i: 0 }));
    this.loop = !!song.loop;
    this.onDone = song.onDone || null;
    // 计算总长
    let max = 0;
    for (const t of song.tracks) for (const n of t.notes) max = Math.max(max, n.s + (n.len || 1));
    this.totalSteps = song.length || max + 4;
    this.playing = true;
    this.startTime = this.A.now() + 0.08;
    this.stepIdx = 0;
    this._tick();
  };

  Sequencer.prototype._tick = function () {
    if (!this.playing) return;
    const A = this.A, spb = this.spb();
    const ahead = A.now() + this.lookahead;
    while (this.playing) {
      const stepTime = this.startTime + this.stepIdx * spb;
      if (stepTime > ahead) break;
      const step = this.stepIdx % this.totalSteps;
      // 调度所有 track 在此 step 起始的音符
      for (const tr of this.tracks) {
        const def = tr.def;
        for (const nt of def.notes) {
          if (nt.s === step) {
            const f = HE.noteToFreq(nt.n);
            if (f > 0) {
              this.A.play({
                chan: def.chan, duty: nt.duty || def.duty, freq: f,
                dur: (nt.len || 1) * spb * (def.legato || 0.9),
                t: stepTime,
                gain: (nt.gain != null ? nt.gain : def.gain) || 0.25,
                a: def.a, d: def.d, s: def.s, r: def.r,
                vib: nt.vib || def.vib,
                slideTo: nt.slideTo ? HE.noteToFreq(nt.slideTo) : undefined,
                noiseType: def.noiseType, q: def.q,
                dest: def.dest === 'sfx' ? this.A.sfxGain : this.A.musicGain,
              });
            } else if (def.chan === 'noise' && nt.drum) {
              this._drum(nt.drum, stepTime, nt.gain != null ? nt.gain : def.gain);
            }
          }
        }
      }
      this.stepIdx++;
      if (this.stepIdx >= this.totalSteps && !this.loop) {
        // 排空后停止
        const endT = this.startTime + this.totalSteps * spb;
        const wait = (endT - A.now() + 0.3) * 1000;
        this.playing = false;
        if (this.onDone) setTimeout(this.onDone, Math.max(0, wait));
        return;
      }
    }
    this.timer = setTimeout(() => this._tick(), 25);
  };

  Sequencer.prototype._drum = function (kind, t, gain) {
    const A = this.A;
    if (kind === 'kick') {
      A.play({ chan: 'tri', freq: 140, slideTo: 45, dur: 0.14, t, gain: (gain || 0.5), a: 0.001, d: 0.05, s: 0.3, r: 0.05, dest: A.musicGain });
    } else if (kind === 'snare') {
      A.play({ chan: 'noise', freq: 1800, noiseType: 'highpass', dur: 0.12, t, gain: (gain || 0.3), a: 0.001, d: 0.04, s: 0.2, r: 0.06, dest: A.musicGain });
    } else if (kind === 'hat') {
      A.play({ chan: 'noise', freq: 7000, noiseType: 'highpass', dur: 0.03, t, gain: (gain || 0.12), a: 0.001, d: 0.01, s: 0.1, r: 0.02, dest: A.musicGain });
    }
  };

  Sequencer.prototype.stop = function () {
    this.playing = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  };

  HE.Sequencer = Sequencer;

  /* ===================================================================
   *  音效库（即时触发，不走序列器）
   * =================================================================== */
  function SFX(audio) { this.A = audio; }
  SFX.prototype.page = function () {
    const A = this.A, t = A.now();
    A.play({ chan: 'noise', freq: 3000, noiseType: 'highpass', dur: 0.06, t, gain: 0.18, a: 0.001, d: 0.03, s: 0.1, r: 0.03, dest: A.sfxGain });
    A.play({ chan: 'pulse', duty: 0.25, freq: 900, dur: 0.04, t: t + 0.02, gain: 0.08, a: 0.001, d: 0.02, s: 0.1, r: 0.02, dest: A.sfxGain });
  };
  SFX.prototype.blip = function (hi) {
    const A = this.A, t = A.now();
    A.play({ chan: 'pulse', duty: 0.5, freq: hi ? 1400 : 820, dur: 0.05, t, gain: 0.14, a: 0.001, d: 0.02, s: 0.3, r: 0.03, dest: A.sfxGain });
  };
  SFX.prototype.select = function () {
    const A = this.A, t = A.now();
    A.play({ chan: 'pulse', duty: 0.5, freq: 660, dur: 0.06, t, gain: 0.16, a: 0.001, d: 0.03, s: 0.4, r: 0.04, dest: A.sfxGain });
    A.play({ chan: 'pulse', duty: 0.5, freq: 990, dur: 0.09, t: t + 0.06, gain: 0.16, a: 0.001, d: 0.03, s: 0.4, r: 0.05, dest: A.sfxGain });
  };
  SFX.prototype.water = function () {
    const A = this.A, t = A.now();
    A.play({ chan: 'tri', freq: 1200, slideTo: 2400, dur: 0.12, t, gain: 0.12, a: 0.001, d: 0.03, s: 0.2, r: 0.06, dest: A.sfxGain });
  };
  SFX.prototype.wind = function () {
    const A = this.A, t = A.now();
    A.play({ chan: 'noise', freq: 500, noiseType: 'bandpass', q: 1.2, dur: 1.6, t, gain: 0.06, a: 0.4, d: 0.3, s: 0.7, r: 0.6, dest: A.sfxGain });
  };
  SFX.prototype.step = function () {
    const A = this.A, t = A.now();
    A.play({ chan: 'noise', freq: 400, noiseType: 'lowpass', dur: 0.05, t, gain: 0.1, a: 0.001, d: 0.03, s: 0.1, r: 0.02, dest: A.sfxGain });
  };
  SFX.prototype.alarm = function () {
    const A = this.A, t = A.now();
    for (let i = 0; i < 3; i++) {
      A.play({ chan: 'pulse', duty: 0.5, freq: 880, dur: 0.14, t: t + i * 0.22, gain: 0.16, a: 0.005, d: 0.02, s: 0.7, r: 0.05, dest: A.sfxGain });
      A.play({ chan: 'pulse', duty: 0.5, freq: 660, dur: 0.14, t: t + i * 0.22 + 0.11, gain: 0.16, a: 0.005, d: 0.02, s: 0.7, r: 0.05, dest: A.sfxGain });
    }
  };
  SFX.prototype.rumble = function (dur) {
    const A = this.A, t = A.now();
    dur = dur || 2.5;
    A.play({ chan: 'noise', freq: 90, noiseType: 'lowpass', q: 2, dur, t, gain: 0.22, a: 0.3, d: 0.5, s: 0.8, r: 0.8, dest: A.sfxGain });
    A.play({ chan: 'tri', freq: 55, slideTo: 38, dur, t, gain: 0.18, a: 0.3, d: 0.5, s: 0.7, r: 0.8, dest: A.sfxGain });
  };
  SFX.prototype.chime = function () {
    const A = this.A, t = A.now();
    [880, 1108, 1318, 1760].forEach((f, i) =>
      A.play({ chan: 'tri', freq: f, dur: 0.7, t: t + i * 0.05, gain: 0.1, a: 0.005, d: 0.2, s: 0.3, r: 0.5, dest: A.sfxGain }));
  };
  SFX.prototype.star = function () {
    const A = this.A, t = A.now();
    A.play({ chan: 'tri', freq: 1600 + Math.random() * 600, dur: 0.25, t, gain: 0.06, a: 0.005, d: 0.08, s: 0.2, r: 0.15, dest: A.sfxGain });
  };
  SFX.prototype.heartbeat = function () {
    const A = this.A, t = A.now();
    A.play({ chan: 'tri', freq: 60, slideTo: 40, dur: 0.18, t, gain: 0.2, a: 0.005, d: 0.06, s: 0.3, r: 0.08, dest: A.sfxGain });
    A.play({ chan: 'tri', freq: 55, slideTo: 38, dur: 0.16, t: t + 0.24, gain: 0.15, a: 0.005, d: 0.06, s: 0.3, r: 0.08, dest: A.sfxGain });
  };

  /* ---- 三体专属音效 ---- */
  // 电波发射：上行扫频（红岸向太阳发射）
  SFX.prototype.transmit = function () {
    const A = this.A, t = A.now();
    A.play({ chan: 'pulse', duty: 0.5, freq: 200, slideTo: 2400, dur: 0.9, t, gain: 0.12, a: 0.02, d: 0.1, s: 0.7, r: 0.3, dest: A.sfxGain });
    A.play({ chan: 'noise', freq: 1200, noiseType: 'bandpass', q: 3, dur: 0.9, t, gain: 0.05, a: 0.05, d: 0.2, s: 0.6, r: 0.3, dest: A.sfxGain });
  };
  // 收到信号：一串来自深空的数字脉冲
  SFX.prototype.signal = function (n) {
    const A = this.A, t = A.now();
    n = n || 5;
    for (let i = 0; i < n; i++) {
      A.play({ chan: 'pulse', duty: 0.125, freq: 1500 + (i % 3) * 300, dur: 0.05, t: t + i * 0.12, gain: 0.13, a: 0.001, d: 0.02, s: 0.4, r: 0.03, dest: A.sfxGain });
    }
  };
  // 太阳放大回响：巨大的低频轰鸣上涌
  SFX.prototype.sunRoar = function (dur) {
    const A = this.A, t = A.now();
    dur = dur || 4;
    A.play({ chan: 'noise', freq: 120, noiseType: 'lowpass', q: 1.5, dur, t, gain: 0.2, a: 1.2, d: 0.5, s: 0.9, r: 1.2, dest: A.sfxGain });
    A.play({ chan: 'tri', freq: 48, dur, t, gain: 0.18, a: 1.2, d: 0.5, s: 0.85, r: 1.2, dest: A.sfxGain });
    A.play({ chan: 'pulse', duty: 0.5, freq: 96, slideTo: 72, dur, t, gain: 0.06, a: 1.2, d: 0.5, s: 0.7, r: 1.2, dest: A.sfxGain });
  };
  // 脱水：干裂的噪声脆响
  SFX.prototype.dehydrate = function () {
    const A = this.A, t = A.now();
    for (let i = 0; i < 6; i++) {
      A.play({ chan: 'noise', freq: 2600 - i * 200, noiseType: 'highpass', dur: 0.04, t: t + i * 0.06 + Math.random() * 0.02, gain: 0.09, a: 0.001, d: 0.02, s: 0.1, r: 0.02, dest: A.sfxGain });
    }
  };
  // 文明毁灭：轰鸣 + 下行崩塌
  SFX.prototype.collapse = function () {
    const A = this.A, t = A.now();
    A.play({ chan: 'noise', freq: 200, noiseType: 'lowpass', q: 2, dur: 2.2, t, gain: 0.22, a: 0.02, d: 0.6, s: 0.5, r: 1.0, dest: A.sfxGain });
    A.play({ chan: 'tri', freq: 220, slideTo: 40, dur: 2.0, t, gain: 0.16, a: 0.02, d: 0.5, s: 0.4, r: 0.8, dest: A.sfxGain });
  };
  // 冷冽的星光/宇宙闪烁
  SFX.prototype.cosmic = function () {
    const A = this.A, t = A.now();
    A.play({ chan: 'tri', freq: 2100 + Math.random() * 800, dur: 0.4, t, gain: 0.05, a: 0.01, d: 0.1, s: 0.3, r: 0.28, dest: A.sfxGain });
  };
  // 警告脉冲：三声急促高音（不要回答）
  SFX.prototype.warn = function () {
    const A = this.A, t = A.now();
    for (let i = 0; i < 3; i++) {
      A.play({ chan: 'pulse', duty: 0.25, freq: 1320, dur: 0.16, t: t + i * 0.26, gain: 0.16, a: 0.002, d: 0.03, s: 0.7, r: 0.06, dest: A.sfxGain });
    }
  };
  HE.SFX = SFX;
})(window);
