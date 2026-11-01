// Local-metre polygons from the packaged OSM extract. These are scenery areas, not flight restrictions.
export function pointInRing(x,z,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,zi]=ring[i],[xj,zj]=ring[j];
    if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside;
  }
  return inside;
}
export function distanceToRing(x,z,ring){
  let distance=Infinity;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [ax,az]=ring[j],[bx,bz]=ring[i],dx=bx-ax,dz=bz-az,length=dx*dx+dz*dz;
    const t=length?Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/length)):0;
    distance=Math.min(distance,Math.hypot(x-ax-t*dx,z-az-t*dz));
  }
  return distance;
}
