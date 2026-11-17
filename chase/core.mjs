export const FIXED_DT = 1 / 60;
export const CHUNK_LENGTH = 80;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function options(input = {}) {
  const duration = Number(input.duration ?? 45);
  const seed = Number(input.seed ?? 42);
  if (!Number.isFinite(duration) || duration < 30 || duration > 60) throw Error('Duration must be 30–60 seconds.');
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw Error('Seed must be a uint32.');
  const intensity = input.intensity ?? 'savage';
  if (!['intense', 'savage'].includes(intensity)) throw Error('Unknown intensity.');
  const ending = input.ending ?? 'escape';
  if (!['escape', 'cliffhanger'].includes(ending)) throw Error('Unknown ending.');
  return {duration, seed, intensity, ending};
}
export function road(s) {
  return {x: Math.sin(s / 135) * 24 + Math.sin(s / 59) * 9,
    dx: Math.cos(s / 135) * 24 / 135 + Math.cos(s / 59) * 9 / 59};
}
export function worldPoint(s, lane, origin = 0) {
  const r = road(s), norm = Math.sqrt(1 + r.dx * r.dx);
  return {x: r.x + lane / norm, z: s - origin - lane * r.dx / norm};
}
export function chunkDescription(index, seed) {
  const rng = random((seed ^ Math.imul(index + 7919, 2654435761)) >>> 0);
  const start = index * CHUNK_LENGTH;
  const buildings = [];
  for (let row = 0; row < 4; row++) for (const side of [-1, 1]) {
    buildings.push({id: index + ':' + row + ':' + side, s: start + row * 20 + 8,
      lane: side * (17 + rng() * 5), width: 8 + rng() * 5,
      depth: 10 + rng() * 5, height: 9 + rng() * 25, color: Math.floor(rng() * 6)});
    buildings.push({id: index + ':far:' + row + ':' + side, s: start + row * 20 + 13,
      lane: side * (35 + rng() * 10), width: 10 + rng() * 8,
      depth: 14 + rng() * 5, height: 18 + rng() * 35, color: Math.floor(rng() * 6)});
  }
  const traffic = [26, 63].map((offset, i) => ({
    id: index + ':car:' + i, s: start + offset,
    lane: [-5, 0, 5][Math.floor(rng() * 3)], color: Math.floor(rng() * 5), hit: false
  }));
  return {index, start, buildings, traffic};
}
export function activeChunkIndices(s) {
  const middle = Math.floor(s / CHUNK_LENGTH);
  return Array.from({length: 8}, (_, i) => middle - 2 + i);
}
const BEATS = [
  {at: .10, type: 'swipe', text: 'TOO CLOSE.'},
  {at: .27, type: 'charge', text: 'DON’T LOOK BACK.'},
  {at: .47, type: 'leap', text: 'MOVE. NOW.'},
  {at: .68, type: 'smash', text: 'IT MAKES ITS OWN ROADS.'},
  {at: .85, type: 'charge', text: 'ONE LAST CHANCE.'}
];
const LENGTHS = {swipe: 2.2, charge: 3.2, leap: 2.8, smash: 3.0};
export class Chase {
  constructor(input = {}) { this.config = options(input); this.reset(); }
  reset() {
    this.time = 0; this.tick = 0; this.origin = 0; this.cycle = -1;
    this.car = {s: 20, lane: 0, lateralSpeed: 0, speed: 20, health: 100, nitro: 100, boosting: false, roll: 0};
    this.monster = {s: 7, lane: -1, speed: 22, y: 0, roll: 0};
    this.chunks = new Map(); this.events = []; this.pending = [];
    this.attack = null; this.beat = 0; this.hitCooldown = 0; this.foot = Math.floor(this.monster.s / 7);
    this.metrics = {attacks: 0, dodges: 0, collisions: 0, chunksGenerated: 0,
      peakChunks: 0, minGap: Infinity, maxGap: 0, distance: 0, rebases: 0};
    this.syncChunks();
    this.emit('start', {text: 'IT FOUND YOU.'});
  }
  emit(type, data = {}) {
    const event = {time: Number(this.time.toFixed(4)), type, ...data};
    this.events.push(event); this.pending.push(event);
    // Unlimited preview keeps a bounded recent history. A 60s export retains all events.
    if (this.events.length > 1500) this.events.splice(0, 500);
  }
  syncChunks() {
    const desired = new Set(activeChunkIndices(this.car.s));
    for (const id of this.chunks.keys()) if (!desired.has(id)) this.chunks.delete(id);
    for (const id of desired) if (!this.chunks.has(id)) {
      this.chunks.set(id, chunkDescription(id, this.config.seed)); this.metrics.chunksGenerated++;
    }
    this.metrics.peakChunks = Math.max(this.metrics.peakChunks, this.chunks.size);
    const nextOrigin = Math.floor(this.car.s / 320) * 320;
    if (nextOrigin !== this.origin) { this.origin = nextOrigin; this.metrics.rebases++; }
  }
  obstacles() { return [...this.chunks.values()].flatMap(c => c.traffic).filter(o => !o.hit); }
  startAttack(type, text) {
    this.attack = {type, start: this.time, duration: LENGTHS[type], targetLane: this.car.lane,
      impact: false, evaluated: false, fromS: this.monster.s, fromLane: this.monster.lane};
    this.metrics.attacks++;
    this.emit('attack', {attack: type, text, lane: this.attack.targetLane});
  }
  controls() {
    const car = this.car, phase = (this.time % this.config.duration) / this.config.duration;
    let targetLane = Math.sin(car.s / 75 + this.config.seed) * 3.7;
    const danger = this.attack && this.time - this.attack.start < this.attack.duration - .3;
    const nearby = this.obstacles().filter(o => o.s > car.s - 3 && o.s < car.s + car.speed * 2.4);
    const candidates = [-5.5, 0, 5.5];
    let best = Infinity;
    for (const lane of candidates) {
      let cost = Math.abs(lane - targetLane) * .4 + Math.abs(lane - car.lane) * .16;
      for (const o of nearby) {
        if (Math.abs(lane - o.lane) < 2.9) cost += 35 / Math.max(.4, (o.s - car.s) / car.speed);
      }
      if (danger && this.attack.type !== 'smash' && Math.abs(lane - this.attack.targetLane) < 3.4) cost += 60;
      if (cost < best) { best = cost; targetLane = lane; }
    }
    const blocking = nearby.find(o => o.s > car.s && o.s - car.s < 12 && Math.abs(o.lane - car.lane) < 2.4);
    const boost = (phase > .88 || (danger && this.attack.type === 'charge' && this.time - this.attack.start > .7))
      && car.nitro > 12 && !blocking;
    return {steer: clamp((targetLane - car.lane) * 1.5 - car.lateralSpeed * .9, -1, 1),
      brake: blocking ? .65 : 0, throttle: 1, boost, targetLane};
  }
  damage(amount, source) {
    if (this.hitCooldown > 0) return;
    this.car.health = Math.max(0, this.car.health - amount);
    this.car.speed *= .82; this.hitCooldown = .9; this.metrics.collisions++;
    this.emit('hit', {source, health: this.car.health});
    // Preview can run indefinitely; a damaged truck recovers between directed episodes.
  }
  step(dt = FIXED_DT) {
    if (Math.abs(dt - FIXED_DT) > .000001) throw Error('Use fixed 1/60 simulation steps.');
    this.tick++; this.time = this.tick * FIXED_DT; this.hitCooldown -= dt;
    const cycle = Math.floor(this.time / this.config.duration);
    const phase = (this.time % this.config.duration) / this.config.duration;
    if (cycle !== this.cycle) {
      this.cycle = cycle; this.beat = 0;
      if (cycle > 0) { this.car.health = 100; this.emit('episode', {cycle, text: 'THE CHASE CONTINUES.'}); }
    }
    const beat = BEATS[this.beat];
    if (beat && phase >= beat.at && !this.attack && this.car.s - this.monster.s < 19) {
      this.startAttack(beat.type, beat.text); this.beat++;
    }
    const car = this.car, mon = this.monster, input = this.controls();
    car.boosting = input.boost;
    car.nitro = clamp(car.nitro + (input.boost ? -29 : 12) * dt, 0, 100);
    const targetSpeed = (input.boost ? 30 : 21) * (1 - input.brake * .65);
    car.speed += clamp(targetSpeed - car.speed, -24 * dt, 13 * dt);
    car.lateralSpeed = clamp(car.lateralSpeed + input.steer * 17 * dt, -7, 7);
    car.lane += car.lateralSpeed * dt;
    if (Math.abs(car.lane) > 8) { car.lane = clamp(car.lane, -8, 8); car.lateralSpeed *= -.25; this.damage(4, 'kerb'); }
    car.roll += (-car.lateralSpeed * .018 - car.roll) * Math.min(1, dt * 8);
    car.s += car.speed * dt;
    for (const o of this.obstacles()) if (Math.abs(o.s - car.s) < 3.5 && Math.abs(o.lane - car.lane) < 2.35) {
      o.hit = true; this.damage(9, 'traffic'); this.emit('traffic', {s: o.s, lane: o.lane});
    }
    let gapTarget = 12 + Math.sin(this.time * .8) * 2;
    const finale = phase > .94;
    if (finale) gapTarget = this.config.ending === 'escape' ? 28 : 5.5;
    let desiredLane = car.lane * .65;
    mon.y = 0; mon.roll = 0;
    if (this.attack) {
      const a = this.attack, elapsed = this.time - a.start;
      // Stay at the kerb and reach into the facade; entering a building hides the pursuer.
      desiredLane = a.type === 'smash' ? (a.fromLane < 0 ? -8 : 8) : a.targetLane;
      gapTarget = a.type === 'charge' ? 5.2 : a.type === 'swipe' ? 6.5 : a.type === 'leap' ? 8 : 14;
      if (a.type === 'leap' && elapsed > .6 && elapsed < 2.1) mon.y = Math.sin((elapsed - .6) / 1.5 * Math.PI) * 9;
      if (a.type === 'swipe') mon.roll = Math.sin(clamp((elapsed - .5) / 1.2, 0, 1) * Math.PI) * .25;
      const impactTime = a.type === 'leap' ? 2.1 : a.type === 'charge' ? 1.8 : 1.25;
      if (elapsed >= impactTime && !a.impact) {
        a.impact = true;
        this.emit('impact', {attack: a.type, s: mon.s + 3, lane: mon.lane});
        if (a.type === 'smash') {
          const buildings = [...this.chunks.values()].flatMap(c => c.buildings);
          buildings.sort((b,c) => (Math.abs(b.s-mon.s)+Math.abs(b.lane-mon.lane)) - (Math.abs(c.s-mon.s)+Math.abs(c.lane-mon.lane)));
          if (buildings[0]) this.emit('collapse', {...buildings[0]});
        } else if (Math.abs(car.lane - a.targetLane) < 3 && car.s - mon.s < 12) this.damage(12, a.type);
        else { this.metrics.dodges++; this.emit('dodge', {attack: a.type}); }
      }
      if (elapsed >= a.duration) { this.emit('attackEnd', {attack:a.type}); this.attack = null; }
    }
    if (this.config.intensity === 'intense') gapTarget += 2.5;
    const gap = car.s - mon.s;
    const maxSpeed = this.config.intensity === 'savage' ? 38 : 34;
    const desiredSpeed = clamp(car.speed + (gap - gapTarget) * 1.45, 9, maxSpeed);
    mon.speed += clamp(desiredSpeed - mon.speed, -22 * dt, 16 * dt);
    mon.s += mon.speed * dt;
    mon.lane += clamp(desiredLane - mon.lane, -9 * dt, 9 * dt);
    if (!Number.isFinite(mon.s + car.s + car.lane)) throw Error('Non-finite actor position.');
    const foot = Math.floor(mon.s / 7);
    if (foot !== this.foot && mon.y < 1) { this.foot = foot; this.emit('foot'); }
    this.syncChunks();
    this.metrics.minGap = Math.min(this.metrics.minGap, car.s - mon.s);
    this.metrics.maxGap = Math.max(this.metrics.maxGap, car.s - mon.s);
    this.metrics.distance = car.s - 20;
  }
  drain() { const result = this.pending; this.pending = []; return result; }
  snapshot() {
    return {time:this.time, car:{...this.car}, monster:{...this.monster}, attack:this.attack ? {...this.attack}:null,
      origin:this.origin, chunks:[...this.chunks.keys()], metrics:{...this.metrics}};
  }
}
