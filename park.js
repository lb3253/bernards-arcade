/* =====================================================================
   BERNARD IN THE PARK
   ---------------------------------------------------------------------
   Bernard has the park to himself until Tita calls him home. His friends
   (Nick, Giulia, Tita and Mama Duck) each want something built. The JOBS
   list says what each one needs: collect the pieces into his bag, take
   them to that friend, and the thing gets put together. Every job built
   scores big and adds time.

   Things for the bag: ballies, sticks, flowers, apples (bark at an apple
   tree), feathers (round the pond), shells (in the sand), acorns (under
   trees, and from squirrels). Also worth points: bones, butterflies and
   Nick's throws (jump!), squirrels (sprint!), hopping over low things.

   Sprinting makes him thirsty. Water is at the pond, the fountain and
   the two dog bowls.

   Pad: d-pad / stick move · B jump · Y or X (hold) sprint · A bark
   Keys: arrows or WASD · Space jump · Shift sprint · E bark · P pause
   Touch: drag on the left · JUMP and RUN buttons on the right
   ===================================================================== */
(() => {
'use strict';
const W = 960, H = 540, TAU = Math.PI * 2;
const RS = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function seeded(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const TUNE = {
  time: 150, jobTime: 20,         // seconds in the park, and seconds added for every job built
  walk: 190, sprint: 335, accel: 1500, wade: .55,
  jumpV: 335, gravity: 1100,
  thirst: .009, sprintThirst: .15, drink: .55,   // water bar: drain walking, drain sprinting, refill while drinking
  squirrelSpeed: 235, squirrelSee: 175,
  pts: { ball: 10, stick: 10, flower: 10, apple: 10, feather: 15, shell: 15, acorn: 15, bone: 40, fly: 20, air: 30, squirrel: 50, hop: 5, water: 15 }
};

/* ---------------- canvas: a small pixel page blown up with hard edges (same as Keep-Away) ---------------- */
const canvas = document.getElementById('bp-canvas');
if (!canvas) return;
const PW = 900, PH = 422, SX = PW / W, SY = PH / H, PXS = RS >= 1.5 ? 3 : 2;
canvas.width = PW * PXS; canvas.height = PH * PXS;
const out = canvas.getContext('2d');
const page = document.createElement('canvas'); page.width = PW; page.height = PH;
const ctx = page.getContext('2d');
ctx.setTransform(SX, 0, 0, SY, 0, 0);
function present() { out.imageSmoothingEnabled = false; out.drawImage(page, 0, 0, canvas.width, canvas.height); }
const snapX = x => Math.round(x * SX) / SX, snapY = y => Math.round(y * SY) / SY;
function fitStage() {
  const stage = document.getElementById('bp-stage'); if (!stage) return;
  const vw = document.documentElement.clientWidth || innerWidth, vh = document.documentElement.clientHeight || innerHeight;
  let w = Math.max(280, vw - 8), h = w * 9 / 16; if (h > vh - 8) { h = Math.max(160, vh - 8); w = h * 16 / 9; }
  stage.style.width = Math.floor(w) + 'px'; stage.style.height = Math.floor(h) + 'px';
}
// smooth picture -> pixel art: hard edges, fewer colours with a checker dither, and a dark outline for things that stand up
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function crunch(c, step, outline) {
  const g = c.getContext('2d'), w = c.width, h = c.height; let im; try { im = g.getImageData(0, 0, w, h); } catch (e) { return c; }
  const d = im.data, solid = new Uint8Array(w * h);
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
    if (d[i + 3] < 120) { d[i + 3] = 0; continue; } d[i + 3] = 255; solid[y * w + x] = 1;
    const t = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - .47) * step * .8;
    for (let k = 0; k < 3; k++) d[i + k] = clamp(Math.round((d[i + k] + t) / step) * step, 0, 255);
  }
  if (outline) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const j = y * w + x; if (solid[j]) continue;
    if ((x > 0 && solid[j - 1]) || (x < w - 1 && solid[j + 1]) || (y > 0 && solid[j - w]) || (y < h - 1 && solid[j + w])) { d[j * 4] = 38; d[j * 4 + 1] = 22; d[j * 4 + 2] = 14; d[j * 4 + 3] = 255; } }
  g.putImageData(im, 0, 0); return c;
}

/* ---------------- art helpers ---------------- */
const INK = '#2B1A10';
const IMG = {};
for (const [k, src] of [['bernard', '/art/spr-ka-bernard.png?v=2'], ['nic', '/art/spr-hop-nic.png'], ['nicHop', '/art/spr-hop-nic-hop.png'], ['giulia', '/art/spr-hop-giulia.png'], ['giuliaHop', '/art/spr-hop-giulia-hop.png'], ['tita', '/art/tita-portrait.jpg']]) { const i = new Image(); i.src = src; IMG[k] = i; }
const ready = k => IMG[k] && IMG[k].complete && IMG[k].naturalWidth > 0;
function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function ell(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, TAU); }
function fs(g, f, s, lw) { if (f) { g.fillStyle = f; g.fill(); } if (s) { g.strokeStyle = s; g.lineWidth = lw || 2; g.stroke(); } }
function font(sz, w) { return (w || 700) + ' ' + sz + 'px Fredoka, "Segoe UI", system-ui, sans-serif'; }
function text(g, s, x, y, sz, fill, stroke, align, lw) {
  g.font = font(sz); g.textAlign = align || 'center'; g.textBaseline = 'middle';
  if (stroke) { g.lineJoin = 'round'; g.lineWidth = lw || 4; g.strokeStyle = stroke; g.strokeText(s, x, y); }
  g.fillStyle = fill; g.fillText(s, x, y);
}
function panel(x, y, w, h, col) { rr(ctx, x, y, w, h, 12); fs(ctx, 'rgba(10,14,26,.8)', col || 'rgba(255,255,255,.18)', col ? 2.5 : 1.5); }
function shadow(x, y, rx, a) { ell(ctx, x, y, rx, rx * .32); fs(ctx, 'rgba(20,40,10,' + (a == null ? .28 : a) + ')'); }
// a little picture drawn once and turned into pixel art; (w, h) in game units, drawn with its top-left at 0,0
function bake(w, h, draw, step) {
  const c = document.createElement('canvas'); c.width = Math.ceil(w * SX) + 2; c.height = Math.ceil(h * SY) + 2;
  const g = c.getContext('2d'); g.translate(1, 1); g.scale(SX, SY); draw(g); g.setTransform(1, 0, 0, 1, 0, 0); crunch(c, step || 24, true);
  return { c, w: c.width / SX, h: c.height / SY };
}
function put(b, x, y, ax, ay, flip) { // (x, y) is where the picture's anchor goes: ax, ay are 0..1 across and down the picture
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(snapX(x), snapY(y)); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(b.c, -b.w * (ax == null ? .5 : ax), -b.h * (ay == null ? 1 : ay), b.w, b.h); ctx.restore();
}
// kids: pixel copies of the smooth sprites, made once for each size
const pixCache = {};
function sprite(key, x, y, h, flip) {
  if (!ready(key)) return false; const id = key + '|' + Math.round(h * 4); let c = pixCache[id];
  if (!c) { const img = IMG[key], bw = Math.max(2, Math.round(h * img.naturalWidth / img.naturalHeight * SX)), bh = Math.max(2, Math.round(h * SY)); c = document.createElement('canvas'); c.width = bw + 2; c.height = bh + 2; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 1, 1, bw, bh); pixCache[id] = crunch(c, 24, true); }
  const w = c.width / SX, gh = c.height / SY; ctx.save(); ctx.translate(snapX(x), snapY(y)); if (flip) ctx.scale(-1, 1); ctx.imageSmoothingEnabled = false; ctx.drawImage(c, -w / 2, -gh + 1 / SY, w, gh); ctx.restore(); return true;
}
// Bernard's sheet: 5 across. 0-3 standing (breathing, tail wag) · 4-11 walk · 12-19 run · 20-21 nose down (sniff, drink, pick up)
// 22 jump: push off · 23 jump: tucked · 24 jump: reaching down · 25 bark. He faces left in the art.
const BSHEET = { fw: 690, fh: 504, cols: 5, feet: 80 / 84, tall: 468 }, BU = 468 / 5 / SX;
function bern(frame, x, y, h, flip, rot, alpha, kx, ky) { // kx, ky: squash and stretch
  if (!ready('bernard')) return false; const B = BSHEET, k = h / B.tall, w = B.fw * k, fh = B.fh * k;
  ctx.save(); ctx.translate(snapX(x), snapY(y)); if (flip) ctx.scale(-1, 1); if (rot) ctx.rotate(rot); if (alpha != null) ctx.globalAlpha = alpha; if (kx || ky) ctx.scale(kx || 1, ky || 1); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(IMG.bernard, (frame % B.cols) * B.fw, Math.floor(frame / B.cols) * B.fh, B.fw, B.fh, -w / 2, -fh * B.feet, w, fh); ctx.restore(); return true;
}
const bernWalk = t => 4 + (Math.floor(t * 8) % 8 + 8) % 8, bernRun = t => 12 + (Math.floor(t * 8) % 8 + 8) % 8, bernStand = () => Math.floor(time * 7) % 4;

/* ---------------- the park ---------------- */
const WW = 2880, WH = 1620, EDGE = 64;
const RING = { x: 1440, y: 810, rx: 1050, ry: 560 };
const POND = { x: 1980, y: 560, rx: 270, ry: 140 };
const PLAZA = { x: 1440, y: 810, r: 150 };
const SAND = { x: 2010, y: 1085, rx: 215, ry: 118 };
const PICNIC = { x: 850, y: 1090 };
const START = { x: 1440, y: 1290 };
// the friends who ask Bernard for things, and what each one wants built (two jobs each, taken in turn)
const GIVERS = [
  { id: 'nic', name: 'Nick', x: 800, y: 1048, face: 1, top: 150, jobs: [
    { name: 'STICK FORT', art: 'fort', need: { stick: 4 }, pts: 120, ask: "Let's build a stick fort!", spot: { x: 676, y: 1016 } },
    { name: 'BALLIE PYRAMID', art: 'pyramid', need: { ball: 5 }, pts: 120, ask: 'Ballies for a pyramid!', spot: { x: 742, y: 1150 } }] },
  { id: 'giulia', name: 'Giulia', x: 1795, y: 1178, face: -1, top: 150, jobs: [
    { name: 'FLOWER CROWN', art: 'crown', need: { flower: 3 }, pts: 100, ask: 'I want a flower crown!', wear: true },
    { name: 'SANDCASTLE', art: 'castle', need: { shell: 3, stick: 1 }, pts: 150, ask: "Let's make a sandcastle!", spot: { x: 1975, y: 1168 } }] },
  { id: 'tita', name: 'Tita', x: 1130, y: 796, face: 1, top: 118, jobs: [
    { name: 'FRUIT BOWL', art: 'bowlfruit', need: { apple: 3 }, pts: 120, ask: 'Apples for a fruit bowl!', spot: { x: 1048, y: 800 } },
    { name: 'BIRD FEEDER', art: 'feeder', need: { acorn: 2, stick: 2 }, pts: 160, ask: "Let's make a bird feeder!", spot: { x: 1222, y: 802 } }] },
  { id: 'duck', name: 'Mama Duck', x: 1742, y: 684, face: -1, top: 78, jobs: [
    { name: 'COZY NEST', art: 'nest', need: { stick: 2, feather: 3 }, pts: 150, ask: 'Quack! A nest, please!', spot: { x: 1672, y: 716 } },
    { name: 'FLOWER RAFT', art: 'raft', need: { flower: 2, feather: 1 }, pts: 120, ask: 'Quack! A flower raft!', spot: { x: 1850, y: 630 } }] }
];
for (const g of GIVERS) Object.assign(g, { idx: 0, state: 'want', t: 0, built: {}, cheer: 0, parts: [], say: { s: '', t: 0 } });
const SPOTS = []; for (const g of GIVERS) { SPOTS.push(g); for (const j of g.jobs) if (j.spot) SPOTS.push(j.spot); }
const inPond = (x, y, pad) => { const dx = (x - POND.x) / (POND.rx + (pad || 0)), dy = (y - POND.y) / (POND.ry + (pad || 0)); return dx * dx + dy * dy < 1; };
const ringOff = (x, y) => Math.abs(Math.hypot((x - RING.x) / RING.rx, (y - RING.y) / RING.ry) - 1) * 560;   // rough distance from the loop path
const onPath = (x, y, pad) => ringOff(x, y) < 30 + pad || (Math.abs(y - 810) < 30 + pad && x > 390 && x < 2490) || (Math.abs(x - 1440) < 30 + pad && y > 250);
const inSand = (x, y, pad) => { const dx = (x - SAND.x) / (SAND.rx + pad), dy = (y - SAND.y) / (SAND.ry + pad); return dx * dx + dy * dy < 1; };
function openGround(x, y, pad) { // somewhere a tree or a bush may stand
  return x > EDGE + 40 && x < WW - EDGE - 40 && y > EDGE + 90 && y < WH - EDGE - 20 && !onPath(x, y, pad) && !inPond(x, y, pad + 40) && !inSand(x, y, pad + 20)
    && Math.hypot(x - PLAZA.x, y - PLAZA.y) > PLAZA.r + pad + 20 && Math.hypot(x - PICNIC.x, y - PICNIC.y) > 190 + pad && Math.hypot(x - START.x, y - START.y) > 120
    && SPOTS.every(s => Math.hypot(x - s.x, y - s.y) > 120 + pad);
}
// things that stand in the park: {kind, x, y, r (how wide it blocks), hop (how high Bernard must be to clear it; 0 = can't)}
const props = [], trees = [];
(function plant() {
  const R = seeded(20240611); let tries = 0;
  const far = (x, y, d) => props.every(p => Math.hypot(p.x - x, p.y - y) > d);
  while (trees.length < 30 && tries++ < 5000) { const x = 110 + R() * (WW - 220), y = 170 + R() * (WH - 250); if (!openGround(x, y, 46) || !far(x, y, 170)) continue; const t = { kind: 'tree', v: trees.length % 4 === 1 ? 1 : R() < .3 ? 2 : 0, x, y, r: 17, hop: 0 }; props.push(t); trees.push(t); }
  let n = 0; tries = 0; while (n < 14 && tries++ < 3000) { const x = 110 + R() * (WW - 220), y = 170 + R() * (WH - 250); if (!openGround(x, y, 30) || !far(x, y, 120)) continue; props.push({ kind: 'bush', v: R() < .4 ? 1 : 0, x, y, r: 24, hop: 26 }); n++; }
  n = 0; tries = 0; while (n < 7 && tries++ < 3000) { const x = 140 + R() * (WW - 280), y = 200 + R() * (WH - 300); if (!openGround(x, y, 30) || !far(x, y, 150)) continue; props.push({ kind: 'log', x, y, r: 30, hop: 14 }); n++; }
  for (const [x, y] of [[1130, 772], [1750, 772], [760, 772], [2190, 772], [1392, 1060], [1392, 520]]) props.push({ kind: 'bench', x, y, r: 34, hop: 28 });
  props.push({ kind: 'fountain', x: PLAZA.x, y: PLAZA.y + 18, r: 62, hop: 0, water: true });
  props.push({ kind: 'bowl', x: 962, y: 1150, r: 0, hop: 0, water: true }, { kind: 'bowl', x: 1690, y: 1092, r: 0, hop: 0, water: true });
  props.push({ kind: 'slide', x: SAND.x + 70, y: SAND.y - 6, r: 30, hop: 0 }, { kind: 'swing', x: SAND.x - 90, y: SAND.y + 6, r: 0, hop: 0 });
  props.push({ kind: 'basket', x: PICNIC.x + 30, y: PICNIC.y + 44, r: 14, hop: 20 });
  for (const g of GIVERS) if (g.id !== 'tita') props.push({ kind: g.id === 'duck' ? 'mama' : 'kid', g, x: g.x, y: g.y, r: 15, hop: 0 });
  props.push({ kind: 'tita', g: GIVERS[2], x: 1130, y: 772.5, r: 0, hop: 0 });
})();
const waters = props.filter(p => p.water);

