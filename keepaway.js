/* =====================================================================
   BERNARD'S KEEP-AWAY  —  Monkey in the Middle in the backyard
   ---------------------------------------------------------------------
   A match is three short rounds: Morning Fetch, Sprinkler Time and
   Golden Hour. The kids score by passing and catching; Bernard scores
   by stealing the ball and keeping it. Most points after round three wins.

   TWO WAYS TO PLAY (pick on the title screen)
     TEAM KIDS   controller 1 is Nick, controller 2 is Giulia (the
                 computer plays her with one controller). Bernard is the computer.
     BE BERNARD  controller 1 is Bernard. Controller 2 is Nick if it is
                 plugged in, otherwise the computer plays both kids.

   SNES, kids:    D-pad run · B fast pass · A lob · Y pump fake · X dash
                  mash any button next to Bernard to tug the ball back
   SNES, Bernard: D-pad run · B pounce · A bark · X or Y zoomies (when the meter is full)
                  mash B to hang on to the ball in a tug
   START pause · SELECT back (from the title)
   Keys:  player 1  WASD · Space pass / pounce · E lob / bark · Q fake / zoomies · Left Shift dash
          player 2  arrows · Enter pass · Right Shift lob · . fake · / dash        M mute

   QUICK EDIT GUIDE
     • Speeds, timings, points .... TUNE
     • Rounds and their looks ..... THEMES
     • Ball types ................. BALLS
     • Bernard's brain ............ cpuDog()
     • The yard ................... bakeYard()
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
const ease = t => t * t * (3 - 2 * t);

const TUNE = {
  roundTime: 40, rounds: 3,
  kidSpeed: 225, cpuSpeed: 200, dashSpeed: 560, dashTime: .17, dashCool: 1.1,
  dogSpeed: 182, dogHumanSpeed: 208, dogAccel: 850, stealTime: .6, stealTimeHuman: .45, stealReach: 36,
  pounceSpeed: 640, pounceTime: .3, pounceCool: 1.0, crouchTime: .32, barkCool: 3.5, barkReach: 180,
  passFast: 560, passLob: 400, lobPeak: 150, fastPeak: 16,
  catchReach: 50, pickReach: 26, biteReach: 30, biteHeight: 46,
  holdBold: 3.2,                 // seconds a kid can hold it before Bernard gets pushy
  tugNeed: 6, keepMax: 6,        // tug presses to win the ball back; he drops it after this many seconds anyway
  zoomTime: 5, hyperPerSec: .03, hyperPerCatch: .045,
  // points (all multiplied by the round number)
  catchPts: 10, streakPts: 2, streakCap: 10, closeCall: 15, overHead: 10, longBomb: 10, bullseye: 30, fakedOut: 15, tugWin: 20,
  stealPts: 60, keepPts: 10, fumblePts: 25,
  powerEvery: [7, 11], powerLife: 8, ringEvery: [6, 9], ringLife: 8,
  squirrelMin: 16, squirrelMax: 28
};
const BALLS = [
  { id: 'tennis', name: 'TENNIS BALL', speed: 1, peak: 1, r: 9, col: '#C6FF1A', line: '#F4FFE0' },
  { id: 'beach', name: 'BEACH BALL', speed: .8, peak: 1.3, r: 17, col: '#FF5A5A', line: '#FFFFFF' },
  { id: 'squeak', name: 'SQUEAKY BALL', speed: 1.06, peak: .9, r: 10, col: '#FF7AD9', line: '#FFE3F6' }
];
// one per round: what the yard looks like, which ball is in play and how fast Bernard is
const THEMES = [
  { id: 'morning', name: 'MORNING FETCH', ball: 0, dog: 1, sky: ['#6FB8F2', '#CFE9FB'], grass: ['#78BC4C', '#62A53C'], sun: [820, 44, 26, '#FFE680'], tip: 'Pass it back and forth. Don\'t let Bernard get it!' },
  { id: 'sprinkler', name: 'SPRINKLER TIME', ball: 1, dog: 1.07, sky: ['#3F9AEC', '#BCE0FA'], grass: ['#6CBF4E', '#52A03C'], sun: [480, 30, 30, '#FFF0A0'], sprinkler: true, tip: 'Bernard can\'t resist the sprinkler. All points x2!' },
  { id: 'sunset', name: 'GOLDEN HOUR', ball: 2, dog: 1.15, sky: ['#3B2C72', '#F0708A', '#FFC060'], grass: ['#6FA646', '#4F8A38'], sun: [150, 78, 40, '#FFB040'], lights: true, tint: 'rgba(255,120,40,.13)', tip: 'The squeaky ball drives him wild. All points x3!' }
];
// the yard (ground plane in screen space; y grows toward the camera)
const YARD = { x0: 78, x1: 882, y0: 186, y1: 508 };
const PIT = { x: 480, y: 344, r: 92 };

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

/* ---------------- art helpers ---------------- */
const IMG = {};
for (const [k, src] of [['nic', '/art/spr-hop-nic.png'], ['nicHop', '/art/spr-hop-nic-hop.png'], ['giulia', '/art/spr-hop-giulia.png'], ['giuliaHop', '/art/spr-hop-giulia-hop.png'], ['bernard', '/art/spr-hop-bernard.png'], ['tennis', '/art/spr-hop-ball.png'], ['bone', '/art/spr-hop-bone.png']]) { const i = new Image(); i.src = src; IMG[k] = i; }
const ready = k => IMG[k] && IMG[k].complete && IMG[k].naturalWidth > 0;
function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function ell(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, TAU); }
function fs(g, f, s, lw) { if (f) { g.fillStyle = f; g.fill(); } if (s) { g.strokeStyle = s; g.lineWidth = lw || 2; g.stroke(); } }
function font(sz, w) { return (w || 700) + ' ' + sz + 'px Fredoka, "Segoe UI", system-ui, sans-serif'; }
function text(g, s, x, y, sz, fill, stroke, align, lw) {
  g.font = font(sz); g.textAlign = align || 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || Math.max(3, sz / 6); g.strokeText(s, x, y); }
  g.fillStyle = fill; g.fillText(s, x, y);
}
function star(g, x, y, r, rot) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = (rot || 0) - Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .45 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); }
const INK = '#2B1A10';

/* ---- the backyard, baked once per round theme ---- */
const yardCache = {};
function tree(g, x, y, s, dark) { // round-topped tree; (x, y) is the foot of the trunk
  g.fillStyle = '#7A5230'; g.fillRect(x - 5 * s, y - 34 * s, 10 * s, 36 * s);
  for (const [dx, dy, r] of [[0, -62, 30], [-22, -46, 22], [22, -46, 22], [-10, -78, 20], [12, -80, 18]]) { ell(g, x + dx * s, y + dy * s, r * s, r * s * .92); fs(g, dark ? '#3F8A3A' : '#4C9E44'); }
  for (const [dx, dy, r] of [[-8, -70, 14], [14, -56, 11], [-20, -52, 9]]) { ell(g, x + dx * s, y + dy * s, r * s, r * s * .8); fs(g, dark ? '#55A248' : '#66B854'); }
}
function bakeYard(T) {
  const c = document.createElement('canvas'); c.width = W * RS; c.height = H * RS; const g = c.getContext('2d'); g.scale(RS, RS);
  // sky, sun, clouds
  let gr = g.createLinearGradient(0, 0, 0, 112); T.sky.forEach((col, i) => gr.addColorStop(i / (T.sky.length - 1), col)); g.fillStyle = gr; g.fillRect(0, 0, W, 114);
  const [sx, sy, sr, scol] = T.sun; gr = g.createRadialGradient(sx, sy, sr * .4, sx, sy, sr * 3.2); gr.addColorStop(0, 'rgba(255,240,170,.55)'); gr.addColorStop(1, 'rgba(255,240,170,0)'); g.fillStyle = gr; g.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
  ell(g, sx, sy, sr, sr); fs(g, scol);
  for (const [cx, cy, s] of [[120, 30, 1], [330, 18, .7], [610, 36, .9], [900, 20, .6]]) { g.fillStyle = T.lights ? 'rgba(255,200,190,.75)' : 'rgba(255,255,255,.9)'; for (const [dx, dy, r] of [[0, 0, 18], [20, -6, 22], [44, 0, 17], [22, 8, 20]]) { ell(g, cx + dx * s, cy + dy * s, r * s, r * s * .7); g.fill(); } }
  // the neighbours' houses and the road beyond the wall
  for (let i = 0; i < 9; i++) { const x = -40 + i * 120 + (i % 2) * 18, w = 104, y = 34 + (i % 3) * 4;
    g.fillStyle = ['#E9DCC6', '#D8C6A8', '#EFE6D6'][i % 3]; g.fillRect(x + 8, y + 22, w - 16, 46);
    g.beginPath(); g.moveTo(x, y + 26); g.lineTo(x + w / 2, y); g.lineTo(x + w, y + 26); g.closePath(); g.fillStyle = ['#7C838C', '#6C737C', '#8A9098'][i % 3]; g.fill();
    g.fillStyle = T.lights ? 'rgba(255,210,120,.85)' : 'rgba(40,60,80,.35)'; g.fillRect(x + 22, y + 36, 14, 12); g.fillRect(x + w - 36, y + 36, 14, 12); }
  for (let i = 0; i < 14; i++) { ell(g, i * 74 + 20, 78, 26, 16); fs(g, i % 2 ? '#5E9E4A' : '#6BAA52'); }
  for (const tx of [250, 566, 716]) tree(g, tx, 100, .8, true);
  g.fillStyle = '#6E7076'; g.fillRect(0, 86, W, 24); g.fillStyle = '#F2E9B0'; for (let x = 10; x < W; x += 60) g.fillRect(x, 97, 30, 3);
  // brick perimeter wall with stone caps and pilasters
  g.fillStyle = '#A2563F'; g.fillRect(0, 108, W, 62);
  for (let y = 112; y < 170; y += 9) for (let x = (y / 9 % 2) * 14 - 14; x < W; x += 28) { g.fillStyle = hash(x, y) < .5 ? '#B4614A' : '#9A4E39'; g.fillRect(x + 1, y, 26, 7); }
  g.fillStyle = '#D9D2C2'; g.fillRect(0, 104, W, 9); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 112, W, 3);
  for (let x = 40; x < W; x += 168) { g.fillStyle = '#8E4A36'; g.fillRect(x - 14, 100, 28, 70); g.fillStyle = '#E2DBCB'; g.fillRect(x - 18, 94, 36, 10); }
  // grass: mowed in a checker pattern, with clover and daisies
  gr = g.createLinearGradient(0, 168, 0, H); gr.addColorStop(0, T.grass[0]); gr.addColorStop(1, T.grass[1]); g.fillStyle = gr; g.fillRect(0, 168, W, H - 168);
  const rows = [168, 196, 230, 270, 318, 374, 440, 520];
  for (let r = 0; r < rows.length - 1; r++) for (let i = -1; i < 10; i++) { if ((i + r) % 2) continue; const k0 = (rows[r] - 168) / 360, k1 = (rows[r + 1] - 168) / 360, w0 = 96 + k0 * 60, w1 = 96 + k1 * 60, x0 = 480 + (i - 4.5) * w0, x1 = 480 + (i - 4.5) * w1;
    g.beginPath(); g.moveTo(x0, rows[r]); g.lineTo(x0 + w0, rows[r]); g.lineTo(x1 + w1, rows[r + 1]); g.lineTo(x1, rows[r + 1]); g.closePath(); g.fillStyle = 'rgba(255,255,255,.055)'; g.fill(); }
  for (let i = 0; i < 16; i++) { const x = 90 + hash(i, 3) * 780, y = 200 + hash(i, 4) * 300, r = 16 + hash(i, 5) * 30; g.fillStyle = 'rgba(40,110,40,.16)'; ell(g, x, y, r, r * .42); g.fill(); }
  for (let i = 0; i < 300; i++) { const x = hash(i, 7) * W, y = 176 + hash(i, 8) * (H - 176); g.strokeStyle = hash(i, 9) < .5 ? 'rgba(40,90,30,.4)' : 'rgba(170,220,100,.4)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (hash(i, 10) - .5) * 4, y - 5); g.stroke(); }
  for (let i = 0; i < 46; i++) { const x = 84 + hash(i, 21) * 790, y = 196 + hash(i, 22) * 310; if (Math.hypot(x - PIT.x, (y - PIT.y) * 1.6) < 120) continue; for (let p = 0; p < 5; p++) { const a = p * TAU / 5; ell(g, x + Math.cos(a) * 2.6, y + Math.sin(a) * 1.8, 1.9, 1.5); fs(g, hash(i, 23) < .7 ? '#FFFFFF' : '#FFD0E8'); } ell(g, x, y, 1.6, 1.3); fs(g, '#FFD23F'); }
  // flower bed along the wall
  g.fillStyle = '#5A3A22'; g.fillRect(40, 168, W - 94, 12); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(40, 178, W - 94, 3);
  for (let i = 0; i < 46; i++) { const x = 54 + i * 18.4 + hash(i, 31) * 6, h = 8 + hash(i, 32) * 10, col = ['#FF6FA8', '#FFD23F', '#FF7A3A', '#B58CFF', '#FFFFFF'][Math.floor(hash(i, 33) * 5)];
    if (hash(i, 34) < .22) { ell(g, x, 170, 13, 9); fs(g, '#3F8A3A'); ell(g, x - 4, 167, 6, 4); fs(g, '#58A84C'); continue; }
    g.strokeStyle = '#3F8A3A'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 176); g.lineTo(x, 176 - h); g.stroke(); for (let p = 0; p < 5; p++) { const a = p * TAU / 5; ell(g, x + Math.cos(a) * 3, 176 - h + Math.sin(a) * 3, 2.6, 2.6); fs(g, col); } ell(g, x, 176 - h, 2, 2); fs(g, '#FFE680'); }
  // wood side fence (right) and brick side wall (left), seen at an angle
  for (let y = 120; y < H; y += 6) { const k = (y - 120) / (H - 120); g.fillStyle = (Math.floor(y / 6) % 2) ? '#A57C52' : '#93693F'; g.fillRect(W - 54 - k * 24, y, 54 + k * 24, 6); }
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(W - 58, 120, 4, H);
  for (let y = 120; y < H; y += 8) { const k = (y - 120) / (H - 120); g.fillStyle = (Math.floor(y / 8) % 2) ? '#A2563F' : '#94503A'; g.fillRect(0, y, 40 + k * 20, 8); }
  g.fillStyle = '#D9D2C2'; for (let y = 120; y < H; y += 1) { const k = (y - 120) / (H - 120); g.fillRect(36 + k * 20, y, 6, 1); }
  // the big oak in the corner with a tire swing, and its shade on the grass
  ell(g, 150, 214, 104, 26); fs(g, 'rgba(20,60,20,.2)');
  g.fillStyle = '#6A4526'; g.beginPath(); g.moveTo(112, 196); g.quadraticCurveTo(122, 150, 116, 96); g.lineTo(146, 96); g.quadraticCurveTo(142, 150, 154, 196); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 2; for (const lx of [122, 132, 140]) { g.beginPath(); g.moveTo(lx, 190); g.quadraticCurveTo(lx + 4, 150, lx - 2, 104); g.stroke(); }
  g.strokeStyle = '#6A4526'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(134, 112); g.quadraticCurveTo(180, 92, 214, 96); g.stroke();
  for (const [dx, dy, r] of [[130, 58, 52], [84, 76, 40], [178, 70, 44], [116, 30, 40], [162, 34, 36], [60, 104, 26], [208, 100, 28]]) { ell(g, dx, dy, r, r * .86); fs(g, T.lights ? '#3E7F3C' : '#4A9642'); }
  for (const [dx, dy, r] of [[112, 44, 24], [160, 56, 20], [86, 68, 16], [188, 84, 14]]) { ell(g, dx, dy, r, r * .78); fs(g, T.lights ? '#5A9A48' : '#63B052'); }
  g.strokeStyle = '#C9B48E'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(204, 98); g.lineTo(204, 150); g.stroke(); ell(g, 204, 166, 13, 17); fs(g, null, '#26262A', 8); ell(g, 204, 166, 13, 17); fs(g, null, '#3A3A40', 3);
  // Bernard's dog house by the back wall, with his bowl
  g.fillStyle = 'rgba(20,60,20,.2)'; ell(g, 800, 196, 56, 12); g.fill();
  rr(g, 762, 138, 76, 56, 4); fs(g, '#E8D5B0', INK, 2.5); g.beginPath(); g.moveTo(752, 142); g.lineTo(800, 104); g.lineTo(848, 142); g.closePath(); fs(g, '#D8463A', INK, 2.5);
  g.beginPath(); g.moveTo(784, 194); g.lineTo(784, 168); g.arc(800, 168, 16, Math.PI, 0); g.lineTo(816, 194); g.closePath(); fs(g, '#3A2A1E', INK, 2);
  rr(g, 776, 144, 48, 13, 3); fs(g, '#FFFFFF', INK, 1.5); text(g, 'BERNARD', 800, 151, 9, '#D8463A');
  ell(g, 858, 194, 14, 5); fs(g, '#3A8FE0', INK, 2); ell(g, 858, 192, 10, 3); fs(g, '#9EDBFF');
  // patio along the bottom with planters, and the house eave in the near corner
  g.fillStyle = '#C9C2B5'; g.fillRect(0, H - 22, W, 22); g.fillStyle = 'rgba(0,0,0,.08)'; for (let x = 0; x < W; x += 64) g.fillRect(x, H - 22, 2, 22); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, H - 24, W, 3);
  for (const px of [230, 420, 610]) { rr(g, px - 16, H - 26, 32, 22, 5); fs(g, '#C8683F', INK, 2); for (const [dx, dy, r] of [[-8, -30, 9], [6, -34, 10], [0, -24, 9]]) { ell(g, px + dx, H + dy, r, r); fs(g, '#4C9E44'); } ell(g, px - 6, H - 36, 3, 3); fs(g, '#FF6FA8'); ell(g, px + 8, H - 30, 3, 3); fs(g, '#FFD23F'); }
  g.fillStyle = '#4A4A52'; g.beginPath(); g.moveTo(0, H - 70); g.lineTo(150, H); g.lineTo(0, H); g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.moveTo(0, H - 70); g.lineTo(150, H); g.lineTo(190, H); g.lineTo(0, H - 96); g.closePath(); g.fill();
  if (T.tint) { g.fillStyle = T.tint; g.fillRect(0, 104, W, H - 104); }
  // golden hour: string lights hung from the wall pillars
  if (T.lights) { for (let x = 40; x + 168 < W + 100; x += 168) { g.strokeStyle = 'rgba(30,20,10,.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, 96); g.quadraticCurveTo(x + 84, 128, x + 168, 96); g.stroke();
      for (let i = 1; i < 8; i++) { const t = i / 8, bx = x + 168 * t, by = 96 + 64 * t * (1 - t); const gl = g.createRadialGradient(bx, by + 4, 1, bx, by + 4, 16); gl.addColorStop(0, 'rgba(255,225,140,.75)'); gl.addColorStop(1, 'rgba(255,225,140,0)'); g.fillStyle = gl; g.fillRect(bx - 16, by - 12, 32, 32); ell(g, bx, by + 4, 3.5, 4.5); fs(g, ['#FFE680', '#FF9A6A', '#9EE8FF', '#FFB3E0'][i % 4]); } } }
  return c;
}
function yardFor(i) { const T = THEMES[i]; if (!yardCache[T.id]) yardCache[T.id] = bakeYard(T); return yardCache[T.id]; }
// fire pit table ringed by six Adirondack chairs; drawn with the people so they sort by depth
function drawChair(g, x, y, ang) {
  g.save(); g.translate(x, y); const s = Math.cos(ang), fx = Math.sin(ang);
  ell(g, 0, 10, 24, 8); fs(g, 'rgba(0,0,0,.18)');
  g.fillStyle = '#F2EEE6'; g.strokeStyle = '#8A8072'; g.lineWidth = 1.5;
  for (let i = -2; i <= 2; i++) { rr(g, i * 8 - 3 + fx * 6, -40 - s * 6 - Math.abs(i) * -2, 7, 34, 3); g.fill(); g.stroke(); }
  rr(g, -22, -10, 44, 14, 4); g.fill(); g.stroke(); rr(g, -26, -16, 10, 6, 2); g.fill(); g.stroke(); rr(g, 16, -16, 10, 6, 2); g.fill(); g.stroke();
  g.restore();
}
function drawFirePit(g, t, lit) {
  const { x, y } = PIT;
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * TAU / 6 + .25, cx = x + Math.cos(a) * 82, cy = y + Math.sin(a) * 50; if (cy < y) drawChair(g, cx, cy, a); }
  if (lit) { const gl = g.createRadialGradient(x, y - 14, 10, x, y - 14, 150); gl.addColorStop(0, 'rgba(255,170,70,.34)'); gl.addColorStop(1, 'rgba(255,170,70,0)'); g.fillStyle = gl; g.fillRect(x - 150, y - 110, 300, 190); }
  ell(g, x, y + 12, 52, 20); fs(g, 'rgba(0,0,0,.22)');
  rr(g, x - 46, y - 18, 92, 30, 10); fs(g, '#8D8780', '#5E5852', 2);
  for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#9C968E' : '#7E7870'; g.fillRect(x - 44 + i * 13, y - 6, 11, 14); }
  ell(g, x, y - 18, 46, 15); fs(g, '#A9A39B', '#5E5852', 2); ell(g, x, y - 18, 28, 8); fs(g, '#3A3632');
  for (let i = 0; i < 5; i++) { const fx = x - 14 + i * 7, h = 12 + Math.sin(t * 9 + i * 1.7) * 5 + (i % 2) * 5; g.beginPath(); g.moveTo(fx - 5, y - 18); g.quadraticCurveTo(fx, y - 18 - h * 1.3, fx + 5, y - 18); g.fillStyle = i % 2 ? '#FFB347' : '#FF6A2A'; g.fill(); }
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * TAU / 6 + .25, cx = x + Math.cos(a) * 82, cy = y + Math.sin(a) * 50; if (cy >= y) drawChair(g, cx, cy, a); }
}

