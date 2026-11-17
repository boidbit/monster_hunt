import {random, clamp} from './core.mjs';
export function sound(event, rate = 48000) {
  const profiles = {
    start:[.9,110,42,.38], attack:[.75,100,45,.42], impact:[.65,85,28,.48],
    collapse:[1.2,65,25,.42], hit:[.4,280,70,.28], traffic:[.5,160,40,.3],
    horn:[.32,330,310,.16], turn:[.45,650,180,.12], reveal:[.8,70,30,.4], nearMiss:[.3,500,100,.16],
    dodge:[.25,420,120,.12], foot:[.15,70,32,.19]
  };
  const p = profiles[event.type];
  if (!p) return new Float32Array(0);
  const [duration, from, to, gain] = p, data = new Float32Array(Math.ceil(duration * rate));
  const rng = random(Math.round(event.time * 1000) + event.type.length * 71);
  let phase = 0, noise = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length, env = Math.min(1, t * 35) * Math.pow(1-t, 1.6);
    phase += (from + (to-from)*t) / rate * Math.PI * 2;
    noise = noise * .72 + (rng()*2-1)*.28;
    const body = Math.sin(phase) * .65 + Math.sin(phase*1.99)*.15 + noise * 1.6;
    data[i] = body * gain * env;
  }
  return data;
}
export class LiveAudio {
  async start() {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC(); await this.ctx.resume();
    this.bus = this.ctx.createGain(); this.bus.gain.value = .65; this.bus.connect(this.ctx.destination);
    this.engine = this.ctx.createOscillator(); this.engine.type = 'triangle';
    this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = .035;
    this.engine.connect(this.engineGain); this.engineGain.connect(this.bus); this.engine.start();
  }
  update(speed) { if(this.ctx) this.engine.frequency.setTargetAtTime(45+speed*2, this.ctx.currentTime, .1); }
  play(event) {
    if (!this.ctx) return;
    const samples = sound(event, this.ctx.sampleRate); if (!samples.length) return;
    const b = this.ctx.createBuffer(1, samples.length, this.ctx.sampleRate);
    b.copyToChannel(samples, 0);
    const node = this.ctx.createBufferSource(); node.buffer = b; node.connect(this.bus); node.start();
  }
  mute(value) { if(this.bus) this.bus.gain.value = value ? 0 : .65; }
}
export function renderAudio(duration, events, frames, rate = 48000) {
  const out = new Float32Array(Math.ceil(duration * rate));
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const time = i / rate, frame = frames[Math.min(frames.length-1, Math.floor(time*30))];
    const speed = frame?.speed ?? 21;
    phase += (45 + speed*2) / rate * Math.PI*2;
    out[i] = Math.sin(phase)*.035 + Math.sin(phase*2)*.012;
  }
  for (const event of events) {
    const samples = sound(event,rate), offset = Math.round(event.time*rate);
    for(let j=0; j<samples.length && j+offset<out.length; j++) if(j+offset>=0) out[j+offset]+=samples[j];
  }
  for (let i=0; i<out.length; i++) {
    const t=i/rate, fade=Math.min(1,t*8,(duration-t)*5);
    out[i]=Math.tanh(out[i]*1.4)*clamp(fade,0,1);
  }
  return out;
}