// the ground, drawn once
let ground = null;
function bakeGround() {
  const c = document.createElement('canvas'); c.width = Math.round(WW * SX); c.height = Math.round(WH * SY); const g = c.getContext('2d'); g.scale(SX, SY);
  const R = seeded(77);
  g.fillStyle = '#5DB548'; g.fillRect(0, 0, WW, WH);
  for (let y = 0; y < WH; y += 90) for (let x = 0; x < WW; x += 90) if (((x / 90) + (y / 90)) % 2 < 1) { g.fillStyle = 'rgba(255,255,160,.07)'; g.fillRect(x, y, 90, 90); }   // mowing squares
  for (let i = 0; i < 150; i++) { ell(g, R() * WW, R() * WH, 30 + R() * 70, 14 + R() * 26); fs(g, R() < .5 ? 'rgba(40,110,40,.16)' : 'rgba(190,230,110,.14)'); }
  // paths
  g.lineCap = 'round'; g.lineJoin = 'round';
  const paths = () => { g.beginPath(); g.ellipse(RING.x, RING.y, RING.rx, RING.ry, 0, 0, TAU); g.moveTo(390, 810); g.lineTo(2490, 810); g.moveTo(1440, 250); g.lineTo(1440, WH); };
  paths(); g.strokeStyle = '#B99A62'; g.lineWidth = 66; g.stroke(); paths(); g.strokeStyle = '#E2C98C'; g.lineWidth = 56; g.stroke();
  for (let i = 0; i < 900; i++) { const x = R() * WW, y = R() * WH; if (!onPath(x, y, -8)) continue; g.fillStyle = R() < .5 ? 'rgba(150,120,70,.5)' : 'rgba(255,245,210,.6)'; g.fillRect(x, y, 3, 2.5); }
  // plaza
  ell(g, PLAZA.x, PLAZA.y, PLAZA.r + 8, (PLAZA.r + 8) * .62); fs(g, '#9A9086'); ell(g, PLAZA.x, PLAZA.y, PLAZA.r, PLAZA.r * .62); fs(g, '#CFC6B8');
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.beginPath(); g.moveTo(PLAZA.x + Math.cos(a) * 70, PLAZA.y + Math.sin(a) * 43); g.lineTo(PLAZA.x + Math.cos(a) * PLAZA.r, PLAZA.y + Math.sin(a) * PLAZA.r * .62); g.strokeStyle = 'rgba(120,110,100,.5)'; g.lineWidth = 2; g.stroke(); }
  // pond: sandy shore, water, lily pads, reeds
  ell(g, POND.x, POND.y, POND.rx + 22, POND.ry + 16); fs(g, '#D9C58E'); ell(g, POND.x, POND.y, POND.rx + 6, POND.ry + 5); fs(g, '#3F8FB8');
  ell(g, POND.x, POND.y, POND.rx, POND.ry); fs(g, '#4FA8D8'); ell(g, POND.x - 30, POND.y - 20, POND.rx * .7, POND.ry * .62); fs(g, '#63BCE8');
  for (let i = 0; i < 26; i++) { const a = R() * TAU, k = R() * .85, x = POND.x + Math.cos(a) * POND.rx * k, y = POND.y + Math.sin(a) * POND.ry * k; g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x, y, 14 + R() * 16, 2.5); }
  for (const [dx, dy] of [[-150, 60], [-120, 78], [170, -70], [200, -50], [60, 96]]) { ell(g, POND.x + dx, POND.y + dy, 15, 9); fs(g, '#3E9A46', '#2A6A30', 1.5); ell(g, POND.x + dx + 4, POND.y + dy - 2, 4, 3); fs(g, '#FF9AC8'); }
  for (let i = 0; i < 22; i++) { const a = -2.6 + R() * 1.6, x = POND.x + Math.cos(a) * (POND.rx + 8), y = POND.y + Math.sin(a) * (POND.ry + 6); g.strokeStyle = '#3C7A34'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + R() * 6 - 3, y - 18 - R() * 14); g.stroke(); }
  // playground sand
  ell(g, SAND.x, SAND.y, SAND.rx + 8, SAND.ry + 6); fs(g, '#B58A4A'); ell(g, SAND.x, SAND.y, SAND.rx, SAND.ry); fs(g, '#EBD79A');
  for (let i = 0; i < 120; i++) { const a = R() * TAU, k = Math.sqrt(R()) * .95; g.fillStyle = R() < .5 ? 'rgba(170,130,70,.5)' : 'rgba(255,250,220,.7)'; g.fillRect(SAND.x + Math.cos(a) * SAND.rx * k, SAND.y + Math.sin(a) * SAND.ry * k, 3, 2.5); }
  // picnic blanket
  g.save(); g.translate(PICNIC.x, PICNIC.y); g.transform(1, 0, -.35, .62, 0, 0);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#E2493F' : '#FFF4E4'; g.fillRect(-88 + x * 22, -88 + y * 22, 22, 22); }
  g.strokeStyle = '#8A2A24'; g.lineWidth = 4; g.strokeRect(-88, -88, 176, 176); g.restore();
  // grass tufts and little flowers, off the paths
  for (let i = 0; i < 1500; i++) { const x = R() * WW, y = R() * WH; if (onPath(x, y, 6) || inPond(x, y, 24) || inSand(x, y, 8) || Math.hypot(x - PLAZA.x, y - PLAZA.y) < PLAZA.r + 10) continue;
    if (R() < .72) { g.strokeStyle = R() < .5 ? '#3F8E38' : '#86D060'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y - 6); g.moveTo(x + 3, y); g.lineTo(x + 4, y - 7); g.stroke(); }
    else { const col = ['#FFFFFF', '#FFE066', '#FF9AC8', '#C9A0FF'][Math.floor(R() * 4)]; for (let k = 0; k < 4; k++) { ell(g, x + Math.cos(k * 1.57) * 3, y + Math.sin(k * 1.57) * 2.4, 2.4, 2); fs(g, col); } ell(g, x, y, 1.6, 1.4); fs(g, '#F2A020'); } }
  // soft shadows under things that stand up
  for (const p of props) { const rx = p.kind === 'tree' ? 62 : p.kind === 'fountain' ? 96 : p.kind === 'bowl' ? 18 : p.kind === 'kid' ? 0 : p.kind === 'swing' ? 70 : 40; if (rx) { ell(g, p.x + (p.kind === 'tree' ? 14 : 0), p.y + 2, rx, rx * (p.kind === 'tree' ? .34 : .3)); fs(g, 'rgba(20,50,20,.26)'); } }
  // hedge all the way round
  g.fillStyle = '#2F7A34'; g.fillRect(0, 0, WW, EDGE + 30); g.fillRect(0, WH - 26, WW, 26); g.fillRect(0, 0, EDGE - 14, WH); g.fillRect(WW - EDGE + 14, 0, EDGE - 14, WH);
  for (let x = 0; x < WW; x += 34) { ell(g, x + 17, EDGE + 26, 22, 15); fs(g, '#3C9440'); ell(g, x + 10, EDGE + 14, 12, 9); fs(g, '#55B050'); ell(g, x + 17, WH - 28, 22, 13); fs(g, '#3C9440'); }
  for (let y = 0; y < WH; y += 30) { ell(g, EDGE - 16, y + 15, 14, 20); fs(g, '#3C9440'); ell(g, WW - EDGE + 16, y + 15, 14, 20); fs(g, '#3C9440'); }
  g.fillStyle = '#E2C98C'; g.fillRect(1412, WH - 30, 56, 30);   // the gate
  g.setTransform(1, 0, 0, 1, 0, 0); return crunch(c, 20, false);
}
// stand-up pictures
const ART = {}, ICON = {};
function bakeArt() {
  const treeTop = (g, cx, cy, s, c1, c2, c3) => { for (const [dx, dy, r] of [[0, -8, 46], [-36, 14, 34], [36, 14, 34], [-16, -38, 32], [20, -40, 28]]) { ell(g, cx + dx * s, cy + dy * s, r * s, r * s * .9); fs(g, c1); }
    for (const [dx, dy, r] of [[-12, -22, 22], [22, -4, 17], [-32, 6, 14], [6, -48, 12]]) { ell(g, cx + dx * s, cy + dy * s, r * s, r * s * .8); fs(g, c2); } for (const [dx, dy] of [[-20, -30], [14, -14], [-4, 6], [30, 10], [-38, 16]]) { ell(g, cx + dx * s, cy + dy * s, 5 * s, 4 * s); fs(g, c3); } };
  ART.tree0 = bake(170, 200, g => { g.fillStyle = '#7A5230'; g.fillRect(74, 110, 22, 88); g.fillStyle = '#5E3E22'; g.fillRect(88, 110, 8, 88); treeTop(g, 85, 82, 1, '#3F8E3A', '#56AE4A', '#7CC860'); });
  ART.tree1 = bake(170, 200, g => { g.fillStyle = '#86603A'; g.fillRect(75, 120, 20, 78); g.fillStyle = '#684828'; g.fillRect(88, 120, 7, 78); treeTop(g, 85, 92, .9, '#4E9A3C', '#74BE50', '#B8E070'); for (const [x, y] of [[60, 80], [100, 60], [84, 110], [116, 100], [52, 108]]) { ell(g, x, y, 4.5, 4.5); fs(g, '#E8402F'); } });
  ART.tree2 = bake(130, 210, g => { g.fillStyle = '#6E4A2A'; g.fillRect(57, 150, 16, 58); for (let i = 0; i < 4; i++) { const y = 150 - i * 38, w = 60 - i * 10; g.beginPath(); g.moveTo(65 - w, y + 24); g.lineTo(65, y - 34); g.lineTo(65 + w, y + 24); g.closePath(); fs(g, i % 2 ? '#2F7A3C' : '#286A34'); g.beginPath(); g.moveTo(65 - w * .5, y + 8); g.lineTo(65, y - 30); g.lineTo(65 + w * .1, y + 8); g.closePath(); fs(g, '#3F9A4A'); } });
  ART.bush0 = bake(84, 56, g => { for (const [x, y, r] of [[22, 34, 20], [44, 26, 24], [64, 36, 18]]) { ell(g, x, y, r, r * .8); fs(g, '#3A8C3C'); } for (const [x, y, r] of [[38, 20, 12], [20, 30, 9], [60, 30, 8]]) { ell(g, x, y, r, r * .7); fs(g, '#5CB452'); } });
  ART.bush1 = bake(84, 56, g => { for (const [x, y, r] of [[22, 34, 20], [44, 26, 24], [64, 36, 18]]) { ell(g, x, y, r, r * .8); fs(g, '#3E9440'); } for (const [x, y] of [[30, 20], [48, 14], [62, 30], [18, 34], [42, 34]]) { ell(g, x, y, 5, 4.5); fs(g, '#FF8AC0'); ell(g, x, y, 2, 2); fs(g, '#FFE066'); } });
  ART.log = bake(96, 40, g => { rr(g, 6, 8, 84, 28, 13); fs(g, '#8A5E36'); rr(g, 6, 8, 84, 10, 6); fs(g, '#A87848'); ell(g, 12, 22, 9, 13); fs(g, '#D8B078'); ell(g, 12, 22, 5, 8); fs(g, null, '#A87848', 2); g.strokeStyle = '#6A4424'; g.lineWidth = 2; for (const x of [34, 52, 70]) { g.beginPath(); g.moveTo(x, 20); g.lineTo(x + 8, 22); g.stroke(); } });
  ART.bench = bake(104, 64, g => { g.fillStyle = '#3A3A44'; for (const x of [12, 86]) { g.fillRect(x, 26, 6, 36); } for (const y of [6, 18]) { rr(g, 4, y, 96, 9, 3); fs(g, '#B8783C'); } rr(g, 2, 34, 100, 12, 4); fs(g, '#C88848'); rr(g, 2, 42, 100, 5, 2); fs(g, '#96602C'); });
  ART.fountain = bake(190, 150, g => { ell(g, 95, 104, 90, 42); fs(g, '#8E867C'); ell(g, 95, 96, 90, 42); fs(g, '#BDB4A6'); ell(g, 95, 94, 76, 33); fs(g, '#4FA8D8'); ell(g, 86, 90, 50, 20); fs(g, '#7CCAF0'); g.fillStyle = '#A69C8E'; g.fillRect(84, 44, 22, 52); ell(g, 95, 46, 34, 13); fs(g, '#BDB4A6'); ell(g, 95, 43, 26, 9); fs(g, '#63BCE8'); g.fillStyle = '#A69C8E'; g.fillRect(90, 20, 10, 24); ell(g, 95, 20, 9, 5); fs(g, '#CFC6B8'); });
  ART.bowl = bake(40, 24, g => { ell(g, 20, 14, 18, 9); fs(g, '#C8342C'); ell(g, 20, 10, 16, 7); fs(g, '#E8544A'); ell(g, 20, 10, 12, 4.5); fs(g, '#63BCE8'); });
  ART.slide = bake(150, 130, g => { g.fillStyle = '#4A5568'; g.fillRect(96, 20, 6, 104); g.fillRect(128, 20, 6, 104); for (let y = 40; y < 120; y += 18) g.fillRect(98, y, 34, 4); g.beginPath(); g.moveTo(104, 26); g.quadraticCurveTo(60, 60, 12, 116); g.lineTo(34, 122); g.quadraticCurveTo(76, 76, 126, 44); g.closePath(); fs(g, '#F2B01E'); g.beginPath(); g.moveTo(104, 26); g.quadraticCurveTo(60, 60, 12, 116); g.strokeStyle = '#E8402F'; g.lineWidth = 6; g.stroke(); rr(g, 92, 14, 46, 12, 4); fs(g, '#E8402F'); });
  ART.swing = bake(170, 130, g => { g.strokeStyle = '#3A6ACF'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(10, 124); g.lineTo(26, 12); g.lineTo(144, 12); g.lineTo(160, 124); g.stroke(); g.strokeStyle = '#555'; g.lineWidth = 2; for (const x of [60, 110]) { g.beginPath(); g.moveTo(x - 10, 14); g.lineTo(x - 10, 88); g.moveTo(x + 10, 14); g.lineTo(x + 10, 88); g.stroke(); rr(g, x - 14, 86, 28, 7, 3); fs(g, x < 80 ? '#E8402F' : '#F2B01E'); } });
  ART.basket = bake(48, 44, g => { g.strokeStyle = '#8A5A2A'; g.lineWidth = 4; g.beginPath(); g.arc(24, 20, 15, Math.PI, 0); g.stroke(); rr(g, 5, 18, 38, 24, 5); fs(g, '#C8904C'); g.strokeStyle = '#8A5A2A'; g.lineWidth = 2; for (let x = 12; x < 42; x += 8) { g.beginPath(); g.moveTo(x, 20); g.lineTo(x, 40); g.stroke(); } rr(g, 5, 16, 38, 7, 3); fs(g, '#E8544A'); });
  ART.stick = bake(46, 18, g => { g.strokeStyle = '#7A4E28'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(5, 12); g.lineTo(40, 7); g.moveTo(26, 9); g.lineTo(33, 3); g.stroke(); g.strokeStyle = '#A87848'; g.lineWidth = 2; g.beginPath(); g.moveTo(8, 10.5); g.lineTo(36, 6.5); g.stroke(); });
  const sq = (g, hop) => { g.beginPath(); g.moveTo(12, 28); g.quadraticCurveTo(-4, 6, 12, 2); g.quadraticCurveTo(24, 10, 16, 26); g.closePath(); fs(g, '#B07A48'); g.beginPath(); g.moveTo(11, 22); g.quadraticCurveTo(4, 10, 12, 6); g.quadraticCurveTo(17, 12, 14, 22); g.closePath(); fs(g, '#D8A070');
    ell(g, 26, 25 - hop, 13, 8); fs(g, '#A8734A'); ell(g, 28, 28 - hop, 8, 4); fs(g, '#E8C8A0'); ell(g, 38, 18 - hop, 7, 6); fs(g, '#A8734A'); ell(g, 36, 11 - hop, 2.5, 4); fs(g, '#8A5A34'); ell(g, 40, 17 - hop, 1.5, 1.7); fs(g, '#111'); ell(g, 44.5, 19 - hop, 1.2, 1); fs(g, '#111');
    g.fillStyle = '#8A5A34'; if (hop) { g.fillRect(16, 30 - hop, 7, 3); g.fillRect(34, 30 - hop, 7, 3); } else { g.fillRect(20, 31, 5, 3); g.fillRect(31, 31, 5, 3); } };
  ART.sq0 = bake(50, 36, g => sq(g, 0)); ART.sq1 = bake(50, 36, g => sq(g, 5));
  ART.duck = bake(38, 30, g => { ell(g, 17, 20, 14, 8); fs(g, '#F4F0E6'); ell(g, 12, 18, 7, 4); fs(g, '#D8D2C2'); ell(g, 28, 11, 6.5, 6); fs(g, '#F4F0E6'); g.beginPath(); g.moveTo(33, 11); g.lineTo(37.5, 13); g.lineTo(33, 15); g.closePath(); fs(g, '#F2A020'); ell(g, 29.5, 10, 1.2, 1.3); fs(g, '#111'); });
  ART.tree1b = bake(170, 200, g => { g.fillStyle = '#86603A'; g.fillRect(75, 120, 20, 78); g.fillStyle = '#684828'; g.fillRect(88, 120, 7, 78); treeTop(g, 85, 92, .9, '#4E9A3C', '#74BE50', '#B8E070'); });
  // things he picks up (also the little pictures in his bag)
  ICON.ball = bake(24, 24, g => { ell(g, 12, 12, 9.5, 9.5); fs(g, '#C8E83A'); ell(g, 9, 9, 4, 3.5); fs(g, '#E6F880'); g.strokeStyle = '#FFFFFF'; g.lineWidth = 2; g.beginPath(); g.arc(20, 12, 9, 2.2, 4.1); g.stroke(); });
  ICON.stick = bake(34, 16, g => { g.strokeStyle = '#7A4E28'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(4, 11); g.lineTo(30, 6); g.moveTo(19, 8); g.lineTo(25, 3); g.stroke(); g.strokeStyle = '#A87848'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(6, 9.6); g.lineTo(27, 5.6); g.stroke(); });
  ICON.flower = bake(26, 30, g => { g.strokeStyle = '#3C8A34'; g.lineWidth = 3; g.beginPath(); g.moveTo(13, 28); g.lineTo(13, 14); g.stroke(); ell(g, 18, 23, 4.5, 2.5); fs(g, '#4CA844'); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU - 1.57; ell(g, 13 + Math.cos(a) * 6, 11 + Math.sin(a) * 6, 5, 5); fs(g, '#FF7AB8'); } ell(g, 13, 11, 4, 4); fs(g, '#FFD23F'); });
  ICON.apple = bake(24, 26, g => { ell(g, 12, 15, 9.5, 9); fs(g, '#E2382C'); ell(g, 8.5, 12, 3.5, 3); fs(g, '#FF7A6A'); g.strokeStyle = '#6A4424'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(12, 8); g.lineTo(13, 3); g.stroke(); ell(g, 17, 5, 4.5, 2.5); fs(g, '#4CA844'); });
  ICON.feather = bake(30, 20, g => { g.beginPath(); g.moveTo(3, 16); g.quadraticCurveTo(10, 0, 27, 3); g.quadraticCurveTo(22, 16, 3, 16); g.closePath(); fs(g, '#F4F8FF'); g.beginPath(); g.moveTo(12, 13); g.quadraticCurveTo(20, 12, 26, 4); g.quadraticCurveTo(20, 15, 8, 15.5); g.closePath(); fs(g, '#B8D8F4'); g.strokeStyle = '#8AA8C8'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(2, 18); g.lineTo(24, 5); g.stroke(); });
  ICON.shell = bake(26, 22, g => { g.beginPath(); g.moveTo(13, 20); g.lineTo(2, 10); g.quadraticCurveTo(13, -6, 24, 10); g.closePath(); fs(g, '#FFC8A8'); g.strokeStyle = '#E88A6A'; g.lineWidth = 1.6; for (const x of [5, 9, 13, 17, 21]) { g.beginPath(); g.moveTo(13, 19); g.lineTo(x, 5 + Math.abs(x - 13) * .45); g.stroke(); } ell(g, 13, 19, 4, 2.5); fs(g, '#FFE0CC'); });
  ICON.acorn = bake(20, 24, g => { ell(g, 10, 14, 7, 8.5); fs(g, '#C88A48'); ell(g, 8, 13, 2.5, 4); fs(g, '#E8B070'); g.beginPath(); g.ellipse(10, 9, 8.5, 5.5, 0, Math.PI, 0); g.closePath(); fs(g, '#7A4E28'); g.fillStyle = '#7A4E28'; g.fillRect(9, 1, 2.5, 4); });
  ICON.bone = bake(34, 20, g => { rr(g, 8, 7, 18, 6, 3); fs(g, '#F4E9D8'); for (const [x, y] of [[7, 6], [7, 14], [27, 6], [27, 14]]) { ell(g, x, y, 4.5, 4.5); fs(g, '#F4E9D8'); } });
  // things that get built
  ART.fort = bake(110, 108, g => { g.beginPath(); g.moveTo(55, 16); g.lineTo(96, 102); g.lineTo(14, 102); g.closePath(); fs(g, '#5E3E22'); g.lineCap = 'round'; for (const [x, c] of [[10, '#8A5E36'], [28, '#A87848'], [46, '#8A5E36'], [70, '#A87848'], [86, '#8A5E36'], [100, '#A87848']]) { g.strokeStyle = c; g.lineWidth = 7; g.beginPath(); g.moveTo(x, 104); g.lineTo(55 + (55 - x) * .12, 12); g.stroke(); }
    g.beginPath(); g.moveTo(55, 54); g.lineTo(72, 102); g.lineTo(40, 102); g.closePath(); fs(g, '#2E1C10'); g.strokeStyle = '#6A4424'; g.lineWidth = 3; g.beginPath(); g.moveTo(55, 14); g.lineTo(55, 2); g.stroke(); g.beginPath(); g.moveTo(56, 2); g.lineTo(74, 6); g.lineTo(56, 11); g.closePath(); fs(g, '#E8402F'); });
  ART.pyramid = bake(70, 58, g => { for (const [x, y] of [[13, 44], [35, 44], [57, 44], [24, 26], [46, 26], [35, 9]]) { ell(g, x, y, 11, 11); fs(g, '#C8E83A'); ell(g, x - 3, y - 3, 4.5, 4); fs(g, '#E6F880'); g.strokeStyle = '#FFFFFF'; g.lineWidth = 2; g.beginPath(); g.arc(x + 9, y, 10, 2.2, 4.1); g.stroke(); } });
  ART.castle = bake(100, 88, g => { g.fillStyle = '#D8BC72'; g.fillRect(18, 42, 64, 42); g.fillRect(6, 30, 24, 54); g.fillRect(70, 30, 24, 54); g.fillRect(36, 20, 28, 30); g.fillStyle = '#EBD79A'; g.fillRect(6, 30, 8, 54); g.fillRect(70, 30, 8, 54); g.fillRect(36, 20, 9, 30); g.fillRect(18, 42, 18, 42);
    g.fillStyle = '#D8BC72'; for (const x of [6, 15, 24, 70, 79, 88]) g.fillRect(x, 24, 6, 8); for (const x of [36, 47, 58]) g.fillRect(x, 14, 6, 8); g.beginPath(); g.moveTo(42, 84); g.lineTo(42, 68); g.quadraticCurveTo(50, 58, 58, 68); g.lineTo(58, 84); g.closePath(); fs(g, '#8A6A34');
    g.strokeStyle = '#7A4E28'; g.lineWidth = 3; g.beginPath(); g.moveTo(50, 16); g.lineTo(50, 2); g.stroke(); g.beginPath(); g.moveTo(51, 2); g.lineTo(66, 6); g.lineTo(51, 10); g.closePath(); fs(g, '#3AB8FF'); for (const [x, y] of [[22, 54], [78, 50], [50, 36]]) { ell(g, x, y, 4, 3.5); fs(g, '#FFC8A8'); } });
  ART.bowlfruit = bake(60, 46, g => { for (const [x, y] of [[18, 20], [42, 20], [30, 14], [30, 24]]) { ell(g, x, y, 10, 9.5); fs(g, '#E2382C'); ell(g, x - 3, y - 3, 3.5, 3); fs(g, '#FF7A6A'); } ell(g, 34, 5, 5, 2.5); fs(g, '#4CA844'); g.beginPath(); g.moveTo(4, 22); g.quadraticCurveTo(30, 62, 56, 22); g.closePath(); fs(g, '#3A8ACF'); g.beginPath(); g.moveTo(8, 24); g.quadraticCurveTo(20, 46, 34, 44); g.quadraticCurveTo(14, 44, 4, 22); g.closePath(); fs(g, '#63B0E8'); });
  ART.feeder = bake(64, 116, g => { g.fillStyle = '#7A5230'; g.fillRect(29, 44, 7, 70); g.fillStyle = '#C8904C'; g.fillRect(12, 30, 40, 16); g.fillStyle = '#5E3E22'; g.fillRect(18, 34, 28, 9); g.fillStyle = '#F2D060'; for (const x of [21, 27, 33, 39]) g.fillRect(x, 39, 3, 3); g.beginPath(); g.moveTo(4, 32); g.lineTo(32, 8); g.lineTo(60, 32); g.closePath(); fs(g, '#E8402F'); g.fillStyle = '#A86A30'; g.fillRect(8, 46, 48, 5);
    ell(g, 48, 40, 7, 5.5); fs(g, '#3AB8FF'); ell(g, 54, 36, 4.5, 4.5); fs(g, '#3AB8FF'); g.beginPath(); g.moveTo(58, 36); g.lineTo(63, 37.5); g.lineTo(58, 39); g.closePath(); fs(g, '#F2A020'); ell(g, 55, 35, 1.1, 1.2); fs(g, '#111'); });
  ART.nest = bake(84, 52, g => { ell(g, 42, 34, 38, 15); fs(g, '#7A4E28'); ell(g, 42, 30, 38, 14); fs(g, '#A87848'); ell(g, 42, 30, 26, 8); fs(g, '#5E3E22'); g.strokeStyle = '#6A4424'; g.lineWidth = 2; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(8 + i * 8, 38); g.lineTo(14 + i * 8, 30); g.stroke(); }
    for (const x of [28, 42, 56]) { ell(g, x, 24, 8, 7); fs(g, '#FFE066'); ell(g, x + 1, 16, 5.5, 5.5); fs(g, '#FFE066'); ell(g, x + 3, 15, 1.1, 1.2); fs(g, '#111'); g.beginPath(); g.moveTo(x + 6, 16); g.lineTo(x + 10, 17.5); g.lineTo(x + 6, 19); g.closePath(); fs(g, '#F2A020'); } });
  ART.raft = bake(84, 50, g => { ell(g, 42, 34, 38, 13); fs(g, '#2F8A3C'); ell(g, 40, 32, 34, 10); fs(g, '#4CAE50'); for (const [x, c] of [[22, '#FF7AB8'], [42, '#FFFFFF'], [60, '#FF7AB8']]) { for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; ell(g, x + Math.cos(a) * 5, 28 + Math.sin(a) * 4, 4, 3.5); fs(g, c); } ell(g, x, 28, 3, 2.6); fs(g, '#FFD23F'); }
    g.beginPath(); g.moveTo(42, 22); g.quadraticCurveTo(46, 2, 62, 2); g.quadraticCurveTo(58, 16, 42, 22); g.closePath(); fs(g, '#F4F8FF'); });
  ART.crown = bake(38, 18, g => { for (const [x, y, c] of [[6, 12, '#FF7AB8'], [13, 8, '#FFFFFF'], [19, 6, '#FF7AB8'], [25, 8, '#FFFFFF'], [32, 12, '#FF7AB8']]) { ell(g, x, y, 5, 5); fs(g, c); ell(g, x, y, 2, 2); fs(g, '#FFD23F'); } });
  ART.mama = bake(60, 50, g => { ell(g, 26, 32, 22, 13); fs(g, '#F4F0E6'); ell(g, 18, 30, 11, 7); fs(g, '#D8D2C2'); ell(g, 44, 16, 10.5, 9.5); fs(g, '#F4F0E6'); g.beginPath(); g.moveTo(52, 16); g.lineTo(59, 19); g.lineTo(52, 22); g.closePath(); fs(g, '#F2A020'); ell(g, 47, 14, 1.8, 2); fs(g, '#111');
    g.fillStyle = '#F2A020'; g.fillRect(20, 44, 5, 5); g.fillRect(30, 44, 5, 5); g.beginPath(); g.moveTo(38, 6); g.lineTo(30, 1); g.lineTo(31, 11); g.closePath(); fs(g, '#FF7AB8'); g.beginPath(); g.moveTo(38, 6); g.lineTo(46, 1); g.lineTo(45, 10); g.closePath(); fs(g, '#FF7AB8'); });
}

