/* =====================================================================
   BERNARD'S KEEP-AWAY  —  Monkey in the Middle in the backyard
   ---------------------------------------------------------------------
   Nick and Giulia pass the ball; Bernard runs between them trying to
   steal it. Controller 1 is Nick, controller 2 is Giulia. With one
   controller the computer plays Giulia.

   SNES:  D-pad run · B fast pass · A lob · Y pump fake · X fast pass
          Mash B (or any face button) next to Bernard to tug the ball back
          START pause · SELECT back (from the title)
   Keys:  Nick  WASD · Space pass · E lob · Q fake
          Giulia arrows · Enter pass · Right Shift lob · . fake

   Extras: the ball changes every 6 passes (tennis → beach ball → squeaky),
   zoomies every 10 passes in a row, and a squirrel that Bernard can't ignore.

   QUICK EDIT GUIDE
     • Speeds, timings, points .... TUNE
     • Ball types ................. BALLS
     • Bernard's brain ............ updateBernard()
     • The yard ................... bakeYard() + drawFirePit()
     • Arcade hookup .............. window.KA = { start, stop, onQuit, state }
   ===================================================================== */
(() => {
'use strict';
const W = 960, H = 540;
const RS = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = ((h ^ (h >>> 13)) * 1274126177) | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

const TUNE = {
  roundTime: 120,
  kidSpeed: 225, cpuSpeed: 200,
  bernardSpeed: 172, bernardAccel: 850, stealTime: 0.7, stealReach: 36,
  passFast: 560, passLob: 330, lobPeak: 150, fastPeak: 16,
  catchReach: 50, pickReach: 26, biteReach: 30, biteHeight: 46,
  holdBold: 4.0,                // seconds holding before Bernard gets bold
  tugNeed: 6, bernardKeepMax: 6, // tug presses to win the ball back; he drops it after this many seconds anyway
  zoomEvery: 10, zoomTime: 6, ballEvery: 6,
  squirrelMin: 18, squirrelMax: 32
};
const BALLS = [
  { id: 'tennis', name: 'TENNIS BALL', mult: 1, speed: 1, peak: 1, r: 9,  col: '#C6FF1A', line: '#F4FFE0' },
  { id: 'beach',  name: 'BEACH BALL',  mult: 2, speed: .62, peak: 1.35, r: 17, col: '#FF5A5A', line: '#FFFFFF' },
  { id: 'squeak', name: 'SQUEAKY BALL', mult: 3, speed: 1.05, peak: .9, r: 10, col: '#FF7AD9', line: '#FFE3F6' }
];
// the yard (ground plane in screen space; y grows toward the camera)
const YARD = { x0: 78, x1: 882, y0: 168, y1: 512 };
const PIT = { x: 480, y: 338, r: 92 };

/* ---------------- canvas ---------------- */
const canvas = document.getElementById('ka-canvas');
if (!canvas) return;
canvas.width = W * RS; canvas.height = H * RS;
const ctx = canvas.getContext('2d');
ctx.setTransform(RS, 0, 0, RS, 0, 0);
function fitStage() {
  const stage = document.getElementById('ka-stage'); if (!stage) return;
  const vw = document.documentElement.clientWidth || innerWidth, vh = document.documentElement.clientHeight || innerHeight;
  let w = Math.max(280, vw - 8), h = w * 9 / 16; if (h > vh - 8) { h = Math.max(160, vh - 8); w = h * 16 / 9; }
  stage.style.width = Math.floor(w) + 'px'; stage.style.height = Math.floor(h) + 'px';
}

/* ---------------- art ---------------- */
const IMG = {};
for (const [k, src] of [['nic', '/art/spr-hop-nic.png'], ['nicHop', '/art/spr-hop-nic-hop.png'], ['giulia', '/art/spr-hop-giulia.png'], ['giuliaHop', '/art/spr-hop-giulia-hop.png'], ['bernard', '/art/spr-hop-bernard.png'], ['tennis', '/art/spr-hop-ball.png']]) { const i = new Image(); i.src = src; IMG[k] = i; }
const ready = k => IMG[k] && IMG[k].complete && IMG[k].naturalWidth > 0;
function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function ell(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); }
function fs(g, f, s, lw) { if (f) { g.fillStyle = f; g.fill(); } if (s) { g.strokeStyle = s; g.lineWidth = lw || 2; g.stroke(); } }
function font(sz, w) { return (w || 700) + ' ' + sz + 'px Fredoka, "Segoe UI", system-ui, sans-serif'; }
function text(g, s, x, y, sz, fill, stroke, align, lw) {
  g.font = font(sz); g.textAlign = align || 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || Math.max(3, sz / 6); g.strokeText(s, x, y); }
  g.fillStyle = fill; g.fillText(s, x, y);
}