/* ---------------- audio ---------------- */
let ac = null, soundOn = true;
function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (ac && ac.state === 'suspended') ac.resume(); return ac; }
function tone(f, d, type, vol, slide, when) { if (!soundOn || !audio()) return; try { const t = when || ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d); g.gain.setValueAtTime(vol || .05, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + .02); } catch (e) { } }
function noise(d, vol, f0, f1) { if (!soundOn || !audio()) return; try { const t = ac.currentTime, n = ac.createBufferSource(), b = ac.createBuffer(1, Math.max(1, ac.sampleRate * d | 0), ac.sampleRate), x = b.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / x.length, 2); n.buffer = b; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(f0 || 500, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + d); f.Q.value = 1.6; const g = ac.createGain(); g.gain.value = vol || .2; n.connect(f); f.connect(g); g.connect(ac.destination); n.start(t); } catch (e) { } }
const sfx = {
  pass: () => noise(.16, .12, 900, 2400), lob: () => { noise(.3, .1, 500, 1400); tone(380, .25, 'triangle', .03, 620); },
  catch: () => { tone(660, .07, 'square', .05); setTimeout(() => tone(990, .09, 'square', .045), 60); },
  squeak: () => { tone(1500, .12, 'square', .045, 2400); setTimeout(() => tone(2200, .1, 'square', .04, 1400), 110); },
  bark: () => { noise(.13, .32, 420, 190); tone(150, .12, 'square', .05, 95); },
  steal: () => { tone(220, .3, 'sawtooth', .06, 90); noise(.25, .15, 300, 150); },
  tug: () => tone(300 + Math.random() * 200, .05, 'square', .035),
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, .18, 'square', .045), i * 80)),
  fanfare: () => [523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, i === 6 ? .5 : .14, 'square', .05), i * 120)),
  zoom: () => { for (let i = 0; i < 6; i++) setTimeout(() => tone(400 + i * 120, .08, 'square', .04), i * 50); },
  squirrel: () => { for (let i = 0; i < 5; i++) setTimeout(() => tone(1800 + Math.random() * 600, .04, 'square', .03), i * 70); },
  bounce: () => tone(180, .08, 'sine', .08, 120), whistle: () => { tone(1700, .35, 'sine', .05, 1500); },
  pounce: () => { noise(.18, .16, 300, 900); tone(240, .16, 'triangle', .05, 480); },
  dash: () => noise(.12, .1, 1400, 500),
  power: () => [660, 880, 1320].forEach((f, i) => setTimeout(() => tone(f, .1, 'triangle', .06), i * 60)),
  bullseye: () => [1047, 1319, 1568, 2093].forEach((f, i) => setTimeout(() => tone(f, .12, 'sine', .07), i * 55)),
  trick: () => { tone(880, .08, 'triangle', .06); setTimeout(() => tone(1175, .12, 'triangle', .06), 70); },
  splash: () => noise(.25, .12, 2600, 900), chomp: () => { noise(.06, .2, 500, 300); tone(180, .06, 'square', .04); },
  tick: () => tone(880, .06, 'square', .035), count: () => tone(660, .1, 'square', .06), go: () => tone(990, .3, 'square', .07)
};
// a tiny looping tune, a little quicker each round
const TUNES = [
  { bpm: 116, bass: [48, 0, 55, 0, 53, 0, 55, 0], lead: [72, 0, 76, 79, 0, 76, 72, 0, 74, 0, 77, 81, 0, 77, 74, 0] },
  { bpm: 128, bass: [50, 0, 57, 0, 55, 0, 57, 50], lead: [74, 78, 81, 0, 78, 0, 74, 0, 76, 79, 83, 0, 79, 0, 76, 0] },
  { bpm: 140, bass: [45, 45, 52, 0, 50, 50, 52, 0], lead: [69, 0, 72, 76, 0, 72, 76, 81, 79, 0, 76, 72, 0, 74, 76, 0] }
];
const music = { on: false, timer: null, next: 0, step: 0, tune: 0 };
function musicStart(i) { musicStop(); if (!audio()) return; music.on = true; music.tune = i; music.step = 0; music.next = ac.currentTime + .08; music.timer = setInterval(musicTick, 40); }
function musicStop() { music.on = false; if (music.timer) { clearInterval(music.timer); music.timer = null; } }
function musicTick() {
  if (!ac || !music.on) return; const S = TUNES[music.tune], d = 60 / S.bpm / 2, f = m => 440 * Math.pow(2, (m - 69) / 12);
  while (music.next < ac.currentTime + .15) { const s = music.step, b = S.bass[s % S.bass.length], l = S.lead[s % S.lead.length];
    if (b) tone(f(b), d * .9, 'triangle', .035, 0, music.next); if (l) tone(f(l), d * .8, 'square', .016, 0, music.next); if (s % 2 === 1) tone(6000, .02, 'square', .006, 0, music.next);
    music.next += d; music.step++; }
}

/* ---------------- input: two pads + keyboard + touch ---------------- */
// a = B button, b = A button, c = Y button, d = X button (kids: pass, lob, fake, dash · Bernard: pounce, bark, zoomies, zoomies)
const keys = {}, latch = {}; // latch: a tap that started and ended between two frames still counts
const KEYMAP = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', a: 'Space', b: 'KeyE', c: 'KeyQ', d: 'ShiftLeft' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'Enter', b: 'ShiftRight', c: 'Period', d: 'Slash' }
];
let p2KeysUsed = false, autoAll = false; // autoAll: test hook, the computer plays everybody
const PADS = [mkIn(), mkIn()];
function mkIn() { return { x: 0, y: 0, a: false, b: false, c: false, d: false, any: false, start: false, select: false, prev: {}, hit: {} }; }
function readPads() {
  const K = {}; for (const c in keys) if (keys[c]) K[c] = true; for (const c in latch) if (latch[c]) K[c] = true;
  let list = []; try { list = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(g => g && g.connected !== false && g.buttons && g.buttons.length); } catch (e) { }
  list.sort((a, b) => a.index - b.index);
  for (let p = 0; p < 2; p++) {
    const I = PADS[p], gp = list[p], k = KEYMAP[p];
    let x = 0, y = 0, a = false, b = false, c = false, d = false, start = false, select = false;
    if (gp) {
      const B = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > .5)), ax = gp.axes || [];
      if (B(14) || ax[0] < -.45) x -= 1; if (B(15) || ax[0] > .45) x += 1; if (B(12) || ax[1] < -.45) y -= 1; if (B(13) || ax[1] > .45) y += 1;
      const h = ax[9]; if (typeof h === 'number' && h >= -1.01 && h <= 1.01 && Math.abs(h) > .05 && ax.length >= 10) { const q = Math.round((h + 1) / .2857); if (q === 7 || q === 0 || q === 1) y = -1; if (q >= 1 && q <= 3) x = 1; if (q >= 3 && q <= 5) y = 1; if (q >= 5 && q <= 7) x = -1; }
      a = B(0); b = B(1); c = B(2); d = B(3); start = B(9); select = B(8);
    }
    if (K[k.left]) x -= 1; if (K[k.right]) x += 1; if (K[k.up]) y -= 1; if (K[k.down]) y += 1;
    a = a || !!K[k.a]; b = b || !!K[k.b]; c = c || !!K[k.c]; d = d || !!K[k.d];
    if (p === 0) { start = start || !!K.Escape || !!K.KeyP; select = select || !!K.Backspace; }
    if (p === 0 && touch.on) { x += touch.x; y += touch.y; a = a || touch.a; b = b || touch.b; touch.a = touch.b = false; }
    x = clamp(x, -1, 1); y = clamp(y, -1, 1);
    const n = { a, b, c, d, start, select, any: a || b || c || d, left: x < -.5, right: x > .5, up: y < -.5, down: y > .5 };
    for (const key in n) I.hit[key] = n[key] && !I.prev[key];
    I.prev = n; Object.assign(I, n);
    const m = Math.hypot(x, y); I.x = m > 1 ? x / m : x; I.y = m > 1 ? y / m : y;
    I.connected = !!gp;
  }
  PADS.count = list.length;
  for (const c in latch) latch[c] = false;
}
const menuHit = k => PADS[0].hit[k] || PADS[1].hit[k]; // either controller can work the menus
// Android TV often leaves e.code as "Unidentified" and only fills e.key
const KEYNAME = { ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Enter: 'Enter', ' ': 'Space', Escape: 'Escape', Shift: 'ShiftRight', '.': 'Period', '/': 'Slash', w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', e: 'KeyE', q: 'KeyQ', p: 'KeyP', m: 'KeyM' };
const codeOf = e => (e.code && e.code !== 'Unidentified') ? e.code : (KEYNAME[e.key] || KEYNAME[(e.key || '').toLowerCase()] || e.key);
const P2KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'ShiftRight', 'Period', 'Slash'];
const onKeyDown = ev => {
  const code = codeOf(ev);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Slash'].includes(code)) ev.preventDefault();
  keys[code] = true; if (!ev.repeat) latch[code] = true; audio();
  if (P2KEYS.includes(code) && state === 'play') p2KeysUsed = true;
  if (code === 'KeyM' && !ev.repeat) { soundOn = !soundOn; if (!soundOn) musicStop(); else if (state === 'play' || state === 'ready') musicStart(round); }
};
const onKeyUp = e => { keys[codeOf(e)] = false; };
const onBlur = () => { for (const k in keys) keys[k] = false; };
// phones: drag on the left half to run, tap the right half to pass (two-finger tap = lob)
const touch = { on: false, x: 0, y: 0, a: false, b: false, id: null, ox: 0, oy: 0, tapX: -1 };
function bindTouch() {
  canvas.addEventListener('touchstart', e => { touch.on = true; audio(); const r = canvas.getBoundingClientRect(); for (const t of e.changedTouches) { const lx = (t.clientX - r.left) / r.width; touch.tapX = lx; if (lx < .5 && touch.id === null && state === 'play') { touch.id = t.identifier; touch.ox = t.clientX; touch.oy = t.clientY; } else { if (e.touches.length > 1 && lx >= .5) touch.b = true; else touch.a = true; } } e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === touch.id) { touch.x = clamp((t.clientX - touch.ox) / 40, -1, 1); touch.y = clamp((t.clientY - touch.oy) / 40, -1, 1); } e.preventDefault(); }, { passive: false });
  const end = e => { for (const t of e.changedTouches) if (t.identifier === touch.id) { touch.id = null; touch.x = touch.y = 0; } };
  canvas.addEventListener('touchend', end); canvas.addEventListener('touchcancel', end);
}