/* ---------------- sound ---------------- */
let ac = null, soundOn = true;
function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (ac && ac.state === 'suspended') ac.resume(); return ac; }
function tone(f, d, type, vol, slide, when) { if (!soundOn || !audio()) return; try { const t = when || ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d); g.gain.setValueAtTime(vol || .05, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + .02); } catch (e) { } }
function noise(d, vol, f0, f1) { if (!soundOn || !audio()) return; try { const t = ac.currentTime, n = ac.createBufferSource(), b = ac.createBuffer(1, Math.max(1, ac.sampleRate * d | 0), ac.sampleRate), x = b.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / x.length, 2); n.buffer = b; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(f0 || 500, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + d); f.Q.value = 1.6; const g = ac.createGain(); g.gain.value = vol || .2; n.connect(f); f.connect(g); g.connect(ac.destination); n.start(t); } catch (e) { } }
const sfx = {
  pick: () => { tone(880, .07, 'square', .05); setTimeout(() => tone(1320, .1, 'square', .05), 60); },
  stick: () => { tone(330, .06, 'triangle', .07); setTimeout(() => tone(495, .1, 'triangle', .07), 60); },
  big: () => [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => tone(f, .12, 'square', .05), i * 60)),
  jump: () => tone(300, .16, 'triangle', .06, 620), land: () => noise(.08, .1, 300, 150),
  bark: () => { tone(190, .09, 'sawtooth', .09, 120); setTimeout(() => tone(170, .12, 'sawtooth', .09, 100), 110); },
  slurp: () => tone(500 + Math.random() * 200, .06, 'sine', .05, 900), splash: () => noise(.2, .1, 2400, 900),
  squirrel: () => { for (let i = 0; i < 4; i++) setTimeout(() => tone(1800 + Math.random() * 600, .04, 'square', .025), i * 70); },
  quack: () => { tone(420, .08, 'sawtooth', .04, 330); setTimeout(() => tone(400, .1, 'sawtooth', .04, 300), 110); },
  whistle: () => tone(1700, .3, 'sine', .05, 1500), rustle: () => noise(.3, .12, 3000, 1200),
  build: () => { for (let i = 0; i < 8; i++) setTimeout(() => tone(330 + i * 70, .08, 'triangle', .05), i * 150); }, menu: () => tone(660, .06, 'square', .04),
  tick: () => tone(880, .06, 'square', .035), go: () => tone(990, .3, 'square', .06),
  fanfare: () => [523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, i === 6 ? .5 : .14, 'square', .05), i * 120))
};
const SONG = { bpm: 104, bass: [48, 0, 52, 0, 55, 0, 52, 0, 53, 0, 57, 0, 55, 0, 50, 0], lead: [72, 0, 76, 0, 79, 76, 0, 72, 77, 0, 81, 0, 79, 77, 74, 0, 72, 0, 76, 79, 84, 0, 79, 0, 77, 76, 74, 0, 72, 0, 0, 0] };
const music = { on: false, timer: null, next: 0, step: 0 };
function musicStart() { musicStop(); if (!audio()) return; music.on = true; music.step = 0; music.next = ac.currentTime + .08; music.timer = setInterval(musicTick, 40); }
function musicStop() { music.on = false; if (music.timer) { clearInterval(music.timer); music.timer = null; } }
function musicTick() {
  if (!ac || !music.on) return; const d = 60 / SONG.bpm / 2, f = m => 440 * Math.pow(2, (m - 69) / 12);
  while (music.next < ac.currentTime + .15) { const s = music.step, b = SONG.bass[s % SONG.bass.length], l = SONG.lead[s % SONG.lead.length];
    if (b) tone(f(b), d * .9, 'triangle', .032, 0, music.next); if (l) tone(f(l), d * .8, 'square', .014, 0, music.next); if (s % 4 === 2) tone(6000, .02, 'square', .005, 0, music.next);
    music.next += d; music.step++; }
}

