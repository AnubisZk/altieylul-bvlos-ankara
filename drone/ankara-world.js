// Ankara · Anıtkabir world: a compact, self-contained replacement for src/world-sf/index.js createSFWorld.
// It offers the same narrow API the drone layer uses (getGroundHeight, getObstacleHeight, isWater, hitTest, update,
// setPlayable, terrain.shared photo/ground uniforms, landmarks, environment) without the upstream İstanbul tile
// pipeline or the R2 asset server. All data comes from this site's data/ank/ directory:
//   region.json     map frame (UTM 36N, origin Anıt Blok), start point, fallback elevation
//   terrain.json    optional Copernicus GLO-30 height grid in local metres (tools/ankara/prepare-data.mjs)
//   buildings.json  optional OSM building footprints in local metres with estimated heights
//   landmarks.json  optional heritage view targets
// Missing optional files are not errors: the world shows a flat stand-in and reports it in `sources`.
import * as T from 'three';
import {setGeoRegion,lonLatToLocal} from '../src/geo.js';
import {createUtm} from '../src/maps/utm.js';
import {createEnvironment} from '../src/world-sf/environment.js';
import {searchAreas} from './search-site.js';
import {pointInRing,distanceToRing} from './area.js';

export const ANK_DATA='data/ank/';

async function json(url,optional=false){
  const r=await fetch(url);
  if(!r.ok){if(optional&&(r.status===404||r.status===403))return null;const e=Error(`${url}: ${r.status}`);e.status=r.status;throw e}
  return r.json();
}

/** Bilinear height grid ({x0,z0,step,cols,rows,heights}) → sampler; outside the grid the edge value is held. */
export function heightSampler(grid,fallback){
  if(!grid||!Array.isArray(grid.heights)||grid.heights.length!==grid.cols*grid.rows)return ()=>fallback;
  const {x0,z0,step,cols,rows,heights}=grid;
  return (x,z)=>{
    const gx=Math.min(Math.max((x-x0)/step,0),cols-1),gz=Math.min(Math.max((z-z0)/step,0),rows-1);
    const i=Math.min(Math.floor(gx),cols-2),j=Math.min(Math.floor(gz),rows-2),fx=gx-i,fz=gz-j;
    const h=(a,b)=>heights[b*cols+a];
    return (h(i,j)*(1-fx)+h(i+1,j)*fx)*(1-fz)+(h(i,j+1)*(1-fx)+h(i+1,j+1)*fx)*fz;
  };
}

/** Building footprints with a 50 m grid index: top height at a point and sphere hit test. */
export function createObstacleIndex(buildings,ground){
  const cell=50,grid=new Map(),list=[];
  for(const b of buildings||[]){
    if(!Array.isArray(b.ring)||b.ring.length<3)continue;
    let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
    for(const [x,z] of b.ring){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z)}
    const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
    const base=Number.isFinite(b.base)?b.base:Math.min(...b.ring.map(([x,z])=>ground(x,z)),ground(cx,cz));
    const item={...b,minX,maxX,minZ,maxZ,bottom:base,top:base+Math.max(1,b.height||6)};
    list.push(item);
    for(let i=Math.floor(minX/cell);i<=Math.floor(maxX/cell);i++)for(let j=Math.floor(minZ/cell);j<=Math.floor(maxZ/cell);j++){
      const k=i+','+j;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(item);
    }
  }
  const near=(x,z)=>grid.get(Math.floor(x/cell)+','+Math.floor(z/cell))||[];
  return {
    list,
    heightAt(x,z){let h=-Infinity;for(const b of near(x,z))if(x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ&&b.top>h&&pointInRing(x,z,b.ring))h=b.top;return h},
    hitTest(x,y,z,r=0){
      for(const b of near(x,z)){
        if(y<b.bottom-r||y>b.top+r||x<b.minX-r||x>b.maxX+r||z<b.minZ-r||z>b.maxZ+r)continue;
        if(pointInRing(x,z,b.ring)||distanceToRing(x,z,b.ring)<=r)return {type:'building',id:b.id,name:b.name||null};
      }
      return null;
    },
  };
}

