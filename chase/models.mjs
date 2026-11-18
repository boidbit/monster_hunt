/* Monster and armored truck adapted from the original Monster Hunt models. */
export function buildMonster(THREE){
  const root=new THREE.Group();
  const lime=new THREE.MeshLambertMaterial({color:0x9BD13B}), belly=new THREE.MeshLambertMaterial({color:0xE3F59A});
  const purple=new THREE.MeshLambertMaterial({color:0x6C3FC4}), white=new THREE.MeshLambertMaterial({color:0xFFFFFF});
  const black=new THREE.MeshBasicMaterial({color:0x1D1B3A});
  const box=(w,h,d,mat,x,y,z,p)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); m.castShadow=true; p.add(m); return m; };
  const body=new THREE.Group(); root.add(body);
  box(2,2.2,1.7,lime,0,2.3,0,body);
  box(1.3,1.5,0.1,belly,0,2.1,0.86,body);
  box(0.6,0.5,1.5,lime,0,1.4,-1.4,body);
  const head=new THREE.Group(); head.position.set(0,3.95,0.25); body.add(head);
  box(1.7,1.2,1.5,lime,0,0,0,head);
  box(1.4,0.28,0.2,white,0,-0.38,0.72,head);
  box(0.44,0.44,0.1,white,-0.42,0.2,0.76,head); box(0.44,0.44,0.1,white,0.42,0.2,0.76,head);
  const pupil=new THREE.MeshBasicMaterial({color:0x1D1B3A});
  box(0.2,0.22,0.1,pupil,-0.38,0.17,0.82,head); box(0.2,0.22,0.1,pupil,0.46,0.17,0.82,head);
  for(const s of [-1,1]){ const h=new THREE.Mesh(new THREE.ConeGeometry(0.18,0.6,6),purple); h.position.set(s*0.6,0.85,0); h.rotation.z=-s*0.3; head.add(h); }
  for(let i=0;i<4;i++){ const c=new THREE.Mesh(new THREE.ConeGeometry(0.3,0.75,4),purple); c.rotation.x=-Math.PI/2; c.position.set(0,3.3-i*0.6,-0.95); c.castShadow=true; body.add(c); }
  const limb=(x,y,w,h,d)=>{ const g=new THREE.Group(); g.position.set(x,y,0); body.add(g); box(w,h,d,lime,0,-h/2,0,g); return g; };
  const armL=limb(-1.25,3.1,0.5,1.1,0.5), armR=limb(1.25,3.1,0.5,1.1,0.5);
  const legL=new THREE.Group(), legR=new THREE.Group();
  legL.position.set(-.64,2.65,0); legR.position.set(.64,2.65,0); root.add(legL,legR);
  for(const leg of [legL,legR]){
   box(.90,1.46,1.05,lime,0,-.63,0,leg);
   box(.68,1.15,.78,belly,0,-1.87,-.05,leg);
   box(1.04,.39,1.75,lime,0,-2.45,.32,leg);
   for(const toe of [-.3,.3])box(.29,.22,.58,white,toe,-2.54,1.04,leg);
  }
  return {root,body,armL,armR,legL,legR,lime,belly,pupil};
}