/* ---------------- input: pad + keyboard + touch ---------------- */
const keys = {}, latch = {};
const IN = { x: 0, y: 0, jump: false, run: false, bark: false, start: false, select: false, prev: {}, hit: {} };
const touch = { on: false, x: 0, y: 0, id: null, ox: 0, oy: 0, jump: false, runId: null };
const TB = { run: { x: 884, y: 468, r: 46 }, jump: { x: 790, y: 404, r: 46 } };   // on-screen buttons for phones
function readInput() {
  const K = {}; for (const c in keys) if (keys[c]) K[c] = true; for (const c in latch) if (latch[c]) K[c] = true;
  let x = 0, y = 0, jump = false, run = false, bark = false, start = false, select = false;
  let gp = null; try { gp = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(g => g && g.connected !== false && g.buttons && g.buttons.length).sort((a, b) => a.index - b.index)[0]; } catch (e) { }
  if (gp) {
    const B = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > .5)), ax = gp.axes || [];
    if (Math.hypot(ax[0] || 0, ax[1] || 0) > .25) { x += ax[0]; y += ax[1]; }   // a stick runs in any direction
    if (B(14)) x -= 1; if (B(15)) x += 1; if (B(12)) y -= 1; if (B(13)) y += 1;
    const h = ax[9]; if (typeof h === 'number' && h >= -1.01 && h <= 1.01 && Math.abs(h) > .05 && ax.length >= 10) { const q = Math.round((h + 1) / .2857); if (q === 7 || q === 0 || q === 1) y = -1; if (q >= 1 && q <= 3) x = 1; if (q >= 3 && q <= 5) y = 1; if (q >= 5 && q <= 7) x = -1; }
    jump = B(0); bark = B(1); run = B(2) || B(3) || B(4) || B(5); start = B(9); select = B(8);
  }
  if (K.ArrowLeft || K.KeyA) x -= 1; if (K.ArrowRight || K.KeyD) x += 1; if (K.ArrowUp || K.KeyW) y -= 1; if (K.ArrowDown || K.KeyS) y += 1;
  jump = jump || !!K.Space || !!K.Enter; run = run || !!K.ShiftLeft || !!K.ShiftRight; bark = bark || !!K.KeyE || !!K.KeyB;
  start = start || !!K.Escape || !!K.KeyP; select = select || !!K.Backspace;
  if (touch.on) { x += touch.x; y += touch.y; jump = jump || touch.jump; touch.jump = false; run = run || touch.runId !== null; }
  const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
  const n = { jump, bark, start, select, left: x < -.5, right: x > .5, up: y < -.5, down: y > .5 };
  for (const k in n) IN.hit[k] = n[k] && !IN.prev[k];
  IN.prev = n; IN.x = x; IN.y = y; IN.jump = jump; IN.run = run; IN.bark = bark;
  for (const c in latch) latch[c] = false;
}
const KEYNAME = { ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Enter: 'Enter', ' ': 'Space', Escape: 'Escape', Shift: 'ShiftLeft', w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', e: 'KeyE', b: 'KeyB', p: 'KeyP', m: 'KeyM' };
const codeOf = e => (e.code && e.code !== 'Unidentified') ? e.code : (KEYNAME[e.key] || KEYNAME[(e.key || '').toLowerCase()] || e.key);
const onKeyDown = ev => {
  const code = codeOf(ev);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(code)) ev.preventDefault();
  keys[code] = true; if (!ev.repeat) latch[code] = true; audio();
  if (code === 'KeyM' && !ev.repeat) { soundOn = !soundOn; if (!soundOn) musicStop(); else if (state === 'play') musicStart(); }
};
const onKeyUp = e => { keys[codeOf(e)] = false; };
const onBlur = () => { for (const k in keys) keys[k] = false; };
function bindTouch() {
  const at = t => { const r = canvas.getBoundingClientRect(); return { x: (t.clientX - r.left) / r.width * W, y: (t.clientY - r.top) / r.height * H }; };
  canvas.addEventListener('touchstart', e => { touch.on = true; audio(); for (const t of e.changedTouches) { const p = at(t);
    if (p.x < W / 2 && state === 'play') { if (touch.id === null) { touch.id = t.identifier; touch.ox = t.clientX; touch.oy = t.clientY; } }
    else if (state === 'play' && Math.hypot(p.x - TB.run.x, p.y - TB.run.y) < TB.run.r + 16) touch.runId = t.identifier; else touch.jump = true; } e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === touch.id) { touch.x = clamp((t.clientX - touch.ox) / 44, -1, 1); touch.y = clamp((t.clientY - touch.oy) / 44, -1, 1); } e.preventDefault(); }, { passive: false });
  const end = e => { for (const t of e.changedTouches) { if (t.identifier === touch.id) { touch.id = null; touch.x = touch.y = 0; } if (t.identifier === touch.runId) touch.runId = null; } };
  canvas.addEventListener('touchend', end); canvas.addEventListener('touchcancel', end);
}

/* ---------------- game state ---------------- */
let state = 'title', time = 0, stateT = 0, pauseIdx = 0, timer = 0, score = 0, best = 0, newBest = false, lastTick = 99, autoPlay = false;
let dog = null, cam = { x: 0, y: 0 }, items = [], squirrels = [], flies = [], ducks = [], toss = null, tossCool = 4, boneT = 12;
let particles = [], floats = [], banner = null, hintT = 0, tip = '', tipT = 0, jobsDone = 0;
let bag = {}, tally = {}, sc = { jobs: 0, picks: 0, tricks: 0 };
const KINDS = ['ball', 'stick', 'flower', 'apple', 'feather', 'shell', 'acorn'];   // what goes in his bag
const STOCK = { ball: 14, stick: 12, flower: 10, feather: 5, shell: 5, acorn: 6 };  // how many lie around the park
const TIPS = { apple: 'Bark next to an apple tree to shake the apples down', feather: 'Feathers lie around the pond', shell: 'Shells hide in the playground sand', acorn: 'Acorns lie under the trees, and squirrels drop them', flower: 'Big flowers grow in the grass' };
try { best = +localStorage.getItem('park_best') || 0; } catch (e) { }

