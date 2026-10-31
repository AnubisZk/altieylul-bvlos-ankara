import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BufferGeometry,Float32BufferAttribute,Mesh,MeshStandardMaterial,Group} from 'three';
import {repairRoofWinding} from '../drone/roof-repair.js';
test('inward roof strip is corrected, UVs preserved, upward caps and unrelated meshes untouched',()=>{
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute([0,2,0,1,1,0,0,1,1,0,2,0,0,1,1,1,1,0],3));g.computeVertexNormals();
  g.setAttribute('uv',new Float32BufferAttribute([0,0,1,0,0,1,0,0,0,1,1,0],2));
  const root=new Group(),roof=new Mesh(g,new MeshStandardMaterial()),wall=new Mesh(g,roof.material);roof.name='sultanahmet_lead';wall.name='sultanahmet_wall';root.add(roof,wall);
  assert.equal(repairRoofWinding(root,'topkapi'),0);assert.equal(repairRoofWinding(root,'sultanahmet'),1);assert.equal(wall.geometry,g);
  const n=roof.geometry.attributes.normal;for(let i=0;i<6;i++)assert.ok(n.getY(i)>0);
  assert.deepEqual(Array.from(roof.geometry.attributes.uv.array),[0,0,0,1,1,0,0,0,0,1,1,0]);assert.equal(repairRoofWinding(root,'sultanahmet'),0);
});
