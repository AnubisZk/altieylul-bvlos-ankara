// Anıtkabir layer for drone/ankara-world.js: the optimised Meshy model placed in the map frame, its 1 m top-surface
// grid for collisions, and the square floor used as ground inside the footprint (data/ank/anitkabir.json, written by
// tools/ankara/prepare-anitkabir.mjs). Collisions with the monument never "crash" the drone: hitTest reports a
// `landmark` hit with a protective margin, and main.js stops the drone in place with a warning (no damage effects).
import * as T from 'three';

export const GUARD_MARGIN=2.5;   // metres kept between the drone and the monument
const FLOOR_BAND=2.5;            // surfaces up to floorY + 2.5 m count as walkable square / steps, not obstacles

function pointInPoly(x,z,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,zi]=poly[i],[xj,zj]=poly[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside}return inside}

/** Pure collision model of anitkabir.json (no three.js objects): used by the layer and by the tests. */
export function createMonumentField(data){
  const {x0,z0,step,cols,rows,heights}=data.grid,floorY=data.floorY,poly=data.footprint;
  const cell=(x,z)=>{const i=Math.floor((x-x0)/step+.5),j=Math.floor((z-z0)/step+.5);if(i<0||j<0||i>=cols||j>=rows)return null;return heights[j*cols+i]};
  const inside=(x,z)=>pointInPoly(x,z,poly);
  return {
    floorY,inside,
    /** Ground inside the footprint: the square floor / low steps, else the floor under buildings. */
    groundAt(x,z){if(!inside(x,z))return null;const h=cell(x,z);return h!==null&&h<=floorY+FLOOR_BAND?Math.max(h,floorY-3):floorY},
    /** Obstacle top (buildings, colonnades, Anıt Blok) or −Infinity. */
    heightAt(x,z){if(!inside(x,z))return -Infinity;const h=cell(x,z);return h!==null&&h>floorY+FLOOR_BAND?h:-Infinity},
    hitTest(x,y,z,r=0){
      const m=r+GUARD_MARGIN,n=Math.ceil(m/step);
      for(let dj=-n;dj<=n;dj++)for(let di=-n;di<=n;di++){
        const px=x+di*step,pz=z+dj*step;if(Math.hypot(di*step,dj*step)>m)continue;
        const top=this.heightAt(px,pz);if(top!==-Infinity&&y<=top+m&&y>=floorY-5)return {type:'landmark',id:'anitkabir',name:'Anıtkabir'};
      }
      return null;
    },
  };
}

export async function createAnitkabirLayer({loader,data,renderer}){
  const gltf=await loader.loadGLTF(data.model);
  const root=new T.Group();root.name='anitkabir';
  const model=gltf.scene;
  const [ax,ay,az]=data.transform.modelAnchor,s=data.transform.scale;
  model.position.set(-ax*s,-ay*s,-az*s);              // anchor (Anıt Blok centre, square floor height) → origin
  model.scale.setScalar(s);
  const pivot=new T.Group();pivot.add(model);pivot.rotation.y=data.transform.rotationY;
  pivot.position.set(0,data.floorY,0);
  root.add(pivot);
  const maxAniso=renderer?.capabilities.getMaxAnisotropy?.()||1;
  model.traverse(o=>{if(!o.isMesh)return;o.castShadow=o.receiveShadow=true;
    const m=o.material;for(const k of ['map','normalMap','roughnessMap'])if(m[k])m[k].anisotropy=Math.min(8,maxAniso);
    m.metalness=0;m.envMapIntensity=.6;});
  const field=createMonumentField(data);
  // Türk bayrağı (tools/blender/turk_bayragi.py → models/turk-bayragi.glb): morph target döngüsü, rüzgâra bağlı
  let mixer=null,flag=null,wind={speed:6,direction:270};
  if(data.flag?.model){
    try{
      const g=await loader.loadGLTF(data.flag.model);const holder=g.scene;
      const [fx,fz]=data.flag.pole;holder.position.set(fx,data.floorY,fz);root.add(holder);
      holder.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
      flag=holder.getObjectByName('TurkishFlag');
      if(g.animations?.length){mixer=new T.AnimationMixer(holder);mixer.clipAction(g.animations[0]).play()}
    }catch(e){console.warn('[anitkabir] bayrak yüklenemedi',e.message)}
  }
  const pole=data.flag?.pole,poleTop=data.floorY+(data.flag?.height||24)+0.5;
  const poleHit=(x,y,z,r=0)=>pole&&y<=poleTop+GUARD_MARGIN&&Math.hypot(x-pole[0],z-pole[1])<=0.3+r+GUARD_MARGIN?{type:'landmark',id:'anitkabir-bayrak',name:'Bayrak direği'}:null;
  return {object:root,field,heightAt:(x,z)=>pole&&Math.hypot(x-pole[0],z-pole[1])<=0.3?Math.max(poleTop,field.heightAt(x,z)):field.heightAt(x,z),hitTest:(x,y,z,r)=>poleHit(x,y,z,r)||field.hitTest(x,y,z,r),
    /** sim.wind: {speed m/s, direction = rüzgârın geldiği yön (derece, kuzeyden saat yönü)} */
    setWind(w){if(w)wind=w},
    update(dt){
      if(!mixer)return;
      // kumaş rüzgârın gittiği yöne uzanır (β = geliş + 180°); model +X ekseni → rotation.y = 90° − β
      const beta=(wind.direction+180)*Math.PI/180,target=Math.PI/2-beta;
      if(flag){let d=target-flag.rotation.y;d=Math.atan2(Math.sin(d),Math.cos(d));flag.rotation.y+=d*Math.min(1,dt*0.8)}
      mixer.timeScale=0.35+Math.min(wind.speed||0,20)/11;mixer.update(dt);
    }};
}