function spotFor(kind, minDog) { // where a new thing of this kind may lie
  for (let n = 0; n < 90; n++) { let x, y;
    if (kind === 'feather') { const a = rnd(0, TAU), k = rnd(1.14, 1.36); x = POND.x + Math.cos(a) * POND.rx * k; y = POND.y + Math.sin(a) * POND.ry * k; }
    else if (kind === 'shell') { const a = rnd(0, TAU), k = Math.sqrt(rnd(.02, .72)); x = SAND.x + Math.cos(a) * SAND.rx * k; y = SAND.y + Math.sin(a) * SAND.ry * k; }
    else if (kind === 'acorn') { const t = pick(trees.filter(t => t.v !== 1)), a = rnd(0, TAU); x = t.x + Math.cos(a) * rnd(46, 100); y = t.y + Math.sin(a) * rnd(24, 60) + 12; }
    else { x = rnd(EDGE + 50, WW - EDGE - 50); y = rnd(EDGE + 110, WH - 70); if (inPond(x, y, 30) || Math.hypot(x - PLAZA.x, y - PLAZA.y - 18) < 110) continue; if (kind === 'flower' && (onPath(x, y, 10) || inSand(x, y, 10))) continue; }
    if (x < EDGE + 40 || x > WW - EDGE - 40 || y < EDGE + 100 || y > WH - 50 || inPond(x, y, 14)) continue;
    if (props.some(p => p.r && Math.hypot(p.x - x, p.y - y) < p.r + 32) || items.some(i => !i.dead && Math.hypot(i.x - x, i.y - y) < 50)) continue;
    if (dog && minDog && dist(dog, { x, y }) < minDog) continue; return { x, y }; }
  return { x: rnd(300, 2500), y: rnd(300, 1400) };
}
function addItem(kind, minDog, at) { const s = at || spotFor(kind, minDog == null ? 260 : minDog); const it = { kind, x: s.x, y: s.y, born: time, flip: Math.random() < .5, fall: at && at.fall || 0 }; items.push(it); return it; }
function newSquirrel(S) { const t = pick(trees), a = rnd(.3, 2.8); S = S || {}; S.x = clamp(t.x + Math.cos(a) * rnd(120, 240), EDGE + 40, WW - EDGE - 40); S.y = clamp(t.y + Math.abs(Math.sin(a)) * rnd(70, 160) + 14, EDGE + 120, WH - 60); S.st = 'idle'; S.t = rnd(1, 3); S.vx = S.vy = 0; S.face = 1; S.tree = null; S.hop = 0; return S; }
function newFly(F) { const s = spotFor('ball', 200); F = F || {}; F.x = F.hx = s.x; F.y = F.hy = s.y; F.ph = rnd(0, TAU); F.col = pick(['#FFD23F', '#FF8AC0', '#9EE8FF', '#FFFFFF', '#C9A0FF']); F.hide = 0; return F; }
const jobOf = g => g.jobs[g.idx % g.jobs.length];
const spotOf = (g, j) => j.wear ? g : j.spot;
function has(g) { const j = jobOf(g); for (const k in j.need) if ((bag[k] || 0) < j.need[k]) return false; return true; }
function newOrder(g, quiet) { g.state = 'want'; g.t = 0; const j = jobOf(g); g.say = { s: j.ask, t: quiet ? 0 : 3 }; const k = Object.keys(j.need).find(k => TIPS[k]); if (k && !quiet) { tip = TIPS[k]; tipT = 7; } }
function newGame() {
  dog = { x: START.x, y: START.y, z: 0, vx: 0, vy: 0, vz: 0, face: -1, fx: -1, sq: 0, anim: 0, water: 1, sprinting: false, drinking: false, barkT: 0, barkCool: 0, hopped: {}, pant: 0, gulp: 0, dipT: 0, idleT: 0, act: '', actT: 0, wetT: 0, wasWet: false, lean: 0, happy: 0 };
  score = 0; jobsDone = 0; sc = { jobs: 0, picks: 0, tricks: 0 }; timer = TUNE.time; newBest = false; lastTick = 99; items = []; particles = []; floats = []; banner = null; toss = null; tossCool = 3; boneT = 14; hintT = 10; tip = ''; tipT = 0;
  bag = {}; tally = {}; for (const k of KINDS) bag[k] = 0;
  for (const w of waters) w.fresh = 0; for (const t of trees) { t.ready = 0; t.shakeT = 0; }
  for (const g of GIVERS) { g.idx = 0; g.built = {}; g.cheer = 0; g.parts = []; newOrder(g, true); }
  for (const k in STOCK) for (let i = 0; i < STOCK[k]; i++) addItem(k, 120);
  squirrels = []; for (let i = 0; i < 5; i++) squirrels.push(newSquirrel());
  flies = []; for (let i = 0; i < 6; i++) flies.push(newFly());
  ducks = []; for (let i = 0; i < 3; i++) ducks.push({ x: POND.x + rnd(-150, 150), y: POND.y + rnd(-60, 60), vx: rnd(-10, 10), vy: 0, face: 1, t: rnd(0, 3) });
  cam.x = clamp(dog.x - W / 2, 0, WW - W); cam.y = clamp(dog.y - H * .56, 0, WH - H);
  state = 'play'; stateT = 0; setBanner('GO EXPLORE!', 'your friends need things built: check the JOBS list', '#C6FF3D', 2.6); sfx.go(); musicStart();
}
function fx(x, y, n, col, o) { o = o || {}; for (let i = 0; i < n; i++) { const a = rnd(0, TAU), s = rnd(o.s0 || 30, o.s1 || 150); particles.push({ x, y, z: o.z || 0, vx: Math.cos(a) * s, vy: Math.sin(a) * s * .6, vz: rnd(o.up || 60, (o.up || 60) * 2.6), life: rnd(.35, o.life || .8), col: Array.isArray(col) ? pick(col) : col, r: rnd(o.r0 || 2, o.r1 || 4.5) }); } }
function say(x, y, s, col, size) { floats.push({ x, y, text: s, col: col || '#FFFFFF', life: 1.3, max: 1.3, size: size || 20 }); }
function setBanner(s, sub, col, life) { banner = { text: s, sub: sub || '', col: col || '#FFE680', life: life || 1.6, max: life || 1.6 }; }
function gain(kind, x, y, label, cat) { const p = TUNE.pts[kind]; score += p; sc[cat || 'tricks'] += p; tally[kind] = (tally[kind] || 0) + 1; say(x, y - 70, (label ? label + ' ' : '') + '+' + p, p >= 30 ? '#FFD23F' : '#FFFFFF', label ? 19 : 20); }
const nearWater = () => { if (inPond(dog.x, dog.y, 26)) return POND; for (const w of waters) { const d = Math.hypot(dog.x - w.x, (dog.y - w.y) * 1.5); if (d < (w.kind === 'fountain' ? 104 : 40)) return w; } return null; };
function shakeTree(t) { // apples come down when Bernard barks at an apple tree or bumps it
  if (t.v !== 1 || t.ready > time) return; t.ready = time + 14; t.shakeT = .6; sfx.rustle(); fx(t.x, t.y - 110, 12, ['#74BE50', '#B8E070'], { up: 30, s1: 100 });
  for (let i = 0; i < 3; i++) addItem('apple', 0, { x: clamp(t.x + (i - 1) * 46 + rnd(-12, 12), EDGE + 40, WW - EDGE - 40), y: t.y + rnd(26, 58), fall: rnd(90, 130) });
}

