// Fantasy City 3D Shooter — Twin-stick (desktop+mobile)
const canvas = document.getElementById('scene');
const hpEl = document.getElementById('hp');
const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');
const centerMsg = document.getElementById('centerMsg');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

// Touch zones
const touchLeft = document.getElementById('touchLeft');
const touchRight = document.getElementById('touchRight');
const stickLeft = document.getElementById('stickLeft');
const stickRight = document.getElementById('stickRight');
const shootTap = document.getElementById('shootTap');

// THREE setup
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b1220, 40, 180);

const camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 500);
camera.position.set(0, 1.6, 5);
scene.add(camera);

const hemi = new THREE.HemisphereLight(0x66aaff, 0x0b0f18, 0.6);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.castShadow = true;
sun.position.set(20,40,10);
sun.shadow.mapSize.set(1024,1024);
scene.add(sun);

// Ground
const groundGeo = new THREE.PlaneGeometry(400, 400);
const groundMat = new THREE.MeshStandardMaterial({color:0x0f1724, metalness:0.1, roughness:1});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
scene.add(ground);

// Neon fantasy city: grid of buildings
const city = new THREE.Group();
const bMat = new THREE.MeshStandardMaterial({color:0x0b6cff, emissive:0x072c6f, emissiveIntensity: 0.25, metalness:0.6, roughness:0.35});
const glowMat = new THREE.MeshBasicMaterial({color:0x19d3ff});
for (let x=-9; x<=9; x++){
  for (let z=-9; z<=9; z++){
    if (Math.abs(x)<2 && Math.abs(z)<2) continue; // ساحة اللعب
    const h = 1 + Math.random()*8;
    const geo = new THREE.BoxGeometry(2, h, 2);
    const m = new THREE.Mesh(geo, bMat);
    m.position.set(x*4, h/2, z*4);
    m.castShadow = true; m.receiveShadow = true;
    city.add(m);
    // خطوط مضيئة بسيطة
    if (Math.random()<0.25){
      const g = new THREE.BoxGeometry(2.02, 0.05, 0.1);
      const line = new THREE.Mesh(g, glowMat);
      line.position.set(m.position.x, Math.random()*h, m.position.z+1.05);
      city.add(line);
    }
  }
}
scene.add(city);

// Player (capsule + gun attached to camera)
const player = {
  hpMax: 100,
  hp: 100,
  speed: 7.5,
  pos: new THREE.Vector3(0,1.6,0),
  yaw: 0,
  pitch: 0,
  vel: new THREE.Vector3(),
  canShoot: true,
  fireRate: 0.12,
  fireCooldown: 0
};
hpEl.textContent = player.hp;

// a simple gun model attached to camera
const gun = new THREE.Group();
const body = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.22,0.8), new THREE.MeshStandardMaterial({color:0x222831, metalness:0.9, roughness:0.2}));
body.position.set(0.3,-0.21,-0.7);
const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.6,16), new THREE.MeshStandardMaterial({color:0x2d89ef, emissive:0x1133aa, emissiveIntensity:0.5, metalness:0.8, roughness:0.25}));
barrel.rotation.z = Math.PI/2;
barrel.position.set(0.42,-0.19,-0.62);
const sight = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.06,0.16), new THREE.MeshStandardMaterial({color:0x444}));
sight.position.set(0.25,-0.12,-0.38);
gun.add(body, barrel, sight);
camera.add(gun);

// Muzzle flash light
const muzzle = new THREE.PointLight(0xfff1a8, 0, 6, 1.5);
muzzle.position.set(0.72,-0.2,-1.1);
camera.add(muzzle);

// Bullets & Enemies
const bullets = [];
const enemies = [];
let score = 0;
let wave = 1;

// Bullet factory
const bulletGeo = new THREE.SphereGeometry(0.05, 12, 12);
const bulletMat = new THREE.MeshBasicMaterial({color:0xffffee});
function spawnBullet(){
  const m = new THREE.Mesh(bulletGeo, bulletMat);
  m.position.copy(camera.position);
  const dir = new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ')).normalize();
  m.userData.vel = dir.multiplyScalar(28);
  m.userData.life = 1.2;
  scene.add(m);
  bullets.push(m);
  // muzzle flash
  muzzle.intensity = 4.5;
  setTimeout(()=>muzzle.intensity=0, 40);
}

// Enemy factory (red capsule-ish)
const eGeo = new THREE.CapsuleGeometry(0.4, 0.8, 8, 16);
const eMat = new THREE.MeshStandardMaterial({color:0xff5a5a, emissive:0x4e0202, emissiveIntensity: 0.3, metalness:0.2, roughness:0.9});
function spawnEnemy(){
  const angle = Math.random()*Math.PI*2;
  const radius = 45 + Math.random()*10;
  const x = Math.cos(angle)*radius;
  const z = Math.sin(angle)*radius;
  const m = new THREE.Mesh(eGeo, eMat);
  m.castShadow = true; m.receiveShadow = true;
  m.position.set(x, 0.9, z);
  m.userData = {hp: 40 + wave*4, speed: 2.5 + Math.random()*0.7 + wave*0.08, dmg: 10 + wave*1.2, cooldown: 0};
  scene.add(m);
  enemies.push(m);
}

