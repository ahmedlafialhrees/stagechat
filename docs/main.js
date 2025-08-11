// main.js — نسخة متوافقة مع سفاري (بدون top-level await)
(async function init() {
  let THREE;
  try {
    THREE = await import('https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js');
  } catch (e) {
    try {
      THREE = await import('https://unpkg.com/three@0.161.0/build/three.module.js');
    } catch (e2) {
      alert("تعذّر تحميل Three.js — جرّب إعادة تحميل الصفحة أو اتصال مختلف.");
      return;
    }
  }

  const { WebGLRenderer, Scene, Fog, PerspectiveCamera, HemisphereLight, DirectionalLight,
          PlaneGeometry, MeshStandardMaterial, Mesh, BoxGeometry, MeshBasicMaterial,
          CylinderGeometry, PointLight, SphereGeometry, CapsuleGeometry, Vector3, Euler } = THREE;

  /* عناصر الصفحة */
  const canvas = document.getElementById('scene');
  const hpEl = document.getElementById('hp');
  const scoreEl = document.getElementById('score');
  const waveEl = document.getElementById('wave');
  const centerMsg = document.getElementById('centerMsg');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const touchLeft = document.getElementById('touchLeft');
  const touchRight = document.getElementById('touchRight');
  const stickLeft = document.getElementById('stickLeft');
  const stickRight = document.getElementById('stickRight');
  const shootTap = document.getElementById('shootTap');

  /* إعداد المشهد */
  const renderer = new WebGLRenderer({canvas, antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new Scene();
  scene.fog = new Fog(0x0b1220, 40, 180);

  const camera = new PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 500);
  camera.position.set(0, 1.6, 5);
  scene.add(camera);

  const hemi = new HemisphereLight(0x66aaff, 0x0b0f18, 0.6); scene.add(hemi);
  const sun  = new DirectionalLight(0xffffff, 0.9);
  sun.castShadow = true; sun.position.set(20,40,10); sun.shadow.mapSize.set(1024,1024);
  scene.add(sun);

  /* أرض + مدينة خيال */
  const ground = new Mesh(new PlaneGeometry(400, 400), new MeshStandardMaterial({color:0x0f1724, metalness:0.1, roughness:1}));
  ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);

  const city = new THREE.Group();
  const bMat   = new MeshStandardMaterial({color:0x0b6cff, emissive:0x072c6f, emissiveIntensity:.25, metalness:.6, roughness:.35});
  const glowMat= new MeshBasicMaterial({color:0x19d3ff});
  for (let x=-9; x<=9; x++) for (let z=-9; z<=9; z++) {
    if (Math.abs(x)<2 && Math.abs(z)<2) continue;
    const h=1+Math.random()*8;
    const m=new Mesh(new BoxGeometry(2,h,2), bMat);
    m.position.set(x*4, h/2, z*4); m.castShadow=true; m.receiveShadow=true; city.add(m);
    if (Math.random()<.25){ const line=new Mesh(new BoxGeometry(2.02,.05,.1), glowMat);
      line.position.set(m.position.x, Math.random()*h, m.position.z+1.05); city.add(line); }
  }
  scene.add(city);

  /* اللاعب + سلاح */
  const player = {
    hpMax:100, hp:100, speed:7.5,
    pos:new Vector3(0,1.6,0), yaw:0, pitch:0, vel:new Vector3(),
    fireRate:0.12, fireCooldown:0
  };
  hpEl.textContent = player.hp;

  const gun = new THREE.Group();
  const body   = new Mesh(new BoxGeometry(0.35,0.22,0.8), new MeshStandardMaterial({color:0x222831, metalness:.9, roughness:.2}));
  body.position.set(0.3,-0.21,-0.7);
  const barrel = new Mesh(new CylinderGeometry(0.05,0.05,0.6,16), new MeshStandardMaterial({color:0x2d89ef, emissive:0x1133aa, emissiveIntensity:.5, metalness:.8, roughness:.25}));
  barrel.rotation.z=Math.PI/2; barrel.position.set(0.42,-0.19,-0.62);
  const sight  = new Mesh(new BoxGeometry(0.12,0.06,0.16), new MeshStandardMaterial({color:0x444}));
  sight.position.set(0.25,-0.12,-0.38);
  gun.add(body, barrel, sight); camera.add(gun);

  const muzzle = new PointLight(0xfff1a8, 0, 6, 1.5);
  muzzle.position.set(0.72,-0.2,-1.1); camera.add(muzzle);

  /* رصاص + أعداء */
  const bullets = []; const enemies = [];
  let score=0, wave=1;
  const bulletGeo=new SphereGeometry(0.05,12,12);
  const bulletMat=new MeshBasicMaterial({color:0xffffee});

  function spawnBullet(){
    const m=new Mesh(bulletGeo, bulletMat);
    m.position.copy(camera.position);
    const dir=new Vector3(0,0,-1).applyEuler(new Euler(player.pitch, player.yaw, 0, 'YXZ')).normalize();
    m.userData.vel=dir.multiplyScalar(28); m.userData.life=1.2;
    scene.add(m); bullets.push(m);
    muzzle.intensity=4.5; setTimeout(()=>muzzle.intensity=0,40);
  }

  const eGeo=new CapsuleGeometry(0.4,0.8,8,16);
  const eMat=new MeshStandardMaterial({color:0xff5a5a, emissive:0x4e0202, emissiveIntensity:.3, metalness:.2, roughness:.9});
  function spawnEnemy(){
    const a=Math.random()*Math.PI*2, r=45+Math.random()*10;
    const m=new Mesh(eGeo,eMat);
    m.castShadow=true; m.receiveShadow=true;
    m.position.set(Math.cos(a)*r,0.9,Math.sin(a)*r);
    m.userData={hp:40+wave*4, speed:2.5+Math.random()*0.7+wave*0.08, dmg:10+wave*1.2, cooldown:0};
    scene.add(m); enemies.push(m);
  }

  let spawnTimer=0;
  function updateSpawning(dt){
    spawnTimer-=dt;
    if (spawnTimer<=0 && enemies.length<Math.min(8+wave*2,50)){
      spawnEnemy(); spawnTimer=Math.max(0.25, 1.2 - wave*0.05);
    }
    if (score>=wave*120){ wave++; waveEl.textContent=wave; }
  }

  /* إدخال */
  const keys={};
  addEventListener('keydown', e=>keys[e.code]=true);
  addEventListener('keyup',   e=>keys[e.code]=false);

  let pointerLocked=false, shootPressed=false, running=false, last=performance.now()/1000;

  function lockPointer(){
    if (matchMedia('(hover:hover)').matches) canvas.requestPointerLock && canvas.requestPointerLock();
  }
  document.addEventListener('pointerlockchange', ()=>{ pointerLocked=(document.pointerLockElement===canvas); });
  addEventListener('mousemove', e=>{
    if (!pointerLocked) return;
    const s=0.0022; player.yaw-=e.movementX*s; player.pitch-=e.movementY*s; player.pitch=Math.max(-1.2, Math.min(1.2, player.pitch));
  });
  addEventListener('mousedown', e=>{ if(running){ if(!pointerLocked) lockPointer(); if(e.button===0) shootPressed=true; }});
  addEventListener('mouseup',   e=>{ if(e.button===0) shootPressed=false; });

  // لمس (عصاتين)
  let moveTouchId=null, lookTouchId=null;
  const left={x:0,y:0,dx:0,dy:0}, right={x:0,y:0};
  function inEl(el,x,y){ const r=el.getBoundingClientRect(); return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom; }
  function setStick(el,dx,dy){ el.style.left=(50+dx*30)+'%'; el.style.top=(50+dy*30)+'%'; }
  addEventListener('touchstart', e=>{
    for(const t of e.changedTouches){
      const x=t.clientX,y=t.clientY;
      if(inEl(touchLeft,x,y)&&moveTouchId===null){ moveTouchId=t.identifier; left.x=x; left.y=y; left.dx=0; left.dy=0; setStick(stickLeft,0,0); }
      else if(inEl(touchRight,x,y)&&lookTouchId===null){ lookTouchId=t.identifier; right.x=x; right.y=y; setStick(stickRight,0,0); shootPressed=true; shootTap.classList.remove('hidden'); }
    }
  },{passive:true});
  addEventListener('touchmove', e=>{
    for(const t of e.changedTouches){
      const x=t.clientX,y=t.clientY;
      if(t.identifier===moveTouchId){
        const dx=(x-left.x)/60, dy=(y-left.y)/60;
        left.dx=Math.max(-1,Math.min(1,dx)); left.dy=Math.max(-1,Math.min(1,dy)); setStick(stickLeft,left.dx,left.dy);
      } else if(t.identifier===lookTouchId){
        const dx=(x-right.x)/2.5, dy=(y-right.y)/2.5;
        player.yaw-=dx*0.01; player.pitch-=dy*0.01; player.pitch=Math.max(-1.2,Math.min(1.2,player.pitch));
        right.x=x; right.y=y; setStick(stickRight,0,0);
      }
    }
  },{passive:true});
  addEventListener('touchend', e=>{
    for(const t of e.changedTouches){
      if(t.identifier===moveTouchId){ moveTouchId=null; left.dx=left.dy=0; setStick(stickLeft,0,0); }
      if(t.identifier===lookTouchId){ lookTouchId=null; shootPressed=false; shootTap.classList.add('hidden'); setStick(stickRight,0,0); }
    }
  },{passive:true});

  /* لعبة */
  function reset(){
    player.hp=player.hpMax; hpEl.textContent=player.hp;
    player.pos.set(0,1.6,0); player.vel.set(0,0,0); player.yaw=0; player.pitch=0;
    camera.position.copy(player.pos); camera.rotation.set(player.pitch,player.yaw,0,'YXZ');
    for(const b of bullets) scene.remove(b); bullets.length=0;
    for(const e of enemies) scene.remove(e); enemies.length=0;
    score=0; wave=1; scoreEl.textContent='0'; waveEl.textContent='1';
  }

  function updatePlayer(dt){
    camera.rotation.set(player.pitch,player.yaw,0,'YXZ');
    let ix=0,iz=0;
    if(keys['KeyW']||keys['ArrowUp']) iz-=1;
    if(keys['KeyS']||keys['ArrowDown']) iz+=1;
    if(keys['KeyA']||keys['ArrowLeft']) ix-=1;
    if(keys['KeyD']||keys['ArrowRight']) ix+=1;
    if(moveTouchId!==null){ ix+=left.dx; iz+=left.dy; }
    const len=Math.hypot(ix,iz)||1; ix/=len; iz/=len;
    const f=new Vector3(Math.sin(player.yaw),0,Math.cos(player.yaw));
    const r=new Vector3(f.z,0,-f.x);
    player.vel.copy(f.multiplyScalar(-iz).add(r.multiplyScalar(ix))).multiplyScalar(player.speed);
    player.pos.addScaledVector(player.vel,dt);
    player.pos.x=Math.max(-34,Math.min(34,player.pos.x));
    player.pos.z=Math.max(-34,Math.min(34,player.pos.z));
    camera.position.copy(player.pos);
  }

  function updateBullets(dt){
    for(const b of bullets){ b.position.addScaledVector(b.userData.vel,dt); b.userData.life-=dt; if(b.userData.life<=0){ scene.remove(b); b.userData.dead=true; } }
    for(let i=bullets.length-1;i>=0;i--) if(bullets[i].userData.dead) bullets.splice(i,1);
  }

  function updateEnemies(dt){
    for(const e of enemies){
      const to=new Vector3().subVectors(player.pos,e.position); to.y=0;
      const d=to.length(); to.normalize(); e.position.addScaledVector(to,dt*e.userData.speed);
      e.userData.cooldown-=dt;
      if(d<1.1 && e.userData.cooldown<=0){ player.hp=Math.max(0,player.hp-e.userData.dmg); hpEl.textContent=player.hp; e.userData.cooldown=0.7; }
    }
    for(const b of bullets){
      for(const e of enemies){
        if(e.userData.hp<=0) continue;
        if(e.position.distanceToSquared(b.position)<0.7*0.7){
          e.userData.hp-=25; b.userData.life=0;
          if(e.userData.hp<=0){ e.userData.dead=true; score+=10; scoreEl.textContent=score;
            const pl=new PointLight(0xff7766,2.5,6,2); pl.position.copy(e.position).add(new Vector3(0,1,0)); scene.add(pl); setTimeout(()=>scene.remove(pl),80);
          }
        }
      }
    }
    for(let i=enemies.length-1;i>=0;i--) if(enemies[i].userData.dead){ scene.remove(enemies[i]); enemies.splice(i,1); }
  }

  function tryShoot(dt){
    player.fireCooldown-=dt;
    if(shootPressed && player.fireCooldown<=0){ spawnBullet(); player.fireCooldown=player.fireRate; player.pitch-=0.007; }
  }

  function step(ms){
    if(!running) return;
    const now=ms/1000; let dt=Math.min(0.033, now - last); last=now;
    updatePlayer(dt); tryShoot(dt); updateBullets(dt); updateEnemies(dt); updateSpawning(dt);
    renderer.setClearColor(0x070a0f,1); renderer.render(scene,camera);
    if(player.hp<=0){
      running=false; centerMsg.classList.add('show');
      centerMsg.querySelector('h1').textContent='Game Over';
      centerMsg.querySelectorAll('p')[0].textContent=`نتيجتك: ${score} — الموجة ${wave}`;
      restartBtn.classList.remove('hidden'); startBtn.classList.add('hidden');
      document.exitPointerLock && document.exitPointerLock(); return;
    }
    requestAnimationFrame(step);
  }

  // أزرار
  startBtn.onclick = ()=>{ centerMsg.classList.remove('show'); reset(); running=true; last=performance.now()/1000; requestAnimationFrame(step); lockPointer(); };
  restartBtn.onclick = ()=>startBtn.onclick();

  // Resize
  addEventListener('resize', ()=>{ renderer.setSize(innerWidth, innerHeight); camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); });

  // إظهار شاشة البداية
  centerMsg.classList.add('show');
})(); // end init
