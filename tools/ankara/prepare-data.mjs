// Ankara · Anıtkabir data preparation (run once when the raw downloads change).
//
//   node tools/ankara/prepare-data.mjs --dem <Copernicus_DSM_COG_10_N39_00_E032_00_DEM.tif> --osm <overpass.json>
//
// Writes into data/ank/ (local metres of data/ank/region.json, UTM 36N, origin Anıt Blok):
//   terrain.json    20 m height grid from Copernicus DEM GLO-30, with a 60 m morphological opening that flattens most
//                   buildings and tree canopy of the surface model (approximation, not a bare-earth survey)
//   buildings.json  OSM building footprints; height from height / building:levels tags, else a type-based estimate
//                   (every estimate is flagged "estimated": true)
//   ground.json     OSM roads, paths, parks and green areas for the drawn ground layer (drone/ground.js format)
//   landmarks.json  heritage view targets found by name in OSM (Anıt Blok, Aslanlı Yol, Tören Meydanı, …)
//   report.txt      what was found and what is missing, for the hand-off notes
// Nothing is downloaded here. Sources: Copernicus DEM GLO-30 (© DLR e.V. 2010-2014 and © Airbus Defence and Space
// GmbH 2014-2018, provided under COPERNICUS by the EU and ESA) and © OpenStreetMap contributors (ODbL 1.0).
import fs from 'node:fs';
import path from 'node:path';
import {createUtm} from '../../src/maps/utm.js';

const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>(v.startsWith('--')&&a.push([v.slice(2),all[i+1]]),a),[]));
const OUT=args.out||'data/ank';
const region=JSON.parse(fs.readFileSync(path.join(OUT,'region.json'),'utf8'));
const utm=createUtm(region.crs);
const local=(lon,lat)=>{const [e,n]=utm.fwd(lon,lat);return [e-region.originUTM[0],region.originUTM[1]-n]};
const report=[];
const round=(v,d=1)=>Math.round(v*10**d)/10**d;

// ---------------------------------------------------------------- terrain
async function terrain(file){
  const {fromFile}=await import('geotiff');
  const tiff=await fromFile(file),image=await tiff.getImage();
  const [ox,oy]=image.getOrigin(),[rx,ry]=image.getResolution();   // ry < 0 (north-up)
  const step=20,{minX,maxX,minZ,maxZ}=region.local;
  const cols=Math.round((maxX-minX)/step)+1,rows=Math.round((maxZ-minZ)/step)+1;
  // lon/lat bounds of the local square (+ margin) → pixel window
  const corners=[[minX,minZ],[minX,maxZ],[maxX,minZ],[maxX,maxZ]].map(([x,z])=>utm.inv(x+region.originUTM[0],region.originUTM[1]-z));
  const lon0=Math.min(...corners.map(c=>c.lon))-.005,lon1=Math.max(...corners.map(c=>c.lon))+.005;
  const lat0=Math.min(...corners.map(c=>c.lat))-.005,lat1=Math.max(...corners.map(c=>c.lat))+.005;
  const px0=Math.max(0,Math.floor((lon0-ox)/rx)),px1=Math.min(image.getWidth(),Math.ceil((lon1-ox)/rx));
  const py0=Math.max(0,Math.floor((lat1-oy)/ry)),py1=Math.min(image.getHeight(),Math.ceil((lat0-oy)/ry));
  const [raw]=await image.readRasters({window:[px0,py0,px1,py1]});
  const w=px1-px0,h=py1-py0;
  // 60 m opening (min then max, radius 2 px ≈ 2 × 23–31 m) removes most buildings / canopy, then a 3×3 mean
  const filter=(src,fn,r)=>{const out=new Float32Array(src.length);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=fn===Math.min?Infinity:-Infinity;for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++){const xx=Math.min(w-1,Math.max(0,x+i)),yy=Math.min(h-1,Math.max(0,y+j));v=fn(v,src[yy*w+xx])}out[y*w+x]=v}return out};
  let dem=filter(filter(raw,Math.min,2),Math.max,2);
  const mean=new Float32Array(dem.length);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let s=0,n=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const xx=x+i,yy=y+j;if(xx>=0&&yy>=0&&xx<w&&yy<h){s+=dem[yy*w+xx];n++}}mean[y*w+x]=s/n}
  dem=mean;
  const sample=(lon,lat)=>{const fx=(lon-ox)/rx-px0-.5,fy=(lat-oy)/ry-py0-.5;const x=Math.min(w-2,Math.max(0,Math.floor(fx))),y=Math.min(h-2,Math.max(0,Math.floor(fy))),ax=Math.min(1,Math.max(0,fx-x)),ay=Math.min(1,Math.max(0,fy-y));const v=(i,j)=>dem[(y+j)*w+x+i];return (v(0,0)*(1-ax)+v(1,0)*ax)*(1-ay)+(v(0,1)*(1-ax)+v(1,1)*ax)*ay};
  const heights=new Array(cols*rows);let lo=Infinity,hi=-Infinity;
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const g=utm.inv(minX+i*step+region.originUTM[0],region.originUTM[1]-(minZ+j*step));const v=round(sample(g.lon,g.lat));heights[j*cols+i]=v;lo=Math.min(lo,v);hi=Math.max(hi,v)}
  const data={source:'Copernicus DEM GLO-30',license:'Copernicus DEM licence (© DLR e.V. 2010-2014, © Airbus Defence and Space GmbH 2014-2018, EU/ESA)',processing:'60 m morphological opening + 3×3 mean; approximate ground, not a bare-earth survey',x0:minX,z0:minZ,step,cols,rows,heights};
  fs.writeFileSync(path.join(OUT,'terrain.json'),JSON.stringify(data));
  const at=(lon,lat)=>{const [x,z]=local(lon,lat);const i=Math.round((x-minX)/step),j=Math.round((z-minZ)/step);return heights[j*cols+i]};
  report.push(`Arazi: ${cols}×${rows} nokta, ${step} m aralık, ${lo}–${hi} m. Anıt Blok ≈ ${at(region.origin.lon,region.origin.lat)} m, kalkış ≈ ${at(region.home.lon,region.home.lat)} m.`);
  return {sampleLocal:(x,z)=>{const g=utm.inv(x+region.originUTM[0],region.originUTM[1]-z);return sample(g.lon,g.lat)}};
}