/* ---------------- update ---------------- */
function autoInput() { // test hook: Bernard does the jobs by himself
  let t = null; IN.run = false;
  if (dog.water < .3) { let w = { x: POND.x - POND.rx, y: POND.y }; for (const q of waters) if (dist(dog, q) < dist(dog, w)) w = q; t = w; if (nearWater()) { IN.x = IN.y = 0; return; } }
  else { const g = GIVERS.find(g => g.state === 'want' && has(g)); if (g) t = g; else { const want = {}; for (const g of GIVERS) if (g.state === 'want') { const j = jobOf(g); for (const k in j.need) if ((bag[k] || 0) < j.need[k]) want[k] = 1; }
    let bd = 1e9; for (const i of items) { if (i.dead || !want[i.kind]) continue; const d = dist(dog, i); if (d < bd) { bd = d; t = i; } }
    if (want.apple && !items.some(i => i.kind === 'apple' && !i.dead)) { const tr = trees.filter(t => t.v === 1 && !(t.ready > time)).sort((a, b) => dist(dog, a) - dist(dog, b))[0]; if (tr) { t = { x: tr.x, y: tr.y + 56 }; if (dist(dog, t) < 80) IN.hit.bark = true; } }
    if (!t) for (const i of items) { if (i.dead) continue; const d = dist(dog, i); if (d < bd) { bd = d; t = i; } } } }
  if (!t) { IN.x = IN.y = 0; return; } const dx = t.x - dog.x, dy = t.y - dog.y, d = Math.hypot(dx, dy) || 1, w = Math.sin(time * 1.7) * .5; IN.x = dx / d - dy / d * w; IN.y = dy / d + dx / d * w; IN.run = d > 300 && dog.water > .5; IN.hit.jump = Math.random() < .012;
}
function updateDog(dt) {
  const D = dog; if (D.barkCool > 0) D.barkCool -= dt; if (D.barkT > 0) D.barkT -= dt; if (D.dipT > 0) D.dipT -= dt; if (D.happy > 0) D.happy -= dt;
  const want = Math.hypot(IN.x, IN.y), wading = inPond(D.x, D.y, -6) && D.z < 4;
  D.sprinting = IN.run && want > .2 && D.water > .02 && !wading;
  const sp = (D.sprinting ? TUNE.sprint : TUNE.walk) * (wading ? TUNE.wade : 1) * (D.water <= .02 ? .8 : 1);
  const tx = IN.x * sp, ty = IN.y * sp, a = TUNE.accel * dt * (D.z > 0 ? .35 : 1), v0 = Math.hypot(D.vx, D.vy);
  const dvx = tx - D.vx, dvy = ty - D.vy, dv = Math.hypot(dvx, dvy); if (dv <= a) { D.vx = tx; D.vy = ty; } else { D.vx += dvx / dv * a; D.vy += dvy / dv * a; }
  D.lean += (clamp((Math.hypot(D.vx, D.vy) - v0) / dt / 2600, -.16, .16) - D.lean) * Math.min(1, dt * 10);   // dips his nose speeding up, sits back slowing down
  if (IN.hit.jump && D.z <= 0) { D.vz = TUNE.jumpV; D.z = .01; D.hopped = {}; D.sq = .16; sfx.jump(); fx(D.x, D.y, 5, '#E8F6D0', { up: 20, s1: 70 }); }
  if (D.z > 0) { D.vz -= TUNE.gravity * dt; D.z += D.vz * dt; if (D.z <= 0) { D.z = 0; D.vz = 0; D.sq = -.2; sfx.land(); if (inPond(D.x, D.y, -6)) { sfx.splash(); fx(D.x, D.y, 14, ['#BDE8FF', '#FFFFFF'], { up: 80, s1: 120 }); } else fx(D.x, D.y, 6, '#E8F6D0', { up: 16, s1: 90 }); } }
  D.sq *= Math.pow(.0008, dt);
  if (IN.hit.bark && D.barkCool <= 0) { D.barkCool = 1.2; D.barkT = .36; sfx.bark(); for (const S of squirrels) if (S.st !== 'up' && dist(S, D) < 230) { S.st = 'stun'; S.t = .8; } for (const k of ducks) if (dist(k, D) < 260) { k.vx = (k.x - D.x) * .6; k.vy = (k.y - D.y) * .3; sfx.quack(); } for (const t of trees) if (dist(t, D) < 190) shakeTree(t); }
  D.x += D.vx * dt; D.y += D.vy * dt * .86;
  // bump into things (or sail over the low ones)
  for (let i = 0; i < props.length; i++) { const p = props[i]; if (!p.r) continue; const dx = D.x - p.x, dy = (D.y - p.y) * 1.5, d = Math.hypot(dx, dy), R = p.r + 16; if (d >= R) continue;
    if (p.hop && D.z > p.hop) { if (!D.hopped[i]) { D.hopped[i] = 1; gain('hop', p.x, p.y, 'HOP!'); sfx.pick(); } continue; }
    if (p.kind === 'tree' && Math.hypot(D.vx, D.vy) > 150) shakeTree(p);
    const k = (R - d) / (d || 1); D.x += dx * k; D.y += dy * k / 1.5; }
  D.x = clamp(D.x, EDGE + 22, WW - EDGE - 22); D.y = clamp(D.y, EDGE + 62, WH - 34);
  const v = Math.hypot(D.vx, D.vy);
  if (v > 30) { D.anim += dt * (v > 250 ? clamp(v / 85, 2.4, 4) : clamp(v / 62, 1.1, 2.6)); if (Math.abs(D.vx) > 20) D.face = D.vx > 0 ? 1 : -1; D.idleT = 0; D.act = '';
    if (D.z <= 0 && Math.random() < dt * (D.sprinting ? 22 : 5)) fx(D.x - D.face * 40, D.y, 1, wading ? '#BDE8FF' : 'rgba(230,246,200,.8)', { up: wading ? 50 : 16, s1: 40, r1: 3.5 }); }
  D.fx += (D.face - D.fx) * Math.min(1, dt * 16);   // turning round is a quick swivel, not a snap
  // out of the pond: shake the water off
  if (wading) D.wasWet = true; else if (D.wasWet && D.z <= 0) { D.wasWet = false; D.wetT = .7; sfx.splash(); }
  if (D.wetT > 0) { D.wetT -= dt; if (Math.random() < dt * 40) fx(D.x + rnd(-40, 40), D.y, 1, '#BDE8FF', { z: rnd(30, 70), up: 40, s1: 150, r1: 3 }); }
  // thirst and drinking
  D.water = Math.max(0, D.water - (D.sprinting ? TUNE.sprintThirst : TUNE.thirst) * dt);
  const w = nearWater(); D.drinking = !!w && v < 40 && D.z <= 0 && D.water < .995;
  if (D.drinking) { D.water = Math.min(1, D.water + TUNE.drink * dt); D.gulp -= dt; D.idleT = 0; if (D.gulp <= 0) { D.gulp = .3; sfx.slurp(); fx(D.x + D.face * 50, D.y, 2, '#BDE8FF', { z: 10, up: 40, s1: 40 }); }
    if (!(w.fresh > time)) { w.fresh = time + 18; gain('water', D.x, D.y, 'FRESH WATER!'); } }
  if (D.water < .25 && !D.drinking) { D.pant -= dt; if (D.pant <= 0) { D.pant = 5; say(D.x, D.y - 40, D.water <= .02 ? 'so thirsty… find water!' : 'thirsty!', '#9EE8FF', 16); } }
  // standing about: he sniffs the grass, then wags
  if (v <= 30 && D.z <= 0 && !D.drinking) { D.idleT += dt; if (D.act) { D.actT -= dt; if (D.actT <= 0) { D.act = ''; D.idleT = rnd(0, 1); } } else if (D.idleT > 2.4) { D.act = Math.random() < .6 ? 'sniff' : 'wag'; D.actT = D.act === 'sniff' ? 1.4 : 1.2; } }
}
function updateSquirrel(S, dt) {
  const d = dist(S, dog), sees = d < (dog.sprinting ? TUNE.squirrelSee + 60 : TUNE.squirrelSee);
  if (S.st === 'up') { S.t -= dt; if (S.t <= 0) newSquirrel(S); return; }
  if (S.st === 'stun') { S.t -= dt; S.vx = S.vy = 0; if (S.t <= 0) S.st = 'flee'; }
  else if (S.st === 'idle') { S.t -= dt; if (S.t <= 0) { S.t = rnd(1.2, 3.5); const a = rnd(0, TAU), on = Math.random() < .6; S.vx = on ? Math.cos(a) * 80 : 0; S.vy = on ? Math.sin(a) * 60 : 0; S.mv = on ? .5 : 0; } if (S.mv > 0) { S.mv -= dt; if (S.mv <= 0) S.vx = S.vy = 0; } if (sees) { S.st = 'flee'; sfx.squirrel(); S.tree = null; } }
  if (S.st === 'flee') { if (!S.tree) { let b = 1e9; for (const t of trees) { const q = dist(t, S) - dist(t, dog) * .35; if (q < b) { b = q; S.tree = t; } } }
    const tx = S.tree.x, ty = S.tree.y + 8, dx = tx - S.x, dy = ty - S.y, q = Math.hypot(dx, dy) || 1; S.vx = dx / q * TUNE.squirrelSpeed; S.vy = dy / q * TUNE.squirrelSpeed;
    if (q < 16) { S.st = 'up'; S.t = rnd(4, 8); fx(S.tree.x, S.tree.y - 90, 6, ['#56AE4A', '#7CC860'], { up: 40, s1: 60 }); return; } }
  S.x += S.vx * dt; S.y += S.vy * dt; if (Math.abs(S.vx) > 5) S.face = S.vx > 0 ? 1 : -1; S.hop += dt * (Math.hypot(S.vx, S.vy) > 5 ? 16 : 0);
  S.x = clamp(S.x, EDGE + 30, WW - EDGE - 30); S.y = clamp(S.y, EDGE + 100, WH - 50);
  if (d < 36 && dog.z < 34) { gain('squirrel', S.x, S.y, 'GOT ONE!'); bag.acorn++; say(S.x, S.y - 30, 'it dropped an acorn!', '#FFFFFF', 14); sfx.big(); fx(S.x, S.y, 12, ['#FFD23F', '#FFFFFF'], { z: 12, up: 70 }); S.st = 'up'; S.t = rnd(5, 9); dog.happy = 2; }
}
function updateGivers(dt) {
  for (const g of GIVERS) { if (g.say.t > 0) g.say.t -= dt; if (g.cheer > 0) g.cheer -= dt;
    if (g.state === 'want') { if (dist(dog, g) < 96 && has(g)) { const j = jobOf(g); g.parts = []; for (const k in j.need) { bag[k] -= j.need[k]; for (let i = 0; i < j.need[k]; i++) g.parts.push(k); } g.state = 'build'; g.t = 0; sfx.build(); g.say = { s: pick(['Thank you, Bernard!', 'Perfect!', 'Good boy, Bernard!']), t: 1.5 }; dog.happy = 3; } }
    else if (g.state === 'build') { g.t += dt; if (g.t >= 1.5) { const j = jobOf(g), s = spotOf(g, j); g.built[j.art] = (g.built[j.art] || 0) + 1; const p = j.pts + (g.built[j.art] - 1) * 20; score += p; sc.jobs += p; jobsDone++; timer += TUNE.jobTime;
      say(s.x, s.y - 100, '+' + p, '#FFD23F', 26); setBanner(j.name + ' BUILT!', '+' + p + ' points  ·  +' + TUNE.jobTime + ' seconds', '#FFD23F', 2.2); sfx.fanfare(); fx(s.x, s.y, 24, ['#FFD23F', '#FFFFFF', '#FF8AC0', '#9EE8FF'], { z: 20, up: 110, s1: 170, life: 1.2 });
      g.cheer = 2.6; g.state = 'rest'; g.t = 0; g.idx++; } }
    else if (g.state === 'rest') { g.t += dt; if (g.t >= 3) newOrder(g); } }
}
function updateWorld(dt) {
  // pick-ups on the ground go in his bag
  for (const it of items) { if (it.dead || dog.z > 30 || time - it.born < (it.fall ? .5 : 0)) continue; if (Math.hypot(it.x - dog.x - dog.face * 30, (it.y - dog.y) * 1.3) < 34 || dist(it, dog) < 26) { it.dead = true; dog.dipT = .26;
    if (it.kind === 'bone') { gain('bone', it.x, it.y, 'A BONE!', 'picks'); sfx.big(); fx(it.x, it.y, 12, ['#FFFFFF', '#FFD23F'], { z: 12, up: 70 }); dog.happy = 2; }
    else { bag[it.kind]++; gain(it.kind, it.x, it.y, '', 'picks'); if (it.kind === 'stick') sfx.stick(); else sfx.pick(); fx(it.x, it.y, 6, ['#FFFFFF', '#FFE680'], { z: 10 }); }
    it.again = STOCK[it.kind] ? rnd(5, 9) : 0; } }
  for (const it of items) if (it.dead && it.again > 0) { it.again -= dt; if (it.again <= 0) addItem(it.kind); }
  items = items.filter(i => !i.dead || i.again > 0);
  boneT -= dt; if (boneT <= 0) { boneT = rnd(16, 24); if (!items.some(i => i.kind === 'bone' && !i.dead)) addItem('bone', 500); }
  for (const t of trees) if (t.shakeT > 0) t.shakeT -= dt;
  for (const S of squirrels) updateSquirrel(S, dt);
  updateGivers(dt);
  // butterflies: only a jump reaches them
  for (const F of flies) { if (F.hide > 0) { F.hide -= dt; if (F.hide <= 0) newFly(F); continue; } F.ph += dt; F.x = F.hx + Math.sin(F.ph * .7) * 70 + Math.sin(F.ph * 1.9) * 20; F.y = F.hy + Math.sin(F.ph * 1.1) * 34; F.z = 50 + Math.sin(F.ph * 2.3) * 9;
    if (dog.z > 16 && Math.hypot(F.x - dog.x - dog.face * 24, F.y - dog.y) < 46) { F.hide = rnd(5, 9); gain('fly', F.x, F.y, 'SNAP!'); sfx.pick(); fx(F.x, F.y, 8, [F.col, '#FFFFFF'], { z: F.z, up: 30 }); } }
  // ducks drift about and scoot away from him
  for (const k of ducks) { k.t -= dt; if (k.t <= 0) { k.t = rnd(2, 5); k.vx = rnd(-16, 16); k.vy = rnd(-8, 8); } if (dist(k, dog) < 95) { const q = dist(k, dog) || 1; k.vx = (k.x - dog.x) / q * 90; k.vy = (k.y - dog.y) / q * 50; if (!k.qk || time - k.qk > 2) { k.qk = time; sfx.quack(); } }
    k.x += k.vx * dt; k.y += k.vy * dt; k.vx *= Math.pow(.3, dt); k.vy *= Math.pow(.3, dt); if (Math.abs(k.vx) > 3) k.face = k.vx > 0 ? 1 : -1;
    const dx = (k.x - POND.x) / (POND.rx - 34), dy = (k.y - POND.y) / (POND.ry - 26), q = Math.hypot(dx, dy); if (q > 1) { k.x = POND.x + dx / q * (POND.rx - 34); k.y = POND.y + dy / q * (POND.ry - 26); k.vx *= -.5; k.vy *= -.5; } }
  // Nick throws a ballie when Bernard comes to visit: jump to catch it in the air
  tossCool -= dt; const nic = GIVERS[0];
  if (!toss && tossCool <= 0 && nic.state === 'want' && dist(dog, nic) < 330 && dist(dog, nic) > 110) { const a = Math.atan2(dog.y - nic.y, dog.x - nic.x) + rnd(-.5, .5), r = rnd(170, 250), tx = clamp(nic.x + Math.cos(a) * r, EDGE + 60, WW - EDGE - 60), ty = clamp(nic.y + Math.sin(a) * r * .8, EDGE + 120, WH - 60);
    toss = { x0: nic.x + 20, y0: nic.y, x1: tx, y1: ty, t: 0, T: 1.5, x: nic.x, y: nic.y, z: 60 }; nic.say = { s: pick(['Catch, Bernard!', 'Go get it!', 'Jump, Bernard!']), t: 1.6 }; sfx.whistle(); }
  if (toss) { toss.t += dt; const u = toss.t / toss.T; toss.x = lerp(toss.x0, toss.x1, u); toss.y = lerp(toss.y0, toss.y1, u); toss.z = 56 * (1 - u) + Math.sin(u * Math.PI) * 120;
    if (dog.z > 8 && Math.hypot(toss.x - dog.x - dog.face * 30, toss.y - dog.y) < 44 && Math.abs(toss.z - dog.z - 50) < 46) { gain('air', toss.x, toss.y, 'AIR CATCH!'); bag.ball++; sfx.big(); fx(toss.x, toss.y, 14, ['#D8F23A', '#FFFFFF', '#FFD23F'], { z: toss.z, up: 60 }); toss = null; tossCool = rnd(7, 11); nic.cheer = 1.4; nic.say = { s: pick(['Good boy!', 'Wow!', 'Nice catch!']), t: 1.6 }; dog.happy = 2; }
    else if (u >= 1) { addItem('ball', 0, { x: toss.x1, y: toss.y1 }); toss = null; tossCool = rnd(7, 11); } }
}
function updateFx(dt) {
  for (const p of particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 520 * dt; if (p.z < 0) { p.z = 0; p.vz *= -.3; p.vx *= .6; p.vy *= .6; } }
  particles = particles.filter(p => p.life > 0);
  for (const f of floats) { f.life -= dt; f.y -= 34 * dt; } floats = floats.filter(f => f.life > 0);
  if (banner) { banner.life -= dt; if (banner.life <= 0) banner = null; }
}
function finish() {
  state = 'end'; stateT = 0; musicStop(); sfx.fanfare(); newBest = score > best && score > 0;
  if (newBest) { best = score; try { localStorage.setItem('park_best', String(best)); } catch (e) { } }
}
function update(dt) {
  time += dt; stateT += dt; readInput();
  if (state === 'title') { if (IN.hit.jump || IN.hit.bark || IN.hit.start) newGame(); else if (IN.hit.select) quit(); return; }
  if (state === 'pause') {
    if (IN.hit.up) { pauseIdx = (pauseIdx + 2) % 3; sfx.menu(); } if (IN.hit.down) { pauseIdx = (pauseIdx + 1) % 3; sfx.menu(); }
    if (IN.hit.start) { state = 'play'; musicStart(); } else if (IN.hit.select) quit();
    else if (IN.hit.jump || IN.hit.bark) { if (pauseIdx === 0) { state = 'play'; musicStart(); } else if (pauseIdx === 1) newGame(); else quit(); }
    return;
  }
  if (state === 'end') { updateFx(dt); if (stateT > 1.2) { if (IN.hit.jump || IN.hit.bark || IN.hit.start) newGame(); else if (IN.hit.select) quit(); } return; }
  if (state !== 'play') return;
  if (IN.hit.start || IN.hit.select) { state = 'pause'; pauseIdx = 0; musicStop(); sfx.menu(); return; }
  if (autoPlay) autoInput();
  updateDog(dt); updateWorld(dt); updateFx(dt); if (hintT > 0) hintT -= dt; if (tipT > 0) tipT -= dt;
  const cx = clamp(dog.x + dog.vx * .25 - W / 2, 0, WW - W), cy = clamp(dog.y + dog.vy * .2 - H * .56, 0, WH - H), k = 1 - Math.pow(.004, dt);
  cam.x += (cx - cam.x) * k; cam.y += (cy - cam.y) * k;
  timer -= dt; const s = Math.ceil(timer); if (s <= 10 && s !== lastTick && s > 0) { lastTick = s; sfx.tick(); if (s === 10) setBanner('10 SECONDS!', 'finish a job for more time', '#FF9A6A', 1.4); } if (s > 10) lastTick = 99;
  if (timer <= 0) { timer = 0; finish(); }
}