/* ---- the backyard, baked once ---- */
let yardBG = null;
function bakeYard() {
  const c = document.createElement('canvas'); c.width = W * RS; c.height = H * RS; const g = c.getContext('2d'); g.scale(RS, RS);
  // beyond the wall: sky, gray-roofed houses, the road
  let gr = g.createLinearGradient(0, 0, 0, 90); gr.addColorStop(0, '#7FC1F0'); gr.addColorStop(1, '#CFE9FB'); g.fillStyle = gr; g.fillRect(0, 0, W, 112);
  for (let i = 0; i < 9; i++) { const x = -40 + i * 120 + (i % 2) * 18, w = 104, y = 34 + (i % 3) * 4;
    g.fillStyle = ['#E9DCC6', '#D8C6A8', '#EFE6D6'][i % 3]; g.fillRect(x + 8, y + 22, w - 16, 46);
    g.beginPath(); g.moveTo(x, y + 26); g.lineTo(x + w / 2, y); g.lineTo(x + w, y + 26); g.closePath(); g.fillStyle = ['#7C838C', '#6C737C', '#8A9098'][i % 3]; g.fill();
    g.fillStyle = 'rgba(40,60,80,.35)'; g.fillRect(x + 22, y + 36, 14, 12); g.fillRect(x + w - 36, y + 36, 14, 12); }
  for (let i = 0; i < 14; i++) { ell(g, i * 74 + 20, 76, 26, 16); fs(g, i % 2 ? '#5E9E4A' : '#6BAA52'); }
  g.fillStyle = '#6E7076'; g.fillRect(0, 84, W, 26); g.fillStyle = '#F2E9B0'; for (let x = 10; x < W; x += 60) g.fillRect(x, 96, 30, 3);
  // brick perimeter wall with stone caps and pilasters
  g.fillStyle = '#A2563F'; g.fillRect(0, 108, W, 62);
  for (let y = 112; y < 170; y += 9) for (let x = (y / 9 % 2) * 14 - 14; x < W; x += 28) { g.fillStyle = hash(x, y) < .5 ? '#B4614A' : '#9A4E39'; g.fillRect(x + 1, y, 26, 7); }
  g.fillStyle = '#D9D2C2'; g.fillRect(0, 104, W, 9); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 112, W, 3);
  for (let x = 40; x < W; x += 168) { g.fillStyle = '#8E4A36'; g.fillRect(x - 14, 100, 28, 70); g.fillStyle = '#E2DBCB'; g.fillRect(x - 18, 94, 36, 10); }
  // grass: Bermuda green with sun-scorched patches and mowing stripes
  gr = g.createLinearGradient(0, 168, 0, H); gr.addColorStop(0, '#6FAE45'); gr.addColorStop(1, '#5E9E3A'); g.fillStyle = gr; g.fillRect(0, 168, W, H - 168);
  for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.03)'; g.beginPath(); g.moveTo(i * 120 - 60, 168); g.lineTo(i * 120 + 60, 168); g.lineTo(i * 150 + 30, H); g.lineTo(i * 150 - 120, H); g.closePath(); g.fill(); }
  for (let i = 0; i < 26; i++) { const x = 90 + hash(i, 3) * 780, y = 190 + hash(i, 4) * 310, r = 18 + hash(i, 5) * 40; g.fillStyle = hash(i, 6) < .5 ? 'rgba(196,170,96,.35)' : 'rgba(160,150,80,.28)'; ell(g, x, y, r, r * .45); g.fill(); }
  for (let i = 0; i < 260; i++) { const x = hash(i, 7) * W, y = 172 + hash(i, 8) * (H - 172); g.strokeStyle = hash(i, 9) < .5 ? 'rgba(40,90,30,.45)' : 'rgba(150,200,90,.4)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (hash(i, 10) - .5) * 4, y - 5); g.stroke(); }
  // wood side fence (right) and brick side wall (left), seen at an angle
  for (let y = 120; y < H; y += 6) { const k = (y - 120) / (H - 120); g.fillStyle = (Math.floor(y / 6) % 2) ? '#A57C52' : '#93693F'; g.fillRect(W - 54 - k * 24, y, 54 + k * 24, 6); }
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(W - 58, 120, 4, H);
  for (let y = 120; y < H; y += 8) { const k = (y - 120) / (H - 120); g.fillStyle = (Math.floor(y / 8) % 2) ? '#A2563F' : '#94503A'; g.fillRect(0, y, 40 + k * 20, 8); }
  g.fillStyle = '#D9D2C2'; for (let y = 120; y < H; y += 1) { const k = (y - 120) / (H - 120); g.fillRect(36 + k * 20, y, 6, 1); }
  // house eave in the near corner + patio edge
  g.fillStyle = '#C9C2B5'; g.fillRect(0, H - 22, W, 22); g.fillStyle = 'rgba(0,0,0,.08)'; for (let x = 0; x < W; x += 64) g.fillRect(x, H - 22, 2, 22);
  g.fillStyle = '#4A4A52'; g.beginPath(); g.moveTo(0, H - 70); g.lineTo(150, H); g.lineTo(0, H); g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.moveTo(0, H - 70); g.lineTo(150, H); g.lineTo(190, H); g.lineTo(0, H - 96); g.closePath(); g.fill();
  yardBG = c;
}
// fire pit table ringed by six Adirondack chairs; drawn with the people so they sort by depth
function drawChair(g, x, y, ang) {
  g.save(); g.translate(x, y); const s = Math.cos(ang), fx = Math.sin(ang);
  ell(g, 0, 10, 24, 8); fs(g, 'rgba(0,0,0,.18)');
  g.fillStyle = '#F2EEE6'; g.strokeStyle = '#8A8072'; g.lineWidth = 1.5;
  for (let i = -2; i <= 2; i++) { rr(g, i * 8 - 3 + fx * 6, -40 - s * 6 - Math.abs(i) * -2, 7, 34, 3); g.fill(); g.stroke(); }
  rr(g, -22, -10, 44, 14, 4); g.fill(); g.stroke(); rr(g, -26, -16, 10, 6, 2); g.fill(); g.stroke(); rr(g, 16, -16, 10, 6, 2); g.fill(); g.stroke();
  g.restore();
}
function drawFirePit(g, t) {
  const { x, y } = PIT;
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * TAU / 6 + .25, cx = x + Math.cos(a) * 82, cy = y + Math.sin(a) * 50; if (cy < y) drawChair(g, cx, cy, a); }
  ell(g, x, y + 12, 52, 20); fs(g, 'rgba(0,0,0,.22)');
  rr(g, x - 46, y - 18, 92, 30, 10); fs(g, '#8D8780', '#5E5852', 2);
  ell(g, x, y - 18, 46, 15); fs(g, '#A9A39B', '#5E5852', 2); ell(g, x, y - 18, 28, 8); fs(g, '#3A3632');
  for (let i = 0; i < 5; i++) { const fx = x - 14 + i * 7, h = 12 + Math.sin(t * 9 + i * 1.7) * 5 + (i % 2) * 5; g.beginPath(); g.moveTo(fx - 5, y - 18); g.quadraticCurveTo(fx, y - 18 - h * 1.3, fx + 5, y - 18); g.fillStyle = i % 2 ? '#FFB347' : '#FF6A2A'; g.fill(); }
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * TAU / 6 + .25, cx = x + Math.cos(a) * 82, cy = y + Math.sin(a) * 50; if (cy >= y) drawChair(g, cx, cy, a); }
}

/* ---------------- audio ---------------- */
let ac = null, soundOn = true;
function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (ac && ac.state === 'suspended') ac.resume(); return ac; }
function tone(f, d, type, vol, slide) { if (!soundOn || !audio()) return; try { const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d); g.gain.setValueAtTime(vol || .05, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d); } catch (e) { } }
function noise(d, vol, f0, f1) { if (!soundOn || !audio()) return; try { const t = ac.currentTime, n = ac.createBufferSource(), b = ac.createBuffer(1, Math.max(1, ac.sampleRate * d | 0), ac.sampleRate), x = b.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / x.length, 2); n.buffer = b; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(f0 || 500, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + d); f.Q.value = 1.6; const g = ac.createGain(); g.gain.value = vol || .2; n.connect(f); f.connect(g); g.connect(ac.destination); n.start(t); } catch (e) { } }
const sfx = {
  pass: () => noise(.16, .12, 900, 2400), lob: () => { noise(.3, .1, 500, 1400); tone(380, .25, 'triangle', .03, 620); },
  catch: () => { tone(660, .07, 'square', .05); setTimeout(() => tone(990, .09, 'square', .045), 60); },
  squeak: () => { tone(1500, .12, 'square', .045, 2400); setTimeout(() => tone(2200, .1, 'square', .04, 1400), 110); },
  bark: () => { noise(.13, .32, 420, 190); tone(150, .12, 'square', .05, 95); },
  steal: () => { tone(220, .3, 'sawtooth', .06, 90); noise(.25, .15, 300, 150); },
  tug: () => tone(300 + Math.random() * 200, .05, 'square', .035),
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, .18, 'square', .045), i * 80)),
  zoom: () => { for (let i = 0; i < 6; i++) setTimeout(() => tone(400 + i * 120, .08, 'square', .04), i * 50); },
  squirrel: () => { for (let i = 0; i < 5; i++) setTimeout(() => tone(1800 + Math.random() * 600, .04, 'square', .03), i * 70); },
  bounce: () => tone(180, .08, 'sine', .08, 120), whistle: () => { tone(1700, .35, 'sine', .05, 1500); }
};

