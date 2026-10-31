import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {repairRoofWinding} from './roof-repair.js';
import {refineHeritageSurfaces} from './heritage-surfaces.js';

// Stylized exterior relief, based on the existing model's local wall dimensions.
// This is educational scenery, not a measured architectural reconstruction.
export function decorateHeritage(object,def){
  if(object.userData.heritageDetailed)return;
  object.userData.repairedRoofTriangles=repairRoofWinding(object,def.id);
  const {stone}=refineHeritageSurfaces(object,def.id);
  if(def.id==='topkapi'){object.userData.heritageDetailed=true;return;} // Keep individually grounded buildings intact.
  const recess=new T.MeshStandardMaterial({color:0x172020,roughness:.62,metalness:.12});
  const iron=new T.MeshStandardMaterial({color:0x555247,roughness:.82,metalness:.25});
  const trim=[],glass=[],bars=[],ledges=[];
  const transform=new T.Matrix4();
  function arch(width,height){const r=width/2,s=new T.Shape();s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,height-r);s.absarc(0,height-r,r,0,Math.PI,false);s.lineTo(-r,0);return new T.ShapeGeometry(s,10)}
  function add(g,list,x,y,z,angle,depth=0){if(g.index){const original=g;g=g.toNonIndexed();original.dispose();}transform.makeRotationY(angle);transform.setPosition(x+Math.sin(angle)*depth,y,z+Math.cos(angle)*depth);g.applyMatrix4(transform);list.push(g)}
  function window(x,y,z,angle,w=1.55,h=3.5){
    // Extruded archivolt: separate dark reveal, carved surround, sill and grille.
    const outline=(width,height)=>{const r=width/2,s=new T.Shape();s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,height-r);s.absarc(0,height-r,r,0,Math.PI,false);s.lineTo(-r,0);return s;};
    const frame=outline(w+.42,h+.21),hole=outline(w,h);frame.holes.push(new T.Path(hole.getPoints(8)));
    add(new T.ExtrudeGeometry(frame,{depth:.18,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.025,bevelThickness:.025,curveSegments:8}),trim,x,y,z,angle,.03);
    add(arch(w,h),glass,x,y,z,angle,.018);
    add(new T.BoxGeometry(w+.6,.18,.43),trim,x,y-.07,z,angle,.09);
    for(const offset of [-w*.25,0,w*.25])add(new T.BoxGeometry(.045,h*.71,.035).translate(offset,h*.355,0),bars,x,y,z,angle,.085);
    for(const level of [.24,.47,.7])add(new T.BoxGeometry(w,.04,.035).translate(0,h*level,0),bars,x,y,z,angle,.085);
  }
  function cornice(cx,cz,hx,hz,y){
    for(const [dy,depth,height] of [[0,.32,.16],[.2,.48,.18],[.42,.6,.14]]){
      add(new T.BoxGeometry(hx*2+depth*2,height,depth),ledges,cx,y+dy,cz+hz,0,depth*.45);
      add(new T.BoxGeometry(hx*2+depth*2,height,depth),ledges,cx,y+dy,cz-hz,Math.PI,depth*.45);
      add(new T.BoxGeometry(hz*2,height,depth),ledges,cx+hx,y+dy,cz,Math.PI/2,depth*.45);
      add(new T.BoxGeometry(hz*2,height,depth),ledges,cx-hx,y+dy,cz,-Math.PI/2,depth*.45);
    }
  }
  function facade(cx,cz,hx,hz,rows,spacing=5){
    for(const y of rows){
      for(let x=-hx+4;x<=hx-4;x+=spacing){window(cx+x,y,cz+hz+.09,0);window(cx+x,y,cz-hz-.09,Math.PI)}
      for(let z=-hz+4;z<=hz-4;z+=spacing){window(cx+hx+.09,y,cz+z,Math.PI/2);window(cx-hx-.09,y,cz+z,-Math.PI/2)}
    }
  }
  if(def.id==='ayasofya'){
    facade(0,0,33,38,[16],6);
    facade(0,0,16.6,16.6,[27,34],5.5);
    cornice(0,0,33,38,22.05);
    cornice(0,0,16.6,16.6,40.0);
  }else{
    const hall=def.collision.find(p=>p.t==='box');
    if(!hall){stone.dispose();recess.dispose();return}
    facade(hall.c[0],hall.c[2],hall.h[0],hall.h[2],hall.c[1]+hall.h[1]>23?[5,12,19]:[4,11],5.5);
    cornice(hall.c[0],hall.c[2],hall.h[0],hall.h[2],hall.c[1]+hall.h[1]-.7);
  }
  const group=new T.Group();group.name='Heritage arched window relief';
  for(const [parts,material]of [[trim,stone],[glass,recess],[bars,iron],[ledges,stone]]){
    if(!parts.length)continue;
    const geometry=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());
    group.add(new T.Mesh(geometry,material));
  }
  object.add(group);
  object.userData.heritageTriangles=group.children.reduce((sum,o)=>sum+(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3,0);
  object.userData.heritageDetailed=true;
}
