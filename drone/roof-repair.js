// The four imported mosque lead-roof meshes contain inward-wound side-dome
// strips (downward normals), while their pole caps face out. Their roof shells
// have no underside faces. Correct only those strips, preserving UVs/colors.
export function repairRoofWinding(object,id){
  if(!['ayasofya','sultanahmet','suleymaniye','yeni_cami'].includes(id))return 0;
  let repaired=0;
  object.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.name.endsWith('_lead')||mesh.geometry.userData.roofRepaired)return;
    const source=mesh.geometry,g=source.index?source.toNonIndexed():source.clone();
    const pos=g.attributes.position,n=g.attributes.normal;
    if(!n){g.dispose();return;}
    let count=0;
    for(let i=0;i<pos.count;i+=3){
      const ux=pos.getX(i+1)-pos.getX(i),uz=pos.getZ(i+1)-pos.getZ(i);
      const vx=pos.getX(i+2)-pos.getX(i),vz=pos.getZ(i+2)-pos.getZ(i);
      if(uz*vx-ux*vz>=-1e-5||n.getY(i)+n.getY(i+1)+n.getY(i+2)>=-.01)continue;
      for(const attribute of Object.values(g.attributes)){
        for(let j=0;j<attribute.itemSize;j++){
          const a=(i+1)*attribute.itemSize+j,b=(i+2)*attribute.itemSize+j;
          const tmp=attribute.array[a];attribute.array[a]=attribute.array[b];attribute.array[b]=tmp;
        }
      }
      for(let k=i;k<i+3;k++)n.setXYZ(k,-n.getX(k),-n.getY(k),-n.getZ(k));
      count++;
    }
    if(count){g.userData.roofRepaired=true;g.computeBoundingSphere();mesh.geometry=g;repaired+=count;}else g.dispose();
  });
  return repaired;
}
