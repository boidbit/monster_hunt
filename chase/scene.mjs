import {Chase,FIXED_DT,GRID,stuntAt,streetWidth,random,clamp,distance} from './core.mjs';
import {buildMonster,buildTruck} from './models.mjs';
import {LiveAudio} from './audio.mjs';
const params=new URLSearchParams(location.search),capture=params.get('capture')==='1';
if(capture)document.body.classList.add('capture');
const config={seed:Number(params.get('seed')??crypto.getRandomValues(new Uint32Array(1))[0]),duration:Number(params.get('duration')??60),intensity:params.get('intensity')??'savage',ending:params.get('ending')??'auto'};
let history={};try{history=JSON.parse(params.get('history')||localStorage.getItem('monster-director-history')||'{}');}catch{}
const THREE=await import(capture?'/vendor/three.module.js':'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.module.js');
const sim=new Chase({...config,history}),audio=new LiveAudio(),scene=new THREE.Scene();
scene.background=new THREE.Color(0x8da9b7);scene.fog=new THREE.Fog(0x8da9b7,100,245);
const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('game'),antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(capture?1:Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
renderer.outputEncoding=THREE.sRGBEncoding;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,450);
scene.add(new THREE.HemisphereLight(0xcce9ff,0x6e5963,.9));
const sun=new THREE.DirectionalLight(0xffdca6,1.15);sun.castShadow=true;sun.shadow.mapSize.set(512,512);
Object.assign(sun.shadow.camera,{left:-40,right:40,top:40,bottom:-40,near:1,far:140});sun.shadow.bias=-.001;scene.add(sun,sun.target);
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
function simpleCar(parent,color){
  const g=new THREE.Group();parent.add(g);
  mesh(g,box,carMats[color],0,.8,0,2.15,.8,4);
  mesh(g,box,glass,0,1.45,-.3,1.85,.6,2.1);
  mesh(g,box,carMats[color],0,1.8,-.3,1.95,.12,2.2);
  mesh(g,box,dark,0,.65,-2,2.2,.25,.15);
  for(const x of [-1,1])for(const z of [-1.2,1.2]){const m=mesh(g,cylinder,wheelMat,x,.45,z,.45,.3,.45);m.rotation.z=Math.PI/2;}
  return g;
}