/* ---------------- input: two pads + keyboard ---------------- */
const keys = {}, latch = {}; // latch: a tap that started and ended between two frames still counts
const KEYMAP = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', pass: 'Space', lob: 'KeyE', fake: 'KeyQ' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', pass: 'Enter', lob: 'ShiftRight', fake: 'Period' }
];
let p2KeysUsed = false, autoBoth = false; // autoBoth: test hook, the computer plays both kids
const PADS = [mkIn(), mkIn()];
function mkIn() { return { x: 0, y: 0, pass: false, lob: false, fake: false, any: false, start: false, select: false, prev: {}, hit: {} }; }
function readPads() {
  const K = {}; for (const c in keys) if (keys[c]) K[c] = true; for (const c in latch) if (latch[c]) K[c] = true;
  let list = []; try { list = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(g => g && g.connected !== false && g.buttons && g.buttons.length); } catch (e) { }
  list.sort((a, b) => a.index - b.index);
  for (let p = 0; p < 2; p++) {
    const I = PADS[p], gp = list[p], k = KEYMAP[p];
    let x = 0, y = 0, pass = false, lob = false, fake = false, start = false, select = false;
    if (gp) {
      const B = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > .5)), ax = gp.axes || [];
      if (B(14) || ax[0] < -.45) x -= 1; if (B(15) || ax[0] > .45) x += 1; if (B(12) || ax[1] < -.45) y -= 1; if (B(13) || ax[1] > .45) y += 1;
      const h = ax[9]; if (typeof h === 'number' && h >= -1.01 && h <= 1.01 && Math.abs(h) > .05 && ax.length >= 10) { const d = Math.round((h + 1) / .2857); if (d === 7 || d === 0 || d === 1) y = -1; if (d >= 1 && d <= 3) x = 1; if (d >= 3 && d <= 5) y = 1; if (d >= 5 && d <= 7) x = -1; }
      pass = B(0) || B(3); lob = B(1); fake = B(2); start = B(9); select = B(8);
    }
    if (K[k.left]) x -= 1; if (K[k.right]) x += 1; if (K[k.up]) y -= 1; if (K[k.down]) y += 1;
    pass = pass || !!K[k.pass]; lob = lob || !!K[k.lob]; fake = fake || !!K[k.fake];
    if (p === 0) { start = start || !!K.Escape || !!K.KeyP; select = select || !!K.Backspace; }
    if (p === 0 && touch.on) { x += touch.x; y += touch.y; pass = pass || touch.pass; lob = lob || touch.lob; }
    const n = { pass, lob, fake, start, select, any: pass || lob || fake };
    for (const key in n) I.hit[key] = n[key] && !I.prev[key];
    I.prev = n; Object.assign(I, n);
    const m = Math.hypot(x, y); I.x = m > 1 ? x / m : x; I.y = m > 1 ? y / m : y;
    I.connected = !!gp;
  }
  PADS.count = list.length;
  for (const c in latch) latch[c] = false;
}
// Android TV often leaves e.code as "Unidentified" and only fills e.key
const KEYNAME = { ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Enter: 'Enter', ' ': 'Space', Escape: 'Escape', Shift: 'ShiftRight', '.': 'Period', w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', e: 'KeyE', q: 'KeyQ', p: 'KeyP', m: 'KeyM' };
const codeOf = e => (e.code && e.code !== 'Unidentified') ? e.code : (KEYNAME[e.key] || KEYNAME[(e.key || '').toLowerCase()] || e.key);
const onKeyDown = e => {
  const ev = e; e = { code: codeOf(ev), repeat: ev.repeat };
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.code)) ev.preventDefault();
  keys[e.code] = true; if (!e.repeat) latch[e.code] = true; audio();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'ShiftRight', 'Period'].includes(e.code) && state === 'play') p2KeysUsed = true;
  if (e.code === 'KeyM' && !e.repeat) soundOn = !soundOn;
};
const onKeyUp = e => { keys[codeOf(e)] = false; };
const onBlur = () => { for (const k in keys) keys[k] = false; };
// phones: drag on the left half to run, tap the right half to pass (two-finger tap = lob)
const touch = { on: false, x: 0, y: 0, pass: false, lob: false, id: null, ox: 0, oy: 0 };
function bindTouch() {
  canvas.addEventListener('touchstart', e => { touch.on = true; audio(); const r = canvas.getBoundingClientRect(); for (const t of e.changedTouches) { const lx = (t.clientX - r.left) / r.width; if (lx < .5 && touch.id === null) { touch.id = t.identifier; touch.ox = t.clientX; touch.oy = t.clientY; } else { if (e.touches.length > 1 && lx >= .5) touch.lob = true; else touch.pass = true; } } e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === touch.id) { touch.x = clamp((t.clientX - touch.ox) / 40, -1, 1); touch.y = clamp((t.clientY - touch.oy) / 40, -1, 1); } e.preventDefault(); }, { passive: false });
  const end = e => { for (const t of e.changedTouches) if (t.identifier === touch.id) { touch.id = null; touch.x = touch.y = 0; } touch.pass = false; touch.lob = false; };
  canvas.addEventListener('touchend', end); canvas.addEventListener('touchcancel', end);
}

/* ---------------- game state ---------------- */
let state = 'title', time = 0, menuIdx = 0, best = 0;
let kids = [], dog = null, ball = null, score = 0, streak = 0, bestStreak = 0, passes = 0, steals = 0, timer = 0, ballKind = 0;
let particles = [], floats = [], banner = null, squirrel = null, squirrelT = 0, shake = 0, flash = 0, endT = 0, pauseIdx = 0;
try { best = +localStorage.getItem('ka_best') || 0; } catch (e) { }

function newKid(who, x, y, pad) { return { who, x, y, vx: 0, vy: 0, pad, cpu: false, face: who === 'nic' ? 1 : -1, hold: 0, catchCool: 0, run: 0, tug: 0, tugT: 0, bubble: null, aimFrom: null }; }
function resetRound() {
  kids = [newKid('nic', 230, 340, 0), newKid('giulia', 730, 340, 1)];
  dog = { x: 480, y: 220, vx: 0, vy: 0, face: 1, has: false, keepT: 0, stealT: 0, commit: 0, stun: 0, zoom: 0, zoomAng: 0, bold: 0, chase: 0, bubble: null, hop: 0, run: 0 };
  ball = { x: 0, y: 0, z: 0, state: 'held', holder: kids[0], flight: null, vx: 0, vy: 0, vz: 0, spin: 0 };
  score = 0; streak = 0; bestStreak = 0; passes = 0; steals = 0; timer = TUNE.roundTime; ballKind = 0;
  particles = []; floats = []; banner = { text: 'KEEP IT AWAY FROM BERNARD!', life: 2.2 }; squirrel = null; squirrelT = rnd(TUNE.squirrelMin, TUNE.squirrelMax);
  p2KeysUsed = false;
}
const BK = () => BALLS[ballKind];
function teammate(k) { return k === kids[0] ? kids[1] : kids[0]; }
function say(who, txt, life) { who.bubble = { text: txt, life: life || 1.2 }; }
function float(x, y, txt, col) { floats.push({ x, y, txt, col: col || '#FFF6C9', life: 1.1 }); }
function puff(x, y, n, col, up) { for (let i = 0; i < n; i++) particles.push({ x, y, vx: rnd(-60, 60), vy: rnd(-90, -10) * (up || 1), life: rnd(.3, .7), max: .7, r: rnd(2, 5), col }); }

