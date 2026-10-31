import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tilePosition,imageWindow,imageTransform} from '../drone/imagery-geo.js';
import {setGeoRegion,lonLatToLocal,localToLonLat} from '../src/geo.js';
import {createUtm} from '../src/maps/utm.js';
import {createAerialImagery} from '../drone/imagery.js';
const region=JSON.parse(fs.readFileSync(new URL('../data/ist/region.json',import.meta.url)));
setGeoRegion(region,createUtm(region.crs));

test('Mercator tile axes and equatorial reference match the XYZ convention',()=>{
  assert.deepEqual(tilePosition(0,0,1),{x:1,y:1});
  assert(tilePosition(29,42,17).y<tilePosition(29,41,17).y);
  assert(tilePosition(30,41,17).x>tilePosition(29,41,17).x);
});
test('Istanbul photo sampling accounts for UTM rotation within one display pixel',()=>{
  for(const [lon,lat] of [[28.98,41.0086],[28.984,41.012],[28.963,41.016],[29.0066,41.02]]){
    const center=lonLatToLocal(lon,lat),plan=imageWindow(lon,lat);
    const transform=imageTransform(plan,center,localToLonLat);
    for(const dx of [-850,0,850])for(const dz of [-850,0,850]){
      const x=center.x+dx,z=center.z+dz,g=localToLonLat(x,z),exact=tilePosition(g.lon,g.lat,plan.zoom);
      const u=transform.u[0]*x+transform.u[1]*z+transform.u[2];
      const v=transform.v[0]*x+transform.v[1]*z+transform.v[2];
      const pixels=Math.hypot(u-(exact.x-plan.x)/plan.size,v-(exact.y-plan.y)/plan.size)*plan.size*256;
      assert(pixels<1,`Photo alignment error ${pixels} pixels at ${lon}, ${lat}`);
    }
  }
});
test('Photo windows keep their centre inside a bounded 64-tile footprint',()=>{
  const plan=imageWindow(28.98,41.01),p=tilePosition(28.98,41.01,17);
  assert.equal(plan.size**2,64);
  assert(p.x>=plan.x+4&&p.x<plan.x+5);
  assert(p.y>=plan.y+4&&p.y<plan.y+5);
});
test('Missing credentials make no ArcGIS requests and preserve the existing terrain',async()=>{
  const original=globalThis.fetch,requests=[];
  try{
    globalThis.fetch=async url=>{requests.push(url);return {ok:true,json:async()=>({apiKey:''})}};
    assert.equal(await createAerialImagery({}),null);
    assert.deepEqual(requests,['data/ist/imagery.json']);
  }finally{globalThis.fetch=original}
});
test('Rejected credentials stop the tile queue and do not retry each animation frame',async()=>{
  const originalFetch=globalThis.fetch,originalDocument=globalThis.document;
  let requests=0;const states=[];
  const world={terrain:{shared:{uPhotoEnabled:{value:0}}}};
  const renderer={capabilities:{maxTextureSize:2048,getMaxAnisotropy:()=>8}};
  try{
    globalThis.document={hidden:false,createElement:()=>({getContext:()=>({clearRect(){},drawImage(){}})})};
    globalThis.fetch=async url=>{
      if(url==='data/ist/imagery.json')return {ok:true,json:async()=>({apiKey:'test-placeholder-not-a-real-key'})};
      requests++;return {ok:false,status:401};
    };
    const imagery=await createAerialImagery({world,renderer,onState:s=>states.push(s.status)});
    const point=lonLatToLocal(28.98,41.01);
    imagery.update(2000,point);
    await new Promise(resolve=>setImmediate(resolve));
    const first=requests;
    for(let n=3;n<100;n++)imagery.update(n*1000,point);
    assert(first>0&&first<=4);
    assert.equal(requests,first);
    assert.equal(world.terrain.shared.uPhotoEnabled.value,0);
    assert(states.includes('unavailable'));
    imagery.dispose();
  }finally{globalThis.fetch=originalFetch;globalThis.document=originalDocument}
});

test('Loaded imagery covers the atlas and reuses overlapping tiles when the camera moves',async()=>{
  const saved={fetch:globalThis.fetch,document:globalThis.document,bitmap:globalThis.createImageBitmap};
  let requests=0,draws=0,closed=0;const states=[];
  const shared={uPhotoEnabled:{value:0},uPhotoTex:{value:null},uPhotoU:{value:{fromArray(){}}},uPhotoV:{value:{fromArray(){}}}};
  try{
    globalThis.document={hidden:false,createElement:()=>({getContext:()=>({clearRect(){},drawImage(){draws++}})})};
    globalThis.createImageBitmap=async()=>({close(){closed++}});
    globalThis.fetch=async url=>{
      if(url==='data/ist/imagery.json')return {ok:true,json:async()=>({apiKey:'test-placeholder'})};
      requests++;return {ok:true,headers:{get:()=> 'image/jpeg'},blob:async()=>({})};
    };
    const imagery=await createAerialImagery({world:{terrain:{shared}},renderer:{capabilities:{maxTextureSize:2048,getMaxAnisotropy:()=>8}},onState:s=>states.push(s)});
    imagery.update(2000,lonLatToLocal(28.98,41.01));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(requests,64);assert.equal(draws,64);assert.equal(shared.uPhotoEnabled.value,1);
    assert.equal(states.at(-1).status,'ready');
    imagery.update(3000,lonLatToLocal(28.98,41.01));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(requests,64);
    imagery.update(4000,lonLatToLocal(28.98+360/2**17,41.01));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(requests,72);assert.equal(draws,128);
    imagery.dispose();assert.equal(closed,72);assert.equal(shared.uPhotoEnabled.value,0);
  }finally{globalThis.fetch=saved.fetch;globalThis.document=saved.document;globalThis.createImageBitmap=saved.bitmap}
});