// Spawner
let spawnTimer = 0;
function updateSpawning(dt){
  spawnTimer -= dt;
  if (spawnTimer <= 0 && enemies.length < Math.min(8 + wave*2, 50)){
    spawnEnemy();
    spawnTimer = Math.max(0.25, 1.2 - wave*0.05);
  }
  if (score >= wave*120){
    wave++;
    waveEl.textContent = wave;
  }
}

// Resize
addEventListener('resize', ()=>{
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
});

// Input
const keys = {};
addEventListener('keydown', e=>{ keys[e.code]=true; });
addEventListener('keyup', e=>{ keys[e.code]=false; });

let pointerLocked = false;
function lockPointer(){
  if (matchMedia('(hover:hover)').matches){
    canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
    if (canvas.requestPointerLock) canvas.requestPointerLock();
  }
}
document.addEventListener('pointerlockchange', ()=>{ pointerLocked = document.pointerLockElement === canvas; });

// Desktop mouse look
addEventListener('mousemove', (e)=>{
  if (!pointerLocked) return;
  const sens = 0.0022;
  player.yaw   -= e.movementX * sens;
  player.pitch -= e.movementY * sens;
  player.pitch = Math.max(-1.2, Math.min(1.2, player.pitch));
});

addEventListener('mousedown', (e)=>{
  if (!running) return;
  if (!pointerLocked) lockPointer();
  if (e.button === 0) shootPressed = true;
});
addEventListener('mouseup', (e)=>{ if(e.button===0) shootPressed=false; });

// Mobile twin-stick
let moveTouchId = null, lookTouchId = null;
const left = {active:false, x:0, y:0, dx:0, dy:0};
const right = {active:false, x:0, y:0, dx:0, dy:0};
function inEl(el, x, y){
  const r = el.getBoundingClientRect();
  return x>=r.left && x<=r.right && y>=r.top && y<=r.bottom;
}
function setStick(stickEl, cx, cy, dx, dy){
  const s = stickEl;
  s.style.left = (50 + dx*30) + '%';
  s.style.top  = (50 + dy*30) + '%';
}
addEventListener('touchstart', (e)=>{
  for (const t of e.changedTouches){
    const x=t.clientX, y=t.clientY;
    if (inEl(touchLeft,x,y) && moveTouchId===null){
      moveTouchId=t.identifier; left.active=true; left.x=x; left.y=y; left.dx=0; left.dy=0;
      setStick(stickLeft,0,0,0,0);
    } else if (inEl(touchRight,x,y) && lookTouchId===null){
      lookTouchId=t.identifier; right.active=true; right.x=x; right.y=y; right.dx=0; right.dy=0;
      setStick(stickRight,0,0,0,0);
      shootPressed = true; // tap to shoot
      shootTap.classList.remove('hidden');
    }
  }
},{passive:true});
addEventListener('touchmove', (e)=>{
  for (const t of e.changedTouches){
    const x=t.clientX, y=t.clientY;
    if (t.identifier===moveTouchId){
      const dx = (x-left.x)/60, dy = (y-left.y)/60;
      left.dx = Math.max(-1, Math.min(1, dx));
      left.dy = Math.max(-1, Math.min(1, dy));
      setStick(stickLeft, left.x, left.y, left.dx, left.dy);
    } else if (t.identifier===lookTouchId){
      const dx = (x-right.x)/2.5, dy = (y-right.y)/2.5;
      player.yaw   -= dx * 0.01;
      player.pitch -= dy * 0.01;
      player.pitch = Math.max(-1.2, Math.min(1.2, player.pitch));
      right.x=x; right.y=y;
      setStick(stickRight, 0,0, 0,0);
    }
  }
},{passive:true});
addEventListener('touchend', (e)=>{
  for (const t of e.changedTouches){
    if (t.identifier===moveTouchId){ moveTouchId=null; left.active=false; left.dx=left.dy=0; setStick(stickLeft,0,0,0,0); }
    if (t.identifier===lookTouchId){ lookTouchId=null; right.active=false; shootPressed=false; shootTap.classList.add('hidden'); setStick(stickRight,0,0,0,0); }
  }
},{passive:true});

let shootPressed = false;

// Game loop
let running = false;
let last = performance.now()/1000;

