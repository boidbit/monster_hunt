export const FIXED_DT=1/60, GRID=90;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function random(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const lerp=(a,b,t)=>a+(b-a)*t;
export function options(v={}){
 const duration=Number(v.duration??45),seed=Number(v.seed??42);
 if(!Number.isFinite(duration)||duration<30||duration>60)throw Error('Duration must be 30–60 seconds.');
 if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error('Seed must be a uint32.');
 const intensity=v.intensity??'savage',ending=v.ending??'auto';
 if(!['intense','savage'].includes(intensity)||!['auto','escape','cliffhanger'].includes(ending))throw Error('Invalid director options.');
 return {duration,seed,intensity,ending};
}
export function blockDescription(x,z,seed){
 const rng=random((seed^Math.imul(x+7919,73856093)^Math.imul(z+104729,19349663))>>>0);
 const buildings=[];
 for(const dx of [24,66])for(const dz of [24,66]){
  buildings.push({id:x+':'+z+':'+dx+':'+dz,x:x*GRID+dx,z:z*GRID+dz,width:22+rng()*5,depth:22+rng()*5,height:10+rng()*20,color:Math.floor(rng()*6)});
 }
 return {id:x+':'+z,x,z,buildings};
}
export function streetWidth(x,z){return (Math.abs(x+z)%3===0)?6.5:10;}
const angle=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);
const unit=a=>({x:Math.sin(a),z:Math.cos(a)});
export function stuntAt(index,seed){
 const deck=['ramp','pothole','barrier','market'],rng=random(seed^Math.imul(Math.floor(index/4)+31,2654435761));
 for(let i=3;i>0;i--){const j=Math.floor(rng()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
 return {index,kind:deck[(index%4+4)%4],s:index*GRID+47,lane:0};
}
export class Chase{
 constructor(input={}){
  this.config=options(input);this.rng=random(this.config.seed);
  const memory=JSON.stringify([input.history?.attacks??[],input.history?.turns??[]]);
  const salt=Array.from(memory).reduce((hash,ch)=>Math.imul(hash^ch.charCodeAt(0),16777619)>>>0,2166136261);
  this.tactics=random(this.config.seed^salt^(this.config.intensity==='savage'?0x8af32715:0x31c040ab));this.time=0;this.tick=0;this.events=[];this.pending=[];
  this.route=[{x:0,z:-GRID},{x:0,z:0},{x:0,z:GRID}];this.routeBase=-1;this.visits=new Map();
  this.recentAttacks=[...(input.history?.attacks||[])].slice(-4);this.recentTurns=[...(input.history?.turns||[])].slice(-4);
  this.chunks=new Map();this.traffic=[];this.origin={x:0,z:0};this.nextTrafficId=0;
  this.car={s:22,lane:2.6,speed:20,lateralSpeed:0,health:100,nitro:100,roll:0,boosting:false};
  this.monster={s:8,lane:-1,speed:24,y:0,roll:0};this.attack=null;this.nextAttack=1+this.rng()*1.5;
  this.lastTurn=-100;this.lastImpact=-100;this.hitCooldown=0;this.nextHorn=0;this.finished=false;this.finishReason=null;
  this.stuntPasses=0;this.roofContacts=0;this.melons=null;this.broken=new Set();this.metrics={attacks:0,dodges:0,collisions:0,turns:0,interceptions:0,nearMisses:0,trafficSpawned:0,trafficDistance:0,chunksGenerated:0,peakChunks:0,distance:0,rebases:0};
  this.extendRoute();this.updatePositions();this.syncCity();this.emit('start',{text:'NO SAFE WAY OUT.'});
 }
 emit(type,data={}){
  const e={time:Number(this.time.toFixed(4)),type,...data};this.events.push(e);this.pending.push(e);
  if(this.events.length>2000)this.events.splice(0,500);
 }
 point(s,lane=0){
  const i=Math.floor(s/GRID),local=s-i*GRID;
  const get=n=>this.route[clamp(n-this.routeBase,0,this.route.length-1)];
  const a=get(i),b=get(i+1);let p,h=angle(a,b),turn=0;
  const corner=(n,t)=>{const prev=get(n-1),mid=get(n),next=get(n+1),u=unit(angle(prev,mid)),v=unit(angle(mid,next)),r=14;
   const A={x:mid.x-u.x*r,z:mid.z-u.z*r},B={x:mid.x+v.x*r,z:mid.z+v.z*r};
   const dx=2*(1-t)*(mid.x-A.x)+2*t*(B.x-mid.x),dz=2*(1-t)*(mid.z-A.z)+2*t*(B.z-mid.z);
   return {x:(1-t)**2*A.x+2*(1-t)*t*mid.x+t*t*B.x,z:(1-t)**2*A.z+2*(1-t)*t*mid.z+t*t*B.z,h:Math.atan2(dx,dz),turn:u.x*v.z-u.z*v.x};
  };
  if(local<14&&i>this.routeBase){p=corner(i,(local+14)/28);h=p.h;turn=p.turn;}
  else if(local>GRID-14){p=corner(i+1,(local-GRID+14)/28);h=p.h;turn=p.turn;}
  else p={x:lerp(a.x,b.x,local/GRID),z:lerp(a.z,b.z,local/GRID)};
  return {x:p.x+Math.cos(h)*lane,z:p.z-Math.sin(h)*lane,h,turn};
 }
 extendRoute(){
  while((this.routeBase+this.route.length-1)*GRID<this.car.s+GRID*3){
   const a=this.route.at(-2),b=this.route.at(-1),dx=(b.x-a.x)/GRID,dz=(b.z-a.z)/GRID;
   const choices=[{x:dx,z:dz,name:'straight'},{x:dz,z:-dx,name:'right'},{x:-dz,z:dx,name:'left'}];
   let best=null,score=Infinity;
   for(const d of choices){
    const n={x:b.x+d.x*GRID,z:b.z+d.z*GRID},key=n.x+':'+n.z;
    const density=this.traffic.filter(t=>distance(t,n)<45).length;
    const threat=this.monster.x===undefined?0:Math.max(0,45-distance(this.monster,n))*.12;
    const repeated=this.recentTurns.slice(-2).filter(t=>t===d.name).length;
    const cost=this.rng()*3+density*.5+threat+(this.visits.get(key)||0)*2+repeated*1.1+(d.name==='straight'?.6:0);
    if(cost<score){score=cost;best={...n,choice:d.name};}
   }
   this.route.push(best);this.visits.set(best.x+':'+best.z,(this.visits.get(best.x+':'+best.z)||0)+1);
   if(this.visits.size>100)this.visits.delete(this.visits.keys().next().value);
   this.recentTurns.push(best.choice);if(this.recentTurns.length>5)this.recentTurns.shift();
   this.emit('route',{at:(this.routeBase+this.route.length-1)*GRID,choice:best.choice,x:best.x,z:best.z});
  }
  while(this.route.length>10&&this.routeBase*GRID<this.car.s-4*GRID){this.route.shift();this.routeBase++;}
 }
 updatePositions(){
  Object.assign(this.car,this.point(this.car.s,this.car.lane));
  if(!this.attack?.flight)Object.assign(this.monster,this.point(this.monster.s,this.monster.lane));
 }
 syncCity(){
  const bx=Math.floor(this.car.x/GRID),bz=Math.floor(this.car.z/GRID),wanted=new Set();
  for(let x=bx-2;x<=bx+2;x++)for(let z=bz-2;z<=bz+2;z++){
   const id=x+':'+z;wanted.add(id);
   if(!this.chunks.has(id)){this.chunks.set(id,blockDescription(x,z,this.config.seed));this.metrics.chunksGenerated++;}
  }
  for(const id of this.chunks.keys())if(!wanted.has(id))this.chunks.delete(id);
  const ox=Math.floor(this.car.x/360)*360,oz=Math.floor(this.car.z/360)*360;
  if(ox!==this.origin.x||oz!==this.origin.z){this.origin={x:ox,z:oz};this.metrics.rebases++;}
  this.metrics.peakChunks=Math.max(this.metrics.peakChunks,this.chunks.size);
  this.traffic=this.traffic.filter(t=>distance(t,this.car)<235);
  while(this.traffic.length<30){
   const h=Math.floor(this.rng()*4)*Math.PI/2,dir=unit(h),a=Math.round((this.car.x+(this.rng()-.5)*350)/GRID)*GRID,b=Math.round((this.car.z+(this.rng()-.5)*350)/GRID)*GRID;
   const offset=this.rng()*GRID,side=3.5;
   const t={id:this.nextTrafficId++,x:a+dir.x*offset+Math.cos(h)*side,z:b+dir.z*offset-Math.sin(h)*side,h,speed:10+this.rng()*7,cruise:10+this.rng()*7,color:Math.floor(this.rng()*5),kind:this.rng()<.18?'bus':'car',hit:false,near:false};
   if(distance(t,this.car)<24)continue;
   this.traffic.push(t);this.metrics.trafficSpawned++;
  }
 }
 damage(source){
  if(this.hitCooldown>0)return;
  this.hitCooldown=1.2;this.car.health=Math.max(10,this.car.health-8);this.car.speed*=.8;this.metrics.collisions++;this.emit('hit',{source,health:this.car.health});
 }
 startAttack(type){
  const m=this.monster,c=this.car;
  this.attack={type,start:this.time,duration:type==='intercept'?4.2:type==='flank'?3.4:2.5,targetLane:c.lane,impact:false,from:{x:m.x,z:m.z},fromS:m.s};
  if(type==='intercept'||type==='flank'){
   const targetS=c.s+(type==='intercept'?Math.max(86,c.speed*2.6+27):45),target=this.point(targetS,type==='flank'?-5:0);
   Object.assign(this.attack,{flight:true,targetS,target,travel:type==='intercept'?2.6:2.1});
   if(type==='flank'){
    const roofs=[...this.chunks.values()].flatMap(block=>block.buildings);
    const first=roofs.slice().sort((left,right)=>distance(left,m)-distance(right,m))[0];
    const ahead=this.point(c.s+110,0);
    const second=roofs.filter(b=>b.id!==first.id&&distance(b,first)<105).sort((left,right)=>distance(left,ahead)-distance(right,ahead))[0];
    if(second){
     const landS=c.s+c.speed*4.8+10,land=this.point(landS,-5);
     Object.assign(this.attack,{roofPath:[{x:m.x,z:m.z,y:0},{...first,y:first.height+.42},{...second,y:second.height+.42},{...land,y:0}],targetS:landS,target:land,travel:4.8,duration:5.9,stage:-1});
    }
   }
   this.metrics.interceptions++;
  }
  this.metrics.attacks++;this.recentAttacks.push(type);if(this.recentAttacks.length>4)this.recentAttacks.shift();
  this.emit('attack',{attack:type,x:m.x,z:m.z});this.nextAttack=this.time+5+this.rng()*3;
 }
 chooseAttack(){
  const c=this.car,m=this.monster,gap=distance(c,m),turn=Math.abs(this.point(c.s+22).turn)>.2;
  const traffic=this.traffic.filter(t=>distance(t,c)<35).length;
  const weights={swipe:gap<17?3:.2,charge:gap>12?2.5:1,leap:gap<28?2:1,intercept:turn?5:2,flank:traffic>2?3:1.5,smash:traffic>0?2:1};
  let sum=0;
  for(const k of Object.keys(weights)){weights[k]*=Math.pow(.18,this.recentAttacks.filter(a=>a===k).length);sum+=weights[k];}
  if(this.config.intensity==='savage'){sum+=weights.intercept*.6+weights.charge*.4;weights.intercept*=1.6;weights.charge*=1.4;}
  let choice=this.tactics()*sum;
  for(const [k,w]of Object.entries(weights)){choice-=w;if(choice<=0)return k;}
  return 'charge';
 }
 step(){
  const dt=FIXED_DT;this.tick++;this.time=this.tick*dt;this.hitCooldown-=dt;
  this.extendRoute();const c=this.car,m=this.monster,prevS=c.s,gap=distance(c,m);
  if(!this.attack&&this.time>=this.nextAttack&&gap<85)this.startAttack(this.chooseAttack());
  const forward=unit(c.h),right={x:Math.cos(c.h),z:-Math.sin(c.h)};
  let targetLane=2.5,brake=false,best=Infinity;
  const laneWidth=streetWidth(Math.round(c.x/GRID),Math.round(c.z/GRID))-2.3;
  const candidates=[-laneWidth*.7,0,laneWidth*.7];
  for(const lane of candidates){
   let cost=Math.abs(lane-c.lane)*.3+Math.abs(lane-2.5)*.1;
   for(const t of this.traffic){
    const dx=t.x-c.x,dz=t.z-c.z,ahead=dx*forward.x+dz*forward.z,lateral=dx*right.x+dz*right.z;
    if(ahead>0&&ahead<45&&Math.abs(lateral+c.lane-lane)<3.3)cost+=30/(1+ahead*.1);
   }
   if(this.attack&&Math.abs(lane-this.attack.targetLane)<3)cost+=this.attack.flight?5:12;
   if(m.s>c.s&&gap<40&&Math.abs(lane-m.lane)<4)cost+=35;
   if(cost<best){best=cost;targetLane=lane;}
  }
  for(const t of this.traffic){
   const d=distance(t,c),ahead=(t.x-c.x)*forward.x+(t.z-c.z)*forward.z;
   if(d<14&&ahead>0&&ahead<13&&Math.abs((t.x-c.x)*right.x+(t.z-c.z)*right.z)<3)brake=true;
  }
  const prop=stuntAt(Math.floor(c.s/GRID),this.config.seed),approach=prop.s-c.s;
  if(approach>0&&approach<44){if(prop.kind==='ramp')targetLane=0;
   if(prop.kind==='pothole'||prop.kind==='market')targetLane=(c.lane<0?-1:1)*(prop.kind==='market'?3:5.8);}
  const corner=Math.abs(this.point(c.s+8).turn)>.2;
  c.boosting=!brake&&!corner&&gap<18&&c.nitro>15;
  c.nitro=clamp(c.nitro+(c.boosting?-25:11)*dt,0,100);
  const speed=brake?11:corner?16:c.boosting?29:22;
  c.speed+=clamp(speed-c.speed,-25*dt,14*dt);
  c.lateralSpeed+=clamp((targetLane-c.lane)*4-c.lateralSpeed*3,-15,15)*dt;
  c.lane=clamp(c.lane+c.lateralSpeed*dt,-6.2,6.2);c.roll=-c.lateralSpeed*.024;
  c.s+=c.speed*dt;this.updatePositions();
  const along=c.s-prop.s;
  c.y=0;c.pitch=0;
  if(prop.kind==='ramp'&&Math.abs(c.lane)<3.6){
   if(along>=-8&&along<0){c.y=(along+8)*.32;c.pitch=-.30;}
   if(along>=0&&along<24){const u=along/24;c.y=(1-u)*2.56+15*u*(1-u);c.pitch=(u-.45)*.52;}
  }
  if(prevS<prop.s&&c.s>=prop.s){this.stuntPasses++;this.emit('stunt',{kind:prop.kind,index:prop.index,x:c.x,z:c.z});
   if(prop.kind==='pothole'&&Math.abs(c.lane)<3)this.damage('pothole');
   if(prop.kind==='market')this.melons={...this.point(prop.s),time:this.time,index:prop.index,s:prop.s};
  }
  if(this.melons&&!this.melons.slipped&&Math.abs(m.s-this.melons.s)<5&&m.y<1&&this.time-this.melons.time<4){this.melons.slipped=true;m.slipUntil=this.time+.85;this.emit('slip');}
  if(prop.kind==='barrier'&&Math.abs(m.s-prop.s)<2&&m.y<2&&!this.broken.has(prop.index)){this.broken.add(prop.index);if(this.broken.size>12)this.broken.delete(this.broken.values().next().value);this.emit('snap');}
  if(Math.floor(c.s/GRID)!==Math.floor(prevS/GRID)){
   const n=this.route[Math.floor(c.s/GRID)+1-this.routeBase];
   if(n?.choice&&n.choice!=='straight'){this.metrics.turns++;this.lastTurn=this.time;this.emit('turn',{direction:n.choice,x:c.x,z:c.z});}
  }
  for(const t of this.traffic){
   const dir=unit(t.h),danger=distance(t,m)<25;
   let blocked=false;
   for(const o of this.traffic)if(o!==t){
    const dx=o.x-t.x,dz=o.z-t.z,a=dx*dir.x+dz*dir.z,l=dx*dir.z-dz*dir.x;
    if(a>0&&a<12&&Math.abs(l)<2.8){blocked=true;break;}
   }
   t.speed+=clamp((t.hit?0:blocked?0:danger?t.cruise*1.25:t.cruise)-t.speed,-18*dt,7*dt);
   t.x+=dir.x*t.speed*dt;t.z+=dir.z*t.speed*dt;this.metrics.trafficDistance+=t.speed*dt;
   const d=distance(t,c);
   if(d<3.1&&(c.y||0)<2&&!t.hit){t.hit=true;this.damage('traffic');this.emit('traffic',{x:t.x,z:t.z});}
   else if(d<6&&!t.near){t.near=true;this.metrics.nearMisses++;this.emit('nearMiss',{x:t.x,z:t.z});}
   if(danger&&this.time>this.nextHorn){this.nextHorn=this.time+1.4;this.emit('horn',{x:t.x,z:t.z});}
  }
  m.y=0;m.roll=0;let desiredGap=11,desiredLane=c.lane*.6;
  if(this.attack){
   const a=this.attack,age=this.time-a.start;
   if(a.flight){
    const u=clamp(age/a.travel,0,1),smooth=u*u*(3-2*u);
    m.x=lerp(a.from.x,a.target.x,smooth);m.z=lerp(a.from.z,a.target.z,smooth);
    m.h=angle(a.from,a.target);m.y=Math.sin(Math.PI*u)*(a.type==='intercept'?44:34);
    if(a.roofPath){
     const stage=age<1.2?0:age<1.55?1:age<3.05?2:age<3.50?3:4;
     const start=[0,1.2,1.55,3.05,3.50][stage],span=[1.2,.35,1.5,.45,1.30][stage];
     const k=clamp((age-start)/span,0,1),from=a.roofPath[[0,1,1,2,2][stage]],to=a.roofPath[[1,1,2,2,3][stage]];
     m.x=lerp(from.x,to.x,k);m.z=lerp(from.z,to.z,k);m.y=lerp(from.y,to.y,k)+Math.sin(k*Math.PI)*[13,0,17,0,13][stage];
     if(from!==to)m.h=angle(from,to);
     if(stage!==a.stage&&(stage===1||stage===3)){this.roofContacts++;this.emit('roofLand',{id:to.id,x:m.x,z:m.z,y:m.y});}a.stage=stage;
    }
    if(u===1){m.s=a.targetS;m.speed=2;m.lane=a.type==='flank'?-5:0;a.flight=false;this.emit('reveal',{attack:a.type,x:m.x,z:m.z});}
   }else{
    desiredGap=a.type==='charge'?4:a.type==='swipe'?6:12;
    desiredLane=a.type==='smash'?(c.lane<0?-7:7):a.targetLane;
    if(a.type==='leap')m.y=Math.sin(clamp(age/1.9,0,1)*Math.PI)*12;
   }
   const impactAt=a.type==='intercept'?a.travel:a.type==='flank'?a.travel:1.35;
   if(age>=impactAt&&!a.impact){
    a.impact=true;this.lastImpact=this.time;
    this.emit('impact',{attack:a.type,x:m.x,z:m.z});
    if(a.type==='smash'){
     const all=[...this.chunks.values()].flatMap(b=>b.buildings).sort((a,b)=>distance(a,m)-distance(b,m));
     if(all[0])this.emit('collapse',{...all[0]});
    }
    if(distance(c,m)<7&&Math.abs(c.lane-m.lane)<3)this.damage(a.type);
    else {this.metrics.dodges++;this.emit('dodge',{attack:a.type});}
   }
   if(age>=a.duration){this.emit('attackEnd',{attack:a.type});this.attack=null;}
  }
  if(!this.attack?.flight){
   const holding=this.attack?.type==='intercept'&&this.attack.impact&&m.s>c.s+3;
   const target=holding?0:clamp(c.speed+(c.s-m.s-desiredGap)*1.6,-10,this.config.intensity==='savage'?42:35);
   m.speed+=clamp(target-m.speed,-25*dt,20*dt);m.s+=m.speed*dt;
   m.lane+=clamp(desiredLane-m.lane,-10*dt,10*dt);
   const p=this.point(m.s,m.lane);Object.assign(m,p);
   if(m.s>c.s+4)m.h+=Math.PI;
  }
  if(Math.floor(m.s/10)!==this.foot&&m.y<1){this.foot=Math.floor(m.s/10);this.emit('foot');}
  this.syncCity();this.metrics.distance=c.s-22;
  const nowGap=distance(c,m);
  if(!this.finished&&this.time>=30){
   const escape=nowGap>24&&this.time-this.lastTurn<2.2&&!this.attack;
   const cliffhanger=m.s>c.s+4&&nowGap<36&&this.attack?.impact;
   const closeEscape=this.time-this.lastImpact>1.4&&this.time-this.lastImpact<1.5&&!corner;
   const desired=this.config.ending;
   if((desired!=='cliffhanger'&&(escape||closeEscape))||(desired!=='escape'&&cliffhanger)||this.time>=this.config.duration){
    this.finished=true;this.finishReason=cliffhanger?'intercepted':escape?'escaped':'still-hunted';this.emit('ending',{reason:this.finishReason});
   }
  }
  if(!Number.isFinite(c.x+c.z+m.x+m.z))throw Error('Non-finite chase position.');
 }
 drain(){const e=this.pending;this.pending=[];return e;}
 snapshot(){return {time:this.time,car:{...this.car},monster:{...this.monster},attack:this.attack?{...this.attack}:null,origin:{...this.origin},chunks:[...this.chunks.keys()],metrics:{...this.metrics},finished:this.finished,finishReason:this.finishReason};}
 history(){return {attacks:this.recentAttacks.slice(-4),turns:this.recentTurns.slice(-4)};}
}
