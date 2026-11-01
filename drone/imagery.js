import * as T from 'three';
import {localToLonLat} from '../src/geo.js';
import {imageWindow,imageTransform} from './imagery-geo.js';

const SERVICE='https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer';
// Session-memory cache only. No offline export, tile bundling or server-side cache.
export async function createAerialImagery({world,renderer,url='data/ist/imagery.json',bounds=[28.945,40.995,29.035,41.042],onState=()=>{}}){
  const response=await fetch(url);
  if(!response.ok){onState({status:'unavailable'});return null;}
  const config=await response.json();
  if(!config.apiKey){onState({status:'disabled'});return null;}
  const zoom=17,size=8,pixels=256;
  if(renderer.capabilities.maxTextureSize<size*pixels)return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size*pixels;
  const context=canvas.getContext('2d');
  const texture=new T.CanvasTexture(canvas);texture.flipY=false;texture.colorSpace=T.SRGBColorSpace;
  texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const cache=new Map(),controller=new AbortController();
  let busy=false,stopped=false,last=0,shown='',requests=0;
  const shared=world.terrain.shared;
  const state=(status,extra={})=>onState({status,requests,...extra});
  async function tile(x,y){
    const id=`${zoom}/${y}/${x}`;
    if(cache.has(id)){const bitmap=cache.get(id);cache.delete(id);cache.set(id,bitmap);return bitmap}
    if(stopped)return null;
    const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),15000);
    const abort=()=>timeout.abort();controller.signal.addEventListener('abort',abort,{once:true});
    try{
      requests++;
      const url=`${SERVICE}/tile/${id}?token=${encodeURIComponent(config.apiKey)}`;
      const r=await fetch(url,{signal:timeout.signal});
      if(!r.ok||!r.headers.get('content-type')?.startsWith('image/')){
        // Authentication and quota failures stop subsequent requests this session.
        stopped=true;state('unavailable');return null;
      }
      const bitmap=await createImageBitmap(await r.blob());
      cache.set(id,bitmap);return bitmap;
    }catch{stopped=true;if(!controller.signal.aborted)state('unavailable');return null}
    finally{clearTimeout(timer);controller.signal.removeEventListener('abort',abort)}
  }
  async function load({plan,center}){
    busy=true;state('loading');
    const jobs=[];
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)jobs.push({x,y});
    // Prioritize the visible centre. At most four network requests at a time.
    jobs.sort((a,b)=>Math.hypot(a.x-size/2,a.y-size/2)-Math.hypot(b.x-size/2,b.y-size/2));
    const results=[];let index=0;
    await Promise.all(Array.from({length:4},async()=>{while(index<jobs.length&&!stopped){const job=jobs[index++];const bitmap=await tile(plan.x+job.x,plan.y+job.y);if(bitmap)results.push({...job,bitmap})}}));
    if(!controller.signal.aborted&&results.length){
      context.clearRect(0,0,canvas.width,canvas.height);
      for(const {x,y,bitmap} of results)context.drawImage(bitmap,x*pixels,y*pixels,pixels,pixels);
      const transform=imageTransform(plan,center,localToLonLat);
      shared.uPhotoU.value.fromArray(transform.u);shared.uPhotoV.value.fromArray(transform.v);
      shared.uPhotoTex.value=texture;texture.needsUpdate=true;shared.uPhotoEnabled.value=1;
      shown=plan.id;state(results.length===size*size?'ready':'partial',{tiles:results.length,zoom});
    }
    // Evict only after the atlas has been drawn, avoiding closed bitmaps in flight.
    while(cache.size>128){const [id,bitmap]=cache.entries().next().value;bitmap.close();cache.delete(id)}
    busy=false;
  }
  return {
    update(now,focus){
      if(stopped||document.hidden||now-last<1000)return;
      last=now;const g=localToLonLat(focus.x,focus.z);
      // Only the school lesson area: no unconstrained global imagery navigation.
      if(g.lon<bounds[0]||g.lon>bounds[2]||g.lat<bounds[1]||g.lat>bounds[3])return;
      const plan=imageWindow(g.lon,g.lat,{zoom,size});
      if(!busy&&plan.id!==shown)load({plan,center:{x:focus.x,z:focus.z}}).catch(()=>{busy=false;stopped=true;state('unavailable')});
    },
    dispose(){stopped=true;controller.abort();shared.uPhotoEnabled.value=0;texture.dispose();for(const b of cache.values())b.close();cache.clear()},
  };
}
