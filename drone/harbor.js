// Original procedural classroom scenery. Placement is illustrative, not surveyed infrastructure.
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const palette={steel:0x647578,white:0xdddcd2,navy:0x193948,rubber:0x172026,orange:0xdd5f27,glass:0x203f4d,brass:0xa7a391,red:0xb9402d,green:0x417f60};
const materials=Object.fromEntries(Object.entries(palette).map(([k,c])=>[k,new T.MeshStandardMaterial({color:c,roughness:k==='glass'?.23:k==='rubber'?.93:.62,metalness:k==='steel'?.6:k==='brass'?.5:.12})]));
const scratch=new T.Object3D();
function batch(){const parts=new Map();return {
  add(g,m,x=0,y=0,z=0,rx=0,ry=0,rz=0){scratch.position.set(x,y,z);scratch.rotation.set(rx,ry,rz);scratch.scale.set(1,1,1);scratch.updateMatrix();g.applyMatrix4(scratch.matrix);if(!parts.has(m))parts.set(m,[]);parts.get(m).push(g);},
  box(m,x,y,z,w,h,d){this.add(new T.BoxGeometry(w,h,d),m,x,y,z)},
  cyl(m,x,y,z,r,h){this.add(new T.CylinderGeometry(r,r,h,12),m,x,y,z)},
  rod(m,a,b,r=.025){const av=new T.Vector3(...a),bv=new T.Vector3(...b),g=new T.CylinderGeometry(r,r,av.distanceTo(bv),8);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),bv.clone().sub(av).normalize()));const mid=av.add(bv).multiplyScalar(.5);this.add(g,m,mid.x,mid.y,mid.z)},
  finish(){const group=new T.Group();for(const [m,gs]of parts){const merged=mergeGeometries(gs,false);gs.forEach(g=>g.dispose());group.add(new T.Mesh(merged,m))}return group;}
};}
function deckTexture(){const c=document.createElement('canvas');c.width=c.height=512;const p=c.getContext('2d');p.fillStyle='#777e77';p.fillRect(0,0,512,512);let seed=123;for(let i=0;i<20000;i++){seed=(seed*1664525+1013904223)>>>0;const x=seed%512;seed=(seed*1664525+1013904223)>>>0;const y=seed%512;p.fillStyle=i%2?'#ffffff09':'#0000000c';p.fillRect(x,y,1,2)}for(let y=0;y<512;y+=32){p.fillStyle='#303f3b';p.fillRect(0,y,512,2);for(let x=12;x<512;x+=64){p.fillStyle='#a0a399';p.fillRect(x,y+6,3,3);p.fillStyle='#404b45';p.fillRect(x,y+8,3,2)}}const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(3,2);tex.anisotropy=4;return tex;}
function pontoon(){const b=batch();const deck=new T.MeshStandardMaterial({map:deckTexture(),roughness:.93,color:0xb9bdb2});b.box(deck,0,-.06,0,14,.28,10);b.box(materials.navy,0,-.45,0,14.1,.6,10.1);
  // Thin painted safety strip, handrails, fenders and mooring hardware.
  for(const s of [-1,1]){b.box(materials.brass,s*6.7,.088,0,.12,.015,9.5);b.box(materials.brass,0,.088,s*4.7,13.5,.015,.12);for(let z=-4;z<=4;z+=2){b.cyl(materials.steel,s*6.75,.64,z,.033,1.1);b.add(new T.TorusGeometry(.21,.065,6,14),materials.rubber,s*7.12,-.22,z,0,Math.PI/2)}for(const y of [.56,1.16])b.rod(materials.steel,[s*6.75,y,-4],[s*6.75,y,4]);for(let x=-6;x<=6;x+=2){b.cyl(materials.steel,x,.64,s*4.65,.033,1.1)}for(const y of [.56,1.16])b.rod(materials.steel,[-6,y,s*4.65],[6,y,s*4.65]);for(const z of [-3.9,3.9]){b.cyl(materials.steel,s*5.8,.24,z,.13,.34);b.box(materials.steel,s*5.8,.34,z,.55,.08,.13);for(let i=0;i<4;i++)b.add(new T.TorusGeometry(.23+i*.014,.018,5,24),materials.brass,s*5.8,.12+i*.035,z,Math.PI/2)}}
  b.add(new T.TorusGeometry(.34,.09,8,24),materials.orange,-6.7,.77,-1,0,Math.PI/2);
  for(let i=0;i<3;i++){const x=3.8+i*.75;b.box(materials.navy,x,.29,3.1,.62,.4,.9);b.box(materials.steel,x,.51,3.1,.65,.07,.93);for(const z of [2.8,3.4])b.box(materials.brass,x,.37,z,.69,.1,.025)}
  b.box(materials.white,-4.9,.8,3.4,1.05,1.4,.65);b.box(materials.glass,-4.9,1.01,3.06,.72,.32,.025);b.box(materials.orange,-4.9,.51,3.05,.35,.14,.025);
  for(const x of [-6.6,6.6]){b.cyl(materials.steel,x,1.3,4.5,.025,2.4);b.box(materials.white,x,2.52,4.5,.22,.07,.14)}
  b.cyl(materials.steel,-5.8,2.4,-3.8,.045,4.7);b.rod(materials.steel,[-5.8,4.5,-3.8],[-4.5,4.5,-3.8]);
  const g=b.finish();g.name='Training pontoon';
  const sock=new T.Group();for(let i=0;i<6;i++){const m=new T.Mesh(new T.CylinderGeometry(.21-i*.025,.19-i*.025,.27,10,1,true),i%2?materials.white:materials.orange);m.rotation.z=Math.PI/2;m.position.x=.135+i*.27;sock.add(m)}sock.position.set(-4.5,4.45,-3.8);g.add(sock);
  return {object:g,sock};
}
function vessel(kind){const ferry=kind==='ferry',b=batch(),length=ferry?30:9,width=ferry?7:2.8;const shape=new T.Shape();shape.moveTo(-width/2,length*.36);shape.lineTo(width/2,length*.36);shape.lineTo(width*.48,-length*.26);shape.lineTo(0,-length*.5);shape.lineTo(-width*.48,-length*.26);shape.closePath();const hull=new T.ExtrudeGeometry(shape,{depth:ferry?1.65:.75,bevelEnabled:true,bevelSize:.12,bevelThickness:.12,bevelSegments:1,steps:1});hull.rotateX(Math.PI/2);b.add(hull,materials.navy,0,ferry?1.85:.85,0);
  const top=ferry?2.1:1.05;b.box(materials.white,0,top,0,width*.94,.24,length*.68);b.box(materials.white,0,top+.95,-length*.03,width*.74,1.7,length*.49);b.box(materials.white,0,top+1.92,-length*.03,width*.83,.18,length*.53);
  for(const side of [-1,1]){for(let z=-length*.23;z<length*.2;z+=ferry?1.55:1){b.box(materials.glass,side*(width*.371),top+1.04,z,.045,.66,ferry?1.1:.7)}b.box(materials.orange,side*width*.38,top+.18,0,.05,.14,length*.52);for(let z=-length*.3;z<length*.33;z+=1.4)b.cyl(materials.steel,side*width*.44,top+.51,z,.022,.85);b.rod(materials.steel,[side*width*.44,top+.92,-length*.3],[side*width*.44,top+.92,length*.32]);b.add(new T.TorusGeometry(ferry?.4:.22,ferry?.11:.06,6,16),materials.orange,side*width*.385,top+.9,length*.2,0,Math.PI/2)}
  b.box(materials.glass,0,top+1.12,-length*.28,width*.6,.64,.05);
  if(ferry){b.box(materials.white,0,top+2.55,-5.5,4.3,1.25,4);b.box(materials.glass,0,top+2.65,-7.53,3.9,.65,.06);b.box(materials.orange,0,top+3.15,2,1.9,2.6,1.6);b.box(materials.rubber,0,top+4.48,2,2,.13,1.7);for(const x of [-2,2]){b.box(materials.white,x,top+2.3,5,.95,.45,4.1)}}
  b.cyl(materials.steel,0,top+3,-length*.16,.035,3);b.rod(materials.steel,[-.8,top+3.8,-length*.16],[.8,top+3.8,-length*.16]);b.cyl(materials.white,0,top+4.55,-length*.16,.16,.13);
  const object=b.finish();object.name=ferry?'Passenger ferry':'Harbor launch';return {object,length,width,top:top+(ferry?4.6:4.5)};
}
function wakeTexture(){const c=document.createElement('canvas');c.width=128;c.height=256;const p=c.getContext('2d');for(let i=0;i<70;i++){const y=i*3.6,a=(1-i/70)*.22;p.strokeStyle=`rgba(218,238,232,${a})`;p.lineWidth=2.5;p.beginPath();p.moveTo(64,0);p.quadraticCurveTo(60-i*.25,y*.5,60-i*.72,y);p.stroke();p.beginPath();p.moveTo(64,0);p.quadraticCurveTo(68+i*.25,y*.5,68+i*.72,y);p.stroke()}const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
export function createHarbor({scene,home,world,reducedMotion=false}){
  const root=new T.Group();root.name='BVLOS educational harbor scenery';root.position.set(home.x,0,home.z);scene.add(root);const dock=pontoon();root.add(dock.object);
  const bounds=[new T.Box3(new T.Vector3(-7,-1,-5),new T.Vector3(7,.08,5)),new T.Box3(new T.Vector3(-5.5,.1,3),new T.Vector3(-4.3,1.6,3.9)),new T.Box3(new T.Vector3(3.4,.1,2.6),new T.Vector3(6.4,.6,3.6))];
  for(const s of [-1,1]){bounds.push(new T.Box3(new T.Vector3(s<0?-6.83:6.67,.08,-4.1),new T.Vector3(s<0?-6.67:6.83,1.25,4.1)));bounds.push(new T.Box3(new T.Vector3(-6.1,.08,s<0?-4.73:4.57),new T.Vector3(6.1,1.25,s<0?-4.57:4.73)));}
  const buoyData=[[-28,-45],[-65,-125],[-110,-230],[-370,-350],[-620,-200],[-390,165],[40,45]],buoys=[];
  for(let i=0;i<buoyData.length;i++){const [x,z]=buoyData[i];if(!world.isWater(home.x+x,home.z+z))continue;const b=batch(),m=i%2?materials.green:materials.red;b.cyl(m,0,.35,0,.65,.65);b.add(new T.ConeGeometry(.43,1.5,12),m,0,1.3,0);b.cyl(materials.steel,0,2.3,0,.06,1.3);b.cyl(materials.white,0,2.96,0,.13,.15);const o=b.finish();o.position.set(x,0,z);root.add(o);buoys.push(o);bounds.push(new T.Box3(new T.Vector3(x-.7,-1,z-.7),new T.Vector3(x+.7,3.1,z+.7)))}
  const ships=[],wakeMat=new T.MeshBasicMaterial({map:wakeTexture(),transparent:true,opacity:.65,depthWrite:false,side:T.DoubleSide});
  for(const [kind,cx,cz,rx,rz,phase]of [['ferry',-190,-260,115,135,0],['launch',-390,45,90,60,2],['ferry',-840,-650,180,130,4]]){
    const path=Array.from({length:40},(_,i)=>{const a=i/40*Math.PI*2;return world.isWater(home.x+cx+Math.cos(a)*rx,home.z+cz+Math.sin(a)*rz)});if(path.some(v=>!v))continue;
    const ship=vessel(kind);root.add(ship.object);const wake=new T.Mesh(new T.PlaneGeometry(ship.width*3,ship.length*2.8),wakeMat);wake.rotation.x=-Math.PI/2;wake.position.set(0,.09,ship.length*1.75);ship.object.add(wake);ships.push({...ship,cx,cz,rx,rz,phase,box:new T.Box3()});
  }
  const birds=[];const wingGeo=new T.BufferGeometry();wingGeo.setAttribute('position',new T.Float32BufferAttribute([0,0,0,1.25,.05,.05,.48,0,.32,0,0,0,.48,0,.32,.08,0,.25],3));wingGeo.computeVertexNormals();const birdMat=new T.MeshStandardMaterial({color:0xd6d7cc,roughness:1,side:T.DoubleSide});birdMat.userData.trainingHeat=.76;for(let i=0;i<10;i++){const g=new T.Group(),left=new T.Mesh(wingGeo,birdMat),right=new T.Mesh(wingGeo,birdMat);right.scale.x=-1;g.add(left,right);root.add(g);birds.push({g,left,right,phase:i*.71})}
  let time=0;const point=new T.Vector3();
  function update(dt,wind={speed:0,direction:0}){time+=dt;
    // Local +X points along the sock: downwind (+Z for wind from north).
    const strength=Math.min(1,wind.speed/8);
    dock.sock.rotation.set(0,-Math.PI/2-wind.direction*Math.PI/180,-(1-strength)*1.25+(reducedMotion?0:Math.sin(time*3)*.045*strength));
    for(let i=0;i<buoys.length;i++){buoys[i].position.y=reducedMotion?0:Math.sin(time*1.3+i)*.09;buoys[i].rotation.z=reducedMotion?0:Math.sin(time*.9+i)*.04}
    for(const s of ships){const a=s.phase+time*.012,x=s.cx+Math.cos(a)*s.rx,z=s.cz+Math.sin(a)*s.rz;s.object.position.set(x,reducedMotion?0:Math.sin(time+s.phase)*.045,z);s.object.rotation.y=Math.atan2(s.rx*Math.sin(a),-s.rz*Math.cos(a));s.box.setFromCenterAndSize(new T.Vector3(x,s.top/2,z),new T.Vector3(s.length,s.top,s.length));}
    for(const {g,left,right,phase}of birds){const a=phase+time*.07;g.position.set(-70+Math.cos(a)*65,24+Math.sin(a*2)*5+phase*1.1,-100+Math.sin(a)*50);g.rotation.y=-a;const flap=reducedMotion?.15:Math.sin(time*4+phase)*.35;left.rotation.z=flap;right.rotation.z=-flap;}
  }
  update(0);
  return {object:root,counts:{boats:ships.length,buoys:buoys.length,birds:birds.length},update,
    hitTest(x,y,z,r=.2){point.set(x-home.x,y,z-home.z);for(const b of bounds)if(b.distanceToPoint(point)<r)return true;for(const s of ships)if(s.box.distanceToPoint(point)<r){s.object.updateWorldMatrix(true,false);const p=s.object.worldToLocal(new T.Vector3(x,y,z));if(Math.abs(p.x)<s.width/2+r&&Math.abs(p.z)<s.length/2+r&&p.y>=-.5-r&&p.y<s.top+r)return true}return false;},
    dispose(){root.removeFromParent();const geometries=new Set(),mats=new Set();root.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);mats.add(o.material)}});geometries.forEach(g=>g.dispose());mats.forEach(m=>{m.map?.dispose();m.dispose()});}
  };
}