const chunks=new Map(),buildingObjects=new Map(),trafficObjects=new Map();
function createChunk(desc){
 const root=new THREE.Group();scene.add(root);
 const x=desc.x*GRID,z=desc.z*GRID,w=streetWidth(desc.x,desc.z);
 mesh(root,box,sidewalk,0,0,45,26,.1,90);
 mesh(root,box,sidewalk,45,0,0,90,.1,26);
 mesh(root,box,asphalt,0,.07,45,w*2,.05,90);
 mesh(root,box,asphalt,45,.07,0,90,.05,w*2);
 mesh(root,box,asphalt,0,.08,0,26,.05,26);
 for(let t=20;t<80;t+=12){mesh(root,box,roadLine,0,.11,t,.16,.02,5);mesh(root,box,roadLine,t,.11,0,5,.02,.16);}
 for(let t=-8;t<=8;t+=3){mesh(root,box,white,t,.12,14,1.3,.02,3);mesh(root,box,white,14,.12,t,3,.02,1.3);}
 for(const b of desc.buildings){
  const g=new THREE.Group();g.position.set(b.x-x,0,b.z-z);root.add(g);
  const facade=mesh(g,box,buildingsMats[b.color],0,b.height/2,0,b.width,b.height,b.depth);
  facade.castShadow=true;facade.receiveShadow=true;
  mesh(g,box,roof,0,b.height+.2,0,b.width+.5,.4,b.depth+.5);
  mesh(g,box,dark,2,b.height+1,1,3,2,3);
  buildingObjects.set(b.id,{g,facade,desc:b,fall:null});
 }
 for(const t of [28,62])for(const side of [-1,1]){
  mesh(root,cylinder,dark,side*12,3,t,.1,6,.1);
  mesh(root,box,lampLight,side*11,5.8,t,2,.15,.4);
 }
 chunks.set(desc.id,{root,desc});root.position.set(x-sim.origin.x,0,z-sim.origin.z);
}
const props=new Map(),melonGeometry=new THREE.SphereGeometry(.5,9,7);
function syncProps(){
 const segment=Math.floor(sim.car.s/GRID);
 for(const [index,g] of props)if(index<segment-1||index>segment+2){scene.remove(g);props.delete(index);}
 for(let index=Math.max(0,segment-1);index<=segment+2;index++){
  const p=stuntAt(index,config.seed),at=sim.point(p.s);let g=props.get(index);
  if(!g){
   g=new THREE.Group();scene.add(g);props.set(index,g);
   if(p.kind==='ramp'){
    const deck=mesh(g,box,carMats[0],0,1.38,-4,7.6,.25,8.4);deck.rotation.x=-.31;
    for(const x of [-3.5,3.5])mesh(g,box,dark,x,1.2,-.5,.36,2.4,.45);
    for(const z of [-6,-4,-2]){const stripe=mesh(g,box,dark,0,(z+8)*.32+.22,z,6,.06,.35);stripe.rotation.x=-.31;}
   }else if(p.kind==='pothole'){
    mesh(g,cylinder,sidewalk,0,.14,0,3.4,.14,3.2);mesh(g,cylinder,wheelMat,0,.23,0,2.9,.09,2.7);
    for(const x of [-3.6,3.6]){mesh(g,cylinder,carMats[0],x,.52,-1,.38,1,.38);mesh(g,box,white,x,.65,-1,.65,.14,.65);}
   }else if(p.kind==='barrier'){
    mesh(g,box,dark,-6,2.7,0,.8,5.4,.9);
    const arm=new THREE.Group();g.add(arm);arm.position.set(-6,4.25,0);g.userData.arm=arm;
    mesh(arm,box,white,6,0,0,12,.55,.55);for(let x=1;x<12;x+=2)mesh(arm,box,carMats[2],x,0,0,1,.57,.58);
   }else{
    mesh(g,box,carMats[0],0,1,0,2,1.2,2.4);
    for(const x of [-1,1])mesh(g,box,dark,x,2.1,0,.12,2.6,.14);
    for(let i=0;i<6;i++)mesh(g,box,i%2?white:carMats[2],-1.25+i*.5,3.45,0,.51,.33,3);
    g.userData.fruit=[];for(let i=0;i<8;i++)g.userData.fruit.push(mesh(g,melonGeometry,foliage,(i%3-1)*.55,1.85,-.72+Math.floor(i/3)*.55));
   }
  }
  g.position.set(at.x-sim.origin.x,0,at.z-sim.origin.z);g.rotation.y=at.h;
  if(g.userData.arm)g.userData.arm.rotation.z=sim.broken.has(index)?1.4:clamp((p.s-sim.car.s-5)/22,0,1)*.8;
  if(g.userData.fruit&&sim.melons?.index===index){const t=clamp(sim.time-sim.melons.time,0,2.2);g.userData.fruit.forEach((v,i)=>v.position.set((i%3-1)*(.55+t*1.5),Math.max(.48,1.85-4*t*t)+.18*Math.abs(Math.sin(t*8)), -1-t*(2+i*.45)));}
 }
}
function syncCity(){
 syncProps();
 for(const [id,c]of chunks)if(!sim.chunks.has(id)){scene.remove(c.root);for(const b of c.desc.buildings)buildingObjects.delete(b.id);chunks.delete(id);}
 for(const [id,c]of sim.chunks)if(!chunks.has(id))createChunk(c);
 for(const c of chunks.values())c.root.position.set(c.desc.x*GRID-sim.origin.x,0,c.desc.z*GRID-sim.origin.z);
 const active=new Set(sim.traffic.map(t=>t.id));
 for(const [id,g]of trafficObjects)if(!active.has(id)){scene.remove(g);trafficObjects.delete(id);}
 for(const t of sim.traffic){
  let g=trafficObjects.get(t.id);
  if(!g){g=simpleCar(scene,t.color);if(t.kind==='bus')g.scale.set(1.1,1.65,2);trafficObjects.set(t.id,g);}
  g.position.set(t.x-sim.origin.x,0,t.z-sim.origin.z);g.rotation.y=t.h;
 }
 ground.position.set(sim.car.x-sim.origin.x,ground.position.y,sim.car.z-sim.origin.z);
}
const car=buildTruck(THREE),mon=buildMonster(THREE);scene.add(car.root,mon.root);mon.root.scale.setScalar(2.15);
mon.lime.color.setHex(0x95b84d);mon.belly.color.setHex(0xd3dc87);mon.pupil.color.setHex(0xff4a2b);
const debrisMat=new THREE.MeshLambertMaterial({color:0xb9a38b});
const particles=Array.from({length:90},()=>{const m=new THREE.Mesh(box,debrisMat);scene.add(m);m.visible=false;return {m,life:0,p:new THREE.Vector3(),v:new THREE.Vector3(),size:1};});
let particleIndex=0,shake=0,caption='NO SAFE WAY OUT.',captionAt=0,eventShot='pursuit',eventShotUntil=0;
const captions={swipe:'TOO CLOSE.',charge:'DON’T LOOK BACK.',leap:'MOVE. NOW.',intercept:'IT KNOWS THE WAY.',flank:'FROM THE ROOFTOPS.',smash:'NOWHERE TO HIDE.'};
const shock=new THREE.Mesh(new THREE.RingGeometry(.82,1,40),new THREE.MeshBasicMaterial({color:0xffc879,transparent:true,opacity:0,side:THREE.DoubleSide}));
shock.rotation.x=-Math.PI/2;scene.add(shock);let shockAt=-100,shockPoint={x:0,z:0};
function events(){
 for(const e of sim.drain()){
  if(!capture)audio.play(e);
  if(e.type==='attack'){caption=captions[e.attack];captionAt=sim.time;eventShot=['intercept','flank','leap'].includes(e.attack)?'reveal':e.attack==='smash'?'side':'pursuit';eventShotUntil=sim.time+3.6;}
  if(e.type==='stunt'){caption={ramp:'SEND IT.',market:'CLEANUP ON AISLE FOUR.',barrier:'DUCK.',pothole:'MIND THE GAP.'}[e.kind];captionAt=sim.time;}
  if(e.type==='slip'){caption='THOSE WERE NOT BRAKES.';captionAt=sim.time;}
  if(e.type==='roofLand'){shake=.34;}
  if(e.type==='turn'){caption='TAKE THE NEXT TURN.';captionAt=sim.time;eventShot='corner';eventShotUntil=sim.time+2;}
  if(e.type==='nearMiss'){caption='THAT WAS TOO CLOSE.';captionAt=sim.time;}
  if(e.type==='reveal'){caption='IT’S ALREADY HERE.';captionAt=sim.time;eventShot='reveal';eventShotUntil=sim.time+2;}
  if(e.type==='impact'||e.type==='collapse'||e.type==='traffic'){
   shake=.5;shockAt=sim.time;shockPoint={x:e.x,z:e.z};
   const rng=random(Math.round(sim.time*1000));
   for(let i=0;i<20;i++){const d=particles[particleIndex++%particles.length];d.life=1+rng();d.p.set(e.x,1+rng()*3,e.z);d.v.set((rng()-.5)*16,6+rng()*8,(rng()-.5)*16);d.size=.2+rng()*.7;d.m.visible=true;}
   if(e.type==='collapse'){const b=buildingObjects.get(e.id);if(b)b.fall=sim.time;}
  }
  if(e.type==='ending'){caption=e.reason==='intercepted'?'NO WAY OUT.':'THE HUNT CONTINUES.';captionAt=sim.time;}
 }
}
function actors(dt){
 const c=sim.car,m=sim.monster;
 car.root.position.set(c.x-sim.origin.x,c.y||0,c.z-sim.origin.z);car.root.rotation.y=c.h+Math.atan2(c.lateralSpeed,c.speed)*.6;
 car.body.rotation.z=c.roll-c.turn*.1;car.body.rotation.x=c.pitch||(c.boosting?-.05:Math.sin(sim.time*16)*.01);
 for(const w of car.wheels){w.spin.rotation.x=c.s/.58;if(w.front)w.steer.rotation.y=-c.lateralSpeed*.05-c.turn*.3;}
 for(const f of car.flames){f.visible=c.boosting;f.scale.y=1+Math.sin(sim.time*54)*.2;}
 mon.root.position.set(m.x-sim.origin.x,m.y,m.z-sim.origin.z);mon.root.rotation.y=m.h;
 const phase=((m.s%20)+20)%20/20,step=Math.sin(phase*2*Math.PI),air=m.y>1&&!([1,3].includes(sim.attack?.stage));
 mon.body.position.y=1.36+Math.abs(step)*.12;mon.body.rotation.x=air?.24:.09;mon.body.rotation.z=m.slipUntil>sim.time?.34*Math.sin((m.slipUntil-sim.time)*8):0;
 for(const [leg,offset] of [[mon.legL,0],[mon.legR,.5]]){
  const t=(phase+offset)%1,stance=t<.5,u=stance?t*2:(t-.5)*2;
  const reach=stance?2.32-4.64*u:-2.32+4.64*(u*u*(3-2*u));
  leg.rotation.x=air?(offset?.68:-.85):-Math.asin(reach/2.65);
  leg.position.y=2.65*Math.cos(leg.rotation.x)+(air?1.2:stance?0:Math.sin(u*Math.PI)*.85);
 }
 mon.armL.rotation.x=air?-2.1:-step*.66-.2;mon.armR.rotation.x=air?-2.1:step*.66-.2;
 if(sim.attack?.type==='swipe')mon.armL.rotation.x=-1.8;
 if(sim.attack?.type==='smash')mon.armR.rotation.x=-2.5+clamp((sim.time-sim.attack.start-.7)*2,0,2);
 for(const b of buildingObjects.values())if(b.fall!==null){const age=sim.time-b.fall;b.g.position.y=-(Math.min(1,age/1.5)**2)*b.desc.height;b.g.visible=age<1.6;}
 for(const d of particles)if(d.life>0){d.life-=dt;d.v.y-=20*dt;d.p.addScaledVector(d.v,dt);d.m.position.set(d.p.x-sim.origin.x,d.p.y,d.p.z-sim.origin.z);d.m.scale.setScalar(d.size*clamp(d.life*2,0,1));d.m.rotation.x+=dt*3;d.m.visible=d.life>0;}
 const age=sim.time-shockAt;shock.position.set(shockPoint.x-sim.origin.x,.15,shockPoint.z-sim.origin.z);shock.scale.setScalar(1+Math.max(0,age)*16);shock.material.opacity=Math.max(0,1-age/.65)*.6;
 if(!capture)audio.update(c.speed);
}
const sightline=new THREE.Raycaster(),lastCamera=new THREE.Vector3(),lastLook=new THREE.Vector3();
let shot='pursuit',shotSince=-10,initialized=false,lastOrigin={x:0,z:0},previousClear=true,blockedFrames=0;
const shotHistory=[...(history.shots||[])].slice(-4),shotLog=[];
const stats={frames:0,maxGeometries:0,visibleSamples:0,bothVisible:0,bothUnoccluded:0,maxOccludedFrames:0,cameraCuts:0,subjectVisible:0,subjectClear:0,streetFrames:0};
function clearLine(p,from,facades){
 const d=p.clone().sub(from);sightline.set(from,d.clone().normalize());sightline.far=d.length()-.1;
 return sightline.intersectObjects(facades,false).length===0;
}
function frameSafe(points){
 return points.every(p=>{const v=p.clone().project(camera);return Math.abs(v.x)<.89&&Math.abs(v.y)<.75&&v.z<1&&v.z>-1;});
}
function filmCamera(dt){
 const c=car.root.position,m=mon.root.position,forward=new THREE.Vector3(Math.sin(sim.car.h),0,Math.cos(sim.car.h)),right=new THREE.Vector3(forward.z,0,-forward.x);
 const cp=c.clone().add(new THREE.Vector3(0,2,0)),mp=m.clone().add(new THREE.Vector3(0,5,0));
 const index=Math.floor(sim.car.s/GRID),prop=stuntAt(index,config.seed),relative=prop.s-sim.car.s;
 const roofShot=!!sim.attack?.roofPath&&sim.attack.flight;
 const desired=roofShot?'roof':prop.kind==='ramp'&&relative<17&&relative>-30?'ramp':sim.monster.slipUntil>sim.time?'monster':sim.monster.s>sim.car.s+4?'bonnet':sim.time<eventShotUntil&&eventShot==='pursuit'?'monster':Math.abs(sim.car.turn)>.2?'corner':'rear';
 const locked=shot==='ramp'&&desired==='ramp'||shot==='roof'&&roofShot;
 const cut=!initialized||(!locked&&desired!==shot&&(sim.time-shotSince>1.3||desired==='roof'||desired==='ramp'));
 if(cut){shot=desired;shotSince=sim.time;shotLog.push({time:sim.time,shot});if(shotLog.length>150)shotLog.shift();shotHistory.push(shot);if(shotHistory.length>4)shotHistory.shift();stats.cameraCuts++;}
 const monsterShot=['roof','monster','bonnet'].includes(shot);
 const focus=monsterShot?mp.clone().add(new THREE.Vector3(0,1,0)):cp.clone();
 const facades=[...buildingObjects.values()].filter(b=>b.g.visible).map(b=>b.facade);
 const presets={rear:[-12,1.8,4.6],ramp:[-5,12,4],corner:[12,5,3],monster:[22,2.7,2.7],bonnet:[0,0,2.4],roof:[4,30,9]};
 const [lead,side,height]=presets[shot];let target=focus.clone().addScaledVector(forward,lead).addScaledVector(right,side);
 target.y=shot==='roof'?focus.y+height:shot==='ramp'?height:shot==='monster'?m.y+height:height;
 if(shot==='bonnet'){target.copy(cp).addScaledVector(forward,2.6);target.y+=.7;}
 let look=focus.clone();if(shot==='rear')look.addScaledVector(forward,3);
 const sight=(p)=>clearLine(focus,p,facades)&&clearLine(p,focus,facades);
 if(!sight(target)){
  for(const [fw,sd,up] of [[lead,-side,height],[12,0,3],[-12,0,4],[0,8,5],[0,-8,5],[0,0,18]]){
   const alt=focus.clone().addScaledVector(forward,fw).addScaledVector(right,sd);alt.y=focus.y+up;
   if(sight(alt)){target=alt;look=focus.clone();break;}
  }
 }
 if(lastOrigin.x!==sim.origin.x||lastOrigin.z!==sim.origin.z){const shift=new THREE.Vector3(sim.origin.x-lastOrigin.x,0,sim.origin.z-lastOrigin.z);lastCamera.sub(shift);lastLook.sub(shift);lastOrigin={...sim.origin};}
 if(initialized&&!cut){const blend=1-Math.exp(-dt*10),p=lastCamera.clone().lerp(target,blend),l=lastLook.clone().lerp(look,blend);
  camera.position.copy(p);camera.lookAt(l);camera.updateMatrixWorld();
  if(p.distanceTo(focus)>4&&frameSafe([focus])&&sight(p)){target=p;look=l;}
 }
 lastCamera.copy(target);lastLook.copy(look);initialized=true;
 camera.position.copy(target);camera.lookAt(look);camera.updateMatrixWorld();
 stats.visibleSamples++;const framed=frameSafe([focus]),clear=sight(target);
 if(framed)stats.subjectVisible++;if(clear)stats.subjectClear++;if(camera.position.y<9)stats.streetFrames++;
 if(frameSafe([cp,mp]))stats.bothVisible++;if(clearLine(cp,target,facades)&&clearLine(mp,target,facades))stats.bothUnoccluded++;
 blockedFrames=clear?0:blockedFrames+1;stats.maxOccludedFrames=Math.max(stats.maxOccludedFrames,blockedFrames);
 document.getElementById('chapter').textContent=shot==='corner'?'CHANGE OF PLAN':shot==='roof'?'ROOF RUN':shot==='ramp'?'AIR TIME':shot==='bonnet'?'INTERCEPTION':shot==='rear'?'FULL THROTTLE':'THE PURSUIT';
 if(sim.time-captionAt>4)caption=sim.car.boosting?'KEEP. MOVING.':'NO SAFE WAY OUT.';
 document.getElementById('caption').textContent=caption;
 document.getElementById('distance').textContent=Math.floor(sim.metrics.distance)+' M';
 document.getElementById('gap').textContent=(sim.monster.s>sim.car.s?'THREAT AHEAD / ':'PURSUER / ')+Math.round(distance(sim.car,sim.monster))+' M';
 document.getElementById('progress').style.transform='scaleX('+Math.min(1,sim.time/config.duration)+')';
 sun.position.set(c.x-25,65,c.z+25);sun.target.position.copy(c);
}
function render(dt,draw=true){
 syncCity();events();actors(dt);scene.updateMatrixWorld(true);filmCamera(dt);
 if(draw)renderer.render(scene,camera);
 stats.frames++;stats.maxGeometries=Math.max(stats.maxGeometries,renderer.info.memory.geometries);
}
function advance(frames=1,drawEvery=1){
 if(!Number.isInteger(frames)||frames<1||frames>1800)throw Error('Invalid frame count.');
 for(let i=0;i<frames;i++){sim.step();sim.step();render(1/30,(i+1)%drawEvery===0);}
 return {time:sim.time,speed:sim.car.speed,health:sim.car.health,finished:sim.finished,gap:distance(sim.car,sim.monster),chunks:sim.chunks.size,geometries:renderer.info.memory.geometries};
}
window.chase={ready:true,config,advance,report:()=>({config,snapshot:sim.snapshot(),events:sim.events,shots:shotLog,history:{...sim.history(),shots:shotHistory},stats:{...stats,bothVisibleRatio:stats.bothVisible/Math.max(1,stats.visibleSamples),bothUnoccludedRatio:stats.bothUnoccluded/Math.max(1,stats.visibleSamples)}})};
render(0);
let running=false,paused=false,muted=false,last=null,acc=0,saved=false;
document.getElementById('start').addEventListener('click',async()=>{document.getElementById('welcome').hidden=true;document.getElementById('controls').style.display='flex';await audio.start();running=true;});
document.getElementById('pause').addEventListener('click',()=>{paused=!paused;document.getElementById('pause').textContent=paused?'Resume':'Pause';if(audio.ctx)paused?audio.ctx.suspend():audio.ctx.resume();});
document.getElementById('mute').addEventListener('click',()=>{muted=!muted;audio.mute(muted);document.getElementById('mute').textContent=muted?'Sound off':'Sound on';});
function loop(now){
 if(last===null)last=now;const dt=Math.min(.1,(now-last)/1000);last=now;
 if(running&&!paused&&!document.hidden){acc+=dt;let steps=0;while(acc>=FIXED_DT&&steps<6){sim.step();acc-=FIXED_DT;steps++;}render(steps*FIXED_DT);
  if(sim.finished&&!saved){saved=true;try{localStorage.setItem('monster-director-history',JSON.stringify(window.chase.report().history));}catch{}}
 }else acc=0;
 requestAnimationFrame(loop);
}
if(!capture)requestAnimationFrame(loop);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);render(0);});
