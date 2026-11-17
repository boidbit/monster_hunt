import test from 'node:test';
import assert from 'node:assert/strict';
import {Chase, options, chunkDescription, worldPoint, road, FIXED_DT} from '../../chase/core.mjs';
import {renderAudio} from '../../chase/audio.mjs';

test('configuration rejects invalid render inputs',()=>{
  for(const duration of [NaN,0,29,61,Infinity])assert.throws(()=>options({duration}));
  for(const seed of [-1,1.1,NaN,4294967296])assert.throws(()=>options({seed}));
  assert.throws(()=>options({intensity:'whatever'}));assert.throws(()=>options({ending:'whatever'}));
});
test('seeded cities are stable with independent chunk generation',()=>{
  assert.deepEqual(chunkDescription(12,42),chunkDescription(12,42));
  assert.notDeepEqual(chunkDescription(12,42),chunkDescription(12,43));
  const a=worldPoint(80,0), b=road(80);assert.equal(a.x,b.x);assert.equal(a.z,80);
});
test('director repeats inputs and attacks for the same seed',()=>{
  const a=new Chase({seed:314}),b=new Chase({seed:314});
  for(let i=0;i<2699;i++){a.step();b.step();}
  assert.deepEqual(a.snapshot(),b.snapshot());assert.deepEqual(a.events,b.events);
});
test('30, 45 and 60 second recordings deliver all four attack types',()=>{
  for(const duration of [30,45,60])for(const intensity of ['intense','savage'])for(const seed of [0,7,42,314]){
    const game=new Chase({duration,intensity,seed});let minHealth=100;
    for(let i=0;i<duration*60-1;i++){game.step();minHealth=Math.min(minHealth,game.car.health);}
    const attacks=new Set(game.events.filter(e=>e.type==='attack').map(e=>e.attack));
    assert.equal(attacks.size,4,JSON.stringify({duration,intensity,seed,attacks:[...attacks]}));
    assert.ok(minHealth>0,'The directed truck must survive the take.');
    assert.ok(game.metrics.minGap<10);assert.ok(game.metrics.maxGap<50);assert.ok(game.metrics.dodges>=1);
    assert.equal(game.chunks.size,8);
  }
});
test('endless streaming bounds memory and preserves continuity across rebases',()=>{
  const game=new Chase({seed:42});let priorS=game.car.s, priorOrigin=0, rebases=0;
  for(let i=0;i<600*60;i++){
    game.step();game.drain();assert.equal(game.chunks.size,8);
    assert.ok(game.car.s>=priorS);assert.ok(game.car.s-priorS<=30*FIXED_DT+.0001);priorS=game.car.s;
    if(priorOrigin!==game.origin){rebases++;priorOrigin=game.origin;}
    assert.ok(game.events.length<=1500);assert.ok(Number.isFinite(game.monster.s));
  }
  assert.ok(rebases>20);assert.equal(game.metrics.peakChunks,8);
});
test('audio has audible, finite samples and a bounded peak',()=>{
  const samples=renderAudio(2,[{type:'start',time:0},{type:'impact',time:1}],Array.from({length:60},()=>({speed:21})));
  let peak=0,power=0;for(const s of samples){assert.ok(Number.isFinite(s));peak=Math.max(peak,Math.abs(s));power+=s*s;}
  assert.ok(peak<1);assert.ok(Math.sqrt(power/samples.length)>.01);
});