export function buildTruck(THREE){
  const heliBody=new THREE.MeshLambertMaterial({color:0x0d8f98});
  const heliDark=new THREE.MeshLambertMaterial({color:0x172e43});
  const heliGlass=new THREE.MeshLambertMaterial({color:0x83dce1});
  const heliYellow=new THREE.MeshLambertMaterial({color:0xffbd48});
  const root=new THREE.Group(), body=new THREE.Group(); root.add(body);
  const white=new THREE.MeshBasicMaterial({color:0xFFF8EE}), red=new THREE.MeshBasicMaterial({color:0xE5484D});
  const tire=new THREE.MeshLambertMaterial({color:0x1D1B3A}), hub=new THREE.MeshLambertMaterial({color:0xB8AFA6});
  const add=(geo,mat,x,y,z,rx,parent)=>{ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); if(rx) m.rotation.x=rx;
    m.castShadow=true; (parent||body).add(m); return m; };
  // chassis + skirt + bumpers
  add(new THREE.BoxGeometry(2.3,0.9,4.3),heliBody,0,1.05,0);
  add(new THREE.BoxGeometry(2.36,0.32,4.36),heliDark,0,0.66,0);
  add(new THREE.BoxGeometry(2.44,0.28,0.3),heliDark,0,0.72,2.25);
  add(new THREE.BoxGeometry(2.44,0.28,0.3),heliDark,0,0.72,-2.25);
  // cabin, glass, windshield
  add(new THREE.BoxGeometry(2.0,0.85,2.1),heliBody,0,1.92,-0.35);
  add(new THREE.BoxGeometry(2.04,0.5,1.6),heliGlass,0,1.98,-0.4);
  add(new THREE.BoxGeometry(1.8,0.62,0.08),heliGlass,0,1.95,0.74,-0.35);
  // front: grille, light bar, headlights; rear: tail lights
  add(new THREE.BoxGeometry(1.9,0.42,0.08),heliDark,0,1.02,2.16);
  add(new THREE.BoxGeometry(1.8,0.09,0.06),heliYellow,0,1.3,2.19);
  add(new THREE.BoxGeometry(0.36,0.16,0.06),white,-0.82,1.18,2.19);
  add(new THREE.BoxGeometry(0.36,0.16,0.06),white,0.82,1.18,2.19);
  add(new THREE.BoxGeometry(0.36,0.18,0.06),red,-0.85,1.2,-2.18);
  add(new THREE.BoxGeometry(0.36,0.18,0.06),red,0.85,1.2,-2.18);
  // fender flares
  for(const sx of [-1,1]) for(const sz of [-1,1]) add(new THREE.BoxGeometry(0.22,0.3,1.35),heliDark,sx*1.2,1.18,sz*1.45);
  // roof turret with twin barrels
  add(new THREE.CylinderGeometry(0.5,0.55,0.3,12),heliDark,0,2.5,-0.35);
  add(new THREE.BoxGeometry(0.8,0.38,0.9),heliYellow,0,2.8,-0.3);
  const barrels=[add(new THREE.CylinderGeometry(0.09,0.09,1.5,8),heliDark,-0.16,2.8,0.75,Math.PI/2),
                 add(new THREE.CylinderGeometry(0.09,0.09,1.5,8),heliDark,0.16,2.8,0.75,Math.PI/2)];
  const flashMat=new THREE.MeshBasicMaterial({color:0xFFE36E,transparent:true,opacity:0.95});
  const muzzle=[-0.16,0.16].map(x=>{ const f=new THREE.Mesh(new THREE.IcosahedronGeometry(0.34,0),flashMat); f.position.set(x,2.8,1.7); f.visible=false; body.add(f); return f; });
  // wheels (outside the body group so they stay planted when the body rolls/pitches)
  const wheels=[];
  for(const sx of [-1,1]) for(const sz of [-1,1]){
    const steer=new THREE.Group(); steer.position.set(sx*1.15,0.58,sz*1.45); root.add(steer);
    const spin=new THREE.Group(); steer.add(spin);
    const t=new THREE.Mesh(new THREE.CylinderGeometry(0.58,0.58,0.5,14),tire); t.rotation.z=Math.PI/2; t.castShadow=true; spin.add(t);
    const h=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.28,0.52,8),hub); h.rotation.z=Math.PI/2; spin.add(h);
    wheels.push({steer,spin,front:sz>0});
  }
  // nitro flames out of the back
  const flameMat=new THREE.MeshBasicMaterial({color:0xFF8A3D,transparent:true,opacity:0.9});
  const flames=[];
  for(const fxOff of [-0.6,0.6]){
    const f=new THREE.Mesh(new THREE.ConeGeometry(0.3,1.4,8),flameMat);
    f.rotation.x=-Math.PI/2; f.position.set(fxOff,0.85,-2.95); f.visible=false; body.add(f); flames.push(f);
  }
  return {root,body,wheels,flames,barrels,muzzle};
}
