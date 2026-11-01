// Aslanlı Yol yerleşim verisi: OSM (©OpenStreetMap katkıcıları, ODbL) + GLO-30 → data/ank/aslanli-yol.json
//
//   node tools/ankara/prepare-aslanli-yol.mjs --osm <ankara-merkez.osm.json>
//
// OSM ölçümleri (yol eksenine izdüşürülmüş, metre):
//   way 267161017 "Aslanlı Yol" (pedestrian): başlangıç (merdiven üstü) → Tören Meydanı, ilk parça 258.3 m, kerteriz 142.3°
//   way 397748869 yol alanı (area, height 1): boyuna 0…258.3, enine −12.9…14.7
//   14 çim şerit (397833618…636): enine ±6.4…±9.5, her yanda 7 şerit, boy ~27 m → arada 6 boşluk (aslan grupları)
//   way 267161019 + 397748876…79: başlangıç merdiveni/sahanlıkları, boyuna −15.8…0, enine ±25, 0.25…1 m kademeler
//   bina 28241495 ve 267161020: başlangıçta iki yanda ~13×13 m kuleler (Hürriyet / İstiklal)
// Uzunluk ve yürüyüş yolu genişliği Zafer Hoca'nın verdiği ölçülerle sabitlenir: 262.20 m × 12.80 m.
import fs from 'node:fs';

const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>(v.startsWith('--')&&a.push([v.slice(2),all[i+1]]),a),[]));
const region=JSON.parse(fs.readFileSync('data/ank/region.json','utf8'));
const terrain=JSON.parse(fs.readFileSync('data/ank/terrain.json','utf8'));
const monument=JSON.parse(fs.readFileSync('data/ank/anitkabir.json','utf8'));
const lat0=region.origin.lat,lon0=region.origin.lon;
// küçük alan için yerel düzlem yaklaşıklığı (±300 m'de < 0.1 m; UTM ile karşılaştırıldı)
const L=p=>[(p.lon-lon0)*111320*Math.cos(lat0*Math.PI/180),-(p.lat-lat0)*110574];
let a=[-284.9,-176.3],b=[-126.9,28.1];
if(args.osm){
  const d=JSON.parse(fs.readFileSync(args.osm,'utf8'));
  const w=d.elements.find(e=>e.type==='way'&&e.id===267161017);
  if(w?.geometry){const g=w.geometry.map(L);a=g[0];b=g[1]}
}
const len0=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/len0,(b[1]-a[1])/len0];
const ground=(x,z)=>{const {x0,z0,step,cols,rows,heights}=terrain;const gx=Math.min(Math.max((x-x0)/step,0),cols-1),gz=Math.min(Math.max((z-z0)/step,0),rows-1);
  const i=Math.min(Math.floor(gx),cols-2),j=Math.min(Math.floor(gz),rows-2),fx=gx-i,fz=gz-j,h=(p,q)=>heights[q*cols+p];
  return (h(i,j)*(1-fx)+h(i+1,j)*fx)*(1-fz)+(h(i,j+1)*(1-fx)+h(i+1,j+1)*fx)*fz};
const LENGTH=262.2,WALK=12.8;
const at=s=>[a[0]+u[0]*s,a[1]+u[1]*s];
// yol yüzeyi: başlangıçta arazinin 0.6 m üstü (OSM alan yüksekliği ≈ 1 m), sonda Tören Meydanı zemini
const y0=Math.round((ground(...at(0))+0.6)*100)/100,y1=monument.floorY;
const layout={
  source:'OSM way 267161017/397748869/397833618…636/267161019, GLO-30; uzunluk ve genişlik Zafer Hoca',
  start:a.map(v=>+v.toFixed(2)),dir:u.map(v=>+v.toFixed(6)),
  rotationY:+Math.atan2(-u[1],u[0]).toFixed(6),     // three.js: model +X → yol yönü
  length:LENGTH,walkWidth:WALK,osmLength:+len0.toFixed(1),
  y0,y1,                                            // yüzey yüksekliği başlangıç / bitiş (doğrusal)
  stairs:{from:-15.5,to:0,halfWidth:25,steps:6,base:Math.round((y0-1.0)*100)/100},
  strips:{count:7,first:[14.5,41.5],last:[230.2,258.4],lateral:[6.4,9.5]},
  paved:{halfWidth:14.7},
  towers:[{name:'Hürriyet Kulesi',along:[0,14],lateral:[-25.7,-12.8]},{name:'İstiklal Kulesi',along:[0,14],lateral:[12.8,27.0]}],
  lod:{near:0,mid:320,far:1100},
  files:{high:'models/aslanli-yol/aslanli_yol_high.glb',low:'models/aslanli-yol/aslanli_yol_low.glb',colliders:'models/aslanli-yol/aslanli_yol_colliders.glb'},
};
// oyun içi ayak izi (OSM binalarını dışlamak ve zemini yol yüzeyine oturtmak için)
const corners=[[-16,-28],[LENGTH,-28],[LENGTH,28],[-16,28]].map(([s,t])=>[a[0]+u[0]*s-u[1]*t,a[1]+u[1]*s+u[0]*t].map(v=>+v.toFixed(2)));
layout.footprint=corners;
fs.writeFileSync('data/ank/aslanli-yol.json',JSON.stringify(layout,null,1));
console.log(`Aslanlı Yol: OSM ${len0.toFixed(1)} m → ${LENGTH} m, kerteriz ${(Math.atan2(u[0],-u[1])*180/Math.PI).toFixed(1)}°, yüzey ${y0} → ${y1} m`);
