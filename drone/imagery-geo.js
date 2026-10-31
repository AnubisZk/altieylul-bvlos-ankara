const DEG=Math.PI/180;
export function tilePosition(lon,lat,zoom){
  const n=2**zoom,s=Math.sin(Math.max(-85.05112878,Math.min(85.05112878,lat))*DEG);
  return {x:(lon+180)/360*n,y:(.5-Math.log((1+s)/(1-s))/(4*Math.PI))*n};
}
export function imageWindow(lon,lat,{zoom=17,size=8}={}){
  const p=tilePosition(lon,lat,zoom);
  const x=Math.floor(p.x)-size/2,y=Math.floor(p.y)-size/2;
  return {x,y,zoom,size,id:`${zoom}/${x}/${y}/${size}`};
}
// A local affine Mercator transform includes UTM grid convergence. Approximation
// is limited to the ~1.85 km image window, never the whole Istanbul region.
export function imageTransform(plan,center,inverse){
  const at=(x,z)=>{const p=inverse(x,z),t=tilePosition(p.lon,p.lat,plan.zoom);return {u:(t.x-plan.x)/plan.size,v:(t.y-plan.y)/plan.size}};
  const c=at(center.x,center.z),px=at(center.x+50,center.z),pz=at(center.x,center.z+50);
  const ux=(px.u-c.u)/50,uz=(pz.u-c.u)/50,vx=(px.v-c.v)/50,vz=(pz.v-c.v)/50;
  return {u:[ux,uz,c.u-ux*center.x-uz*center.z],v:[vx,vz,c.v-vx*center.x-vz*center.z]};
}
