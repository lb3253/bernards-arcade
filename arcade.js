
(() => {
"use strict";

const PHOTO_BERNARD="var(--ph-bernard)";
["art/bernard-pilot-portrait.jpg","art/bernard-jet-portrait.jpg","art/card-air-jet.jpg"].forEach(s=>{const i=new Image(); i.src=s;});
const PHOTO_TITA="var(--ph-tita)";
const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const W = cv.width, H = cv.height;

// ---------------------------------------------------------------- layout
const CAP_TOP = 150, WALL_BOTTOM = 196;
const FENCE_W = 26;
const FIELD = { x0: FENCE_W+8, y0: WALL_BOTTOM+10, x1: W-FENCE_W-8, y1: H-16 };
const ROOF  = { x:0, y:560, w:210, h:H-560 };
const DOOR  = { x:224, y:596 }, DOOR_R = 160;

const PIT = { x:656, y:436, r:34 };
const CHAIRS = [];
for (let i=0;i<6;i++){
  const a = -Math.PI/2 + i*(Math.PI*2/6) + .4;
  CHAIRS.push({ x:PIT.x+Math.cos(a)*108, y:PIT.y+Math.sin(a)*86, r:21, a:a+Math.PI/2 });
}
const OBSTACLES = [
  { type:"circle", x:PIT.x, y:PIT.y, r:PIT.r },
  ...CHAIRS.map(c=>({type:"circle",x:c.x,y:c.y,r:c.r})),
  { type:"rect", x:ROOF.x, y:ROOF.y, w:ROOF.w, h:ROOF.h }
];
const POOPS = [
  {x:322,y:330},{x:498,y:566},{x:786,y:552},
  {x:246,y:492},{x:596,y:262},{x:840,y:372}
].map(q=>({...q,r:15,cool:0,seed:q.x*.7+q.y*.3}));

// ---------------------------------------------------------------- tuning
const PLAYER_SPEED = 210, NPC_SPEED = 170, LAURA_SPEED = 150;
const CHARGE_TIME = 1.5, SWEET = .74, SWEET_W = .11, OK_W = .24;
const SAFE_DIST = 150;
const CARRY_MAX = 3;
/* ===== TUNING DIALS =========================================
   Change these numbers if a game feels too easy or too hard.
     ROUND_TIME  seconds per round
     WIN_SCORE   points needed to beat Bernard  (Ballies)
     STEAL_LIMIT balls he can take before the round ends
   Tita Scolder's dials are further down: T_TIME / T_WIN / T_STRIKES
   ============================================================ */
const ROUND_TIME = 90;
const WIN_SCORE = 450;
const STEAL_LIMIT = 8;
const MAX_LOOSE = 6, SPAWN_EVERY = 2.1;
const THROW_BTN = { x:W-94, y:H-98, r:56 };

const KINDS = {
  red:   { value:10, light:"#ff8a72", dark:"#c4211a", rim:"#ff5a45", label:"RED" },
  green: { value:30, light:"#e2ff7d", dark:"#79b70d", rim:"#b6f23a", label:"GREEN" },
  gold:  { value:75, light:"#fff3b8", dark:"#d99406", rim:"#ffcf3a", label:"GOLD" }
};
function rollKind(){
  const r = Math.random();
  return r < .07 ? "gold" : r < .45 ? "green" : "red";
}

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const rand=(a,b)=>a+Math.random()*(b-a);

function pushOut(a){
  for (const o of OBSTACLES){
    if (o.type==="circle"){
      const dx=a.x-o.x, dy=a.y-o.y, d=Math.hypot(dx,dy), min=o.r+a.r;
      if (d<min && d>.001){ a.x=o.x+dx/d*min; a.y=o.y+dy/d*min; }
    } else {
      const cx=clamp(a.x,o.x,o.x+o.w), cy=clamp(a.y,o.y,o.y+o.h);
      let dx=a.x-cx, dy=a.y-cy, d=Math.hypot(dx,dy);
      if (d<a.r){ if(d<.001){dx=1;dy=-1;d=Math.SQRT2;} a.x=cx+dx/d*a.r; a.y=cy+dy/d*a.r; }
    }
  }
}
function clearSpot(x,y,pad){
  for (let i=0;i<30;i++){
    let ok=true;
    for (const o of OBSTACLES){
      if (o.type==="circle"){
        const d=Math.hypot(x-o.x,y-o.y);
        if (d<o.r+pad){ const s=(o.r+pad)/Math.max(d,.01); x=o.x+(x-o.x)*s; y=o.y+(y-o.y)*s; ok=false; }
      } else if (x>o.x-pad&&x<o.x+o.w+pad&&y>o.y-pad&&y<o.y+o.h+pad){ x=o.x+o.w+pad; ok=false; }
    }
    x=clamp(x,FIELD.x0+pad,FIELD.x1-pad);
    y=clamp(y,FIELD.y0+pad,FIELD.y1-pad);
    if (ok) break;
  }
  return {x,y};
}

// ---------------------------------------------------------------- art helpers
function orb(c,x,y,r,light,dark,gloss){
  const g=c.createRadialGradient(x-r*.36,y-r*.42,r*.08,x,y,r*1.05);
  g.addColorStop(0,light); g.addColorStop(1,dark);
  c.fillStyle=g; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill();
  if (gloss!==false){
    c.fillStyle="rgba(255,255,255,.6)";
    c.beginPath(); c.ellipse(x-r*.33,y-r*.44,r*.27,r*.17,-.6,0,Math.PI*2); c.fill();
  }
}
function blob(c,x,y,rx,ry,rot,light,dark){
  const g=c.createLinearGradient(x-rx,y-ry,x+rx*.4,y+ry);
  g.addColorStop(0,light); g.addColorStop(1,dark);
  c.fillStyle=g; c.beginPath(); c.ellipse(x,y,rx,ry,rot,0,Math.PI*2); c.fill();
}
function limb(c,x1,y1,x2,y2,w,light,dark){
  const g=c.createLinearGradient(x1,y1,x2,y2);
  g.addColorStop(0,light); g.addColorStop(1,dark);
  c.strokeStyle=g; c.lineWidth=w; c.lineCap="round";
  c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
}
function softShadow(c,x,y,rx,ry,a){
  const g=c.createRadialGradient(x,y,0,x,y,Math.max(rx,ry));
  g.addColorStop(0,"rgba(18,42,16,"+a+")"); g.addColorStop(1,"rgba(18,42,16,0)");
  c.save(); c.translate(x,y); c.scale(1,ry/Math.max(rx,ry)); c.translate(-x,-y);
  c.fillStyle=g; c.beginPath(); c.arc(x,y,Math.max(rx,ry),0,Math.PI*2); c.fill();
  c.restore();
}
function goldPanel(c,x,y,w,h,r){
  r=r||14;
  const gb=c.createLinearGradient(0,y,0,y+h);
  gb.addColorStop(0,"#ffe294"); gb.addColorStop(.45,"#dfa332"); gb.addColorStop(1,"#8f5510");
  c.fillStyle=gb; c.beginPath(); c.roundRect(x,y,w,h,r); c.fill();
  const gi=c.createLinearGradient(0,y+5,0,y+h-5);
  gi.addColorStop(0,"#3d2a17"); gi.addColorStop(1,"#241609");
  c.fillStyle=gi; c.beginPath(); c.roundRect(x+5,y+5,w-10,h-10,Math.max(r-5,3)); c.fill();
  c.fillStyle="rgba(255,255,255,.10)";
  c.beginPath(); c.roundRect(x+5,y+5,w-10,(h-10)*.42,Math.max(r-5,3)); c.fill();
}
function chunky(c,txt,x,y,size,fill,stroke,weight){
  c.font=(weight||700)+" "+size+"px Fredoka, ui-rounded, system-ui, sans-serif";
  c.lineJoin="round"; c.miterLimit=2;
  c.lineWidth=Math.max(3,size*.22); c.strokeStyle=stroke;
  c.strokeText(txt,x,y);
  c.fillStyle=fill; c.fillText(txt,x,y);
}

// ---------------------------------------------------------------- audio
let audioOn=true, glare=true, ac=null;
function beep(f,dur,type,vol){
  if (!audioOn) return;
  try{
    if (!ac) ac=new (window.AudioContext||window.webkitAudioContext)();
    const o=ac.createOscillator(), g=ac.createGain();
    o.type=type||"sine"; o.frequency.setValueAtTime(f,ac.currentTime);
    g.gain.setValueAtTime(vol||.06,ac.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+dur);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime+dur);
  }catch(e){}
}
const sfx={
  pick:  k=>beep(k==="gold"?880:k==="green"?660:520,.1,"triangle",.05),
  throw: ()=>beep(300,.16,"triangle",.05),
  bank:  n=>{ for(let i=0;i<n;i++) setTimeout(()=>beep(520+i*160,.13,"square",.045),i*95); },
  perfect:()=>{beep(760,.1,"square",.05);setTimeout(()=>beep(1140,.18,"square",.05),95);},
  bark:  ()=>{beep(150,.12,"sawtooth",.06);setTimeout(()=>beep(108,.18,"sawtooth",.055),95);},
  squish:()=>beep(85,.24,"sawtooth",.05),
  broom: ()=>{beep(440,.1,"square",.05);setTimeout(()=>beep(290,.16,"square",.05),90);},
  over:  ()=>{beep(320,.2,"sawtooth",.05);setTimeout(()=>beep(200,.36,"sawtooth",.05),190);},
  flap:  ()=>beep(430,.07,"triangle",.045),
  paddle:()=>beep(240,.09,"sine",.05),
  shot:  ()=>beep(980,.05,"square",.035),
  yelp:  ()=>{beep(880,.08,"sawtooth",.06);setTimeout(()=>beep(1240,.14,"sawtooth",.05),70);},
  yowl:  ()=>{[620,760,540,700].forEach((f,i)=>setTimeout(()=>beep(f,.11,"sawtooth",.05),i*90));},
  thunder:()=>{beep(70,.28,"sawtooth",.07);setTimeout(()=>beep(52,.4,"sawtooth",.06),120);},
  splash:()=>{beep(180,.16,"sawtooth",.05);setTimeout(()=>beep(120,.22,"sine",.045),80);},
  gate:  ()=>{beep(700,.07,"square",.04);setTimeout(()=>beep(940,.09,"square",.04),70);},
  win:   ()=>{ [523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>beep(f,.26,"square",.05),i*120)); }
};

// ---------------------------------------------------------------- state
let G=null;
function newGame(best){
  return {
    combo:{n:0,t:0,mult:1,pop:0},
    running:true, t:0, timeLeft:ROUND_TIME, score:0, best:best||0,
    stolen:0, banked:0, bestVolley:0, won:false, winFx:0,
    shake:0, flash:0, flashCol:"224,58,47", toasts:[], particles:[], sparks:[], confetti:[],
    balls:[], carry:[], spawnT:1.0,
    player:{x:430,y:604,r:16,face:-Math.PI/2,step:0,slow:0,shooCool:0},
    npc:{x:330,y:250,hx:330,hy:250,r:16,step:0,face:Math.PI/2,wave:0,windup:0},
    dog:{x:250,y:410,r:22,face:0,phase:0,wag:0,delay:1.2,bark:null,carryT:0,hasBall:null},
    laura:{x:DOOR.x,y:DOOR.y,r:17,mode:"inside",warn:0,patience:0,step:0,sweep:0,bark:null},
    charging:false, power:0, nagCool:0, pulse:0
  };
}
const dogSpeed=()=>Math.min(120+G.banked*4+G.stolen*5,196);
const carryValue=()=>G.carry.reduce((s,k)=>s+KINDS[k].value,0);

// ---------------------------------------------------------------- input
const keys=new Set();
let pointer={down:false,x:0,y:0};

// ---------------------------------------------------------------- gamepad (SNES Bluetooth controller)
// Works with SNES-style Bluetooth pads, 8BitDo, and anything the browser
// exposes through the Gamepad API. Drives the menus as well as gameplay.
const GP = { idx:null, id:"", prev:{}, focus:0, lastScreen:"", navHold:0, lastBtn:"" };

const GP_ITEMS = {
  home:     ["pickFlap","pickAir"],
  menu:     ["startBtn","menuBack"],
  titamenu: ["titaStartBtn","titaBack"],
  flapmenu: ["flapStartBtn","flapBack"],
  paddlemenu: ["padGiulia","padNic","padStartBtn","padBack"],
  airmenu: ["airBiplane","airJet","airStartBtn","airBack"],
  pause: ["pauseResume","pauseSound","pauseQuit"],
  over:     ["againBtn","overHome"]
};
function gpScreen(){
  const on = id => document.getElementById(id).classList.contains("on");
  if (on("home"))     return "home";
  if (on("menu"))     return "menu";
  if (on("titamenu")) return "titamenu";
  if (on("flapmenu")) return "flapmenu";
  if (on("pause")) return "pause";
  if (on("paddlemenu")) return "paddlemenu";
  if (on("airmenu")) return "airmenu";
  if (on("gameover")) return "over";
  return "play";
}
function gpClearFocus(){
  for (const e of document.querySelectorAll(".gp-focus")) e.classList.remove("gp-focus");
}
// Menu focus is shared by the gamepad and the keyboard, because plenty of
// TV boxes deliver a d-pad as arrow-key events rather than through the
// Gamepad API. Either input drives the same three calls below.
let UI_FOCUS=false;
function uiList(){ return GP_ITEMS[gpScreen()]||null; }
// whenever the screen changes, selection goes back to the first item —
// this has to happen for keyboard users too, not just when a pad is plugged in
function uiSync(){
  const scr=gpScreen();
  if (scr!==GP.lastScreen){ GP.lastScreen=scr; GP.focus=0; }
}
function gpApplyFocus(){
  uiSync();
  gpClearFocus();
  const list=uiList();
  if (!list || !UI_FOCUS) return;
  GP.focus=clamp(GP.focus,0,list.length-1);
  const el=document.getElementById(list[GP.focus]);
  if (el) el.classList.add("gp-focus");
  updateStar();
  if (el && el.id==="airJet") setPlane("jet");
  else if (el && el.id==="airBiplane") setPlane("biplane");
}
function uiNav(stepBy){
  uiSync();
  const list=uiList(); if (!list) return;
  const first=!UI_FOCUS;
  UI_FOCUS=true;
  if (!first && list.length>1) GP.focus=(GP.focus+stepBy+list.length)%list.length;
  gpApplyFocus();
  try{ beep(660,.05,"square",.03); }catch(e){}
}
function uiActivate(){
  uiSync();
  const list=uiList(); if (!list) return;
  UI_FOCUS=true;
  const el=document.getElementById(list[GP.focus]);
  if (el) el.click();
  gpApplyFocus();
}
function uiBack(){ const sc=gpScreen(); if (sc==="pause") resumeGame(); else if (sc!=="home") goHome(); }
let lastKeyCode="";
function gpChip(){
  const c=document.getElementById("padChip");
  if (!c) return;
  if (GP.idx===null){
    c.textContent = lastKeyCode ? ("Key: "+lastKeyCode) : "No controller";
    c.classList.toggle("live",!!lastKeyCode);
    return;
  }
  c.classList.add("live");
  const nm=(GP.id||"Controller").replace(/\s*\(.*?\)\s*/g,"").trim().slice(0,22)||"Controller";
  c.textContent=nm+(GP.lastBtn?"  \u00b7  "+GP.lastBtn:"");
}
function gpEdge(name,val){
  const was=GP.prev[name]||false;
  GP.prev[name]=val;
  return val && !was;
}

function pollGamepad(){
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];

  // adopt the first pad that shows up; drop it if it goes away
  if (GP.idx===null){
    for (let i=0;i<pads.length;i++){
      if (pads[i]){ GP.idx=i; GP.id=pads[i].id||"Controller"; GP.focus=0; UI_FOCUS=true; gpChip(); gpApplyFocus(); break; }
    }
  }
  const gp = GP.idx===null ? null : pads[GP.idx];
  if (!gp){
    if (GP.idx!==null){ GP.idx=null; GP.id=""; GP.lastBtn=""; gpChip(); gpClearFocus(); }
    return;
  }

  // ---- directions: d-pad buttons OR stick axes, whichever the pad reports
  const b=gp.buttons, DEAD=.45;
  const ax=gp.axes[0]||0, ay=gp.axes[1]||0;
  let up    = !!(b[12]&&b[12].pressed) || ay<-DEAD;
  let down  = !!(b[13]&&b[13].pressed) || ay> DEAD;
  let left  = !!(b[14]&&b[14].pressed) || ax<-DEAD;
  let right = !!(b[15]&&b[15].pressed) || ax> DEAD;
  // some pads expose the d-pad as a hat on axis 9 instead. Centred reads as
  // ~3.29 (out of range), so only decode genuine -1..1 values, never a bare 0.
  const hat=gp.axes[9];
  if (typeof hat==="number" && hat!==0 && hat>=-1.01 && hat<=1.01){
    const d=Math.round((hat+1)/0.2857);
    if (d===7||d===0||d===1) up=true;
    if (d>=1&&d<=3) right=true;
    if (d>=3&&d<=5) down=true;
    if (d>=5&&d<=7) left=true;
  }
  // secondary stick, in case the d-pad landed on axes 2/3
  const ax2=gp.axes[2]||0, ay2=gp.axes[3]||0;
  if (ax2<-DEAD) left=true;  if (ax2>DEAD) right=true;
  if (ay2<-DEAD) up=true;    if (ay2>DEAD) down=true;

  // ---- any face button confirms / acts; Start too
  const face  = !!(b[0]&&b[0].pressed)||!!(b[1]&&b[1].pressed)||
                !!(b[2]&&b[2].pressed)||!!(b[3]&&b[3].pressed);
  const startB= !!(b[9]&&b[9].pressed)||!!(b[11]&&b[11].pressed);
  const selB  = !!(b[8]&&b[8].pressed)||!!(b[10]&&b[10].pressed);

  // ---- live readout, so an unmapped pad can still be diagnosed
  let pressed="";
  for (let i=0;i<b.length;i++) if (b[i]&&b[i].pressed){ pressed="btn "+i; break; }
  if (!pressed){
    if (Math.abs(ax)>DEAD) pressed="axis0 "+ax.toFixed(1);
    else if (Math.abs(ay)>DEAD) pressed="axis1 "+ay.toFixed(1);
  }
  if (pressed!==GP.lastBtn){ GP.lastBtn=pressed; gpChip(); }

  const screen=gpScreen();
  if (screen!==GP.lastScreen){ GP.lastScreen=screen; GP.focus=0; gpApplyFocus(); }

  // ================================================ menus
  if (screen!=="play"){
    // never let a held direction leak into the next round
    keys.delete("ArrowUp"); keys.delete("ArrowDown");
    keys.delete("ArrowLeft"); keys.delete("ArrowRight");

    // evaluate every edge first: || would short-circuit and desync the rest
    const eR=gpEdge("navRight",right), eD=gpEdge("navDown",down);
    const eL=gpEdge("navLeft",left),   eU=gpEdge("navUp",up);
    const eSR=gpEdge("navShR",!!(b[5]&&b[5].pressed));
    const eSL=gpEdge("navShL",!!(b[4]&&b[4].pressed));
    const eC=gpEdge("confirm",face), eS=gpEdge("startBtn",startB);
    const eB=gpEdge("back",selB);

    if (eR||eD||eSR) uiNav(1);
    else if (eL||eU||eSL) uiNav(-1);
    if (eC||eS) uiActivate();
    if (eB) uiBack();
    gpEdge("face",face);
    gpEdge("pausePlay",startB);   // so a Start still held on entry doesn't pause the new round
    gpEdge("selPlay",selB);
    return;
  }

  // ================================================ gameplay
  gpApplyFocus();   // clears the ring once a round is running
  if (up)    keys.add("ArrowUp");    else keys.delete("ArrowUp");
  if (down)  keys.add("ArrowDown");  else keys.delete("ArrowDown");
  if (left)  keys.add("ArrowLeft");  else keys.delete("ArrowLeft");
  if (right) keys.add("ArrowRight"); else keys.delete("ArrowRight");

  if (face && !GP.prev.face) actionDown();
  if (!face && GP.prev.face) actionUp();
  GP.prev.face=face;

  if (gpEdge("pausePlay",startB)) togglePause();
  if (gpEdge("selPlay",selB)){
    audioOn=!audioOn;
    const btn=document.getElementById("soundBtn");
    btn.textContent="Sound: "+(audioOn?"on":"off");
    btn.setAttribute("aria-pressed",String(audioOn));
  }
  // keep menu edges primed so they don't fire the moment a round ends
  gpEdge("navRight",right); gpEdge("navDown",down);
  gpEdge("navLeft",left);   gpEdge("navUp",up);
  gpEdge("confirm",face);   gpEdge("startBtn",startB);
  gpEdge("back",selB);
}
window.addEventListener("gamepadconnected",e=>{
  GP.idx=e.gamepad.index; GP.id=e.gamepad.id||"Controller"; GP.focus=0; UI_FOCUS=true;
  gpChip(); gpApplyFocus();
});
window.addEventListener("gamepaddisconnected",e=>{
  if (e.gamepad.index===GP.idx){ GP.idx=null; GP.id=""; GP.lastBtn=""; gpChip(); gpClearFocus(); }
});
addEventListener("keydown",e=>{
  // On menus the arrows move the selection instead of a character. TV remotes
  // and many Android pads send exactly these, so this is the path they use.
  lastKeyCode=e.code; gpChip();
  if (gpScreen()!=="play"){
    const c=e.code;
    if (c==="ArrowRight"||c==="ArrowDown"||c==="KeyD"||c==="KeyS"){ uiNav(1);  e.preventDefault(); return; }
    if (c==="ArrowLeft" ||c==="ArrowUp"  ||c==="KeyA"||c==="KeyW"){ uiNav(-1); e.preventDefault(); return; }
    if (c==="Enter"||c==="NumpadEnter"||c==="Space"){ uiActivate(); e.preventDefault(); return; }
    if (c==="Escape"||c==="Backspace"){ uiBack(); e.preventDefault(); return; }
    return;
  }
  if (e.code==="Escape"||e.code==="KeyP"||e.code==="Backspace"){ togglePause(); e.preventDefault(); return; }
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code)) e.preventDefault();
  if (e.code==="Space" && !keys.has("Space")) actionDown();
  keys.add(e.code);
});
addEventListener("keyup",e=>{ keys.delete(e.code); if (e.code==="Space") actionUp(); });
function canvasPos(e){
  const r=cv.getBoundingClientRect();
  return { x:(e.clientX-r.left)*(W/r.width), y:(e.clientY-r.top)*(H/r.height) };
}
cv.addEventListener("pointerdown",e=>{
  e.preventDefault(); cv.setPointerCapture(e.pointerId);
  const p=canvasPos(e);
  if (MODE==="flap"||MODE==="paddle"||MODE==="air"){ actionDown(); return; }
  if (MODE==="tita"){ pointer={down:true,x:p.x,y:p.y}; actionDown(); return; }
  if (G && G.carry.length && Math.hypot(p.x-THROW_BTN.x,p.y-THROW_BTN.y)<THROW_BTN.r){
    pointer={down:false,x:p.x,y:p.y}; startCharge(); return;
  }
  pointer={down:true,x:p.x,y:p.y};
});
cv.addEventListener("pointermove",e=>{ if(!pointer.down) return; const p=canvasPos(e); pointer.x=p.x; pointer.y=p.y; });
cv.addEventListener("pointerup",()=>{ pointer.down=false; actionUp(); });
cv.addEventListener("pointercancel",()=>{ pointer.down=false; actionUp(); });

let MODE="ballies";
function actionDown(){
  if (MODE==="tita") titaShoo();
  else if (MODE==="flap") flapJump();
  else if (MODE==="paddle") pStroke();
  else if (MODE==="air") airFire();
  else startCharge();
}
function actionUp(){ if (MODE==="ballies") releaseCharge(); else if (MODE==="air" && A) A.firing=false; }

function startCharge(){
  if (!G || !G.running || !G.carry.length) return;
  if (dist(G.dog,G.player) < SAFE_DIST){
    if (G.nagCool<=0){
      toast("TOO CLOSE \u2014 RUN!","#ff6a5e");
      G.nagCool=1.1; G.dog.bark={text:"Nope.",life:.8};
    }
    return;
  }
  G.charging=true; G.power=0;
}
function releaseCharge(){ if (!G||!G.charging) return; G.charging=false; throwVolley(G.power); }

// ---------------------------------------------------------------- fx helpers
function toast(text,color,x,y){
  G.toasts.push({ text,color, x:x!==undefined?x:G.player.x, y:y!==undefined?y:G.player.y-46, life:1.1 });
}
function burst(x,y,color,n){
  n=n||16;
  for(let i=0;i<(n);i++){
    const a=rand(0,Math.PI*2), s=rand(50,220);
    G.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.3,.7),color,r:rand(2.4,4.4)});
  }
}
function sparkle(x,y,color,n){
  n=n||8;
  for(let i=0;i<n;i++){
    const a=rand(0,Math.PI*2), s=rand(20,90);
    G.sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-40,life:rand(.4,.8),color,sz:rand(4,9)});
  }
}

// ---------------------------------------------------------------- balls
function newBall(x,y,kind){
  return { x,y,z:0,kind,spin:rand(0,6),arcs:[],mode:"loose",trail:[],val:0,age:0 };
}
function launch(b,tx,ty,dur,height,mode,then){
  b.arcs=[{sx:b.x,sy:b.y,tx,ty,dur,height,t:0}];
  if (mode!=="bank"){
    const bp=clearSpot(tx+(tx-b.x)*.05,ty+(ty-b.y)*.05,14);
    b.arcs.push({sx:tx,sy:ty,tx:bp.x,ty:bp.y,dur:.3,height:height*.15,t:0});
  }
  b.mode=mode; b.onArrive=then||null;
}
// your friend keeps feeding new balls into the yard
function npcServe(){
  const n=G.npc;
  const t=clearSpot(rand(FIELD.x0+70,FIELD.x1-70), rand(H*.42,FIELD.y1-50), 26);
  const b=newBall(n.x,n.y-8,rollKind());
  launch(b,t.x,t.y,1.05,185,"flight",null);
  G.balls.push(b);
  n.windup=.35; n.wave=1;
  sfx.throw();
}
// hurl the whole armful back to bank it
function throwVolley(power){
  const n=G.npc, held=G.carry.slice();
  if (!held.length) return;
  G.carry.length=0;
  sfx.throw();
  const d=Math.abs(power-SWEET);
  let mult, label, col;
  if (d<=SWEET_W){ mult=2; label="PERFECT"; col="#ffe07a"; sfx.perfect(); }
  else if (d<=OK_W){ mult=1; label="NICE"; col="#dff7c8"; }
  else { mult=0; label = power<SWEET ? "SHORT!" : "OVERCOOKED!"; col="#ff6a5e"; }

  held.forEach((kind,i)=>{
    const b=newBall(G.player.x,G.player.y-4,kind);
    b.spin=rand(0,6);
    if (mult>0){
      b.val=KINDS[kind].value*mult;
      const off=(i-(held.length-1)/2)*26;
      launch(b,n.x+off,n.y-6,.8+i*.06,205,"bank",null);
    } else {
      const t=clearSpot(clamp(G.player.x+rand(-230,230),FIELD.x0+40,FIELD.x1-40),
                        lerp(G.player.y,n.y,rand(.25,.6)),26);
      launch(b,t.x,t.y,.9,130,"flight",null);
    }
    G.balls.push(b);
  });
  toast(label+(mult===2?" x2":""),col);
  if (mult>0 && held.length===CARRY_MAX){
    G.score+=40; toast("FULL ARMS +40","#ffcf3a",G.player.x,G.player.y-72);
  }
  G.dog.bark={text:"Hey!",life:.9};
}
function bankBall(b){
  const m=comboHit(G,b.x,b.y,(t,c,x,y)=>toast(t,c,x,y));
  const gained=b.val*m;
  G.score+=gained; G.banked++;
  if (m>1) G.toasts.push({text:"x"+m,color:"#9be5ff",x:b.x+30,y:b.y-40,life:.9});
  G.bestVolley=Math.max(G.bestVolley,b.val);
  G.npc.wave=1;
  burst(b.x,b.y,KINDS[b.kind].rim,12);
  sparkle(b.x,b.y,"#ffe07a",6);
  G.toasts.push({text:"+"+b.val,color:KINDS[b.kind].rim,x:b.x,y:b.y-24,life:1.1});
}

// ---------------------------------------------------------------- hazards
function stepInIt(q){
  q.cool=2.4;
  const p=G.player;
  p.slow=.9;
  toast(["EWWW!","OH COME ON","NOT AGAIN"][Math.floor(rand(0,3))],"#c08a3e");
  sfx.squish();
  burst(p.x,p.y+8,"#7a5a30",9);
  if (G.carry.length){                       // you fumble one
    const kind=G.carry.pop();
    const t=clearSpot(p.x+rand(-60,60),p.y+rand(-40,60),20);
    const b=newBall(p.x,p.y-6,kind);
    launch(b,t.x,t.y,.5,60,"flight",null);
    G.balls.push(b);
  }
}
function lauraShoos(){
  const p=G.player;
  p.shooCool=2.6;
  if (!REDUCED) G.shake=11;
  G.flash=.45; G.flashCol="227,95,160";
  sfx.broom();
  G.laura.bark={text:["Off my flowers!","Shoo! Shoo!","Play out there!"][Math.floor(rand(0,3))],life:1.9};
  G.laura.mode="returning";
  if (G.carry.length){                       // she confiscates the lot
    toast("SHE TOOK THEM ALL","#ff8fc4");
    G.carry.forEach((kind,i)=>{
      const t=clearSpot(rand(FIELD.x0+80,FIELD.x1-80),rand(H*.42,H*.68),24);
      const b=newBall(p.x,p.y-6,kind);
      launch(b,t.x,t.y,.85,150,"flight",null);
      G.balls.push(b);
    });
    G.carry.length=0;
  } else toast("SHOOED!","#ff8fc4");
}
function dogTakes(b){
  G.stolen++; comboBreak(G);
  G.dog.hasBall=b.kind; G.dog.carryT=3.2; G.dog.gloat=2.2;   // he sits and shows it off
  b.dead=true;
  if (!REDUCED) G.shake=13;
  G.flash=.45; G.flashCol="224,58,47";
  sfx.bark();
  burst(b.x,b.y,"#e03a2f",20);
  G.dog.bark={text:["MINE!","Got it!","Woof!"][Math.floor(rand(0,3))],life:1.4};
  if (G.stolen>=STEAL_LIMIT) endGame("Bernard cleaned you out");
}
function dogRobsPlayer(){
  const kind=G.carry.reduce((best,k)=>KINDS[k].value>KINDS[best].value?k:best,G.carry[0]);
  G.carry.splice(G.carry.indexOf(kind),1);
  G.stolen++; comboBreak(G);
  G.dog.hasBall=kind; G.dog.carryT=3.2; G.dog.delay=.6; G.dog.gloat=2.2;
  if (!REDUCED) G.shake=13;
  G.flash=.45; G.flashCol="224,58,47";
  sfx.bark();
  toast("HE GOT THE "+KINDS[kind].label+"!","#ff6a5e");
  burst(G.player.x,G.player.y,"#e03a2f",20);
  G.dog.bark={text:["MINE!","Got it!","Woof!"][Math.floor(rand(0,3))],life:1.4};
  if (G.stolen>=STEAL_LIMIT) endGame("Bernard cleaned you out");
}

// ---------------------------------------------------------------- update
function confettiBurst(){
  const cols=["#ffcf3a","#b6f23a","#ff8fc4","#6fd0ff","#fff6c9","#f0472f"];
  for(let i=0;i<120;i++){
    G.confetti.push({
      x:rand(0,W), y:rand(-260,-10),
      vx:rand(-46,46), vy:rand(70,230),
      sz:rand(6,13), rot:rand(0,6.3), vr:rand(-7,7),
      col:cols[Math.floor(rand(0,cols.length))], life:rand(2.4,4.6)
    });
  }
}
function winRound(){
  if (!G.running) return;
  G.won=true; G.winFx=1.4;
  confettiBurst();
  sfx.win();
  endGame("You out-fetched him");
}
function endGame(reason){
  if (!G.running) return;
  G.running=false; G.charging=false;
  if (!G.won) sfx.over();
  if (G.score>G.best){ G.best=G.score; saveBest(G.best); }

  const over=document.getElementById("gameover");
  over.classList.remove("won","lost");
  over.classList.add(G.won?"won":"lost");
  document.getElementById("overShot").style.backgroundImage = PHOTO_BERNARD;

  let title, line;
  if (G.won){
    title="You beat Bernard!";
    line="You banked "+G.score+" points from "+G.banked+" balls and cleared the "+
         WIN_SCORE+"-point mark with "+Math.ceil(G.timeLeft)+"s to spare. "+
         "He kept "+G.stolen+". Best so far: "+G.best+".";
  } else if (G.stolen>=STEAL_LIMIT){
    title="Bernard wins";
    line=reason+" \u2014 you banked "+G.banked+" balls for "+G.score+" points, "+
         (WIN_SCORE-G.score)+" short of beating him. Best so far: "+G.best+".";
  } else {
    title="Time!";
    const gap=WIN_SCORE-G.score;
    line=reason+" \u2014 you banked "+G.banked+" balls for "+G.score+" points"+
         (gap>0?", "+gap+" short of beating Bernard":"")+". Best so far: "+G.best+".";
  }
  document.getElementById("overTitle").textContent=title;
  document.getElementById("finalLine").textContent=line;
  over.classList.add("on");
}
function loadBest(){ try{ const v=+localStorage.getItem("ballies_best"); if(v&&G) G.best=v; }catch(e){} }
function saveBest(v){ try{ localStorage.setItem("ballies_best",String(v)); }catch(e){} }

