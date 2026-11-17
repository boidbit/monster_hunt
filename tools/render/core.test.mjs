import test from 'node:test';
import assert from 'node:assert/strict';
import {Chase,options,blockDescription,distance} from '../../chase/core.mjs';
import {renderAudio} from '../../chase/audio.mjs';
const run=(seed,duration=45,intensity='savage',history={})=>{
 const c=new Chase({seed,duration,intensity,history});
 while(!c.finished){c.step();c.drain();}return c;
};
test('invalid input is rejected',()=>{
 for(const duration of [NaN,0,29,61,Infinity])assert.throws(()=>options({duration}));
 for(const seed of [-1,1.5,Infinity])assert.throws(()=>options({seed}));
 assert.throws(()=>options({ending:'bad'}));
});
test('seeded city and episode replay are deterministic',()=>{
 assert.deepEqual(blockDescription(-2,3,42),blockDescription(-2,3,42));
 const a=run(42),b=run(42);assert.deepEqual(a.snapshot(),b.snapshot());assert.deepEqual(a.events,b.events);
});
test('episodes choose different routes, attack orders and natural lengths',()=>{
 const signatures=new Set(),durations=new Set(),attacks=new Set();
 for(const seed of [1,7,42,99,120,1000])for(const intensity of ['savage','intense']){
  const c=run(seed,60,intensity);
  assert.ok(c.time>=30&&c.time<=60.02);assert.ok(c.metrics.turns>=3,'Needs actual street turns');
  assert.ok(c.metrics.trafficDistance>3000,'Traffic must move');
  assert.ok(c.metrics.attacks>=3,'Needs multiple threat opportunities');
  const seq=c.events.filter(e=>e.type==='attack');seq.forEach(e=>attacks.add(e.attack));signatures.add(seq.map(e=>e.attack).join(','));
  durations.add(Math.floor(c.time));assert.ok(c.chunks.size<=25);assert.ok(c.car.health>0);
 }
 assert.ok(signatures.size>=8);assert.ok(durations.size>=3);assert.equal(attacks.size,6);
});
test('interceptions move continuously and reach ahead of the car',()=>{
 const c=new Chase({seed:42});c.startAttack('intercept');let ahead=false,highest=0,previous={...c.monster};
 for(let i=0;i<200;i++){c.step();c.drain();assert.ok(distance(c.monster,previous)<3,'Monster teleported');
  highest=Math.max(highest,c.monster.y);ahead ||= c.monster.s>c.car.s+10;previous={...c.monster};}
 assert.ok(ahead);assert.ok(highest>30);
});
test('history changes subsequent choices and remains bounded',()=>{
 const a=run(42),b=run(42,45,'savage',a.history());
 assert.notDeepEqual(a.events.filter(e=>e.type==='attack'),b.events.filter(e=>e.type==='attack'));
 assert.ok(b.history().attacks.length<=4);assert.ok(b.history().turns.length<=4);
});
test('ten minutes of streaming keeps routes, city and traffic bounded',()=>{
 const c=new Chase({seed:99});for(let i=0;i<36000;i++){c.step();c.drain();}
 assert.equal(c.chunks.size,25);assert.equal(c.traffic.length,30);
 assert.ok(c.route.length<=11);assert.ok(c.events.length<=2000);assert.ok(c.visits.size<=100);assert.ok(c.metrics.rebases>0);
});
test('event audio is finite and audible',()=>{
 const c=run(42),a=renderAudio(c.time,c.events,[{speed:23}],8000);let energy=0,peak=0;
 for(const v of a){assert.ok(Number.isFinite(v));energy+=v*v;peak=Math.max(peak,Math.abs(v));}
 assert.ok(Math.sqrt(energy/a.length)>.01);assert.ok(peak<1);
});