/* ---------------- throwing and catching ---------------- */
function throwBall(k, lob, fake) {
  const to = teammate(k), K = BK();
  if (fake) { // pump fake: Bernard bites on it and commits the wrong way
    k.aimFrom = { t: .25 };
    if (dog.stun <= 0 && !dog.has && dist(dog, k) < 260) { dog.commit = .7; const mx = (k.x + to.x) / 2, my = (k.y + to.y) / 2; dog.lunge = { x: mx + rnd(-40, 40), y: my + rnd(-30, 30) }; say(dog, pick(['?!', 'Huh?', 'Wait…']), .9); float(k.x, k.y - 110, 'FAKE!', '#9EE8FF'); score += 5; }
    return;
  }
  // lead the receiver a little
  const flight0 = Math.max(.25, Math.hypot(to.x - k.x, to.y - k.y) / ((lob ? TUNE.passLob : TUNE.passFast) * K.speed));
  const tx = clamp(to.x + to.vx * flight0 * .6, YARD.x0, YARD.x1), ty = clamp(to.y + to.vy * flight0 * .6, YARD.y0 + 10, YARD.y1);
  const d = Math.hypot(tx - k.x, ty - k.y), T = Math.max(.25, d / ((lob ? TUNE.passLob : TUNE.passFast) * K.speed));
  ball.state = 'air'; ball.holder = null; ball.lastLob = !!lob;
  ball.flight = { x0: k.x + k.face * 10, y0: k.y - 2, x1: tx, y1: ty, t: 0, T, peak: (lob ? TUNE.lobPeak : TUNE.fastPeak + d * .03) * K.peak, lob, from: k, to, z0: 38 };
  k.hold = 0; k.catchCool = .35; k.aimFrom = { t: .25 };
  if (K.id === 'squeak') sfx.squeak(); else (lob ? sfx.lob : sfx.pass)();
}
function giveBall(k) {
  const prev = ball.flight && ball.flight.from;
  const wasPass = ball.state === 'air' && prev && prev !== k;
  ball.state = 'held'; ball.holder = k; ball.flight = null; k.hold = 0; k.grace = .8; // a moment to look before he can snatch it
  if (wasPass) {
    streak++; passes++; bestStreak = Math.max(bestStreak, streak);
    const K = BK(), base = ball.lastLob ? 1 : 2, mult = K.mult * (1 + Math.floor(streak / 5) * .5), pts = Math.round(10 * base * mult);
    score += pts; float(k.x, k.y - 112, '+' + pts + (streak > 1 ? '  x' + streak : ''), streak >= 10 ? '#FFD23F' : '#DFFF8A');
    sfx.catch(); if (K.id === 'squeak') sfx.squeak(); puff(k.x, k.y - 50, 8, '#FFF3A0');
    if (streak % TUNE.zoomEvery === 0) startZoomies();
    if (passes % TUNE.ballEvery === 0) nextBall();
    if (streak === 5 || streak === 15 || streak === 25) { banner = { text: streak + ' IN A ROW!', life: 1.4 }; sfx.win(); }
  } else sfx.catch();
}
function nextBall() {
  ballKind = (ballKind + 1) % BALLS.length; const K = BK();
  banner = { text: K.name + '!  x' + K.mult + ' POINTS', life: 1.8, col: K.col };
  if (K.id === 'squeak') { sfx.squeak(); say(dog, 'SQUEAKY?!?!', 1.4); dog.bold = 3; } else if (K.id === 'beach') say(dog, 'BIG BALL!!', 1.2);
  flash = .25;
}
function startZoomies() { dog.zoom = TUNE.zoomTime; dog.zoomAng = Math.atan2(dog.y - 340, dog.x - 480); banner = { text: 'ZOOMIES!!', life: 1.6, col: '#FFB347' }; say(dog, pick(['ZOOMIES!!', 'WHEEEE!', 'RUN RUN RUN!']), 1.5); sfx.zoom(); shake = 6; }
function dogGetsBall(how) {
  if (BK().id === 'beach' && how !== 'tug') { // he can't bite a beach ball: he noses it away instead
    ball.state = 'ground'; ball.holder = null; ball.flight = null; const a = rnd(0, TAU); ball.vx = Math.cos(a) * 260; ball.vy = Math.sin(a) * 160; ball.vz = 260; ball.z = Math.max(ball.z, 10); dog.stun = .5;
    say(dog, 'BOOP!', .9); sfx.bounce(); float(dog.x, dog.y - 100, 'BOOP!', '#FFB3B3'); return;
  }
  for (const k of kids) if (ball.holder === k) k.hold = 0;
  ball.state = 'dog'; ball.holder = null; ball.flight = null; dog.has = true; dog.keepT = 0; steals++;
  if (streak >= 3) float(dog.x, dog.y - 120, 'STREAK LOST', '#FF9A8A');
  streak = 0; shake = 8; sfx.steal(); setTimeout(sfx.bark, 140);
  say(dog, pick(['MINE!!', 'GOT IT!', 'HEHEHE', 'WOOF!']), 1.3);
  for (const k of kids) { k.tug = 0; if (!k.cpu) say(k, pick(['Hey!', 'Bernard!!', 'Nooo!']), 1); }
}
function dogDrops(reason) {
  dog.has = false; ball.state = 'ground'; ball.holder = null; ball.x = dog.x + dog.face * 20; ball.y = dog.y + 4; ball.z = 18; const a = rnd(0, TAU); ball.vx = Math.cos(a) * 120; ball.vy = Math.sin(a) * 80; ball.vz = 180;
  dog.stun = reason === 'tug' ? 1.0 : .4; sfx.bounce();
}