/* ---------------- drawing ---------------- */
function drawDog() {
  const D = dog, v = Math.hypot(D.vx, D.vy), moving = v > 30, running = v > 250, air = D.z > 0, wading = inPond(D.x, D.y, -6) && !air, glad = D.act === 'wag' || D.happy > 0;
  const cyc = D.anim * TAU, bob = air ? 0 : !moving ? (glad ? Math.abs(Math.sin(time * 10)) * 2.5 : .6 + Math.sin(time * 2.2) * .6) : running ? 3 + Math.sin(cyc * 2) * 3.5 : Math.abs(Math.sin(cyc * 2)) * 2.6;
  let frame, rot = -D.lean;
  if (air) { frame = D.vz > 110 ? 22 : D.vz < -110 ? 24 : 23; rot = clamp(D.vz / 1400, -.2, .2); }
  else if (D.barkT > 0) frame = 25;
  else if (D.drinking) frame = 20 + Math.floor(time * 5) % 2;
  else if (D.dipT > 0 && !running) frame = 21;
  else if (moving) { frame = running ? bernRun(D.anim) : bernWalk(D.anim); if (running) rot += Math.sin(cyc) * .05; }
  else if (D.act === 'sniff') frame = 20 + Math.floor(time * 6) % 2;
  else frame = Math.floor(time * (glad ? 14 : 6)) % 4;
  const woof = D.barkT > 0 ? Math.sin((1 - D.barkT / .36) * Math.PI) * 7 : 0;
  const flip = D.fx > 0, kx = Math.max(.3, Math.abs(D.fx)) * (1 - D.sq * .5), ky = 1 + D.sq;
  const x = D.x + (D.wetT > 0 ? Math.sin(time * 60) * 3 : 0), y = D.y - bob - D.z - woof;
  if (wading) { ell(ctx, D.x, D.y - 4, 58 + Math.sin(time * 6) * 4, 15); fs(ctx, null, 'rgba(255,255,255,.7)', 2.5); } else shadow(D.x, D.y, 46 - Math.min(18, D.z * .3), .3 - Math.min(.16, D.z * .003));
  if (D.sprinting && !air) for (let i = 2; i >= 1; i--) bern(frame, x - D.vx * .035 * i, y - D.vy * .03 * i, BU, flip, rot, .22, kx, ky);
  ctx.save(); if (wading) { ctx.beginPath(); ctx.rect(D.x - 100, D.y - 150, 200, 139); ctx.clip(); }   // paws under the water
  if (!bern(frame, x, y + (wading ? 6 : 0), BU, flip, rot, null, kx, ky)) { ell(ctx, x, y - 40, 50, 26); fs(ctx, '#3A2A1E'); }
  ctx.restore();
  if (D.barkT > 0) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(D.x + D.face * 58, D.y - 78 - D.z, 20 + i * 16 + (1 - D.barkT / .36) * 30, D.face > 0 ? -.7 : Math.PI - .7, D.face > 0 ? .7 : Math.PI + .7); ctx.strokeStyle = 'rgba(255,255,255,' + D.barkT * 2 + ')'; ctx.lineWidth = 4; ctx.stroke(); }
  if (D.drinking) text(ctx, 'slurp slurp', D.x, D.y - 116, 14, '#9EE8FF', INK, 'center', 3);
  else if (D.act === 'sniff') text(ctx, 'sniff sniff', D.x, D.y - 112, 13, '#FFFFFF', INK, 'center', 3);
}
function icon(kind, x, y, k) { if (!k) return put(ICON[kind], x, y, .5, .5); ctx.save(); ctx.translate(x, y); ctx.scale(k, k); put(ICON[kind], 0, 0, .5, .5); ctx.restore(); }
function drawItem(it) {
  const z = it.fall ? Math.max(0, it.fall - (time - it.born) * 320) : 0, bobY = Math.sin(time * 3 + it.x) * 1.5;
  shadow(it.x, it.y, it.kind === 'bone' ? 16 : 10, .24);
  if (it.kind === 'bone') { const g = .5 + Math.sin(time * 6) * .25; ell(ctx, it.x, it.y - 12, 26, 18); fs(ctx, 'rgba(255,230,120,' + g * .5 + ')'); }
  put(ICON[it.kind], it.x, it.y + 3 - z - (it.kind === 'stick' || it.kind === 'feather' || it.kind === 'shell' ? 0 : Math.abs(bobY)), .5, 1, it.flip);
}
function drawSquirrel(S) {
  if (S.st === 'up') return; const hop = Math.abs(Math.sin(S.hop)) * 7; shadow(S.x, S.y, 13, .25);
  put(Math.sin(S.hop) > 0 && hop > 2 ? ART.sq1 : ART.sq0, S.x, S.y - hop + 2, .5, 1, S.face < 0);
  if (S.st === 'stun') text(ctx, '!', S.x, S.y - 44, 20, '#FFFFFF', INK, 'center', 4);
}
function drawFly(F) {
  if (F.hide > 0) return; shadow(F.x, F.y, 6, .16); const w = Math.abs(Math.sin(time * 18 + F.ph)) * 8 + 2, y = F.y - F.z;
  ctx.fillStyle = F.col; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(F.x, y); ctx.lineTo(F.x + s * w, y - 8); ctx.lineTo(F.x + s * w, y + 5); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = INK; ctx.fillRect(F.x - 1, y - 5, 2.4, 10);
}
function drawProp(p) {
  if (p.kind === 'tree') put(p.v === 1 && p.ready > time ? ART.tree1b : ART['tree' + p.v], p.x + (p.shakeT > 0 ? Math.sin(time * 50) * 4 : 0), p.y + 4);
  else if (p.kind === 'bush') put(ART['bush' + p.v], p.x, p.y + 12);
  else if (p.kind === 'log') put(ART.log, p.x, p.y + 12);
  else if (p.kind === 'bench') put(ART.bench, p.x, p.y + 12);
  else if (p.kind === 'bowl') put(ART.bowl, p.x, p.y + 8);
  else if (p.kind === 'slide') put(ART.slide, p.x, p.y + 26);
  else if (p.kind === 'swing') put(ART.swing, p.x, p.y + 20);
  else if (p.kind === 'basket') put(ART.basket, p.x, p.y + 10);
  else if (p.kind === 'fountain') { put(ART.fountain, p.x, p.y + 44);
    for (let i = 0; i < 7; i++) { const u = ((time * .9 + i / 7) % 1), a = i * 2.4, r = u * 30; ell(ctx, p.x + Math.cos(a) * r, p.y - 78 + u * u * 46 - u * 18, 2.5, 2.5); fs(ctx, 'rgba(230,248,255,.95)'); } }
  else if (p.kind === 'kid') { const g = p.g, cheer = g.cheer > 0 || g.state === 'build', hop = cheer ? Math.abs(Math.sin(time * 9)) * 12 : 0; shadow(p.x, p.y, 20, .28);
    const face = dog && Math.abs(dog.x - p.x) > 40 ? (dog.x > p.x ? 1 : -1) : g.face; sprite(cheer ? (g.id === 'nic' ? 'nicHop' : 'giuliaHop') : g.id, p.x, p.y - hop, 122, face < 0);
    if (g.built.crown) put(ART.crown, p.x + face * 3, p.y - 111 - hop); }
  else if (p.kind === 'mama') { const g = p.g, hop = g.cheer > 0 || g.state === 'build' ? Math.abs(Math.sin(time * 10)) * 8 : Math.abs(Math.sin(time * 1.6)) * 1.5; shadow(p.x, p.y, 20, .26); put(ART.mama, p.x, p.y + 4 - hop, .5, 1, dog ? dog.x < p.x : false); }
  else if (p.kind === 'tita') { const g = p.g, hop = g.cheer > 0 || g.state === 'build' ? Math.abs(Math.sin(time * 9)) * 6 : 0, y = p.y - 26 - hop;
    rr(ctx, p.x - 17, y - 8, 34, 30, 10); fs(ctx, '#3E8A7A', INK, 2); ell(ctx, p.x, y - 24, 20, 20); fs(ctx, '#E9B48C', INK, 2.5);
    if (ready('tita')) { ctx.save(); ell(ctx, p.x, y - 24, 19, 19); ctx.clip(); const s = Math.min(IMG.tita.naturalWidth, IMG.tita.naturalHeight); ctx.imageSmoothingEnabled = true; ctx.drawImage(IMG.tita, (IMG.tita.naturalWidth - s) / 2, 0, s, s, p.x - 19, y - 43, 38, 38); ctx.restore(); ell(ctx, p.x, y - 24, 20, 20); fs(ctx, null, INK, 2.5); } }
}
function chips(j, x, y, col) { // what a job needs, with how many he has: returns the width used
  let n = 0; for (const k in j.need) { const have = Math.min(bag[k] || 0, j.need[k]), ok = have >= j.need[k]; icon(k, x + n * 54 + 11, y, .72); text(ctx, have + '/' + j.need[k], x + n * 54 + 24, y + 1, 12, ok ? '#2E9A3A' : col, null, 'left'); n++; } return n * 54;
}
function bubble(g) {
  const x = g.x, y = g.y - g.top;
  if (g.say.t > 0) { ctx.font = font(13); const tw = ctx.measureText(g.say.s).width + 20; rr(ctx, x - tw / 2, y - 13, tw, 26, 10); fs(ctx, '#FFFFFF', INK, 2); text(ctx, g.say.s, x, y + .5, 13, INK); return; }
  if (g.state !== 'want') return; const j = jobOf(g), ok = has(g), w = Object.keys(j.need).length * 54 + 12, bobY = ok ? Math.abs(Math.sin(time * 6)) * 5 : 0;
  rr(ctx, x - w / 2, y - 15 - bobY, w, 30, 10); fs(ctx, ok ? '#E4FFD8' : '#FFFFFF', ok ? '#2E9A3A' : INK, ok ? 3.5 : 2); chips(j, x - w / 2 + 6, y - bobY, INK);
  ctx.beginPath(); ctx.moveTo(x - 6, y + 14 - bobY); ctx.lineTo(x, y + 22 - bobY); ctx.lineTo(x + 6, y + 14 - bobY); ctx.closePath(); fs(ctx, ok ? '#E4FFD8' : '#FFFFFF');
}
function drawWorld() {
  const cx = snapX(cam.x), cy = snapY(cam.y);
  if (!ground) { ground = bakeGround(); bakeArt(); }
  ctx.imageSmoothingEnabled = false; ctx.drawImage(ground, Math.round(cx * SX), Math.round(cy * SY), PW, PH, 0, 0, W, H);
  ctx.save(); ctx.translate(-cx, -cy);
  const vis = o => o.x > cx - 140 && o.x < cx + W + 140 && o.y > cy - 60 && o.y < cy + H + 240;
  const list = [];
  for (const p of props) if (vis(p)) list.push({ y: p.y, f: () => drawProp(p) });
  for (const g of GIVERS) for (const j of g.jobs) { const n = g.built && g.built[j.art]; if (!n || j.wear || !vis(j.spot)) continue; const s = j.spot;
    list.push({ y: s.y, f: () => { const b = j.art === 'raft' ? Math.sin(time * 2) * 2 : 0; put(ART[j.art], s.x, s.y + 8 + b); if (n > 1) text(ctx, '×' + n, s.x + 34, s.y - 4, 15, '#FFD23F', INK, 'center', 4); } }); }
  for (const it of items) if (!it.dead && vis(it)) list.push({ y: it.y - 6, f: () => drawItem(it) });
  for (const S of squirrels) if (vis(S)) list.push({ y: S.y, f: () => drawSquirrel(S) });
  for (const k of ducks) if (vis(k)) list.push({ y: k.y, f: () => { ell(ctx, k.x, k.y + 2, 18, 5); fs(ctx, null, 'rgba(255,255,255,.6)', 2); put(ART.duck, k.x, k.y + 4 + Math.sin(time * 3 + k.x) * 1.2, .5, 1, k.face < 0); } });
  if (dog) list.push({ y: dog.y, f: drawDog });
  list.sort((a, b) => a.y - b.y); for (const o of list) o.f();
  for (const F of flies) if (vis(F)) drawFly(F);
  if (toss) { shadow(toss.x, toss.y, 9, .22); icon('ball', toss.x, toss.y - toss.z); }
  // a job being put together: the pieces whirl in and the thing pops out
  for (const g of GIVERS) if (g.state === 'build') { const s = spotOf(g, jobOf(g)), u = g.t / 1.5, n = g.parts.length; ell(ctx, s.x, s.y - 30, 44 * (1 - u) + 10, 30 * (1 - u) + 8); fs(ctx, 'rgba(255,240,150,' + (.25 + u * .4) + ')');
    g.parts.forEach((k, i) => { const a = time * 7 + i / n * TAU, r = 58 * (1 - u); icon(k, s.x + Math.cos(a) * r, s.y - 34 + Math.sin(a) * r * .55 - Math.sin(u * Math.PI) * 26); }); if (Math.random() < .5) fx(s.x + rnd(-30, 30), s.y, 1, ['#FFD23F', '#FFFFFF'], { z: rnd(10, 50), up: 50, s1: 40 }); }
  for (const p of particles) { ctx.globalAlpha = clamp(p.life * 2.5, 0, 1); ell(ctx, p.x, p.y - p.z, p.r, p.r); fs(ctx, p.col); } ctx.globalAlpha = 1;
  if (dog) for (const g of GIVERS) if (vis(g)) bubble(g);
  for (const f of floats) { ctx.globalAlpha = clamp(f.life / f.max * 2, 0, 1); text(ctx, f.text, f.x, f.y, f.size, f.col, INK, 'center', 4); } ctx.globalAlpha = 1;
  ctx.restore();
}
function head(x, y, r) { ell(ctx, x, y, r, r); fs(ctx, '#F4E9D8', INK, 2.5); if (!ready('bernard')) return; ctx.save(); ell(ctx, x, y, r - 1, r - 1); ctx.clip(); ctx.imageSmoothingEnabled = true; ctx.drawImage(IMG.bernard, 36, 0, 212, 212, x - r, y - r, r * 2, r * 2); ctx.restore(); ell(ctx, x, y, r, r); fs(ctx, null, INK, 2.5); }
function face(g, x, y, r) { // a friend's face in a little circle
  ell(ctx, x, y, r, r); fs(ctx, g.id === 'duck' ? '#63BCE8' : '#F4E9D8', INK, 2);
  if (g.id === 'duck') { if (ART.duck) put(ART.duck, x, y + 1, .5, .5); return; }
  const img = IMG[g.id]; if (!ready(g.id)) return; ctx.save(); ell(ctx, x, y, r - 1, r - 1); ctx.clip(); ctx.imageSmoothingEnabled = true;
  if (g.id === 'tita') { const s = Math.min(img.naturalWidth, img.naturalHeight); ctx.drawImage(img, (img.naturalWidth - s) / 2, 0, s, s, x - r, y - r, r * 2, r * 2); }
  else { const s = img.naturalWidth * .9; ctx.drawImage(img, (img.naturalWidth - s) * .5, img.naturalHeight * .02, s, s, x - r, y - r, r * 2, r * 2); }
  ctx.restore(); ell(ctx, x, y, r, r); fs(ctx, null, INK, 2);
}
function pointer(t, col, label) { // an arrow at the edge of the screen toward something out of view
  const sx = t.x - cam.x, sy = t.y - cam.y; if (sx > 20 && sx < W - 20 && sy > 80 && sy < H - 20) return;
  const a = Math.atan2(t.y - dog.y, t.x - dog.x), px = clamp(dog.x - cam.x + Math.cos(a) * 150, 50, W - 290), py = clamp(dog.y - cam.y - 50 + Math.sin(a) * 110, 104, H - 96);
  ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-8, -12); ctx.lineTo(-8, 12); ctx.closePath(); fs(ctx, col, INK, 2.5); ctx.restore(); text(ctx, label, px, py + 24, 12, col, INK, 'center', 3);
}
function drawHUD() {
  // score
  panel(12, 10, 176, 62); head(42, 41, 22); text(ctx, 'SCORE', 74, 26, 12, '#B4C2E2', null, 'left'); text(ctx, String(score), 74, 50, 28, '#FFFFFF', INK, 'left', 5);
  // time
  const low = timer <= 10; panel(W / 2 - 62, 10, 124, 62, low ? '#FF8A70' : null); text(ctx, 'TIME', W / 2, 25, 12, '#B4C2E2'); const s = Math.ceil(timer); text(ctx, Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'), W / 2, 50, 28, low ? '#FF9A6A' : '#FFFFFF', INK, 'center', 5);
  // water
  const dry = dog.water < .25, blink = dry && Math.sin(time * 9) > 0; panel(W - 250, 10, 238, 62, blink ? '#63BCE8' : null);
  text(ctx, dry ? 'WATER  ·  thirsty!' : dog.sprinting ? 'WATER  ·  sprinting' : 'WATER', W - 236, 26, 12, dry ? '#9EE8FF' : '#B4C2E2', null, 'left');
  rr(ctx, W - 236, 40, 210, 16, 8); fs(ctx, 'rgba(255,255,255,.14)'); if (dog.water > .01) { rr(ctx, W - 236, 40, Math.max(14, 210 * dog.water), 16, 8); fs(ctx, dry ? '#FF9A6A' : '#4FB8F0'); }
  // jobs: who wants what
  const jx = W - 250, jy = 80; panel(jx, jy, 238, 26 + GIVERS.length * 40); text(ctx, 'JOBS', jx + 14, jy + 14, 12, '#B4C2E2', null, 'left'); text(ctx, jobsDone + ' done', jx + 224, jy + 14, 12, '#FFE680', null, 'right');
  GIVERS.forEach((g, i) => { const y = jy + 26 + i * 40, j = jobOf(g), ok = g.state === 'want' && has(g);
    if (ok) { rr(ctx, jx + 4, y, 230, 38, 9); fs(ctx, 'rgba(198,255,61,' + (.16 + Math.abs(Math.sin(time * 5)) * .14) + ')'); }
    face(g, jx + 22, y + 19, 14);
    if (g.state === 'want') { text(ctx, ok ? j.name + ': take it to ' + g.name + '!' : j.name, jx + 44, y + 10, 11, ok ? '#C6FF3D' : '#FFE680', null, 'left'); chips(j, jx + 42, y + 26, '#FFFFFF'); }
    else text(ctx, g.state === 'build' ? 'building…' : 'thinking of a new job…', jx + 44, y + 19, 12, '#B4C2E2', null, 'left'); });
  // arrows: water when thirsty, friends whose job is ready
  if (dry && !dog.drinking) { let t = { x: clamp(dog.x, POND.x - POND.rx, POND.x + POND.rx), y: POND.y }, bd = dist(dog, t); for (const w of waters) if (dist(dog, w) < bd) { bd = dist(dog, w); t = w; } pointer(t, '#63BCE8', 'water'); }
  else for (const g of GIVERS) if (g.state === 'want' && has(g)) { pointer(g, '#C6FF3D', g.name); break; }
  // map
  const mw = 150, mh = 84, mx = 12, my = H - mh - 12, kx = mw / WW, ky = mh / WH; rr(ctx, mx, my, mw, mh, 8); fs(ctx, 'rgba(40,110,50,.85)', 'rgba(255,255,255,.5)', 2);
  ctx.save(); rr(ctx, mx, my, mw, mh, 8); ctx.clip(); ctx.strokeStyle = '#E2C98C'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(mx + RING.x * kx, my + RING.y * ky, RING.rx * kx, RING.ry * ky, 0, 0, TAU); ctx.moveTo(mx + 390 * kx, my + 810 * ky); ctx.lineTo(mx + 2490 * kx, my + 810 * ky); ctx.moveTo(mx + 1440 * kx, my + 250 * ky); ctx.lineTo(mx + 1440 * kx, my + mh); ctx.stroke();
  ell(ctx, mx + POND.x * kx, my + POND.y * ky, POND.rx * kx, POND.ry * ky); fs(ctx, '#4FA8D8'); ell(ctx, mx + SAND.x * kx, my + SAND.y * ky, SAND.rx * kx, SAND.ry * ky); fs(ctx, '#EBD79A');
  for (const t of trees) if (t.v === 1) { ell(ctx, mx + t.x * kx, my + t.y * ky, 2.5, 2.5); fs(ctx, t.ready > time ? '#3F8E3A' : '#E8402F'); }
  const DOT = { ball: '#E8FF50', stick: '#7A4E28', flower: '#FF7AB8', apple: '#E8402F', feather: '#FFFFFF', shell: '#FFC8A8', acorn: '#C88A48', bone: '#FFFFFF' };
  for (const it of items) if (!it.dead) { ctx.fillStyle = DOT[it.kind]; ctx.fillRect(mx + it.x * kx - 1.5, my + it.y * ky - 1.5, 3, 3); }
  for (const g of GIVERS) { const ok = g.state === 'want' && has(g), r = ok ? 5 + Math.abs(Math.sin(time * 6)) * 2 : 4; ell(ctx, mx + g.x * kx, my + g.y * ky, r, r); fs(ctx, ok ? '#C6FF3D' : '#FFD23F', INK, 1.5); }
  ell(ctx, mx + dog.x * kx, my + dog.y * ky, 4.5, 4.5); fs(ctx, '#FFFFFF', INK, 2); ctx.restore();
  // his bag
  const bw = KINDS.length * 44 + 12, bx = W / 2 - bw / 2, by = H - 52; panel(bx, by, bw, 42);
  KINDS.forEach((k, i) => { const x = bx + 28 + i * 44, n = bag[k] || 0; ctx.globalAlpha = n ? 1 : .35; icon(k, x - 6, by + 21); ctx.globalAlpha = 1; text(ctx, String(n), x + 12, by + 29, 14, n ? '#FFFFFF' : 'rgba(255,255,255,.4)', n ? INK : null, 'center', 3); });
  const line = tipT > 0 ? tip : hintT > 0 && !touch.on ? 'B jump  ·  hold Y to sprint  ·  A bark  ·  stand by water to drink' : '';
  if (line) { ctx.globalAlpha = clamp(tipT > 0 ? tipT : hintT, 0, 1); ctx.font = font(14); const tw = ctx.measureText(line).width + 28; panel(W / 2 - tw / 2, by - 36, tw, 28); text(ctx, line, W / 2, by - 21.5, 14, tipT > 0 ? '#FFE680' : '#FFFFFF'); ctx.globalAlpha = 1; }
  if (touch.on) for (const [k, lab] of [['run', 'RUN'], ['jump', 'JUMP']]) { const b = TB[k], on = k === 'run' && touch.runId !== null; ell(ctx, b.x, b.y, b.r, b.r); fs(ctx, on ? 'rgba(198,255,61,.5)' : 'rgba(10,14,26,.45)', 'rgba(255,255,255,.7)', 2.5); text(ctx, lab, b.x, b.y, 15, '#FFFFFF', INK, 'center', 3); }
  if (banner) { const a = clamp(Math.min(banner.life * 3, (banner.max - banner.life) * 6), 0, 1); ctx.globalAlpha = a; text(ctx, banner.text, W / 2 - 60, 150, 40, banner.col, INK, 'center', 9); if (banner.sub) text(ctx, banner.sub, W / 2 - 60, 188, 17, '#FFFFFF', INK, 'center', 4); ctx.globalAlpha = 1; }
}
function drawTitle() {
  cam.x = clamp(1440 - W / 2 + Math.sin(time * .15) * 300, 0, WW - W); cam.y = clamp(700 - H / 2, 0, WH - H); const keep = dog; dog = null; drawWorld(); dog = keep;
  ctx.fillStyle = 'rgba(8,12,26,.45)'; ctx.fillRect(0, 0, W, H);
  text(ctx, 'BERNARD', W / 2, 92, 46, '#FFFFFF', INK, 'center', 9); text(ctx, 'IN THE PARK', W / 2, 162, 78, '#C6FF3D', INK, 'center', 13);
  const bx = W / 2 + Math.sin(time * 1.1) * 250; shadow(bx, 322, 52, .35); bern(bernRun(time * 2.6), bx, 322 - 3 - Math.sin(time * 2.6 * TAU * 2) * 3, BU * 1.2, Math.cos(time * 1.1) > 0, Math.sin(time * 2.6 * TAU) * .04);
  panel(W / 2 - 340, 346, 680, 104);
  text(ctx, 'Your friends in the park need things built. Fetch what they ask for!', W / 2, 370, 18, '#FFFFFF');
  text(ctx, 'Collect ballies, sticks, flowers, apples, feathers, shells and acorns', W / 2, 399, 15, '#FFE680');
  text(ctx, touch.on ? 'Drag on the left to run  ·  JUMP and RUN buttons on the right' : 'B jump  ·  hold Y to sprint  ·  A bark  ·  stand by water to drink', W / 2, 427, 15, '#9EE8FF');
  if (Math.sin(time * 5) > -.3) text(ctx, touch.on ? 'TAP TO PLAY' : 'PRESS B TO PLAY', W / 2, 482, 30, '#C6FF3D', INK, 'center', 6);
  text(ctx, 'SELECT: back to the arcade', 24, H - 16, 13, 'rgba(255,255,255,.8)', 'rgba(0,0,0,.5)', 'left', 3); if (best) text(ctx, 'Best ' + best, W - 130, H - 16, 14, '#FFE680', 'rgba(0,0,0,.5)', 'right', 3);
}
function drawPause() {
  ctx.fillStyle = 'rgba(8,10,20,.6)'; ctx.fillRect(0, 0, W, H); text(ctx, 'PAUSED', W / 2, 170, 48, '#FFD23F', INK, 'center', 9);
  ['Resume', 'Start over', 'Quit to Arcade'].forEach((s, i) => text(ctx, (i === pauseIdx ? '▶ ' : '') + s, W / 2, 250 + i * 46, 26, i === pauseIdx ? '#C6FF3D' : '#FFFFFF', INK, 'center', 5));
}
function drawEnd() {
  ctx.fillStyle = 'rgba(8,10,20,.62)'; ctx.fillRect(0, 0, W, H);
  rr(ctx, 190, 44, 580, 452, 22); fs(ctx, 'rgba(12,16,32,.94)', '#FFD23F', 4);
  text(ctx, 'TIME TO GO HOME!', W / 2, 86, 38, '#FFD23F', INK, 'center', 7);
  const picked = KINDS.reduce((a, k) => a + (tally[k] || 0), 0) + (tally.bone || 0), tricks = ['squirrel', 'fly', 'air', 'hop', 'water'].reduce((a, k) => a + (tally[k] || 0), 0);
  [['Jobs done', jobsDone, sc.jobs], ['Things collected', picked, sc.picks], ['Squirrels, jumps and tricks', tricks, sc.tricks]].forEach(([name, n, p], i) => { const y = 138 + i * 38; if (stateT < .3 + i * .25) return;
    text(ctx, name, 236, y, 19, '#B4C2E2', null, 'left'); text(ctx, String(n), 560, y, 19, '#FFFFFF', null, 'right'); text(ctx, String(p), 724, y, 22, p ? '#C6FF3D' : '#667', INK, 'right', 4); });
  if (stateT > 1.1) { const made = []; for (const g of GIVERS) for (const j of g.jobs) if (g.built[j.art]) made.push(j.art);
    if (made.length) { text(ctx, 'Built today', W / 2, 252, 14, '#B4C2E2'); made.forEach((a, i) => { ctx.save(); ctx.translate(W / 2 - (made.length - 1) * 31 + i * 62, 312); ctx.scale(.5, .5); put(ART[a], 0, 0, .5, 1); ctx.restore(); }); }
    else text(ctx, 'Nothing built this time: check the JOBS list!', W / 2, 284, 16, '#B4C2E2'); }
  if (stateT > 1.4) { text(ctx, 'SCORE', W / 2 - 100, 356, 22, '#B4C2E2'); text(ctx, String(score), W / 2 + 40, 356, 50, '#FFFFFF', INK, 'center', 8);
    const stars = score >= 1000 ? 3 : score >= 500 ? 2 : 1; for (let i = 0; i < 3; i++) { ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? 8 : 18; ctx.lineTo(W / 2 - 46 + i * 46 + Math.cos(a) * q, 406 + Math.sin(a) * q); } ctx.closePath(); fs(ctx, i < stars ? '#FFD23F' : 'rgba(255,255,255,.15)', INK, 2.5); }
    text(ctx, newBest ? 'NEW BEST!' : 'Best ' + best, W / 2, 440, newBest ? 22 : 16, newBest ? '#C6FF3D' : '#B4C2E2', newBest ? INK : null, 'center', 5);
    if (Math.sin(time * 5) > -.3) text(ctx, touch.on ? 'TAP TO PLAY AGAIN' : 'B: PLAY AGAIN   ·   SELECT: ARCADE', W / 2, 474, 18, '#C6FF3D', INK, 'center', 5); }
}
function render() {
  if (state === 'title') drawTitle(); else { drawWorld(); drawHUD(); }
  if (state === 'pause') drawPause(); if (state === 'end') drawEnd();
  present();
}

