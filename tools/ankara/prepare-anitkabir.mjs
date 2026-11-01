// Anıtkabir model preparation: Meshy GLB → game-ready models/anitkabir.glb + data/ank/anitkabir.json.
//
//   node tools/ankara/prepare-anitkabir.mjs --in <Meshy_AI_Anıtkabir_….glb>
//
// 1. Optimise: weld, simplify (~68k triangles), textures ≤ 2048 px WebP, metallic 0 (stone, not metal).
// 2. Colour fix: Meshy painted the roofs sky-blue; blue roof pixels become lead grey (luminance kept).
// 3. Placement in the map frame of data/ank/region.json (OSM-based, see the report it prints):
//      - Anıt Blok roof centre of the model  → OSM way 28241512 "Mustafa Kemal Atatürk Türbesi" (local 0, 0)
//      - model +X (Tören Meydanı → Anıt Blok) → bearing from the 8 OSM tower nodes' centroid to the Türbe (≈ 52°)
//      - scale: Anıt Blok length in the model ↔ 57.35 m (published façade length), uniform
//      - Tören Meydanı floor of the model     → GLO-30 terrain height at the square centre
// 4. Collision: a 1 m top-surface height grid of the placed model (rasterised triangles, max height per cell),
//    used by drone/anitkabir.js for getObstacleHeight / hitTest / landing. Terrain is flattened to the square floor
//    inside the model footprint so the model does not float or sink.
// The model is a representative visual (Meshy AI), not a measured architectural survey.
import fs from 'node:fs';
import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {weld,simplify,textureCompress,dedup,prune} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';

const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>(v.startsWith('--')&&a.push([v.slice(2),all[i+1]]),a),[]));
if(!args.in)throw Error('--in <Meshy GLB> gerekli');
const OUT_MODEL=args.model||'models/anitkabir.glb',OUT_DATA=args.data||'data/ank/anitkabir.json';
const region=JSON.parse(fs.readFileSync('data/ank/region.json','utf8'));
const terrain=JSON.parse(fs.readFileSync('data/ank/terrain.json','utf8'));

// ---- model-space landmarks (measured on the Meshy model, see ANKARA-ILERLEME.md) ----
const MODEL={
  anitBlok:{x:0.678,z:-0.01,lengthX:0.475},   // roof extent x 0.44…0.915, z −0.21…0.19
  squareFloorY:-0.11,                         // Tören Meydanı floor height in model units
  squareCentre:{x:-0.24,z:0},
};
const REAL={anitBlokLength:57.35,bearingDeg:52.0};   // façade length (m); square → Anıt Blok bearing from OSM towers
const scale=REAL.anitBlokLength/MODEL.anitBlok.lengthX;
const theta=(90-REAL.bearingDeg)*Math.PI/180;          // three.js rotation.y mapping model +X to the bearing

const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':null});
const doc=await io.read(args.in);
await MeshoptSimplifier.ready;
await doc.transform(dedup(),weld(),simplify({simplifier:MeshoptSimplifier,ratio:0.14,error:0.0008}),prune());
for(const m of doc.getRoot().listMaterials()){m.setMetallicFactor(0);m.setRoughnessFactor(1);m.setDoubleSided(false)}
// roof colour fix on the base colour texture (before compression)
for(const m of doc.getRoot().listMaterials()){
  const tex=m.getBaseColorTexture();if(!tex)continue;
  const img=sharp(Buffer.from(tex.getImage())).resize(2048,2048,{fit:'inside'});
  const {data,info}=await img.removeAlpha().raw().toBuffer({resolveWithObject:true});
  let changed=0;
  for(let i=0;i<data.length;i+=3){const r=data[i],g=data[i+1],b=data[i+2];
    if(b>r+28&&b>g+8){const l=0.3*r+0.55*g+0.15*b;data[i]=Math.min(255,l*0.98+14);data[i+1]=Math.min(255,l*1.0+14);data[i+2]=Math.min(255,l*0.96+12);changed++}}
  tex.setImage(await sharp(data,{raw:info}).png().toBuffer()).setMimeType('image/png');
  console.log(`Çatı rengi: ${(100*changed/(data.length/3)).toFixed(1)} % piksel mavi→kurşun gri`);
}
await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',resize:[2048,2048],quality:82}));
fs.mkdirSync(path.dirname(OUT_MODEL),{recursive:true});
await io.write(OUT_MODEL,doc);

// ---- terrain sampler (same bilinear rule as drone/ankara-world.js) ----
const ground=(x,z)=>{const {x0,z0,step,cols,rows,heights}=terrain;const gx=Math.min(Math.max((x-x0)/step,0),cols-1),gz=Math.min(Math.max((z-z0)/step,0),rows-1);
  const i=Math.min(Math.floor(gx),cols-2),j=Math.min(Math.floor(gz),rows-2),fx=gx-i,fz=gz-j,h=(a,b)=>heights[b*cols+a];
  return (h(i,j)*(1-fx)+h(i+1,j)*fx)*(1-fz)+(h(i,j+1)*(1-fx)+h(i+1,j+1)*fx)*fz};