/* ---------------- game state ---------------- */
let state = 'title', mode = 'kids', time = 0, menuIdx = 0, pauseIdx = 0, stateT = 0;
let round = 0, timer = 0, kidsScore = 0, dogScore = 0, streak = 0, bestStreak = 0, catches = 0, steals = 0, tricks = 0, roundScores = [];
let kids = [], dog = null, ball = null, tug = null, BALL = BALLS[0], THEME = THEMES[0];
let particles = [], floats = [], banner = null, shake = 0, flash = 0, lastTick = 99;
let squirrel = null, squirrelT = 0, powerups = [], powerT = 0, ring = null, ringT = 0, sprT = 0, kidsDouble = 0, dogDouble = 0, hintT = 0, newBest = false;
const SPR = { x: 262, y: 448, r: 78 };
const best = { kids: 0, dog: 0 };
try { best.kids = +localStorage.getItem('ka_best') || 0; best.dog = +localStorage.getItem('ka_best_dog') || 0; } catch (e) { }
const mult = () => round + 1;

function newKid(i, who, x, y) { return { i, who, x, y, vx: 0, vy: 0, ctl: -1, face: i ? -1 : 1, hold: 0, catchCool: 0, run: 0, dashT: 0, dashCool: 0, dx: 1, dy: 0, speedT: 0, rattle: 0, stun: 0, fakeT: 0, fakeAt: -9, cheer: 0, think: .6, spot: null, spotT: 0, ai: { x: 0, y: 0, hit: {} } }; }
function newMatch(m) {
  mode = m; kidsScore = dogScore = 0; bestStreak = catches = steals = tricks = 0; roundScores = []; newBest = false; hintT = 9;
  startRound(0);
}
function startRound(i) {
  round = i; THEME = THEMES[i]; BALL = BALLS[THEME.ball]; timer = TUNE.roundTime; streak = 0; tug = null; lastTick = 99;
  kids = [newKid(0, 'nic', 206, 360), newKid(1, 'giulia', 754, 360)];
  dog = { x: 480, y: 238, vx: 0, vy: 0, ctl: -1, face: -1, run: 0, busy: 0, crouch: 0, pounceT: 0, pounceCool: 1.5, px: 0, py: 0, barkCool: 0, barkT: 0, zoomT: 0, hyper: i ? .25 : 0, stealT: 0, keepT: 0, keepAcc: 0, tugImmune: 0, distract: null, speedT: 0, slowT: 0, fooledAt: -9, zoomWait: 0, wet: 0, mood: '', plan: 'guard', planT: 1.5 };
  ball = { state: 'held', holder: i % 2, x: 0, y: 0, z: 34, spin: 0 }; kids[i % 2].think = 1.2;
  particles = []; floats = []; powerups = []; ring = null; squirrel = null; kidsDouble = dogDouble = 0;
  squirrelT = rnd(9, 15); powerT = rnd(4, 6); ringT = rnd(3, 5); sprT = 0;
  roundScores[i] = { k0: kidsScore, d0: dogScore };
  banner = null; state = 'ready'; stateT = 0; assignControls(); musicStart(i);
}
// who is holding which controller; checked every frame so a second pad can join in at any time
function assignControls() {
  const two = PADS.count >= 2 || p2KeysUsed;
  if (autoAll) { kids[0].ctl = kids[1].ctl = dog.ctl = -1; return; }
  if (mode === 'kids') { kids[0].ctl = 0; kids[1].ctl = two ? 1 : -1; dog.ctl = -1; }
  else { dog.ctl = 0; kids[0].ctl = two ? 1 : -1; kids[1].ctl = -1; }
}

/* ---------------- little helpers ---------------- */
function fx(x, y, n, col, o) { o = o || {}; for (let i = 0; i < n; i++) { const a = rnd(0, TAU), s = rnd(o.s0 || 30, o.s1 || 160); particles.push({ x, y, z: o.z || 0, vx: Math.cos(a) * s, vy: Math.sin(a) * s * .6, vz: rnd(o.up || 60, (o.up || 60) * 2.6), life: rnd(.35, o.life || .8), max: 1, col: Array.isArray(col) ? pick(col) : col, r: rnd(o.r0 || 2, o.r1 || 4.5), kind: o.kind || 'dot', rot: rnd(0, TAU) }); } }
function say(x, y, s, col, size) { floats.push({ x, y, text: s, col: col || '#FFFFFF', life: 1.1, max: 1.1, size: size || 20 }); }
function setBanner(s, sub, col, life) { banner = { text: s, sub: sub || '', col: col || '#FFE680', life: life || 1.6, max: life || 1.6 }; }
function kidsPts(p, x, y, label, col) { p = Math.round(p * mult() * (kidsDouble > 0 ? 2 : 1)); kidsScore += p; say(x, y - 74, (label ? label + ' ' : '') + '+' + p, col || '#FFE680', label ? 19 : 21); return p; }
function dogPts(p, x, y, label) { p = Math.round(p * mult() * (dogDouble > 0 ? 2 : 1)); dogScore += p; say(x, y - 64, (label ? label + ' ' : '') + '+' + p, '#FFB0A0', label ? 19 : 18); return p; }
const inPit = (x, y, pad) => { const dx = x - PIT.x, dy = (y - PIT.y) * 1.65; return dx * dx + dy * dy < (PIT.r + (pad || 0)) * (PIT.r + (pad || 0)); };
function keepIn(e, pad) {
  pad = pad || 14; e.x = clamp(e.x, YARD.x0 + pad, YARD.x1 - pad); e.y = clamp(e.y, YARD.y0 + 6, YARD.y1 - 4);
  const dx = e.x - PIT.x, dy = (e.y - PIT.y) * 1.65, d = Math.hypot(dx, dy), R = PIT.r + pad;
  if (d < R) { const k = R / (d || 1); e.x = PIT.x + dx * k; e.y = PIT.y + dy * k / 1.65; return true; } return false;
}
// a unit direction from e toward (tx, ty) that walks around the fire pit instead of into it
function steer(e, tx, ty) {
  let dx = tx - e.x, dy = ty - e.y; const d = Math.hypot(dx, dy); if (d < 4) return { x: 0, y: 0, d };
  dx /= d; dy /= d; const ax = e.x + dx * 46, ay = e.y + dy * 46;
  if (inPit(ax, ay, 22) && d > 50) { const rx = e.x - PIT.x, ry = (e.y - PIT.y) * 1.65; let px = -ry, py = rx / 1.65; const m = Math.hypot(px, py) || 1; px /= m; py /= m; if (px * dx + py * dy < 0) { px = -px; py = -py; } dx = px * .9 + (rx / (Math.hypot(rx, ry) || 1)) * .25; dy = py * .9; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n; }
  return { x: dx, y: dy, d };
}
function segDist(p, a, b) { const vx = b.x - a.x, vy = b.y - a.y, l = vx * vx + vy * vy || 1, t = clamp(((p.x - a.x) * vx + (p.y - a.y) * vy) / l, 0, 1); return { d: Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t)), t, x: a.x + vx * t, y: a.y + vy * t }; }
const holder = () => ball.state === 'held' ? kids[ball.holder] : null;
function freeSpot(minD) { for (let n = 0; n < 40; n++) { const x = rnd(YARD.x0 + 50, YARD.x1 - 50), y = rnd(YARD.y0 + 30, YARD.y1 - 24); if (inPit(x, y, 34)) continue; if (THEME.sprinkler && Math.hypot(x - SPR.x, y - SPR.y) < 50) continue; if (kids.every(k => dist(k, { x, y }) > minD) && dist(dog, { x, y }) > minD) return { x, y }; } return { x: 160, y: 240 }; }

/* ---------------- the ball ---------------- */
function giveBall(k) { ball = { state: 'held', holder: k.i, x: k.x, y: k.y, z: 34, spin: ball.spin || 0 }; k.hold = 0; k.catchCool = .4; k.think = mode === 'kids' ? rnd(.4, .85) : rnd(.7, 1.4); dog.stealT = 0; }
function throwBall(k, lob) {
  const o = kids[1 - k.i], sp = (lob ? TUNE.passLob : TUNE.passFast) * BALL.speed;
  const tx = clamp(o.x + o.vx * .22, YARD.x0 + 16, YARD.x1 - 16), ty = clamp(o.y + o.vy * .22, YARD.y0 + 8, YARD.y1 - 6), d = Math.max(60, Math.hypot(tx - k.x, ty - k.y));
  ball = { state: 'air', from: k.i, to: o.i, sx: k.x, sy: k.y, tx, ty, x: k.x, y: k.y, z: 34, t: 0, dur: clamp(d / sp, .26, 1.7) * (lob ? 1.1 : 1), peak: lob ? TUNE.lobPeak * BALL.peak * clamp(d / 320, .65, 1.15) : TUNE.fastPeak * BALL.peak, lob, len: d, near: 999, over: false, spin: ball.spin || 0, faked: time - k.fakeAt < 1.6 && dog.fooledAt >= k.fakeAt };
  k.face = tx >= k.x ? 1 : -1; k.cheer = .18; lob ? sfx.lob() : sfx.pass(); if (BALL.id === 'squeak') sfx.squeak();
}
function fakeThrow(k) {
  k.fakeT = .32; k.fakeAt = time; k.face = kids[1 - k.i].x >= k.x ? 1 : -1; sfx.dash();
  // the computer's Bernard falls for it some of the time and lunges the wrong way
  if (dog.ctl < 0 && !dog.busy && !dog.distract && !tug && dist(dog, k) < 210 && Math.random() < (.62 - round * .1)) { const o = kids[1 - k.i]; lunge(o.x, o.y, .8); dog.fooledAt = time; say(dog.x, dog.y, '?!', '#FFFFFF', 22); }
}
function catchBall(k) {
  const b = ball; giveBall(k); catches++; streak++; bestStreak = Math.max(bestStreak, streak); k.cheer = .35; dog.hyper = Math.min(1, dog.hyper + TUNE.hyperPerCatch);
  BALL.id === 'squeak' ? sfx.squeak() : sfx.catch();
  kidsPts(TUNE.catchPts + TUNE.streakPts * Math.min(streak, TUNE.streakCap), k.x, k.y, '', '#FFFFFF');
  const bonus = []; if (b.faked) bonus.push(['FAKED OUT!', TUNE.fakedOut]); if (!b.lob && b.near < 46) bonus.push(['CLOSE CALL!', TUNE.closeCall]); if (b.over) bonus.push(['OVER HIS HEAD!', TUNE.overHead]); if (b.len > 540) bonus.push(['LONG BOMB!', TUNE.longBomb]);
  bonus.forEach((q, n) => { tricks++; setTimeout(() => { if (state === 'play') { kidsPts(q[1], k.x, k.y - 22 - n * 20, q[0], '#9CFF9C'); sfx.trick(); } }, 120 + n * 160); });
  if (bonus.length) fx(k.x, k.y, 10, ['#9CFF9C', '#FFE680'], { z: 50, kind: 'star' });
  if (streak > 0 && streak % 10 === 0) { setBanner(streak + ' IN A ROW!', 'Bernard is getting the zoomies…', '#9CFF9C', 1.3); dog.hyper = Math.min(1, dog.hyper + .25); sfx.win(); }
}
function dogGetsBall(how) {
  ball = { state: 'dog', x: dog.x, y: dog.y, z: 22, spin: ball.spin || 0 }; dog.keepT = 0; dog.keepAcc = 0; dog.tugImmune = 1.0; dog.crouch = 0; dog.pounceT = 0; dog.distract = null; dog.stealT = 0;
  steals++; if (streak >= 5) say(480, 150, 'STREAK LOST', '#FF8A8A', 18); streak = 0; shake = .3; flash = .18; sfx.steal(); setTimeout(sfx.bark, 140);
  dogPts(how === 'fumble' ? TUNE.fumblePts : TUNE.stealPts, dog.x, dog.y, how === 'fumble' ? 'GOT IT!' : how === 'snatch' ? 'SNATCHED!' : 'STOLEN!');
  fx(dog.x, dog.y, 12, ['#FFFFFF', '#FFD0A0'], { z: 24 }); for (const k of kids) k.spotT = 0;
}
function dogDrops(tired) {
  ball = { state: 'ground', x: dog.x + dog.face * 26, y: dog.y + 6, z: 0, vx: dog.face * 70, vy: rnd(-30, 30), spin: ball.spin || 0 }; dog.busy = tired ? 1.3 : .9; dog.mood = tired ? 'pant' : 'dizzy'; dog.tugImmune = 0; sfx.bounce();
  if (tired) say(dog.x, dog.y, 'He dropped it!', '#FFFFFF', 18);
}
function startTug(k, hands) { tug = { k: k.i, m: .5, t: 0, hands }; k.dashT = 0; dog.pounceT = 0; dog.crouch = 0; dog.vx = dog.vy = 0; k.vx = k.vy = 0; dog.face = k.x >= dog.x ? 1 : -1; k.face = -dog.face; sfx.bark(); if (hands) { streak = 0; ball = { state: 'tug', x: (k.x + dog.x) / 2, y: (k.y + dog.y) / 2, z: 26, spin: ball.spin || 0 }; } else ball.state = 'tug'; }
function updateTug(dt) {
  const k = kids[tug.k]; tug.t += dt;
  const KI = k.ctl >= 0 ? PADS[k.ctl] : null, DI = dog.ctl >= 0 ? PADS[dog.ctl] : null;
  if (KI) { if (KI.hit.a || KI.hit.b || KI.hit.c || KI.hit.d) { tug.m += .14; sfx.tug(); } } else tug.m += (mode === 'kids' ? .36 : .34) * dt;
  if (DI) { if (DI.hit.a || DI.hit.b || DI.hit.c || DI.hit.d) { tug.m -= .12; sfx.tug(); } tug.m -= .05 * dt; } else tug.m -= (.24 + round * .04) * dt;
  const mx = (k.x + dog.x) / 2 + (tug.m - .5) * 26 * (k.x >= dog.x ? 1 : -1), my = (k.y + dog.y) / 2; ball.x = mx + Math.sin(time * 40) * 2; ball.y = my; ball.z = 26;
  if (tug.m >= 1) { tug = null; giveBall(k); k.catchCool = 1.1; k.cheer = .5; kidsPts(TUNE.tugWin, k.x, k.y, 'GOT IT BACK!', '#9CFF9C'); sfx.win(); dog.busy = 1.0; dog.mood = 'dizzy'; dog.x -= dog.face * 22; keepIn(dog, 18); dog.pounceCool = 1.6; fx(k.x, k.y, 10, '#9CFF9C', { z: 40, kind: 'star' }); }
  else if (tug.m <= 0 || tug.t > 3.2) { const hands = tug.hands; tug = null; k.stun = .55; k.x -= k.face * -16; keepIn(k); if (hands) dogGetsBall('steal'); else { ball.state = 'dog'; dog.tugImmune = 1.5; dogPts(15, dog.x, dog.y, 'MINE!'); sfx.bark(); } }
}
function updateBall(dt) {
  const b = ball; b.spin += dt * (b.state === 'air' ? 14 : b.state === 'ground' ? Math.hypot(b.vx, b.vy) * .03 : 0);
  if (b.state === 'held') { const k = kids[b.holder], reach = k.fakeT > 0 ? Math.sin((1 - k.fakeT / .32) * Math.PI) * 26 : 0; b.x = k.x + k.face * (16 + reach); b.y = k.y + .5; b.z = 40 + (k.fakeT > 0 ? 8 : 0); return; }
  if (b.state === 'dog') { b.x = dog.x + dog.face * 26; b.y = dog.y + .5; b.z = 24; return; }
  if (b.state === 'tug') return;
  if (b.state === 'air') {
    const r = kids[b.to]; b.t += dt / b.dur;
    if (r.stun <= 0) { const dx = r.x - b.tx, dy = r.y - b.ty, d = Math.hypot(dx, dy), s = Math.min(d, 150 * dt); if (d > 1) { b.tx += dx / d * s; b.ty += dy / d * s; } } // the ball curls a little toward the catcher
    b.x = lerp(b.sx, b.tx, b.t); b.y = lerp(b.sy, b.ty, b.t); b.z = 34 + b.peak * 4 * b.t * (1 - b.t);
    if (Math.random() < .7) particles.push({ x: b.x, y: b.y, z: b.z, vx: 0, vy: 0, vz: 0, life: .28, max: .28, col: BALL.col, r: BALL.r * .7, kind: 'trail' });
    const dd = dist(dog, b), lunging = dog.pounceT > 0;
    if (b.z <= TUNE.biteHeight + 12) b.near = Math.min(b.near, dd); else if (b.lob && dd < 70 && lunging) b.over = true; // he jumped for it and missed
    if (ring && !ring.hit && Math.hypot(b.x - ring.x, b.y - ring.y) < 34 && b.t > .08 && b.t < .95) { ring.hit = .5; tricks++; kidsPts(TUNE.bullseye, ring.x, ring.y + 40, 'BULLSEYE!', '#FFD23F'); sfx.bullseye(); fx(ring.x, ring.y, 18, ['#FFD23F', '#FFFFFF'], { z: 44, kind: 'star', s1: 220 }); ringT = rnd(TUNE.ringEvery[0], TUNE.ringEvery[1]); }
    if (b.t > .3 && dist(r, b) < TUNE.catchReach && b.z < 60 && r.stun <= 0) { catchBall(r); return; }
    if (b.t > .1 && !dog.busy && !tug && dd < TUNE.biteReach + (lunging ? 14 : 0) + (dog.zoomT > 0 ? 5 : 0) + (dog.ctl >= 0 ? 10 : 0) && b.z < TUNE.biteHeight + (lunging ? 56 : 0)) { dogGetsBall('snatch'); return; }
    if (b.t >= 1) { const dx = b.tx - b.sx, dy = b.ty - b.sy, d = Math.hypot(dx, dy) || 1; ball = { state: 'ground', x: b.x, y: b.y, z: 0, vx: dx / d * 130, vy: dy / d * 130, spin: b.spin }; sfx.bounce(); if (streak >= 3) say(b.x, b.y, 'Dropped!', '#FF8A8A', 18); streak = 0; fx(b.x, b.y, 5, '#DDF0C0', { up: 30 }); }
    return;
  }
  // rolling on the grass: first one there gets it
  b.x += b.vx * dt; b.y += b.vy * dt; const f = Math.pow(.12, dt); b.vx *= f; b.vy *= f;
  if (b.x < YARD.x0 + 12 || b.x > YARD.x1 - 12) b.vx *= -1; if (b.y < YARD.y0 + 8 || b.y > YARD.y1 - 6) b.vy *= -1; if (keepIn(b, 10)) { b.vx *= -.6; b.vy *= -.6; }
  for (const k of kids) if (k.stun <= 0 && dist(k, b) < TUNE.pickReach + 12) { giveBall(k); sfx.catch(); say(k.x, k.y - 70, 'Got it!', '#FFFFFF', 17); return; }
  if (!dog.busy && dist(dog, b) < TUNE.pickReach + 8) dogGetsBall('fumble');
}