// ---------------------------------------------------------------- OSM
const TYPE_HEIGHT={house:7,detached:7,residential:12,apartments:15,commercial:14,retail:8,office:20,school:12,university:14,public:12,civic:12,government:14,hospital:18,mosque:14,church:12,garage:3,garages:3,shed:3,roof:5,kiosk:3,service:4,hut:3,construction:10,military:8,yes:10};
const metres=v=>{const n=parseFloat(String(v||'').replace(',','.'));return Number.isFinite(n)&&n>0&&n<400?n:null};
function osm(file){
  const json=JSON.parse(fs.readFileSync(file,'utf8'));
  const nodes=new Map(),ways=new Map(),rels=[];
  for(const e of json.elements||[]){if(e.type==='node')nodes.set(e.id,e);else if(e.type==='way')ways.set(e.id,e);else if(e.type==='relation')rels.push(e)}
  // `out body` (node references) and `out geom` (inline geometry) are both accepted
  const coords=w=>Array.isArray(w.geometry)?w.geometry.filter(Boolean).map(n=>[n.lon,n.lat]):(w.nodes||[]).map(id=>nodes.get(id)).filter(Boolean).map(n=>[n.lon,n.lat]);
  const closed=c=>c.length>3&&Math.hypot(c[0][0]-c.at(-1)[0],c[0][1]-c.at(-1)[1])<1e-9;
  const [w0,s0,e0,n0]=region.bboxLonLat;
  const inBox=c=>c.some(([lon,lat])=>lon>=w0&&lon<=e0&&lat>=s0&&lat<=n0);
  // buildings: closed ways + multipolygon outers
  const shapes=[];
  const isB=t=>t&&(t.building||t['building:part']);
  for(const w of ways.values())if(isB(w.tags)){const c=coords(w);if(closed(c))shapes.push({id:'w'+w.id,tags:w.tags,ring:c})}
  for(const r of rels)if(isB(r.tags)&&r.tags.type==='multipolygon')for(const m of r.members||[])if(m.type==='way'&&m.role==='outer'){const w=ways.get(m.ref)||m;const c=coords(w);if(closed(c))shapes.push({id:'r'+r.id+'/'+m.ref,tags:{...(w.tags||{}),...r.tags},ring:c})}
  let estimated=0;
  const buildings=shapes.filter(s=>s.ring.length>3&&inBox(s.ring)).map(s=>{
    const t=s.tags;let height=metres(t.height),est=false;
    if(!height&&metres(t['building:levels']))height=metres(t['building:levels'])*3.2+(t.roof?.match?.(/gabled|hipped/)?2:0);
    if(!height){height=TYPE_HEIGHT[t.building]||TYPE_HEIGHT[t['building:part']]||TYPE_HEIGHT.yes;est=true;estimated++}
    const minH=metres(t.min_height)||0;
    const ring=s.ring.slice(0,-1).map(([lon,lat])=>local(lon,lat).map(v=>round(v,2)));
    return {id:s.id,name:t.name||null,type:t.building||('part:'+t['building:part']),height:round(height),minHeight:minH||undefined,estimated:est||undefined,ring};
  });
  // ground: roads/paths/parks/green
  const keep=t=>t&&(t.highway||/^(park|garden|pitch)$/.test(t.leisure||'')||/^(grass|forest|meadow|recreation_ground|cemetery)$/.test(t.landuse||'')||/^(wood|scrub|grassland)$/.test(t.natural||''));
  const features=[];
  for(const w of ways.values())if(keep(w.tags)){const c=coords(w);if(c.length>1&&inBox(c))features.push({id:w.id,tags:w.tags,coordinates:c.map(([a,b])=>[round(a,7),round(b,7)])})}
  for(const f of features)if(!f.tags.highway){const t=f.tags;f.tags={...t,landuse:t.landuse||(t.natural==='wood'?'forest':'grass')}}
  // landmarks by name
  const centroid=c=>[c.reduce((s,p)=>s+p[0],0)/c.length,c.reduce((s,p)=>s+p[1],0)/c.length];
  const named=[];
  for(const n of nodes.values())if(n.tags?.name)named.push({name:n.tags.name,tags:n.tags,lon:n.lon,lat:n.lat,kind:'node',id:n.id});
  for(const w of ways.values())if(w.tags?.name){const c=coords(w);if(c.length){const [lon,lat]=centroid(c);named.push({name:w.tags.name,tags:w.tags,lon,lat,kind:'way',id:w.id})}}
  for(const r of rels)if(r.tags?.name){const c=(r.members||[]).filter(m=>m.type==='way').flatMap(m=>coords(ways.get(m.ref)||m));if(c.length){const [lon,lat]=centroid(c);named.push({name:r.tags.name,tags:r.tags,lon,lat,kind:'relation',id:r.id})}}
  const find=re=>named.filter(n=>re.test(n.name));
  const WANT=[
    {id:'anit-blok',name:'Anıtkabir · Anıt Blok',distance:230,re:/^(Mustafa Kemal Atatürk Türbesi|Anıt ?Blok)$/i,prefer:t=>t.building},
    {id:'aslanli-yol',name:'Aslanlı Yol',distance:300,re:/^Aslanlı Yol$/i},
    {id:'istiklal-hurriyet',name:'İstiklal ve Hürriyet kuleleri',distance:160,re:/^İstiklal Kulesi$/i},
    {id:'inonu-lahdi',name:'İsmet İnönü Lahdi',distance:150,re:/^İsmet İnönü Lahdi$/i},
    {id:'baris-parki',name:'Anıtkabir · Barış Parkı',distance:650,re:/^Anıtkabir$/i,prefer:t=>t.leisure==='park'},
  ];
  const landmarks=[];
  for(const want of WANT){const hits=find(want.re);if(!hits.length){report.push(`Bulunamadı: ${want.name}`);continue}
    const best=hits.find(h=>want.prefer?.(h.tags))||hits.find(h=>h.kind!=='node')||hits[0];
    const [x,z]=local(best.lon,best.lat);landmarks.push({id:want.id,name:want.name,distance:want.distance,lon:round(best.lon,7),lat:round(best.lat,7),x:round(x),z:round(z),osm:`${best.kind}/${best.id}`})}
  const tandogan=find(/Tandoğan/i).map(t=>`${t.name} (${t.kind}/${t.id}) ${t.lat.toFixed(5)}, ${t.lon.toFixed(5)}`);
  const stamp=json.osm3s?.timestamp_osm_base||null;
  const meta={source:'OpenStreetMap contributors',license:'ODbL-1.0',sourceUrl:'https://www.openstreetmap.org/copyright',timestamp:stamp};
  fs.writeFileSync(path.join(OUT,'buildings.json'),JSON.stringify({...meta,heightNote:'height/building:levels tags; otherwise a type-based estimate (estimated: true)',buildings}));
  fs.writeFileSync(path.join(OUT,'ground.json'),JSON.stringify({...meta,bounds:region.bboxLonLat,features}));
  fs.writeFileSync(path.join(OUT,'landmarks.json'),JSON.stringify({...meta,landmarks},null,1));
  report.push(`OSM tarihi: ${stamp||'bilinmiyor'}`,`Binalar: ${buildings.length} (yüksekliği tahmini: ${estimated})`,`Zemin öğeleri: ${features.length}`,`Simge noktaları: ${landmarks.map(l=>l.name+' '+l.osm).join(' · ')||'yok'}`,'Tandoğan adlı OSM öğeleri:',...tandogan.slice(0,15).map(s=>'  '+s));
}

if(args.dem)await terrain(args.dem);else report.push('Arazi: --dem verilmedi, terrain.json yazılmadı.');
if(args.osm)osm(args.osm);else report.push('OSM: --osm verilmedi.');
fs.writeFileSync(path.join(OUT,'report.txt'),report.join('\n')+'\n');
console.log(report.join('\n'));
