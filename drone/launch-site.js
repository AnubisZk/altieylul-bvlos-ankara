// Ankara launch site: the İstanbul pontoon, boats and sea props (harbor.js) do not exist here. The landing pad itself is
// drawn by main.js; this keeps harbor.js' small interface (counts, update, hitTest) so flight and landing code is unchanged.
import * as T from 'three';
export function createLaunchSite({scene,home,world,reducedMotion=false}){
  const root=new T.Group(),x=home.x+5,z=home.z+3,y=world.getGroundHeight(x,z);
  root.position.set(x,y,z);scene.add(root);
  const pole=new T.Mesh(new T.CylinderGeometry(.055,.075,3,8),new T.MeshStandardMaterial({color:0xa9b1b5,roughness:.65}));
  pole.position.y=1.5;root.add(pole);
  const sock=new T.Group();sock.position.y=3;root.add(sock);
  for(let i=0;i<5;i++){
    const segment=new T.Mesh(new T.CylinderGeometry(.17-i*.021,.17-(i+1)*.021,.24,10,1,true),new T.MeshStandardMaterial({color:i%2?0xf4f0e7:0xe87a31,side:T.DoubleSide}));
    segment.rotation.z=Math.PI/2;segment.position.x=.12+i*.24;sock.add(segment);
  }
  let time=0;
  return {counts:{site:'tandogan',pad:1,boats:0,windsocks:1},home:{...home},
    update(dt,wind={speed:0,direction:0}){
      time+=dt;const strength=Math.min(1,wind.speed/8);
      sock.rotation.set(0,-Math.PI/2-wind.direction*Math.PI/180,-(1-strength)*1.25+(reducedMotion?0:Math.sin(time*3)*.045*strength));
    },
    hitTest(px,py,pz,r=.2){return Math.hypot(px-x,pz-z)<r+.075&&py>=y-r&&py<=y+3+r?{type:'windsock'}:null}
  };
}