/* ---------------- update ---------------- */
function keepIn(e, pad) { e.x = clamp(e.x, YARD.x0 + (pad || 0), YARD.x1 - (pad || 0)); e.y = clamp(e.y, YARD.y0, YARD.y1); const dx = e.x - PIT.x, dy = (e.y - PIT.y) * 1.65, d = Math.hypot(dx, dy); if (d < PIT.r) { const k = PIT.r / (d || 1); e.x = PIT.x + dx * k; e.y = PIT.y + dy * k / 1.65; } }
function moveTo(e, tx, ty, speed, dt, accel) { const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy); const wantX = d > 4 ? dx / d * speed : 0, wantY = d > 4 ? dy / d * speed : 0, a = (accel || 1600) * dt; e.vx += clamp(wantX - e.vx, -a, a); e.vy += clamp(wantY - e.vy, -a, a); }
function updateKid(k, dt) {
  const I = PADS[k.pad], ctrl = !k.cpu;
  k.catchCool = Math.max(0, k.catchCool - dt); k.grace = Math.max(0, (k.grace || 0) - dt); if (k.aimFrom) { k.aimFrom.t -= dt; if (k.aimFrom.t <= 0) k.aimFrom = null; }
  if (k.bubble) { k.bubble.life -= dt; if (k.bubble.life <= 0) k.bubble = null; }
  const holding = ball.state === 'held' && ball.holder === k;
  if (ctrl) {
    const sp = TUNE.kidSpeed * (holding ? .92 : 1);
    k.vx = lerp(k.vx, I.x * sp, Math.min(1, dt * 14)); k.vy = lerp(k.vy, I.y * sp, Math.min(1, dt * 14));
    if (holding) { if (I.hit.pass) throwBall(k, false); else if (I.hit.lob) throwBall(k, true); else if (I.hit.fake) throwBall(k, false, true); }
    if (dog.has && dist(k, dog) < 60 && I.hit.any) { k.tug++; k.tugT = .6; sfx.tug(); puff((k.x + dog.x) / 2, dog.y - 30, 3, '#FFFFFF'); if (k.tug >= TUNE.tugNeed) { k.tug = 0; dogDrops('tug'); say(k, pick(['GOT IT!', 'Let go!', 'Ha!']), 1); float(dog.x, dog.y - 110, 'TUG WIN!', '#C6FF3D'); score += 25; } }
  } else cpuKid(k, dt, holding);
  if (k.tugT > 0) { k.tugT -= dt; if (k.tugT <= 0) k.tug = Math.max(0, k.tug - 2); }
  k.x += k.vx * dt; k.y += k.vy * dt; keepIn(k, 6);
  const m = Math.hypot(k.vx, k.vy); if (m > 30) { k.face = k.vx > 8 ? 1 : k.vx < -8 ? -1 : k.face; k.run += dt * (6 + m / 40); if (Math.random() < dt * 8) puff(k.x, k.y, 1, 'rgba(120,170,80,.8)', .4); } else k.run = 0;
  if (holding) { k.hold += dt; ball.x = k.x + k.face * 16; ball.y = k.y - 1; ball.z = 34; }
}
function cpuKid(k, dt, holding) {
  const mate = teammate(k);
  if (holding) {
    // look for a lane: lob if Bernard is between us, otherwise a fast pass after a beat
    k.vx *= .8; k.vy *= .8; k.think = (k.think || rnd(.45, 1.0)) - dt;
    const ax = mate.x - k.x, ay = mate.y - k.y, L = Math.hypot(ax, ay) || 1, t = clamp(((dog.x - k.x) * ax + (dog.y - k.y) * ay) / (L * L), 0, 1);
    const blocked = Math.hypot(k.x + ax * t - dog.x, k.y + ay * t - dog.y) < 70;
    if (dist(k, dog) < 70 || k.think <= 0) { k.think = 0; if (blocked) throwBall(k, true); else throwBall(k, false); }
    return;
  }
  if (dog.has) { moveTo(k, dog.x - dog.face * 30, dog.y + 6, TUNE.cpuSpeed, dt); if (dist(k, dog) < 60) { k.cpuTug = (k.cpuTug || 0) - dt; if (k.cpuTug <= 0) { k.cpuTug = .19; k.tug++; k.tugT = .6; sfx.tug(); if (k.tug >= TUNE.tugNeed) { k.tug = 0; dogDrops('tug'); say(k, 'Got it!', 1); } } } return; }
  if (ball.state === 'ground') { moveTo(k, ball.x, ball.y, TUNE.cpuSpeed, dt); return; }
  if (ball.state === 'air' && ball.flight.to === k) { moveTo(k, ball.flight.x1, ball.flight.y1, TUNE.cpuSpeed, dt); return; }
  // get open: head for the far side of the yard from the holder, slid away from Bernard's lane
  const h = ball.holder || mate;
  let tx = 960 - h.x, ty = 680 - h.y;                         // mirror the holder across the fire pit
  if (Math.abs(tx - h.x) < 320) tx = h.x < 480 ? h.x + 380 : h.x - 380;
  const side = (dog.y > (h.y + ty) / 2) ? -1 : 1; ty += side * 50;   // step off the line Bernard is standing on
  if (!k.spot || Math.random() < dt * .6 || Math.hypot(k.spot.x - tx, k.spot.y - ty) > 160) k.spot = { x: clamp(tx + rnd(-40, 40), YARD.x0 + 30, YARD.x1 - 30), y: clamp(ty + rnd(-30, 30), YARD.y0 + 24, YARD.y1 - 12) };
  moveTo(k, k.spot.x, k.spot.y, TUNE.cpuSpeed * .9, dt);
}
function updateBernard(dt) {
  const D = dog; if (D.bubble) { D.bubble.life -= dt; if (D.bubble.life <= 0) D.bubble = null; }
  D.zoom = Math.max(0, D.zoom - dt); D.commit = Math.max(0, D.commit - dt); D.stun = Math.max(0, D.stun - dt); D.bold = Math.max(0, D.bold - dt); D.hop = Math.max(0, D.hop - dt * 3);
  const K = BK(); let speed = TUNE.bernardSpeed * (1 + (TUNE.roundTime - timer) / TUNE.roundTime * .22) * (K.id === 'squeak' ? 1.18 : 1) * (D.bold > 0 ? 1.15 : 1);
  if (D.zoom > 0) speed *= 1.65;
  let tx = D.x, ty = D.y;
  if (D.stun > 0) { D.vx *= .85; D.vy *= .85; }
  else if (squirrel && squirrel.chased) { tx = squirrel.x; ty = YARD.y0 + 6; speed *= 1.25; if (D.has) dogDrops('squirrel'); }
  else if (D.commit > 0 && D.lunge) { tx = D.lunge.x; ty = D.lunge.y; speed *= 1.3; }
  else if (D.zoom > TUNE.zoomTime - 1.6) { D.zoomAng += dt * 3.2; tx = 480 + Math.cos(D.zoomAng) * 300; ty = 340 + Math.sin(D.zoomAng) * 140; }
  else if (D.has) { // keep-away from the kids: run from the nearest one
    D.keepT += dt; let fx = 0, fy = 0; for (const k of kids) { const dx = D.x - k.x, dy = D.y - k.y, d = Math.hypot(dx, dy) || 1; fx += dx / d * (300 / d); fy += dy / d * (300 / d); }
    fx += (480 - D.x) * .004; fy += (340 - D.y) * .004; tx = D.x + fx * 120 + Math.sin(time * 2) * 30; ty = D.y + fy * 120; speed *= .92;
    if (D.keepT > TUNE.bernardKeepMax) { dogDrops('bored'); say(D, 'Okay fine.', 1); }
  } else if (ball.state === 'air') { // read the throw: fast passes he cuts off, lobs he waits under
    const F = ball.flight; if (F.lob) { const p = clamp(F.t / F.T, 0, 1); tx = lerp(lerp(F.x0, F.x1, .5), F.x1, p * .7); ty = lerp(lerp(F.y0, F.y1, .5), F.y1, p * .7); speed *= .8; }
    else { let bestT = 1; for (let s = F.t / F.T + .05; s <= 1; s += .05) { const px = lerp(F.x0, F.x1, s), py = lerp(F.y0, F.y1, s), tReach = Math.hypot(px - D.x, py - D.y) / speed, tBall = (s - F.t / F.T) * F.T; if (tReach < tBall) { bestT = s; break; } } tx = lerp(F.x0, F.x1, bestT); ty = lerp(F.y0, F.y1, bestT); }
  } else if (ball.state === 'ground') { tx = ball.x; ty = ball.y; speed *= 1.08; }
  else if (ball.state === 'held') { // cut the passing lane, then pressure the holder
    const h = ball.holder, m = teammate(h), bold = h.hold > TUNE.holdBold;
    if (bold && !D.boldSaid) { D.boldSaid = true; say(D, pick(['THROW IT!', 'Gimme gimme!']), 1.1); sfx.bark(); }
    if (!bold) D.boldSaid = false;
    const lane = .42 + Math.sin(time * 1.3) * .12; tx = lerp(h.x, m.x, lane) + Math.sin(time * 3.1) * 26; ty = lerp(h.y, m.y, lane) + Math.cos(time * 2.3) * 20;
    if (dist(D, h) < 150 || bold) { tx = h.x - h.face * 10; ty = h.y; speed *= bold ? 1.2 : 1.05; }
    if (dist(D, h) < TUNE.stealReach && !(h.grace > 0)) { D.stealT += dt; if (D.stealT > TUNE.stealTime) { D.stealT = 0; dogGetsBall('steal'); } } else D.stealT = Math.max(0, D.stealT - dt * 2);
  }
  if (D.stun <= 0) moveTo(D, tx, ty, speed, dt, TUNE.bernardAccel * (D.zoom > 0 ? 1.4 : 1));
  D.x += D.vx * dt; D.y += D.vy * dt; keepIn(D, 8);
  if (Math.abs(D.vx) > 12) D.face = D.vx > 0 ? 1 : -1; const m = Math.hypot(D.vx, D.vy); D.run = m > 30 ? D.run + dt * (8 + m / 35) : 0;
  if (m > 120 && Math.random() < dt * 10) puff(D.x - D.face * 20, D.y, 1, D.zoom > 0 ? 'rgba(255,200,120,.9)' : 'rgba(120,170,80,.8)', .4);
  if (D.has) { ball.x = D.x + D.face * 30; ball.y = D.y - 1; ball.z = 30; }
}
function updateBall(dt) {
  const K = BK(); ball.spin += dt * (ball.state === 'air' ? 14 : 4);
  if (ball.state === 'air') {
    const F = ball.flight; F.t += dt; const s = clamp(F.t / F.T, 0, 1);
    ball.x = lerp(F.x0, F.x1, s); ball.y = lerp(F.y0, F.y1, s); ball.z = lerp(F.z0, 30, s) + F.peak * 4 * s * (1 - s);
    for (const k of kids) if (k.catchCool <= 0 && k !== F.from && Math.hypot(ball.x - k.x, ball.y - k.y) < TUNE.catchReach + 8 && ball.z < 110 && s > .5) { giveBall(k); return; }
    // Bernard snatches it out of the air if it's low enough
    if (dog.stun <= 0 && !dog.has && dog.commit <= 0 && Math.hypot(ball.x - dog.x, ball.y - dog.y) < TUNE.biteReach + K.r && ball.z < TUNE.biteHeight + (dog.hop > 0 ? 30 : 0)) { dogGetsBall('air'); return; }
    if (dog.stun <= 0 && Math.hypot(ball.x - dog.x, ball.y - dog.y) < 70 && ball.z < 90 && dog.hop <= 0) dog.hop = 1; // he jumps for it
    if (s >= 1) { // nobody there: it hits the grass and rolls
      ball.state = 'ground'; ball.flight = null; const d = Math.hypot(F.x1 - F.x0, F.y1 - F.y0) || 1; ball.vx = (F.x1 - F.x0) / d * 160; ball.vy = (F.y1 - F.y0) / d * 100; ball.vz = K.id === 'beach' ? 220 : 120; ball.z = 30; sfx.bounce();
      if (streak >= 3) float(ball.x, ball.y - 70, 'DROPPED!', '#FFB3B3'); streak = 0;
    }
  } else if (ball.state === 'ground') {
    ball.vz -= (K.id === 'beach' ? 520 : 900) * dt; ball.z += ball.vz * dt; if (ball.z <= 0) { ball.z = 0; if (ball.vz < -60) { ball.vz *= -.45; sfx.bounce(); } else ball.vz = 0; }
    ball.x += ball.vx * dt; ball.y += ball.vy * dt; const fr = Math.pow(K.id === 'beach' ? .5 : .25, dt); ball.vx *= fr; ball.vy *= fr;
    if (ball.x < YARD.x0 || ball.x > YARD.x1) { ball.vx *= -.6; ball.x = clamp(ball.x, YARD.x0, YARD.x1); } if (ball.y < YARD.y0 || ball.y > YARD.y1) { ball.vy *= -.6; ball.y = clamp(ball.y, YARD.y0, YARD.y1); }
    const pdx = ball.x - PIT.x, pdy = (ball.y - PIT.y) * 1.65; if (Math.hypot(pdx, pdy) < PIT.r - 10 && ball.z < 20) { ball.vx = pdx * 3; ball.vy = pdy * 2; }
    if (ball.z < 24) {
      if (dog.stun <= 0 && Math.hypot(ball.x - dog.x, ball.y - dog.y) < TUNE.biteReach) { dogGetsBall('ground'); return; }
      for (const k of kids) if (k.catchCool <= 0 && Math.hypot(ball.x - k.x, ball.y - k.y) < TUNE.pickReach + 10) { ball.flight = null; giveBall(k); say(k, 'Mine!', .6); return; }
    }
  }
}
function updateSquirrel(dt) {
  if (!squirrel) { squirrelT -= dt; if (squirrelT <= 0) { const fromL = Math.random() < .5; squirrel = { x: fromL ? 60 : 900, dir: fromL ? 1 : -1, t: 0, chased: false, speed: rnd(150, 210) }; sfx.squirrel(); } return; }
  const S = squirrel; S.t += dt; S.x += S.dir * S.speed * dt;
  if (!S.chased && S.t > .5 && dog.stun <= 0 && dog.zoom <= 0) { S.chased = true; say(dog, 'SQUIRREL!!!', 1.6); sfx.bark(); setTimeout(sfx.bark, 220); banner = { text: 'SQUIRREL!  FREE PASSES!', life: 1.6, col: '#FFB347' }; }
  if (S.x < 30 || S.x > 930) { squirrel = null; squirrelT = rnd(TUNE.squirrelMin, TUNE.squirrelMax); dog.stun = .4; say(dog, 'Aww…', .8); }
}
function updatePlay(dt) {
  time += dt; readPads();
  if (PADS[0].hit.start) { state = 'pause'; pauseIdx = 0; return; }
  // Giulia is a person when a second controller is plugged in or her keys get used
  kids[1].cpu = autoBoth || !(PADS.count >= 2 || p2KeysUsed); kids[0].cpu = autoBoth;
  for (const k of kids) updateKid(k, dt);
  updateBernard(dt); updateBall(dt); updateSquirrel(dt);
  // kids shouldn't stack on each other
  const a = kids[0], b = kids[1], dd = dist(a, b); if (dd < 36) { const ux = (a.x - b.x) / (dd || 1), uy = (a.y - b.y) / (dd || 1); a.x += ux * (36 - dd) / 2; b.x -= ux * (36 - dd) / 2; a.y += uy * (36 - dd) / 2; b.y -= uy * (36 - dd) / 2; }
  const prevT = Math.ceil(timer); timer -= dt; if (Math.ceil(timer) !== prevT && timer <= 10 && timer > 0) tone(880, .06, 'square', .035);
  if (timer <= 0) { timer = 0; endRound(); }
  fx(dt);
}
function fx(dt) {
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; p.life -= dt; } particles = particles.filter(p => p.life > 0);
  for (const f of floats) { f.y -= 40 * dt; f.life -= dt; } floats = floats.filter(f => f.life > 0);
  if (banner) { banner.life -= dt; if (banner.life <= 0) banner = null; }
  shake = Math.max(0, shake - dt * 30); flash = Math.max(0, flash - dt);
}
function endRound() {
  state = 'end'; endT = 0; sfx.whistle(); setTimeout(sfx.win, 400);
  if (score > best) { best = score; try { localStorage.setItem('ka_best', String(best)); } catch (e) { } }
}
function update(dt) {
  if (state === 'title') { time += dt; readPads(); const I = PADS[0];
    if (I.hit.pass || I.hit.lob || I.hit.start || PADS[1].hit.pass) { audio(); resetRound(); state = 'play'; sfx.whistle(); }
    else if (I.hit.select) quit();
    if (dog) { dog.run += dt * 8; }
    fx(dt); return; }
  if (state === 'play') { updatePlay(dt); return; }
  if (state === 'pause') { readPads(); const I = PADS[0];
    const items = 3; if (keys.ArrowDown || I.y > .5) { if (!update.nav) { pauseIdx = (pauseIdx + 1) % items; update.nav = 1; tone(520, .05, 'square', .03); } } else if (keys.ArrowUp || I.y < -.5) { if (!update.nav) { pauseIdx = (pauseIdx + items - 1) % items; update.nav = 1; tone(520, .05, 'square', .03); } } else update.nav = 0;
    if (I.hit.pass || I.hit.lob) { if (pauseIdx === 0) state = 'play'; else if (pauseIdx === 1) { resetRound(); state = 'play'; } else quit(); }
    else if (I.hit.start) state = 'play';
    return; }
  if (state === 'end') { time += dt; endT += dt; readPads(); fx(dt); const I = PADS[0];
    if (endT > 1.2 && (I.hit.pass || I.hit.lob || I.hit.start)) { resetRound(); state = 'play'; sfx.whistle(); }
    else if (endT > 1.2 && I.hit.select) quit();
    return; }
}