function terrainMaterial(shared){
  const material=new T.MeshStandardMaterial({color:0xa49d83,roughness:.96,metalness:0});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,shared);
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec3 vAnkWorld;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvAnkWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>
varying vec3 vAnkWorld;
uniform sampler2D uGroundTex;uniform vec4 uGroundXform;uniform float uGroundEnabled;
uniform sampler2D uPhotoTex;uniform vec3 uPhotoU;uniform vec3 uPhotoV;uniform float uPhotoEnabled;
float ankHash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float ankNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(ankHash(i),ankHash(i+vec2(1,0)),f.x),mix(ankHash(i+vec2(0,1)),ankHash(i+vec2(1,1)),f.x),f.y);}`)
      .replace('#include <map_fragment>',`#include <map_fragment>
{
  // gentle procedural variation so the flat stand-in still shows motion and scale
  float n=0.6*ankNoise(vAnkWorld.xz/37.0)+0.4*ankNoise(vAnkWorld.xz/9.0+17.3);
  diffuseColor.rgb*=0.9+0.16*n;
  if(uGroundEnabled>0.5){
    vec2 guv=vAnkWorld.xz*uGroundXform.xy+uGroundXform.zw;vec4 g=texture2D(uGroundTex,guv);
    vec2 e=min(guv,1.0-guv);diffuseColor.rgb=mix(diffuseColor.rgb,g.rgb,g.a*smoothstep(0.0,0.012,min(e.x,e.y)));
  }
  if(uPhotoEnabled>0.5){
    vec3 p=vec3(vAnkWorld.xz,1.0);vec2 puv=vec2(dot(uPhotoU,p),dot(uPhotoV,p));vec4 ph=texture2D(uPhotoTex,puv);
    vec2 e=min(puv,1.0-puv);diffuseColor.rgb=mix(diffuseColor.rgb,ph.rgb,ph.a*smoothstep(0.0,0.025,min(e.x,e.y)));
  }
}`);
  };
  return material;
}

function buildingMesh(index){
  if(!index.list.length)return null;
  const geos=[];
  for(const b of index.list){
    const shape=new T.Shape(b.ring.map(([x,z])=>new T.Vector2(x,-z)));
    const g=new T.ExtrudeGeometry(shape,{depth:b.top-b.bottom,bevelEnabled:false});
    g.rotateX(-Math.PI/2);g.translate(0,b.bottom,0);
    geos.push(g.index?g.toNonIndexed():g);if(g.index)g.dispose();
  }
  let count=0;for(const g of geos)count+=g.attributes.position.count;
  const pos=new Float32Array(count*3),nor=new Float32Array(count*3);let o=0;
  for(const g of geos){pos.set(g.attributes.position.array,o*3);nor.set(g.attributes.normal.array,o*3);o+=g.attributes.position.count;g.dispose()}
  // ExtrudeGeometry winds caps for a +Z extrusion; after rotateX the side faces stay outward, so normals are kept.
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));geo.setAttribute('normal',new T.BufferAttribute(nor,3));
  const mesh=new T.Mesh(geo,new T.MeshStandardMaterial({color:0xcfc6b4,roughness:.88}));
  mesh.castShadow=mesh.receiveShadow=true;mesh.name='ank-buildings';
  return mesh;
}

export async function createAnkaraWorld({scene,renderer,camera,quality=null,onProgress=()=>{}}){
  onProgress(.05,'Ankara bölge tanımı');
  const region=await json(ANK_DATA+'region.json');
  setGeoRegion(region,createUtm(region.crs));
  onProgress(.15,'Gökyüzü ve ışık');
  const environment=await createEnvironment({scene,renderer,camera,map:{id:'ank',fogBank:false},quality});
  onProgress(.35,'Arazi');
  const [grid,buildingData,landmarkData,groundData]=await Promise.all([
    json(ANK_DATA+'terrain.json',true),json(ANK_DATA+'buildings.json',true),json(ANK_DATA+'landmarks.json',true),
    json(ANK_DATA+'ground.json',true),
  ]);
  const fallback=region.fallbackElevation??880;
  const ground=heightSampler(grid,fallback);
  const sources={terrain:grid?grid.source||'GLO-30':'geçici düz zemin',buildings:buildingData?buildingData.source||'OSM':'yok',landmarks:landmarkData?'veri':'varsayılan'};

  const shared={
    uGroundTex:{value:null},uGroundXform:{value:new T.Vector4()},uGroundEnabled:{value:0},
    uPhotoTex:{value:null},uPhotoU:{value:new T.Vector3(1,0,0)},uPhotoV:{value:new T.Vector3(0,1,0)},uPhotoEnabled:{value:0},
  };
  const b=region.local,step=20;
  const cols=Math.round((b.maxX-b.minX)/step),rows=Math.round((b.maxZ-b.minZ)/step);
  const geo=new T.PlaneGeometry(b.maxX-b.minX,b.maxZ-b.minZ,cols,rows);geo.rotateX(-Math.PI/2);
  geo.translate((b.minX+b.maxX)/2,0,(b.minZ+b.maxZ)/2);
  const p=geo.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,ground(p.getX(i),p.getZ(i)));
  geo.computeVertexNormals();
  const terrainMesh=new T.Mesh(geo,terrainMaterial(shared));terrainMesh.receiveShadow=true;terrainMesh.name='ank-terrain';
  const object=new T.Group();object.name='ankara-world';object.add(terrainMesh);
  const terrain={object,shared,stats:{loaded:1},getHeight:ground,isWater:()=>false,update(){}};
  scene.add(object);

  onProgress(.6,'Binalar');
  const obstacles=createObstacleIndex(buildingData?.buildings,ground);
  const bm=buildingMesh(obstacles);if(bm)object.add(bm);
  const layers=[];

  const raw=landmarkData?.landmarks||[{id:'anit-blok',name:'Anıtkabir · Anıt Blok',lon:region.origin.lon,lat:region.origin.lat}];
  const landmarks={landmarks:raw.map(l=>{const q=Number.isFinite(l.x)?l:lonLatToLocal(l.lon,l.lat);return {...l,x:q.x,z:q.z}})};
  if(quality)environment.setQuality?.(quality);
  onProgress(1,'Hazır');
  let playable=false;
  return {
    region,environment,terrain,layers,landmarks,sources,obstacles,groundData,searchAreas:searchAreas(groundData,lonLatToLocal),
    sunDirection:environment.sunDirection,
    setQuality(q){environment.setQuality?.(q)},
    getGroundHeight:ground,
    isWater:()=>false,
    getObstacleHeight(x,z){let h=obstacles.heightAt(x,z);for(const l of layers)if(l.heightAt)h=Math.max(h,l.heightAt(x,z));return h},
    hitTest(x,y,z,r){for(const l of layers){const hit=l.hitTest?.(x,y,z,r);if(hit)return hit}return obstacles.hitTest(x,y,z,r)},
    addLayer(layer){layers.push(layer);if(layer.object)object.add(layer.object)},
    setPlayable(){playable=true},
    get playable(){return playable},
    update(dt,cam){environment.update(dt,cam);for(const l of layers)l.update?.(dt,cam)},
  };
}