const c=Math.cos(theta),s=Math.sin(theta);
// model → local: translate (Anıt Blok to origin), scale, rotate about Y (three.js convention), lift
const toLocalXZ=(mx,mz)=>{const x=(mx-MODEL.anitBlok.x)*scale,z=(mz-MODEL.anitBlok.z)*scale;return [x*c+z*s,-x*s+z*c]};
const [sqx,sqz]=toLocalXZ(MODEL.squareCentre.x,MODEL.squareCentre.z);
const floorY=Math.round(ground(sqx,sqz)*10)/10;
const lift=floorY-MODEL.squareFloorY*scale;
const toLocal=(mx,my,mz)=>{const [x,z]=toLocalXZ(mx,mz);return [x,my*scale+lift,z]};

// ---- top-surface height grid (1 m), rasterised from the placed triangles ----
const out=await io.read(OUT_MODEL);
const prim=out.getRoot().listMeshes()[0].listPrimitives()[0];
const P=prim.getAttribute('POSITION'),I=prim.getIndices();const v=[0,0,0];
const verts=new Float32Array(P.getCount()*3);
let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
for(let i=0;i<P.getCount();i++){P.getElement(i,v);const q=toLocal(...v);verts.set(q,i*3);minX=Math.min(minX,q[0]);maxX=Math.max(maxX,q[0]);minZ=Math.min(minZ,q[2]);maxZ=Math.max(maxZ,q[2])}
const cell=1,gx0=Math.floor(minX),gz0=Math.floor(minZ),cols=Math.ceil(maxX-gx0)+1,rows=Math.ceil(maxZ-gz0)+1;
const top=new Float32Array(cols*rows).fill(-Infinity);
const idx=I.getArray();
for(let t=0;t<idx.length;t+=3){
  const a=idx[t]*3,b=idx[t+1]*3,d=idx[t+2]*3;
  const ax=verts[a],ay=verts[a+1],az=verts[a+2],bx=verts[b],by=verts[b+1],bz=verts[b+2],cx=verts[d],cy=verts[d+1],cz=verts[d+2];
  const den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(den)<1e-9)continue;
  const i0=Math.max(0,Math.floor(Math.min(ax,bx,cx)-gx0)),i1=Math.min(cols-1,Math.ceil(Math.max(ax,bx,cx)-gx0));
  const j0=Math.max(0,Math.floor(Math.min(az,bz,cz)-gz0)),j1=Math.min(rows-1,Math.ceil(Math.max(az,bz,cz)-gz0));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
    const px=gx0+i,pz=gz0+j;
    const w1=((bz-cz)*(px-cx)+(cx-bx)*(pz-cz))/den,w2=((cz-az)*(px-cx)+(ax-cx)*(pz-cz))/den,w3=1-w1-w2;
    if(w1<-0.02||w2<-0.02||w3<-0.02)continue;
    const y=w1*ay+w2*by+w3*cy,k=j*cols+i;if(y>top[k])top[k]=y;
  }
}
// small gaps (thin features between samples): 3×3 max for cells that stayed empty
const filled=Float32Array.from(top);
for(let j=1;j<rows-1;j++)for(let i=1;i<cols-1;i++){const k=j*cols+i;if(top[k]!==-Infinity)continue;let m=-Infinity,n=0;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const y=top[k+dj*cols+di];if(y!==-Infinity){m=Math.max(m,y);n++}}if(n>=5)filled[k]=m}
const heights=Array.from(filled,y=>y===-Infinity?null:Math.round(y*10)/10);
// footprint (oriented rectangle of the model's x/z extent) for terrain flattening and OSM building exclusion
const bb={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};for(let i=0;i<P.getCount();i++){P.getElement(i,v);bb.minX=Math.min(bb.minX,v[0]);bb.maxX=Math.max(bb.maxX,v[0]);bb.minZ=Math.min(bb.minZ,v[2]);bb.maxZ=Math.max(bb.maxZ,v[2])}
const footprint=[[bb.minX,bb.minZ],[bb.maxX,bb.minZ],[bb.maxX,bb.maxZ],[bb.minX,bb.maxZ]].map(([x,z])=>toLocalXZ(x,z).map(n=>Math.round(n*100)/100));
const data={
  source:'Meshy AI (Zafer Hoca), optimised by tools/ankara/prepare-anitkabir.mjs',
  note:'Temsili görsel model; ölçülmüş mimari rekonstrüksiyon değildir. Yerleşim OSM (Türbe ve kule düğümleri) ve GLO-30 ile yapıldı.',
  model:OUT_MODEL.replace(/\\/g,'/'),
  transform:{modelAnchor:[MODEL.anitBlok.x,MODEL.squareFloorY,MODEL.anitBlok.z],scale:+scale.toFixed(4),rotationY:+theta.toFixed(6),position:[0,+lift.toFixed(2),0]},
  floorY,footprint,
  grid:{x0:gx0,z0:gz0,step:cell,cols,rows,heights},
  flag:{pole:toLocalXZ(-0.30,0).map(n=>Math.round(n*10)/10),note:'Bayrak direği konumu temsili; gerekirse düzenleyin (yerel metre).'},
};
fs.writeFileSync(OUT_DATA,JSON.stringify(data));
const ok=heights.filter(h=>h!==null).length;
console.log(`Model: ${OUT_MODEL} (${(fs.statSync(OUT_MODEL).size/1e6).toFixed(2)} MB), ölçek ${scale.toFixed(1)} m/birim, dönüş ${(theta*180/Math.PI).toFixed(1)}°`);
console.log(`Meydan zemini ${floorY} m · ızgara ${cols}×${rows} (${ok} dolu hücre) · en yüksek ${Math.max(...heights.filter(h=>h!==null))} m`);
