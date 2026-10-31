import * as T from 'three';
import {lonLatToLocal} from '../src/geo.js';

// Geographic ways from OSM; rendering widths/materials are illustrative. No photo tiles or remote map API calls.
export async function addHeritageGround({world,renderer,url='data/ist/heritage-ground.json'}){
  const response=await fetch(url);
  if(!response.ok)throw Error('Zemin verisi '+response.status);
  const data=await response.json();
  const [west,south,east,north]=data.bounds;
  const corners=[[west,south],[west,north],[east,south],[east,north]].map(p=>lonLatToLocal(...p));
  const x0=Math.min(...corners.map(p=>p.x)),z0=Math.min(...corners.map(p=>p.z));
  const width=Math.max(...corners.map(p=>p.x))-x0,height=Math.max(...corners.map(p=>p.z))-z0;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=2048;
  const c=canvas.getContext('2d');
  const sx=2048/width,sz=2048/height;
  c.scale(sx,sz);c.translate(-x0,-z0);c.lineCap='round';c.lineJoin='round';
  const features=data.features.map(f=>({...f,points:f.coordinates.map(p=>lonLatToLocal(...p))}));
  const path=f=>{c.beginPath();f.points.forEach((p,i)=>i?c.lineTo(p.x,p.z):c.moveTo(p.x,p.z))};
  let greens=0,roads=0;
  for(const f of features){
    if(f.tags.highway)continue;
    const a=f.points[0],b=f.points.at(-1);
    if(Math.hypot(a.x-b.x,a.z-b.z)>1)continue; // do not fill unclosed/multipolygon fragments
    path(f);c.closePath();c.fillStyle=f.tags.landuse==='forest'?'#536344':'#778361';c.globalAlpha=.68;c.fill();greens++;
  }
  const widths={trunk:10,primary:9,secondary:8,tertiary:7,residential:5.5,unclassified:5,service:4,pedestrian:6,living_street:4.5,footway:2.5,path:1.8,cycleway:2.2,track:3};
  const ways=features.filter(f=>f.tags.highway in widths);
  // All curbs first, then surfaces: intersections stay continuous.
  for(const border of [true,false])for(const f of ways){
    const pedestrian=/^(footway|path|pedestrian|cycleway)$/.test(f.tags.highway);
    const width=Math.max(1,Math.min(18,parseFloat(f.tags.width)||widths[f.tags.highway]));
    path(f);
    if(f.tags.area==='yes'){if(!border){c.closePath();c.globalAlpha=.87;c.fillStyle='#b0a48e';c.fill()}continue}
    c.globalAlpha=border?.76:.90;c.lineWidth=width+(border?1.2:0);
    c.strokeStyle=border?'#ada799':pedestrian?'#b0a48e':'#66645f';c.stroke();
    if(!border)roads++;
  }
  const texture=new T.CanvasTexture(canvas);texture.flipY=false;texture.colorSpace=T.SRGBColorSpace;
  texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const shared=world.terrain.shared;
  shared.uGroundTex.value=texture;
  shared.uGroundXform.value.set(1/width,1/height,-x0/width,-z0/height);
  shared.uGroundEnabled.value=1;
  return {roads,greens,source:'OSM',timestamp:data.timestamp};
}
