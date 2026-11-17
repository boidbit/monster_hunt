import {Chase, FIXED_DT, road, worldPoint, random, clamp} from './core.mjs';
import {buildMonster, buildTruck} from './models.mjs';
import {LiveAudio} from './audio.mjs';

const params=new URLSearchParams(location.search), capture=params.get('capture')==='1';
if(capture) document.body.classList.add('capture');
const config={seed:Number(params.get('seed')??42),duration:Number(params.get('duration')??45),
  intensity:params.get('intensity')??'savage',ending:params.get('ending')??'escape'};
let THREE;
try {
  THREE=await import(capture ? '/vendor/three.module.js' : 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.module.js');
} catch(error) {
  document.getElementById('error').hidden=false;
  document.getElementById('error').textContent='The city could not load. Check your connection and reload.';
  throw error;
}
const sim=new Chase(config), audio=new LiveAudio();
const scene=new THREE.Scene();
const sky=document.createElement('canvas');sky.width=2;sky.height=256;
const skyCtx=sky.getContext('2d'),gradient=skyCtx.createLinearGradient(0,0,0,256);
gradient.addColorStop(0,'#345974');gradient.addColorStop(.48,'#9ab5ba');gradient.addColorStop(1,'#f9c995');
skyCtx.fillStyle=gradient;skyCtx.fillRect(0,0,2,256);
scene.background=new THREE.CanvasTexture(sky);scene.fog=new THREE.Fog(0xbfc6bb,85,235);
const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('game'),antialias:true, preserveDrawingBuffer:true});
renderer.setPixelRatio(capture?1:Math.min(devicePixelRatio,1.5));
renderer.setSize(innerWidth,innerHeight);renderer.outputEncoding=THREE.sRGBEncoding;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,320);
scene.add(new THREE.HemisphereLight(0xd2eefa,0x625356,.98));
const sun=new THREE.DirectionalLight(0xffe0b2,1.08);sun.castShadow=true;
sun.shadow.mapSize.set(512,512);Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:1,far:90});
sun.shadow.bias=-.001;scene.add(sun,sun.target);