/* ---------------- drawing ---------------- */
function shadow(x, y, rx, a) { ell(ctx, x, y, rx, rx * .32); fs(ctx, 'rgba(20,40,10,' + (a || .28) + ')'); }
function drawBubble(txt, x, y, life, bg) {
  ctx.save(); ctx.globalAlpha = clamp(life * 3, 0, 1); ctx.font = font(15); const w = ctx.measureText(txt).width + 22;
  rr(ctx, x - w / 2, y - 16, w, 30, 11); fs(ctx, bg || '#FFFFFF', '#2B1A10', 2.5); ctx.beginPath(); ctx.moveTo(x - 6, y + 13); ctx.lineTo(x, y + 24); ctx.lineTo(x + 7, y + 13); ctx.fillStyle = bg || '#FFFFFF'; ctx.fill();
  text(ctx, txt, x, y - 1, 15, '#2B1A10'); ctx.restore();
}
function drawKidSprite(k) {
  const run = k.run > 0, bob = run ? Math.abs(Math.sin(k.run)) * 5 : Math.sin(time * 2 + (k.who === 'nic' ? 0 : 2)) * 1.2;
  const img = IMG[run && Math.sin(k.run) > .3 ? (k.who === 'nic' ? 'nicHop' : 'giuliaHop') : k.who];
  const useImg = img && img.complete && img.naturalWidth ? img : IMG[k.who];
  shadow(k.x, k.y, 22);
  const h = 122, w = useImg && useImg.naturalWidth ? h * useImg.naturalWidth / useImg.naturalHeight : 44;
  ctx.save(); ctx.translate(k.x, k.y - bob); if (k.face < 0) ctx.scale(-1, 1); ctx.rotate(run ? Math.sin(k.run) * .05 : 0);
  if (useImg && useImg.naturalWidth) ctx.drawImage(useImg, -w / 2, -h, w, h); else { rr(ctx, -16, -90, 32, 60, 10); fs(ctx, k.who === 'nic' ? '#7A5A68' : '#FF8FB8'); ell(ctx, 0, -96, 16, 16); fs(ctx, '#D9A77A'); }
  ctx.restore();
  // name tag + controller tag
  const tag = k.who === 'nic' ? 'NICK' : 'GIULIA', col = k.who === 'nic' ? '#3AB8FF' : '#FF7AB8';
  ctx.save(); ctx.font = font(12); const tw = ctx.measureText(tag).width + 14; rr(ctx, k.x - tw / 2, k.y + 8, tw, 18, 9); fs(ctx, col); text(ctx, tag, k.x, k.y + 17.5, 12, '#FFFFFF');
  if (k.cpu) text(ctx, 'CPU', k.x, k.y + 36, 10, 'rgba(255,255,255,.75)', 'rgba(0,0,0,.45)', 'center', 3);
  ctx.restore();
  if (dog.has && dist(k, dog) < 60 && !k.cpu) text(ctx, 'MASH B!', k.x, k.y - 142, 16, '#C6FF3D', '#1F3A08', 'center', 4);
  if (k.tug > 0 && dog.has) { const f = k.tug / TUNE.tugNeed; rr(ctx, k.x - 26, k.y - 156, 52, 8, 4); fs(ctx, 'rgba(0,0,0,.4)'); rr(ctx, k.x - 26, k.y - 156, 52 * f, 8, 4); fs(ctx, '#C6FF3D'); }
}
function drawDog() {
  const D = dog, run = D.run > 0, bob = run ? Math.abs(Math.sin(D.run)) * 6 : 0, hop = Math.sin(D.hop * Math.PI) * 26;
  shadow(D.x, D.y, 30, .3 - hop * .004);
  const img = IMG.bernard, h = 112, w = img.naturalWidth ? h * img.naturalWidth / img.naturalHeight : 80;
  ctx.save(); ctx.translate(D.x, D.y - bob - hop); if (D.face > 0) ctx.scale(-1, 1); ctx.rotate(run ? Math.sin(D.run * .5) * .06 : 0);
  if (D.zoom > 0) { ctx.globalAlpha = .35; ctx.drawImage(img, -w / 2 + 18, -h, w, h); ctx.globalAlpha = 1; }
  if (img.naturalWidth) ctx.drawImage(img, -w / 2, -h, w, h); else { ell(ctx, 0, -40, 40, 26); fs(ctx, '#3A2A1E'); }
  ctx.restore();
  if (D.stun > .3 && D.stun < 1.2) text(ctx, '★', D.x + Math.sin(time * 10) * 14, D.y - 108, 18, '#FFE066', '#5A3A00', 'center', 3);
}
function drawBall() {
  const K = BK(), x = ball.x, y = ball.y, z = ball.z;
  if (ball.state === 'held' || ball.state === 'dog') { /* drawn at hand height */ }
  shadow(x, y, K.r * .9, .25);
  const by = y - z;
  if (K.id === 'tennis' && ready('tennis')) { ctx.save(); ctx.translate(x, by); ctx.rotate(ball.spin); ctx.drawImage(IMG.tennis, -K.r, -K.r, K.r * 2, K.r * 2); ctx.restore(); return; }
  ctx.save(); ctx.translate(x, by); ctx.rotate(ball.spin);
  ell(ctx, 0, 0, K.r, K.r); fs(ctx, K.col, '#2B1A10', 2);
  if (K.id === 'beach') { for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, K.r, i * TAU / 3, i * TAU / 3 + TAU / 6); ctx.closePath(); ctx.fillStyle = ['#FFFFFF', '#3AB8FF', '#FFD23F'][i]; ctx.fill(); } ell(ctx, 0, 0, K.r * .22, K.r * .22); fs(ctx, '#FFFFFF'); ell(ctx, 0, 0, K.r, K.r); fs(ctx, null, '#2B1A10', 2); }
  else { ctx.beginPath(); ctx.arc(-K.r * .3, 0, K.r * .7, -1.1, 1.1); ctx.strokeStyle = K.line; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
}
function drawSquirrel() {
  if (!squirrel) return; const S = squirrel, x = S.x, y = 100 + Math.abs(Math.sin(S.t * 14)) * -6;
  ctx.save(); ctx.translate(x, y); if (S.dir < 0) ctx.scale(-1, 1);
  ctx.beginPath(); ctx.moveTo(-10, -2); ctx.quadraticCurveTo(-30, -26, -14, -30); ctx.quadraticCurveTo(-4, -20, -8, -6); ctx.closePath(); fs(ctx, '#9A6A44', '#4A2A14', 1.5);
  ell(ctx, 0, -6, 12, 7); fs(ctx, '#A8774E', '#4A2A14', 1.5); ell(ctx, 11, -11, 6, 5); fs(ctx, '#A8774E', '#4A2A14', 1.5); ell(ctx, 13, -12, 1.4, 1.4); fs(ctx, '#111');
  ctx.restore();
}
function drawWorld() {
  ctx.drawImage(yardBG, 0, 0, W, H);
  drawSquirrel();
  // depth-sort the fire pit, kids, Bernard and the ball by their feet
  const list = [{ y: PIT.y + 8, draw: () => drawFirePit(ctx, time) }];
  for (const k of kids) list.push({ y: k.y, draw: () => drawKidSprite(k) });
  list.push({ y: dog.y, draw: drawDog });
  list.push({ y: ball.state === 'held' && ball.holder ? ball.holder.y + .5 : ball.state === 'dog' ? dog.y + .5 : ball.y, draw: drawBall });
  list.sort((a, b) => a.y - b.y); for (const o of list) o.draw();
  for (const p of particles) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.col; ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); } ctx.globalAlpha = 1;
  // bubbles on top
  for (const k of kids) if (k.bubble) drawBubble(k.bubble.text, k.x, k.y - 146, k.bubble.life);
  if (dog.bubble) drawBubble(dog.bubble.text, dog.x, dog.y - 138, dog.bubble.life, '#FFF3C4');
  for (const f of floats) { ctx.globalAlpha = clamp(f.life * 2, 0, 1); text(ctx, f.txt, f.x, f.y, 20, f.col, '#2B1A10', 'center', 5); } ctx.globalAlpha = 1;
  // pass guide: a faint dotted line from the holder to the teammate
  if (state === 'play' && ball.state === 'held' && ball.holder) { const h = ball.holder, m = teammate(h); ctx.save(); ctx.setLineDash([4, 10]); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(h.x, h.y - 30); ctx.lineTo(m.x, m.y - 30); ctx.stroke(); ctx.restore(); }
}
function panel(x, y, w, h) { rr(ctx, x, y, w, h, 12); fs(ctx, 'rgba(10,14,26,.78)', 'rgba(255,255,255,.18)', 1.5); }
function drawHUD() {
  panel(14, 10, 190, 52); text(ctx, 'SCORE', 28, 26, 11, '#9FB0D6', null, 'left'); text(ctx, String(score), 28, 46, 24, '#FFFFFF', null, 'left');
  text(ctx, 'BEST ' + best, 196, 26, 11, '#FFD23F', null, 'right');
  const K = BK(); panel(W / 2 - 92, 10, 184, 52); text(ctx, Math.ceil(timer) + 's', W / 2, 30, 24, timer <= 10 ? '#FF8A7A' : '#FFFFFF'); text(ctx, K.name + (K.mult > 1 ? '  x' + K.mult : ''), W / 2, 52, 11, K.col);
  panel(W - 204, 10, 190, 52); text(ctx, 'STREAK', W - 190, 26, 11, '#9FB0D6', null, 'left'); text(ctx, String(streak), W - 190, 46, 24, streak >= 10 ? '#FFD23F' : streak >= 5 ? '#C6FF3D' : '#FFFFFF', null, 'left');
  text(ctx, 'ZOOMIES IN ' + (TUNE.zoomEvery - streak % TUNE.zoomEvery), W - 24, 46, 10, '#FFB347', null, 'right');
  if (banner) { const a = clamp(banner.life * 2, 0, 1), sc = 1 + Math.max(0, banner.life - 1.4) * 1.5; ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, 112); ctx.scale(sc, sc); text(ctx, banner.text, 0, 0, 30, banner.col || '#FFF6C9', '#2B1A10', 'center', 7); ctx.restore(); }
  if (state === 'play' && ball.state === 'held' && ball.holder && !ball.holder.cpu && ball.holder.hold > .2) { const h = ball.holder; text(ctx, 'B pass · A lob · Y fake', h.x, h.y + 48, 11, 'rgba(255,255,255,.8)', 'rgba(0,0,0,.5)', 'center', 3); }
}
function drawTitle() {
  ctx.drawImage(yardBG, 0, 0, W, H);
  ctx.fillStyle = 'rgba(8,10,20,.55)'; ctx.fillRect(0, 0, W, H);
  text(ctx, "BERNARD'S", W / 2, 70, 30, '#FFFFFF', '#2B1A10', 'center', 7);
  ctx.save(); ctx.translate(W / 2, 122); ctx.rotate(-.03); text(ctx, 'KEEP-AWAY', 0, 0, 66, '#FFD23F', '#2B1A10', 'center', 12); ctx.restore();
  text(ctx, 'Monkey in the Middle: pass it back and forth, don\'t let Bernard get it!', W / 2, 172, 17, '#FFF6C9', 'rgba(0,0,0,.5)', 'center', 4);
  // the cast
  const show = (k, x, s, flip) => { const img = IMG[k]; if (!img.naturalWidth) return; const h = 170 * s, w = h * img.naturalWidth / img.naturalHeight; ctx.save(); ctx.translate(x, 400); if (flip) ctx.scale(-1, 1); ctx.drawImage(img, -w / 2, -h, w, h); ctx.restore(); };
  show('nic', 250, 1, false); show('giulia', 710, 1, true); show('bernard', 480, .95 + Math.abs(Math.sin(time * 3)) * .03, false);
  const ballY = 250 - Math.abs(Math.sin(time * 2.4)) * 60, ballX = 480 + Math.sin(time * 1.2) * 230; if (ready('tennis')) ctx.drawImage(IMG.tennis, ballX - 12, ballY - 12, 24, 24);
  // who's playing
  const two = PADS.count >= 2;
  panel(W / 2 - 300, 418, 600, 56);
  text(ctx, 'NICK: controller 1', W / 2 - 150, 438, 15, '#3AB8FF'); text(ctx, two ? 'GIULIA: controller 2' : 'GIULIA: computer (plug in a 2nd pad)', W / 2 + 150, 438, 15, '#FF7AB8');
  text(ctx, 'B fast pass · A lob · Y fake · mash B to tug it back', W / 2, 460, 13, '#B4C2E2');
  ctx.globalAlpha = .6 + Math.sin(time * 5) * .4; text(ctx, 'PRESS B TO PLAY', W / 2, 505, 24, '#C6FF3D', '#1F3A08', 'center', 6); ctx.globalAlpha = 1;
  text(ctx, 'Best: ' + best, W - 20, H - 16, 13, '#FFD23F', 'rgba(0,0,0,.5)', 'right', 3);
  text(ctx, 'SELECT: back to the arcade', 20, H - 16, 12, 'rgba(255,255,255,.6)', 'rgba(0,0,0,.5)', 'left', 3);
}
function drawEnd() {
  ctx.fillStyle = 'rgba(8,10,20,' + Math.min(.7, endT) + ')'; ctx.fillRect(0, 0, W, H);
  const p = clamp(endT * 2, 0, 1); ctx.save(); ctx.translate(W / 2, 250); ctx.scale(.7 + p * .3, .7 + p * .3);
  rr(ctx, -270, -170, 540, 330, 22); fs(ctx, 'rgba(12,16,30,.95)', '#FFD23F', 3);
  text(ctx, "TIME'S UP!", 0, -128, 40, '#FFD23F', '#2B1A10', 'center', 8);
  text(ctx, score >= best && score > 0 ? 'NEW BEST SCORE!' : 'Bernard needs a nap.', 0, -86, 17, score >= best && score > 0 ? '#C6FF3D' : '#B4C2E2');
  const rows = [['SCORE', score], ['PASSES', passes], ['BEST STREAK', bestStreak], ['BERNARD STOLE IT', steals + (steals === 1 ? ' time' : ' times')]];
  rows.forEach((r, i) => { text(ctx, r[0], -200, -40 + i * 40, 18, '#9FB0D6', null, 'left'); text(ctx, String(r[1]), 200, -40 + i * 40, 22, '#FFFFFF', null, 'right'); });
  if (endT > 1.2) { ctx.globalAlpha = .6 + Math.sin(time * 5) * .4; text(ctx, 'B: play again   ·   SELECT: arcade', 0, 128, 17, '#C6FF3D'); ctx.globalAlpha = 1; }
  ctx.restore();
}
function drawPause() {
  ctx.fillStyle = 'rgba(8,10,20,.6)'; ctx.fillRect(0, 0, W, H); text(ctx, 'PAUSED', W / 2, 170, 48, '#FFD23F', '#2B1A10', 'center', 9);
  ['Resume', 'Restart', 'Quit to Arcade'].forEach((s, i) => text(ctx, (i === pauseIdx ? '▶ ' : '') + s, W / 2, 250 + i * 46, 26, i === pauseIdx ? '#C6FF3D' : '#FFFFFF', '#2B1A10', 'center', 5));
}
function render() {
  ctx.save(); if (shake > 0) ctx.translate(Math.sin(time * 50) * shake * .6, Math.cos(time * 37) * shake * .4);
  if (state === 'title') drawTitle(); else { drawWorld(); drawHUD(); }
  ctx.restore();
  if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + flash * 1.6 + ')'; ctx.fillRect(0, 0, W, H); }
  if (state === 'pause') drawPause(); if (state === 'end') drawEnd();
}

