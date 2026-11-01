import {pointInRing,distanceToRing} from './area.js';
import {searchRoute} from './night-state.js';
import {validRoute} from './sim.js';

// The person must be inside an OSM grass/meadow/park polygon, away from its edges and buildings.
// A park tag alone does not certify that an area is safe for real operations.
export function searchAreas(data,toLocal){
  return (data?.features||[]).filter(f=>{
    const t=f.tags||{},c=f.coordinates;
    return !t.highway&&!t.building&&!['forest','cemetery'].includes(t.landuse)&&t.natural!=='wood'&&
      (['grass','meadow','recreation_ground'].includes(t.landuse)||['park','garden'].includes(t.leisure))&&
      c?.length>3&&Math.hypot(c[0][0]-c.at(-1)[0],c[0][1]-c.at(-1)[1])<1e-8;
  }).map(f=>({id:f.id,name:f.tags.name||'OSM yeşil alanı',ring:f.coordinates.map(([lon,lat])=>{const p=toLocal(lon,lat);return [p.x,p.z]})}));
}
export function chooseSearchPoint(world,home){
  const areas=(world.searchAreas||[]).map(area=>{
    const xs=area.ring.map(p=>p[0]),zs=area.ring.map(p=>p[1]);
    const box={minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
    return {...area,...box,distance:Math.hypot((box.minX+box.maxX)/2-home.x,(box.minZ+box.maxZ)/2-home.z)};
  }).sort((a,b)=>a.distance-b.distance||String(a.id).localeCompare(String(b.id)));
  for(const area of areas){
    const candidates=[[(area.minX+area.maxX)/2,(area.minZ+area.maxZ)/2]];
    for(let x=Math.max(area.minX,home.x-1800)+8;x<Math.min(area.maxX,home.x+1800);x+=20)
      for(let z=Math.max(area.minZ,home.z-1800)+8;z<Math.min(area.maxZ,home.z+1800);z+=20)candidates.push([x,z]);
    for(const [x,z] of candidates){
      const p={x,z},y=world.getGroundHeight(x,z);
      if(Math.hypot(x-home.x,z-home.z)<150||!pointInRing(x,z,area.ring)||distanceToRing(x,z,area.ring)<5||
        !Number.isFinite(y)||!validRoute(searchRoute(p),home))continue;
      const clear=[[0,0],[-3,0],[3,0],[0,-3],[0,3]].every(([dx,dz])=>{
        const h=world.getGroundHeight(x+dx,z+dz),obstacle=world.getObstacleHeight(x+dx,z+dz);
        return Number.isFinite(h)&&Math.abs(h-y)<=.7&&!world.isWater(x+dx,z+dz)&&obstacle<=h+.2&&!world.hitTest(x+dx,h+1,z+dz,.4);
      });
      if(clear)return {...p,y,areaId:area.id,areaName:area.name};
    }
  }
  return null;
}