/* ---------------- the kids ---------------- */
const ANCHORS = [[140, 232], [820, 232], [140, 474], [820, 474], [480, 222], [480, 482], [118, 350], [842, 350], [300, 250], [660, 250], [300, 470], [660, 470]];
function cpuKid(k, dt) {
  const A = k.ai; A.x = A.y = 0; A.hit = {}; const o = kids[1 - k.i], easy = mode === 'dog';
  let tx = k.x, ty = k.y, go = false; const goTo = (x, y) => { tx = x; ty = y; go = true; };
  if (tug) { if (tug.k !== k.i) goTo(dog.x + (k.x > dog.x ? 60 : -60), dog.y); }
  else if (ball.state === 'held' && ball.holder === k.i) {
    k.think -= dt; const dd = dist(dog, k), lane = segDist(dog, k, o).d, far = dist(k, o);
    if (dd < 180 && !dog.busy) { const ax = k.x - dog.x, ay = k.y - dog.y, m = Math.hypot(ax, ay) || 1; goTo(k.x + ax / m * 80 + (480 - k.x) * .12, k.y + ay / m * 80 + (350 - k.y) * .12); }
    // jump out of the way of a pounce
    if (!easy && dog.crouch > 0 && dog.crouch < .14 && dd < 170 && k.dashCool <= 0 && Math.random() < .12) { A.x = -(k.y - dog.y) / (dd || 1); A.y = (k.x - dog.x) / (dd || 1); A.hit.d = true; return A; }
    if (easy && dog.pounceT > 0 && dd < 150 && k.dashCool <= 0 && Math.random() < .02) A.hit.d = true;
    if (k.rattle <= 0 && (k.think <= 0 || (dd < 96 && k.think < .5 && k.hold > .3))) {
      const slip = Math.random() < (easy ? .22 : .07); // now and then the computer kids throw one they should not
      if (lane > 84 || slip) { if (!easy && far > 150 && Math.random() < .12 && dd < 220) { A.hit.c = true; k.think = .45; } else A.hit.a = true; }
      else if (dist(dog, o) > 92 && far > 170) A.hit.b = true;
      else k.think = .25;
    }
  }
  else if (ball.state === 'held') { // my partner has it: get open, away from Bernard's nose
    k.spotT -= dt; const h = kids[ball.holder];
    if (k.spotT <= 0 || !k.spot) { let bestS = -1e9; for (const a of ANCHORS) { const p = { x: a[0], y: a[1] }, dh = dist(h, p); if (dh < 200) continue; const s = Math.min(170, segDist(dog, h, p).d) * 1.3 + Math.min(420, dh) * .22 - dist(k, p) * .3 + Math.min(120, dist(dog, p)) * .3 + rnd(0, 20); if (s > bestS) { bestS = s; k.spot = p; } } k.spotT = rnd(.7, 1.2); }
    goTo(k.spot.x, k.spot.y);
    for (const p of powerups) if (dist(k, p) < 170 && dist(dog, p) > 80) goTo(p.x, p.y);
  }
  else if (ball.state === 'air') { if (ball.to === k.i) goTo(ball.tx, ball.ty); else goTo(k.x + (k.x < 480 ? -20 : 20), k.y); }
  else if (ball.state === 'ground') { if (dist(k, ball) <= dist(o, ball) || easy) goTo(ball.x, ball.y); else goTo(lerp(ball.x, k.x, .6), lerp(ball.y, k.y, .6)); }
  else if (ball.state === 'dog') { const lead = dist(k, dog) <= dist(o, dog) ? 0 : .5; goTo(dog.x + dog.vx * lead, dog.y + dog.vy * lead); if (!easy && dist(k, dog) < 150 && dist(k, dog) > 60 && k.dashCool <= 0 && Math.random() < .08) A.hit.d = true; }
  if (go) { const s = steer(k, tx, ty); if (s.d > 10) { A.x = s.x; A.y = s.y; } }
  return A;
}
function updateKid(k, dt) {
  for (const t of ['catchCool', 'dashCool', 'speedT', 'rattle', 'stun', 'fakeT', 'cheer']) if (k[t] > 0) k[t] = Math.max(0, k[t] - dt);
  const frozen = (tug && tug.k === k.i) || k.stun > 0, I = k.ctl >= 0 ? PADS[k.ctl] : cpuKid(k, dt);
  if (frozen) { k.vx = k.vy = 0; k.dashT = 0; return; }
  const base = (k.ctl >= 0 ? TUNE.kidSpeed : mode === 'kids' ? TUNE.cpuSpeed : (TUNE.cpuSpeed - 22) * (ball.state === 'held' && ball.holder === k.i ? .9 : 1)) * (k.speedT > 0 ? 1.4 : 1) * (k.rattle > 0 ? .5 : 1);
  const mv = Math.hypot(I.x, I.y);
  if (I.hit.d && k.dashCool <= 0 && k.rattle <= 0) { if (mv > .2) { k.dx = I.x / mv; k.dy = I.y / mv; } else { k.dx = k.face; k.dy = 0; } k.dashT = TUNE.dashTime; k.dashCool = TUNE.dashCool; sfx.dash(); fx(k.x, k.y, 6, '#E8F6D0', { up: 20, s1: 70 }); }
  if (k.dashT > 0) { k.dashT -= dt; k.vx = k.dx * TUNE.dashSpeed; k.vy = k.dy * TUNE.dashSpeed; if (Math.random() < .6) particles.push({ x: k.x, y: k.y, z: 30, vx: 0, vy: 0, vz: 0, life: .22, max: .22, col: k.who === 'nic' ? '#9ED0FF' : '#FFB3E0', r: 12, kind: 'trail' }); }
  else { const tvx = I.x * base, tvy = I.y * base, a = Math.min(1, dt * 14); k.vx += (tvx - k.vx) * a; k.vy += (tvy - k.vy) * a; }
  k.x += k.vx * dt; k.y += k.vy * dt * .86; keepIn(k);
  const sp = Math.hypot(k.vx, k.vy); if (sp > 30) { k.run += dt * sp * .05; if (Math.abs(k.vx) > 30 && ball.holder !== k.i) k.face = k.vx > 0 ? 1 : -1; if (Math.random() < dt * 5) fx(k.x, k.y, 1, 'rgba(230,246,200,.8)', { up: 14, s1: 30, r1: 3 }); }
  if (ball.state === 'held' && ball.holder === k.i) {
    k.hold += dt; if (k.fakeT <= 0 && sp < 30) k.face = kids[1 - k.i].x >= k.x ? 1 : -1;
    if (k.rattle <= 0 && k.fakeT <= 0) { if (I.hit.a) throwBall(k, false); else if (I.hit.b) throwBall(k, true); else if (I.hit.c) fakeThrow(k); }
  }
  // power-ups
  for (const p of powerups) if (!p.dead && dist(k, p) < 34) { p.dead = true; sfx.power(); fx(p.x, p.y, 12, ['#FFE680', '#FFFFFF'], { z: 20, kind: 'star' });
    if (p.kind === 'shoes') { k.speedT = 6; say(k.x, k.y - 80, 'SPEED SHOES!', '#9EE8FF', 19); }
    else if (p.kind === 'star') { kidsDouble = 8; setBanner('DOUBLE POINTS!', 'for the kids, 8 seconds', '#FFD23F', 1.2); }
    else { say(k.x, k.y - 80, 'TREAT TOSS!', '#FFD0A0', 19); if (dog.ctl < 0) { if (ball.state !== 'dog' && !tug) { const s = freeSpot(200); dog.distract = { x: s.x, y: s.y, t: 3.4, kind: 'treat', eat: 0 }; dog.crouch = 0; } } else { dog.slowT = 3.5; say(dog.x, dog.y - 60, 'Mmm… treat…', '#FFD0A0', 17); } } }
}