/* ---------------- loop + arcade hookup ---------------- */
let raf = 0, last = 0, acc = 0, running = false;
function loop(ts) {
  if (!running) return; raf = requestAnimationFrame(loop);
  if (!last) last = ts; let dt = (ts - last) / 1000; last = ts; if (dt > .1) dt = .1; acc += dt;
  try { let n = 0; while (acc >= 1 / 60 && n < 4) { update(1 / 60); acc -= 1 / 60; n++; } render(); } catch (err) { if (window.console) console.error('keep-away frame', err); }
}
function quit() { if (typeof window.KA.onQuit === 'function') { stop(); window.KA.onQuit(); } else state = 'title'; }
function start() {
  if (running) return; running = true; if (!yardBG) bakeYard(); fitStage(); resetRound(); state = 'title'; time = 0;
  for (const I of PADS) { I.prev = { pass: true, lob: true, fake: true, start: true, select: true, any: true }; } // ignore the press that opened the game
  window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); window.addEventListener('blur', onBlur); window.addEventListener('resize', fitStage);
  last = 0; raf = requestAnimationFrame(loop);
}
function stop() { running = false; cancelAnimationFrame(raf); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur); window.removeEventListener('resize', fitStage); for (const k in keys) keys[k] = false; }
bindTouch();
window.KA = {
  start, stop, onQuit: null, get state() { return state; },
  // test hooks
  dbg() { return { state, score, streak, passes, steals, timer: +timer.toFixed(1), ball: ball.state, kind: BK().id, dog: { x: Math.round(dog.x), y: Math.round(dog.y), has: dog.has, zoom: +dog.zoom.toFixed(1) }, giuliaCpu: kids[1] && kids[1].cpu, squirrel: !!squirrel }; },
  pos() { return { kids: kids.map(k => ({ x: k.x, y: k.y, has: ball.state === 'held' && ball.holder === k })), dog: { x: dog.x, y: dog.y, has: dog.has }, ball: { x: ball.x, y: ball.y, z: ball.z, state: ball.state, to: ball.flight ? kids.indexOf(ball.flight.to) : -1, tx: ball.flight ? ball.flight.x1 : 0, ty: ball.flight ? ball.flight.y1 : 0 } }; },
  poster() { // card art: the yard, the three of them close together, ball in the air (used to make art/card-keep.jpg)
    if (!yardBG) bakeYard(); running = false; cancelAnimationFrame(raf);
    ctx.drawImage(yardBG, 0, 0, W, H);
    const put = (k, x, y, h, flip) => { const img = IMG[k]; if (!img.naturalWidth) return; const w = h * img.naturalWidth / img.naturalHeight; shadow(x, y, w * .32, .3); ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1); ctx.drawImage(img, -w / 2, -h, w, h); ctx.restore(); };
    put('nicHop', 372, 470, 230, false); put('giulia', 598, 486, 230, true); put('bernard', 488, 516, 200, true);
    if (ready('tennis')) { ctx.drawImage(IMG.tennis, 470, 168, 46, 46); }
    ctx.save(); ctx.setLineDash([3, 9]); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(410, 300); ctx.quadraticCurveTo(470, 140, 492, 190); ctx.stroke(); ctx.restore();
    for (let i = 0; i < 4; i++) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(492, 190, 30 + i * 6, -2.4 + i * .1, -1.6); ctx.stroke(); }
  },
  setTimer(t) { timer = t; }, autoplay(on) { autoBoth = !!on; }, squirrelNow() { squirrelT = 0; }, setStreak(n) { streak = n; }, nextBall
};
})();
