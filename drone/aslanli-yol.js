// Aslanlı Yol layer (tools/blender/aslanli_yol.py → models/aslanli-yol/*.glb, data/ank/aslanli-yol.json).
// LOD: yakın aslanli_yol_high.glb, orta aslanli_yol_low.glb, uzak = orta sürümün aslansız/ziyaretçisiz hâli.
// Collisions come from aslanli_yol_colliders.glb (axis-aligned boxes in the road frame → oriented boxes in the map).
// Like the monument, statues and towers never "crash" the drone: hits are `landmark` hits with a protective margin.
import * as T from 'three';
import {GUARD_MARGIN} from './anitkabir.js';

function pointInPoly(x,z,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,zi]=poly[i],[xj,zj]=poly[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside}return inside}

/** Pure ground model of aslanli-yol.json: road surface (gentle slope), start stairs, side lawns. */
export function createRoadField(lay){
  const [ax,az]=lay.start,[ux,uz]=lay.dir,st=lay.stairs,rise=lay.y1-lay.y0;
  const frame=(x,z)=>{const dx=x-ax,dz=z-az;return {s:dx*ux+dz*uz,t:-dx*uz+dz*ux}};
  const surface=s=>{
    if(s>=0)return lay.y0+rise*Math.min(Math.max(s/lay.length,0),1);
    const n=st.steps,d=(st.to-st.from)/n,k=Math.min(n-1,Math.max(0,Math.floor((s-st.from)/d)));
    return lay.y0-1+(k+1)/n;
  };
  return {
    frame,surface,
    inside:(x,z)=>pointInPoly(x,z,lay.footprint),
    groundAt(x,z){
      const {s,t}=frame(x,z);
      if(s<st.from||s>lay.length)return null;
      if(s<0)return Math.abs(t)<=st.halfWidth?surface(s):null;
      if(Math.abs(t)<=lay.paved.halfWidth)return surface(s);
      if(Math.abs(t)<=26&&s>=16)return surface(s)-0.15;
      return null;
    },
  };
}

/** Oriented boxes of the colliders GLB (each mesh: unit cube scaled/rotated by its node). */
export function createBoxColliders(scene){
  scene.updateMatrixWorld(true);
  const boxes=[];
  scene.traverse(o=>{
    if(!o.isMesh&&!o.isInstancedMesh)return;
    o.geometry.computeBoundingBox();
    const add=m=>{const inv=m.clone().invert(),sc=new T.Vector3().setFromMatrixScale(m);
      const top=new T.Vector3(0,o.geometry.boundingBox.max.y,0).applyMatrix4(m).y,bottom=new T.Vector3(0,o.geometry.boundingBox.min.y,0).applyMatrix4(m).y;
      const c=new T.Vector3().applyMatrix4(m);boxes.push({name:o.name,inv,sc,box:o.geometry.boundingBox.clone(),top,bottom,c,reach:sc.length()})};
    if(o.isInstancedMesh){const m=new T.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);add(m.clone().premultiply(o.matrixWorld))}}
    else add(o.matrixWorld.clone());
  });
  const p=new T.Vector3();
  const inside=(b,x,y,z,r)=>{p.set(x,y,z).applyMatrix4(b.inv);const B=b.box;
    return p.x>=B.min.x-r/b.sc.x&&p.x<=B.max.x+r/b.sc.x&&p.y>=B.min.y-r/b.sc.y&&p.y<=B.max.y+r/b.sc.y&&p.z>=B.min.z-r/b.sc.z&&p.z<=B.max.z+r/b.sc.z};
  const near=(b,x,z,r)=>Math.hypot(x-b.c.x,z-b.c.z)<=b.reach+r;
  return {
    boxes,
    heightAt(x,z){let h=-Infinity;for(const b of boxes)if(near(b,x,z,0)&&b.top>h&&inside(b,x,(b.top+b.bottom)/2,z,0))h=b.top;return h},
    hitTest(x,y,z,r=0){for(const b of boxes)if(near(b,x,z,r+GUARD_MARGIN)&&inside(b,x,y,z,r+GUARD_MARGIN))return {type:'landmark',id:'aslanli-yol',name:b.name.replace(/^COL_/,'').replace(/_/g,' ')};return null},
  };
}