/* ---------------- Bernard ---------------- */
function dogSpeed() { return (dog.ctl >= 0 ? TUNE.dogHumanSpeed : TUNE.dogSpeed * THEME.dog) * (dog.zoomT > 0 ? 1.5 : 1) * (dog.speedT > 0 ? 1.3 : 1) * (dog.slowT > 0 ? .6 : 1) * (dog.wet > 0 && dog.ctl >= 0 ? .7 : 1) * (ball.state === 'dog' ? .93 : 1); }
function lunge(tx, ty, k) { const dx = tx - dog.x, dy = ty - dog.y, d = Math.hypot(dx, dy) || 1; dog.px = dx / d; dog.py = dy / d; dog.pounceT = TUNE.pounceTime * (k || 1); dog.pounceCool = TUNE.pounceCool + (dog.ctl < 0 ? rnd(.3, 1.1) : 0); dog.crouch = 0; dog.face = dx >= 0 ? 1 : -1; sfx.pounce(); fx(dog.x, dog.y, 6, '#E8F6D0', { up: 20, s1: 80 }); }
function startZoomies() { dog.zoomT = TUNE.zoomTime; dog.hyper = 0; sfx.zoom(); setBanner('ZOOMIES!!', 'Bernard is super fast!', '#FF9A6A', 1.2); }
function bark() {
  dog.barkCool = TUNE.barkCool; dog.barkT = .35; sfx.bark(); setTimeout(sfx.bark, 150);
  for (const k of kids) if (dist(k, dog) < TUNE.barkReach) { k.rattle = .8; say(k.x, k.y - 84, 'EEK!', '#FFFFFF', 18); }
  if (squirrel && !squirrel.scared) { squirrel.scared = true; squirrel.v *= 2.4; dogPts(20, squirrel.x, 150, 'SCARED THE SQUIRREL!'); }
}
function cpuDog(dt) {
  let tx = dog.x, ty = dog.y, sp = dogSpeed();
  if (ball.state === 'dog') { // run off with it: head for whichever corner is furthest from the kids
    if (!dog.flee || dog.fleeT <= 0 || dist(dog, dog.flee) < 40) { let bestS = -1e9; for (const a of ANCHORS) { const p = { x: a[0], y: a[1] }, s = Math.min(dist(kids[0], p), dist(kids[1], p)) - dist(dog, p) * .45 + rnd(0, 40); if (s > bestS) { bestS = s; dog.flee = p; } } dog.fleeT = rnd(.6, 1.1); }
    dog.fleeT -= dt; tx = dog.flee.x; ty = dog.flee.y;
  } else if (dog.distract) {
    const D = dog.distract; D.t -= dt; if (D.kind === 'squirrel' && squirrel) D.x = clamp(squirrel.x, YARD.x0 + 30, YARD.x1 - 30);
    tx = D.x; ty = D.y; const there = dist(dog, D) < 26;
    if (D.kind === 'treat' && there) { D.eat += dt; dog.mood = 'munch'; if (Math.random() < dt * 7) { sfx.chomp(); fx(dog.x + dog.face * 20, dog.y, 2, '#E8C890', { z: 14, up: 30, s1: 50 }); } if (D.eat > 1.6) D.t = 0; }
    else if (there) dog.mood = D.kind === 'squirrel' ? 'bark' : 'play';
    if (D.kind === 'squirrel' && there && Math.random() < dt * 2.2) sfx.bark();
    if (D.t <= 0 || (D.kind === 'squirrel' && !squirrel) || (D.kind === 'sprinkler' && !sprOn())) { dog.distract = null; dog.mood = ''; }
  } else if (ball.state === 'ground') { tx = ball.x; ty = ball.y; }
  else if (ball.state === 'air') {
    if (ball.lob) { tx = ball.tx; ty = ball.ty; if (ball.t > .66 && ball.t < .9 && dog.pounceCool <= 0 && dist(dog, { x: tx, y: ty }) < 150) { lunge(tx, ty, .8); return; } } else { const q = segDist(dog, { x: ball.sx, y: ball.sy }, { x: ball.tx, y: ball.ty }), t = Math.max(q.t, Math.min(1, ball.t + .12)); tx = lerp(ball.sx, ball.tx, t); ty = lerp(ball.sy, ball.ty, t); }
  } else if (ball.state === 'held') {
    const h = kids[ball.holder], o = kids[1 - ball.holder], bold = clamp(h.hold / TUNE.holdBold, 0, 1), dd = dist(dog, h);
    // he switches between guarding the passing lane and charging whoever has the ball
    dog.planT -= dt; if (dog.planT <= 0) { dog.plan = Math.random() < .5 + round * .1 ? 'rush' : 'guard'; dog.planT = rnd(1.5, 2.6); }
    const w = dog.plan === 'rush' ? 1 : .3 + .7 * bold;
    tx = lerp(lerp(h.x, o.x, .38), h.x, w); ty = lerp(lerp(h.y, o.y, .38), h.y, w);
    if (dog.crouch > 0) { dog.crouch -= dt; tx = dog.x; ty = dog.y; dog.face = h.x >= dog.x ? 1 : -1; if (dog.crouch <= 0) lunge(h.x + h.vx * .12, h.y + h.vy * .12); }
    else if (dd < 135 && dd > 40 && dog.pounceCool <= 0 && h.catchCool <= 0 && (bold > .25 || Math.random() < dt * 1.2)) { dog.crouch = TUNE.crouchTime * (dog.zoomT > 0 ? .7 : 1); dog.vx = dog.vy = 0; }
    if (dd < TUNE.stealReach && h.catchCool <= 0 && h.dashT <= 0) { dog.stealT += dt; if (dog.stealT >= TUNE.stealTime) { startTug(h, true); return; } } else dog.stealT = Math.max(0, dog.stealT - dt * 2);
  }
  if (dog.hyper >= 1 && dog.zoomT <= 0) { dog.zoomWait += dt; if (dog.zoomWait > .8) { dog.zoomWait = 0; startZoomies(); } }
  const s = steer(dog, tx, ty), tvx = s.d > 8 ? s.x * sp : 0, tvy = s.d > 8 ? s.y * sp : 0, a = Math.min(1, dt * TUNE.dogAccel / Math.max(60, sp));
  dog.vx += (tvx - dog.vx) * a; dog.vy += (tvy - dog.vy) * a;
}
function humanDog(dt) {
  const I = PADS[dog.ctl], sp = dogSpeed(), a = Math.min(1, dt * 12);
  dog.vx += (I.x * sp - dog.vx) * a; dog.vy += (I.y * sp - dog.vy) * a;
  if (I.hit.a && dog.pounceCool <= 0 && ball.state !== 'dog') { const m = Math.hypot(I.x, I.y); lunge(dog.x + (m > .2 ? I.x : dog.face) * 100, dog.y + (m > .2 ? I.y : 0) * 100); for (const k of kids) if (time - k.fakeAt < .7) dog.fooledAt = time; }
  if (I.hit.b && dog.barkCool <= 0) bark();
  if ((I.hit.c || I.hit.d) && dog.hyper >= 1 && dog.zoomT <= 0) startZoomies();
  const h = holder();
  if (h && dist(dog, h) < TUNE.stealReach + 10 && h.catchCool <= 0 && h.dashT <= 0) { dog.stealT += dt; if (dog.stealT >= TUNE.stealTimeHuman) startTug(h, true); } else dog.stealT = Math.max(0, dog.stealT - dt * 2);
}
function updateDog(dt) {
  for (const t of ['pounceCool', 'barkCool', 'barkT', 'zoomT', 'tugImmune', 'speedT', 'slowT', 'wet']) if (dog[t] > 0) dog[t] = Math.max(0, dog[t] - dt);
  dog.hyper = Math.min(1, dog.hyper + TUNE.hyperPerSec * dt * (dog.zoomT > 0 ? 0 : 1));
  if (tug) { dog.vx = dog.vy = 0; return; }
  if (dog.busy > 0) { dog.busy = Math.max(0, dog.busy - dt); dog.vx *= Math.pow(.02, dt); dog.vy *= Math.pow(.02, dt); if (!dog.busy) dog.mood = ''; }
  else if (dog.pounceT > 0) { // in the air: committed to the direction he jumped
    dog.pounceT -= dt; dog.vx = dog.px * TUNE.pounceSpeed; dog.vy = dog.py * TUNE.pounceSpeed;
    const h = holder(); if (h && dist(dog, h) < TUNE.stealReach + 8 && h.catchCool <= 0) { if (h.dashT > 0) { if (!h.dodged || time - h.dodged > 1) { h.dodged = time; kidsPts(10, h.x, h.y, 'DODGED!', '#9EE8FF'); } } else { startTug(h, true); return; } }
    if (dog.pounceT <= 0) { dog.busy = dog.ctl >= 0 ? .22 : .5; dog.mood = 'skid'; fx(dog.x, dog.y, 6, '#E8F6D0', { up: 20, s1: 90 }); }
  }
  else if (dog.ctl >= 0) humanDog(dt); else cpuDog(dt);
  if (tug) return;
  dog.x += dog.vx * dt; dog.y += dog.vy * dt * .86; keepIn(dog, 18);
  const sp = Math.hypot(dog.vx, dog.vy); if (sp > 30) { dog.run += dt * sp * .06; if (Math.abs(dog.vx) > 24) dog.face = dog.vx > 0 ? 1 : -1; if (Math.random() < dt * (dog.zoomT > 0 ? 24 : 5)) fx(dog.x - dog.face * 16, dog.y, 1, dog.zoomT > 0 ? '#FFD23F' : 'rgba(230,246,200,.8)', { up: 16, s1: 40, r1: 3.5 }); }
  if (ball.state === 'dog') { // keeping it: points every second, kids have to catch him and tug it back
    dog.keepT += dt; dog.keepAcc += dt; if (dog.keepAcc >= 1) { dog.keepAcc -= 1; dogPts(TUNE.keepPts, dog.x, dog.y, ''); }
    if (dog.keepT >= TUNE.keepMax) { dogDrops(true); return; }
    if (dog.tugImmune <= 0) for (const k of kids) if (k.stun <= 0 && dist(k, dog) < 40) { startTug(k, false); break; }
  }
  for (const p of powerups) if (!p.dead && dist(dog, p) < 34 && !dog.busy) { p.dead = true; sfx.power(); fx(p.x, p.y, 10, ['#FFB0A0', '#FFFFFF'], { z: 20, kind: 'star' });
    if (p.kind === 'shoes') { dog.speedT = 6; say(dog.x, dog.y - 60, 'TURBO PAWS!', '#FFB0A0', 19); } else if (p.kind === 'star') { dogDouble = 8; setBanner('DOUBLE POINTS!', 'for Bernard, 8 seconds', '#FFB0A0', 1.2); } else { dog.hyper = Math.min(1, dog.hyper + .5); sfx.chomp(); say(dog.x, dog.y - 60, 'YUM! ZOOMIES UP!', '#FFB0A0', 18); } }
}

/* ---------------- the yard's surprises ---------------- */
const sprOn = () => THEME.sprinkler && (sprT % 11) > 4.5 && (sprT % 11) < 9.5;
function updateExtras(dt) {
  // power-ups
  powerT -= dt; if (powerT <= 0) { powerT = rnd(TUNE.powerEvery[0], TUNE.powerEvery[1]); if (powerups.length < 2) { const s = freeSpot(110); powerups.push({ x: s.x, y: s.y, kind: pick(['star', 'shoes', 'treat']), life: TUNE.powerLife, born: time }); } }
  for (const p of powerups) p.life -= dt; powerups = powerups.filter(p => p.life > 0 && !p.dead);
  // the bullseye ring
  if (ring) { ring.life -= dt; if (ring.hit) { ring.hit -= dt; if (ring.hit <= 0) ring = null; } else if (ring.life <= 0) { ring = null; ringT = rnd(3, 5); } }
  else { ringT -= dt; if (ringT <= 0) { let s; for (let n = 0; n < 30; n++) { s = { x: rnd(200, 760), y: rnd(210, 480) }; if (!inPit(s.x, s.y, 30)) break; } ring = { x: s.x, y: s.y, life: TUNE.ringLife, born: time, hit: 0 }; } }
  // sprinkler
  if (THEME.sprinkler) { const was = sprOn(); sprT += dt; const on = sprOn();
    if (on && !was) { sfx.splash(); say(SPR.x, SPR.y - 30, 'SPRINKLER!', '#9EE8FF', 20); if (dog.ctl < 0 && ball.state !== 'dog' && !tug && !dog.distract && Math.random() < .6) dog.distract = { x: SPR.x + 26, y: SPR.y - 4, t: 2.8, kind: 'sprinkler' }; }
    if (on) { for (let n = 0; n < 3; n++) { const a = time * 2.4 + n * 2.1, r = rnd(10, SPR.r); particles.push({ x: SPR.x + Math.cos(a) * r, y: SPR.y + Math.sin(a) * r * .55, z: rnd(20, 46), vx: Math.cos(a) * 40, vy: Math.sin(a) * 20, vz: 60, life: .5, max: .5, col: '#CFF2FF', r: rnd(1.5, 3), kind: 'dot' }); }
      const wet = e => Math.hypot(e.x - SPR.x, (e.y - SPR.y) * 1.6) < SPR.r; if (wet(dog)) { dog.wet = .3; if (Math.random() < dt * 3) sfx.splash(); } for (const k of kids) if (wet(k) && Math.random() < dt * 8) fx(k.x, k.y, 2, '#CFF2FF', { z: 30, up: 50, s1: 80 }); } }
  // squirrel on the wall
  squirrelT -= dt;
  if (!squirrel && squirrelT <= 0) { const dir = Math.random() < .5 ? 1 : -1; squirrel = { x: dir > 0 ? 60 : 900, v: dir * 135, scared: false }; sfx.squirrel(); squirrelT = rnd(TUNE.squirrelMin, TUNE.squirrelMax);
    if (dog.ctl < 0 && ball.state !== 'dog' && !tug && !dog.distract) { dog.distract = { x: squirrel.x, y: YARD.y0 + 10, t: 3, kind: 'squirrel' }; dog.crouch = 0; say(dog.x, dog.y - 60, 'SQUIRREL!!', '#FFFFFF', 20); } else if (dog.ctl >= 0) say(480, 150, 'SQUIRREL! Bark at it! (A)', '#FFFFFF', 18); }
  if (squirrel) { squirrel.x += squirrel.v * dt; if (squirrel.x < 40 || squirrel.x > 920) squirrel = null; }
}

/* ---------------- rounds ---------------- */
function updatePlay(dt) {
  assignControls();
  if (tug) updateTug(dt);
  for (const k of kids) updateKid(k, dt);
  updateDog(dt); updateBall(dt); updateExtras(dt);
  if (kidsDouble > 0) kidsDouble -= dt; if (dogDouble > 0) dogDouble -= dt; if (hintT > 0) hintT -= dt;
  timer -= dt; const sec = Math.ceil(timer);
  if (sec <= 5 && sec < lastTick && sec > 0) { lastTick = sec; sfx.tick(); }
  if (timer <= 0) endRound();
}
function endRound() {
  timer = 0; const R = roundScores[round]; R.k = kidsScore - R.k0; R.d = dogScore - R.d0; sfx.whistle(); musicStop(); tug = null;
  if (round + 1 >= TUNE.rounds) {
    state = 'end'; stateT = 0; const mine = mode === 'kids' ? kidsScore : dogScore, key = mode === 'kids' ? 'ka_best' : 'ka_best_dog';
    if (mine > best[mode]) { best[mode] = mine; newBest = true; try { localStorage.setItem(key, String(mine)); } catch (e) { } }
    setTimeout(() => { if (state === 'end') sfx.fanfare(); }, 500);
  } else { state = 'roundEnd'; stateT = 0; setTimeout(() => { if (state === 'roundEnd') sfx.win(); }, 400); }
}
function updateFx(dt) {
  for (const p of particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind !== 'trail') { p.z += p.vz * dt; p.vz -= 420 * dt; if (p.z < 0) { p.z = 0; p.vz *= -.3; p.vx *= .5; p.vy *= .5; } } }
  particles = particles.filter(p => p.life > 0); if (particles.length > 420) particles.splice(0, particles.length - 420);
  for (const f of floats) { f.life -= dt; f.y -= dt * 34; } floats = floats.filter(f => f.life > 0);
  if (banner) { banner.life -= dt; if (banner.life <= 0) banner = null; }
  if (shake > 0) shake -= dt; if (flash > 0) flash -= dt;
}
function confetti(n) { for (let i = 0; i < n; i++) particles.push({ x: rnd(40, W - 40), y: rnd(300, 520), z: rnd(260, 520), vx: rnd(-30, 30), vy: 0, vz: rnd(-60, 40), life: rnd(1.6, 3), max: 3, col: pick(['#FF6FA8', '#FFD23F', '#6FD0FF', '#9CFF9C', '#B58CFF', '#FF9A6A']), r: rnd(3, 6), kind: 'conf', rot: rnd(0, TAU) }); }
function update(dt) {
  time += dt; stateT += dt; readPads(); updateFx(dt);
  const press = menuHit('a') || menuHit('b') || menuHit('start'), tap = touch.tapX >= 0 ? touch.tapX : -1; touch.tapX = -1;
  if (state === 'title') {
    if (menuHit('left') || menuHit('up')) { menuIdx = 0; sfx.tick(); } if (menuHit('right') || menuHit('down')) { menuIdx = 1; sfx.tick(); }
    if (tap >= 0) menuIdx = tap < .5 ? 0 : 1;
    if (menuHit('select')) { quit(); return; }
    if ((press || tap >= 0) && stateT > .35) { audio(); sfx.go(); newMatch(menuIdx ? 'dog' : 'kids'); }
  } else if (state === 'ready') {
    assignControls(); const n = 3 - Math.floor((stateT - 1.4)); if (stateT > 1.4 && n < lastTick && n > 0) { lastTick = n; sfx.count(); }
    updateBall(0); if (stateT >= 4.4) { state = 'play'; stateT = 0; lastTick = 99; sfx.go(); setBanner('GO!', '', '#9CFF9C', .7); }
    if (menuHit('start')) { state = 'pause'; pauseIdx = 0; pauseFrom = 'ready'; }
  } else if (state === 'play') {
    if (menuHit('start')) { state = 'pause'; pauseIdx = 0; pauseFrom = 'play'; musicStop(); return; }
    updatePlay(dt);
  } else if (state === 'pause') {
    if (menuHit('up')) { pauseIdx = (pauseIdx + 2) % 3; sfx.tick(); } if (menuHit('down')) { pauseIdx = (pauseIdx + 1) % 3; sfx.tick(); }
    if (menuHit('select')) { quit(); return; }
    if (menuHit('start') || ((menuHit('a') || menuHit('b')) && pauseIdx === 0)) { state = pauseFrom; if (soundOn) musicStart(round); }
    else if (menuHit('a') || menuHit('b')) { if (pauseIdx === 1) { state = 'title'; stateT = 0; } else { quit(); return; } }
  } else if (state === 'roundEnd') {
    if (stateT > 5.5 || (stateT > 1.4 && (press || tap >= 0))) startRound(round + 1);
  } else if (state === 'end') {
    if (Math.random() < dt * 30) confetti(1);
    if (menuHit('select')) { quit(); return; }
    if (stateT > 2 && (press || tap >= 0)) { state = 'title'; stateT = 0; particles = []; }
  }
}
let pauseFrom = 'play';

