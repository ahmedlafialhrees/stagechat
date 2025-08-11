"use strict";

/* ========== إعداد الكانفاس بدقة عالية ========== */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
function resize() {
  canvas.width  = Math.floor(innerWidth  * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width  = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", resize); resize();

/* ========== عناصر UI ========== */
const hpEl = document.getElementById("hp");
const scoreEl = document.getElementById("score");
const waveEl = document.getElementById("wave");
const centerMsg = document.getElementById("centerMsg");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const titleEl = document.getElementById("title");
const subtitleEl = document.getElementById("subtitle");

/* ========== أدوات مساعدة ========== */
const rand = (a,b)=>a+Math.random()*(b-a);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
function dist2(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return dx*dx+dy*dy; }
function angleTo(from,to){ return Math.atan2(to.y-from.y, to.x-from.x); }

/* ========== كيان عام ========== */
class Entity {
  constructor(x,y,r,color) {
    this.x=x; this.y=y; this.r=r;
    this.color=color; this.alive=true;
    this.vx=0; this.vy=0;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}

/* ========== اللاعب ========== */
class Player extends Entity {
  constructor() {
    super(canvas.width/2, canvas.height/2, 14, "#4cc9f0");
    this.speed = 260;
    this.hpMax = 100;
    this.hp = this.hpMax;
    this.fireCooldown = 0;
    this.fireRate = 0.14;
  }
  update(dt) {
    // حركة: كيبورد أو لمس
    let ix=0, iy=0;
    if (keys["KeyW"]||keys["ArrowUp"]) iy -= 1;
    if (keys["KeyS"]||keys["ArrowDown"]) iy += 1;
    if (keys["KeyA"]||keys["ArrowLeft"]) ix -= 1;
    if (keys["KeyD"]||keys["ArrowRight"]) ix += 1;

    // لو لمس موجود: اتجه له
    if (touchState.active && touchState.points.length>0) {
      const t = touchState.points[0];
      const ang = angleTo(this, t);
      ix = Math.cos(ang); iy = Math.sin(ang);
      // قريب؟ وقف
      if (dist2(this,t) < 20*20) { ix=0; iy=0; }
    }

    const len = Math.hypot(ix,iy)||1;
    this.vx = (ix/len)*this.speed;
    this.vy = (iy/len)*this.speed;
    this.x = clamp(this.x + this.vx*dt, this.r, canvas.width/ dpr - this.r);
    this.y = clamp(this.y + this.vy*dt, this.r, canvas.height/dpr - this.r);

    // إطلاق
    this.fireCooldown -= dt;
    const wantsShoot = mouse.down || touchState.points.length>1; // زر يسار أو لمس ثاني
    if (wantsShoot && this.fireCooldown <= 0) {
      this.fireCooldown = this.fireRate;
      let dir;
      if (mouse.active) dir = angleTo(this, mouse);
      else if (enemies.length) {
        // وجّه لأقرب عدو إذا ما فيه ماوس
        let e = nearestEnemy(this); dir = angleTo(this, e);
      } else dir = 0;
      bullets.push(new Bullet(this.x, this.y, dir, 720, 22, "#e9ecef"));
    }
  }
  damage(d) {
    this.hp = Math.max(0, this.hp - d);
    hpEl.textContent = this.hp;
    if (this.hp === 0) this.alive = false;
  }
}

/* ========== العدو ========== */
class Enemy extends Entity {
  constructor(x,y,speed=120, dmg=10, hp=30) {
    super(x,y,12,"#ff6b6b");
    this.speed=speed; this.dmg=dmg; this.hp=hp;
    this.hitCd = 0;
  }
  update(dt) {
    const ang = angleTo(this, player);
    this.vx = Math.cos(ang)*this.speed;
    this.vy = Math.sin(ang)*this.speed;
    this.x += this.vx*dt; this.y += this.vy*dt;

    // احتكاك مع اللاعب
    const rr = this.r + player.r;
    if (dist2(this, player) <= rr*rr) {
      if (this.hitCd<=0) {
        player.damage(this.dmg);
        this.hitCd = 0.6;
      }
    }
    this.hitCd -= dt;
  }
  take(dmg) {
    this.hp -= dmg;
    if (this.hp <= 0) { this.alive=false; score+=10; scoreEl.textContent=score; }
  }
}

/* ========== الرصاصة ========== */
class Bullet extends Entity {
  constructor(x,y,angle,speed,damage,color="#fff") {
    super(x,y,4,color);
    this.vx=Math.cos(angle)*speed;
    this.vy=Math.sin(angle)*speed;
    this.damage=damage;
    this.life=1.4;
  }
  update(dt) {
    this.x += this.vx*dt; this.y += this.vy*dt;
    this.life -= dt; if (this.life<=0) this.alive=false;
    // حدود الشاشة
    if (this.x<-10||this.y<-10||this.x>canvas.width/dpr+10||this.y>canvas.height/dpr+10) this.alive=false;
  }
}

/* ========== سباونر موجات ========== */
class Spawner {
  constructor(){ this.wave=1; this.timer=0; }
  update(dt){
    this.timer -= dt;
    if (this.timer<=0 && enemies.length<Math.min(8 + this.wave*2, 40)) {
      // سباون عدو على الأطراف
      const side = Math.floor(Math.random()*4); // 0..3
      let x,y,w=canvas.width/dpr,h=canvas.height/dpr, pad=40;
      if (side===0){ x=rand(-pad, w+pad); y=-pad; }
      if (side===1){ x=rand(-pad, w+pad); y=h+pad; }
      if (side===2){ x=-pad; y=rand(-pad, h+pad); }
      if (side===3){ x=w+pad; y=rand(-pad, h+pad); }
      const sp = rand(90, 130+this.wave*4);
      const hp = Math.round(rand(24, 30+this.wave*2));
      const dmg = Math.round(rand(8, 10+this.wave*1.2));
      enemies.push(new Enemy(x,y, sp, dmg, hp));
      this.timer = Math.max(0.2, 1.1 - this.wave*0.05);
    }
    // كل 25 نقطة تنتقل لموجة أعلى
    if (score >= this.wave*100) {
      this.wave++;
      waveEl.textContent = this.wave;
    }
  }
}

/* ========== إدخال ========== */
const keys = {};
addEventListener("keydown", e=>keys[e.code]=true);
addEventListener("keyup",   e=>keys[e.code]=false);

const mouse = {x:0,y:0,down:false,active:false};
addEventListener("mousemove", e=>{ mouse.active=true; mouse.x=e.clientX; mouse.y=e.clientY; });
addEventListener("mousedown", ()=>mouse.down=true);
addEventListener("mouseup",   ()=>mouse.down=false);

/* لمس مبسّط: أول إصبع تحرّك، ثاني إصبع إطلاق */
const touchState = { active:false, points:[] };
addEventListener("touchstart", e=>{
  touchState.active=true; touchState.points=[...e.touches].map(t=>({x:t.clientX,y:t.clientY}));
},{passive:true});
addEventListener("touchmove", e=>{
  touchState.points=[...e.touches].map(t=>({x:t.clientX,y:t.clientY}));
},{passive:true});
addEventListener("touchend", e=>{
  touchState.points=[...e.touches].map(t=>({x:t.clientX,y:t.clientY}));
  if (e.touches.length===0) touchState.active=false;
},{passive:true});

/* ========== لعبة ========== */
let player, enemies, bullets, spawner, running=false, score=0, last=0;
function reset() {
  player = new Player();
  enemies=[]; bullets=[]; spawner=new Spawner();
  running = true; score=0; last=performance.now()/1000;
  hpEl.textContent = player.hp; scoreEl.textContent = "0"; waveEl.textContent = "1";
}
function nearestEnemy(from){
  let best=null, bestD=Infinity;
  for (const e of enemies) {
    const d = dist2(from, e);
    if (d<bestD){ bestD=d; best=e; }
  }
  return best || {x: from.x+1, y: from.y};
}

function step(t){
  if (!running) return;
  const now = t/1000, dt = Math.min(0.033, now-last); last=now;

  // تحديث
  player.update(dt);
  spawner.update(dt);
  for (const e of enemies) e.update(dt);
  for (const b of bullets) b.update(dt);

  // تصادم رصاصة-عدو
  for (const b of bullets) if (b.alive) {
    for (const e of enemies) if (e.alive) {
      const rr = b.r + e.r;
      if (dist2(b,e) <= rr*rr) { e.take(b.damage); b.alive=false; break; }
    }
  }

  // تنظيف
  enemies = enemies.filter(e=>e.alive);
  bullets = bullets.filter(b=>b.alive);

  // رسم
  ctx.clearRect(0,0,canvas.width/dpr,canvas.height/dpr);

  // خلفية شبكية خفيفة
  ctx.globalAlpha = 0.15;
  for (let x=0; x<canvas.width/dpr; x+=40) {
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height/dpr); ctx.strokeStyle="#99a1b21a"; ctx.stroke();
  }
  for (let y=0; y<canvas.height/dpr; y+=40) {
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width/dpr,y); ctx.strokeStyle="#99a1b21a"; ctx.stroke();
  }
  ctx.globalAlpha = 1;

  player.draw();
  for (const e of enemies) e.draw();
  for (const b of bullets) b.draw();

  // فشل؟
  if (!player.alive) {
    running=false;
    titleEl.textContent = "Game Over";
    subtitleEl.textContent = `نتيجتك: ${score} — الموجة ${spawner.wave}`;
    centerMsg.classList.remove("hidden");
    restartBtn.classList.remove("hidden");
    startBtn.classList.add("hidden");
  } else {
    requestAnimationFrame(step);
  }
}

/* ========== أزرار ========== */
startBtn.onclick = ()=>{
  centerMsg.classList.add("hidden");
  reset();
  requestAnimationFrame(step);
};
restartBtn.onclick = ()=>startBtn.onclick();

/* شاشة البداية ظاهر */
centerMsg.classList.remove("hidden");