function update(dt){
  if (!G) return;
  pollGamepad();
  G.t+=dt; G.pulse+=dt*3.4;
  comboTick(G,dt);
  G.dog.gloat=Math.max(0,(G.dog.gloat||0)-dt);
  G.dog.mood = G.dog.hasBall ? "happy" : undefined;
  G.shake=Math.max(0,G.shake-dt*30);
  G.flash=Math.max(0,G.flash-dt*1.7);
  for (const t of G.toasts){ t.y-=dt*36; t.life-=dt*.85; }
  G.toasts=G.toasts.filter(t=>t.life>0);
  for (const q of G.particles){ q.x+=q.vx*dt; q.y+=q.vy*dt; q.vx*=.94; q.vy*=.94; q.life-=dt; }
  G.particles=G.particles.filter(q=>q.life>0);
  for (const q of G.sparks){ q.x+=q.vx*dt; q.y+=q.vy*dt; q.vy+=110*dt; q.life-=dt; }
  G.sparks=G.sparks.filter(q=>q.life>0);
  for (const c of G.confetti){
    c.x+=c.vx*dt; c.y+=c.vy*dt; c.vy+=52*dt; c.vx*=.995;
    c.rot+=c.vr*dt; c.life-=dt;
  }
  G.confetti=G.confetti.filter(c=>c.life>0 && c.y<H+40);
  G.winFx=Math.max(0,G.winFx-dt);
  if (!G.running) return;

  // ---- you beat him the moment you clear the mark
  if (G.score>=WIN_SCORE){ winRound(); return; }

  G.timeLeft-=dt;
  if (G.timeLeft<=0){ G.timeLeft=0; endGame("The round ran out"); return; }
  G.nagCool=Math.max(0,G.nagCool-dt);

  // ---- charge meter
  if (G.charging){
    G.power+=dt/CHARGE_TIME;
    if (G.power>=1){ G.power=1; G.charging=false; throwVolley(1.4); }
  }

  // ---- player
  const p=G.player;
  if (!G.charging){
    let dx=0,dy=0;
    if (keys.has("ArrowLeft")||keys.has("KeyA"))  dx-=1;
    if (keys.has("ArrowRight")||keys.has("KeyD")) dx+=1;
    if (keys.has("ArrowUp")||keys.has("KeyW"))    dy-=1;
    if (keys.has("ArrowDown")||keys.has("KeyS"))  dy+=1;
    if (pointer.down){
      const ax=pointer.x-p.x, ay=pointer.y-p.y;
      if (Math.hypot(ax,ay)>12){ dx=ax; dy=ay; }
    }
    const L=Math.hypot(dx,dy);
    const spd=PLAYER_SPEED*(p.slow>0?.4:1)*(1-G.carry.length*.045);
    if (L>0){
      p.x+=dx/L*spd*dt; p.y+=dy/L*spd*dt;
      p.face=Math.atan2(dy,dx); p.step+=dt*(p.slow>0?5:11);
    }
    p.x=clamp(p.x,FIELD.x0+p.r,FIELD.x1-p.r);
    p.y=clamp(p.y,FIELD.y0+p.r,FIELD.y1-p.r);
    pushOut(p);
  }
  p.slow=Math.max(0,p.slow-dt);
  p.shooCool=Math.max(0,p.shooCool-dt);
  for (const q of POOPS){
    q.cool=Math.max(0,q.cool-dt);
    if (q.cool<=0 && Math.hypot(p.x-q.x,p.y-q.y)<q.r+p.r-6) stepInIt(q);
  }

  // ---- balls
  G.spawnT-=dt;
  const loose=G.balls.filter(b=>!b.dead && b.mode!=="bank").length;
  if (G.spawnT<=0 && loose<MAX_LOOSE && G.npc.windup<=0){ npcServe(); G.spawnT=SPAWN_EVERY; }

  for (const b of G.balls){
    if (b.dead) continue;
    b.age+=dt;
    if (b.arcs.length){
      const a=b.arcs[0]; a.t+=dt/a.dur;
      const t=clamp(a.t,0,1);
      b.x=lerp(a.sx,a.tx,t); b.y=lerp(a.sy,a.ty,t); b.z=Math.sin(Math.PI*t)*a.height;
      b.spin+=dt*15;
      if (a.t>=1){
        b.arcs.shift();
        if (!b.arcs.length){
          b.z=0;
          if (b.mode==="bank"){ bankBall(b); b.dead=true; }
          else b.mode="loose";
        }
      }
    }
    b.trail.push({x:b.x,y:b.y-b.z,life:1});
    if (b.trail.length>14) b.trail.shift();
    for (const s of b.trail) s.life-=dt*3.4;
    b.trail=b.trail.filter(s=>s.life>0);

    // pick-ups
    if (b.mode!=="bank" && !b.dead){
      if (G.carry.length<CARRY_MAX && b.z<70 && Math.hypot(p.x-b.x,p.y-b.y)<p.r+15){
        G.carry.push(b.kind); b.dead=true;
        sfx.pick(b.kind);
        sparkle(b.x,b.y,KINDS[b.kind].rim,7);
        G.toasts.push({text:KINDS[b.kind].label,color:KINDS[b.kind].rim,x:b.x,y:b.y-22,life:.8});
      }
    }
  }
  G.balls=G.balls.filter(b=>!b.dead);

  // ---- friend by the wall
  const n=G.npc;
  n.wave=Math.max(0,n.wave-dt*1.6);
  n.windup=Math.max(0,n.windup-dt);
  {
    const ax=n.hx-n.x, ay=n.hy-n.y, L=Math.hypot(ax,ay);
    if (L>4){ n.x+=ax/L*NPC_SPEED*dt; n.y+=ay/L*NPC_SPEED*dt; n.step+=dt*10; n.face=Math.atan2(ay,ax); }
  }

  // ---- Bernard
  const d=G.dog;
  d.wag+=dt*(6+G.banked*.15);
  if (d.bark){ d.bark.life-=dt; if (d.bark.life<=0) d.bark=null; }
  d.delay=Math.max(0,d.delay-dt);
  d.carryT=Math.max(0,d.carryT-dt);
  if (d.carryT<=0) d.hasBall=null;

  let target=null, speed=dogSpeed();
  if (d.hasBall && d.gloat>0){
    target=null;                                          // sits and gloats
    d.phase+=dt*3;
  } else if (d.hasBall){
    const ang=G.t*2.3;
    target={ x:W/2+Math.cos(ang)*250, y:(FIELD.y0+FIELD.y1)/2+Math.sin(ang)*135 };
    speed=236;
  } else if (G.carry.length && dist(d,p)<300){
    target={x:p.x,y:p.y}; speed*=.86;                    // he comes for your armful
  } else {
    let best=null,bd=1e9;
    for (const b of G.balls){
      if (b.mode==="bank") continue;
      const a=b.arcs[0];
      const tx=a?a.tx:b.x, ty=a?a.ty:b.y;
      const dd=Math.hypot(tx-d.x,ty-d.y);
      if (dd<bd){ bd=dd; best={x:tx,y:ty}; }
    }
    target = best || {x:p.x,y:p.y};
    if (!best) speed*=.8;
  }
  if (target && d.delay<=0){
    const ax=target.x-d.x, ay=target.y-d.y, L=Math.hypot(ax,ay);
    if (L>2){ d.x+=ax/L*speed*dt; d.y+=ay/L*speed*dt; d.face=Math.atan2(ay,ax); d.phase+=dt*13; }
    d.x=clamp(d.x,FIELD.x0+d.r,FIELD.x1-d.r);
    d.y=clamp(d.y,FIELD.y0+d.r,FIELD.y1-d.r);
    pushOut(d);
  }
  if (!d.hasBall && d.delay<=0){
    if (G.carry.length && dist(d,p)<d.r+p.r+4) dogRobsPlayer();
    else {
      for (const b of G.balls){
        if (b.mode==="bank"||b.dead) continue;
        if (b.z<78 && Math.hypot(d.x-b.x,d.y-b.y)<d.r+16){ dogTakes(b); break; }
      }
      G.balls=G.balls.filter(b=>!b.dead);
    }
  }

  // ---- Laura
  const la=G.laura;
  la.sweep+=dt*7;
  if (la.bark){ la.bark.life-=dt; if (la.bark.life<=0) la.bark=null; }
  const nearDoor=Math.hypot(p.x-DOOR.x,p.y-DOOR.y);
  if (la.mode==="inside"){
    la.x=DOOR.x; la.y=DOOR.y;
    if (nearDoor<DOOR_R){
      la.warn+=dt;
      if (la.warn>.9){
        la.mode="out"; la.patience=7;
        la.bark={text:"Hey! Not by the house!",life:2.2};
        beep(520,.12,"square",.045);
      }
    } else la.warn=Math.max(0,la.warn-dt*.8);
  } else if (la.mode==="out"){
    la.patience-=dt;
    const ax=p.x-la.x, ay=p.y-la.y, L=Math.hypot(ax,ay);
    if (L>3){ la.x+=ax/L*LAURA_SPEED*dt; la.y+=ay/L*LAURA_SPEED*dt; la.step+=dt*9; }
    if (L<la.r+p.r+8 && p.shooCool<=0) lauraShoos();
    if (la.patience<=0 || nearDoor>DOOR_R*1.9) la.mode="returning";
  } else {
    const ax=DOOR.x-la.x, ay=DOOR.y-la.y, L=Math.hypot(ax,ay);
    if (L>4){ la.x+=ax/L*LAURA_SPEED*.8*dt; la.y+=ay/L*LAURA_SPEED*.8*dt; la.step+=dt*7; }
    else { la.mode="inside"; la.warn=0; }
  }
}

// ---------------------------------------------------------------- backdrop
const bg=document.createElement("canvas"); bg.width=W; bg.height=H;
const bx=bg.getContext("2d");
function seeded(n){ let s=n; return ()=>((s=(s*9301+49297)%233280)/233280); }

function glossyBrick(c,x0,y0,w,h){
  const g=c.createLinearGradient(0,y0,0,y0+h);
  g.addColorStop(0,"#c99873"); g.addColorStop(.5,"#ab7a58"); g.addColorStop(1,"#8a5c3e");
  c.fillStyle=g; c.fillRect(x0,y0,w,h);
  c.strokeStyle="rgba(255,255,255,.13)"; c.lineWidth=1;
  for (let y=y0+5;y<y0+h;y+=6){ c.beginPath(); c.moveTo(x0,y); c.lineTo(x0+w,y); c.stroke(); }
  c.strokeStyle="rgba(70,38,26,.2)";
  let row=0;
  for (let y=y0+5;y<y0+h;y+=6){
    const off=(row++%2)?0:12;
    for (let x=x0+off;x<x0+w;x+=24){ c.beginPath(); c.moveTo(x,y-6); c.lineTo(x,y); c.stroke(); }
  }
}
function stoneCap(c,x,y,w,h){
  const g=c.createLinearGradient(0,y,0,y+h);
  g.addColorStop(0,"#fdf6e2"); g.addColorStop(.45,"#ddd0b2"); g.addColorStop(1,"#b3a488");
  c.fillStyle=g; c.beginPath(); c.roundRect(x,y,w,h,3); c.fill();
}
function tuft(c,x,y,s,col){
  c.strokeStyle=col; c.lineWidth=2.2*s; c.lineCap="round";
  for (const dx of [-4,0,4]){
    c.beginPath(); c.moveTo(x+dx*s,y); c.quadraticCurveTo(x+dx*s*1.5,y-5*s,x+dx*s*2.1,y-9*s); c.stroke();
  }
}
function bush(c,x,y,s){
  softShadow(c,x+5,y+5,20*s,9*s,.3);
  for (const [dx,dy,r,l,dk] of [[-11,0,13,"#63b93c","#2f7a23"],[11,1,12,"#59ad35","#28691e"],[0,-8,15,"#79d24a","#3a8c28"]]){
    const g=c.createRadialGradient(x+dx*s-r*.4*s,y+dy*s-r*.5*s,r*.1*s,x+dx*s,y+dy*s,r*1.05*s);
    g.addColorStop(0,l); g.addColorStop(1,dk);
    c.fillStyle=g; c.beginPath(); c.arc(x+dx*s,y+dy*s,r*s,0,Math.PI*2); c.fill();
  }
}
function chairArt(c,ch){
  c.save(); c.translate(ch.x,ch.y);
  softShadow(c,10,10,24,13,.34);
  c.rotate(ch.a);
  const back=c.createLinearGradient(0,-24,0,6);
  back.addColorStop(0,"#f4ead2"); back.addColorStop(1,"#c4b493");
  c.fillStyle=back;
  c.beginPath(); c.moveTo(-15,-4); c.quadraticCurveTo(0,-26,15,-4); c.lineTo(11,5); c.lineTo(-11,5); c.closePath(); c.fill();
  c.strokeStyle="rgba(120,100,70,.5)"; c.lineWidth=1.5;
  for (let i=-2;i<=2;i++){ c.beginPath(); c.moveTo(i*5.4,4); c.lineTo(i*6.8,-16+Math.abs(i)*3.6); c.stroke(); }
  const seat=c.createLinearGradient(0,3,0,20);
  seat.addColorStop(0,"#fff6e2"); seat.addColorStop(1,"#cbbb99");
  c.fillStyle=seat; c.beginPath(); c.roundRect(-12,3,24,17,4); c.fill();
  c.strokeStyle="rgba(120,100,70,.4)";
  for (let i=0;i<3;i++){ c.beginPath(); c.moveTo(-11,8+i*4); c.lineTo(11,8+i*4); c.stroke(); }
  c.fillStyle="#d6c7a5";
  c.beginPath(); c.roundRect(-18,2,6,16,3); c.fill();
  c.beginPath(); c.roundRect(12,2,6,16,3); c.fill();
  c.restore();
}

function bakeBackground(){
  const R=seeded(20260808);

  // sky
  const sky=bx.createLinearGradient(0,0,0,120);
  sky.addColorStop(0,"#2f8fd8"); sky.addColorStop(.55,"#77bfe8"); sky.addColorStop(1,"#cfeaf6");
  bx.fillStyle=sky; bx.fillRect(0,0,W,120);

  // neighbourhood roofs
  for (let rank=1;rank>=0;rank--){
    const baseY=rank?60:80, h=rank?16:27;
    let x=-40;
    while(x<W+50){
      const w=44+R()*46;
      const g=bx.createLinearGradient(0,baseY-h,0,baseY);
      if (rank){ g.addColorStop(0,"#b9b6b2"); g.addColorStop(1,"#918e8a"); }
      else { g.addColorStop(0,"#9d9a96"); g.addColorStop(1,"#726f6c"); }
      bx.fillStyle=g;
      bx.beginPath();
      bx.moveTo(x,baseY); bx.lineTo(x+w*.3,baseY-h-R()*7);
      bx.lineTo(x+w*.7,baseY-h-R()*7); bx.lineTo(x+w,baseY); bx.closePath(); bx.fill();
      bx.fillStyle="rgba(255,255,255,.2)"; bx.fillRect(x+w*.3,baseY-h-2,w*.4,2);
      if (!rank&&R()>.78){ bx.fillStyle="#a8735c"; bx.fillRect(x+w*.55,baseY-h-10,6,10); }
      x+=w*.8;
    }
  }
  // far wall + road
  glossyBrick(bx,0,82,W,16);
  stoneCap(bx,0,79,W,4);
  bx.fillStyle="#7fa84e"; bx.fillRect(0,98,W,10);
  const road=bx.createLinearGradient(0,108,0,146);
  road.addColorStop(0,"#e2e2dc"); road.addColorStop(1,"#c2c2bc");
  bx.fillStyle=road; bx.fillRect(0,108,W,38);
  bx.strokeStyle="rgba(120,120,112,.5)"; bx.lineWidth=1;
  for (let x=0;x<W;x+=96){ bx.beginPath(); bx.moveTo(x,108); bx.lineTo(x,146); bx.stroke(); }
  bx.beginPath(); bx.moveTo(0,127); bx.lineTo(W,127); bx.stroke();
  bx.fillStyle="#a35a4e"; bx.fillRect(286,113,206,12);
  bx.fillStyle="rgba(255,255,255,.2)"; bx.fillRect(286,113,206,2);
  bx.fillStyle="#f6f6f0";
  for (let x=16;x<W;x+=78) bx.fillRect(x,143,46,3);
  bx.fillStyle="#84ac52"; bx.fillRect(0,146,W,10);

  // little trees along the verge
  for (const tx of [70,196,330,468,604,742,862]){
    bx.strokeStyle="#7a5f3c"; bx.lineWidth=3; bx.lineCap="round";
    bx.beginPath(); bx.moveTo(tx,152); bx.lineTo(tx,138); bx.stroke();
    for (const [dx,dy,r,l,dk] of [[0,-22,11,"#7fd44e","#39892a"],[-7,-15,8,"#6cc340","#2f7a23"],[7,-16,8.5,"#6cc340","#2f7a23"]]){
      const g=bx.createRadialGradient(tx+dx-r*.4,152+dy-r*.5,r*.1,tx+dx,152+dy,r*1.05);
      g.addColorStop(0,l); g.addColorStop(1,dk);
      bx.fillStyle=g; bx.beginPath(); bx.arc(tx+dx,152+dy,r,0,Math.PI*2); bx.fill();
    }
  }

  // the back yard wall
  glossyBrick(bx,0,CAP_TOP+9,W,WALL_BOTTOM-CAP_TOP-9);
  for (let x=62;x<W+60;x+=142){
    glossyBrick(bx,x-13,CAP_TOP+4,28,WALL_BOTTOM-CAP_TOP-4);
    const sg=bx.createLinearGradient(0,CAP_TOP+20,0,CAP_TOP+44);
    sg.addColorStop(0,"#b4a992"); sg.addColorStop(1,"#847a66");
    bx.fillStyle=sg; bx.beginPath(); bx.roundRect(x-7,CAP_TOP+20,17,24,3); bx.fill();
    bx.fillStyle="rgba(255,255,255,.3)"; bx.fillRect(x-7,CAP_TOP+20,17,4);
    stoneCap(bx,x-17,CAP_TOP-5,38,13);
  }
  stoneCap(bx,0,CAP_TOP,W,10);
  bx.fillStyle="rgba(0,0,0,.2)"; bx.fillRect(0,WALL_BOTTOM-5,W,5);
  const ws=bx.createLinearGradient(0,WALL_BOTTOM,0,WALL_BOTTOM+34);
  ws.addColorStop(0,"rgba(18,52,20,.42)"); ws.addColorStop(1,"rgba(18,52,20,0)");
  bx.fillStyle=ws; bx.fillRect(0,WALL_BOTTOM,W,34);

  // ---- the lawn, lush and saturated
  const lawn=bx.createLinearGradient(0,WALL_BOTTOM,0,H);
  lawn.addColorStop(0,"#3f8a33"); lawn.addColorStop(.45,"#57a83c"); lawn.addColorStop(1,"#3d7f2c");
  bx.fillStyle=lawn; bx.fillRect(0,WALL_BOTTOM,W,H-WALL_BOTTOM);
  const crown=bx.createRadialGradient(440,460,40,440,460,440);
  crown.addColorStop(0,"rgba(140,210,80,.5)"); crown.addColorStop(1,"rgba(140,210,80,0)");
  bx.fillStyle=crown; bx.fillRect(0,WALL_BOTTOM,W,H-WALL_BOTTOM);
  for (let i=0;i<10;i++){
    if (i%2) continue;
    bx.fillStyle="rgba(255,255,255,.045)";
    bx.fillRect(0,WALL_BOTTOM+i*((H-WALL_BOTTOM)/10),W,(H-WALL_BOTTOM)/10);
  }
  // sun-baked patch under the fire pit
  const dry=bx.createRadialGradient(PIT.x-10,PIT.y+50,26,PIT.x-10,PIT.y+50,258);
  dry.addColorStop(0,"rgba(212,190,112,.85)"); dry.addColorStop(.5,"rgba(198,178,108,.5)");
  dry.addColorStop(1,"rgba(198,178,108,0)");
  bx.fillStyle=dry; bx.fillRect(0,WALL_BOTTOM,W,H-WALL_BOTTOM);
  for (let i=0;i<20;i++){
    const x=R()*W,y=WALL_BOTTOM+R()*(H-WALL_BOTTOM),r=16+R()*56;
    bx.fillStyle="rgba(198,182,110,"+(.05+R()*.1)+")";
    bx.beginPath(); bx.ellipse(x,y,r,r*.5,R()*3,0,Math.PI*2); bx.fill();
  }
  // grass tufts for that hand-modelled look
  for (let i=0;i<150;i++){
    const x=R()*W, y=WALL_BOTTOM+14+R()*(H-WALL_BOTTOM-14);
    tuft(bx,x,y,.6+R()*.55, R()>.5?"rgba(120,200,80,.5)":"rgba(46,110,34,.4)");
  }
  // decorative bushes hugging the wall
  for (const bxp of [72,300,830]) bush(bx,bxp,WALL_BOTTOM+16,.85);

  // ---- late-afternoon sun raking in from the left, like Bernard's photo
  const sun=bx.createLinearGradient(0,WALL_BOTTOM,W*.85,H);
  sun.addColorStop(0,"rgba(255,206,116,.30)");
  sun.addColorStop(.42,"rgba(255,196,104,.13)");
  sun.addColorStop(1,"rgba(255,190,96,0)");
  bx.fillStyle=sun; bx.fillRect(0,WALL_BOTTOM,W,H-WALL_BOTTOM);
  // and warming the top of the brick
  const warm=bx.createLinearGradient(0,CAP_TOP-8,0,WALL_BOTTOM);
  warm.addColorStop(0,"rgba(255,214,132,.34)");
  warm.addColorStop(1,"rgba(255,196,104,.05)");
  bx.fillStyle=warm; bx.fillRect(0,CAP_TOP-8,W,WALL_BOTTOM-CAP_TOP+8);
  // long cool shadows stretching off to the right
  const cool=bx.createLinearGradient(W,WALL_BOTTOM,W*.45,H);
  cool.addColorStop(0,"rgba(24,52,60,.22)");
  cool.addColorStop(1,"rgba(24,52,60,0)");
  bx.fillStyle=cool; bx.fillRect(0,WALL_BOTTOM,W,H-WALL_BOTTOM);

  // poop piles
  for (const q of POOPS){
    softShadow(bx,q.x+4,q.y+6,15,7,.34);
    for (const [dx,dy,rx,ry,l,dk] of [[0,3,12,6.5,"#8a6236","#4c3318"],[1,-1.5,9.5,5.5,"#9a7040","#563a1c"],[2,-5.5,7,4.2,"#a87b48","#5f4120"]]){
      const g=bx.createLinearGradient(q.x+dx-rx,q.y+dy-ry,q.x+dx,q.y+dy+ry);
      g.addColorStop(0,l); g.addColorStop(1,dk);
      bx.fillStyle=g; bx.beginPath(); bx.ellipse(q.x+dx,q.y+dy,rx,ry,0,0,Math.PI*2); bx.fill();
    }
    bx.fillStyle="rgba(255,255,255,.22)";
    bx.beginPath(); bx.ellipse(q.x,q.y-7,3.4,2,0,0,Math.PI*2); bx.fill();
  }

  // side fences
  for (const side of [0,1]){
    const x0=side?W-FENCE_W:0;
    const g=bx.createLinearGradient(x0,0,x0+FENCE_W,0);
    if (side){ g.addColorStop(0,"#7d5c34"); g.addColorStop(1,"#a5824f"); }
    else { g.addColorStop(0,"#a5824f"); g.addColorStop(1,"#7d5c34"); }
    bx.fillStyle=g; bx.fillRect(x0,CAP_TOP-6,FENCE_W,H-CAP_TOP+6);
    bx.strokeStyle="rgba(0,0,0,.26)"; bx.lineWidth=1.6;
    for (let x=x0+5;x<x0+FENCE_W;x+=7){ bx.beginPath(); bx.moveTo(x,CAP_TOP-6); bx.lineTo(x,H); bx.stroke(); }
    bx.fillStyle="#c29a5e"; bx.fillRect(x0,CAP_TOP-6,FENCE_W,6);
    bx.fillStyle="rgba(0,0,0,.18)"; bx.fillRect(x0,320,FENCE_W,7);
    const fs=bx.createLinearGradient(side?x0:x0+FENCE_W,0,side?x0-28:x0+FENCE_W+28,0);
    fs.addColorStop(0,"rgba(18,52,20,.34)"); fs.addColorStop(1,"rgba(18,52,20,0)");
    bx.fillStyle=fs; bx.fillRect(side?x0-28:x0+FENCE_W,WALL_BOTTOM,28,H-WALL_BOTTOM);
  }

  // fire pit ring
  for (const ch of CHAIRS) chairArt(bx,ch);
  softShadow(bx,PIT.x+9,PIT.y+10,PIT.r+6,PIT.r*.7,.36);
  const ring=bx.createLinearGradient(0,PIT.y-PIT.r,0,PIT.y+PIT.r);
  ring.addColorStop(0,"#5a5a56"); ring.addColorStop(1,"#2c2c2a");
  bx.fillStyle=ring; bx.beginPath(); bx.ellipse(PIT.x,PIT.y,PIT.r,PIT.r*.64,0,0,Math.PI*2); bx.fill();
  const top=bx.createRadialGradient(PIT.x-10,PIT.y-8,4,PIT.x,PIT.y,PIT.r);
  top.addColorStop(0,"#f5bd6a"); top.addColorStop(1,"#c2842f");
  bx.fillStyle=top; bx.beginPath(); bx.ellipse(PIT.x,PIT.y,PIT.r-5,PIT.r*.64-4,0,0,Math.PI*2); bx.fill();
  bx.strokeStyle="rgba(255,255,255,.25)"; bx.lineWidth=1.5;
  bx.beginPath(); bx.ellipse(PIT.x,PIT.y,PIT.r-11,PIT.r*.64-8,0,0,Math.PI*2); bx.stroke();

  // house roof corner
  softShadow(bx,ROOF.w-30,ROOF.y+70,120,90,.4);
  const rf=bx.createLinearGradient(0,ROOF.y-30,ROOF.w,H);
  rf.addColorStop(0,"#726d67"); rf.addColorStop(1,"#454240");
  bx.fillStyle=rf;
  bx.beginPath(); bx.moveTo(0,ROOF.y-30); bx.lineTo(ROOF.w,ROOF.y+36); bx.lineTo(ROOF.w,H); bx.lineTo(0,H); bx.closePath(); bx.fill();
  bx.strokeStyle="rgba(0,0,0,.24)"; bx.lineWidth=2.4;
  for (let i=0;i<9;i++){
    const o=i*18;
    bx.beginPath(); bx.moveTo(0,ROOF.y-30+o); bx.lineTo(ROOF.w,ROOF.y+36+o); bx.stroke();
  }
  const gut=bx.createLinearGradient(0,ROOF.y-36,0,ROOF.y+44);
  gut.addColorStop(0,"#f2f4ee"); gut.addColorStop(1,"#b9bdb5");
  bx.fillStyle=gut;
  bx.beginPath(); bx.moveTo(0,ROOF.y-36); bx.lineTo(ROOF.w+8,ROOF.y+32);
  bx.lineTo(ROOF.w+8,ROOF.y+44); bx.lineTo(0,ROOF.y-24); bx.closePath(); bx.fill();
}