/* ---------------- drawing ---------------- */
function shadow(x, y, rx, a) { ell(ctx, x, y, rx, rx * .32); fs(ctx, 'rgba(20,40,10,' + (a || .28) + ')'); }
function panel(x, y, w, h, col) { rr(ctx, x, y, w, h, 12); fs(ctx, 'rgba(10,14,26,.8)', col || 'rgba(255,255,255,.18)', col ? 2.5 : 1.5); }
const KCOL = { nic: '#3AB8FF', giulia: '#FF7AB8' };
function sprite(key, x, y, h, flip, rot, alpha) { const img = IMG[key]; if (!ready(key)) return false; const w = h * img.naturalWidth / img.naturalHeight; ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1); if (rot) ctx.rotate(rot); if (alpha != null) ctx.globalAlpha = alpha; ctx.drawImage(img, -w / 2, -h, w, h); ctx.restore(); return true; }
// a round head cut out of a sprite, for the scoreboard
function head(key, x, y, r, fy) { const img = IMG[key]; ell(ctx, x, y, r, r); fs(ctx, '#F4E9D8', INK, 2.5); if (!ready(key)) return; ctx.save(); ell(ctx, x, y, r - 1, r - 1); ctx.clip(); const s = img.naturalWidth * (key === 'bernard' ? .62 : .9); ctx.drawImage(img, (img.naturalWidth - s) * (key === 'bernard' ? .12 : .5), img.naturalHeight * (fy || 0), s, s, x - r, y - r, r * 2, r * 2); ctx.restore(); ell(ctx, x, y, r, r); fs(ctx, null, INK, 2.5); }
function drawKid(k) {
  const moving = Math.hypot(k.vx, k.vy) > 30, jump = k.cheer > 0 ? Math.sin(Math.min(1, k.cheer / .35) * Math.PI) * 16 : 0, bob = moving ? Math.abs(Math.sin(k.run)) * 5 : Math.sin(time * 2 + k.i * 2) * 1.2;
  const hopKey = k.who === 'nic' ? 'nicHop' : 'giuliaHop', useHop = (k.dashT > 0 || k.cheer > 0 || k.fakeT > 0 || (moving && Math.sin(k.run) > .3)) && ready(hopKey);
  const tugging = tug && tug.k === k.i, lean = tugging ? -.22 + Math.sin(time * 30) * .04 : k.stun > 0 ? .5 : k.dashT > 0 ? .25 : moving ? Math.sin(k.run) * .05 : 0;
  shadow(k.x, k.y, 22, .3 - jump * .006);
  if (k.speedT > 0) { ctx.globalAlpha = .3; sprite(useHop ? hopKey : k.who, k.x - k.vx * .05, k.y - bob, 122, k.face < 0, 0); ctx.globalAlpha = 1; }
  if (!sprite(useHop ? hopKey : k.who, k.x + (tugging ? Math.sin(time * 34) * 2 : 0), k.y - bob - jump, 122, k.face < 0, lean)) { rr(ctx, k.x - 16, k.y - 90, 32, 60, 10); fs(ctx, KCOL[k.who]); ell(ctx, k.x, k.y - 96, 16, 16); fs(ctx, '#D9A77A'); }
  const tag = k.who === 'nic' ? 'NICK' : 'GIULIA'; ctx.font = font(12); const tw = ctx.measureText(tag).width + 14; rr(ctx, k.x - tw / 2, k.y + 8, tw, 18, 9); fs(ctx, KCOL[k.who]); text(ctx, tag, k.x, k.y + 17.5, 12, '#FFFFFF');
  if (k.ctl < 0 && !autoAll) text(ctx, 'CPU', k.x, k.y + 36, 10, 'rgba(255,255,255,.75)', 'rgba(0,0,0,.45)', 'center', 3);
  if (k.rattle > 0) text(ctx, '!!', k.x + Math.sin(time * 40) * 3, k.y - 134, 20, '#FFFFFF', INK, 'center', 4);
  if (k.stun > 0) text(ctx, '★', k.x + Math.sin(time * 10) * 14, k.y - 128, 18, '#FFE066', '#5A3A00', 'center', 3);
  if (k.speedT > 0) text(ctx, '»', k.x - k.face * 30, k.y - 50, 22, '#9EE8FF', INK, 'center', 3);
  if (k.ctl >= 0 && k.dashCool > 0 && k.dashT <= 0) { rr(ctx, k.x - 18, k.y + 30, 36, 5, 2.5); fs(ctx, 'rgba(0,0,0,.4)'); rr(ctx, k.x - 18, k.y + 30, 36 * (1 - k.dashCool / TUNE.dashCool), 5, 2.5); fs(ctx, '#9EE8FF'); }
}
function drawDog() {
  const D = dog, moving = Math.hypot(D.vx, D.vy) > 30, bob = moving ? Math.abs(Math.sin(D.run)) * 6 : 0, hop = D.pounceT > 0 ? Math.sin((1 - D.pounceT / TUNE.pounceTime) * Math.PI) * 30 : 0;
  const squat = D.crouch > 0 ? .8 : D.mood === 'munch' ? .9 + Math.sin(time * 18) * .04 : 1, tugging = !!tug;
  shadow(D.x, D.y, 30, .3 - hop * .004);
  if (D.crouch > 0) { ell(ctx, D.x, D.y, 46 + Math.sin(time * 30) * 4, 15); fs(ctx, null, 'rgba(255,90,60,.8)', 3); }
  const img = IMG.bernard, h = 112 * squat, flip = D.face > 0, rot = (tugging ? .2 : D.pounceT > 0 ? -.3 : D.mood === 'dizzy' ? Math.sin(time * 9) * .12 : moving ? Math.sin(D.run * .5) * .06 : 0);
  const x = D.x + (tugging || D.crouch > 0 ? Math.sin(time * 38) * 2 : 0), y = D.y - bob - hop;
  if (D.zoomT > 0 || D.speedT > 0) for (let i = 2; i >= 1; i--) sprite('bernard', x - D.vx * .035 * i, y, h, flip, rot, .22);
  if (!sprite('bernard', x, y, h, flip, rot)) { ell(ctx, x, y - 40, 40, 26); fs(ctx, '#3A2A1E'); }
  if (D.zoomT > 0) { ell(ctx, D.x, D.y - 50, 54, 62); fs(ctx, null, 'rgba(255,210,63,' + (.35 + Math.sin(time * 20) * .2) + ')', 4); }
  if (D.barkT > 0) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(D.x + D.face * 30, D.y - 60, 20 + i * 16 + (1 - D.barkT / .35) * 30, D.face > 0 ? -.7 : Math.PI - .7, D.face > 0 ? .7 : Math.PI + .7); ctx.strokeStyle = 'rgba(255,255,255,' + D.barkT * 2 + ')'; ctx.lineWidth = 4; ctx.stroke(); }
  const note = D.mood === 'dizzy' ? '★' : D.mood === 'pant' ? 'pant… pant…' : D.mood === 'munch' ? 'nom nom' : D.mood === 'play' ? 'splash!' : D.mood === 'bark' ? 'WOOF! WOOF!' : D.slowT > 0 ? 'so full…' : '';
  if (note) text(ctx, note, D.x + (note === '★' ? Math.sin(time * 10) * 14 : 0), D.y - 122, note === '★' ? 18 : 14, note === '★' ? '#FFE066' : '#FFFFFF', INK, 'center', 3);
  if (D.ctl >= 0) { text(ctx, 'YOU', D.x, D.y + 18, 12, '#FFD23F', INK, 'center', 3); }
  if (ball.state === 'dog' && !tug) { const f = 1 - D.keepT / TUNE.keepMax; rr(ctx, D.x - 26, D.y - 138, 52, 7, 3.5); fs(ctx, 'rgba(0,0,0,.45)'); rr(ctx, D.x - 26, D.y - 138, 52 * f, 7, 3.5); fs(ctx, '#FFB0A0'); }
}
function drawBallAt(x, y, r, spin, B) {
  if (B.id === 'tennis' && ready('tennis')) { ctx.save(); ctx.translate(x, y); ctx.rotate(spin); ctx.drawImage(IMG.tennis, -r, -r, r * 2, r * 2); ctx.restore(); return; }
  ctx.save(); ctx.translate(x, y); ctx.rotate(spin); ell(ctx, 0, 0, r, r); fs(ctx, B.col, INK, 2);
  if (B.id === 'beach') { for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, i * TAU / 3, i * TAU / 3 + TAU / 6); ctx.closePath(); ctx.fillStyle = ['#FFFFFF', '#3AB8FF', '#FFD23F'][i]; ctx.fill(); } ell(ctx, 0, 0, r * .22, r * .22); fs(ctx, '#FFFFFF'); ell(ctx, 0, 0, r, r); fs(ctx, null, INK, 2); }
  else { ctx.beginPath(); ctx.arc(-r * .3, 0, r * .7, -1.1, 1.1); ctx.strokeStyle = B.line; ctx.lineWidth = 2; ctx.stroke(); ell(ctx, r * .3, -r * .3, r * .22, r * .16); fs(ctx, 'rgba(255,255,255,.7)'); }
  ctx.restore();
}
function drawBall() { const s = 1 + (ball.state === 'air' ? ball.z / 500 : 0); shadow(ball.x, ball.y, BALL.r * .9 * (1 - Math.min(.5, ball.z / 400)), .25); drawBallAt(ball.x, ball.y - ball.z, BALL.r * s, ball.spin, BALL); }
function drawSquirrel() {
  if (!squirrel) return; const S = squirrel, x = S.x, y = 104 + Math.abs(Math.sin(time * 14)) * -6;
  ctx.save(); ctx.translate(x, y); if (S.v < 0) ctx.scale(-1, 1);
  ctx.beginPath(); ctx.moveTo(-10, -2); ctx.quadraticCurveTo(-30, -26, -14, -30); ctx.quadraticCurveTo(-4, -20, -8, -6); ctx.closePath(); fs(ctx, '#9A6A44', '#4A2A14', 1.5);
  ell(ctx, 0, -6, 12, 7); fs(ctx, '#A8774E', '#4A2A14', 1.5); ell(ctx, 11, -11, 6, 5); fs(ctx, '#A8774E', '#4A2A14', 1.5); ell(ctx, 13, -12, 1.4, 1.4); fs(ctx, '#111');
  ctx.restore(); if (S.scared) text(ctx, '!', x, y - 40, 20, '#FFFFFF', INK, 'center', 4);
}
function drawPower(p) {
  const bobY = Math.sin((time - p.born) * 4) * 4, pop = Math.min(1, (time - p.born) * 4); if (p.life < 2 && Math.floor(time * 8) % 2) return;
  shadow(p.x, p.y, 16, .22); ctx.save(); ctx.translate(p.x, p.y - 22 + bobY); ctx.scale(pop, pop);
  const gl = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); gl.addColorStop(0, 'rgba(255,255,220,.75)'); gl.addColorStop(1, 'rgba(255,255,220,0)'); ctx.fillStyle = gl; ctx.fillRect(-30, -30, 60, 60);
  if (p.kind === 'star') { star(ctx, 0, 0, 17, time * 2); fs(ctx, '#FFD23F', INK, 2.5); text(ctx, 'x2', 0, 1, 12, INK); }
  else if (p.kind === 'shoes') { ctx.rotate(-.2); rr(ctx, -16, -4, 30, 13, 6); fs(ctx, '#3AB8FF', INK, 2.5); rr(ctx, -16, -13, 15, 14, 5); fs(ctx, '#3AB8FF', INK, 2.5); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-15, 6, 29, 3); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; for (const q of [-24, -27, -22]) { ctx.beginPath(); ctx.moveTo(q, -8 + (q + 24) * 3); ctx.lineTo(q - 9, -8 + (q + 24) * 3); ctx.stroke(); } }
  else { if (ready('bone')) ctx.drawImage(IMG.bone, -19, -14, 38, 29); else { rr(ctx, -15, -5, 30, 10, 5); fs(ctx, '#F4E9D8', INK, 2.5); for (const [bx, by] of [[-15, -6], [-15, 6], [15, -6], [15, 6]]) { ell(ctx, bx, by, 6, 6); fs(ctx, '#F4E9D8', INK, 2); } } }
  ctx.restore();
}
function drawRing(R, front) { // a floating star hoop: throw the ball through it
  const a = R.hit ? R.hit / .5 : Math.min(1, (time - R.born) * 3) * (R.life < 2 && Math.floor(time * 8) % 2 ? .4 : 1), y = R.y - 40 + Math.sin(time * 3) * 4, s = R.hit ? 1 + (1 - a) * .8 : 1;
  ctx.save(); ctx.globalAlpha = a; if (!front) { shadow(R.x, R.y, 22, .2); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(R.x, R.y); ctx.lineTo(R.x, y + 26); ctx.stroke(); ctx.setLineDash([]); }
  ctx.beginPath(); ctx.ellipse(R.x, y, 15 * s, 27 * s, 0, front ? -Math.PI / 2 : Math.PI / 2, front ? Math.PI / 2 : Math.PI * 1.5); ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 5; ctx.stroke();
  if (front) { star(ctx, R.x, y - 34 * s, 9, time * 2); fs(ctx, '#FFD23F', INK, 2); }
  ctx.restore();
}
function drawSprinkler() {
  ell(ctx, SPR.x, SPR.y, 12, 5); fs(ctx, '#4A4A52', INK, 2); rr(ctx, SPR.x - 4, SPR.y - 14, 8, 14, 3); fs(ctx, '#FFD23F', INK, 2);
  if (!sprOn()) return; ell(ctx, SPR.x, SPR.y, SPR.r, SPR.r * .55); fs(ctx, 'rgba(120,200,255,.16)', 'rgba(200,240,255,.35)', 2);
  ctx.strokeStyle = 'rgba(220,245,255,.8)'; ctx.lineWidth = 2.5; for (let i = 0; i < 6; i++) { const a = time * 2.4 + i * TAU / 6, ex = SPR.x + Math.cos(a) * SPR.r * .9, ey = SPR.y + Math.sin(a) * SPR.r * .5; ctx.beginPath(); ctx.moveTo(SPR.x, SPR.y - 14); ctx.quadraticCurveTo((SPR.x + ex) / 2, SPR.y - 60, ex, ey); ctx.stroke(); }
  const rb = ctx.createLinearGradient(SPR.x - 60, 0, SPR.x + 60, 0); ['rgba(255,80,80,.3)', 'rgba(255,220,80,.3)', 'rgba(80,220,120,.3)', 'rgba(80,160,255,.3)'].forEach((c, i) => rb.addColorStop(i / 3, c)); ctx.strokeStyle = rb; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(SPR.x, SPR.y - 8, 62, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
}
function drawTugMeter() {
  const k = kids[tug.k], x = (k.x + dog.x) / 2, y = Math.min(k.y, dog.y) - 150, w = 190;
  panel(x - w / 2 - 12, y - 30, w + 24, 62, '#FFD23F'); text(ctx, 'TUG OF WAR!', x, y - 16, 14, '#FFD23F');
  rr(ctx, x - w / 2, y, w, 16, 8); fs(ctx, '#FF8A70', INK, 2); rr(ctx, x - w / 2, y, w * clamp(tug.m, 0, 1), 16, 8); fs(ctx, KCOL[k.who]); rr(ctx, x - w / 2, y, w, 16, 8); fs(ctx, null, INK, 2);
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - 1, y - 2, 2, 20);
  const human = (k.ctl >= 0 || dog.ctl >= 0); if (human && Math.floor(time * 8) % 2) text(ctx, 'MASH B!', x, y + 46, 20, '#C6FF3D', '#1F3A08', 'center', 5);
}
function drawParticle(p) {
  const a = clamp(p.life / (p.kind === 'trail' ? p.max : .3), 0, 1), y = p.y - p.z; ctx.globalAlpha = p.kind === 'trail' ? a * .4 : a;
  if (p.kind === 'star') { star(ctx, p.x, y, p.r * 1.6, p.rot + time * 4); fs(ctx, p.col); }
  else if (p.kind === 'conf') { ctx.save(); ctx.translate(p.x + Math.sin(time * 3 + p.rot) * 10, y); ctx.rotate(p.rot + time * 5); ctx.fillStyle = p.col; ctx.fillRect(-p.r, -p.r * .5, p.r * 2, p.r); ctx.restore(); }
  else { ell(ctx, p.x, y, p.r * (p.kind === 'trail' ? a : 1), p.r * (p.kind === 'trail' ? a : 1)); fs(ctx, p.col); }
  ctx.globalAlpha = 1;
}
function drawTita() { // Tita watches from the patio and cheers
  const x = 62, y = H - 52, big = banner || (kids[0] && (kids[0].cheer > 0 || kids[1].cheer > 0)), r = 34 + (big ? Math.abs(Math.sin(time * 12)) * 3 : 0);
  ell(ctx, x, y, r + 4, r + 4); fs(ctx, '#FFD23F', INK, 3);
  if (!titaImg) { titaImg = new Image(); titaImg.src = '/art/tita-portrait.jpg'; }
  if (titaImg.complete && titaImg.naturalWidth) { ctx.save(); ell(ctx, x, y, r, r); ctx.clip(); const s = Math.min(titaImg.naturalWidth, titaImg.naturalHeight); ctx.drawImage(titaImg, (titaImg.naturalWidth - s) / 2, 0, s, s, x - r, y - r, r * 2, r * 2); ctx.restore(); } else { ell(ctx, x, y, r, r); fs(ctx, '#E9B48C'); }
  if (titaSay.t > 0) { ctx.font = font(13); const w = ctx.measureText(titaSay.s).width + 20; ctx.globalAlpha = clamp(titaSay.t * 3, 0, 1); rr(ctx, x + 34, y - 46, w, 26, 13); fs(ctx, '#FFFFFF', INK, 2); ctx.beginPath(); ctx.moveTo(x + 44, y - 22); ctx.lineTo(x + 36, y - 10); ctx.lineTo(x + 56, y - 22); ctx.closePath(); fs(ctx, '#FFFFFF'); text(ctx, titaSay.s, x + 34 + w / 2, y - 32.5, 13, INK); ctx.globalAlpha = 1; }
}
let titaImg = null; const titaSay = { s: '', t: 0, last: { c: 0, s: 0 } };
function titaWatch(dt) { // picks something to shout when the score changes
  if (titaSay.t > 0) titaSay.t -= dt; const L = titaSay.last;
  if (steals > L.s) { L.s = steals; titaSay.s = pick(mode === 'kids' ? ['Bernard! Drop it!', 'Get it back, kids!', '¡Ay, Bernard!'] : ['Good boy, Bernard!', 'Run, Bernard, run!']); titaSay.t = 2.2; }
  else if (catches >= L.c + 6) { L.c = catches; titaSay.s = pick(mode === 'kids' ? ['¡Muy bien!', 'Nice catch!', 'Keep it going!', 'Go Nick! Go Giulia!', 'Wow!'] : ['Get that ball, Bernard!', 'They are too quick!', 'Go on, Bernard!']); titaSay.t = 2; }
  if (catches < L.c) L.c = catches; if (steals < L.s) L.s = steals;
}
function drawWorld() {
  ctx.drawImage(yardFor(round), 0, 0, W, H);
  if (THEME.lights) for (let i = 0; i < 14; i++) { const fx_ = 90 + hash(i, 61) * 780 + Math.sin(time * .7 + i) * 18, fy = 200 + hash(i, 62) * 280 + Math.cos(time * .9 + i * 2) * 10, a = .35 + Math.sin(time * 3 + i * 1.7) * .35; if (a > 0) { ell(ctx, fx_, fy, 2.2, 2.2); fs(ctx, 'rgba(255,240,140,' + a + ')'); ell(ctx, fx_, fy, 6, 6); fs(ctx, 'rgba(255,240,140,' + a * .25 + ')'); } }
  drawSquirrel(); if (THEME.sprinkler) drawSprinkler();
  // pass guide: where the ball would go, gold when it lines up with the star ring
  const h = holder();
  if (h && h.ctl >= 0 && state === 'play') { const o = kids[1 - h.i], gold = ring && !ring.hit && segDist(ring, h, o).d < 30, blocked = segDist(dog, h, o).d < 60; ctx.setLineDash([5, 11]); ctx.lineDashOffset = -time * 40; ctx.strokeStyle = gold ? 'rgba(255,215,60,.95)' : blocked ? 'rgba(255,120,100,.6)' : 'rgba(255,255,255,.45)'; ctx.lineWidth = gold ? 4 : 2.5; ctx.beginPath(); ctx.moveTo(h.x, h.y - 6); ctx.lineTo(o.x, o.y - 6); ctx.stroke(); ctx.setLineDash([]); ell(ctx, o.x, o.y, 30, 10); fs(ctx, null, gold ? 'rgba(255,215,60,.9)' : 'rgba(255,255,255,.4)', 2.5); }
  if (ball.state === 'air') { ell(ctx, ball.tx, ball.ty, 20 + Math.sin(time * 14) * 3, 7); fs(ctx, null, 'rgba(255,255,255,.7)', 2.5); }
  for (const p of particles) if (p.z <= 0 && p.kind === 'dot') drawParticle(p);
  const items = [{ y: PIT.y, f: () => drawFirePit(ctx, time, !!THEME.lights) }, { y: dog.y, f: drawDog }];
  for (const k of kids) items.push({ y: k.y, f: () => drawKid(k) });
  for (const p of powerups) items.push({ y: p.y, f: () => drawPower(p) });
  if (ring) { items.push({ y: ring.y - .2, f: () => drawRing(ring, false) }); items.push({ y: ring.y + .2, f: () => drawRing(ring, true) }); }
  items.push({ y: ball.y + (ball.state === 'air' ? 0 : .6), f: drawBall });
  items.sort((a, b) => a.y - b.y); for (const it of items) it.f();
  for (const p of particles) if (!(p.z <= 0 && p.kind === 'dot')) drawParticle(p);
  if (tug) drawTugMeter();
  for (const f of floats) { ctx.globalAlpha = clamp(f.life / f.max * 2.2, 0, 1); const s = f.size * (1 + Math.max(0, f.life / f.max - .8) * 1.5); text(ctx, f.text, clamp(f.x, 90, W - 90), f.y, s, f.col, INK, 'center', 5); ctx.globalAlpha = 1; }
  drawTita();
}
function drawHUD() {
  const kidsLead = kidsScore >= dogScore;
  // kids
  panel(12, 10, 286, 62, kidsLead ? '#C6FF3D' : null); head('nic', 42, 41, 22, .02); head('giulia', 82, 41, 22, .03);
  text(ctx, 'KIDS', 112, 27, 13, '#B4C2E2', null, 'left'); text(ctx, String(kidsScore), 112, 50, 28, '#FFFFFF', INK, 'left', 4);
  if (streak >= 2) { const hot = streak >= 5; text(ctx, (hot ? '🔥 ' : '') + streak + ' in a row', 288, 27, 13, hot ? '#FFB53A' : '#9CFF9C', null, 'right'); }
  if (kidsDouble > 0) text(ctx, 'x2  ' + Math.ceil(kidsDouble), 288, 52, 16, '#FFD23F', INK, 'right', 3);
  // Bernard
  panel(W - 298, 10, 286, 62, !kidsLead ? '#FF8A70' : null); head('bernard', W - 42, 41, 22, .04);
  text(ctx, 'BERNARD', W - 74, 27, 13, '#B4C2E2', null, 'right'); text(ctx, String(dogScore), W - 74, 50, 28, '#FFFFFF', INK, 'right', 4);
  const full = dog.hyper >= 1 || dog.zoomT > 0; text(ctx, 'ZOOMIES', W - 288, 27, 10, full ? '#FFD23F' : '#8E9BBE', null, 'left'); rr(ctx, W - 288, 38, 96, 10, 5); fs(ctx, 'rgba(255,255,255,.14)'); rr(ctx, W - 288, 38, 96 * (dog.zoomT > 0 ? dog.zoomT / TUNE.zoomTime : dog.hyper), 10, 5); fs(ctx, full ? (Math.floor(time * 8) % 2 ? '#FFD23F' : '#FF9A6A') : '#FF9A6A');
  if (dogDouble > 0) text(ctx, 'x2  ' + Math.ceil(dogDouble), W - 288, 60, 13, '#FFD23F', INK, 'left', 3); else if (dog.ctl >= 0 && dog.hyper >= 1 && dog.zoomT <= 0) text(ctx, 'press X!', W - 288, 60, 12, '#FFD23F', null, 'left');
  // middle: round pips, clock, ball
  panel(W / 2 - 112, 10, 224, 62); const t = Math.max(0, Math.ceil(timer)), low = t <= 5 && state === 'play';
  for (let i = 0; i < TUNE.rounds; i++) { ell(ctx, W / 2 - 86 + i * 20, 28, 7, 7); fs(ctx, i < round ? '#C6FF3D' : i === round ? '#FFD23F' : 'rgba(255,255,255,.18)', INK, 1.5); }
  text(ctx, 'x' + mult(), W / 2 - 66, 52, 17, '#FFD23F', INK, 'center', 3);
  text(ctx, String(t), W / 2, 42, low ? 38 + Math.sin(time * 16) * 3 : 34, low ? '#FF5A4A' : '#FFFFFF', INK, 'center', 5);
  drawBallAt(W / 2 + 70, 34, 11, time * 2, { ...BALL, r: 11 }); text(ctx, BALL.name.split(' ')[0], W / 2 + 70, 58, 9, '#B4C2E2');
  if (!soundOn) text(ctx, 'MUTED (M)', W / 2, 84, 11, 'rgba(255,255,255,.7)', 'rgba(0,0,0,.5)', 'center', 3);
  if (banner && state === 'play') { const p = Math.min(1, (banner.max - banner.life) * 6), a = clamp(banner.life * 3, 0, 1); ctx.globalAlpha = a; text(ctx, banner.text, W / 2, 128, 44 * (.6 + p * .4), banner.col, INK, 'center', 9); if (banner.sub) text(ctx, banner.sub, W / 2, 164, 16, '#FFFFFF', INK, 'center', 4); ctx.globalAlpha = 1; }
  if (state === 'play' && hintT > 0) { ctx.globalAlpha = clamp(hintT, 0, 1); panel(W / 2 - 250, H - 44, 500, 30); text(ctx, mode === 'kids' ? 'B pass  ·  A lob  ·  Y fake  ·  X dash  ·  throw through the ★ ring!' : 'B pounce  ·  A bark  ·  X zoomies  ·  steal the ball and run!', W / 2, H - 29, 13, '#FFFFFF'); ctx.globalAlpha = 1; }
}
function drawReady() {
  ctx.fillStyle = 'rgba(8,10,20,.42)'; ctx.fillRect(0, 0, W, H);
  if (stateT < 1.4) { const p = ease(clamp(stateT * 3, 0, 1)); ctx.save(); ctx.translate(W / 2, 250); ctx.scale(.6 + p * .4, .6 + p * .4); ctx.globalAlpha = p;
    rr(ctx, -290, -96, 580, 192, 22); fs(ctx, 'rgba(12,16,30,.92)', '#FFD23F', 3);
    text(ctx, 'ROUND ' + (round + 1) + ' OF ' + TUNE.rounds, 0, -62, 18, '#B4C2E2'); text(ctx, THEME.name, 0, -18, 46, '#FFD23F', INK, 'center', 9);
    drawBallAt(-200, 40, 16, time * 3, { ...BALL, r: 16 }); text(ctx, BALL.name, -176, 40, 17, '#FFFFFF', null, 'left'); text(ctx, THEME.tip, 0, 72, 14, '#C6FF3D');
    ctx.restore(); }
  else { const n = 3 - Math.floor(stateT - 1.4), f = (stateT - 1.4) % 1; ctx.globalAlpha = clamp(1.5 - f * 1.3, 0, 1); text(ctx, String(clamp(n, 1, 3)), W / 2, 280, 130 + f * 50, '#FFD23F', INK, 'center', 14); ctx.globalAlpha = 1;
    text(ctx, mode === 'kids' ? 'Keep the ball away from Bernard!' : 'You are Bernard. Get that ball!', W / 2, 400, 22, '#FFFFFF', INK, 'center', 5); }
}
function scoreCard(x, y, w, key, name, val, col, lead) { rr(ctx, x, y, w, 96, 16); fs(ctx, 'rgba(255,255,255,.07)', lead ? col : 'rgba(255,255,255,.18)', lead ? 3.5 : 1.5); if (key === 'kids') { head('nic', x + 40, y + 48, 26, .02); head('giulia', x + 84, y + 48, 26, .03); } else head('bernard', x + 46, y + 48, 30, .04); text(ctx, name, x + w - 20, y + 28, 15, '#B4C2E2', null, 'right'); text(ctx, String(val), x + w - 20, y + 62, 36, lead ? col : '#FFFFFF', INK, 'right', 5); }
function drawRoundEnd() {
  ctx.fillStyle = 'rgba(8,10,20,' + Math.min(.66, stateT * 2) + ')'; ctx.fillRect(0, 0, W, H);
  const p = ease(clamp(stateT * 2.5, 0, 1)), R = roundScores[round]; ctx.save(); ctx.translate(W / 2, 270); ctx.scale(.7 + p * .3, .7 + p * .3); ctx.globalAlpha = p;
  rr(ctx, -300, -180, 600, 350, 22); fs(ctx, 'rgba(12,16,30,.95)', '#FFD23F', 3);
  text(ctx, 'ROUND ' + (round + 1) + ' DONE!', 0, -140, 38, '#FFD23F', INK, 'center', 8);
  const cnt = ease(clamp((stateT - .4) / 1, 0, 1));
  scoreCard(-276, -100, 264, 'kids', 'KIDS', kidsScore, '#C6FF3D', kidsScore >= dogScore); scoreCard(12, -100, 264, 'dog', 'BERNARD', dogScore, '#FF8A70', dogScore > kidsScore);
  text(ctx, 'this round  +' + Math.round(R.k * cnt), -144, 16, 15, '#C6FF3D'); text(ctx, 'this round  +' + Math.round(R.d * cnt), 144, 16, 15, '#FF8A70');
  const diff = Math.abs(kidsScore - dogScore), msg = kidsScore === dogScore ? 'All tied up!' : kidsScore > dogScore ? 'The kids lead by ' + diff + '!' : 'Bernard leads by ' + diff + '!';
  text(ctx, msg, 0, 58, 24, '#FFFFFF', INK, 'center', 5);
  const N = THEMES[round + 1]; text(ctx, 'NEXT:  ' + N.name + '   ·   ' + BALLS[N.ball].name + '   ·   points x' + (round + 2), 0, 100, 15, '#B4C2E2');
  if (stateT > 1.4) { ctx.globalAlpha = .6 + Math.sin(time * 5) * .4; text(ctx, 'PRESS B FOR THE NEXT ROUND', 0, 140, 18, '#C6FF3D', '#1F3A08', 'center', 5); }
  ctx.restore();
}
function endStars() { const me = mode === 'kids' ? kidsScore : dogScore, them = mode === 'kids' ? dogScore : kidsScore; return me > them * 1.6 ? 3 : me > them ? 2 : 1; }
function drawEnd() {
  ctx.fillStyle = 'rgba(8,10,20,' + Math.min(.7, stateT) + ')'; ctx.fillRect(0, 0, W, H);
  for (const q of particles) if (q.kind === 'conf') drawParticle(q);
  const p = ease(clamp(stateT * 2, 0, 1)), kidsWin = kidsScore > dogScore, tie = kidsScore === dogScore, iWin = tie ? false : (mode === 'kids') === kidsWin;
  ctx.save(); ctx.translate(W / 2, 268); ctx.scale(.7 + p * .3, .7 + p * .3); ctx.globalAlpha = p;
  rr(ctx, -310, -214, 620, 428, 22); fs(ctx, 'rgba(12,16,30,.95)', '#FFD23F', 3);
  text(ctx, tie ? "IT'S A TIE!" : kidsWin ? 'THE KIDS WIN!' : 'BERNARD WINS!', 0, -170, 42, tie ? '#FFFFFF' : kidsWin ? '#C6FF3D' : '#FF8A70', INK, 'center', 9);
  const n = endStars(); for (let i = 0; i < 3; i++) { const on = i < n && stateT > .7 + i * .35, pop = on ? 1 + Math.max(0, .25 - (stateT - .7 - i * .35)) * 2 : 1; star(ctx, -62 + i * 62, -112, 24 * pop, 0); fs(ctx, on ? '#FFD23F' : 'rgba(255,255,255,.12)', INK, 3); }
  scoreCard(-286, -74, 274, 'kids', 'KIDS', kidsScore, '#C6FF3D', kidsWin); scoreCard(12, -74, 274, 'dog', 'BERNARD', dogScore, '#FF8A70', !kidsWin && !tie);
  // round by round
  for (let i = 0; i < TUNE.rounds; i++) { const R = roundScores[i] || { k: 0, d: 0 }, y = 44 + i * 22; text(ctx, THEMES[i].name, 0, y, 12, '#8E9BBE'); text(ctx, '+' + (R.k || 0), -150, y, 14, (R.k || 0) >= (R.d || 0) ? '#C6FF3D' : '#B4C2E2'); text(ctx, '+' + (R.d || 0), 150, y, 14, (R.d || 0) > (R.k || 0) ? '#FF8A70' : '#B4C2E2'); }
  text(ctx, catches + ' catches   ·   best streak ' + bestStreak + '   ·   ' + tricks + ' trick shots   ·   ' + steals + (steals === 1 ? ' steal' : ' steals'), 0, 122, 13, '#FFFFFF');
  if (newBest) { if (Math.floor(time * 4) % 2 === 0) text(ctx, '★ NEW BEST SCORE! ★', 0, 150, 18, '#FFD23F', INK, 'center', 4); } else text(ctx, (iWin ? pick1(['What a game!', 'Champions of the backyard!']) : tie ? 'So close!' : mode === 'kids' ? 'Bernard needs a nap now.' : 'The kids were too quick this time!') + '   Best: ' + best[mode], 0, 150, 14, '#B4C2E2');
  if (stateT > 2) { ctx.globalAlpha = .6 + Math.sin(time * 5) * .4; text(ctx, 'B: play again   ·   SELECT: arcade', 0, 186, 17, '#C6FF3D'); }
  ctx.restore();
  // the winners bounce at the bottom
  const hop = i => Math.abs(Math.sin(time * 6 + i)) * 26;
  if (stateT > .6) { if (kidsWin || tie) { sprite('nicHop', 96, H - 6 - hop(0), 150, false); sprite('giuliaHop', W - 96, H - 6 - hop(1.3), 150, true); } if (!kidsWin || tie) sprite('bernard', tie ? W / 2 : 110, H - 4 - hop(2), 132, true, Math.sin(time * 6) * .08); if (!kidsWin && !tie) drawBallAt(196, H - 40 - hop(2), 14, time * 3, { ...BALL, r: 14 }); }
}
let endLine = ''; function pick1(a) { if (!endLine || !a.includes(endLine)) endLine = pick(a); return endLine; }
function drawTitle() {
  ctx.drawImage(yardFor(0), 0, 0, W, H); drawFirePit(ctx, time, false);
  ctx.fillStyle = 'rgba(8,12,26,.5)'; ctx.fillRect(0, 0, W, H);
  // a ball looping between the kids over Bernard's head
  const t = (time * .7) % 2, u = t < 1 ? t : 2 - t, bx = lerp(150, 810, ease(u)), by = 250 - Math.sin(u * Math.PI) * 120;
  sprite(t < 1 ? 'nicHop' : 'nic', 120, 500, 190, false); sprite(t < 1 ? 'giulia' : 'giuliaHop', 840, 500, 190, true);
  sprite('bernard', 480 + Math.sin(time * 1.4) * 150, 512 - Math.abs(Math.sin(time * 5)) * 22, 150, Math.cos(time * 1.4) > 0);
  drawBallAt(bx, by, 16, time * 6, { ...BALLS[0], r: 16 });
  text(ctx, "BERNARD'S", W / 2, 62, 34, '#FFFFFF', INK, 'center', 8); text(ctx, 'KEEP-AWAY', W / 2, 116, 72, '#FFD23F', INK, 'center', 14);
  text(ctx, '3 rounds  ·  kids against Bernard  ·  most points wins', W / 2, 166, 16, '#FFFFFF', INK, 'center', 4);
  const two = PADS.count >= 2 || p2KeysUsed, cards = [
    { t: 'TEAM KIDS', col: '#C6FF3D', l: [two ? 'Nick: controller 1  ·  Giulia: controller 2' : 'You are Nick  ·  the computer is Giulia', 'Pass, lob, fake and dash.', 'Keep the ball away from Bernard!'], draw: (x, y) => { head('nic', x - 30, y, 30, .02); head('giulia', x + 30, y, 30, .03); } },
    { t: 'BE BERNARD!', col: '#FF8A70', l: [two ? 'Bernard: controller 1  ·  Nick: controller 2' : 'You are Bernard  ·  computer kids', 'Pounce, bark and get the zoomies.', 'Steal the ball and run with it!'], draw: (x, y) => { head('bernard', x, y, 34, .04); } }];
  cards.forEach((c, i) => { const x = W / 2 + (i ? 16 : -316), y = 196, on = menuIdx === i, lift = on ? Math.sin(time * 5) * 3 - 4 : 0;
    ctx.save(); ctx.translate(0, lift); rr(ctx, x, y, 300, 190, 18); fs(ctx, on ? 'rgba(18,24,44,.96)' : 'rgba(12,16,30,.72)', on ? c.col : 'rgba(255,255,255,.2)', on ? 5 : 2);
    c.draw(x + 150, y + 48); text(ctx, c.t, x + 150, y + 102, 28, on ? c.col : '#FFFFFF', INK, 'center', 6); c.l.forEach((s, n) => text(ctx, s, x + 150, y + 130 + n * 18, n ? 13 : 12, n === 2 ? '#FFFFFF' : '#B4C2E2'));
    ctx.restore(); });
  ctx.globalAlpha = .6 + Math.sin(time * 5) * .4; text(ctx, '◀ ▶ CHOOSE   ·   PRESS B TO PLAY', W / 2, 416, 22, '#C6FF3D', '#1F3A08', 'center', 6); ctx.globalAlpha = 1;
  panel(W / 2 - 330, 440, 660, 52);
  text(ctx, menuIdx ? 'BERNARD:  B pounce   ·   A bark   ·   X zoomies   ·   mash B in a tug' : 'KIDS:  B fast pass   ·   A lob   ·   Y fake   ·   X dash   ·   mash B in a tug', W / 2, 457, 14, '#FFFFFF');
  text(ctx, menuIdx ? 'Snatch passes out of the air, or sit on a kid until you grab it.' : 'Throw through the ★ ring, grab power-ups, and watch for the sprinkler.', W / 2, 477, 12, '#B4C2E2');
  text(ctx, 'Best  kids ' + best.kids + '  ·  Bernard ' + best.dog, W - 150, H - 16, 13, '#FFD23F', 'rgba(0,0,0,.5)', 'right', 3);
  text(ctx, 'SELECT: back to the arcade', 20, H - 16, 12, 'rgba(255,255,255,.7)', 'rgba(0,0,0,.5)', 'left', 3);
}
function drawPause() {
  ctx.fillStyle = 'rgba(8,10,20,.6)'; ctx.fillRect(0, 0, W, H); text(ctx, 'PAUSED', W / 2, 170, 48, '#FFD23F', INK, 'center', 9);
  ['Resume', 'Restart', 'Quit to Arcade'].forEach((s, i) => text(ctx, (i === pauseIdx ? '▶ ' : '') + s, W / 2, 250 + i * 46, 26, i === pauseIdx ? '#C6FF3D' : '#FFFFFF', INK, 'center', 5));
}
function render() {
  ctx.save(); if (shake > 0) ctx.translate(Math.sin(time * 50) * shake * 14, Math.cos(time * 37) * shake * 9);
  if (state === 'title') drawTitle(); else { drawWorld(); drawHUD(); }
  ctx.restore();
  if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + flash * 1.6 + ')'; ctx.fillRect(0, 0, W, H); }
  if (state === 'ready') drawReady(); if (state === 'roundEnd') drawRoundEnd(); if (state === 'pause') drawPause(); if (state === 'end') drawEnd();
}

