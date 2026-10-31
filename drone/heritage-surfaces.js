import * as T from 'three';

// Original procedural surfaces in local metres. No downloaded photos, service
// requests, global lighting changes or changes to the surrounding city/terrain.
export function heritageMaterial(kind,color){
  const roof=kind==='lead';
  const m=new T.MeshStandardMaterial({color,roughness:roof?.66:.92,metalness:roof?.24:0});
  m.name='heritage_'+kind;
  // Retain our custom shader when the world batches ordinary untextured meshes.
  m.envMapIntensity=.9;
  m.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 hPosition;\nvarying vec3 hNormal;\n'+(roof?'attribute vec3 roofOrigin;\nvarying vec3 hRoofOrigin;\n':'')+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhPosition=position; hNormal=normal;'+(roof?'hRoofOrigin=roofOrigin;':''));
    shader.fragmentShader=`varying vec3 hPosition;
varying vec3 hNormal;
${roof?'varying vec3 hRoofOrigin;':''}
float hHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float hLine(float p,float width){float d=abs(fract(p+.5)-.5);float aa=max(fwidth(p),.002);return 1.0-smoothstep(width,width+aa,d);}
`+shader.fragmentShader;
    const stone=`
vec3 hn=abs(normalize(hNormal));
vec2 hp=hn.x>hn.z?hPosition.zy:hPosition.xy;
if(hn.y>.8)hp=hPosition.xz;
float row=floor(hp.y/.44);
vec2 masonry=vec2(hp.x/1.05+mod(row,2.0)*.5,hp.y/.44);
float joints=max(hLine(masonry.x,.008),hLine(masonry.y,.012));
float block=hHash(floor(masonry));
float grain=sin(hPosition.x*43.0+hPosition.z*27.0)*sin(hPosition.y*37.0);
float weather=.975+.025*sin(hPosition.x*.4+hPosition.z*.27)*sin(hPosition.y*.36);
diffuseColor.rgb*=mix(.94,1.055,block)*weather*(1.0-joints*.16)+grain*.008;
`;
    const lead=`
vec3 rel=hPosition-hRoofOrigin;
float r=max(length(rel.xz),.2);
float strips=max(12.0,floor(hRoofOrigin.y));
float a=atan(rel.z,rel.x)/6.28318530718;
float seam=hLine(a*strips,.023)*smoothstep(.3,1.0,r);
float crossSeam=hLine(hPosition.y/1.35,.005)*.35;
if(hRoofOrigin.y<.5){seam=hLine(hPosition.x/.85,.018);crossSeam=hLine(hPosition.z/2.7,.006)*.4;}
float patina=.975+.025*sin(hPosition.x*1.3+hPosition.z*.9)*sin(hPosition.y*2.1);
diffuseColor.rgb*=patina*(1.0-.23*seam-.13*crossSeam);
`;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+(roof?lead:stone));
  };
  m.customProgramCacheKey=()=>`heritage-surface-v1-${kind}`;
  return m;
}

// Weld positions to discover independent roof shells. Keep their vertices and
// silhouette intact; average curved-shell normals across exporter UV seams.
export function finishRoofGeometry(source){
  const g=source.index?source.toNonIndexed():source.clone(),p=g.attributes.position;
  const count=p.count,parent=Array.from({length:count},(_,i)=>i),seen=new Map();
  function root(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
  const join=(a,b)=>{parent[root(a)]=root(b);};
  const key=i=>`${Math.round(p.getX(i)*1000)},${Math.round(p.getY(i)*1000)},${Math.round(p.getZ(i)*1000)}`;
  for(let i=0;i<count;i++){const k=key(i);if(seen.has(k))join(i,seen.get(k));else seen.set(k,i);}
  for(let i=0;i<count;i+=3){join(i,i+1);join(i,i+2);}
  const groups=new Map();for(let i=0;i<count;i++){const k=root(i);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}
  const origins=new Float32Array(count*3),normal=g.attributes.normal;
  let curved=0;
  for(const indices of groups.values()){
    let minY=Infinity,maxY=-Infinity,minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
    for(const i of indices){minY=Math.min(minY,p.getY(i));maxY=Math.max(maxY,p.getY(i));minX=Math.min(minX,p.getX(i));maxX=Math.max(maxX,p.getX(i));minZ=Math.min(minZ,p.getZ(i));maxZ=Math.max(maxZ,p.getZ(i));}
    const top=indices.filter(i=>p.getY(i)>maxY-.015),cx=top.reduce((s,i)=>s+p.getX(i),0)/top.length,cz=top.reduce((s,i)=>s+p.getZ(i),0)/top.length;
    const radius=Math.max(maxX-minX,maxZ-minZ)*.5,h=maxY-minY;
    const isDome=radius>.7&&h>.3&&h<radius*1.5;
    const strips=h<.3?0:Math.max(12,Math.round(radius*2*Math.PI/.85));
    for(const i of indices){origins[i*3]=cx;origins[i*3+1]=strips;origins[i*3+2]=cz;}
    if(!isDome||!normal)continue;
    curved++;
    const sums=new Map();
    // Area-weighted outward normals after roof winding repair.
    for(let j=0;j<indices.length;j+=3){const i=indices[j],a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+1),c=new T.Vector3().fromBufferAttribute(p,i+2);const n=b.sub(a).cross(c.sub(a));
      for(let k=i;k<i+3;k++){const id=key(k);if(!sums.has(id))sums.set(id,new T.Vector3());sums.get(id).add(n);}
    }
    for(const i of indices){const n=sums.get(key(i)).normalize();normal.setXYZ(i,n.x,n.y,n.z);}
  }
  g.setAttribute('roofOrigin',new T.BufferAttribute(origins,3));g.userData.curvedRoofs=curved;
  g.computeBoundingSphere();return g;
}

export function refineHeritageSurfaces(object,id){
  const palette={ayasofya:0xc2af96,sultanahmet:0xbcb8a8,suleymaniye:0xc3bdae,yeni_cami:0xbab3a2,topkapi:0xc4bba6};
  const stone=heritageMaterial('limestone',palette[id]||0xbcb5a6),lead=heritageMaterial('lead',0x7b8588);
  let roofs=0;
  object.traverse(o=>{
    if(!o.isMesh||Array.isArray(o.material))return;
    if(o.name.endsWith('_lead')){o.geometry=finishRoofGeometry(o.geometry);o.material=lead;roofs+=o.geometry.userData.curvedRoofs;}
    else if(o.name.endsWith('_stone_plain'))o.material=stone;
    else if(id!=='topkapi'&&(o.name.endsWith('_stone')||o.name.endsWith('_wall')))o.material=stone;
    else if(id==='ayasofya'&&o.name.endsWith('_ochre')){
      // Preserve the original arched-window atlas; reduce the yellow cast.
      const m=o.material.clone();m.color.set(0xdac7b7);m.roughness=.94;o.material=m;
    }
    else if(id==='topkapi'&&(o.name.endsWith('_white')||o.name.endsWith('_stone'))){
      const m=o.material.clone();m.color.set(0xd8d1be);m.roughness=.92;o.material=m;
    }
  });
  object.userData.curvedHeritageRoofs=roofs;
  return {stone,lead};
}