// ---------------------------------------------------------------- actors
function drawHuman(h,shirtL,shirtD,skin,capL,capD){
  const bob=Math.sin(h.step)*1.8;
  softShadow(ctx,h.x+9,h.y+19,20,9,.36);
  ctx.save(); ctx.translate(0,bob);
  const sw=Math.sin(h.step)*5;
  limb(ctx,h.x-5,h.y+13,h.x-5+sw,h.y+25,6.5,"#5a6b86","#33405a");
  limb(ctx,h.x+5,h.y+13,h.x+5-sw,h.y+25,6.5,"#5a6b86","#33405a");
  const g=ctx.createLinearGradient(h.x-11,h.y-4,h.x+8,h.y+18);
  g.addColorStop(0,shirtL); g.addColorStop(1,shirtD);
  ctx.fillStyle=g; ctx.beginPath(); ctx.roundRect(h.x-11,h.y-4,22,21,8); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.22)";
  ctx.beginPath(); ctx.roundRect(h.x-9,h.y-2,8,15,5); ctx.fill();
  const a=(h.wave>.05)?(-Math.PI/2-Math.sin(G.t*15)*h.wave*.95):h.face;
  limb(ctx,h.x,h.y+2,h.x+Math.cos(a)*16,h.y+Math.sin(a)*16+2,6,skin,"#a06b47");
  orb(ctx,h.x,h.y-13,10,skin,"#a06b47");
  const cg=ctx.createLinearGradient(0,h.y-24,0,h.y-12);
  cg.addColorStop(0,capL); cg.addColorStop(1,capD);
  ctx.fillStyle=cg;
  ctx.beginPath(); ctx.arc(h.x,h.y-15,10,Math.PI,0); ctx.fill();
  ctx.beginPath(); ctx.roundRect(h.x-10,h.y-16,20,4,2); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.3)";
  ctx.beginPath(); ctx.ellipse(h.x-4,h.y-20,3.5,2,-.5,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

// fringe strokes that read as long fur along an edge
// A soft feathered rim. This used to throw strokes outward, which read as
// spines on screen, so it now hugs the silhouette instead of poking out of it.
function fur(c,x,y,rx,ry,n,len,col,spread,phase){
  c.save();
  c.strokeStyle=col; c.lineWidth=Math.max(2.2,len*.4); c.lineCap="round";
  c.globalAlpha=.5;
  for(let i=0;i<n;i++){
    const a=phase+(i/n)*spread, a2=phase+((i+1)/n)*spread, am=(a+a2)/2;
    c.beginPath();
    c.moveTo(x+Math.cos(a)*rx*.93, y+Math.sin(a)*ry*.93);
    c.quadraticCurveTo(x+Math.cos(am)*rx*1.02, y+Math.sin(am)*ry*1.02,
                       x+Math.cos(a2)*rx*.93,  y+Math.sin(a2)*ry*.93);
    c.stroke();
  }
  c.restore();
}

function drawDog(d,tnow){
  d=d||G.dog; tnow=(tnow===undefined)?G.t:tnow;
  const bob=Math.sin(d.phase)*2.6;
  softShadow(ctx,d.x+11,d.y+20,29,11,.4);
  ctx.save();
  ctx.translate(d.x,d.y+bob);
  ctx.scale(Math.cos(d.face)<0?-1:1,1);
  ctx.lineCap="round";

  // ---- plumed tail, pale at the tip like the real thing
  const twx=Math.sin(d.wag)*9, twy=Math.cos(d.wag)*5;
  limb(ctx,-16,0,-30+twx,-14+twy,13,"#d9a257","#8f6224");
  fur(ctx,-30+twx,-14+twy,9,9,9,9,"rgba(60,50,42,.55)",Math.PI*1.5,2.1);
  limb(ctx,-29+twx*.8,-13+twy*.8,-36+twx,-22+twy,10,"#cdc4b2","#8b8172");
  fur(ctx,-36+twx,-22+twy,7,7,7,8,"rgba(215,208,192,.75)",Math.PI*1.6,1.6);

  // ---- legs
  limb(ctx,-10,4,-10+Math.sin(d.phase)*6,18,6.5,"#c4883f","#8a5a24");
  limb(ctx,9,5,9-Math.sin(d.phase)*6,18,6.5,"#c4883f","#8a5a24");
  limb(ctx,-6,4,-6-Math.sin(d.phase)*5,17,5.5,"#dba95e","#a4752f");
  limb(ctx,13,5,13+Math.sin(d.phase)*5,17,5.5,"#dba95e","#a4752f");
  // pale paws
  for (const [px,py] of [[-10+Math.sin(d.phase)*6,18],[9-Math.sin(d.phase)*6,18]]){
    ctx.fillStyle="#ded5c2";
    ctx.beginPath(); ctx.ellipse(px,py+1,4.4,3,0,0,Math.PI*2); ctx.fill();
  }

  // ---- body: rust underneath, black saddle over the top
  blob(ctx,0,1,23,14,0,"#e3ac60","#a0702c");
  fur(ctx,0,1,23,14,13,9,"rgba(180,128,58,.6)",Math.PI,.15);
  blob(ctx,-2,-5,22,10,-.06,"#4b4139","#201c19");
  blob(ctx,-11,0,13.5,11,0,"#3f362f","#1c1916");
  fur(ctx,-2,-6,22,10,12,8,"rgba(38,32,28,.7)",Math.PI,3.25);
  // saddle edge catching the low sun
  ctx.strokeStyle="rgba(255,196,110,.28)"; ctx.lineWidth=2.4;
  ctx.beginPath(); ctx.ellipse(-2,-5,21,9,-.06,Math.PI*1.15,Math.PI*1.9); ctx.stroke();

  // ---- chest ruff and white flash
  blob(ctx,13,3,11,12.5,0,"#eec078","#ac7e36");
  fur(ctx,14,4,10,11,10,9,"rgba(200,148,68,.7)",Math.PI*1.3,-.5);
  orb(ctx,18,7,5,"#fdfaf0","#c9c0ac",false);

  // ---- big shepherd ears, black-tipped
  const earG=ctx.createLinearGradient(8,-34,22,-14);
  earG.addColorStop(0,"#4b4139"); earG.addColorStop(1,"#1d1a17");
  ctx.fillStyle=earG;
  ctx.beginPath(); ctx.moveTo(11,-14); ctx.lineTo(8,-34); ctx.lineTo(21,-18); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(19,-15); ctx.lineTo(24,-34); ctx.lineTo(29,-16); ctx.closePath(); ctx.fill();
  ctx.fillStyle="#7d5f45";
  ctx.beginPath(); ctx.moveTo(20,-17); ctx.lineTo(24,-29); ctx.lineTo(27,-17); ctx.closePath(); ctx.fill();
  // wispy ear fringe
  ctx.strokeStyle="rgba(190,150,96,.5)"; ctx.lineWidth=1.6;
  for(let i=0;i<4;i++){ ctx.beginPath(); ctx.moveTo(9+i*1.4,-20-i*3); ctx.lineTo(3+i*1.2,-24-i*3.4); ctx.stroke(); }

  // ---- head: dark mask with warm cheek
  orb(ctx,19,-10,12,"#584c42","#211d1a",false);
  fur(ctx,19,-10,12,12,9,7,"rgba(48,40,34,.75)",Math.PI*1.1,1.5);
  blob(ctx,13,-5,8,8,0,"#c98d3f","#8d5f24");
  blob(ctx,29,-6,10,6.4,.12,"#2c2724","#100e0d");
  orb(ctx,37.5,-6,3.3,"#4a423c","#100e0d",false);
  ctx.fillStyle="rgba(255,255,255,.5)";
  ctx.beginPath(); ctx.ellipse(36.4,-7.4,1.5,.95,-.4,0,Math.PI*2); ctx.fill();

  // ---- tan eyebrow pips, the giveaway shepherd marking
  ctx.fillStyle="rgba(196,140,66,.85)";
  ctx.beginPath(); ctx.ellipse(21,-18.5,2.6,1.7,-.25,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(13.5,-16,2.2,1.5,-.4,0,Math.PI*2); ctx.fill();

  // ---- amber eye, with a mood
  if (d.mood==="happy"){
    // squinted shut with joy
    ctx.strokeStyle="#140e08"; ctx.lineWidth=2.2; ctx.lineCap="round";
    ctx.beginPath(); ctx.arc(23,-12.4,3.6,Math.PI+.35,-.35); ctx.stroke();
  } else if (d.mood==="worried"){
    orb(ctx,23,-13.5,4.1,"#f6e3c2","#9a7b52",false);
    ctx.fillStyle="#140e08";
    ctx.beginPath(); ctx.arc(23.4,-12.6,1.9,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,.9)";
    ctx.beginPath(); ctx.arc(22.2,-14.4,1.1,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="rgba(20,14,8,.75)"; ctx.lineWidth=1.8;
    ctx.beginPath(); ctx.moveTo(19,-19.5); ctx.lineTo(26,-17.5); ctx.stroke();
  } else {
    orb(ctx,23,-13.5,3.5,"#eab04d","#8a5a25",false);
    ctx.fillStyle="#140e08";
    ctx.beginPath(); ctx.arc(23.7,-13.5,1.7,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,.9)";
    ctx.beginPath(); ctx.arc(22,-14.9,1.1,0,Math.PI*2); ctx.fill();
  }

  // ---- tongue
  const tl=6+Math.sin(tnow*9)*2;
  ctx.fillStyle="#e8808f";
  ctx.beginPath(); ctx.roundRect(31,-2,5.5,tl,3); ctx.fill();

  // ---- red collar
  const cg=ctx.createLinearGradient(8,-14,14,2);
  cg.addColorStop(0,"#ff6a5a"); cg.addColorStop(1,"#b52418");
  ctx.strokeStyle=cg; ctx.lineWidth=5.5;
  ctx.beginPath(); ctx.moveTo(9,-14); ctx.lineTo(12,2); ctx.stroke();
  ctx.fillStyle="#f2d98a";
  ctx.beginPath(); ctx.arc(11.4,-2,2.2,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // ball clamped in his jaws when he has one
  if (d.hasBall){
    const k=KINDS[d.hasBall];
    const fx = Math.cos(d.face)<0 ? d.x-35 : d.x+35;
    orb(ctx,fx,d.y-8+bob,8,k.light,k.dark);
  }
  if (d.bark) bubble(d.x,d.y-68,d.bark,"#fff","#1e2a18");
}

function drawLaura(){
  const la=G.laura;
  if (la.mode==="inside" && la.warn<=0) return;
  const emerging=la.mode==="inside";
  ctx.save();
  ctx.globalAlpha=emerging?clamp(la.warn,0,1)*.55:1;
  softShadow(ctx,la.x+9,la.y+21,19,8,.36);
  const sway=Math.sin(la.step)*2.4;
  ctx.translate(la.x,la.y);
  // broom
  ctx.save(); ctx.rotate(Math.sin(la.sweep)*.55-.5);
  limb(ctx,4,-2,31,15,4.5,"#d7a45e","#94682c");
  const bg2=ctx.createLinearGradient(25,10,40,26);
  bg2.addColorStop(0,"#f0cd77"); bg2.addColorStop(1,"#b98a34");
  ctx.fillStyle=bg2;
  ctx.beginPath(); ctx.moveTo(27,10); ctx.lineTo(42,14); ctx.lineTo(39,28); ctx.lineTo(25,19); ctx.closePath(); ctx.fill();
  ctx.strokeStyle="rgba(120,88,40,.55)"; ctx.lineWidth=1.2;
  for (let i=0;i<4;i++){ ctx.beginPath(); ctx.moveTo(28+i*3,12+i); ctx.lineTo(35+i*2,25); ctx.stroke(); }
  ctx.restore();
  // sandals
  ctx.fillStyle="#8a6640";
  ctx.beginPath(); ctx.ellipse(-6+sway,23,6.5,3.6,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6-sway,23,6.5,3.6,0,0,Math.PI*2); ctx.fill();
  // gown
  const gw=ctx.createLinearGradient(-14,-6,12,22);
  gw.addColorStop(0,"#f593bb"); gw.addColorStop(1,"#b24378");
  ctx.fillStyle=gw;
  ctx.beginPath(); ctx.moveTo(-10,-5); ctx.lineTo(10,-5);
  ctx.quadraticCurveTo(16+sway,10,15+sway,21);
  ctx.lineTo(-15+sway,21);
  ctx.quadraticCurveTo(-16+sway,10,-10,-5); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.4)";
  for (const [dx,dy] of [[-6,4],[3,10],[-2,16],[8,5],[-9,13],[6,18]]){
    ctx.beginPath(); ctx.arc(dx+sway*.4,dy,1.9,0,Math.PI*2); ctx.fill();
  }
  ctx.fillStyle="#a03a6b"; ctx.beginPath(); ctx.roundRect(-11,-6,22,5,2); ctx.fill();
  // arms, head, bun
  limb(ctx,-7,-1,-15,8,5,"#f0c69e","#c08a5e");
  limb(ctx,6,-1,14,5,5,"#f0c69e","#c08a5e");
  orb(ctx,0,-15,9.5,"#f0c69e","#c08a5e");
  const hg=ctx.createLinearGradient(0,-26,0,-12);
  hg.addColorStop(0,"#c9c6c2"); hg.addColorStop(1,"#8d8a86");
  ctx.fillStyle=hg;
  ctx.beginPath(); ctx.arc(0,-18,9.5,Math.PI,0); ctx.fill();
  orb(ctx,0,-27,5.4,"#c9c6c2","#8d8a86",false);
  ctx.fillStyle="#3a3330";
  ctx.beginPath(); ctx.arc(-3.2,-14,1.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(3.2,-14,1.5,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="#8d3a4a"; ctx.lineWidth=1.8;
  ctx.beginPath(); ctx.arc(0,-8.5,3.2,Math.PI*1.15,Math.PI*1.85); ctx.stroke();
  ctx.restore();
  if (la.bark && !emerging) bubble(la.x,la.y-62,la.bark,"#fff2f7","#7d2b52");
}

function bubble(x,y,b,bgc,fgc){
  ctx.save(); ctx.globalAlpha=clamp(b.life,0,1);
  ctx.font="600 13px Fredoka, system-ui, sans-serif";
  const tw=ctx.measureText(b.text).width;
  ctx.fillStyle="rgba(0,0,0,.3)";
  ctx.beginPath(); ctx.roundRect(x-tw/2-10,y+3,tw+20,25,9); ctx.fill();
  ctx.fillStyle=bgc;
  ctx.beginPath(); ctx.roundRect(x-tw/2-10,y,tw+20,25,9); ctx.fill();
  ctx.fillStyle=fgc; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText(b.text,x,y+13);
  ctx.restore();
}

function drawBall(b){
  const k=KINDS[b.kind], gy=b.y-b.z, r=10;
  softShadow(ctx,b.x+b.z*.08,b.y+3,10-b.z*.02,5-b.z*.012,clamp(.4-b.z*.0018,.06,.4));
  ctx.save(); ctx.globalCompositeOperation="lighter";
  for (const s of b.trail){
    ctx.globalAlpha=.12*s.life; ctx.fillStyle=k.rim;
    ctx.beginPath(); ctx.arc(s.x,s.y,7*s.life,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
  ctx.save(); ctx.translate(b.x,gy);
  ctx.fillStyle="rgba(255,255,255,.85)";
  ctx.beginPath(); ctx.arc(0,0,r+2,0,Math.PI*2); ctx.fill();
  orb(ctx,0,0,r,k.light,k.dark);
  ctx.rotate(b.spin);
  // moulded ridges, like the real rubber ball in the yard
  ctx.save();
  ctx.beginPath(); ctx.arc(0,0,r-.5,0,Math.PI*2); ctx.clip();
  ctx.strokeStyle="rgba(0,0,0,.16)"; ctx.lineWidth=1.4;
  for(let i=0;i<7;i++){
    const a=i*Math.PI/7;
    ctx.beginPath();
    ctx.ellipse(0,0,r*.95,r*.95*Math.abs(Math.cos(a)),0,0,Math.PI*2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle="rgba(255,255,255,.42)"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(0,0,r-2.5,-.9,.9); ctx.stroke();
  ctx.beginPath(); ctx.arc(0,0,r-2.5,Math.PI-.9,Math.PI+.9); ctx.stroke();
  ctx.restore();
  if (b.kind==="gold" && b.mode==="loose"){
    const k2=(Math.sin(G.pulse*1.6+b.x)+1)/2;
    ctx.strokeStyle="rgba(255,214,90,"+(.6-k2*.4)+")"; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(b.x,b.y,15+k2*10,0,Math.PI*2); ctx.stroke();
  }
}

// ---------------------------------------------------------------- HUD + overlays
function drawSafetyRing(){
  if (!G.running || !G.carry.length) return;
  const p=G.player, clear=dist(G.dog,p)>=SAFE_DIST;
  ctx.save();
  ctx.setLineDash([10,10]); ctx.lineDashOffset=-G.t*(clear?14:36);
  ctx.lineWidth=3;
  ctx.strokeStyle=clear?"rgba(182,242,58,.85)":"rgba(240,71,47,.9)";
  ctx.beginPath(); ctx.arc(p.x,p.y,SAFE_DIST,0,Math.PI*2); ctx.stroke();
  ctx.restore();
  if (!G.charging){
    ctx.textAlign="center"; ctx.textBaseline="middle";
    chunky(ctx, clear?"HOLD TO THROW":"TOO CLOSE \u2014 RUN!", p.x, p.y-48, 17,
           clear?"#d9ff7a":"#ff9c90", "#1c2f12");
  }
  // carried balls floating over your head
  G.carry.forEach((kind,i)=>{
    const k=KINDS[kind];
    const a=G.t*2+i*(Math.PI*2/3);
    orb(ctx, p.x+Math.cos(a)*15, p.y-40+Math.sin(a)*4, 7, k.light, k.dark);
  });
}
function drawPowerMeter(){
  if (!G.charging) return;
  const p=G.player, w=112,h=14,x=p.x-w/2,y=p.y+36;
  ctx.fillStyle="rgba(16,32,14,.85)";
  ctx.beginPath(); ctx.roundRect(x-4,y-4,w+8,h+8,7); ctx.fill();
  ctx.fillStyle="rgba(182,242,58,.3)";
  ctx.fillRect(x+(SWEET-SWEET_W)*w,y,SWEET_W*2*w,h);
  const good=Math.abs(G.power-SWEET)<=SWEET_W;
  const g=ctx.createLinearGradient(0,y,0,y+h);
  g.addColorStop(0,good?"#e2ff7d":"#ffe08a"); g.addColorStop(1,good?"#79b70d":"#e09a12");
  ctx.fillStyle=g; ctx.beginPath(); ctx.roundRect(x,y,Math.max(4,w*G.power),h,5); ctx.fill();
  ctx.strokeStyle="rgba(255,255,255,.6)"; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.roundRect(x,y,w,h,5); ctx.stroke();
  ctx.fillStyle="#fff"; ctx.fillRect(x+SWEET*w-1.5,y-5,3,h+10);
}
function drawThrowButton(){
  if (!G.running || !G.carry.length) return;
  const t=THROW_BTN, clear=dist(G.dog,G.player)>=SAFE_DIST;
  ctx.save();
  softShadow(ctx,t.x,t.y+7,t.r,t.r*.6,.4);
  const g=ctx.createLinearGradient(0,t.y-t.r,0,t.y+t.r);
  if (clear){ g.addColorStop(0,"#c9f24d"); g.addColorStop(1,"#6ba712"); }
  else { g.addColorStop(0,"#ff8a72"); g.addColorStop(1,"#b52418"); }
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(t.x,t.y,t.r,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="rgba(255,255,255,.55)"; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(t.x,t.y,t.r-4,0,Math.PI*2); ctx.stroke();
  if (G.charging){
    ctx.strokeStyle="#fff8c9"; ctx.lineWidth=8;
    ctx.beginPath(); ctx.arc(t.x,t.y,t.r-4,-Math.PI/2,-Math.PI/2+Math.PI*2*G.power); ctx.stroke();
  }
  ctx.textAlign="center"; ctx.textBaseline="middle";
  chunky(ctx, clear?"HOLD":"RUN", t.x, t.y-6, 21, "#fff", clear?"#2f5a06":"#6d1109");
  ctx.font="600 11px Fredoka, system-ui, sans-serif";
  ctx.fillStyle="rgba(255,255,255,.85)";
  ctx.fillText(clear?"TO THROW":"FIRST", t.x, t.y+14);
  ctx.restore();
}
function drawDoorZone(){
  const la=G.laura;
  if (la.warn<=0 && la.mode==="inside") return;
  ctx.save();
  ctx.setLineDash([7,11]); ctx.lineDashOffset=G.t*18;
  ctx.strokeStyle="rgba(240,120,180,"+(la.mode==="inside"?.28+la.warn*.4:.75)+")";
  ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.arc(DOOR.x,DOOR.y,DOOR_R,0,Math.PI*2); ctx.stroke();
  ctx.restore();
}
function drawFlies(){
  ctx.fillStyle="rgba(28,26,22,.85)";
  for (const q of POOPS){
    for (let i=0;i<3;i++){
      const a=G.t*(2.6+i*.8)+q.seed+i*2.1;
      ctx.beginPath();
      ctx.arc(q.x+Math.cos(a)*(11+i*4), q.y-8+Math.sin(a*1.6)*(6+i*2), 1.5, 0, Math.PI*2);
      ctx.fill();
    }
  }
}

function drawHUD(){
  ctx.textBaseline="middle";
  // score
  goldPanel(ctx,14,12,168,54,14);
  ctx.textAlign="left";
  ctx.font="600 11px Fredoka, system-ui, sans-serif";
  ctx.fillStyle="rgba(255,224,150,.85)"; ctx.fillText("SCORE",30,27);
  chunky(ctx,String(G.score),30,47,25,"#ffe07a","#4a2408");
  ctx.textAlign="right";
  ctx.font="600 11px Fredoka, system-ui, sans-serif";
  ctx.fillStyle="rgba(255,255,255,.5)"; ctx.fillText("BEST "+G.best,168,27);

  // progress toward beating Bernard
  const gw=154, gx=21, gy=72;
  const gfrac=clamp(G.score/WIN_SCORE,0,1);
  ctx.fillStyle="rgba(6,18,10,.7)";
  ctx.beginPath(); ctx.roundRect(gx-4,gy-4,gw+8,20,9); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,.5)";
  ctx.beginPath(); ctx.roundRect(gx,gy,gw,12,6); ctx.fill();
  const gg=ctx.createLinearGradient(0,gy,0,gy+12);
  if (gfrac>=.8){ gg.addColorStop(0,"#fff6c9"); gg.addColorStop(1,"#e0a512"); }
  else { gg.addColorStop(0,"#a9ef5e"); gg.addColorStop(1,"#59a012"); }
  ctx.fillStyle=gg;
  ctx.beginPath(); ctx.roundRect(gx,gy,Math.max(5,gw*gfrac),12,6); ctx.fill();
  if (gfrac>=.8){
    const pl=(Math.sin(G.pulse*2.2)+1)/2;
    ctx.strokeStyle="rgba(255,246,201,"+(.3+pl*.55)+")"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.roundRect(gx,gy,gw,12,6); ctx.stroke();
  }
  ctx.textAlign="left";
  ctx.font="600 10px Fredoka, system-ui, sans-serif";
  ctx.fillStyle="rgba(255,255,255,.62)";
  ctx.fillText("BEAT BERNARD  "+G.score+" / "+WIN_SCORE, gx+2, gy+27);

  // timer
  const tw=230, tx=W/2-tw/2;
  goldPanel(ctx,tx,12,tw,48,14);
  const frac=clamp(G.timeLeft/ROUND_TIME,0,1);
  const bw=tw-30;
  ctx.fillStyle="rgba(0,0,0,.45)";
  ctx.beginPath(); ctx.roundRect(tx+15,32,bw,15,7); ctx.fill();
  const tg=ctx.createLinearGradient(0,32,0,47);
  if (G.timeLeft<15){ tg.addColorStop(0,"#ff9f8a"); tg.addColorStop(1,"#c4211a"); }
  else { tg.addColorStop(0,"#a9ef5e"); tg.addColorStop(1,"#59a012"); }
  ctx.fillStyle=tg;
  ctx.beginPath(); ctx.roundRect(tx+15,32,Math.max(6,bw*frac),15,7); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.25)";
  ctx.beginPath(); ctx.roundRect(tx+15,33,Math.max(6,bw*frac),5,4); ctx.fill();
  ctx.textAlign="center";
  const secs=Math.ceil(G.timeLeft);
  chunky(ctx,(secs<10?"0":"")+secs+"s",W/2,25,15,"#fff5cf","#4a2408",600);

  // Bernard's haul
  goldPanel(ctx,W-182,12,168,54,14);
  ctx.textAlign="left";
  ctx.font="600 11px Fredoka, system-ui, sans-serif";
  ctx.fillStyle="rgba(255,224,150,.85)"; ctx.fillText("BERNARD",W-166,27);
  for (let i=0;i<STEAL_LIMIT;i++){
    const x=W-166+i*18.5, y=46;
    ctx.fillStyle = i<G.stolen ? "#e0392c" : "rgba(255,255,255,.16)";
    ctx.beginPath(); ctx.arc(x,y,6.5,0,Math.PI*2); ctx.fill();
    if (i<G.stolen){
      ctx.fillStyle="rgba(255,255,255,.45)";
      ctx.beginPath(); ctx.arc(x-2,y-2.4,2.2,0,Math.PI*2); ctx.fill();
    }
  }

  // carry slots
  goldPanel(ctx,14,H-74,150,60,14);
  ctx.textAlign="left";
  ctx.font="600 11px Fredoka, system-ui, sans-serif";
  ctx.fillStyle="rgba(255,224,150,.85)"; ctx.fillText("CARRYING",30,H-56);
  for (let i=0;i<CARRY_MAX;i++){
    const x=42+i*40, y=H-32;
    ctx.fillStyle="rgba(0,0,0,.4)";
    ctx.beginPath(); ctx.arc(x,y,14,0,Math.PI*2); ctx.fill();
    if (G.carry[i]){
      const k=KINDS[G.carry[i]];
      orb(ctx,x,y,12,k.light,k.dark);
    } else {
      ctx.strokeStyle="rgba(255,255,255,.18)"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(x,y,12,0,Math.PI*2); ctx.stroke();
    }
  }
  if (carryValue()>0){
    ctx.textAlign="left";
    chunky(ctx,"worth "+carryValue(),172,H-32,15,"#ffe07a","#2b3d16",600);
  }
}

function drawGlass(){
  // vignette grounds the scene whether or not glare is on
  ctx.save();
  const v=ctx.createRadialGradient(W*.46,H*.44,H*.34,W*.46,H*.44,H*.92);
  v.addColorStop(0,"rgba(8,20,12,0)");
  v.addColorStop(1,"rgba(8,20,12,.42)");
  ctx.fillStyle=v; ctx.fillRect(0,0,W,H);
  // low warm sun bloom from the left edge
  const bl=ctx.createRadialGradient(-40,H*.30,20,-40,H*.30,W*.72);
  bl.addColorStop(0,"rgba(255,206,120,.20)");
  bl.addColorStop(1,"rgba(255,206,120,0)");
  ctx.fillStyle=bl; ctx.fillRect(0,0,W,H);
  ctx.restore();

  if (!glare) return;
  ctx.save();
  const g=ctx.createLinearGradient(0,H*.15,W*.75,H);
  g.addColorStop(0,"rgba(255,255,255,0)");
  g.addColorStop(.42,"rgba(255,255,255,.09)");
  g.addColorStop(.52,"rgba(255,255,255,.02)");
  g.addColorStop(.62,"rgba(255,255,255,.06)");
  g.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  ctx.restore();
}

const clouds=[];
for (let i=0;i<8;i++) clouds.push({x:Math.random()*W,y:8+Math.random()*46,s:.55+Math.random()*.95});
function drawYardLife(dt){
  drawButterflies(G.t,dt||0.016);
}
function drawClouds(){
  ctx.save(); ctx.beginPath(); ctx.rect(0,0,W,84); ctx.clip();
  for (const c of clouds){
    c.x+=.055*c.s; if (c.x>W+90) c.x=-90;
    for (const [dx,dy,r] of [[0,0,18],[17,4,14],[-17,4,13],[8,-9,13],[-9,-7,12],[28,6,9]]){
      const g=ctx.createRadialGradient(c.x+dx*c.s,c.y+dy*c.s-r*.4*c.s,r*.1*c.s,c.x+dx*c.s,c.y+dy*c.s,r*c.s);
      g.addColorStop(0,"#ffffff"); g.addColorStop(1,"#dbe9f2");
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(c.x+dx*c.s,c.y+dy*c.s,r*c.s,0,Math.PI*2); ctx.fill();
    }
  }
  ctx.restore();
}

function draw(){
  ctx.save();
  if (G.shake>0) ctx.translate(rand(-G.shake,G.shake)*.5,rand(-G.shake,G.shake)*.5);
  ctx.drawImage(bg,0,0);
  drawClouds();
  drawYardLife();
  drawDoorZone();
  drawFlies();

  const grounded=G.balls.filter(b=>b.z<12);
  for (const b of grounded) drawBall(b);

  const actors=[
    {y:G.npc.y,   f:()=>drawHuman(G.npc,"#ffd45e","#d98d12","#e0a877","#e8622f","#a3320f")},
    {y:G.dog.y,   f:drawDog},
    {y:G.laura.y, f:drawLaura},
    {y:G.player.y,f:()=>drawHuman(G.player,"#6fd0ff","#1f6f9e","#e0a877","#2f4f8f","#16294f")}
  ].sort((a,b)=>a.y-b.y);
  for (const a of actors) a.f();

  for (const b of G.balls) if (b.z>=12) drawBall(b);

  drawSafetyRing();
  drawPowerMeter();
  drawThrowButton();

  for (const q of G.particles){
    ctx.globalAlpha=clamp(q.life,0,1); ctx.fillStyle=q.color;
    ctx.beginPath(); ctx.arc(q.x,q.y,q.r,0,Math.PI*2); ctx.fill();
  }
  for (const q of G.sparks){
    ctx.globalAlpha=clamp(q.life,0,1); ctx.fillStyle=q.color;
    ctx.save(); ctx.translate(q.x,q.y); ctx.rotate(q.life*7);
    ctx.beginPath();
    for (let i=0;i<4;i++){
      const a=i*Math.PI/2;
      ctx.lineTo(Math.cos(a)*q.sz,Math.sin(a)*q.sz);
      ctx.lineTo(Math.cos(a+Math.PI/4)*q.sz*.32,Math.sin(a+Math.PI/4)*q.sz*.32);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.globalAlpha=1;

  for (const c of G.confetti){
    ctx.globalAlpha=clamp(c.life,0,1);
    ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.rot);
    ctx.fillStyle=c.col;
    ctx.fillRect(-c.sz/2,-c.sz/3,c.sz,c.sz*.66);
    ctx.fillStyle="rgba(255,255,255,.35)";
    ctx.fillRect(-c.sz/2,-c.sz/3,c.sz,c.sz*.2);
    ctx.restore();
  }
  ctx.globalAlpha=1;

  ctx.textAlign="center"; ctx.textBaseline="middle";
  for (const t of G.toasts){
    ctx.globalAlpha=clamp(t.life,0,1);
    chunky(ctx,t.text,t.x,t.y,20,t.color,"#1c2f12");
  }
  ctx.globalAlpha=1;

  drawGlass();
  drawHUD();
  ctx.restore();

  if (G.flash>0){
    ctx.fillStyle="rgba("+G.flashCol+","+(G.flash*.24)+")";
    ctx.fillRect(0,0,W,H);
  }
}


// ================================================================
//  SHARED POLISH  —  combo chain, moods, ambient life, motion trails
// ================================================================

// ---- combo: score things back-to-back and the multiplier climbs.
// Every game owns a state object with score/toasts; this hangs off it.
const COMBO_WINDOW = 2.6;
function comboInit(S){ S.combo={n:0,t:0,mult:1,pop:0}; }
function comboTick(S,dt){
  const c=S.combo; if(!c) return;
  if (c.n>0){ c.t-=dt; if (c.t<=0){ c.n=0; c.mult=1; } }
  c.pop=Math.max(0,c.pop-dt*3);
}
// returns the multiplier to apply to this pickup
function comboHit(S,x,y,pushToast){
  const c=S.combo; if(!c) return 1;
  c.n++; c.t=COMBO_WINDOW; c.pop=1;
  c.mult = c.n>=9 ? 4 : c.n>=6 ? 3 : c.n>=3 ? 2 : 1;
  if ((c.n===3||c.n===6||c.n===9) && pushToast){
    pushToast("COMBO x"+c.mult+"!", c.mult>=4?"#ff8fc4":c.mult>=3?"#ffcf3a":"#9be5ff", x, y-46);
    try{ sfx.perfect(); }catch(e){}
  }
  return c.mult;
}
function comboBreak(S){ const c=S.combo; if(c){ c.n=0; c.mult=1; c.t=0; } }
function comboDraw(S,x,y){
  const c=S.combo; if(!c||c.n<2) return;
  const frac=clamp(c.t/COMBO_WINDOW,0,1);
  const sz=15+c.pop*6;
  const col=c.mult>=4?"#ff8fc4":c.mult>=3?"#ffcf3a":c.mult>=2?"#9be5ff":"#dfe9dc";
  ctx.save();
  ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.globalAlpha=.35+frac*.65;
  chunky(ctx,"x"+c.mult+"  \u00b7  "+c.n,x,y,sz,col,"#221206",700);
  ctx.fillStyle="rgba(0,0,0,.35)";
  ctx.beginPath(); ctx.roundRect(x-40,y+14,80,5,3); ctx.fill();
  ctx.fillStyle=col;
  ctx.beginPath(); ctx.roundRect(x-40,y+14,80*frac,5,3); ctx.fill();
  ctx.restore();
}

// ---- ambient life. Cheap, but it makes a scene feel inhabited.
const AMB={ birds:[], flies:[], motes:[] };
function ambInit(){
  for(let i=0;i<4;i++) AMB.birds.push({x:rand(0,W),y:rand(40,150),v:rand(28,52),p:rand(0,6.3),s:rand(.7,1.2)});
  for(let i=0;i<5;i++) AMB.flies.push({x:rand(0,W),y:rand(240,600),p:rand(0,6.3),h:rand(0,1)});
  for(let i=0;i<24;i++) AMB.motes.push({x:rand(420,820),y:rand(160,560),p:rand(0,6.3),r:rand(1,2.4)});
}
function drawBirds(tnow,dt,scroll){
  for (const b of AMB.birds){
    b.x-=b.v*dt*(scroll||1); b.p+=dt*6;
    if (b.x<-40){ b.x=W+40; b.y=rand(40,150); }
    const f=Math.sin(b.p)*5*b.s;
    ctx.strokeStyle="rgba(40,50,60,.55)"; ctx.lineWidth=2; ctx.lineCap="round";
    ctx.beginPath();
    ctx.moveTo(b.x-9*b.s,b.y+f); ctx.quadraticCurveTo(b.x-4*b.s,b.y-4*b.s,b.x,b.y);
    ctx.quadraticCurveTo(b.x+4*b.s,b.y-4*b.s,b.x+9*b.s,b.y+f); ctx.stroke();
  }
}
function drawButterflies(tnow,dt){
  for (const f of AMB.flies){
    f.p+=dt*2.1;
    f.x+=Math.cos(f.p*.7)*26*dt; f.y+=Math.sin(f.p*1.3)*18*dt;
    if (f.x<0) f.x=W; if (f.x>W) f.x=0;
    f.y=clamp(f.y,230,620);
    const w=Math.abs(Math.sin(f.p*7))*6+2;
    const col=f.h<.5?"#ffb347":"#a9d8ff";
    ctx.fillStyle=col;
    ctx.beginPath(); ctx.ellipse(f.x-w*.6,f.y,w,4,-.4,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(f.x+w*.6,f.y,w,4,.4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#3a2a1c"; ctx.fillRect(f.x-1,f.y-3,2,6);
  }
}
function drawMotes(tnow){
  for (const m of AMB.motes){
    const a=.18+.18*Math.sin(tnow*1.3+m.p);
    ctx.fillStyle="rgba(255,226,160,"+a+")";
    ctx.beginPath(); ctx.arc(m.x+Math.sin(tnow*.4+m.p)*10, m.y+Math.cos(tnow*.3+m.p)*8, m.r,0,Math.PI*2); ctx.fill();
  }
}

// ---- motion trail: ghost copies behind something moving fast
function trailPush(list,x,y,extra){
  list.push({x,y,life:.32,...extra});
  if (list.length>7) list.shift();
}
function trailTick(list,dt){ for(const g of list) g.life-=dt; while(list.length&&list[0].life<=0) list.shift(); }

// ================================================================
//  TITA SCOLDER  —  grab the toys, save the Crocs, stay off the stairs
// ================================================================
const T_FIELD = { x0:38, y0:196, x1:W-34, y1:H-30 };
const STAIRS  = { x:0, y:150, w:168, h:300 };     // her launch pad
const T_BIN   = { x:812, y:566, r:46 };           // toy bin
const DOGBED  = { x:756, y:250 };
const T_OBST  = [
  { x:452, y:406, r:64, sq:.60 },                 // gold coffee table
  { x:196, y:648, r:74, sq:.42 },                 // couch arm, lower left
  { x:604, y:656, r:82, sq:.40 }                  // couch, lower right
];

/* ----- Tita Scolder dials: seconds, points to win, Crocs you can lose ----- */
const T_TIME = 90, T_WIN = 700, T_CARRY = 3, T_STRIKES = 3;
const T_TOYS = {
  sloth : { value:40, label:"Sloth"  },
  gecko : { value:55, label:"Gecko"  },
  carrot: { value:70, label:"Carrot" },
  croc  : { value:15, label:"Croc"   }
};
const TOY_ROLL = ["sloth","sloth","gecko","gecko","carrot"];

let T = null;
let tbg = null;
let POSTER = false;

function tPushOut(a){
  for (const o of T_OBST){
    const dx=a.x-o.x, dy=(a.y-o.y)/o.sq, d=Math.hypot(dx,dy)||1;
    if (d<o.r){ const k=(o.r-d)/d; a.x+=dx*k; a.y+=dy*k*o.sq; }
  }
}
function tClear(x,y,pad){
  for (const o of T_OBST) if (Math.hypot(x-o.x,(y-o.y)/o.sq) < o.r+pad) return false;
  if (x<STAIRS.x+STAIRS.w+40 && y<STAIRS.y+STAIRS.h+30) return false;
  if (Math.hypot(x-T_BIN.x,y-T_BIN.y) < T_BIN.r+40) return false;
  return true;
}
function tSpot(pad){
  for (let i=0;i<80;i++){
    const x=rand(T_FIELD.x0+40,T_FIELD.x1-40), y=rand(T_FIELD.y0+30,T_FIELD.y1-30);
    if (tClear(x,y,pad||26)) return {x,y};
  }
  return { x:W*.55, y:H*.5 };
}

function newTita(best){
  const shoes=[];
  const shoeSpots=[[168,556],[222,600],[430,614],[566,600],[318,282]];
  for (let i=0;i<shoeSpots.length;i++){
    shoes.push({ kind:"croc", x:shoeSpots[i][0], y:shoeSpots[i][1],
                 pink:i%2===0, gone:false, spin:rand(-.4,.4) });
  }
  return {
    combo:{n:0,t:0,mult:1,pop:0},
    t:0, pulse:0, running:true, timeLeft:T_TIME,
    score:0, best:best||0, banked:0, lost:0, strikes:0, won:false,
    player:{ x:470, y:560, vx:0, vy:0, face:1, phase:0, freeze:0 },
    dog:{ x:DOGBED.x, y:DOGBED.y, face:Math.PI, phase:0, wag:0, bark:null,
          target:null, chew:0, flee:0, carrying:null, rest:0,
          crocUrge:11, crocMode:0 },
    tita:{ x:STAIRS.x+70, y:STAIRS.y+150, out:0, face:1, phase:0, bark:null, anger:0 },
    carry:[], loose:[], shoes,
    spawnIn:1.2, shooCool:0, nagCool:0,
    shake:0, flash:0, flashCol:"224,58,47",
    toasts:[], particles:[], confetti:[], winFx:0
  };
}
const tCarryValue = () => T.carry.reduce((s,k)=>s+T_TOYS[k].value,0);
const tDogSpeed   = () => Math.min(112 + T.banked*3 + T.strikes*14, 188);

// ------------------------------------------------------------ fx
function tToast(text,color,x,y){
  T.toasts.push({ text,color, x:x!==undefined?x:T.player.x, y:y!==undefined?y:T.player.y-48, life:1.15 });
}
function tBurst(x,y,color,n){
  for(let i=0;i<n;i++){
    const a=rand(0,6.28), s=rand(50,190);
    T.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-40,life:rand(.3,.7),color,r:rand(2,5)});
  }
}

// ------------------------------------------------------------ actions
function titaShoo(){
  if (!T || !T.running || T.player.freeze>0) return;
  if (T.shooCool>0){
    if (T.nagCool<=0){ tToast("catching your breath\u2026","#9fd0ff"); T.nagCool=.8; }
    return;
  }
  T.shooCool=3;
  sfx.broom();
  tToast("SHOO!","#ffe07a");
  tBurst(T.player.x,T.player.y-20,"#ffe07a",14);
  if (Math.hypot(T.dog.x-T.player.x,T.dog.y-T.player.y) < 158){
    T.dog.flee=2.5; T.dog.target=null; T.dog.chew=0;
    T.dog.bark={text:"Rude.",life:1};
    if (T.dog.carrying){                       // he drops what he grabbed
      T.loose.push({ kind:T.dog.carrying, x:T.dog.x, y:T.dog.y+12, spin:rand(-.5,.5), fresh:.5 });
      T.dog.carrying=null;
      tToast("dropped it!","#b6f23a");
    }
  }
}
function tBank(){
  if (!T.carry.length) return;
  const v=tCarryValue(), n=T.carry.length;
  const crocs=T.carry.filter(k=>k==="croc").length;
  const m=comboHit(T,T_BIN.x,T_BIN.y-30,tToast);
  const full = n>=T_CARRY ? 25 : 0;               // full-arms bonus
  const gained=v*m+full;
  T.score+=gained; T.banked+=n;
  sfx.bank(n);
  tBurst(T_BIN.x,T_BIN.y-14,"#b6f23a",22);
  tToast("+"+gained+(full?"  FULL ARMS":"")+(crocs?"  Crocs safe!":""),"#b6f23a",T_BIN.x,T_BIN.y-52);
  if (m>1) tToast("x"+m,"#9be5ff",T_BIN.x+42,T_BIN.y-80);
  T.carry=[];
}
function tDogGrabs(item){
  comboBreak(T);
  T.dog.carrying=item.kind;
  if (item.kind==="croc"){
    T.strikes++;
    T.flash=1; T.flashCol="224,58,47"; T.shake=13;
    sfx.bark();
    T.dog.bark={text:"Mine.",life:1.3};
    tToast("HE GOT A CROC!  "+T.strikes+"/"+T_STRIKES,"#ff6a5e",T.dog.x,T.dog.y-56);
    if (T.strikes>=T_STRIKES){ tEnd("Bernard ate your Crocs"); }
  } else {
    T.lost++;
    T.flash=.6; T.flashCol="255,180,60"; T.shake=7;
    sfx.bark();
    tToast("he took the "+T_TOYS[item.kind].label.toLowerCase()+"!","#ffb45e",T.dog.x,T.dog.y-52);
  }
}
function titaStorms(){
  const ti=T.tita;
  ti.out=4.2; ti.anger=1;
  ti.x=STAIRS.x+90; ti.y=STAIRS.y+120;
  ti.bark={text:"\u00A1Ya! Off the stairs!",life:2.4};
  sfx.broom();
  T.flash=.75; T.flashCol="255,120,160"; T.shake=11;
  if (T.carry.length){
    for (const k of T.carry){
      const s=tSpot(30);
      T.loose.push({ kind:k, x:s.x, y:s.y, spin:rand(-.5,.5), fresh:.6 });
    }
    tToast("dropped everything!","#ff9ec4");
    T.carry=[];
  } else {
    tToast("busted!","#ff9ec4");
  }
  T.player.freeze=1.5;
}

// ------------------------------------------------------------ end states
function tEnd(reason){
  if (!T.running) return;
  T.running=false;
  if (!T.won) sfx.over();
  if (T.score>T.best){ T.best=T.score; saveTitaBest(T.best); }
  const over=document.getElementById("gameover");
  over.classList.remove("won","lost");
  over.classList.add(T.won?"won":"lost");
  document.getElementById("overShot").style.backgroundImage = PHOTO_TITA;

  let title,line;
  if (T.won){
    title="You saved the toys!";
    line="You stashed "+T.banked+" things for "+T.score+" points and cleared "+T_WIN+
         " with "+Math.ceil(T.timeLeft)+"s left. Bernard got "+T.lost+
         " toys and "+T.strikes+" Crocs. Best: "+T.best+".";
  } else if (T.strikes>=T_STRIKES){
    title="Tita is not happy";
    line=reason+". "+T.strikes+" Crocs chewed to bits \u2014 you banked "+T.score+
         " points first. Best: "+T.best+".";
  } else {
    title="Time!";
    const gap=T_WIN-T.score;
    line="You stashed "+T.banked+" things for "+T.score+" points"+
         (gap>0?", "+gap+" short of saving the toy box":"")+
         ". Bernard got "+T.lost+" toys. Best: "+T.best+".";
  }
  document.getElementById("overTitle").textContent=title;
  document.getElementById("finalLine").textContent=line;
  over.classList.add("on");
}
function tWin(){
  if (!T.running) return;
  T.won=true; T.winFx=1.4;
  for(let i=0;i<120;i++){
    const cols=["#ffcf3a","#b6f23a","#ff8fc4","#6fd0ff","#fff6c9"];
    T.confetti.push({ x:rand(0,W), y:rand(-260,-10), vx:rand(-46,46), vy:rand(70,230),
      sz:rand(6,13), rot:rand(0,6.3), vr:rand(-7,7),
      col:cols[Math.floor(rand(0,cols.length))], life:rand(2.4,4.6) });
  }
  sfx.win();
  tEnd("cleared it");
}
function saveTitaBest(v){ try{ localStorage.setItem("tita_best",String(v)); }catch(e){} }
function loadTitaBest(){ try{ const v=+localStorage.getItem("tita_best"); if(v&&T) T.best=v; }catch(e){} }

// ------------------------------------------------------------ update
function updateTita(dt){
  if (!T) return;
  pollGamepad();
  T.t+=dt; T.pulse+=dt*3.4;
  comboTick(T,dt);
  T.dog.mood = T.dog.carrying ? "happy" : T.dog.flee>0 ? "worried" : undefined;

  for (const p of T.particles){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=340*dt; p.life-=dt; }
  T.particles=T.particles.filter(p=>p.life>0);
  for (const s of T.toasts){ s.y-=26*dt; s.life-=dt; }
  T.toasts=T.toasts.filter(s=>s.life>0);
  for (const c of T.confetti){ c.x+=c.vx*dt; c.y+=c.vy*dt; c.vy+=52*dt; c.rot+=c.vr*dt; c.life-=dt; }
  T.confetti=T.confetti.filter(c=>c.life>0&&c.y<H+40);
  T.shake=Math.max(0,T.shake-dt*30);
  T.flash=Math.max(0,T.flash-dt*2.2);
  T.winFx=Math.max(0,T.winFx-dt);
  if (!T.running) return;

  if (T.score>=T_WIN){ tWin(); return; }

  T.timeLeft-=dt;
  if (T.timeLeft<=0){ T.timeLeft=0; tEnd("clock ran out"); return; }
  T.shooCool=Math.max(0,T.shooCool-dt);
  T.nagCool=Math.max(0,T.nagCool-dt);

  // ---- player
  const p=T.player;
  p.freeze=Math.max(0,p.freeze-dt);
  let mx=0,my=0;
  if (p.freeze<=0){
    if (keys.has("ArrowLeft")||keys.has("KeyA"))  mx-=1;
    if (keys.has("ArrowRight")||keys.has("KeyD")) mx+=1;
    if (keys.has("ArrowUp")||keys.has("KeyW"))    my-=1;
    if (keys.has("ArrowDown")||keys.has("KeyS"))  my+=1;
    if (pointer.down){
      const dx=pointer.x-p.x, dy=pointer.y-p.y, d=Math.hypot(dx,dy);
      if (d>14){ mx=dx/d; my=dy/d; }
    }
  }
  const ml=Math.hypot(mx,my);
  if (ml>0){
    mx/=ml; my/=ml;
    const spd=210*(1-T.carry.length*.06);
    p.x+=mx*spd*dt; p.y+=my*spd*dt;
    p.phase+=dt*11; if (mx) p.face=mx>0?1:-1;
  } else p.phase+=dt*2.2;
  p.x=clamp(p.x,T_FIELD.x0,T_FIELD.x1); p.y=clamp(p.y,T_FIELD.y0,T_FIELD.y1);
  tPushOut(p);

  // ---- the stairs are a trap
  const onStairs = p.x < STAIRS.x+STAIRS.w && p.y < STAIRS.y+STAIRS.h;
  const ti=T.tita;
  if (onStairs && ti.out<=0){
    ti.anger=Math.min(1,ti.anger+dt/1.9);
    if (ti.anger<1 && T.nagCool<=0 && ti.anger>.35){
      tToast("she can hear you\u2026","#ff9ec4"); T.nagCool=1.3;
    }
    if (ti.anger>=1) titaStorms();
  } else if (ti.out<=0){
    ti.anger=Math.max(0,ti.anger-dt*.55);
  }

  // ---- Tita patrols when she's out
  if (ti.out>0){
    ti.out-=dt;
    const tx=clamp(p.x,STAIRS.x+40,STAIRS.x+STAIRS.w+150);
    const ty=clamp(p.y,STAIRS.y+40,STAIRS.y+STAIRS.h);
    const dx=tx-ti.x, dy=ty-ti.y, d=Math.hypot(dx,dy)||1;
    if (d>8){ ti.x+=dx/d*118*dt; ti.y+=dy/d*118*dt; ti.face=dx>0?1:-1; ti.phase+=dt*9; }
    if (ti.out<=0){ ti.anger=0; ti.x=STAIRS.x+70; ti.y=STAIRS.y+150; }
  }
  if (ti.bark){ ti.bark.life-=dt; if (ti.bark.life<=0) ti.bark=null; }

  // ---- toys keep landing on the floor
  T.spawnIn-=dt;
  const looseCount=T.loose.length;
  if (T.spawnIn<=0 && looseCount<5){
    const s=tSpot(30);
    T.loose.push({ kind:TOY_ROLL[Math.floor(rand(0,TOY_ROLL.length))],
                   x:s.x, y:s.y, spin:rand(-.5,.5), fresh:.7 });
    T.spawnIn=rand(1.7,2.9);
    sfx.pick("green");
  }
  for (const l of T.loose) if (l.fresh>0) l.fresh-=dt;

  // ---- pick things up by walking over them
  if (T.carry.length<T_CARRY && p.freeze<=0){
    for (let i=T.loose.length-1;i>=0;i--){
      const l=T.loose[i];
      if (Math.hypot(l.x-p.x,l.y-p.y)<34){
        T.carry.push(l.kind); T.loose.splice(i,1);
        sfx.pick(l.kind==="carrot"?"gold":"green"); tBurst(l.x,l.y,"#fff2b8",8);
        break;
      }
    }
    for (const sh of T.shoes){
      if (sh.gone) continue;
      if (T.carry.length>=T_CARRY) break;
      if (Math.hypot(sh.x-p.x,sh.y-p.y)<34){
        sh.gone=true; T.carry.push("croc");
        sfx.pick("red"); tBurst(sh.x,sh.y,"#ffc0dd",8);
        tToast("got a Croc \u2014 stash it!","#ffc0dd");
      }
    }
  }
  // ---- drop it all in the bin
  if (Math.hypot(p.x-T_BIN.x,p.y-T_BIN.y)<T_BIN.r+16) tBank();

  // ---- Bernard
  const d=T.dog;
  d.phase+=dt*(d.flee>0?13:8);
  d.wag+=dt*(d.carrying?13:6);
  if (d.bark){ d.bark.life-=dt; if (d.bark.life<=0) d.bark=null; }
  d.flee=Math.max(0,d.flee-dt);

  d.rest=Math.max(0,d.rest-dt);
  if (d.rest>0){
    d.target=null;
  } else if (d.flee>0){
    d.target=null;
    const dx=d.x-p.x, dy=d.y-p.y, dd=Math.hypot(dx,dy)||1;
    d.x+=dx/dd*200*dt; d.y+=dy/dd*200*dt; d.face=dx>0?0:Math.PI;
  } else if (d.carrying){
    const dx=DOGBED.x-d.x, dy=DOGBED.y-d.y, dd=Math.hypot(dx,dy)||1;
    if (dd>16){ d.x+=dx/dd*tDogSpeed()*dt; d.y+=dy/dd*tDogSpeed()*dt; d.face=dx>0?0:Math.PI; }
    else { d.carrying=null; d.rest=2.8; d.bark={text:"Heh.",life:1}; }
  } else {
    // every so often he gets a taste for footwear, and he announces it
    d.crocUrge-=dt;
    if (d.crocUrge<=0 && d.crocMode<=0 && T.shoes.some(s=>!s.gone)){
      d.crocMode=7; d.crocUrge=rand(13,17);
      d.bark={text:"Shoes\u2026",life:1.6};
      tToast("HE'S GOING FOR THE CROCS","#ff6a5e",d.x,d.y-58);
      sfx.bark();
    }
    if (d.crocMode>0) d.crocMode-=dt;

    let best=null, bestD=1e9;
    if (d.crocMode>0){
      for (const sh of T.shoes){
        if (sh.gone) continue;
        const dd=Math.hypot(sh.x-d.x,sh.y-d.y);
        if (dd<bestD){ bestD=dd; best=sh; }
      }
    }
    if (!best){
      for (const l of T.loose){
        const dd=Math.hypot(l.x-d.x,l.y-d.y);
        if (dd<bestD){ bestD=dd; best=l; }
      }
      for (const sh of T.shoes){
        if (sh.gone) continue;
        const dd=Math.hypot(sh.x-d.x,sh.y-d.y)*1.35;
        if (dd<bestD){ bestD=dd; best=sh; }
      }
    }
    d.target=best;
    if (best){
      const dx=best.x-d.x, dy=best.y-d.y, dd=Math.hypot(dx,dy)||1;
      if (dd>18){
        d.x+=dx/dd*tDogSpeed()*dt; d.y+=dy/dd*tDogSpeed()*dt;
        d.face=dx>0?0:Math.PI;
        d.chew=0;
      } else {
        d.chew+=dt;
        if (d.chew > (best.kind==="croc" ? 1.35 : .6)){
          d.chew=0;
          if (best.kind==="croc" && !best.gone){ best.gone=true; tDogGrabs(best); }
          else {
            const i=T.loose.indexOf(best);
            if (i>=0){ T.loose.splice(i,1); tDogGrabs(best); }
          }
        }
      }
    } else {
      d.target=null;
      d.x+=Math.cos(T.t*.7)*40*dt; d.y+=Math.sin(T.t*.5)*30*dt;
    }
  }
  d.x=clamp(d.x,T_FIELD.x0,T_FIELD.x1); d.y=clamp(d.y,T_FIELD.y0,T_FIELD.y1);
  tPushOut(d);
}

// ------------------------------------------------------------ room art
function bakeTitaRoom(){
  tbg=document.createElement("canvas"); tbg.width=W; tbg.height=H;
  const b=tbg.getContext("2d");

  // ---- back wall
  const wall=b.createLinearGradient(0,0,0,196);
  wall.addColorStop(0,"#efeae2"); wall.addColorStop(1,"#d8d1c6");
  b.fillStyle=wall; b.fillRect(0,0,W,196);

  // ---- wood plank floor, warm lamp light
  const fl=b.createLinearGradient(0,196,0,H);
  fl.addColorStop(0,"#c2a077"); fl.addColorStop(.5,"#b08d64"); fl.addColorStop(1,"#96754f");
  b.fillStyle=fl; b.fillRect(0,196,W,H-196);
  b.save(); b.beginPath(); b.rect(0,196,W,H-196); b.clip();
  b.translate(0,196);
  for (let row=0;row<9;row++){
    const y=row*58, off=(row%2)*90;
    for (let cx=-140;cx<W+160;cx+=210){
      const x=cx+off+row*24;
      b.fillStyle="rgba(255,255,255,"+(.02+(row%3)*.016)+")";
      b.fillRect(x,y,206,54);
      b.strokeStyle="rgba(72,46,24,.24)"; b.lineWidth=1.6;
      b.strokeRect(x+.5,y+.5,206,54);
      b.strokeStyle="rgba(120,86,50,.16)"; b.lineWidth=1;
      for(let g=0;g<3;g++){
        b.beginPath(); b.moveTo(x+12,y+12+g*15);
        b.bezierCurveTo(x+70,y+9+g*15,x+140,y+16+g*15,x+196,y+11+g*15); b.stroke();
      }
    }
    b.strokeStyle="rgba(60,38,18,.22)"; b.lineWidth=2;
    b.beginPath(); b.moveTo(0,y); b.lineTo(W,y); b.stroke();
  }
  b.restore();

  // ---- baseboard
  b.fillStyle="#f7f4ee"; b.fillRect(0,182,W,15);
  b.fillStyle="rgba(0,0,0,.13)"; b.fillRect(0,196,W,5);

  // ---- area rug under the coffee table
  b.save();
  b.fillStyle="#9c8676"; b.beginPath(); b.ellipse(455,432,268,146,0,0,Math.PI*2); b.fill();
  b.fillStyle="#8b7566"; b.beginPath(); b.ellipse(455,432,240,128,0,0,Math.PI*2); b.fill();
  b.strokeStyle="rgba(238,228,214,.34)"; b.lineWidth=3;
  for(let i=1;i<5;i++){ b.beginPath(); b.ellipse(455,432,60+i*44,32+i*24,0,0,Math.PI*2); b.stroke(); }
  b.restore();

  // ---- staircase, left. this is the no-go zone
  b.save();
  b.fillStyle="#e6e0d6"; b.fillRect(STAIRS.x,STAIRS.y-40,STAIRS.w,STAIRS.h+40);
  for(let i=0;i<7;i++){
    const y=STAIRS.y+18+i*40, w=STAIRS.w-i*7;
    b.fillStyle=i%2?"#cbbfab":"#d8cdba"; b.fillRect(STAIRS.x,y,w,30);
    b.fillStyle="rgba(255,255,255,.5)"; b.fillRect(STAIRS.x,y,w,5);
    b.fillStyle="rgba(60,40,22,.2)"; b.fillRect(STAIRS.x,y+30,w,5);
  }
  b.strokeStyle="#3a3229"; b.lineWidth=7; b.lineCap="round";
  b.beginPath(); b.moveTo(STAIRS.x+8,STAIRS.y+250); b.lineTo(STAIRS.w-6,STAIRS.y-24); b.stroke();
  b.lineWidth=4;
  for(let i=0;i<6;i++){
    const t=i/5, x=lerp(STAIRS.x+14,STAIRS.w-10,t), y=lerp(STAIRS.y+248,STAIRS.y-22,t);
    b.beginPath(); b.moveTo(x,y); b.lineTo(x,y+50); b.stroke();
  }
  b.restore();

  // ---- media console + TV on the back wall
  b.fillStyle="#f2eee7"; b.beginPath(); b.roundRect(510,150,290,42,7); b.fill();
  b.strokeStyle="rgba(90,70,48,.3)"; b.lineWidth=2;
  b.beginPath(); b.moveTo(606,150); b.lineTo(606,192); b.stroke();
  b.beginPath(); b.moveTo(702,150); b.lineTo(702,192); b.stroke();
  b.fillStyle="#1b1f22"; b.beginPath(); b.roundRect(534,44,242,102,7); b.fill();
  const scr=b.createLinearGradient(540,50,770,140);
  scr.addColorStop(0,"#2b7fa8"); scr.addColorStop(1,"#155a86");
  b.fillStyle=scr; b.fillRect(541,51,228,88);
  b.fillStyle="rgba(255,255,255,.16)";
  b.beginPath(); b.moveTo(541,120); b.lineTo(769,86); b.lineTo(769,139); b.lineTo(541,139); b.closePath(); b.fill();
  chunky(b,"BERNARD",655,86,17,"#ffd75e","#4a1f08",700);
  b.fillStyle="#b6f23a"; b.beginPath(); b.arc(655,110,7,0,Math.PI*2); b.fill();

  // ---- window, right wall
  b.fillStyle="#dfe8ef"; b.beginPath(); b.roundRect(838,40,54,140,5); b.fill();
  b.fillStyle="#1d2b39"; b.fillRect(844,46,42,128);
  b.strokeStyle="#f4f1ea"; b.lineWidth=4;
  b.beginPath(); b.moveTo(865,46); b.lineTo(865,174); b.stroke();
  b.beginPath(); b.moveTo(844,110); b.lineTo(886,110); b.stroke();

  // ---- white sectional along the bottom
  function couch(x,y,w,h){
    b.fillStyle="rgba(60,40,22,.2)";
    b.beginPath(); b.ellipse(x+w/2,y+h+6,w*.5,13,0,0,Math.PI*2); b.fill();
    b.fillStyle="#e9e6df"; b.beginPath(); b.roundRect(x,y,w,h,17); b.fill();
    b.fillStyle="#fbfaf7"; b.beginPath(); b.roundRect(x+9,y-16,w-18,h*.55,15); b.fill();
    b.strokeStyle="rgba(150,140,124,.5)"; b.lineWidth=2;
    b.beginPath(); b.moveTo(x+w/2,y-12); b.lineTo(x+w/2,y+h-12); b.stroke();
    b.fillStyle="rgba(255,255,255,.7)"; b.beginPath(); b.roundRect(x+7,y+5,w-14,9,5); b.fill();
  }
  couch(96,614,232,86);
  couch(486,620,246,86);

  // ---- gold coffee table
  b.fillStyle="rgba(50,32,16,.28)";
  b.beginPath(); b.ellipse(456,424,74,26,0,0,Math.PI*2); b.fill();
  const gd=b.createLinearGradient(392,372,520,440);
  gd.addColorStop(0,"#f0d489"); gd.addColorStop(.45,"#c99b34"); gd.addColorStop(1,"#8f671c");
  b.fillStyle=gd; b.beginPath(); b.ellipse(456,398,70,30,0,0,Math.PI*2); b.fill();
  b.fillStyle="#a97c26"; b.fillRect(386,398,140,22);
  b.beginPath(); b.ellipse(456,420,70,28,0,0,Math.PI*2); b.fill();
  b.fillStyle="rgba(255,244,206,.5)";
  b.beginPath(); b.ellipse(432,390,32,11,-.25,0,Math.PI*2); b.fill();

  // ---- dog bed, top right
  b.fillStyle="#c99a6f"; b.beginPath(); b.ellipse(DOGBED.x,DOGBED.y+6,66,32,0,0,Math.PI*2); b.fill();
  b.fillStyle="#e0b98d"; b.beginPath(); b.ellipse(DOGBED.x,DOGBED.y,54,24,0,0,Math.PI*2); b.fill();

  // ---- warm lamp pools + corner shade
  const lamp=b.createRadialGradient(620,300,30,620,300,420);
  lamp.addColorStop(0,"rgba(255,214,140,.24)"); lamp.addColorStop(1,"rgba(255,214,140,0)");
  b.fillStyle=lamp; b.fillRect(0,150,W,H-150);
  const cool=b.createRadialGradient(90,240,20,90,240,300);
  cool.addColorStop(0,"rgba(90,140,220,.16)"); cool.addColorStop(1,"rgba(90,140,220,0)");
  b.fillStyle=cool; b.fillRect(0,120,420,460);
}

// ------------------------------------------------------------ toy art
function drawToy(kind,x,y,s,spin){
  s=s||1;
  ctx.save(); ctx.translate(x,y); ctx.rotate(spin||0); ctx.scale(s,s);
  if (kind==="sloth"){
    softShadow(ctx,2,16,20,7,.3);
    ctx.strokeStyle="#a89b86"; ctx.lineWidth=7; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(-6,-4); ctx.lineTo(-22,-16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6,-4); ctx.lineTo(22,-16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5,10); ctx.lineTo(-16,20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5,10); ctx.lineTo(16,20); ctx.stroke();
    blob(ctx,0,4,11,14,0,"#bdb09a","#8a7d69");
    for(let i=0;i<9;i++){
      const a=i/9*6.28;
      ctx.strokeStyle="rgba(150,140,120,.75)"; ctx.lineWidth=1.8;
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*10,4+Math.sin(a)*13);
      ctx.lineTo(Math.cos(a)*15,4+Math.sin(a)*18); ctx.stroke();
    }
    orb(ctx,0,-11,9,"#c8bca7","#8f8370",false);
    ctx.fillStyle="#efe9dc"; ctx.beginPath(); ctx.ellipse(0,-9,6,4.6,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#4b4034";
    ctx.beginPath(); ctx.arc(-2.6,-11,1.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(2.6,-11,1.5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="#4b4034"; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.arc(0,-7,2.6,.2,Math.PI-.2); ctx.stroke();
  } else if (kind==="carrot"){
    softShadow(ctx,2,20,13,7,.3);
    const cg=ctx.createLinearGradient(-9,-22,9,24);
    cg.addColorStop(0,"#ffa63f"); cg.addColorStop(.5,"#f4751a"); cg.addColorStop(1,"#c9520c");
    ctx.fillStyle=cg;
    ctx.beginPath(); ctx.moveTo(-9,-20); ctx.lineTo(9,-20);
    ctx.quadraticCurveTo(6,16,0,26); ctx.quadraticCurveTo(-6,16,-9,-20); ctx.closePath(); ctx.fill();
    ctx.strokeStyle="rgba(150,58,6,.5)"; ctx.lineWidth=1.6;
    for(let i=0;i<7;i++){
      const t=i/7, yy=-16+t*38, hw=8.4*(1-t*.85);
      ctx.beginPath(); ctx.moveTo(-hw,yy); ctx.quadraticCurveTo(0,yy+3,hw,yy); ctx.stroke();
    }
    ctx.fillStyle="#6cae42";
    for(const a of [-.55,0,.55]){
      ctx.save(); ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(0,-26,4,9,0,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  } else if (kind==="gecko"){
    softShadow(ctx,2,14,21,7,.3);
    ctx.strokeStyle="#f0a24d"; ctx.lineWidth=7; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(-4,2); ctx.quadraticCurveTo(-20,4,-24,-12); ctx.stroke();
    ctx.strokeStyle="#eda054"; ctx.lineWidth=6;
    ctx.beginPath(); ctx.moveTo(-2,-6); ctx.lineTo(-14,-14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2,8); ctx.lineTo(-14,16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8,-6); ctx.lineTo(19,-13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8,8); ctx.lineTo(19,15); ctx.stroke();
    blob(ctx,0,1,15,10,0,"#f6ab5d","#c47822");
    ctx.fillStyle="#5ec8cf";
    for(const [sx,sy] of [[-7,-3],[-2,4],[4,-4],[8,3],[-9,4],[2,-6]]){
      ctx.beginPath(); ctx.ellipse(sx,sy,2.4,1.9,0,0,Math.PI*2); ctx.fill();
    }
    orb(ctx,15,2,8,"#f9b268","#c47822",false);
    for(const ey of [-3.4,3.4]){
      ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(18,ey,2.9,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#1a1410"; ctx.beginPath(); ctx.arc(18.6,ey,1.7,0,Math.PI*2); ctx.fill();
    }
  } else { // croc
    softShadow(ctx,2,10,15,6,.3);
    const pink=arguments[5]!==false;
    const lo=pink?"#e2609a":"#b9b4ab", hi=pink?"#ff9ec4":"#f2efe8";
    const g=ctx.createLinearGradient(-14,-8,14,10);
    g.addColorStop(0,hi); g.addColorStop(1,lo);
    ctx.fillStyle=g;
    ctx.beginPath();
    ctx.moveTo(-15,4); ctx.quadraticCurveTo(-16,-8,-4,-9);
    ctx.quadraticCurveTo(12,-10,15,0); ctx.quadraticCurveTo(16,9,4,10);
    ctx.quadraticCurveTo(-12,11,-15,4); ctx.closePath(); ctx.fill();
    ctx.fillStyle="rgba(0,0,0,.28)";
    for(const [hx,hy] of [[-6,-3],[0,-4],[6,-2],[-3,2],[3,1],[9,2]]){
      ctx.beginPath(); ctx.arc(hx,hy,1.5,0,Math.PI*2); ctx.fill();
    }
    ctx.strokeStyle=lo; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(-14,2); ctx.quadraticCurveTo(-19,7,-11,9); ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------ people art
function drawKid(){
  const p=T.player, bob=Math.sin(p.phase)*2.4;
  softShadow(ctx,p.x+7,p.y+20,20,8,.36);
  ctx.save(); ctx.translate(p.x,p.y+bob); ctx.scale(p.face,1);
  ctx.lineCap="round";
  // pink Crocs
  for (const [lx,sw] of [[-8,1],[8,-1]]){
    const sx=lx+Math.sin(p.phase)*5*sw;
    ctx.fillStyle="#ff8dc0";
    ctx.beginPath(); ctx.ellipse(sx,25,7.5,4.6,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(0,0,0,.22)";
    ctx.beginPath(); ctx.arc(sx-1.5,24,1,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx+1.5,24,1,0,Math.PI*2); ctx.fill();
  }
  // black joggers
  limb(ctx,-5,6,-8+Math.sin(p.phase)*5,22,7,"#3a3a40","#17171c");
  limb(ctx,5,6,8-Math.sin(p.phase)*5,22,7,"#3a3a40","#17171c");
  // white tee
  blob(ctx,0,-2,13,15,0,"#fdfdfb","#cfcabd");
  // the 100 days graphic
  ctx.fillStyle="#f0709a"; ctx.beginPath(); ctx.arc(-2.5,-2,3.4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#59b7c9"; ctx.beginPath(); ctx.arc(2.5,-2,3.4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#e8b93f"; ctx.beginPath(); ctx.arc(0,-7,2.4,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="#57a05a"; ctx.lineWidth=1.6;
  ctx.beginPath(); ctx.arc(0,-2,7.5,.5,2.6); ctx.stroke();
  // arms
  limb(ctx,-11,-6,-16-Math.sin(p.phase)*4,7,5,"#e8b48c","#b8804f");
  limb(ctx,11,-6,16+Math.sin(p.phase)*4,7,5,"#e8b48c","#b8804f");
  // head + long brown hair
  ctx.fillStyle="#5b3a22";
  ctx.beginPath(); ctx.ellipse(-1,-19,12.5,13,0,0,Math.PI*2); ctx.fill();
  orb(ctx,2,-19,9.5,"#f3c299","#c08a56",false);
  ctx.fillStyle="#6b452a";
  ctx.beginPath(); ctx.ellipse(1,-26,11,6.5,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-8,-16,5,11,.2,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#2b1d12";
  ctx.beginPath(); ctx.arc(6,-20,1.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(10.5,-20,1.5,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="#b5705c"; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(8.4,-16,2.4,.25,Math.PI-.25); ctx.stroke();
  ctx.fillStyle="#ff9ec4";
  ctx.beginPath(); ctx.arc(-2,-29,2.6,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // whatever she's hauling, stacked overhead
  T.carry.forEach((k,i)=>{
    const a=T.t*2.1+i*(6.283/Math.max(T.carry.length,1));
    drawToy(k,p.x+Math.cos(a)*17,p.y-44+bob+Math.sin(a)*5-i*3,.62,Math.sin(a)*.3,false);
  });
  if (T.player.freeze>0){
    chunky(ctx,"!",p.x,p.y-62+bob,22,"#ff9ec4","#5a1030",700);
  }
}

function drawTitaChar(){
  const ti=T.tita;
  if (ti.out<=0){
    // just her shadow on the stairs, waiting
    const a=.18+ti.anger*.5;
    ctx.fillStyle="rgba(30,18,24,"+a+")";
    ctx.beginPath(); ctx.ellipse(STAIRS.x+72,STAIRS.y+120,34,54,0,0,Math.PI*2); ctx.fill();
    if (ti.anger>.25){
      ctx.globalAlpha=clamp(ti.anger,0,1);
      chunky(ctx,"\uD83D\uDC40",STAIRS.x+72,STAIRS.y+96,26,"#ff9ec4","#5a1030",700);
      ctx.globalAlpha=1;
    }
    return;
  }
  const bob=Math.sin(ti.phase)*2.6;
  softShadow(ctx,ti.x+8,ti.y+22,22,9,.4);
  ctx.save(); ctx.translate(ti.x,ti.y+bob); ctx.scale(ti.face,1);
  ctx.lineCap="round";
  // flip flops
  for (const [lx,sw] of [[-7,1],[7,-1]]){
    const sx=lx+Math.sin(ti.phase)*5*sw;
    ctx.fillStyle="#2a2a30";
    ctx.beginPath(); ctx.ellipse(sx,27,6.5,3.6,0,0,Math.PI*2); ctx.fill();
  }
  limb(ctx,-5,8,-7+Math.sin(ti.phase)*5,24,6.5,"#e8b48c","#b8804f");
  limb(ctx,5,8,7-Math.sin(ti.phase)*5,24,6.5,"#e8b48c","#b8804f");
  // coral dress
  const dg=ctx.createLinearGradient(-15,-16,15,12);
  dg.addColorStop(0,"#ff9d80"); dg.addColorStop(1,"#e2664c");
  ctx.fillStyle=dg;
  ctx.beginPath();
  ctx.moveTo(-12,-16); ctx.lineTo(12,-16);
  ctx.quadraticCurveTo(18,4,16,12); ctx.lineTo(-16,12);
  ctx.quadraticCurveTo(-18,4,-12,-16); ctx.closePath(); ctx.fill();
  ctx.fillStyle="#ffb59c";
  ctx.beginPath(); ctx.ellipse(-12,-13,5,5.5,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(12,-13,5,5.5,0,0,Math.PI*2); ctx.fill();
  // arms, one wagging
  const wag=Math.sin(T.t*13)*7;
  limb(ctx,-13,-10,-19,6,5,"#e8b48c","#b8804f");
  limb(ctx,13,-10,20,-14+wag,5,"#e8b48c","#b8804f");
  // the pointing finger
  ctx.fillStyle="#f0bd93";
  ctx.beginPath(); ctx.arc(21,-15+wag,3,0,Math.PI*2); ctx.fill();
  // head, dark hair pulled back
  ctx.fillStyle="#2e2018";
  ctx.beginPath(); ctx.ellipse(0,-24,11.5,11.5,0,0,Math.PI*2); ctx.fill();
  orb(ctx,1.5,-23,9.2,"#efbe95","#bd8654",false);
  ctx.fillStyle="#2e2018";
  ctx.beginPath(); ctx.ellipse(0,-30,10.5,6,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-9,-26,4,6,.3,0,Math.PI*2); ctx.fill();
  // stern brows and open scolding mouth
  ctx.strokeStyle="#2e2018"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(2,-27.5); ctx.lineTo(7,-26); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(9.5,-26); ctx.lineTo(13,-27.5); ctx.stroke();
  ctx.fillStyle="#2b1d12";
  ctx.beginPath(); ctx.arc(5,-23.5,1.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(10.5,-23.5,1.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#8e3040";
  ctx.beginPath(); ctx.ellipse(8,-18,3.4,2.6+Math.sin(T.t*15)*.9,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
  if (ti.bark) bubble(ti.x,ti.y-56,ti.bark,"#fff0f5","#7a1436");
}

// ------------------------------------------------------------ HUD + draw
function drawTitaHUD(){
  goldPanel(ctx,16,14,182,52,13);
  ctx.textAlign="left"; ctx.textBaseline="middle";
  chunky(ctx,String(T.score),30,38,26,"#fff6c9","#4a1f08",700);
  ctx.textAlign="right";
  ctx.font="600 11px Fredoka, system-ui, sans-serif";
  ctx.fillStyle="rgba(255,255,255,.5)"; ctx.fillText("BEST "+T.best,186,30);

  const gw=154,gx=25,gy=76,gf=clamp(T.score/T_WIN,0,1);
  ctx.fillStyle="rgba(6,18,10,.7)";
  ctx.beginPath(); ctx.roundRect(gx-5,gy-5,gw+10,20,9); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,.5)";
  ctx.beginPath(); ctx.roundRect(gx,gy,gw,11,6); ctx.fill();
  const gg=ctx.createLinearGradient(0,gy,0,gy+11);
  if (gf>=.8){ gg.addColorStop(0,"#fff6c9"); gg.addColorStop(1,"#e0a512"); }
  else { gg.addColorStop(0,"#a9ef5e"); gg.addColorStop(1,"#59a012"); }
  ctx.fillStyle=gg; ctx.beginPath(); ctx.roundRect(gx,gy,Math.max(5,gw*gf),11,6); ctx.fill();
  ctx.textAlign="left"; ctx.font="600 10px Fredoka, system-ui, sans-serif";
  ctx.fillStyle="rgba(255,255,255,.62)";
  ctx.fillText("TOY BOX  "+T.score+" / "+T_WIN,gx+2,gy+25);

  // clock
  const low=T.timeLeft<=15;
  goldPanel(ctx,W/2-58,14,116,44,12);
  ctx.textAlign="center";
  const mm=Math.floor(T.timeLeft/60), ss=Math.floor(T.timeLeft%60);
  chunky(ctx,mm+":"+String(ss).padStart(2,"0"),W/2,36,23,
    low?(Math.sin(T.pulse*5)>0?"#ff8a7a":"#fff6c9"):"#fff6c9","#4a1f08",700);

  // crocs remaining
  goldPanel(ctx,W-186,14,170,52,13);
  ctx.textAlign="left";
  ctx.font="600 10px Fredoka, system-ui, sans-serif";
  ctx.fillStyle="rgba(255,255,255,.55)";
  ctx.fillText("CROCS CHEWED",W-172,27);
  for(let i=0;i<T_STRIKES;i++){
    const cx=W-166+i*26, gone=i<T.strikes;
    ctx.globalAlpha=gone?1:.28;
    drawToy("croc",cx,48,.62,0,true);
    ctx.globalAlpha=1;
    if (gone){
      ctx.strokeStyle="#ff5a48"; ctx.lineWidth=2.6;
      ctx.beginPath(); ctx.moveTo(cx-8,42); ctx.lineTo(cx+8,54); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+8,42); ctx.lineTo(cx-8,54); ctx.stroke();
    }
  }

  // shoo cooldown
  const sr=30, sx=W-64, sy=H-64;
  ctx.fillStyle=T.shooCool>0?"rgba(20,26,20,.55)":"rgba(182,242,58,.9)";
  ctx.beginPath(); ctx.arc(sx,sy,sr,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="rgba(255,255,255,.5)"; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(sx,sy,sr,0,Math.PI*2); ctx.stroke();
  if (T.shooCool>0){
    ctx.strokeStyle="#b6f23a"; ctx.lineWidth=5;
    ctx.beginPath(); ctx.arc(sx,sy,sr-4,-Math.PI/2,-Math.PI/2+(1-T.shooCool/3)*6.283); ctx.stroke();
  }
  ctx.textAlign="center"; ctx.textBaseline="middle";
  chunky(ctx,"SHOO",sx,sy,13,T.shooCool>0?"#8fa07f":"#28450f","rgba(0,0,0,.35)",700);

  // carry pips
  ctx.textAlign="center";
  for(let i=0;i<T_CARRY;i++){
    const cx=W/2-26+i*26, has=i<T.carry.length;
    ctx.fillStyle=has?"#b6f23a":"rgba(255,255,255,.2)";
    ctx.beginPath(); ctx.arc(cx,H-30,8,0,Math.PI*2); ctx.fill();
  }
  ctx.font="600 10px Fredoka, system-ui, sans-serif";
  ctx.fillStyle="rgba(255,255,255,.6)";
  ctx.fillText(T.carry.length?"carrying "+tCarryValue()+" \u2014 get to the bin":"grab the toys",W/2,H-50);
}

function drawTita(){
  ctx.save();
  if (T.shake>.4){
    const s=T.shake*.5;
    ctx.translate(rand(-s,s),rand(-s,s));
  }
  ctx.drawImage(tbg,0,0);

  // the stairs glow hotter the angrier she gets
  const ti=T.tita, warn=ti.out>0?1:ti.anger;
  if (warn>.02){
    ctx.save();
    ctx.globalAlpha=.16+warn*.4;
    const wg=ctx.createLinearGradient(STAIRS.x,0,STAIRS.x+STAIRS.w+60,0);
    wg.addColorStop(0,"rgba(255,90,140,.9)"); wg.addColorStop(1,"rgba(255,90,140,0)");
    ctx.fillStyle=wg; ctx.fillRect(STAIRS.x,STAIRS.y-40,STAIRS.w+60,STAIRS.h+40);
    ctx.restore();
  }
  ctx.setLineDash([9,8]);
  ctx.strokeStyle="rgba(255,120,160,"+(.25+warn*.5)+")"; ctx.lineWidth=3;
  ctx.beginPath();
  ctx.moveTo(STAIRS.x+STAIRS.w,STAIRS.y-40); ctx.lineTo(STAIRS.x+STAIRS.w,STAIRS.y+STAIRS.h);
  ctx.lineTo(STAIRS.x,STAIRS.y+STAIRS.h); ctx.stroke();
  ctx.setLineDash([]);

  // toy bin
  softShadow(ctx,T_BIN.x+5,T_BIN.y+26,44,14,.35);
  const bg2=ctx.createLinearGradient(T_BIN.x-44,T_BIN.y-30,T_BIN.x+44,T_BIN.y+28);
  bg2.addColorStop(0,"#7fc8e8"); bg2.addColorStop(1,"#2f7fae");
  ctx.fillStyle=bg2;
  ctx.beginPath(); ctx.roundRect(T_BIN.x-44,T_BIN.y-26,88,54,10); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.32)";
  ctx.beginPath(); ctx.roundRect(T_BIN.x-44,T_BIN.y-26,88,13,7); ctx.fill();
  ctx.textAlign="center"; ctx.textBaseline="middle";
  chunky(ctx,"TOYS",T_BIN.x,T_BIN.y+6,15,"#fff6c9","#12405c",700);
  if (T.carry.length){
    const pl=(Math.sin(T.pulse*3)+1)/2;
    ctx.strokeStyle="rgba(182,242,58,"+(.4+pl*.5)+")"; ctx.lineWidth=4;
    ctx.beginPath(); ctx.roundRect(T_BIN.x-49,T_BIN.y-31,98,64,13); ctx.stroke();
  }

  // loose things on the floor
  for (const sh of T.shoes){ if (!sh.gone) drawToy("croc",sh.x,sh.y,1,sh.spin,sh.pink); }
  for (const l of T.loose){
    if (l.fresh>0){
      ctx.strokeStyle="rgba(255,246,201,"+clamp(l.fresh,0,1)*.8+")"; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(l.x,l.y,26+(1-l.fresh)*16,0,Math.PI*2); ctx.stroke();
    }
    drawToy(l.kind,l.x,l.y,1,l.spin);
  }

  // what Bernard is stalking right now
  if (T.dog.crocMode>0 && T.dog.flee<=0 && !T.dog.carrying){
    const pl=(Math.sin(T.pulse*5)+1)/2;
    ctx.strokeStyle="rgba(255,90,110,"+(.35+pl*.4)+")"; ctx.lineWidth=3;
    ctx.beginPath(); ctx.ellipse(T.dog.x,T.dog.y+16,40,15,0,0,Math.PI*2); ctx.stroke();
  }
  const tg=T.dog.target;
  if (tg && !tg.gone && T.dog.flee<=0 && !T.dog.carrying){
    const croc=tg.kind==="croc", pl=(Math.sin(T.pulse*4)+1)/2;
    ctx.strokeStyle=croc?"rgba(255,90,110,"+(.5+pl*.45)+")":"rgba(255,190,90,"+(.32+pl*.3)+")";
    ctx.lineWidth=croc?4:3;
    ctx.setLineDash([7,6]);
    ctx.beginPath(); ctx.arc(tg.x,tg.y,26+pl*4,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    if (T.dog.chew>0){
      ctx.strokeStyle=croc?"#ff5a6e":"#ffbe5a"; ctx.lineWidth=5;
      const lim=croc?1.35:.6;
      ctx.beginPath(); ctx.arc(tg.x,tg.y,32,-Math.PI/2,-Math.PI/2+clamp(T.dog.chew/lim,0,1)*6.283); ctx.stroke();
    }
  }

  // actors, sorted so the closer one overlaps
  const cast=[
    {y:T.dog.y, f:()=>{
        drawDog(T.dog,T.t);
        if (T.dog.carrying){
          const fx=Math.cos(T.dog.face)<0?T.dog.x-36:T.dog.x+36;
          drawToy(T.dog.carrying,fx,T.dog.y-6,.7,Math.sin(T.t*8)*.2,false);
        }
      }},
    {y:T.player.y, f:drawKid},
    {y:T.tita.out>0?T.tita.y:-1, f:drawTitaChar}
  ].sort((a,b)=>a.y-b.y);
  for (const c of cast) c.f();

  for (const p of T.particles){
    ctx.globalAlpha=clamp(p.life*1.7,0,1);
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
  for (const c of T.confetti){
    ctx.globalAlpha=clamp(c.life,0,1);
    ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.rot);
    ctx.fillStyle=c.col; ctx.fillRect(-c.sz/2,-c.sz/3,c.sz,c.sz*.66);
    ctx.restore();
  }
  ctx.globalAlpha=1;

  ctx.textAlign="center"; ctx.textBaseline="middle";
  for (const s of T.toasts){
    ctx.globalAlpha=clamp(s.life*1.5,0,1);
    chunky(ctx,s.text,s.x,s.y,17,s.color,"#231206",700);
  }
  ctx.globalAlpha=1;

  if (!POSTER){ drawMotes(T.t); drawTitaHUD(); comboDraw(T,W/2,86); }
  ctx.restore();

  drawGlass();
  if (T.flash>0){
    ctx.fillStyle="rgba("+T.flashCol+","+(T.flash*.24)+")";
    ctx.fillRect(0,0,W,H);
  }
}

// ================================================================
//  BERNARDY FLAP  —  he finally learns to fly. Badly.
// ================================================================
const F_GRAV = 940, F_FLAP = -368, F_TERM = 505;
const F_GROUND = 596, F_CEIL = 8;
// no win line — Bernardy Flap is a personal-best chase
const F_GATE = 10, F_BALL = 25;          // scoring

let F = null;
let fbg = null;

function newFlap(best){
  return {
    combo:{n:0,t:0,mult:1,pop:0},
    t:0, pulse:0, running:true, started:false, won:false,
    score:0, best:best||0, passed:0, balls:0,
    bird:{ x:214, y:300, vy:0, flap:0, wing:0, tilt:0 },
    gates:[], nextX:640, scroll:0, cloudX:0,
    speed:172, shake:0, flash:0, flashCol:"224,58,47",
    toasts:[], particles:[], confetti:[], winFx:0, deadFor:0
  };
}
const fGapH  = () => Math.max(176, 244 - F.passed*2.0);
const fSpeed = () => Math.min(272, 164 + F.passed*2.8);

function fToast(text,color,x,y){
  F.toasts.push({text,color,x:x===undefined?W/2:x,y:y===undefined?200:y,life:1.1});
}
function fBurst(x,y,color,n){
  for(let i=0;i<n;i++){
    const a=rand(0,6.28), s=rand(60,220);
    F.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-50,life:rand(.3,.7),color,r:rand(2,5)});
  }
}
function flapJump(){
  if (!F || !F.running) return;
  if (!F.started){ F.started=true; }
  F.bird.vy = F_FLAP;
  F.bird.flap = 1;
  sfx.flap();
  fBurst(F.bird.x-22,F.bird.y+10,"rgba(255,255,255,.85)",5);
}
function fSpawnGate(){
  const gh=fGapH();
  const gy=rand(96+gh/2, F_GROUND-84-gh/2);
  F.gates.push({
    x:F.nextX, gapY:gy, gapH:gh, passed:false,
    ball:{ y:gy+rand(-gh*.22,gh*.22), taken:false, spin:0 },
    kind: Math.random()<.22 ? "gold" : "green"
  });
  F.nextX += rand(268,326);
}
function fEnd(reason){
  if (!F.running) return;
  F.running=false;
  const newBest = F.score>F.best && F.score>0;
  if (newBest){
    F.best=F.score; saveFlapBest(F.best); F.won=true; sfx.win();
    const cols=["#ffcf3a","#b6f23a","#ff8fc4","#6fd0ff","#fff6c9"];
    for(let i=0;i<90;i++)
      F.confetti.push({ x:rand(0,W), y:rand(-240,-10), vx:rand(-46,46), vy:rand(70,230),
        sz:rand(6,13), rot:rand(0,6.3), vr:rand(-7,7),
        col:cols[Math.floor(rand(0,cols.length))], life:rand(2.2,4.2) });
  } else sfx.over();
  const over=document.getElementById("gameover");
  over.classList.remove("won","lost");
  over.classList.add(newBest?"won":"lost");
  document.getElementById("overShot").style.backgroundImage="var(--ph-flap)";
  const title = newBest ? "New best!" : reason==="ground" ? "Belly landing" : "Splat";
  const line = (reason==="ground" ? "He skimmed into the grass" : "He clipped the bricks")+
        " after "+F.passed+" gates. "+F.score+" points, "+F.balls+" balls"+
        (newBest ? " \u2014 your best yet." : ". Best so far: "+F.best+".");
  document.getElementById("overTitle").textContent=title;
  document.getElementById("finalLine").textContent=line;
  over.classList.add("on");
}
function saveFlapBest(v){ try{ localStorage.setItem("flap_best",String(v)); }catch(e){} }
function loadFlapBest(){ try{ const v=+localStorage.getItem("flap_best"); if(v&&F) F.best=v; }catch(e){} }

// ------------------------------------------------------------ update
function updateFlap(dt){
  if (!F) return;
  pollGamepad();
  F.t+=dt; F.pulse+=dt*3.4;
  F.cloudX-=dt*14;
  comboTick(F,dt);
  F.trail=F.trail||[]; trailTick(F.trail,dt);
  if (F.started && F.running) trailPush(F.trail,F.bird.x,F.bird.y,{tilt:F.bird.tilt});

  for (const p of F.particles){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=320*dt; p.life-=dt; }
  F.particles=F.particles.filter(p=>p.life>0);
  for (const s of F.toasts){ s.y-=26*dt; s.life-=dt; }
  F.toasts=F.toasts.filter(s=>s.life>0);
  for (const c of F.confetti){ c.x+=c.vx*dt; c.y+=c.vy*dt; c.vy+=52*dt; c.rot+=c.vr*dt; c.life-=dt; }
  F.confetti=F.confetti.filter(c=>c.life>0&&c.y<H+40);
  F.shake=Math.max(0,F.shake-dt*30);
  F.flash=Math.max(0,F.flash-dt*2.2);
  F.winFx=Math.max(0,F.winFx-dt);
  F.bird.flap=Math.max(0,F.bird.flap-dt*3.4);
  F.bird.wing+=dt*(F.bird.flap>0?26:11);

  if (!F.running){ F.deadFor+=dt; return; }

  const b=F.bird;
  if (!F.started){
    // hovering on the title beat, waiting for the first flap
    b.y = 300 + Math.sin(F.t*3)*12;
    b.tilt = Math.sin(F.t*3)*.08;
    return;
  }

  b.vy = Math.min(F_TERM, b.vy + F_GRAV*dt);
  b.y += b.vy*dt;
  b.tilt = clamp(b.vy/620, -.62, 1.05);

  const sp=fSpeed();
  F.scroll += sp*dt;
  F.nextX  -= sp*dt;
  for (const g of F.gates) g.x -= sp*dt;
  while (F.nextX < W+180) fSpawnGate();
  F.gates=F.gates.filter(g=>g.x>-130);

  // ---- ground and ceiling
  if (b.y > F_GROUND-22){
    b.y=F_GROUND-22; F.flash=1; F.shake=14; sfx.squish();
    fBurst(b.x,b.y+14,"#8fbe52",18); fEnd("ground"); return;
  }
  if (b.y < F_CEIL+20){
    b.y=F_CEIL+20; b.vy=40; F.flash=.5; F.shake=7;
    if (!F.roofWarned){ F.roofWarned=true; fToast("too high!","#ffd36a",b.x,b.y+50); }
  }

  // ---- gates
  const BR=19;
  for (const g of F.gates){
    const halfW=34;
    const inX = b.x+BR > g.x-halfW && b.x-BR < g.x+halfW;
    if (inX){
      const top=g.gapY-g.gapH/2, bot=g.gapY+g.gapH/2;
      if (b.y-BR < top || b.y+BR > bot){
        F.flash=1; F.shake=15; sfx.squish();
        fBurst(b.x,b.y,"#c2703f",20); fEnd("gate"); return;
      }
    }
    if (!g.passed && g.x+34 < b.x-BR){
      g.passed=true;
      F.passed++;
      // a near-miss on either lip pays extra, a clean centre pass doesn't
      const edge=Math.min(Math.abs(b.y-BR-(g.gapY-g.gapH/2)), Math.abs(g.gapY+g.gapH/2-(b.y+BR)));
      const close = edge<14 ? 8 : 0;
      const gained=F_GATE+close;
      F.score+=gained;
      sfx.gate();
      fToast("+"+gained+(close?"  CLOSE!":""), close?"#ffcf3a":"#b6f23a", b.x+40, b.y-38);
      if (close) fBurst(b.x,b.y,"#ffe07a",10);
    }
    // floating ball in the gap
    const bl=g.ball;
    if (!bl.taken){
      bl.spin+=dt*3;
      if (Math.hypot(g.x-b.x, bl.y-b.y) < BR+14){
        bl.taken=true;
        const m=comboHit(F,g.x,bl.y,fToast);
        const gained=F_BALL*m;
        F.balls++; F.score+=gained;
        sfx.pick(g.kind);
        fBurst(g.x,bl.y,g.kind==="gold"?"#ffcf3a":"#b6f23a",14);
        fToast("+"+gained,"#ffe07a",g.x,bl.y-30);
      }
    }
  }
}

// ------------------------------------------------------------ sky art
function bakeFlapSky(){
  fbg=document.createElement("canvas"); fbg.width=W; fbg.height=H;
  const b=fbg.getContext("2d");

  const sky=b.createLinearGradient(0,0,0,F_GROUND);
  sky.addColorStop(0,"#6fc4e8"); sky.addColorStop(.55,"#a8dcf0"); sky.addColorStop(1,"#dff0e2");
  b.fillStyle=sky; b.fillRect(0,0,W,F_GROUND);

  // low sun glow, matching the yard's golden hour
  const sun=b.createRadialGradient(120,110,20,120,110,340);
  sun.addColorStop(0,"rgba(255,236,170,.85)"); sun.addColorStop(1,"rgba(255,220,140,0)");
  b.fillStyle=sun; b.fillRect(0,0,W,F_GROUND);

  // distant treeline
  b.fillStyle="rgba(70,120,78,.4)";
  for(let x=-40;x<W+60;x+=64){
    const h=44+Math.sin(x*.07)*18;
    b.beginPath(); b.ellipse(x,F_GROUND-104,46,h,0,0,Math.PI*2); b.fill();
  }
  // the brick fence he keeps trying to clear
  b.fillStyle="#b3714a"; b.fillRect(0,F_GROUND-84,W,52);
  b.strokeStyle="rgba(90,52,28,.34)"; b.lineWidth=2;
  for(let r=0;r<3;r++){
    const y=F_GROUND-84+r*17;
    b.beginPath(); b.moveTo(0,y); b.lineTo(W,y); b.stroke();
    for(let x=(r%2)*34;x<W;x+=68){ b.beginPath(); b.moveTo(x,y); b.lineTo(x,y+17); b.stroke(); }
  }
  b.fillStyle="#cf9166"; b.fillRect(0,F_GROUND-90,W,8);

  // grass
  const gr=b.createLinearGradient(0,F_GROUND-32,0,H);
  gr.addColorStop(0,"#67b543"); gr.addColorStop(1,"#2c6330");
  b.fillStyle=gr; b.fillRect(0,F_GROUND-32,W,H-F_GROUND+32);
  b.strokeStyle="rgba(30,72,34,.4)"; b.lineWidth=2;
  for(let x=0;x<W;x+=13){
    const h=9+Math.sin(x*.6)*5;
    b.beginPath(); b.moveTo(x,F_GROUND-26); b.lineTo(x+4,F_GROUND-26-h); b.stroke();
  }
}
function drawCloud(x,y,s){
  ctx.fillStyle="rgba(255,255,255,.82)";
  ctx.beginPath();
  ctx.ellipse(x,y,38*s,20*s,0,0,Math.PI*2);
  ctx.ellipse(x+30*s,y+5*s,26*s,15*s,0,0,Math.PI*2);
  ctx.ellipse(x-30*s,y+6*s,24*s,14*s,0,0,Math.PI*2);
  ctx.ellipse(x+6*s,y-14*s,24*s,16*s,0,0,Math.PI*2);
  ctx.fill();
}

// ------------------------------------------------------------ flying Bernard
function drawFlapBernard(){
  const b=F.bird;
  const wing = Math.sin(b.wing)*(b.flap>0?1:.55);
  ctx.save();
  ctx.translate(b.x,b.y);
  ctx.rotate(b.tilt);
  ctx.lineCap="round";

  // ---- back ear, beating like a wing
  ctx.save(); ctx.rotate(-.35+wing*.85);
  const bw=ctx.createLinearGradient(0,-6,-6,-52);
  bw.addColorStop(0,"#3a322b"); bw.addColorStop(1,"#6d5946");
  ctx.fillStyle=bw;
  ctx.beginPath();
  ctx.moveTo(-4,-6); ctx.quadraticCurveTo(-30,-46,-2,-54);
  ctx.quadraticCurveTo(16,-40,10,-4); ctx.closePath(); ctx.fill();
  fur(ctx,-6,-34,14,20,7,9,"rgba(190,150,96,.55)",Math.PI,2.4);
  ctx.restore();

  // ---- plumed tail streaming behind
  const tw=Math.sin(b.wing*.6)*7;
  limb(ctx,-15,3,-34,-4+tw,12,"#d9a257","#8f6224");
  limb(ctx,-32,-3+tw,-44,-9+tw,9,"#cdc4b2","#8b8172");

  // ---- tucked legs
  limb(ctx,-4,12,-9,22+Math.sin(b.wing)*3,6,"#c4883f","#8a5a24");
  limb(ctx,7,12,3,21-Math.sin(b.wing)*3,6,"#c4883f","#8a5a24");

  // ---- body
  blob(ctx,0,2,22,15,-.1,"#e3ac60","#a0702c");
  blob(ctx,-3,-4,20,10,-.12,"#4b4139","#201c19");
  fur(ctx,-3,-4,20,10,11,8,"rgba(38,32,28,.65)",Math.PI,3.25);
  blob(ctx,14,5,10,11,0,"#eec078","#ac7e36");
  orb(ctx,18,8,4.6,"#fdfaf0","#c9c0ac",false);

  // ---- head
  orb(ctx,20,-9,11.5,"#584c42","#211d1a",false);
  fur(ctx,20,-9,11.5,11.5,8,6,"rgba(48,40,34,.7)",Math.PI*1.1,1.5);
  blob(ctx,15,-4,7.5,7.5,0,"#c98d3f","#8d5f24");
  blob(ctx,29,-6,9.5,6,.12,"#2c2724","#100e0d");
  orb(ctx,37,-6,3.2,"#4a423c","#100e0d",false);
  ctx.fillStyle="rgba(255,255,255,.5)";
  ctx.beginPath(); ctx.ellipse(36,-7.3,1.4,.9,-.4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(196,140,66,.85)";
  ctx.beginPath(); ctx.ellipse(21,-17,2.5,1.6,-.25,0,Math.PI*2); ctx.fill();
  orb(ctx,23,-12.5,3.4,"#eab04d","#8a5a25",false);
  ctx.fillStyle="#140e08"; ctx.beginPath(); ctx.arc(23.8,-12.5,1.7,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.9)";
  ctx.beginPath(); ctx.arc(22.1,-13.9,1.1,0,Math.PI*2); ctx.fill();
  // tongue flying out behind him
  const tl=5+Math.max(0,b.vy)*.012;
  ctx.fillStyle="#e8808f";
  ctx.beginPath(); ctx.roundRect(30,-2,5,tl,3); ctx.fill();
  // collar
  const cg=ctx.createLinearGradient(9,-13,15,3);
  cg.addColorStop(0,"#ff6a5a"); cg.addColorStop(1,"#b52418");
  ctx.strokeStyle=cg; ctx.lineWidth=5.5;
  ctx.beginPath(); ctx.moveTo(10,-13); ctx.lineTo(13,3); ctx.stroke();

  // ---- front ear-wing, the big one
  ctx.save(); ctx.rotate(-.2+wing);
  const fw=ctx.createLinearGradient(6,-8,4,-62);
  fw.addColorStop(0,"#4b4139"); fw.addColorStop(.6,"#7d5f45"); fw.addColorStop(1,"#c19a6b");
  ctx.fillStyle=fw;
  ctx.beginPath();
  ctx.moveTo(6,-8); ctx.quadraticCurveTo(-16,-52,10,-64);
  ctx.quadraticCurveTo(30,-46,22,-6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle="rgba(60,46,32,.5)"; ctx.lineWidth=2;
  for(let i=0;i<4;i++){
    ctx.beginPath(); ctx.moveTo(9+i*3,-14-i*2);
    ctx.quadraticCurveTo(4+i*4,-38,12+i*2.5,-58+i*3); ctx.stroke();
  }
  fur(ctx,10,-40,15,22,9,10,"rgba(210,172,116,.6)",Math.PI,2.3);
  ctx.restore();

  ctx.restore();
}

// ------------------------------------------------------------ draw
function drawFlapGate(g){
  const halfW=34, top=g.gapY-g.gapH/2, bot=g.gapY+g.gapH/2;
  function pillar(y0,y1){
    const px=g.x-halfW;
    const bg=ctx.createLinearGradient(px,0,px+halfW*2,0);
    bg.addColorStop(0,"#8f5530"); bg.addColorStop(.35,"#c07a4a");
    bg.addColorStop(.7,"#a9663c"); bg.addColorStop(1,"#7d4a29");
    ctx.fillStyle=bg; ctx.fillRect(px,y0,halfW*2,y1-y0);
    ctx.strokeStyle="rgba(80,44,22,.42)"; ctx.lineWidth=2;
    for(let y=y0+16;y<y1;y+=16){
      ctx.beginPath(); ctx.moveTo(px,y); ctx.lineTo(px+halfW*2,y); ctx.stroke();
      const off=((y-y0)/16|0)%2*34;
      ctx.beginPath(); ctx.moveTo(px+off,y); ctx.lineTo(px+off,y+16); ctx.stroke();
    }
    ctx.fillStyle="rgba(255,255,255,.16)"; ctx.fillRect(px+4,y0,7,y1-y0);
  }
  pillar(-40,top);
  pillar(bot,F_GROUND-26);
  // stone caps on the gap edges
  ctx.fillStyle="#d9a97e";
  ctx.beginPath(); ctx.roundRect(g.x-halfW-7,top-16,halfW*2+14,18,5); ctx.fill();
  ctx.beginPath(); ctx.roundRect(g.x-halfW-7,bot-2,halfW*2+14,18,5); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.3)";
  ctx.fillRect(g.x-halfW-7,top-16,halfW*2+14,4);
  ctx.fillRect(g.x-halfW-7,bot-2,halfW*2+14,4);
  // the ball hovering in the gap
  if (!g.ball.taken){
    const k=KINDS[g.kind], bob=Math.sin(F.t*3+g.x*.02)*4;
    const gl=(Math.sin(F.pulse*3)+1)/2;
    ctx.fillStyle=(g.kind==="gold"?"rgba(255,207,58,":"rgba(182,242,58,")+(.16+gl*.14)+")";
    ctx.beginPath(); ctx.arc(g.x,g.ball.y+bob,22,0,Math.PI*2); ctx.fill();
    ctx.save(); ctx.translate(g.x,g.ball.y+bob); ctx.rotate(g.ball.spin);
    orb(ctx,0,0,12,k.light,k.dark);
    ctx.strokeStyle="rgba(255,255,255,.42)"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,9,-.9,.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,0,9,Math.PI-.9,Math.PI+.9); ctx.stroke();
    ctx.restore();
  }
}

function drawFlap(){
  ctx.save();
  if (F.shake>.4){ const s=F.shake*.5; ctx.translate(rand(-s,s),rand(-s,s)); }
  ctx.drawImage(fbg,0,0);

  // drifting clouds
  for(let i=0;i<4;i++){
    const x=((F.cloudX*(.5+i*.18) + i*260) % (W+300) + W+300) % (W+300) - 150;
    drawCloud(x, 74+i*46, .7+i*.12);
  }

  for (const g of F.gates) drawFlapGate(g);
  drawBirds(F.t,0.016,F.started?1.6:1);
  // ghost trail behind him
  if (F.trail) for (const g of F.trail){
    ctx.save(); ctx.globalAlpha=g.life*.55; ctx.translate(g.x,g.y); ctx.rotate(g.tilt);
    ctx.fillStyle="#e3ac60";
    ctx.beginPath(); ctx.ellipse(0,2,22,15,-.1,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // scrolling grass edge so the ground reads as moving
  ctx.save();
  ctx.beginPath(); ctx.rect(0,F_GROUND-30,W,H-F_GROUND+30); ctx.clip();
  ctx.strokeStyle="rgba(20,58,26,.5)"; ctx.lineWidth=3;
  for(let x=-40;x<W+40;x+=34){
    const sx=x-(F.scroll%34);
    ctx.beginPath(); ctx.moveTo(sx,F_GROUND-24);
    ctx.lineTo(sx+7,F_GROUND-24-13); ctx.stroke();
  }
  ctx.restore();

  drawFlapBernard();

  for (const p of F.particles){
    ctx.globalAlpha=clamp(p.life*1.7,0,1);
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
  for (const c of F.confetti){
    ctx.globalAlpha=clamp(c.life,0,1);
    ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.rot);
    ctx.fillStyle=c.col; ctx.fillRect(-c.sz/2,-c.sz/3,c.sz,c.sz*.66);
    ctx.restore();
  }
  ctx.globalAlpha=1;

  ctx.textAlign="center"; ctx.textBaseline="middle";
  for (const s of F.toasts){
    ctx.globalAlpha=clamp(s.life*1.5,0,1);
    chunky(ctx,s.text,s.x,s.y,18,s.color,"#231206",700);
  }
  ctx.globalAlpha=1;

  if (!POSTER){ drawFlapHUD(); comboDraw(F,W/2,138); }
  ctx.restore();

  drawGlass();
  if (F.flash>0){
    ctx.fillStyle="rgba("+F.flashCol+","+(F.flash*.26)+")";
    ctx.fillRect(0,0,W,H);
  }
}

function drawFlapHUD(){
  ctx.textAlign="center"; ctx.textBaseline="middle";
  chunky(ctx,String(F.score),W/2,64,52,"#fff6c9","#4a1f08",700);
  ctx.font="600 12px Fredoka, system-ui, sans-serif";
  ctx.fillStyle="rgba(255,255,255,.75)";
  ctx.fillText(F.passed+" gates  \u00b7  "+F.balls+" balls  \u00b7  best "+F.best, W/2, 104);


  if (!F.started){
    const pl=(Math.sin(F.pulse*2.2)+1)/2;
    ctx.globalAlpha=.6+pl*.4;
    chunky(ctx,"FLAP TO FLY",W/2,H/2+96,26,"#fff6c9","#4a1f08",700);
    ctx.globalAlpha=1;
    ctx.font="600 13px Fredoka, system-ui, sans-serif";
    ctx.fillStyle="rgba(255,255,255,.8)";
    ctx.fillText("any button, Space, or tap", W/2, H/2+126);
  }
}

// ================================================================
//  PADDLE OUT  —  Giulia or Nic, a board, and a dog who won't sit still
// ================================================================
const P_LEN     = 9600;        // stage length before the boat shows up
const P_TOP     = 210, P_BOT = 616;   // swimmable water band
const P_LANEX   = 236;         // where the board sits on screen
const P_DRIFT   = -74;         // the current always pushes you back
const P_STROKE  = 132;         // speed added per paddle
const P_MAXV    = 268;
const P_DRAG    = 0.30;   // velocity retained per second

let P = null;
let pbg = null;
let P_CHAR = "giulia";         // chosen on the menu

const P_BALLS = { green:{v:30,light:"#d6ff7a",dark:"#5d9109"},
                  red:  {v:10,light:"#ff8a72",dark:"#a3210f"},
                  gold: {v:75,light:"#ffe79b",dark:"#a3760a"} };

function newPaddle(best){
  return {
    combo:{n:0,t:0,mult:1,pop:0},
    t:0, pulse:0, running:true, started:false, finished:false,
    score:0, best:best||0, balls:0, bumps:0,
    dist:0, vx:0,
    rider:{ y:412, bob:0, stroke:0, lean:0 },
    dog:{ aboard:true, x:0, y:0, wx:0, bob:0, paddle:0, whine:0 },
    items:[], hazards:[], wake:[],
    nextItem:340, nextHaz:620,
    boat:null, splash:0,
    shake:0, flash:0, flashCol:"224,58,47",
    toasts:[], particles:[], confetti:[], winFx:0
  };
}
function saveP(v){ try{ localStorage.setItem("paddle_best",String(v)); }catch(e){} }
function loadPBest(){ try{ const v=+localStorage.getItem("paddle_best"); if(v&&P) P.best=v; }catch(e){} }

function pToast(text,color,x,y){
  P.toasts.push({text,color,x:x===undefined?W/2:x,y:y===undefined?260:y,life:1.15});
}
function pBurst(x,y,color,n){
  for(let i=0;i<n;i++){
    const a=rand(0,6.28), s=rand(50,190);
    P.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-40,life:rand(.3,.7),color,r:rand(2,5)});
  }
}
function pStroke(){
  if (!P || !P.running || P.finished) return;
  P.started=true;
  P.vx = Math.min(P_MAXV, P.vx + P_STROKE);
  P.rider.stroke = 1;
  sfx.paddle();
  for(let i=0;i<7;i++){
    P.particles.push({ x:P_LANEX-26, y:P.rider.y+16+rand(-6,6),
      vx:rand(-150,-40), vy:rand(-70,40), life:rand(.25,.5),
      color:"rgba(255,255,255,.85)", r:rand(2,4) });
  }
}
// world x -> screen x
const pScreen = wx => P_LANEX + (wx - P.dist);

function pDogOverboard(hz){
  comboBreak(P);
  const d=P.dog;
  d.aboard=false;
  d.wx = P.dist - rand(40,90);          // he tumbles off behind the board
  d.y  = clamp(P.rider.y+rand(-30,30), P_TOP+24, P_BOT-24);
  d.whine=1.6;
  P.bumps++;
  P.flash=1; P.flashCol="224,58,47"; P.shake=14;
  P.vx = Math.min(P.vx, 40);
  sfx.splash();
  pBurst(pScreen(d.wx), d.y, "rgba(255,255,255,.9)", 26);
  pToast("Bernard's overboard!","#ff9ec4",W/2,P.rider.y-70);
}
function pDogBack(){
  const d=P.dog;
  d.aboard=true; d.whine=0;
  sfx.bank(2);
  pBurst(P_LANEX+18,P.rider.y-10,"#b6f23a",16);
  pToast("back aboard!","#b6f23a",P_LANEX+20,P.rider.y-60);
}
function pFinish(){
  if (P.finished) return;
  P.finished=true; P.running=false;
  const newBest = P.score>P.best;
  if (newBest){ P.best=P.score; saveP(P.best); }
  P.winFx=1.4;
  const cols=["#ffcf3a","#b6f23a","#ff8fc4","#6fd0ff","#fff6c9"];
  for(let i=0;i<110;i++)
    P.confetti.push({ x:rand(0,W), y:rand(-250,-10), vx:rand(-46,46), vy:rand(70,230),
      sz:rand(6,13), rot:rand(0,6.3), vr:rand(-7,7),
      col:cols[Math.floor(rand(0,cols.length))], life:rand(2.4,4.6) });
  sfx.win();
  const over=document.getElementById("gameover");
  over.classList.remove("won","lost"); over.classList.add("won");
  document.getElementById("overShot").style.backgroundImage="var(--ph-paddle)";
  document.getElementById("overTitle").textContent="You made the boat!";
  const who=P_CHAR==="giulia"?"Giulia":"Nic";
  document.getElementById("finalLine").textContent =
    who+" paddled the whole way and brought back "+P.balls+" balls for "+P.score+" points"+
    (P.bumps ? ", fishing Bernard out of the water "+P.bumps+(P.bumps===1?" time":" times") : " without dunking Bernard once")+
    ". "+(newBest?"That's your best yet.":"Best so far: "+P.best+".");
  over.classList.add("on");
}

// ------------------------------------------------------------ update
function updatePaddle(dt){
  if (!P) return;
  pollGamepad();
  P.t+=dt; P.pulse+=dt*3.4;
  comboTick(P,dt);
  P.trail=P.trail||[]; trailTick(P.trail,dt);
  if (P.vx>200) trailPush(P.trail,P_LANEX,P.rider.y,{});

  for (const p of P.particles){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=140*dt; p.life-=dt; }
  P.particles=P.particles.filter(p=>p.life>0);
  for (const s of P.toasts){ s.y-=26*dt; s.life-=dt; }
  P.toasts=P.toasts.filter(s=>s.life>0);
  for (const c of P.confetti){ c.x+=c.vx*dt; c.y+=c.vy*dt; c.vy+=52*dt; c.rot+=c.vr*dt; c.life-=dt; }
  P.confetti=P.confetti.filter(c=>c.life>0&&c.y<H+40);
  P.shake=Math.max(0,P.shake-dt*30);
  P.flash=Math.max(0,P.flash-dt*2.2);
  P.winFx=Math.max(0,P.winFx-dt);
  P.rider.stroke=Math.max(0,P.rider.stroke-dt*2.6);
  P.rider.bob+=dt*2.2;
  P.dog.bob+=dt*2.6;
  P.dog.paddle+=dt*9;
  P.dog.whine=Math.max(0,P.dog.whine-dt);
  if (!P.running) return;

  // ---- steering
  const r=P.rider;
  let my=0;
  if (keys.has("ArrowUp")||keys.has("KeyW"))   my-=1;
  if (keys.has("ArrowDown")||keys.has("KeyS")) my+=1;
  if (my){ r.y=clamp(r.y+my*252*dt, P_TOP, P_BOT); r.lean=lerp(r.lean,my*.22,dt*8); }
  else r.lean=lerp(r.lean,0,dt*6);

  // back-paddle to go and fetch him
  if (keys.has("ArrowLeft")||keys.has("KeyA")) P.vx=Math.max(-130,P.vx-190*dt);
  if (keys.has("ArrowRight")||keys.has("KeyD")) P.vx=Math.min(P_MAXV,P.vx+90*dt);

  // ---- the current is always working against you
  P.vx += (P_DRIFT - P.vx) * (1-Math.pow(P_DRAG,dt));
  if (!P.started) P.vx=0;
  P.dist += P.vx*dt;
  if (P.dist<0) P.dist=0;

  // ---- wake trail
  if (P.vx>20 && Math.random()<.4)
    P.wake.push({wx:P.dist-30,y:r.y+18,life:1.1,r:rand(6,13)});
  for (const w of P.wake){ w.life-=dt*.8; w.r+=dt*12; }
  P.wake=P.wake.filter(w=>w.life>0);

  // ---- spawn balls and hazards ahead
  while (P.nextItem < P.dist + W){
    // a short trail of balls at a similar height reads better and is reachable
    const n=2+Math.floor(rand(0,3));
    let y=P.trailY===undefined ? rand(P_TOP+40,P_BOT-40)
                               : clamp(P.trailY+rand(-120,120),P_TOP+34,P_BOT-34);
    P.trailY=y;
    for (let i=0;i<n;i++){
      const roll=Math.random();
      const kind = roll<.10 ? "gold" : roll<.30 ? "red" : "green";
      P.items.push({ wx:P.nextItem+i*74, y:clamp(y+rand(-16,16),P_TOP+26,P_BOT-26),
                     kind, taken:false, bob:rand(0,6.3) });
    }
    P.nextItem += n*74 + rand(200,330);
  }
  while (P.nextHaz < P.dist + W){
    const roll=Math.random();
    const type = roll<.36 ? "shark" : roll<.7 ? "kelp" : "jelly";
    P.hazards.push({
      wx:P.nextHaz, y:rand(P_TOP+30,P_BOT-30), type,
      phase:rand(0,6.3), hit:false,
      amp: type==="shark" ? rand(40,80) : type==="jelly" ? rand(16,34) : 0
    });
    P.nextHaz += rand(230,360) - Math.min(90, P.dist*0.02);
  }
  P.items  =P.items.filter(i=>i.wx > P.dist-320);
  P.hazards=P.hazards.filter(h=>h.wx > P.dist-320);

  // ---- Bernard spots sharks coming and says so
  P.dog.warn=Math.max(0,(P.dog.warn||0)-dt);
  if (P.dog.aboard && P.dog.warn<=0){
    for (const h of P.hazards){
      if (h.type!=="shark"||h.hit) continue;
      const sx=pScreen(h.wx);
      if (sx>P_LANEX+120 && sx<P_LANEX+420 && Math.abs(h.y-P.rider.y)<150){
        P.dog.warn=3.2; P.dog.barkT=1.4; sfx.bark();
        break;
      }
    }
  }
  P.dog.barkT=Math.max(0,(P.dog.barkT||0)-dt);

  // ---- hazard motion
  for (const h of P.hazards){
    h.phase+=dt*(h.type==="shark"?1.7:1.1);
    if (h.type==="shark") h.wx -= dt*26;      // sharks swim toward you
  }

  // ---- the boat at the end
  if (P.dist > P_LEN-W*0.6 && !P.boat) P.boat={ wx:P_LEN+120 };
  if (P.boat && P.dist+P_LANEX+40 > P.boat.wx-90){ pFinish(); return; }

  const bx=P_LANEX, by=r.y;

  // ---- collisions
  for (const h of P.hazards){
    if (h.hit) continue;
    const hx=pScreen(h.wx), hy=h.y+Math.sin(h.phase)*h.amp;
    if (Math.abs(hx-bx)<40 && Math.abs(hy-by)<38){
      h.hit=true;
      if (P.dog.aboard) pDogOverboard(h);
      else { P.flash=.5; P.shake=8; P.vx=Math.min(P.vx,20); sfx.splash(); }
    }
  }

  // ---- collect balls, but only when he's aboard to fetch them
  for (const it of P.items){
    if (it.taken) continue;
    const ix=pScreen(it.wx), iy=it.y+Math.sin(P.t*2+it.bob)*7;
    if (Math.abs(ix-bx)<42 && Math.abs(iy-by)<40){
      if (!P.dog.aboard){
        if (!P.nagged){ P.nagged=true; pToast("no Bernard, no fetching!","#ffd36a",bx,by-60); }
        continue;
      }
      it.taken=true;
      const m=comboHit(P,ix,iy,pToast);
      const v=P_BALLS[it.kind].v*m;
      P.score+=v; P.balls++;
      sfx.pick(it.kind);
      pBurst(ix,iy,P_BALLS[it.kind].light,12);
      pToast("+"+v,"#b6f23a",ix,iy-28);
    }
  }

  // ---- go back and get him
  if (!P.dog.aboard){
    const d=P.dog;
    d.y += Math.sin(P.t*1.6)*8*dt;
    const dx=pScreen(d.wx)-bx, dy=d.y-by;
    if (Math.hypot(dx,dy) < 46){ pDogBack(); P.nagged=false; }
  }
}

// ------------------------------------------------------------ sea art
function bakePaddleSea(){
  pbg=document.createElement("canvas"); pbg.width=W; pbg.height=H;
  const b=pbg.getContext("2d");

  const sky=b.createLinearGradient(0,0,0,200);
  sky.addColorStop(0,"#87cdf0"); sky.addColorStop(1,"#d8f0f4");
  b.fillStyle=sky; b.fillRect(0,0,W,200);
  const sun=b.createRadialGradient(760,66,10,760,66,180);
  sun.addColorStop(0,"rgba(255,246,196,.95)"); sun.addColorStop(1,"rgba(255,238,170,0)");
  b.fillStyle=sun; b.fillRect(0,0,W,220);

  // far shoreline
  b.fillStyle="rgba(104,150,110,.6)";
  for(let x=-40;x<W+60;x+=90){
    b.beginPath(); b.ellipse(x,182,66,26+Math.sin(x*.05)*10,0,0,Math.PI*2); b.fill();
  }
  b.fillStyle="#c9b98d"; b.fillRect(0,190,W,14);

  // open water
  const sea=b.createLinearGradient(0,196,0,H);
  sea.addColorStop(0,"#3f9fc4"); sea.addColorStop(.45,"#2d7fae"); sea.addColorStop(1,"#175b86");
  b.fillStyle=sea; b.fillRect(0,196,W,H-196);
  // depth banding
  for(let y=210;y<H;y+=26){
    b.fillStyle="rgba(255,255,255,"+(0.03+0.02*Math.sin(y*.13))+")";
    b.fillRect(0,y,W,11);
  }
  // sun glitter
  b.fillStyle="rgba(255,246,200,.16)";
  for(let i=0;i<90;i++){
    const x=rand(0,W), y=rand(206,H), w=rand(8,26);
    b.beginPath(); b.ellipse(x,y,w,2.2,0,0,Math.PI*2); b.fill();
  }
}

// ------------------------------------------------------------ people
function drawRider(){
  const r=P.rider, bob=Math.sin(r.bob)*3;
  const x=P_LANEX, y=r.y+bob;
  const girl = P_CHAR==="giulia";
  const swim = girl ? ["#ff6fa8","#c93c74"] : ["#3fa9dd","#1c6c96"];

  // ---- board
  ctx.save(); ctx.translate(x,y+26); ctx.rotate(r.lean*.4);
  ctx.fillStyle="rgba(10,40,60,.3)";
  ctx.beginPath(); ctx.ellipse(4,10,76,16,0,0,Math.PI*2); ctx.fill();
  const bd=ctx.createLinearGradient(-74,0,74,0);
  bd.addColorStop(0,"#f4f0e6"); bd.addColorStop(.5,"#ffffff"); bd.addColorStop(1,"#ddd6c6");
  ctx.fillStyle=bd;
  ctx.beginPath(); ctx.ellipse(0,0,76,17,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=girl?"#ff9ec4":"#7fd0f0";
  ctx.beginPath(); ctx.ellipse(-18,0,40,7,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="rgba(90,110,120,.45)"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.ellipse(0,0,76,17,0,0,Math.PI*2); ctx.stroke();
  ctx.restore();

  // ---- rider, kneeling on the board
  ctx.save(); ctx.translate(x,y); ctx.rotate(r.lean*.3);
  ctx.lineCap="round";
  limb(ctx,-4,14,10,22,8,"#eab88f","#b8804f");
  blob(ctx,0,0,12,15,0,swim[0],swim[1]);
  // life vest
  ctx.fillStyle="#ffb02e";
  ctx.beginPath(); ctx.roundRect(-9,-8,18,15,5); ctx.fill();
  ctx.strokeStyle="#d8830f"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(0,7); ctx.stroke();

  // paddle: swings through a stroke
  const sw=Math.sin(r.stroke*Math.PI)*1.15;
  ctx.save(); ctx.rotate(-0.5+sw);
  ctx.strokeStyle="#c8935a"; ctx.lineWidth=4.5;
  ctx.beginPath(); ctx.moveTo(2,-14); ctx.lineTo(-16,26); ctx.stroke();
  ctx.fillStyle="#e8e2d2";
  ctx.beginPath(); ctx.ellipse(-18,30,6,10,-.35,0,Math.PI*2); ctx.fill();
  ctx.restore();

  limb(ctx,-2,-6,-13,10,5,"#eab88f","#b8804f");
  limb(ctx,4,-6,14,6,5,"#eab88f","#b8804f");

  // head
  if (girl){
    ctx.fillStyle="#6b452a";
    ctx.beginPath(); ctx.ellipse(-1,-19,12,13,0,0,Math.PI*2); ctx.fill();
  }
  orb(ctx,1,-19,9.4,"#f5c69e","#c08a56",false);
  ctx.fillStyle= girl ? "#6b452a" : "#4a3career".slice(0,7);
  ctx.fillStyle= girl ? "#6b452a" : "#4b3524";
  ctx.beginPath(); ctx.ellipse(0,-26,10.5,6,0,0,Math.PI*2); ctx.fill();
  if (girl){
    ctx.beginPath(); ctx.ellipse(-8,-15,4.6,10,.22,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#ff9ec4";
    ctx.beginPath(); ctx.arc(-3,-29,2.6,0,Math.PI*2); ctx.fill();
  }
  ctx.fillStyle="#2b1d12";
  ctx.beginPath(); ctx.arc(4,-20,1.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(8.6,-20,1.5,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="#b5705c"; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(6.4,-16,2.5,.25,Math.PI-.25); ctx.stroke();
  ctx.restore();
}

function drawSeaDog(){
  const d=P.dog;
  if (d.aboard){
    const r=P.rider, bob=Math.sin(d.bob)*2.4;
    drawDog({ x:P_LANEX+42, y:r.y+Math.sin(r.bob)*3+10+bob,
              phase:d.bob, wag:P.t*7, face:0, hasBall:null,
              mood: d.barkT>0 ? "worried" : "happy",
              bark: d.barkT>0 ? {text:"SHARK!",life:d.barkT} : null }, P.t);
    return;
  }
  // in the drink, paddling and waiting to be collected
  const sx=pScreen(d.wx), sy=d.y+Math.sin(d.bob)*3;
  ctx.save();
  ctx.fillStyle="rgba(255,255,255,.32)";
  ctx.beginPath(); ctx.ellipse(sx,sy+16,34,10,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.rect(0,0,W,sy+14); ctx.clip();
  drawDog({ x:sx, y:sy, phase:d.paddle, wag:P.t*5, face:0, hasBall:null, mood:"worried", bark:null }, P.t);
  ctx.restore();
  // ripples
  ctx.strokeStyle="rgba(255,255,255,.5)"; ctx.lineWidth=2;
  for(let i=0;i<2;i++){
    const rr=16+((P.t*22+i*18)%30);
    ctx.globalAlpha=1-rr/46;
    ctx.beginPath(); ctx.ellipse(sx,sy+15,rr,rr*.32,0,0,Math.PI*2); ctx.stroke();
  }
  ctx.globalAlpha=1;
  const pl=(Math.sin(P.pulse*4)+1)/2;
  ctx.textAlign="center"; ctx.textBaseline="middle";
  chunky(ctx,"!",sx,sy-42-pl*4,26,"#ff9ec4","#5a1030",700);
  // off-screen pointer
  if (sx < -10){
    ctx.fillStyle="rgba(255,158,196,"+(.6+pl*.4)+")";
    ctx.beginPath(); ctx.moveTo(26,sy); ctx.lineTo(52,sy-15); ctx.lineTo(52,sy+15); ctx.closePath(); ctx.fill();
    chunky(ctx,"BACK",76,sy,15,"#ff9ec4","#5a1030",700);
  }
}

function drawHazard(h){
  const x=pScreen(h.wx), y=h.y+Math.sin(h.phase)*h.amp;
  if (x<-90||x>W+90) return;
  if (h.type==="shark"){
    ctx.fillStyle="rgba(10,40,60,.28)";
    ctx.beginPath(); ctx.ellipse(x,y+16,42,12,0,0,Math.PI*2); ctx.fill();
    // body just under the surface
    ctx.fillStyle="rgba(70,96,116,.72)";
    ctx.beginPath(); ctx.ellipse(x,y+8,40,13,0,0,Math.PI*2); ctx.fill();
    // fin
    const fg=ctx.createLinearGradient(x-16,y-30,x+14,y+4);
    fg.addColorStop(0,"#8fa4b4"); fg.addColorStop(1,"#3f5568");
    ctx.fillStyle=fg;
    ctx.beginPath(); ctx.moveTo(x-16,y+4); ctx.quadraticCurveTo(x-2,y-34,x+15,y+4);
    ctx.closePath(); ctx.fill();
    // tail flick
    ctx.fillStyle="#4c6274";
    const tf=Math.sin(h.phase*3)*7;
    ctx.beginPath(); ctx.moveTo(x+34,y+6); ctx.lineTo(x+52,y-6+tf); ctx.lineTo(x+50,y+16+tf); ctx.closePath(); ctx.fill();
    // wake
    ctx.strokeStyle="rgba(255,255,255,.5)"; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(x+16,y+10); ctx.quadraticCurveTo(x+40,y+2,x+62,y+12); ctx.stroke();
  } else if (h.type==="kelp"){
    const sway=Math.sin(h.phase)*.28;
    for(let i=0;i<3;i++){
      const ox=(i-1)*15;
      ctx.strokeStyle=i===1?"#2f7a3c":"#276a33";
      ctx.lineWidth=9; ctx.lineCap="round";
      ctx.beginPath();
      ctx.moveTo(x+ox,y+44);
      ctx.quadraticCurveTo(x+ox+Math.sin(h.phase+i)*20, y, x+ox+sway*40, y-46);
      ctx.stroke();
      ctx.fillStyle="#3f9450";
      for(let k=0;k<3;k++){
        const t=k/3, ly=lerp(y+40,y-40,t);
        ctx.beginPath(); ctx.ellipse(x+ox+Math.sin(h.phase+i+k)*13, ly, 9, 4.5, .5, 0, Math.PI*2); ctx.fill();
      }
    }
  } else {
    // jellyfish
    const g=ctx.createRadialGradient(x,y-6,4,x,y-6,26);
    g.addColorStop(0,"rgba(255,214,246,.95)"); g.addColorStop(1,"rgba(206,140,222,.55)");
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.ellipse(x,y-6,24,19,0,Math.PI,0); ctx.fill();
    ctx.fillStyle="rgba(214,150,228,.5)";
    ctx.beginPath(); ctx.ellipse(x,y-4,24,7,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="rgba(232,178,240,.8)"; ctx.lineWidth=3; ctx.lineCap="round";
    for(let i=0;i<5;i++){
      const ox=-16+i*8;
      ctx.beginPath(); ctx.moveTo(x+ox,y-2);
      ctx.quadraticCurveTo(x+ox+Math.sin(h.phase*2+i)*10, y+18, x+ox+Math.sin(h.phase*2+i)*16, y+38);
      ctx.stroke();
    }
  }
}

function drawBoat(bx){
  const y=P_BOT-70;
  ctx.fillStyle="rgba(10,40,60,.3)";
  ctx.beginPath(); ctx.ellipse(bx,y+70,120,20,0,0,Math.PI*2); ctx.fill();
  // hull
  const hg=ctx.createLinearGradient(0,y,0,y+72);
  hg.addColorStop(0,"#fdfdfa"); hg.addColorStop(1,"#c9cfd4");
  ctx.fillStyle=hg;
  ctx.beginPath();
  ctx.moveTo(bx-120,y+14); ctx.lineTo(bx+118,y+14);
  ctx.quadraticCurveTo(bx+96,y+70,bx+34,y+70);
  ctx.lineTo(bx-70,y+70);
  ctx.quadraticCurveTo(bx-122,y+62,bx-120,y+14);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle="#2f7fae"; ctx.fillRect(bx-120,y+22,238,9);
  // cabin
  ctx.fillStyle="#eef2f4";
  ctx.beginPath(); ctx.roundRect(bx-6,y-40,74,56,8); ctx.fill();
  ctx.fillStyle="#7fc0e0";
  ctx.beginPath(); ctx.roundRect(bx+4,y-32,54,26,5); ctx.fill();
  // people waving on deck
  const folks=[[-88,"#ff6fa8"],[-58,"#3fa9dd"],[-28,"#ffd36a"],[16,"#9be07a"]];
  folks.forEach(([ox,col],i)=>{
    const wob=Math.sin(P.t*3+i)*4;
    ctx.fillStyle=col;
    ctx.beginPath(); ctx.roundRect(bx+ox-8,y-24,16,32,6); ctx.fill();
    orb(ctx,bx+ox,y-32,8,"#f5c69e","#c08a56",false);
    ctx.fillStyle="#4b3524";
    ctx.beginPath(); ctx.ellipse(bx+ox,y-38,8.5,5,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="#eab88f"; ctx.lineWidth=4.5; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(bx+ox+7,y-20); ctx.lineTo(bx+ox+16,y-34+wob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx+ox-7,y-20); ctx.lineTo(bx+ox-14,y-8); ctx.stroke();
  });
  // flag
  ctx.strokeStyle="#8a8f94"; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(bx+62,y-40); ctx.lineTo(bx+62,y-76); ctx.stroke();
  ctx.fillStyle="#f0472f";
  ctx.beginPath(); ctx.moveTo(bx+62,y-76); ctx.lineTo(bx+96,y-68); ctx.lineTo(bx+62,y-58); ctx.closePath(); ctx.fill();
  ctx.textAlign="center"; ctx.textBaseline="middle";
  chunky(ctx,"FINISH",bx-30,y+40,20,"#fff6c9","#12405c",700);
}

// ------------------------------------------------------------ draw
function drawPaddle(){
  ctx.save();
  if (P.shake>.4){ const s=P.shake*.5; ctx.translate(rand(-s,s),rand(-s,s)); }
  ctx.drawImage(pbg,0,0);

  // rolling swell so the water reads as moving
  ctx.strokeStyle="rgba(255,255,255,.2)"; ctx.lineWidth=3;
  for(let i=0;i<7;i++){
    const yy=236+i*58;
    const off=(P.dist*(0.5+i*0.09))%180;
    ctx.beginPath();
    for(let x=-180;x<W+180;x+=60){
      const sx=x-off;
      ctx.moveTo(sx,yy+Math.sin((x+P.t*40)*.02)*4);
      ctx.lineTo(sx+30,yy+Math.sin((x+30+P.t*40)*.02)*4);
    }
    ctx.stroke();
  }
  // wake behind the board
  for (const w of P.wake){
    ctx.globalAlpha=clamp(w.life*.5,0,1);
    ctx.strokeStyle="rgba(255,255,255,.8)"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(pScreen(w.wx),w.y,w.r,w.r*.3,0,0,Math.PI*2); ctx.stroke();
  }
  ctx.globalAlpha=1;

  drawBirds(P.t,0.016,1+clamp(P.vx/P_MAXV,0,1));
  for (const h of P.hazards) drawHazard(h);
  // speed lines when you're really moving
  if (P.trail) for (const g of P.trail){
    ctx.globalAlpha=g.life*.5; ctx.strokeStyle="rgba(255,255,255,.9)"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(g.x-70,g.y+22); ctx.lineTo(g.x-110-(0.32-g.life)*180,g.y+22); ctx.stroke();
  }
  ctx.globalAlpha=1;

  // floating balls
  for (const it of P.items){
    if (it.taken) continue;
    const x=pScreen(it.wx);
    if (x<-40||x>W+40) continue;
    const y=it.y+Math.sin(P.t*2+it.bob)*7;
    const k=P_BALLS[it.kind], gl=(Math.sin(P.pulse*3+it.bob)+1)/2;
    ctx.fillStyle="rgba(255,255,255,.28)";
    ctx.beginPath(); ctx.ellipse(x,y+13,15,5,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=(it.kind==="gold"?"rgba(255,207,58,":"rgba(182,242,58,")+(.12+gl*.12)+")";
    ctx.beginPath(); ctx.arc(x,y,20,0,Math.PI*2); ctx.fill();
    orb(ctx,x,y,11,k.light,k.dark);
  }

  if (P.boat) drawBoat(pScreen(P.boat.wx));

  drawSeaDog();
  drawRider();

  for (const p of P.particles){
    ctx.globalAlpha=clamp(p.life*1.7,0,1);
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
  for (const c of P.confetti){
    ctx.globalAlpha=clamp(c.life,0,1);
    ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.rot);
    ctx.fillStyle=c.col; ctx.fillRect(-c.sz/2,-c.sz/3,c.sz,c.sz*.66);
    ctx.restore();
  }
  ctx.globalAlpha=1;

  ctx.textAlign="center"; ctx.textBaseline="middle";
  for (const s of P.toasts){
    ctx.globalAlpha=clamp(s.life*1.5,0,1);
    chunky(ctx,s.text,s.x,s.y,17,s.color,"#231206",700);
  }
  ctx.globalAlpha=1;

  if (!POSTER){ drawPaddleHUD(); comboDraw(P,W/2,78); }
  ctx.restore();

  drawGlass();
  if (P.flash>0){
    ctx.fillStyle="rgba("+P.flashCol+","+(P.flash*.24)+")";
    ctx.fillRect(0,0,W,H);
  }
}

function drawPaddleHUD(){
  goldPanel(ctx,16,14,178,52,13);
  ctx.textAlign="left"; ctx.textBaseline="middle";
  chunky(ctx,String(P.score),30,38,26,"#fff6c9","#4a1f08",700);
  ctx.textAlign="right";
  ctx.font="600 11px Fredoka, system-ui, sans-serif";
  ctx.fillStyle="rgba(255,255,255,.5)"; ctx.fillText("BEST "+P.best,182,30);

  // distance to the boat
  const gw=290,gx=W/2-gw/2,gy=26,gf=clamp(P.dist/P_LEN,0,1);
  ctx.fillStyle="rgba(6,24,34,.55)";
  ctx.beginPath(); ctx.roundRect(gx-6,gy-7,gw+12,22,11); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,.35)";
  ctx.beginPath(); ctx.roundRect(gx,gy,gw,9,5); ctx.fill();
  const gg=ctx.createLinearGradient(0,gy,0,gy+9);
  gg.addColorStop(0,"#a9ef5e"); gg.addColorStop(1,"#59a012");
  ctx.fillStyle=gg;
  ctx.beginPath(); ctx.roundRect(gx,gy,Math.max(5,gw*gf),9,5); ctx.fill();
  ctx.textAlign="center"; ctx.font="600 10px Fredoka, system-ui, sans-serif";
  ctx.fillStyle="rgba(255,255,255,.72)";
  ctx.fillText((P_CHAR==="giulia"?"GIULIA":"NIC")+"  \u00b7  "+P.balls+" balls  \u00b7  "+Math.round(gf*100)+"% to the boat", W/2, gy+26);

  // paddle prompt
  ctx.textAlign="center";
  if (!P.started){
    const pl=(Math.sin(P.pulse*2.2)+1)/2;
    ctx.globalAlpha=.6+pl*.4;
    chunky(ctx,"PRESS TO PADDLE",W/2,H-92,26,"#fff6c9","#12405c",700);
    ctx.globalAlpha=1;
    ctx.font="600 13px Fredoka, system-ui, sans-serif";
    ctx.fillStyle="rgba(255,255,255,.85)";
    ctx.fillText("up/down to steer \u00b7 hold left to drift back", W/2, H-62);
  } else if (!P.dog.aboard){
    const pl=(Math.sin(P.pulse*4)+1)/2;
    ctx.globalAlpha=.65+pl*.35;
    chunky(ctx,"GO BACK FOR BERNARD",W/2,H-58,22,"#ff9ec4","#3a0a20",700);
    ctx.globalAlpha=1;
  }

  // speed pips
  const sp=clamp(P.vx/P_MAXV,0,1);
  ctx.fillStyle="rgba(6,24,34,.5)";
  ctx.beginPath(); ctx.roundRect(W-118,H-46,102,26,13); ctx.fill();
  for(let i=0;i<6;i++){
    ctx.fillStyle = sp*6>i ? "#b6f23a" : "rgba(255,255,255,.2)";
    ctx.beginPath(); ctx.arc(W-104+i*16,H-33,5,0,Math.PI*2); ctx.fill();
  }
}

// ================================================================
//  FLYING WITH BERNARD  —  goggles on, paws on the stick
// ================================================================
const A_TIME  = 100;                  // seconds of flight before you land
const A_X     = 224;                  // plane's screen x
const A_TOP   = 70, A_BOT = 556;      // flyable band
let A = null, abg = null;
let A_PLANE = "biplane";              // "biplane" | "jet"

const A_PTS = { bird:15, plane:50, cat:200, close:20 };
const A_XMIN = 90, A_XMAX = 560;            // how far the plane can roam on screen
const A_LIVES = 3, A_INV = 1.5;
const A_WEAPONS = [
  { name:"basic",  cd:.24, ammo:0  },
  { name:"double", cd:.22, ammo:28, icon:"bone", col:"#ffcf3a", glow:"255,207,58" },
  { name:"spread", cd:.22, ammo:24, icon:"paw",  col:"#ff8c2e", glow:"255,140,46" },
  { name:"rapid",  cd:.09, ammo:40, icon:"ball", col:"#f0472f", glow:"240,71,47" }
];

function newAir(best){
  return {
    combo:{n:0,t:0,mult:1,pop:0},
    t:0, pulse:0, running:true, started:false, timeLeft:A_TIME,
    score:0, best:best||0, balls:0, birds:0, planes:0, cats:0, hits:0,
    ship:{ x:A_X, y:300, vx:0, vy:0, tilt:0, inv:0, xray:0, blink:0, flashHit:0, boost:0 },
    lives:3, weapon:0, ammo:0, over:false, pickups:[],
    scroll:0, gustV:0, rain:0, dark:0,
    shots:[], eshots:[], birdsL:[], enemies:[], clouds:[], storms:[],
    balloons:[], gusts:[], items:[], acorns:[], bolts:[],
    squirrel:0, fireCool:0,
    nx:{ item:520, bird:760, cloud:1100, storm:1700, enemy:2200, balloon:1500, gust:2600, acorn:3600, cat:5200, weapon:1400 },
    shake:0, flash:0, flashCol:"224,58,47",
    toasts:[], particles:[], confetti:[], feathers:[], winFx:0
  };
}
const aSpeed = () => (A_PLANE==="jet" ? 236 : 198) * (A.rain>0 ? .62 : 1);
const aTurn  = () => A_PLANE==="jet" ? 300 : 236;
function saveABest(v){ try{ localStorage.setItem("air_best",String(v)); }catch(e){} }
function loadABest(){ try{ const v=+localStorage.getItem("air_best"); if(v&&A) A.best=v; }catch(e){} }

function aToast(text,color,x,y){ A.toasts.push({text,color,x:x===undefined?W/2:x,y:y===undefined?220:y,life:1.15}); }
function aBurst(x,y,color,n,spd){
  for(let i=0;i<n;i++){
    const a=rand(0,6.28), s=rand(50,spd||200);
    A.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-30,life:rand(.3,.7),color,r:rand(2,5)});
  }
}
function aFeathers(x,y,n){
  for(let i=0;i<n;i++) A.feathers.push({x,y,vx:rand(-60,40),vy:rand(-90,20),rot:rand(0,6.3),vr:rand(-6,6),life:rand(.8,1.5),
    col:["#f4f1ea","#d9d2c4","#b8ad9a"][i%3]});
}
function aGain(v,x,y,label,col){
  let m=comboHitSilent(A);
  if (A.squirrel>0) m*=2;
  const g=Math.round(v*m);
  A.score+=g;
  aToast("+"+g+(label?"  "+label:""), col||"#b6f23a", x, y-30);
  return g;
}
// combo without its own toast (we label things ourselves here)
function comboHitSilent(S){
  const c=S.combo; c.n++; c.t=COMBO_WINDOW; c.pop=1;
  c.mult = c.n>=9 ? 4 : c.n>=6 ? 3 : c.n>=3 ? 2 : 1;
  if (c.n===3||c.n===6||c.n===9){ aToast("COMBO x"+c.mult+"!", c.mult>=4?"#ff8fc4":c.mult>=3?"#ffcf3a":"#9be5ff", A.ship.x+40, A.ship.y-70); try{sfx.perfect();}catch(e){} }
  return c.mult;
}

function airFire(){
  if (!A || !A.running) return;
  A.started=true; A.firing=true;      // hold to keep shooting
  airFireNow();
}
function airFireNow(){
  if (!A || !A.running) return;
  if (A.fireCool>0) return;
  const w=A_WEAPONS[A.weapon];
  A.fireCool = w.cd * (A_PLANE==="jet" ? .85 : 1);
  const s=A.ship, x0=s.x+46, y0=s.y+2;
  const mk=(dy,vy)=>A.shots.push({ x:x0, y:y0+dy, vx:640, vy:vy||0, life:1.6 });
  if (A.weapon===1){ mk(-6); mk(8); }
  else if (A.weapon===2){ mk(0); mk(-4,-150); mk(4,150); }
  else { mk(0); }
  if (A.weapon>0){
    A.ammo--;
    if (A.ammo<=0){ A.weapon--; A.ammo=A_WEAPONS[A.weapon].ammo; aToast(A.weapon?"back to "+A_WEAPONS[A.weapon].name:"basic shot","#dfe9dc",s.x,s.y-50); }
  }
  sfx.shot();
  A.particles.push({x:x0+4,y:y0,vx:140,vy:0,life:.12,color:"#fff3b0",r:6});
}
function airHit(why,kind){
  const s=A.ship;
  if (s.inv>0 || !A.running) return;
  A.hits++; A.lives--;
  if (kind==="bolt"){ s.xray=.55; A.flashCol="255,255,255"; A.flash=1; }
  else { s.flashHit=.35; A.flashCol="255,120,90"; A.flash=.6; }
  s.inv=A_INV; s.blink=0;
  s.vy=0; s.vx=0;
  comboBreak(A);
  A.squirrel=0;
  if (A.weapon>0){ A.weapon--; A.ammo=A_WEAPONS[A.weapon].ammo; }
  if (!REDUCED) A.shake=14;
  sfx.yelp();
  aBurst(s.x,s.y,kind==="bolt"?"#ffffff":"#ffb3a3",kind==="bolt"?26:16,240);
  aToast(why,"#ff9ec4",s.x,s.y-64);
  if (A.lives<=0){ s.inv=99; airCrash(); }
}
function airCrash(){
  if (!A.running) return;
  A.running=false; A.over=true;
  const newBest=A.score>A.best; if (newBest){ A.best=A.score; saveABest(A.best); }
  sfx.over();
  const over=document.getElementById("gameover");
  over.classList.remove("won","lost"); over.classList.add("lost");
  document.getElementById("overShot").style.backgroundImage="var(--ph-air)";
  document.getElementById("overTitle").textContent="Out of paws";
  document.getElementById("finalLine").textContent =
    "All three lives gone with "+Math.ceil(A.timeLeft)+"s still on the clock. Final score "+A.score+": "+
    A.balls+" balls, "+A.birds+" birds, "+A.planes+" planes"+(A.cats?", "+A.cats+" cat balloon"+(A.cats>1?"s":""):"")+
    ". "+(newBest?"Still a new best.":"Best so far: "+A.best+".");
  over.classList.add("on");
}

// ------------------------------------------------------------ spawns
function aSpawnAhead(){
  const R = A.scroll + W + 80;
  const n = A.nx;
  while (n.item < R){
    const k=Math.random(); const kind = k<.12?"gold":k<.32?"red":"green";
    const cnt=2+Math.floor(rand(0,3)); const y=rand(A_TOP+40,A_BOT-40);
    for(let i=0;i<cnt;i++) A.items.push({ wx:n.item+i*66, y:clamp(y+Math.sin(i*1.2)*22,A_TOP+20,A_BOT-20), kind, taken:false, bob:rand(0,6.3) });
    n.item += cnt*66 + rand(220,380);
  }
  while (n.bird < R){
    const cnt=1+Math.floor(rand(0,3)), y=rand(A_TOP+30,A_BOT-30);
    for(let i=0;i<cnt;i++) A.birdsL.push({ wx:n.bird+i*54, y:y, amp:rand(22,54), ph:rand(0,6.3), sp:rand(60,110), dead:false, flap:rand(0,6.3) });
    n.bird += rand(360,620);
  }
  while (n.cloud < R){ A.clouds.push({ wx:n.cloud, y:rand(A_TOP+50,A_BOT-90), w:rand(120,170), h:rand(60,84) }); n.cloud+=rand(900,1500); }
  while (n.storm < R){ A.storms.push({ wx:n.storm, y:rand(A_TOP+20,A_TOP+120), w:150, arm:0, phase:"drift", tmr:rand(.9,1.8), flashed:0, close:false }); n.storm+=rand(1100,1900); }
  while (n.enemy < R){ A.enemies.push({ wx:n.enemy, y:rand(A_TOP+40,A_BOT-40), vy:0, fire:rand(1.2,2.2), dead:false, ph:rand(0,6.3) }); n.enemy+=rand(1300,2100); }
  while (n.balloon < R){
    const cat = A.scroll > n.cat;
    A.balloons.push({ wx:n.balloon, y:rand(A_TOP+70,A_BOT-90), cat, popped:false, bob:rand(0,6.3) });
    if (cat) n.cat = A.scroll + rand(4200,6800);
    n.balloon += rand(1400,2300);
  }
  while (n.gust < R){ A.gusts.push({ wx:n.gust, y:rand(A_TOP+40,A_BOT-40), w:260, h:120, dir: Math.random()<.5?-1:1 }); n.gust+=rand(1800,3000); }
  while (n.weapon < R){
    const r=Math.random(); const tier = r<.5 ? 1 : r<.85 ? 2 : 3;
    A.pickups.push({ wx:n.weapon, y:rand(A_TOP+50,A_BOT-50), tier, taken:false, spin:rand(0,6.3) });
    n.weapon += rand(1500,2600);
  }
  while (n.acorn < R){ A.acorns.push({ wx:n.acorn, y:rand(A_TOP+50,A_BOT-50), taken:false, bob:rand(0,6.3) }); n.acorn+=rand(3400,5600); }
}
const aX = wx => A_X + (wx - A.scroll);

// ------------------------------------------------------------ update
function updateAir(dt){
  if (!A) return;
  pollGamepad();
  A.t+=dt; A.pulse+=dt*3.4;
  comboTick(A,dt);
  for (const p of A.particles){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=120*dt; p.life-=dt; }
  A.particles=A.particles.filter(p=>p.life>0);
  for (const f of A.feathers){ f.x+=f.vx*dt; f.y+=f.vy*dt; f.vy+=60*dt; f.vx-=90*dt; f.rot+=f.vr*dt; f.life-=dt; }
  A.feathers=A.feathers.filter(f=>f.life>0);
  for (const s of A.toasts){ s.y-=26*dt; s.life-=dt; }
  A.toasts=A.toasts.filter(s=>s.life>0);
  for (const c of A.confetti){ c.x+=c.vx*dt; c.y+=c.vy*dt; c.vy+=52*dt; c.rot+=c.vr*dt; c.life-=dt; }
  A.confetti=A.confetti.filter(c=>c.life>0&&c.y<H+40);
  A.shake=Math.max(0,A.shake-dt*30); A.flash=Math.max(0,A.flash-dt*2.4);
  A.winFx=Math.max(0,A.winFx-dt);
  const s=A.ship;
  s.xray=Math.max(0,s.xray-dt); s.flashHit=Math.max(0,s.flashHit-dt); s.inv=Math.max(0,s.inv-dt); s.blink+=dt*18;
  s.boost=Math.max(0,s.boost-dt);
  A.fireCool=Math.max(0,A.fireCool-dt);
  A.squirrel=Math.max(0,A.squirrel-dt);
  if (!A.running) return;
  if (A.firing && A.started) airFireNow();

  if (!A.started){ s.y=300+Math.sin(A.t*2.4)*10; s.tilt=Math.sin(A.t*2.4)*.06; return; }

  A.timeLeft-=dt;
  if (A.timeLeft<=0){ A.timeLeft=0; airLand(); return; }

  // ---- steering
  let my=0;
  if (keys.has("ArrowUp")||keys.has("KeyW")) my-=1;
  if (keys.has("ArrowDown")||keys.has("KeyS")) my+=1;
  const target=my*aTurn();
  s.vy = lerp(s.vy, target + A.gustV, 1-Math.pow(.02,dt));
  s.y = clamp(s.y + s.vy*dt, A_TOP, A_BOT);
  s.tilt = lerp(s.tilt, clamp(s.vy/560,-.45,.45), dt*9);
  let mx=0;
  if (keys.has("ArrowLeft")||keys.has("KeyA"))  mx-=1;
  if (keys.has("ArrowRight")||keys.has("KeyD")) mx+=1;
  s.vx = lerp(s.vx, mx*(A_PLANE==="jet"?300:240), 1-Math.pow(.02,dt));
  s.x = clamp(s.x + s.vx*dt, A_XMIN, A_XMAX);
  A.gustV = lerp(A.gustV, 0, dt*3);

  const sp=aSpeed();
  A.scroll += sp*dt;
  aSpawnAhead();

  // ---- shots
  for (const b of A.shots){ b.x+=b.vx*dt; b.y+=(b.vy||0)*dt; b.life-=dt; }
  A.shots=A.shots.filter(b=>b.life>0 && b.x<W+40);
  for (const b of A.eshots){ b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt; }
  A.eshots=A.eshots.filter(b=>b.life>0 && b.x>-40);

  // ---- rain & darkness state
  A.rain=0; A.dark=0;
  for (const c of A.clouds){
    const cx=aX(c.wx);
    if (Math.abs(cx-s.x)<c.w*.55 && Math.abs(c.y-s.y)<c.h*.6){ A.rain=1; A.dark=.55; }
  }

  // ---- birds
  for (const b of A.birdsL){
    if (b.dead) continue;
    b.wx-=b.sp*dt; b.ph+=dt*2.4; b.flap+=dt*14;
    const bx=aX(b.wx), by=b.y+Math.sin(b.ph)*b.amp;
    for (const sh of A.shots){ if (Math.abs(sh.x-bx)<20 && Math.abs(sh.y-by)<16){ b.dead=true; sh.life=0; A.birds++; aFeathers(bx,by,9); sfx.pick("green"); aGain(A_PTS.bird,bx,by,"bird","#e8f0ff"); break; } }
    if (!b.dead && Math.abs(bx-s.x)<34 && Math.abs(by-s.y)<24){ b.dead=true; aFeathers(bx,by,6); airHit("bird strike!","bird"); }
  }
  A.birdsL=A.birdsL.filter(b=>!b.dead && aX(b.wx)>-60);

  // ---- enemy planes
  for (const e of A.enemies){
    if (e.dead) continue;
    e.wx-=70*dt; e.ph+=dt;
    e.vy=lerp(e.vy,(s.y-e.y)*.9,dt*2); e.y=clamp(e.y+e.vy*dt,A_TOP,A_BOT);
    const ex=aX(e.wx);
    e.fire-=dt;
    if (e.fire<=0 && ex>s.x+140 && ex<W){ e.fire=rand(1.6,2.6); A.eshots.push({x:ex-38,y:e.y+4,vx:-330,vy:(s.y-e.y)*.5,life:2.4}); sfx.shot(); }
    for (const sh of A.shots){ if (Math.abs(sh.x-ex)<38 && Math.abs(sh.y-e.y)<22){ e.dead=true; sh.life=0; A.planes++; aBurst(ex,e.y,"#ffb347",22,260); aBurst(ex,e.y,"#6b7280",16,180); sfx.bark(); aGain(A_PTS.plane,ex,e.y,"plane!","#ffcf3a"); break; } }
    if (!e.dead && Math.abs(ex-s.x)<44 && Math.abs(e.y-s.y)<26){ e.dead=true; aBurst(ex,e.y,"#ffb347",18,220); airHit("mid-air bump!","plane"); }
  }
  A.enemies=A.enemies.filter(e=>!e.dead && aX(e.wx)>-80);
  for (const b of A.eshots){ if (Math.abs(b.x-s.x)<30 && Math.abs(b.y-s.y)<20){ b.life=0; airHit("shot down!","plane"); } }

  // ---- storm clouds: flash, then a bolt drops
  for (const st of A.storms){
    const sx=aX(st.wx);
    if (st.phase==="drift"){ st.tmr-=dt; if (st.tmr<=0 && sx<W-40 && sx>60){ st.phase="warn"; st.tmr=1.1; } }
    else if (st.phase==="warn"){ st.tmr-=dt; st.flashed=(Math.sin(A.t*28)+1)/2; if (st.tmr<=0){ st.phase="bolt"; st.tmr=.42; sfx.thunder(); if (!REDUCED) A.shake=Math.max(A.shake,6); } }
    else if (st.phase==="bolt"){
      st.tmr-=dt;
      const dx=Math.abs(sx-s.x);
      if (s.y > st.y+st.w*.25){
        if (dx<24) airHit("zapped!","bolt");
        else if (dx<70 && !st.close && s.inv<=0){ st.close=true; aGain(A_PTS.close,s.x,s.y,"CLOSE CALL","#ffe07a"); aBurst(s.x,s.y,"#ffe07a",10,120); }
      }
      if (st.tmr<=0){ st.phase="done"; }
    }
  }
  A.storms=A.storms.filter(st=>aX(st.wx)>-220);

  // ---- gusts
  for (const g of A.gusts){
    const gx=aX(g.wx);
    if (Math.abs(gx-s.x)<g.w*.5 && Math.abs(g.y-s.y)<g.h*.5){ A.gustV=g.dir*260; if (!g.said){ g.said=true; aToast(g.dir<0?"updraft!":"downdraft!","#dff6ff",s.x,s.y-50); } }
  }
  A.gusts=A.gusts.filter(g=>aX(g.wx)>-320);

  // ---- balloons (cat ones are shootable + popping)
  for (const bl of A.balloons){
    if (bl.popped) continue;
    const bx=aX(bl.wx), by=bl.y+Math.sin(A.t*1.3+bl.bob)*7;
    if (bl.cat) for (const sh of A.shots){
      if (Math.abs(sh.x-bx)<34 && Math.abs(sh.y-by)<40){
        bl.popped=true; sh.life=0; A.cats++;
        sfx.yowl(); aBurst(bx,by,"#ff8fc4",30,280);
        const cols=["#ffcf3a","#b6f23a","#ff8fc4","#6fd0ff","#fff6c9"];
        for(let i=0;i<70;i++) A.confetti.push({ x:bx+rand(-30,30), y:by+rand(-30,30), vx:rand(-120,120), vy:rand(-160,40), sz:rand(6,12), rot:rand(0,6.3), vr:rand(-8,8), col:cols[i%5], life:rand(1.6,3) });
        aGain(A_PTS.cat,bx,by,"CAT BALLOON!","#ff8fc4");
        aToast("YOWL!","#ff8fc4",bx,by-70);
        break;
      }
    }
    if (!bl.popped && Math.abs(bx-s.x)<40 && Math.abs(by+10-s.y)<44) airHit(bl.cat?"cat got you!":"balloon bump!","bump");
  }
  A.balloons=A.balloons.filter(b=>!b.popped && aX(b.wx)>-90);

  // ---- balls & acorns
  for (const it of A.items){
    if (it.taken) continue;
    const ix=aX(it.wx), iy=it.y+Math.sin(A.t*2+it.bob)*6;
    if (Math.abs(ix-s.x)<34 && Math.abs(iy-s.y)<30){
      it.taken=true; A.balls++;
      const v=KINDS[it.kind].value;
      sfx.pick(it.kind); aBurst(ix,iy,KINDS[it.kind].light,10,150);
      aGain(v,ix,iy,null,KINDS[it.kind].rim);
    }
  }
  A.items=A.items.filter(i=>!i.taken && aX(i.wx)>-40);
  for (const ac of A.acorns){
    if (ac.taken) continue;
    const ax=aX(ac.wx), ay=ac.y+Math.sin(A.t*2+ac.bob)*5;
    if (Math.abs(ax-s.x)<34 && Math.abs(ay-s.y)<30){ ac.taken=true; A.squirrel=7; sfx.perfect(); aToast("SQUIRREL CO-PILOT! x2","#ffb347",s.x,s.y-60); aBurst(ax,ay,"#ffb347",14,160); }
  }
  A.acorns=A.acorns.filter(a=>!a.taken && aX(a.wx)>-40);
  for (const pk of A.pickups){
    if (pk.taken) continue;
    pk.spin+=dt*1.6;
    const px=aX(pk.wx), py=pk.y+Math.sin(A.t*2+pk.spin)*6;
    if (Math.abs(px-s.x)<36 && Math.abs(py-s.y)<32){
      pk.taken=true;
      const w=A_WEAPONS[pk.tier];
      if (pk.tier>=A.weapon){ A.weapon=pk.tier; }
      A.ammo=A_WEAPONS[A.weapon].ammo;
      sfx.perfect(); aBurst(px,py,w.col,18,200);
      aToast(w.name.toUpperCase()+" SHOT!",w.col,s.x,s.y-56);
    }
  }
  A.pickups=A.pickups.filter(p=>!p.taken && aX(p.wx)>-40);
}

function airLand(){
  if (!A.running) return;
  A.running=false;
  const newBest=A.score>A.best; if (newBest){ A.best=A.score; saveABest(A.best); }
  A.winFx=1.4; sfx.win();
  const cols=["#ffcf3a","#b6f23a","#ff8fc4","#6fd0ff","#fff6c9"];
  for(let i=0;i<110;i++) A.confetti.push({ x:rand(0,W), y:rand(-250,-10), vx:rand(-46,46), vy:rand(70,230), sz:rand(6,13), rot:rand(0,6.3), vr:rand(-7,7), col:cols[i%5], life:rand(2.4,4.6) });
  const over=document.getElementById("gameover");
  over.classList.remove("won","lost"); over.classList.add("won");
  document.getElementById("overShot").style.backgroundImage="var(--ph-air)";
  document.getElementById("overTitle").textContent = newBest ? "New best landing!" : "Wheels down";
  document.getElementById("finalLine").textContent =
    "Bernard brought the "+(A_PLANE==="jet"?"jet":"biplane")+" home with "+A.score+" points: "+A.balls+" balls, "+
    A.birds+" birds, "+A.planes+" planes"+(A.cats?", and "+A.cats+" cat balloon"+(A.cats>1?"s":""):"")+
    ". Hit "+A.hits+(A.hits===1?" time":" times")+". "+(newBest?"Best yet.":"Best so far: "+A.best+".");
  over.classList.add("on");
}

// ------------------------------------------------------------ art
function bakeAirSky(){
  abg=document.createElement("canvas"); abg.width=W; abg.height=H;
  const b=abg.getContext("2d");
  const sky=b.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,"#5fb4e6"); sky.addColorStop(.6,"#a9dcf3"); sky.addColorStop(1,"#e4f2ec");
  b.fillStyle=sky; b.fillRect(0,0,W,H);
  const sun=b.createRadialGradient(780,90,10,780,90,220);
  sun.addColorStop(0,"rgba(255,246,196,.95)"); sun.addColorStop(1,"rgba(255,238,170,0)");
  b.fillStyle=sun; b.fillRect(0,0,W,H);
  // far hills
  b.fillStyle="rgba(92,150,110,.5)";
  for(let x=-60;x<W+80;x+=120){ b.beginPath(); b.ellipse(x,626,110,58+Math.sin(x*.03)*16,0,0,Math.PI*2); b.fill(); }
  b.fillStyle="#5aa055"; b.beginPath(); b.ellipse(W/2,690,W*.8,80,0,0,Math.PI*2); b.fill();
}
function drawAirPlane(x,y,tilt,type,xray,dim){
  ctx.save(); ctx.translate(x,y); ctx.rotate(tilt);
  if (dim) ctx.globalAlpha=.4;
  const body = type==="jet" ? ["#e33d2f","#8f1d14"] : ["#f2c744","#a37a12"];
  if (xray){
    ctx.globalAlpha=.9;
    ctx.fillStyle="#f7fbff";
    ctx.beginPath(); ctx.ellipse(0,4,54,16,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="#1b2a3a"; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(-40,4); ctx.lineTo(40,4); ctx.stroke();
    for(let i=-3;i<=3;i++){ ctx.beginPath(); ctx.moveTo(i*11,-8); ctx.lineTo(i*11,16); ctx.stroke(); }
    ctx.fillStyle="#f7fbff"; ctx.beginPath(); ctx.arc(14,-22,15,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#1b2a3a"; ctx.beginPath(); ctx.arc(9,-24,3,0,Math.PI*2); ctx.arc(19,-24,3,0,Math.PI*2); ctx.fill();
    ctx.fillRect(6,-16,16,4);
    ctx.restore(); return;
  }
  // prop / exhaust
  if (type==="jet"){
    ctx.fillStyle="rgba(255,170,60,.85)";
    const fl=10+Math.sin(A?A.t*40:0)*4;
    ctx.beginPath(); ctx.moveTo(-58,0); ctx.lineTo(-58-fl*2,-6); ctx.lineTo(-58-fl*3,0); ctx.lineTo(-58-fl*2,6); ctx.closePath(); ctx.fill();
  } else {
    ctx.strokeStyle="rgba(60,50,40,.55)"; ctx.lineWidth=3;
    const r=(A?A.t*45:0);
    ctx.beginPath(); ctx.moveTo(56,Math.sin(r)*22); ctx.lineTo(56,-Math.sin(r)*22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(56,Math.cos(r)*22); ctx.lineTo(56,-Math.cos(r)*22); ctx.stroke();
  }
  // wings (bottom for biplane)
  const wg=ctx.createLinearGradient(0,-10,0,14);
  wg.addColorStop(0,body[0]); wg.addColorStop(1,body[1]);
  if (type==="jet"){
    ctx.fillStyle=wg;
    ctx.beginPath(); ctx.moveTo(-16,2); ctx.lineTo(-50,30); ctx.lineTo(4,30); ctx.lineTo(18,2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-42,-2); ctx.lineTo(-58,-26); ctx.lineTo(-30,-26); ctx.lineTo(-22,-2); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle=wg;
    ctx.beginPath(); ctx.roundRect(-30,10,66,9,4); ctx.fill();
    ctx.strokeStyle="#5a4626"; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(-16,10); ctx.lineTo(-18,-26); ctx.moveTo(22,10); ctx.lineTo(24,-26); ctx.stroke();
  }
  // fuselage
  const fg=ctx.createLinearGradient(0,-14,0,18);
  fg.addColorStop(0,"#fff5d8"); fg.addColorStop(.3,body[0]); fg.addColorStop(1,body[1]);
  ctx.fillStyle=fg;
  ctx.beginPath();
  if (type==="jet"){ ctx.moveTo(56,2); ctx.quadraticCurveTo(30,-16,-40,-12); ctx.lineTo(-56,-4); ctx.lineTo(-56,10); ctx.lineTo(-40,16); ctx.quadraticCurveTo(30,20,56,2); }
  else { ctx.ellipse(0,4,52,15,0,0,Math.PI*2); }
  ctx.closePath(); ctx.fill();
  // tail
  ctx.fillStyle=body[0];
  ctx.beginPath(); ctx.moveTo(-40,-4); ctx.lineTo(-58,-30); ctx.lineTo(-44,-30); ctx.lineTo(-28,-4); ctx.closePath(); ctx.fill();
  // top wing (biplane)
  if (type!=="jet"){ ctx.fillStyle=wg; ctx.beginPath(); ctx.roundRect(-36,-30,76,9,4); ctx.fill(); }
  // cockpit rim
  ctx.fillStyle="rgba(30,40,50,.6)"; ctx.beginPath(); ctx.ellipse(12,-6,17,7,0,0,Math.PI*2); ctx.fill();

  // ---- Bernard at the stick, goggles on
  ctx.save(); ctx.translate(14,-16);
  blob(ctx,0,10,11,9,0,"#e3ac60","#a0702c");
  orb(ctx,4,-6,11,"#584c42","#211d1a",false);
  blob(ctx,0,-2,6.5,6.5,0,"#c98d3f","#8d5f24");
  blob(ctx,13,-3,8,5.4,.12,"#2c2724","#100e0d");
  orb(ctx,20,-3,2.8,"#4a423c","#100e0d",false);
  // ears back in the wind
  ctx.fillStyle="#3a322b";
  ctx.beginPath(); ctx.moveTo(-4,-12); ctx.lineTo(-22,-20); ctx.lineTo(-6,-4); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(4,-14); ctx.lineTo(-10,-26); ctx.lineTo(8,-8); ctx.closePath(); ctx.fill();
  // goggles
  ctx.strokeStyle="#6b4a1e"; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(-8,-9); ctx.quadraticCurveTo(0,-14,12,-9); ctx.stroke();
  const gl=ctx.createRadialGradient(6,-8,1,6,-8,6);
  gl.addColorStop(0,"#dff7ff"); gl.addColorStop(1,"#4aa3c9");
  ctx.fillStyle=gl; ctx.strokeStyle="#5a3d16"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(6,-8,5.5,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(-3,-9,4,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.fillStyle="rgba(255,255,255,.8)"; ctx.beginPath(); ctx.arc(4,-10,1.6,0,Math.PI*2); ctx.fill();
  // tongue in the slipstream
  ctx.fillStyle="#e8808f"; ctx.beginPath(); ctx.roundRect(14,1,5,7+Math.sin((A?A.t:0)*9)*2,3); ctx.fill();
  // scarf
  ctx.strokeStyle="#f0472f"; ctx.lineWidth=4; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(-6,4); ctx.quadraticCurveTo(-24,2+Math.sin((A?A.t:0)*12)*5,-40,8); ctx.stroke();
  ctx.restore();
  ctx.restore();
}
// weapon icons: chunky, glossy, spinning, in the same glow style as the balls
function drawWeaponIcon(x,y,tier,spin,scale){
  const w=A_WEAPONS[tier]; const sc=scale||1;
  ctx.save(); ctx.translate(x,y); ctx.scale(sc,sc);
  const pl=(Math.sin((A?A.pulse:0)*3+spin)+1)/2;
  ctx.fillStyle="rgba("+w.glow+","+(.16+pl*.16)+")";
  ctx.beginPath(); ctx.arc(0,0,24,0,Math.PI*2); ctx.fill();
  ctx.rotate(spin);
  if (w.icon==="bone"){
    ctx.strokeStyle="#7a5410"; ctx.lineWidth=9; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(10,0); ctx.stroke();
    ctx.strokeStyle="#ffcf3a"; ctx.lineWidth=6;
    ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(10,0); ctx.stroke();
    for (const [ex,ey] of [[-12,-5],[-12,5],[12,-5],[12,5]]){ orb(ctx,ex,ey,5.5,"#fff0b8","#a3760a",false); }
    ctx.fillStyle="rgba(255,255,255,.55)"; ctx.beginPath(); ctx.ellipse(-4,-2,7,1.6,0,0,Math.PI*2); ctx.fill();
  } else if (w.icon==="paw"){
    ctx.fillStyle="rgba(255,140,46,.55)";
    ctx.beginPath(); for(let i=0;i<10;i++){ const a=i*Math.PI/5, r=i%2?11:19; ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r); } ctx.closePath(); ctx.fill();
    orb(ctx,0,4,8,"#ffb060","#b4520c",false);
    for (const [px,py] of [[-8,-6],[-3,-10],[3,-10],[8,-6]]) orb(ctx,px,py,3.4,"#ffb060","#b4520c",false);
  } else {
    ctx.strokeStyle="rgba(255,200,180,.75)"; ctx.lineWidth=2.5; ctx.lineCap="round";
    for (const dy of [-8,0,8]){ ctx.beginPath(); ctx.moveTo(-14,dy); ctx.lineTo(-26-Math.abs(dy)*.4,dy); ctx.stroke(); }
    orb(ctx,2,0,10,"#ff8a72","#a3210f",false);
    ctx.strokeStyle="rgba(255,255,255,.45)"; ctx.lineWidth=1.8;
    ctx.beginPath(); ctx.arc(2,0,7.5,-.9,.9); ctx.stroke(); ctx.beginPath(); ctx.arc(2,0,7.5,Math.PI-.9,Math.PI+.9); ctx.stroke();
  }
  ctx.restore();
}
function drawPaw(x,y,alive){
  ctx.save(); ctx.translate(x,y);
  const l=alive?"#ffd36a":"rgba(255,255,255,.18)", d=alive?"#a3760a":"rgba(0,0,0,.25)";
  orb(ctx,0,3,6,l,d,false);
  for (const [px,py] of [[-6,-4],[-2,-7.5],[2.5,-7.5],[6.5,-4]]) orb(ctx,px,py,2.6,l,d,false);
  ctx.restore();
}
function drawAirCloud(x,y,w,h,dark,flash){
  ctx.save();
  const g=ctx.createLinearGradient(0,y-h/2,0,y+h/2);
  if (dark){ g.addColorStop(0,"#7a8794"); g.addColorStop(1,"#3f4a56"); } else { g.addColorStop(0,"#ffffff"); g.addColorStop(1,"#c6d3dc"); }
  ctx.fillStyle=g;
  ctx.beginPath();
  ctx.ellipse(x,y,w*.5,h*.5,0,0,Math.PI*2);
  ctx.ellipse(x-w*.32,y+h*.1,w*.3,h*.38,0,0,Math.PI*2);
  ctx.ellipse(x+w*.32,y+h*.12,w*.3,h*.36,0,0,Math.PI*2);
  ctx.ellipse(x+w*.05,y-h*.28,w*.32,h*.36,0,0,Math.PI*2);
  ctx.fill();
  if (flash>0){ ctx.fillStyle="rgba(255,255,220,"+(flash*.85)+")"; ctx.fill(); }
  ctx.restore();
}
function drawBird(x,y,flap,s){
  const f=Math.sin(flap)*7;
  ctx.fillStyle="#3b3f47";
  ctx.beginPath(); ctx.ellipse(x,y,9,5.5,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="#3b3f47"; ctx.lineWidth=3; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(x-3,y-1); ctx.quadraticCurveTo(x-12,y-9+f,x-20,y-2+f); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+3,y-1); ctx.quadraticCurveTo(x+12,y-9+f,x+20,y-2+f); ctx.stroke();
  ctx.fillStyle="#f2b23a"; ctx.beginPath(); ctx.moveTo(x-9,y); ctx.lineTo(x-15,y+1.5); ctx.lineTo(x-9,y+3); ctx.closePath(); ctx.fill();
}
function drawEnemy(x,y){
  ctx.save(); ctx.translate(x,y); ctx.scale(-1,1);
  ctx.fillStyle="#586470";
  ctx.beginPath(); ctx.ellipse(0,2,38,11,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#3e4852";
  ctx.beginPath(); ctx.moveTo(-8,0); ctx.lineTo(-30,22); ctx.lineTo(8,22); ctx.lineTo(14,0); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-28,-2); ctx.lineTo(-42,-20); ctx.lineTo(-24,-20); ctx.lineTo(-18,-2); ctx.closePath(); ctx.fill();
  ctx.fillStyle="#2a3038"; ctx.beginPath(); ctx.ellipse(10,-3,10,5,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="rgba(60,50,40,.6)"; ctx.lineWidth=2.5;
  const r=A.t*40; ctx.beginPath(); ctx.moveTo(40,Math.sin(r)*16); ctx.lineTo(40,-Math.sin(r)*16); ctx.stroke();
  ctx.restore();
}
function drawBalloon(x,y,cat){
  ctx.save();
  const g=ctx.createRadialGradient(x-10,y-14,6,x,y,40);
  if (cat){ g.addColorStop(0,"#ffd4e8"); g.addColorStop(1,"#e0578f"); } else { g.addColorStop(0,"#fff0b0"); g.addColorStop(1,"#e0952a"); }
  ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(x,y,32,38,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="rgba(255,255,255,.4)"; ctx.lineWidth=2;
  for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.ellipse(x,y,Math.abs(i)*9+4,38,0,0,Math.PI*2); ctx.stroke(); }
  ctx.strokeStyle="#6a4a2a"; ctx.lineWidth=1.8;
  ctx.beginPath(); ctx.moveTo(x-14,y+34); ctx.lineTo(x-10,y+56); ctx.moveTo(x+14,y+34); ctx.lineTo(x+10,y+56); ctx.stroke();
  ctx.fillStyle="#8a5a30"; ctx.beginPath(); ctx.roundRect(x-14,y+54,28,14,4); ctx.fill();
  if (cat){
    // a smug cat peering over the basket
    ctx.fillStyle="#8c8c8c"; ctx.beginPath(); ctx.arc(x,y+50,9,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x-8,y+44); ctx.lineTo(x-6,y+34); ctx.lineTo(x-1,y+43); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x+8,y+44); ctx.lineTo(x+6,y+34); ctx.lineTo(x+1,y+43); ctx.closePath(); ctx.fill();
    ctx.fillStyle="#3aa04a"; ctx.beginPath(); ctx.arc(x-3.5,y+49,1.8,0,Math.PI*2); ctx.arc(x+3.5,y+49,1.8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#f3a0b8"; ctx.beginPath(); ctx.moveTo(x-1.5,y+52); ctx.lineTo(x+1.5,y+52); ctx.lineTo(x,y+54); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawAir(){
  ctx.save();
  if (A.shake>.4){ const s=A.shake*.5; ctx.translate(rand(-s,s),rand(-s,s)); }
  ctx.drawImage(abg,0,0);
  // parallax hills strip
  ctx.fillStyle="rgba(70,120,80,.35)";
  for(let i=0;i<9;i++){ const x=((i*140 - A.scroll*.35)%(W+140)+W+140)%(W+140)-70; ctx.beginPath(); ctx.ellipse(x,600,86,40,0,0,Math.PI*2); ctx.fill(); }
  drawBirds(A.t,0.016,1.3);

  for (const g of A.gusts){
    const gx=aX(g.wx); if (gx<-200||gx>W+200) continue;
    ctx.strokeStyle="rgba(255,255,255,.55)"; ctx.lineWidth=2.5; ctx.lineCap="round";
    for(let i=0;i<5;i++){ const yy=g.y-g.h/2+i*(g.h/4), off=(A.t*220+i*40)%90;
      ctx.beginPath(); ctx.moveTo(gx-g.w/2+off,yy); ctx.lineTo(gx-g.w/2+off+50,yy+g.dir*14); ctx.stroke(); }
  }
  for (const c of A.clouds){ const cx=aX(c.wx); if (cx>-200&&cx<W+200){ drawAirCloud(cx,c.y,c.w,c.h,false,0);
    ctx.strokeStyle="rgba(120,160,200,.55)"; ctx.lineWidth=2;
    for(let i=0;i<6;i++){ const rx=cx-c.w*.4+i*(c.w*.16), ry=c.y+c.h*.4+((A.t*300+i*23)%60); ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(rx-3,ry+12); ctx.stroke(); } } }
  for (const st of A.storms){
    const sx=aX(st.wx); if (sx<-200||sx>W+200) continue;
    drawAirCloud(sx,st.y,st.w,74,true,st.phase==="warn"?st.flashed:0);
    if (st.phase==="bolt"){
      ctx.save(); ctx.strokeStyle="#fff6b0"; ctx.lineWidth=5; ctx.lineCap="round"; ctx.shadowColor="#ffe97a"; ctx.shadowBlur=18;
      ctx.beginPath(); let y=st.y+30, x=sx;
      ctx.moveTo(x,y); while(y<H-60){ y+=48; x+=rand(-18,18); ctx.lineTo(x,y); } ctx.stroke();
      ctx.restore();
    } else if (st.phase==="warn"){
      ctx.strokeStyle="rgba(255,240,150,"+(.3+st.flashed*.6)+")"; ctx.lineWidth=3; ctx.setLineDash([6,8]);
      ctx.beginPath(); ctx.moveTo(sx,st.y+34); ctx.lineTo(sx,H-60); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  for (const bl of A.balloons){ const bx=aX(bl.wx); if (bx>-80&&bx<W+80) drawBalloon(bx,bl.y+Math.sin(A.t*1.3+bl.bob)*7,bl.cat); }
  for (const it of A.items){ const ix=aX(it.wx); if (ix<-40||ix>W+40) continue; const iy=it.y+Math.sin(A.t*2+it.bob)*6; const k=KINDS[it.kind];
    ctx.fillStyle="rgba(255,255,255,.25)"; ctx.beginPath(); ctx.arc(ix,iy,18,0,Math.PI*2); ctx.fill(); orb(ctx,ix,iy,11,k.light,k.dark); }
  for (const ac of A.acorns){ const ax=aX(ac.wx); if (ax<-40||ax>W+40) continue; const ay=ac.y+Math.sin(A.t*2+ac.bob)*5;
    ctx.fillStyle="#b57a3a"; ctx.beginPath(); ctx.ellipse(ax,ay+3,8,10,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#6d4620"; ctx.beginPath(); ctx.ellipse(ax,ay-5,9,5,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#ffb347"; ctx.font="700 11px Fredoka"; ctx.textAlign="center"; ctx.fillText("x2",ax,ay-16); }
  for (const pk of A.pickups){ const px=aX(pk.wx); if (px>-40&&px<W+40) drawWeaponIcon(px,pk.y+Math.sin(A.t*2+pk.spin)*6,pk.tier,pk.spin,1); }
  for (const b of A.birdsL){ const bx=aX(b.wx); if (bx>-40&&bx<W+40) drawBird(bx,b.y+Math.sin(b.ph)*b.amp,b.flap); }
  for (const e of A.enemies){ const ex=aX(e.wx); if (ex>-80&&ex<W+80) drawEnemy(ex,e.y); }
  for (const b of A.eshots){ ctx.fillStyle="#ff6a3d"; ctx.beginPath(); ctx.ellipse(b.x,b.y,8,3,0,0,Math.PI*2); ctx.fill(); }
  for (const b of A.shots){ ctx.fillStyle=A.weapon?A_WEAPONS[A.weapon].col:"#fff3b0"; ctx.beginPath(); ctx.ellipse(b.x,b.y,10,3,Math.atan2(b.vy||0,b.vx),0,Math.PI*2); ctx.fill(); ctx.fillStyle="rgba(255,220,120,.5)"; ctx.beginPath(); ctx.ellipse(b.x-12,b.y,10,2,0,0,Math.PI*2); ctx.fill(); }
  for (const f of A.feathers){ ctx.save(); ctx.globalAlpha=clamp(f.life,0,1); ctx.translate(f.x,f.y); ctx.rotate(f.rot); ctx.fillStyle=f.col; ctx.beginPath(); ctx.ellipse(0,0,7,2.5,0,0,Math.PI*2); ctx.fill(); ctx.restore(); }

  const s=A.ship;
  const blinkOff = s.inv>0 && s.inv<50 && s.xray<=0 && s.flashHit<=0 && Math.floor(s.blink)%2===1;
  if (!blinkOff && !A.over) drawAirPlane(s.x,s.y,s.tilt,A_PLANE,s.xray>0,false);
  if (s.flashHit>0 && !A.over){
    ctx.save(); ctx.globalAlpha=s.flashHit*2.4; ctx.globalCompositeOperation="lighter";
    ctx.fillStyle="#ffffff"; ctx.beginPath(); ctx.ellipse(s.x,s.y+2,60,24,s.tilt,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  if (A.squirrel>0){
    // the co-pilot, perched on the tail
    ctx.save(); ctx.translate(s.x-38,s.y-30+Math.sin(A.t*8)*2);
    ctx.fillStyle="#b07040"; ctx.beginPath(); ctx.ellipse(0,0,7,9,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(0,-11,6,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="#b07040"; ctx.lineWidth=6; ctx.lineCap="round"; ctx.beginPath(); ctx.moveTo(-5,6); ctx.quadraticCurveTo(-18,-2,-14,-18); ctx.stroke();
    ctx.fillStyle="#1a1a1a"; ctx.beginPath(); ctx.arc(2,-12,1.5,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  for (const p of A.particles){ ctx.globalAlpha=clamp(p.life*1.7,0,1); ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); }
  ctx.globalAlpha=1;
  for (const c of A.confetti){ ctx.globalAlpha=clamp(c.life,0,1); ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.rot); ctx.fillStyle=c.col; ctx.fillRect(-c.sz/2,-c.sz/3,c.sz,c.sz*.66); ctx.restore(); }
  ctx.globalAlpha=1;
  if (A.dark>0){ ctx.fillStyle="rgba(40,60,80,"+(A.dark*.45)+")"; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle="rgba(200,220,240,.5)"; ctx.lineWidth=1.5;
    for(let i=0;i<40;i++){ const x=(i*47+A.t*500)%W, y=(i*83+A.t*700)%H; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-4,y+16); ctx.stroke(); } }

  ctx.textAlign="center"; ctx.textBaseline="middle";
  for (const t of A.toasts){ ctx.globalAlpha=clamp(t.life*1.5,0,1); chunky(ctx,t.text,t.x,t.y,17,t.color,"#231206",700); }
  ctx.globalAlpha=1;
  if (!POSTER){ drawAirHUD(); comboDraw(A,W/2,104); }
  ctx.restore();
  drawGlass();
  if (A.flash>0){ ctx.fillStyle="rgba("+A.flashCol+","+(A.flash*.3)+")"; ctx.fillRect(0,0,W,H); }
}
function drawAirHUD(){
  goldPanel(ctx,16,14,178,52,13);
  ctx.textAlign="left"; ctx.textBaseline="middle";
  chunky(ctx,String(A.score),30,38,26,"#fff6c9","#4a1f08",700);
  ctx.textAlign="right"; ctx.font="600 11px Fredoka, system-ui, sans-serif";
  ctx.fillStyle="rgba(255,255,255,.5)"; ctx.fillText("BEST "+A.best,182,30);
  goldPanel(ctx,W/2-58,14,116,44,12);
  ctx.textAlign="center";
  const mm=Math.floor(A.timeLeft/60), ss=Math.floor(A.timeLeft%60);
  chunky(ctx,mm+":"+String(ss).padStart(2,"0"),W/2,36,23,A.timeLeft<=10?"#ff8a7a":"#fff6c9","#4a1f08",700);
  goldPanel(ctx,W-236,14,220,52,13);
  for (let i=0;i<A_LIVES;i++) drawPaw(W-214+i*22,40,i<A.lives);
  const wx=W-130, wy=40;
  if (A.weapon>0){
    drawWeaponIcon(wx,wy,A.weapon,A.t*1.4,.62);
    const amax=A_WEAPONS[A.weapon].ammo, af=clamp(A.ammo/amax,0,1);
    ctx.fillStyle="rgba(0,0,0,.4)"; ctx.beginPath(); ctx.roundRect(wx+18,wy-7,52,7,4); ctx.fill();
    ctx.fillStyle=A_WEAPONS[A.weapon].col; ctx.beginPath(); ctx.roundRect(wx+18,wy-7,52*af,7,4); ctx.fill();
    ctx.textAlign="left"; ctx.font="600 9.5px Fredoka, system-ui, sans-serif"; ctx.fillStyle="rgba(255,255,255,.75)";
    ctx.fillText(A_WEAPONS[A.weapon].name.toUpperCase(),wx+18,wy+9);
  } else {
    ctx.fillStyle="rgba(255,255,255,.28)"; ctx.beginPath(); ctx.ellipse(wx,wy,10,3,0,0,Math.PI*2); ctx.fill();
    ctx.textAlign="left"; ctx.font="600 9.5px Fredoka, system-ui, sans-serif"; ctx.fillStyle="rgba(255,255,255,.55)";
    ctx.fillText("BASIC SHOT",wx+18,wy+3);
  }
  ctx.textAlign="right"; ctx.font="600 9.5px Fredoka, system-ui, sans-serif"; ctx.fillStyle="rgba(255,255,255,.55)";
  ctx.fillText(A.balls+" balls \u00b7 "+A.birds+" birds \u00b7 "+A.planes+" planes"+(A.cats?" \u00b7 "+A.cats+" cats":"")+(A.squirrel>0?"  \u00b7 x2 "+Math.ceil(A.squirrel)+"s":""), W-24, 74);
  if (!A.started){
    const pl=(Math.sin(A.pulse*2.2)+1)/2; ctx.globalAlpha=.6+pl*.4; ctx.textAlign="center";
    chunky(ctx,"PRESS TO TAKE OFF",W/2,H-92,26,"#fff6c9","#12405c",700); ctx.globalAlpha=1;
    ctx.font="600 13px Fredoka, system-ui, sans-serif"; ctx.fillStyle="rgba(255,255,255,.85)";
    ctx.fillText("fly with the d-pad, all four ways \u00b7 button to shoot \u00b7 grab bones, paws and balls for better guns", W/2, H-62);
  }
}

// ---------------------------------------------------------------- loop
let last=performance.now();
let frameErr=0;
let PAUSED=false;
let lastPlaying="";
function frame(now){
  const dt=Math.min((now-last)/1000,.05); last=now;
  try{
    const pl = gameRunning() ? "1" : "0";
    if (pl!==lastPlaying){ lastPlaying=pl; document.body.dataset.playing=pl; }
    const d = PAUSED ? 0 : dt;
    if (PAUSED) pollGamepad();
    if (MODE==="tita"){ if (T){ if(!PAUSED) updateTita(d); drawTita(); } }
    else if (MODE==="flap"){ if (F){ if(!PAUSED) updateFlap(d); drawFlap(); } }
    else if (MODE==="paddle"){ if (P){ if(!PAUSED) updatePaddle(d); drawPaddle(); } }
    else if (MODE==="air"){ if (A){ if(!PAUSED) updateAir(d); drawAir(); } }
    else { if (G){ if(!PAUSED) update(d); draw(); } }
  }catch(err){
    // never let one bad frame stop the loop — the TV would just freeze
    if (frameErr++ < 3 && window.console) console.error("frame error:",err);
  }
  requestAnimationFrame(frame);
}

const homeEl=document.getElementById("home");
const menuEl=document.getElementById("menu");
const titaEl=document.getElementById("titamenu");
const flapEl=document.getElementById("flapmenu");
const padEl=document.getElementById("paddlemenu");
const airEl=document.getElementById("airmenu");
const pauseEl=document.getElementById("pause");
const overEl=document.getElementById("gameover");

const MARKS={
  home:  ["Bernard's","ARCADE"],
  ballies:["Ballies with","BERNARD"],
  tita:  ["Tita","SCOLDER"],
  flap:  ["Bernardy","FLAP"],
  paddle:["Giulia & Nic","PADDLE"],
  air:   ["Flying with","BERNARD"]
};
function setMark(which){
  document.querySelector(".mark .eyebrow").textContent=MARKS[which][0];
  document.querySelector(".mark .word").firstChild.textContent=MARKS[which][1];
  document.body.dataset.screen=which;
}
function hideAll(){
  homeEl.classList.remove("on"); menuEl.classList.remove("on");
  titaEl.classList.remove("on"); flapEl.classList.remove("on"); padEl.classList.remove("on");
  airEl.classList.remove("on"); pauseEl.classList.remove("on"); PAUSED=false;
  overEl.classList.remove("on","won","lost");
}
function refreshBests(){
  const get=k=>{ try{ return +localStorage.getItem(k)||0; }catch(e){ return 0; } };
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent = v ? "\u2605 "+v : ""; };
  set("bestBallies",get("ballies_best")); set("bestTita",get("tita_best")); set("bestFlap",get("flap_best"));
  set("bestPaddle",get("paddle_best")); set("bestAir",get("air_best"));
}
function goHome(){
  refreshBests();
  hideAll(); homeEl.classList.add("on"); setMark("home");
  MODE="ballies";
  if (G) G.running=false;
  if (T) T.running=false;
  if (F) F.running=false;
  if (P) P.running=false;
  if (A) A.running=false;
  draw();
}
function openBallies(){
  hideAll(); menuEl.classList.add("on"); setMark("ballies");
  MODE="ballies";
  if (!G){ G=newGame(0); loadBest(); }
  G.running=false; draw();
}
function openTita(){
  hideAll(); titaEl.classList.add("on"); setMark("tita");
  MODE="tita";
  if (!T){ T=newTita(0); loadTitaBest(); }
  T.running=false; drawTita();
}
function openFlap(){
  hideAll(); flapEl.classList.add("on"); setMark("flap");
  MODE="flap";
  if (!F){ F=newFlap(0); loadFlapBest(); }
  F.running=false; drawFlap();
}
function startFlap(){
  const best=F?F.best:0;
  F=newFlap(best);
  MODE="flap"; setMark("flap");
  hideAll();
  if (!ac) beep(1,.01);
}
function openPaddle(){
  hideAll(); padEl.classList.add("on"); setMark("paddle");
  MODE="paddle";
  if (!P){ P=newPaddle(0); loadPBest(); }
  P.running=false; drawPaddle();
}
function setChar(who){
  P_CHAR=who;
  document.getElementById("padGiulia").classList.toggle("chosen",who==="giulia");
  document.getElementById("padNic").classList.toggle("chosen",who==="nic");
}
function startPaddle(){
  const best=P?P.best:0;
  P=newPaddle(best);
  MODE="paddle"; setMark("paddle");
  hideAll();
  if (!ac) beep(1,.01);
}
function openAir(){
  hideAll(); airEl.classList.add("on"); setMark("air");
  MODE="air";
  if (!A){ A=newAir(0); loadABest(); }
  A.running=false; drawAir();
}
function setPlane(t){
  const jet=t==="jet";
  A_PLANE=t;
  document.getElementById("airBiplane").classList.toggle("chosen",!jet);
  document.getElementById("airJet").classList.toggle("chosen",jet);
  const airEl=document.getElementById("airmenu");
  if (airEl){
    const shot=airEl.querySelector(".shot");
    airEl.classList.toggle("jet", jet);
    if (shot){ shot.style.opacity="0"; setTimeout(()=>{ shot.style.opacity="1"; }, 70); }
  }
  updateStar();
}
function updateStar(){
  const img=document.getElementById("starPic");
  const cap=document.getElementById("starCap");
  if (!img) return;
  const on = id => document.getElementById(id) && document.getElementById(id).classList.contains("on");
  if (!on("home")) return;
  const id=(GP_ITEMS.home||[])[GP.focus]||"pickFlap";
  const air=id==="pickAir";
  const which=air?(A_PLANE==="jet"?"jet":"air"):"flap";
  if (img.getAttribute("data-which")===which){ img.style.opacity="1"; return; }
  img.style.opacity="0";
  setTimeout(()=>{
    img.src=air?(which==="jet"?"art/bernard-jet-portrait.jpg":"art/bernard-pilot-portrait.jpg"):"art/bernard-portrait.jpg";
    img.setAttribute("data-which",which);
    if (cap) cap.textContent=air?(which==="jet"?"Firefighter":"Pilot"):"The proprietor";
    img.style.opacity="1";
  },90);
}
function startAir(){
  const best=A?A.best:0;
  A=newAir(best);
  MODE="air"; setMark("air");
  hideAll();
  if (!ac) beep(1,.01);
}
// ---- pause / quit, reachable from every game
function gameRunning(){
  return (MODE==="tita"&&T&&T.running)||(MODE==="flap"&&F&&F.running)||
         (MODE==="paddle"&&P&&P.running)||(MODE==="air"&&A&&A.running)||(MODE==="ballies"&&G&&G.running);
}
function togglePause(){
  if (!gameRunning()) return;
  PAUSED=!PAUSED;
  pauseEl.classList.toggle("on",PAUSED);
  if (PAUSED){ UI_FOCUS=true; GP.focus=0; GP.lastScreen="pause"; gpApplyFocus(); }
}
function resumeGame(){ if (PAUSED){ PAUSED=false; pauseEl.classList.remove("on"); } }
function quitToArcade(){
  // don't throw away a high score just because they bailed early
  try{
    if (MODE==="tita"&&T&&T.score>T.best){ T.best=T.score; saveTitaBest(T.best); }
    if (MODE==="flap"&&F&&F.score>F.best){ F.best=F.score; saveFlapBest(F.best); }
    if (MODE==="paddle"&&P&&P.score>P.best){ P.best=P.score; saveP(P.best); }
    if (MODE==="air"&&A&&A.score>A.best){ A.best=A.score; saveABest(A.best); }
    if (MODE==="ballies"&&G&&G.score>G.best){ G.best=G.score; saveBest(G.best); }
  }catch(e){}
  PAUSED=false; goHome();
}
function start(){
  const best=G?G.best:0;
  for (const q of POOPS) q.cool=0;
  G=newGame(best);
  MODE="ballies"; setMark("ballies");
  hideAll();
  if (!ac) beep(1,.01);
}
function startTita(){
  const best=T?T.best:0;
  T=newTita(best);
  MODE="tita"; setMark("tita");
  hideAll();
  if (!ac) beep(1,.01);
}
function startCurrent(){ if (MODE==="tita") startTita(); else if (MODE==="flap") startFlap(); else if (MODE==="paddle") startPaddle(); else if (MODE==="air") startAir(); else start(); }

document.getElementById("goalNum").textContent=WIN_SCORE;
document.getElementById("titaGoal").textContent=T_WIN;
document.getElementById("startBtn").addEventListener("click",start);
document.getElementById("titaStartBtn").addEventListener("click",startTita);
document.getElementById("flapStartBtn").addEventListener("click",startFlap);
document.getElementById("againBtn").addEventListener("click",startCurrent);
document.getElementById("pickBallies").addEventListener("click",openBallies);
document.getElementById("pickTita").addEventListener("click",openTita);
document.getElementById("pickFlap").addEventListener("click",openFlap);
document.getElementById("pickPaddle").addEventListener("click",openPaddle);
document.getElementById("padStartBtn").addEventListener("click",startPaddle);
document.getElementById("padGiulia").addEventListener("click",()=>setChar("giulia"));
document.getElementById("padNic").addEventListener("click",()=>setChar("nic"));
document.getElementById("pickAir").addEventListener("click",openAir);
document.getElementById("airStartBtn").addEventListener("click",startAir);
document.getElementById("airBiplane").addEventListener("click",()=>setPlane("biplane"));
document.getElementById("airBiplane").addEventListener("mouseenter",()=>setPlane("biplane"));
document.getElementById("airJet").addEventListener("click",()=>setPlane("jet"));
document.getElementById("airJet").addEventListener("mouseenter",()=>setPlane("jet"));
document.getElementById("pauseBtn").addEventListener("click",togglePause);
document.getElementById("pauseResume").addEventListener("click",resumeGame);
document.getElementById("pauseQuit").addEventListener("click",quitToArcade);
document.getElementById("pauseSound").addEventListener("click",()=>{ document.getElementById("soundBtn").click(); document.getElementById("pauseSound").textContent="Sound: "+(audioOn?"on":"off"); });
for (const b of document.querySelectorAll(".backBtn")) b.addEventListener("click",goHome);
document.getElementById("overHome").addEventListener("click",goHome);

document.getElementById("soundBtn").addEventListener("click",e=>{
  audioOn=!audioOn;
  e.target.textContent="Sound: "+(audioOn?"on":"off");
  e.target.setAttribute("aria-pressed",String(audioOn));
});
document.getElementById("glareBtn").addEventListener("click",e=>{
  glare=!glare;
  e.target.textContent="Glare: "+(glare?"on":"off");
  e.target.setAttribute("aria-pressed",String(glare));
});

ambInit();
bakeBackground();
bakeTitaRoom();
bakeFlapSky();
bakePaddleSea();
bakeAirSky();

// Tita Scolder's menu art is rendered from the game's own scene — a posed
// frame of the living room, grabbed off the canvas at load.
function makeTitaPoster(){
  const keep=T;
  T=newTita(0); T.running=false; T.t=1.1; T.pulse=2.2;
  T.player.x=352; T.player.y=486; T.player.face=1; T.player.phase=1.2;
  T.carry=["carrot","sloth"];
  T.dog.x=648; T.dog.y=430; T.dog.face=Math.PI; T.dog.phase=2.1; T.dog.wag=1.4;
  T.dog.crocMode=0; T.dog.target=null;
  T.tita.out=3; T.tita.x=214; T.tita.y=336; T.tita.face=1; T.tita.phase=1.6;
  T.tita.bark={text:"\u00A1Ya!",life:2};
  T.loose=[
    {kind:"gecko", x:604,y:556,spin:.16,fresh:0},
    {kind:"sloth", x:486,y:344,spin:-.3,fresh:0}
  ];
  T.shoes.forEach((sh,i)=>{ sh.gone=i>2; });
  POSTER=true;
  try{
    drawTita();
    const url=cv.toDataURL("image/jpeg",.82);
    document.documentElement.style.setProperty("--ph-tita","url("+url+")");
  }catch(e){}
  POSTER=false;
  T=keep;
}
G=newGame(0); G.running=false;
T=newTita(0); T.running=false;
F=newFlap(0); F.running=false;
P=newPaddle(0); P.running=false;
A=newAir(0); A.running=false;
loadBest(); loadTitaBest(); loadFlapBest(); loadPBest(); loadABest();

// Bernardy Flap's card art, rendered from a posed frame of the game
function makeFlapPoster(){
  const keep=F;
  F=newFlap(0); F.running=false;
P=newPaddle(0); P.running=false;
A=newAir(0); A.running=false; F.started=true; F.t=1.4; F.pulse=2.1;
  F.bird.x=250; F.bird.y=286; F.bird.vy=-150; F.bird.tilt=-.32;
  F.bird.flap=1; F.bird.wing=1.9;
  F.gates=[
    {x:470,gapY:250,gapH:206,passed:false,kind:"green",ball:{y:250,taken:false,spin:.4}},
    {x:760,gapY:352,gapH:196,passed:false,kind:"gold", ball:{y:352,taken:false,spin:1.1}}
  ];
  F.score=180; F.passed=18;
  POSTER=true;
  try{
    drawFlap();
    document.documentElement.style.setProperty("--ph-flap","url("+cv.toDataURL("image/jpeg",.82)+")");
  }catch(e){}
  POSTER=false;
  F=keep;
}
function makePaddlePoster(){
  const keep=P, keepChar=P_CHAR;
  P=newPaddle(0); P.running=false;
A=newAir(0); A.running=false; P.started=true; P.t=1.3; P.pulse=2.0; P.dist=600;
  P.vx=210; P.rider.y=402; P.rider.stroke=.55;
  P.items=[{wx:900,y:330,kind:"gold",taken:false,bob:1},
           {wx:1040,y:470,kind:"green",taken:false,bob:2.4}];
  P.hazards=[{wx:1130,y:392,type:"shark",phase:.6,hit:false,amp:0},
             {wx:760,y:560,type:"kelp",phase:1.2,hit:false,amp:0}];
  for(let i=0;i<5;i++) P.wake.push({wx:P.dist-30-i*26,y:P.rider.y+18,life:1-i*.15,r:8+i*5});
  POSTER=true;
  try{
    drawPaddle();
    document.documentElement.style.setProperty("--ph-paddle","url("+cv.toDataURL("image/jpeg",.82)+")");
  }catch(e){}
  POSTER=false;
  P=keep; P_CHAR=keepChar;
}
function makeAirPoster(){
  const keep=A;
  A=newAir(0); A.running=false; A.started=true; A.t=1.2; A.pulse=2; A.scroll=800;
  A.ship.y=300; A.ship.tilt=-.14;
  A.clouds=[{wx:1180,y:180,w:150,h:70},{wx:1400,y:430,w:120,h:60}];
  A.items=[{wx:1080,y:260,kind:"green",taken:false,bob:1},{wx:1146,y:270,kind:"gold",taken:false,bob:2},{wx:1212,y:262,kind:"green",taken:false,bob:3}];
  A.birdsL=[{wx:1320,y:330,amp:0,ph:0,sp:0,dead:false,flap:1}];
  A.balloons=[{wx:1520,y:250,cat:true,popped:false,bob:0}];
  A.pickups=[{wx:1290,y:420,tier:1,taken:false,spin:.8}];
  A.squirrel=5;
  POSTER=true;
  try{ drawAir(); document.documentElement.style.setProperty("--ph-air","url("+cv.toDataURL("image/jpeg",.82)+")"); }catch(e){}
  POSTER=false; A=keep;
}
function makePosters(){ makeTitaPoster(); makeFlapPoster(); makePaddlePoster(); makeAirPoster(); }
makePosters();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(makePosters);
setMark("home");
refreshBests();
draw();
requestAnimationFrame(frame);
})();