/* ---------------- loop + arcade hookup ---------------- */
let raf = 0, last = 0, acc = 0, running = false;
function loop(ts) {
  if (!running) return; raf = requestAnimationFrame(loop);
  if (!last) last = ts; let dt = (ts - last) / 1000; last = ts; if (dt > .1) dt = .1; acc += dt;
  try { let n = 0; while (acc >= 1 / 60 && n < 4) { update(1 / 60); if (state === 'play') titaWatch(1 / 60); acc -= 1 / 60; n++; } render(); } catch (err) { if (window.console) console.error('keep-away frame', err); }
}
function quit() { musicStop(); if (typeof window.KA.onQuit === 'function') { stop(); window.KA.onQuit(); } else { state = 'title'; stateT = 0; } }
function start() {
  if (running) return; running = true; fitStage(); newMatch('kids'); musicStop(); state = 'title'; stateT = 0; time = 0; menuIdx = 0;
  for (const I of PADS) I.prev = { a: true, b: true, c: true, d: true, start: true, select: true, any: true, left: true, right: true, up: true, down: true }; // ignore the press that opened the game
  window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); window.addEventListener('blur', onBlur); window.addEventListener('resize', fitStage);
  last = 0; raf = requestAnimationFrame(loop);
}
function stop() { running = false; musicStop(); cancelAnimationFrame(raf); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur); window.removeEventListener('resize', fitStage); for (const k in keys) keys[k] = false; }
bindTouch();
window.KA = {
  start, stop, onQuit: null, get state() { return state; },
  // test hooks
  dbg() { return { state, mode, round, kidsScore, dogScore, streak, catches, steals, tricks, timer: +timer.toFixed(1), ball: ball.state, kind: BALL.id, tug: !!tug, dog: { x: Math.round(dog.x), y: Math.round(dog.y), ctl: dog.ctl, zoom: +dog.zoomT.toFixed(1), hyper: +dog.hyper.toFixed(2), distract: dog.distract && dog.distract.kind }, ctl: kids.map(k => k.ctl), squirrel: !!squirrel, powerups: powerups.length, ring: !!ring }; },
  pos() { return { kids: kids.map(k => ({ x: k.x, y: k.y, has: ball.state === 'held' && ball.holder === k.i })), dog: { x: dog.x, y: dog.y }, ball: { x: ball.x, y: ball.y, z: ball.z, state: ball.state } }; },
  begin(m) { newMatch(m || 'kids'); }, skipReady() { if (state === 'ready') stateT = 4.4; },
  sim(sec) { for (let i = 0; i < sec * 60; i++) { update(1 / 60); if (state === 'end') break; } return { kidsScore, dogScore, catches, steals, tricks, bestStreak, rounds: roundScores.map(r => [r.k, r.d]) }; },
  setTimer(t) { timer = t; }, autoplay(on) { autoAll = !!on; }, squirrelNow() { squirrelT = 0; }, powerNow(kind) { const s = freeSpot(100); powerups.push({ x: s.x, y: s.y, kind: kind || 'star', life: TUNE.powerLife, born: time }); return s; }, hyper(v) { dog.hyper = v; },
  poster() { // card art: the yard, the three of them close together, ball in the air (used to make art/card-keep.jpg)
    running = false; cancelAnimationFrame(raf); ctx.drawImage(yardFor(0), 0, 0, W, H);
    const put = (k, x, y, h, flip) => { const img = IMG[k]; if (!img.naturalWidth) return; shadow(x, y, h * img.naturalWidth / img.naturalHeight * .32, .3); sprite(k, x, y, h, flip); };
    put('nicHop', 372, 470, 230, false); put('giulia', 598, 486, 230, true); put('bernard', 488, 516, 200, true);
    if (ready('tennis')) ctx.drawImage(IMG.tennis, 470, 168, 46, 46);
  }
};
})();
