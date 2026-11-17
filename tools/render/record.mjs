import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {startServer,root} from './server.mjs';
import {randomBytes} from 'node:crypto';
import {options} from '../../chase/core.mjs';
import {renderAudio} from '../../chase/audio.mjs';

const suppliedSeed=process.env.CHASE_SEED;
const config=options({seed:(!suppliedSeed||suppliedSeed==='auto')?randomBytes(4).readUInt32LE():Number(suppliedSeed),duration:process.env.CHASE_DURATION||45,
  intensity:process.env.CHASE_INTENSITY||'savage',ending:process.env.CHASE_ENDING||'auto'});
const smoke=process.argv.includes('--smoke');
const format=process.env.CHASE_FORMAT||'portrait';
if(!['portrait','landscape'].includes(format))throw Error('Invalid format.');
const width=format==='portrait'?720:1280,height=format==='portrait'?1280:720;
const output=resolve(root,'artifacts'),framesDir=resolve(output,'frames');
await mkdir(framesDir,{recursive:true});
const server=await startServer();
let browser;
const errors=[],telemetry=[];
function exec(command,args){
  const result=spawnSync(command,args,{stdio:'pipe',encoding:'utf8',maxBuffer:12*1024*1024});
  if(result.status!==0)throw Error(command+' failed: '+result.stderr);
  return result.stdout;
}
try{
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.route('**/*',route=>{
    if(new URL(route.request().url()).hostname==='127.0.0.1')return route.continue();
    return route.abort();
  });
  let history={};try{history=JSON.parse(await readFile(resolve(root,'.director-history/history.json'),'utf8'));}catch{}
  const query=new URLSearchParams({...config,capture:'1',history:JSON.stringify(history)});
  await page.goto(server.url+'/chase/?'+query,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.chase?.ready,{},{timeout:30000});
  const frames=Math.round(config.duration*30),thumbs=[];
  let actualFrames=0;
  if(smoke){
    const samples=[];
    for(let i=0;i<frames;i+=30){
      const count=Math.min(30,frames-i);
      const state=await page.evaluate(n=>window.chase.advance(n,n),count);
      samples.push(state);
      if(state.finished)break;
      if(i<=frames/2 && i+count>frames/2)await page.screenshot({path:resolve(output,'smoke.jpg'),type:'jpeg',quality:85});
    }
    const report=await page.evaluate(()=>window.chase.report());
    await writeFile(resolve(output,'smoke-report.json'),JSON.stringify({...report,samples,errors},null,2));
    console.log('SMOKE_REPORT '+JSON.stringify({metrics:report.snapshot.metrics,stats:report.stats,errors}));
    const first=samples.slice(5,15).map(s=>s.geometries),last=samples.slice(-10).map(s=>s.geometries);
    assert.ok(Math.max(...last)<=Math.max(...first)+12,'Geometry count grows after chunks are recycled.');
    assert.ok(report.stats.bothVisibleRatio>.85,'Actors leave the camera too frequently.');
    assert.ok(report.stats.bothUnoccludedRatio>.98,'Buildings obscure the chase too frequently.');
    assert.ok(report.stats.maxOccludedFrames<=12,'A building hides an actor for over 0.4 seconds.');
    assert.equal(errors.length,0,errors.join('\n'));
    await writeFile(resolve(output,'smoke-report.json'),JSON.stringify({...report,samples,errors},null,2));
    console.log('SMOKE_REPORT '+JSON.stringify({metrics:report.snapshot.metrics,stats:report.stats,errors}));
  }else{
    const begin=Date.now();
    for(let i=0;i<frames;i++){
      const state=i===0?await page.evaluate(()=>{const r=window.chase.report();return {time:0,speed:r.snapshot.car.speed,health:100};}):await page.evaluate(()=>window.chase.advance());
      telemetry.push(state);actualFrames++;
      const file=resolve(framesDir,String(i).padStart(5,'0')+'.jpg');
      await page.screenshot({path:file,type:'jpeg',quality:92});
      if(i%300===0)console.log('RENDER_PROGRESS '+JSON.stringify({frame:i,total:frames,elapsed:Math.round((Date.now()-begin)/1000)}));
      if([Math.round(frames*.08),Math.round(frames*.30),Math.round(frames*.52),Math.round(frames*.72),Math.round(frames*.90)].includes(i)){
        const name='shot-'+thumbs.length+'.jpg';await writeFile(resolve(output,name),await readFile(file));thumbs.push(name);
      }
      if(state.finished)break;
    }
    const report=await page.evaluate(()=>window.chase.report());
    assert.equal(errors.length,0,errors.join('\n'));
    assert.ok(report.stats.bothVisibleRatio>.85,'Actors leave the camera too frequently.');
    assert.ok(report.stats.bothUnoccludedRatio>.98,'Buildings obscure the chase too frequently.');
    assert.ok(report.stats.maxOccludedFrames<=12,'A building hides an actor for over 0.4 seconds.');
    assert.ok(telemetry.every(f=>f.health>0),'The car did not survive the directed take.');
    assert.ok(new Set(report.events.filter(e=>e.type==='attack').map(e=>e.attack)).size>=3);
    assert.ok(report.snapshot.metrics.turns>=3);
    const duration=actualFrames/30;
    assert.ok(duration>=30 && duration<=config.duration+.04);
    const samples=renderAudio(duration,report.events,telemetry),rate=48000;
    const wav=Buffer.alloc(44+samples.length*2);
    wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
    wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
    wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);
    for(let i=0;i<samples.length;i++)wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);
    await writeFile(resolve(output,'soundtrack.wav'),wav);
    exec('ffmpeg',['-y','-framerate','30','-i',resolve(framesDir,'%05d.jpg'),'-i',resolve(output,'soundtrack.wav'),
      '-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k',
      '-t',String(duration),'-movflags','+faststart',resolve(output,'monster-chase.mp4')]);
    const probe=JSON.parse(exec('ffprobe',['-v','error','-show_streams','-show_format','-of','json',resolve(output,'monster-chase.mp4')]));
    const video=probe.streams.find(s=>s.codec_type==='video'),audio=probe.streams.find(s=>s.codec_type==='audio');
    assert.equal(video.width,width);assert.equal(video.height,height);assert.equal(video.avg_frame_rate,'30/1');assert.ok(audio);
    assert.ok(Math.abs(Number(probe.format.duration)-duration)<.12);
    exec('ffmpeg',['-y','-i',resolve(output,'monster-chase.mp4'),'-vf','fps=5/'+duration+',scale=180:-1,tile=5x1','-frames:v','1',resolve(output,'contact-sheet.jpg')]);
    await mkdir(resolve(root,'.director-history'),{recursive:true});
    await writeFile(resolve(root,'.director-history/history.json'),JSON.stringify(report.history));
    const result={...report,actualDuration:duration,telemetry,probe,errors,renderSeconds:(Date.now()-begin)/1000};
    await writeFile(resolve(output,'report.json'),JSON.stringify(result,null,2));
    console.log('CHASE_REPORT '+JSON.stringify({config,metrics:report.snapshot.metrics,ending:report.snapshot.finishReason,stats:report.stats,renderSeconds:result.renderSeconds,video:{width,height,duration:probe.format.duration,fps:video.avg_frame_rate},audio:audio.codec_name,errors}));
    console.log('CONTACT_SHEET_BASE64 '+(await readFile(resolve(output,'contact-sheet.jpg'))).toString('base64'));
  }
}finally{
  if(browser)await browser.close();await server.close();
}