function reset(){
  // reset player
  player.hp = player.hpMax; hpEl.textContent = player.hp;
  player.pos.set(0,1.6,0); player.vel.set(0,0,0); player.yaw=0; player.pitch=0;
  camera.position.copy(player.pos);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  // clear enemies/bullets
  for (const b of bullets) scene.remove(b);
  bullets.length=0;
  for (const e of enemies) scene.remove(e);
  enemies.length=0;
  score = 0; wave = 1;
  scoreEl.textContent = '0'; waveEl.textContent = '1';
}

function updatePlayer(dt){
  // look
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  // move input
  let ix=0, iz=0;
  if (keys['KeyW']||keys['ArrowUp']) iz -= 1;
  if (keys['KeyS']||keys['ArrowDown']) iz += 1;
  if (keys['KeyA']||keys['ArrowLeft']) ix -= 1;
  if (keys['KeyD']||keys['ArrowRight']) ix += 1;
  // mobile left stick
  if (moveTouchId!==null){
    ix += left.dx;
    iz += left.dy;
  }
  const len = Math.hypot(ix,iz)||1;
  ix/=len; iz/=len;
  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  const rightV = new THREE.Vector3(forward.z, 0, -forward.x);
  player.vel.copy(forward.multiplyScalar(-iz).add(rightV.multiplyScalar(ix))).multiplyScalar(player.speed);
  player.pos.addScaledVector(player.vel, dt);
  // clamp world
  player.pos.x = Math.max(-34, Math.min(34, player.pos.x));
  player.pos.z = Math.max(-34, Math.min(34, player.pos.z));
  camera.position.copy(player.pos);
}

function updateBullets(dt){
  for (const b of bullets){
    b.position.addScaledVector(b.userData.vel, dt);
    b.userData.life -= dt;
    if (b.userData.life<=0){
      scene.remove(b);
      b.userData.dead = true;
    }
  }
  for (let i=bullets.length-1;i>=0;i--){
    if (bullets[i].userData.dead){ bullets.splice(i,1); }
  }
}

function updateEnemies(dt){
  for (const e of enemies){
    const toPlayer = new THREE.Vector3().subVectors(player.pos, e.position); toPlayer.y=0;
    const d = toPlayer.length();
    toPlayer.normalize();
    e.position.addScaledVector(toPlayer, dt*e.userData.speed);
    // damage player if close
    e.userData.cooldown -= dt;
    if (d < 1.1 && e.userData.cooldown<=0){
      player.hp = Math.max(0, player.hp - e.userData.dmg);
      hpEl.textContent = player.hp;
      e.userData.cooldown = 0.7;
    }
  }
  // bullet collisions
  for (const b of bullets){
    for (const e of enemies){
      if (e.userData.hp<=0) continue;
      const d2 = e.position.distanceToSquared(b.position);
      if (d2 < 0.7*0.7){
        e.userData.hp -= 25;
        b.userData.life = 0;
        if (e.userData.hp<=0){
          // death
          score += 10;
          scoreEl.textContent = score;
          e.userData.dead = true;
          // small flash
          const pl = new THREE.PointLight(0xff7766, 2.5, 6, 2);
          pl.position.copy(e.position).add(new THREE.Vector3(0,1,0));
          scene.add(pl);
          setTimeout(()=>scene.remove(pl), 80);
        }
      }
    }
  }
  // remove dead enemies
  for (let i=enemies.length-1;i>=0;i--){
    if (enemies[i].userData.dead){
      scene.remove(enemies[i]);
      enemies.splice(i,1);
    }
  }
}

function tryShoot(dt){
  player.fireCooldown -= dt;
  if (shootPressed && player.fireCooldown<=0){
    spawnBullet();
    player.fireCooldown = player.fireRate;
    // recoil
    player.pitch -= 0.007;
  }
}

function step(nowMs){
  if (!running) return;
  const now = nowMs/1000; let dt = now-last; last = now;
  dt = Math.min(0.033, dt);
  updatePlayer(dt);
  tryShoot(dt);
  updateBullets(dt);
  updateEnemies(dt);
  updateSpawning(dt);

  // render
  renderer.setClearColor(0x070a0f, 1);
  renderer.render(scene, camera);

  if (player.hp<=0){
    running = false;
    centerMsg.classList.add('show');
    centerMsg.querySelector('h1').textContent = 'Game Over';
    centerMsg.querySelectorAll('p')[0].textContent = `نتيجتك: ${score} — الموجة ${wave}`;
    restartBtn.classList.remove('hidden');
    startBtn.classList.add('hidden');
    document.exitPointerLock && document.exitPointerLock();
    return;
  }

  requestAnimationFrame(step);
}

// Buttons
startBtn.onclick = ()=>{
  centerMsg.classList.remove('show');
  reset();
  running = true;
  last = performance.now()/1000;
  requestAnimationFrame(step);
  lockPointer();
};
restartBtn.onclick = ()=>startBtn.onclick();

// Initial
centerMsg.classList.add('show');