/* ---------------- loop + arcade hookup ---------------- */
let raf = 0, last = 0, acc = 0, running = false;
function loop(ts) {
  if (!running) return; raf = requestAnimationFrame(loop);
  if (!last) last = ts; let dt = (ts - last) / 1000; last = ts; if (dt > .1) dt = .1; acc += dt;
  try { let n = 0; while (acc >= 1 / 60 && n < 4) { update(1 / 60); acc -= 1 / 60; n++; } render(); } catch (err) { if (window.console) console.error('park frame', err); }
}
function quit() { musicStop(); if (typeof window.PK.onQuit === 'function') { stop(); window.PK.onQuit(); } else { state = 'title'; stateT = 0; } }
function start() {
  if (running) return; running = true; fitStage(); musicStop(); state = 'title'; stateT = 0; time = 0;
  IN.prev = { jump: true, bark: true, start: true, select: true, left: true, right: true, up: true, down: true };   // ignore the press that opened the game
  window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); window.addEventListener('blur', onBlur); window.addEventListener('resize', fitStage);
  last = 0; raf = requestAnimationFrame(loop);
}
function stop() { running = false; musicStop(); cancelAnimationFrame(raf); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur); window.removeEventListener('resize', fitStage); for (const k in keys) keys[k] = false; }
bindTouch();
window.PK = {
  start, stop, onQuit: null, get state() { return state; },
  // test hooks
  dbg() { return { state, score, sc: { ...sc }, jobsDone, timer: +timer.toFixed(1), bag: { ...bag }, tally: { ...tally }, dog: dog && { x: Math.round(dog.x), y: Math.round(dog.y), z: Math.round(dog.z), water: +dog.water.toFixed(2), drinking: dog.drinking, act: dog.act }, items: items.filter(i => !i.dead).length, jobs: GIVERS.map(g => g.id + ':' + g.state + ':' + jobOf(g).art) }; },
  begin() { newGame(); }, autoplay(on) { autoPlay = !!on; }, setTimer(t) { timer = t; }, tp(x, y) { dog.x = x; dog.y = y; cam.x = clamp(x - W / 2, 0, WW - W); cam.y = clamp(y - H * .56, 0, WH - H); }, thirst(v) { dog.water = v; }, give(k, n) { bag[k] = (bag[k] || 0) + (n || 1); },
  sim(sec) { for (let i = 0; i < sec * 60; i++) { update(1 / 60); if (state !== 'play') break; } return { score, jobsDone, bag: { ...bag } }; },
  spots() { return { givers: GIVERS.map(g => ({ id: g.id, x: g.x, y: g.y })), appleTrees: trees.filter(t => t.v === 1).map(t => ({ x: Math.round(t.x), y: Math.round(t.y) })) }; },
  poster(cx, cy) { // card art (used to make art/card-park.jpg)
    running = false; cancelAnimationFrame(raf); newGame(); musicStop(); state = 'poster'; cam.x = cx == null ? 620 : cx; cam.y = cy == null ? 800 : cy; const keep = dog; dog = null; floats = []; particles = []; items = []; squirrels = []; flies = []; drawWorld(); dog = keep;
    shadow(590, 470, 96, .32); bern(14, 590, 470, BU * 2.4, false, -.04);
    ctx.save(); ctx.translate(396, 440); ctx.scale(2, 2); icon('ball', 0, 0); ctx.restore();
    ctx.save(); ctx.translate(820, 330); ctx.scale(1.6, 1.6); put(ART.sq1, 0, 0, .5, 1, false); ctx.restore();
    present();
  }
};
})();