export async function createAslanliYolLayer({loader,data,renderer}){
  const [high,low,col]=await Promise.all([loader.loadGLTF(data.files.high),loader.loadGLTF(data.files.low),loader.loadGLTF(data.files.colliders)]);
  const maxAniso=renderer?.capabilities.getMaxAnisotropy?.()||1;
  const prep=s=>{s.traverse(o=>{if(!o.isMesh&&!o.isInstancedMesh)return;o.castShadow=true;o.receiveShadow=true;
    const m=o.material;if(m){for(const k of ['map','normalMap'])if(m[k])m[k].anisotropy=Math.min(8,maxAniso);m.metalness=0}});return s};
  prep(high.scene);prep(low.scene);
  // uzak seviye: orta sürümden heykeller çıkarılmış kopya (zemin, ağaçlar, kuleler kalır)
  // (GPU örneklemeli GLB'de düğüm adları birleşir: aslan ve kaideleri 24 örnekli InstancedMesh'lerdir)
  const far=low.scene.clone(true);const drop=[];far.traverse(o=>{if(/^(Aslan|Kaide)_/.test(o.name)||/Aslan/.test(o.material?.name||'')||(o.isInstancedMesh&&o.count===24))drop.push(o)});drop.forEach(o=>o.removeFromParent());
  const [ax,az]=data.start,[ux,uz]=data.dir,mid=new T.Vector3(ax+ux*data.length/2,data.y0,az+uz*data.length/2);
  const lod=new T.LOD();lod.name='aslanli-yol';lod.position.copy(mid);
  for(const [scene,dist] of [[high.scene,data.lod.near],[low.scene,data.lod.mid],[far,data.lod.far]]){const g=new T.Group();g.position.copy(mid).negate();g.add(scene);lod.addLevel(g,dist)}
  const root=new T.Group();root.name='aslanli-yol-root';root.add(lod);
  const colliders=createBoxColliders(col.scene);
  // Heykel grupları (Hürriyet önünde erkek, İstiklal önünde kadın): dışarıdan sağlanan GLB'ler, kaidelerin üstüne
  // oturtulur, yola (eksene) dönük; dosya yoksa atlanır.
  const statues=[];
  for(const st of data.statues||[]){
    try{
      const g=await loader.loadGLTF(st.model),obj=g.scene;obj.updateMatrixWorld(true);
      const box=new T.Box3().setFromObject(obj),size=box.getSize(new T.Vector3()),k=st.height/Math.max(size.y,1e-6);
      const holder=new T.Group();holder.name='heykel-'+st.id;
      obj.position.set(-(box.min.x+box.max.x)/2,-box.min.y,-(box.min.z+box.max.z)/2);holder.add(obj);holder.scale.setScalar(k);
      const s=st.s,t=st.t,px=ax+ux*s-uz*t,pz=az+uz*s+ux*t,top=data.y0+(data.y1-data.y0)*Math.max(0,s)/data.length+st.plinthTop;
      holder.position.set(px,top,pz);
      const fx=uz*Math.sign(t),fz=-ux*Math.sign(t);holder.rotation.y=Math.atan2(fx,fz);   // model +Z → yol eksenine
      obj.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;if(o.material)o.material.metalness=0}});
      root.add(holder);statues.push(st.id);
      colliders.boxes.push(...createBoxColliders((()=>{const m=new T.Mesh(new T.BoxGeometry(size.x*k+0.4,st.height,size.z*k+0.4));m.position.set(px,top+st.height/2,pz);m.rotation.y=holder.rotation.y;m.name='COL_Heykel_'+st.id;const gg=new T.Group();gg.add(m);return gg})()).boxes);
    }catch(e){if(!(e&&(e.status===404||/404/.test(e.message||''))))console.warn('[aslanli-yol] heykel yüklenemedi',st.id,e?.message)}
  }

  return {object:root,lod,colliders,heightAt:(x,z)=>colliders.heightAt(x,z),hitTest:(x,y,z,r)=>colliders.hitTest(x,y,z,r),
    update(dt,cam){lod.update(cam)},
    stats:{get colliders(){return colliders.boxes.length},statues}};
}
