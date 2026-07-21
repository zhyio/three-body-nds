/* =====================================================================
 *  audio.js —— Web Audio chiptune 合成引擎 + 音效
 *  通道：pulse(方波,可调占空比) / triangle(三角) / noise(噪声)
 *  提供 ADSR 包络、颤音、滑音；音乐由 music.js 编排的音符表驱动
 * ===================================================================== */
(function (global) {
  'use strict';
  const HE = global.HE;

  // 音名 -> 频率
  const A4 = 440;
  const NAMES = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  function noteToFreq(n) {
    if (n == null || n === '.' || n === 0) return 0;
    if (typeof n === 'number') return n;
    const m = /^([A-G][#b]?)(-?\d)$/.exec(n);
    if (!m) return 0;
    const semis = NAMES[m[1]] + (parseInt(m[2], 10) + 1) * 12; // MIDI-ish
    const midi = semis; // C-1=0
    return A4 * Math.pow(2, (midi - 69) / 12);
  }
  HE.noteToFreq = noteToFreq;

  function Audio() {
    this.ac = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.ready = false;
    this.muted = false;
    this._duty = {}; // 缓存占空比波形
  }

  Audio.prototype.init = function () {
    if (this.ready) return;
    const AC = global.AudioContext || global.webkitAudioContext;
    this.ac = new AC();
    this.master = this.ac.createGain();
    this.master.gain.value = 0.9;
    // 轻微主压缩，避免削波
    const comp = this.ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 20; comp.ratio.value = 4;
    comp.attack.value = 0.003; comp.release.value = 0.25;
    this.master.connect(comp); comp.connect(this.ac.destination);

    this.musicGain = this.ac.createGain(); this.musicGain.gain.value = 0.55;
    this.sfxGain = this.ac.createGain(); this.sfxGain.gain.value = 0.6;
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);

    // 用于给方波增添"温暖"的高切
    this.ready = true;
  };

  Audio.prototype.resume = function () { if (this.ac && this.ac.state === 'suspended') this.ac.resume(); };
  Audio.prototype.now = function () { return this.ac ? this.ac.currentTime : 0; };

  // 生成指定占空比的 PeriodicWave（方波），duty: 0.125/0.25/0.5
  Audio.prototype._pulseWave = function (duty) {
    const key = duty.toFixed(3);
    if (this._duty[key]) return this._duty[key];
    const n = 32;
    const real = new Float32Array(n), imag = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      // 方波占空比 d 的傅里叶系数
      real[k] = (2 / (k * Math.PI)) * Math.sin(Math.PI * k * duty);
    }
    const w = this.ac.createPeriodicWave(real, imag, { disableNormalization: false });
    this._duty[key] = w;
    return w;
  };

  /* ---- 单音符播放 ----
   * opt: { chan:'pulse'|'tri'|'noise', freq, dur, t, gain, duty,
   *        a,d,s,r, vib:{rate,depth}, slideTo, dest }
   */
  Audio.prototype.play = function (opt) {
    if (!this.ready || this.muted) return;
    const ac = this.ac;
    const t = opt.t != null ? opt.t : ac.currentTime;
    const dur = opt.dur != null ? opt.dur : 0.2;
    const dest = opt.dest || this.musicGain;
    const g = ac.createGain();
    const peak = (opt.gain != null ? opt.gain : 0.3);
    const a = opt.a != null ? opt.a : 0.008;
    const d = opt.d != null ? opt.d : 0.05;
    const s = opt.s != null ? opt.s : 0.6;
    const rel = opt.r != null ? opt.r : 0.08;
    const sLevel = peak * s;

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.linearRampToValueAtTime(Math.max(0.0001, sLevel), t + a + d);
    g.gain.setValueAtTime(Math.max(0.0001, sLevel), t + Math.max(a + d, dur));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + d, dur) + rel);
    g.connect(dest);

    let src;
    if (opt.chan === 'noise') {
      src = ac.createBufferSource();
      src.buffer = this._noiseBuf();
      src.loop = true;
      const bp = ac.createBiquadFilter();
      bp.type = opt.noiseType || 'highpass';
      bp.frequency.value = opt.freq || 2000;
      bp.Q.value = opt.q || 0.7;
      src.connect(bp); bp.connect(g);
    } else {
      const osc = ac.createOscillator();
      if (opt.chan === 'tri') osc.type = 'triangle';
      else if (opt.chan === 'saw') osc.type = 'sawtooth';
      else osc.setPeriodicWave(this._pulseWave(opt.duty || 0.5));
      osc.frequency.setValueAtTime(opt.freq, t);
      if (opt.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opt.slideTo), t + dur);
      if (opt.vib) {
        const lfo = ac.createOscillator();
        const lg = ac.createGain();
        lfo.frequency.value = opt.vib.rate || 5.5;
        lg.gain.value = opt.vib.depth || 4;
        lfo.connect(lg); lg.connect(osc.frequency);
        lfo.start(t + (opt.vib.delay || 0));
        lfo.stop(t + dur + rel);
      }
      src = osc;
    }
    src.connect ? null : null;
    if (src.connect && opt.chan !== 'noise') src.connect(g);
    src.start(t);
    src.stop(t + dur + rel + 0.02);
    return g;
  };

  Audio.prototype._noiseBuf = function () {
    if (this._nb) return this._nb;
    const len = this.ac.sampleRate * 1.0;
    const b = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = b.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (seed / 0x3fffffff) - 1;
    }
    this._nb = b;
    return b;
  };

  HE.Audio = Audio;
})(window);
