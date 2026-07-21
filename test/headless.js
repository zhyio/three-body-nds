/* Headless smoke test: stub DOM/canvas/AudioContext, load all modules,
 * run the entire 3-act play at fast speed, assert it reaches the end
 * without throwing and that every scene / actor / music cue executes. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---- minimal 2D context stub ----
function makeCtx() {
  const noop = () => {};
  return new Proxy({
    canvas: { width: 320, height: 180 },
    save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop, fillText: noop,
    beginPath: noop, moveTo: noop, lineTo: noop, arcTo: noop, arc: noop,
    ellipse: noop, closePath: noop, fill: noop, stroke: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({ setTransform: noop }),
    createImageData: () => ({ data: new Uint8ClampedArray(64) }),
    putImageData: noop, drawImage: noop, measureText: () => ({ width: 20 }),
    fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1, lineWidth: 1,
    font: '', textAlign: '', textBaseline: '', imageSmoothingEnabled: false,
    globalCompositeOperation: 'source-over', shadowColor: '', shadowBlur: 0,
  }, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => (t[k] = v, true) });
}

function makeCanvas() {
  return { width: 320, height: 180, style: {}, getContext: () => makeCtx() };
}

// ---- AudioContext stub ----
class GainStub { constructor(){ this.gain = param(); } connect(){} }
function param(){ return { value:0, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){}, setTargetAtTime(){} }; }
class AudioContextStub {
  constructor(){ this.currentTime = 0; this.sampleRate = 44100; this.destination = {}; this.state='running'; }
  createGain(){ return { gain: param(), connect(){} }; }
  createOscillator(){ return { frequency: param(), type:'', setPeriodicWave(){}, connect(){}, start(){}, stop(){} }; }
  createBufferSource(){ return { buffer:null, loop:false, connect(){}, start(){}, stop(){} }; }
  createBiquadFilter(){ return { type:'', frequency: param(), Q: param(), connect(){} }; }
  createDynamicsCompressor(){ return { threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(), connect(){} }; }
  createPeriodicWave(){ return {}; }
  createBuffer(){ return { getChannelData: () => new Float32Array(1024) }; }
  resume(){}
}

// ---- window / document / timers ----
const listeners = {};
let rafCbs = [];
const sandbox = {
  console,
  performance: { now: () => sandbox.__now },
  requestAnimationFrame: (cb) => { rafCbs.push(cb); return rafCbs.length; },
  cancelAnimationFrame: () => {},
  setTimeout: (fn, ms) => { sandbox.__timers.push({ fn, at: sandbox.__now + (ms||0) }); return sandbox.__timers.length; },
  clearTimeout: () => {},
  AudioContext: AudioContextStub, webkitAudioContext: AudioContextStub,
  devicePixelRatio: 2,
  DOMMatrix: function(){ this.a=1; this.d=1; },
  Float32Array, Uint8ClampedArray, Math, Object, Array, JSON, Proxy, Date, isNaN, parseInt, parseFloat, String, Number,
  __now: 0, __timers: [],
};
sandbox.window = sandbox;
sandbox.document = {
  getElementById: () => makeCanvas(),
  createElement: () => makeCanvas(),
  documentElement: { requestFullscreen(){} },
  fullscreenElement: null,
  addEventListener: (t, cb) => { (listeners[t] = listeners[t] || []).push(cb); },
};
sandbox.window.addEventListener = (t, cb) => { (listeners[t] = listeners[t] || []).push(cb); };
vm.createContext(sandbox);

// ---- load modules in order ----
const order = ['engine','display','audio','music','score','score2','scenes','actors','ui','director','play','play2','main'];
for (const m of order) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', m + '.js'), 'utf8');
  vm.runInContext(code, sandbox, { filename: m + '.js' });
}

// sanity on note frequencies
const A4 = sandbox.HE.noteToFreq('A4');
if (Math.abs(A4 - 440) > 0.5) throw new Error('A4 freq wrong: ' + A4);
const Eb4 = sandbox.HE.noteToFreq('Eb4');
const G4 = sandbox.HE.noteToFreq('G4');
console.log('freq check: A4=' + A4.toFixed(1) + ' Eb4=' + Eb4.toFixed(1) + ' G4=' + G4.toFixed(1));
if (!(G4 > Eb4)) throw new Error('note ordering wrong');

// scores present + well-formed
for (const s of ['act1','act2','act3','title']) {
  const song = sandbox.HE.SCORE[s];
  if (!song || !song.tracks || !song.tracks.length) throw new Error('missing score ' + s);
  for (const tr of song.tracks) if (!Array.isArray(tr.notes)) throw new Error('bad track in ' + s);
}
console.log('scores OK: act1/act2/act3/title tracks =',
  ['act1','act2','act3','title'].map(s => sandbox.HE.SCORE[s].tracks.length).join('/'));

// ---- drive: fire DOMContentLoaded then simulate interaction + frames ----
(listeners['DOMContentLoaded'] || []).forEach(cb => cb());
// user start (keydown)
(listeners['keydown'] || []).forEach(cb => cb({ key: 'Enter', preventDefault(){} }));

const game = sandbox.__HE_GAME;
if (!game) throw new Error('game not created');
game.runner.skip = true; // fast-forward long waits

const scenesSeen = new Set();
const origRender = game.stage.render.bind(game.stage);
game.stage.render = function(){ scenesSeen.add(this.scene); origRender(); };

// step time forward, pumping timers, RAF and auto-advancing dialogue
let frames = 0, guard = 0;
const DT = 1/60;
while (game.state !== 2 /*END*/ && guard < 200000) {
  guard++;
  sandbox.__now += DT * 1000;
  game.audio.currentTime = sandbox.__now / 1000;
  // run due timers (sequencer scheduling, onDone)
  const due = sandbox.__timers.filter(t => t.at <= sandbox.__now);
  sandbox.__timers = sandbox.__timers.filter(t => t.at > sandbox.__now);
  due.forEach(t => t.fn());
  // pump one animation frame
  const cbs = rafCbs; rafCbs = [];
  cbs.forEach(cb => cb(sandbox.__now));
  frames++;
  // auto-advance any waiting dialogue/keys
  if (game.runner && game.runner.waiting &&
     (game.runner.waiting.type === 'box' || game.runner.waiting.type === 'key')) {
    if (game.runner.waiting.type === 'box' && game.stage.ui.box) {
      game.stage.ui.box.shown = game.stage.ui.box.text.length;
      game.stage.ui.box.done = true;
    }
    game.runner.pressAdvance();
  }
}

if (game.state !== 2) throw new Error('play did not reach END (guard=' + guard + ', act=' + game.actIndex + ')');
console.log('scenes rendered:', [...scenesSeen].join(', '));
if (!['redcoast','control','sun','trisolaris','space'].some(s => scenesSeen.has(s)))
  throw new Error('no expected scenes shown: ' + [...scenesSeen]);
console.log('PLAY REACHED END after', game.actIndex + 1, 'acts,', frames, 'frames simulated.');
console.log('ALL HEADLESS TESTS PASSED');