const box=new THREE.BoxGeometry(1,1,1), cylinder=new THREE.CylinderGeometry(1,1,1,7);
const asphalt=new THREE.MeshLambertMaterial({color:0x35495a}), sidewalk=new THREE.MeshLambertMaterial({color:0xb0b2a3});
const roadLine=new THREE.MeshBasicMaterial({color:0xf6d48e}), white=new THREE.MeshBasicMaterial({color:0xe2e1c9});
const dark=new THREE.MeshLambertMaterial({color:0x213549}), foliage=new THREE.MeshLambertMaterial({color:0x527a64});
const glass=new THREE.MeshLambertMaterial({color:0x81acb7}), roof=new THREE.MeshLambertMaterial({color:0x4e5e68});
const lampLight=new THREE.MeshBasicMaterial({color:0xffe1a0}), wheelMat=new THREE.MeshLambertMaterial({color:0x142737});
const palette=[0xad745a,0x648d8f,0xc3a06e,0xb4b7ab,0x8c7371,0x748a9e];
function windows(color){
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#'+color.toString(16).padStart(6,'0');ctx.fillRect(0,0,64,128);
  for(let row=0;row<8;row++)for(let col=0;col<4;col++){
    ctx.fillStyle=(row+col)%4===0?'#e2d4ad':'#344c5e';ctx.fillRect(4+col*16,4+row*16,9,10);
    ctx.fillStyle='#c0b8a4';ctx.fillRect(4+col*16,14+row*16,10,1);
  }
  const tex=new THREE.CanvasTexture(canvas);tex.anisotropy=2;tex.encoding=THREE.sRGBEncoding;
  return new THREE.MeshLambertMaterial({map:tex});
}
const buildingsMats=palette.map(windows), carMats=[0xe8b84e,0xced7cf,0xa75e54,0x59899d,0x7e779e].map(color=>new THREE.MeshLambertMaterial({color}));
const ground=new THREE.Mesh(new THREE.PlaneGeometry(1500,1500),new THREE.MeshLambertMaterial({color:0x6e8179}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.08;ground.receiveShadow=true;scene.add(ground);
function mesh(parent,geo,mat,x,y,z,sx=1,sy=1,sz=1){
  const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;
}
function strip(start,width,y){
  const vertices=[],indices=[];
  for(let i=0;i<=16;i++){
    const s=start+i*5;
    for(const side of [-1,1]){const p=worldPoint(s,side*width,start);vertices.push(p.x,y,p.z);}
    if(i<16){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
  return geo;
}
function simpleCar(parent,color){
  const g=new THREE.Group();parent.add(g);
  mesh(g,box,carMats[color],0,.8,0,2.15,.8,4);
  mesh(g,box,glass,0,1.45,-.3,1.85,.6,2.1);
  mesh(g,box,carMats[color],0,1.8,-.3,1.95,.12,2.2);
  mesh(g,box,dark,0,.65,-2,2.2,.25,.15);
  for(const x of [-1,1])for(const z of [-1.2,1.2]){const m=mesh(g,cylinder,wheelMat,x,.45,z,.45,.3,.45);m.rotation.z=Math.PI/2;}
  return g;
}
const chunks=new Map(), buildingObjects=new Map(), trafficObjects=new Map();
function createChunk(desc){
  const root=new THREE.Group(), geos=[];
  const pavement=strip(desc.start,13,.02),street=strip(desc.start,10,.06);geos.push(pavement,street);
  const p=new THREE.Mesh(pavement,sidewalk),r=new THREE.Mesh(street,asphalt);r.receiveShadow=true;root.add(p,r);
  for(let s=desc.start+4;s<desc.start+80;s+=10)for(const lane of [-3.33,3.33]){
    const q=worldPoint(s,lane,desc.start);const m=mesh(root,box,roadLine,q.x,.075,q.z,.13,.025,4.5);m.rotation.y=Math.atan(road(s).dx);
  }
  // Cross streets, zebra crossings, and terraces break up the endless avenue.
  const cross=worldPoint(desc.start+70,0,desc.start);
  mesh(root,box,asphalt,cross.x,.035,cross.z,120,.03,13);
  for(let i=-7;i<=7;i+=2)mesh(root,box,white,cross.x+i,.08,cross.z-9,1,.025,3.2);
  for(const b of desc.buildings){
    const q=worldPoint(b.s,b.lane,desc.start), g=new THREE.Group();g.position.set(q.x,0,q.z);root.add(g);
    const facade=mesh(g,box,buildingsMats[b.color],0,b.height/2,0,b.width,b.height,b.depth);
    mesh(g,box,roof,0,b.height+.15,0,b.width+.4,.35,b.depth+.4);
    mesh(g,box,sidewalk,0,.2,0,b.width+1.5,.4,b.depth+1.5);
    if(b.height>25)mesh(g,box,dark,1,b.height+1.3,0,2,2.5,2);
    buildingObjects.set(b.id,{g,desc:b,fall:null,facade});
  }
  for(const o of desc.traffic){
    const g=simpleCar(root,o.color),q=worldPoint(o.s,o.lane,desc.start);g.position.set(q.x,0,q.z);g.rotation.y=Math.atan(road(o.s).dx);
    trafficObjects.set(o.id,g);
  }
  for(let s=desc.start+12;s<desc.start+80;s+=28)for(const side of [-1,1]){
    const q=worldPoint(s,side*11.8,desc.start);
    mesh(root,cylinder,dark,q.x,3,q.z,.09,6,.09);
    mesh(root,box,dark,q.x-side*.7,5.9,q.z,1.5,.1,.12);
    mesh(root,box,lampLight,q.x-side*1.3,5.8,q.z,.55,.14,.4);
    const tree=worldPoint(s+7,side*12.3,desc.start);
    mesh(root,cylinder,roof,tree.x,1.2,tree.z,.2,2.4,.2);
    mesh(root,box,foliage,tree.x,3,tree.z,2.2,2.5,2.2);
  }
  root.position.z=desc.start-sim.origin;scene.add(root);chunks.set(desc.index,{root,geos,desc});
}
function syncCity(){
  for(const [id,c]of chunks)if(!sim.chunks.has(id)){
    scene.remove(c.root);for(const geo of c.geos)geo.dispose();
    for(const b of c.desc.buildings)buildingObjects.delete(b.id);
    for(const o of c.desc.traffic)trafficObjects.delete(o.id);
    chunks.delete(id);
  }
  for(const [id,desc]of sim.chunks)if(!chunks.has(id))createChunk(desc);
  for(const c of chunks.values())c.root.position.z=c.desc.start-sim.origin;
  for(const c of sim.chunks.values())for(const o of c.traffic){const g=trafficObjects.get(o.id);if(g)g.visible=!o.hit;}
  ground.position.z=sim.car.s-sim.origin;
}
const car=buildTruck(THREE);scene.add(car.root);
const mon=buildMonster(THREE);mon.root.scale.setScalar(2.15);scene.add(mon.root);
mon.lime.color.setHex(0x95b84d);mon.belly.color.setHex(0xd3dc87);mon.pupil.color.setHex(0xff4a2b);
const debrisMat=new THREE.MeshLambertMaterial({color:0xb9a38b});
const particles=Array.from({length:110},()=>{const m=new THREE.Mesh(box,debrisMat);m.visible=false;scene.add(m);return {m,life:0,position:new THREE.Vector3(),velocity:new THREE.Vector3(),size:1};});
let particleIndex=0,shake=0,lastCaptionTime=-100,caption='IT FOUND YOU.';
function burst(s,lane,power=1){
  const p=worldPoint(s,lane),rng=random(Math.round(s*100+sim.time*1000));
  for(let i=0;i<20;i++){
    const d=particles[particleIndex++%particles.length];d.life=1.2+rng();
    d.position.set(p.x,1+rng()*4,p.z);d.velocity.set((rng()-.5)*14,4+rng()*9,(rng()-.5)*12);
    d.size=(.18+rng()*.65)*power;d.m.visible=true;d.m.scale.setScalar(d.size);
  }
}
const shock=new THREE.Mesh(new THREE.RingGeometry(.8,1,40),new THREE.MeshBasicMaterial({color:0xffd071,transparent:true,opacity:0,side:THREE.DoubleSide}));
shock.rotation.x=-Math.PI/2;scene.add(shock);let shockStart=-100,shockS=0,shockLane=0;
const warning=new THREE.Mesh(new THREE.RingGeometry(.86,1,40),new THREE.MeshBasicMaterial({color:0xff7451,transparent:true,opacity:0,side:THREE.DoubleSide}));
warning.rotation.x=-Math.PI/2;scene.add(warning);
const captions={swipe:'TOO CLOSE.',charge:'DON’T LOOK BACK.',leap:'MOVE. NOW.',smash:'IT MAKES ITS OWN ROADS.'};
const cameraPos=new THREE.Vector3(),cameraLook=new THREE.Vector3();let cameraInitialized=false,lastOrigin=0;
const stats={frames:0,maxGeometries:0,visibleSamples:0,bothVisible:0};
let running=false,paused=false,muted=false;
function processEvents(){
  for(const event of sim.drain()){
    if(!capture)audio.play(event);
    if(event.type==='attack'){caption=captions[event.attack];lastCaptionTime=sim.time;}
    if(event.type==='impact'){
      burst(event.s,event.lane,event.attack==='leap'?1.5:1);shake=event.attack==='leap'?.6:.35;
      shockStart=sim.time;shockS=event.s;shockLane=event.lane;
    }
    if(event.type==='collapse'){
      const b=buildingObjects.get(event.id);if(b)b.fall=sim.time;
      burst(event.s,event.lane,2);shake=.6;
    }
    if(event.type==='hit')shake=.45;
    if(event.type==='traffic')burst(event.s,event.lane);
  }
}
function actors(dt){
  const c=sim.car,m=sim.monster,cp=worldPoint(c.s,c.lane,sim.origin),mp=worldPoint(m.s,m.lane,sim.origin);
  car.root.position.set(cp.x,0,cp.z);car.root.rotation.y=Math.atan(road(c.s).dx)+Math.atan2(c.lateralSpeed,c.speed);
  car.body.rotation.z=c.roll;car.body.rotation.x=c.boosting?-.045:Math.sin(sim.time*16)*.008;
  for(const w of car.wheels){w.spin.rotation.x=c.s/.58;if(w.front)w.steer.rotation.y=-c.lateralSpeed*.07;}
  for(const f of car.flames){f.visible=!!c.boosting;f.scale.set(1,1+Math.sin(sim.time*54)*.22,1);}
  mon.root.position.set(mp.x,m.y,mp.z);
  mon.root.rotation.y=Math.atan(road(m.s).dx)+clamp((c.lane-m.lane)*.025,-.35,.35);
  mon.body.rotation.z=m.roll;mon.body.rotation.x=.12;
  const gait=m.s*1.35,step=Math.sin(gait);
  mon.legL.rotation.x=step*.7;mon.legR.rotation.x=-step*.7;
  mon.armL.rotation.x=-step*.65-.35;mon.armR.rotation.x=step*.65-.35;
  mon.armL.rotation.z=-.12;mon.armR.rotation.z=.12;
  mon.body.position.y=Math.abs(Math.sin(gait))*.14;
  if(sim.attack){
    const a=sim.attack,age=sim.time-a.start;
    if(a.type==='swipe'){mon.armL.rotation.x=-1.7;mon.armL.rotation.z=-.2-Math.sin(age*2.8)*1.1;}
    if(a.type==='leap'){mon.armL.rotation.x=mon.armR.rotation.x=-2.4;mon.legL.rotation.x=.4;mon.legR.rotation.x=-.4;}
    if(a.type==='charge'){mon.body.rotation.x=.38;mon.armL.rotation.x=mon.armR.rotation.x=-.9;}
    if(a.type==='smash'){mon.armR.rotation.x=-2.5+Math.min(1,Math.max(0,age-.9)*3)*2.2;}
  }
  for(const b of buildingObjects.values())if(b.fall!==null){
    const age=sim.time-b.fall;
    b.g.position.y=-(Math.min(1,age/1.6)**2)*b.desc.height;
    b.g.rotation.z=Math.min(age,1.6)*.12;
    if(age>1.8)b.g.visible=false;
  }
  for(const d of particles)if(d.life>0){
    d.life-=dt;d.velocity.y-=20*dt;d.position.addScaledVector(d.velocity,dt);
    if(d.position.y<.2){d.position.y=.2;d.velocity.y*=-.28;d.velocity.x*=.8;d.velocity.z*=.8;}
    d.m.position.set(d.position.x,d.position.y,d.position.z-sim.origin);
    d.m.rotation.x+=dt*3;d.m.rotation.z+=dt*4;
    d.m.scale.setScalar(d.size*Math.min(1,Math.max(0,d.life)*2));d.m.visible=d.life>0;
  }
  const shockAge=sim.time-shockStart,p=worldPoint(shockS,shockLane,sim.origin);
  shock.position.set(p.x,.14,p.z);shock.scale.setScalar(1+Math.max(0,shockAge)*18);
  shock.material.opacity=Math.max(0,1-shockAge/.7)*.65;
  if(sim.attack&&!sim.attack.impact){
    const a=sim.attack,q=worldPoint(c.s+8,a.targetLane,sim.origin);
    warning.position.set(q.x,.1,q.z);warning.scale.setScalar(a.type==='leap'?4:2.4);
    warning.material.opacity=.18+Math.sin(sim.time*18)*.08;
  }else warning.material.opacity=0;
  if(!capture)audio.update(c.speed);
}
function filmCamera(dt){
  if(lastOrigin!==sim.origin){cameraPos.z-=sim.origin-lastOrigin;cameraLook.z-=sim.origin-lastOrigin;lastOrigin=sim.origin;}
  const phase=(sim.time%config.duration)/config.duration,c=car.root.position,m=mon.root.position;
  let side=10,height=12,lead=29,shot='01 / CONTACT';
  if(phase>.22&&phase<.41){side=-18;height=10;lead=22;shot='02 / PURSUIT';}
  else if(phase>=.41&&phase<.62){side=21;height=13;lead=23;shot='03 / IMPACT';}
  else if(phase>=.62&&phase<.82){side=-24;height=19;lead=29;shot='04 / NO WAY OUT';}
  else if(phase>=.82){side=8;height=11;lead=29;shot='05 / LAST CHANCE';}
  const gap=c.z-m.z;
  // A front three-quarter camera keeps the car foreground and its pursuer readable.
  const target=new THREE.Vector3(c.x+side,c.y+height,c.z+lead);
  const look=new THREE.Vector3((c.x+m.x)*.5,3.0+(m.y*.12),c.z-Math.min(12,gap*.45));
  if(!cameraInitialized){cameraPos.copy(target);cameraLook.copy(look);cameraInitialized=true;}
  const smoothing=1-Math.exp(-dt*3.4);cameraPos.lerp(target,smoothing);cameraLook.lerp(look,smoothing);
  shake=Math.max(0,shake-dt*1.5);
  camera.position.copy(cameraPos);camera.position.x+=Math.sin(sim.time*71)*shake*.4;camera.position.y+=Math.cos(sim.time*57)*shake*.3;
  camera.lookAt(cameraLook);camera.updateMatrixWorld();
  document.getElementById('chapter').textContent=shot;
  if(phase>.94)caption=config.ending==='escape'?'STILL RUNNING.':'IT’S RIGHT BEHIND YOU.';
  else if(sim.time-lastCaptionTime>4)caption=phase<.1?'IT FOUND YOU.':phase<.45?'THERE IS NO SAFE STREET.':'KEEP. MOVING.';
  document.getElementById('caption').textContent=caption;
  document.getElementById('distance').textContent=Math.floor(sim.metrics.distance).toString().padStart(3,'0')+' M';
  document.getElementById('gap').textContent=(gap<9?'DANGER / ':gap<18?'PURSUER / ':'DISTANCE / ')+Math.round(gap)+' M';
  document.getElementById('progress').style.transform='scaleX('+phase+')';
  sun.position.set(c.x-20,40,c.z+10);sun.target.position.copy(c);
}
function render(dt){
  syncCity();processEvents();actors(dt);filmCamera(dt);
  renderer.render(scene,camera);stats.frames++;stats.maxGeometries=Math.max(stats.maxGeometries,renderer.info.memory.geometries);
  const a=car.root.position.clone().add(new THREE.Vector3(0,1.5,0)).project(camera);
  const b=mon.root.position.clone().add(new THREE.Vector3(0,5,0)).project(camera);
  const visible=p=>Math.abs(p.x)<.94&&Math.abs(p.y)<.83&&p.z<1&&p.z>-1;
  stats.visibleSamples++;if(visible(a)&&visible(b))stats.bothVisible++;
}
function advance(frames=1){
  if(!Number.isInteger(frames)||frames<1||frames>1800)throw Error('Invalid frame count.');
  for(let frame=0;frame<frames;frame++){sim.step();sim.step();render(1/30);}
  return {time:sim.time,speed:sim.car.speed,health:sim.car.health,gap:sim.car.s-sim.monster.s,
    chunks:sim.chunks.size,geometries:renderer.info.memory.geometries};
}
window.chase={
  ready:true,config,advance,
  report:()=>({config,snapshot:sim.snapshot(),events:sim.events,stats:{...stats,bothVisibleRatio:stats.bothVisible/Math.max(1,stats.visibleSamples)}}),
  renderInitial:()=>render(0)
};
render(0);
document.getElementById('start').addEventListener('click',async()=>{
  document.getElementById('welcome').hidden=true;
  document.getElementById('controls').style.display='flex';
  await audio.start();running=true;
});
document.getElementById('pause').addEventListener('click',()=>{paused=!paused;document.getElementById('pause').textContent=paused?'Resume':'Pause';if(audio.ctx)paused?audio.ctx.suspend():audio.ctx.resume();});
document.getElementById('mute').addEventListener('click',()=>{muted=!muted;audio.mute(muted);document.getElementById('mute').textContent=muted?'Sound off':'Sound on';});
let last=null,acc=0;
function loop(now){
  if(last===null)last=now;
  const dt=Math.min(.1,(now-last)/1000);last=now;
  if(running&&!paused&&!document.hidden){
    acc+=dt;let steps=0;
    while(acc>=FIXED_DT&&steps<6){sim.step();acc-=FIXED_DT;steps++;}
    render(steps*FIXED_DT);
  }else acc=0;
  requestAnimationFrame(loop);
}
if(!capture)requestAnimationFrame(loop);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);render(0);});
