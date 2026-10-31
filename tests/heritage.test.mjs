import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {decorateHeritage} from '../drone/heritage.js';
import {finishRoofGeometry,refineHeritageSurfaces} from '../drone/heritage-surfaces.js';

test('roof finish preserves geometry positions, bounds and ground anchors',()=>{
  const g=new T.SphereGeometry(12,24,12,0,Math.PI*2,0,Math.PI/2).toNonIndexed();
  g.setAttribute('_anchor',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(7),3));
  const positions=Array.from(g.attributes.position.array),anchor=Array.from(g.attributes._anchor.array);const next=finishRoofGeometry(g);
  assert.deepEqual(Array.from(next.attributes.position.array),positions);assert.deepEqual(Array.from(next.attributes._anchor.array),anchor);
  assert.equal(next.attributes.roofOrigin.count,g.attributes.position.count);assert.ok(next.userData.curvedRoofs>0);
  assert.ok(Array.from(next.attributes.normal.array).every(Number.isFinite));assert.equal(g.attributes.roofOrigin,undefined);
});
test('detailed window surrounds merge correctly within a fixed geometry budget and do not duplicate',()=>{
  for(const id of ['ayasofya','sultanahmet','suleymaniye','yeni_cami']){
    const halls={sultanahmet:{c:[0,10.25,0],h:[27.89,14.25,24.405]},suleymaniye:{c:[0,11.25,2.805],h:[29,15.25,29]},yeni_cami:{c:[0,8.25,-5],h:[21,12.25,20.5]}};
    const object=new T.Group(),def={id,collision:[{t:'box',...(halls[id]||halls.sultanahmet)}]};
    decorateHeritage(object,def);assert.equal(object.children.length,1);assert.equal(object.children[0].children.length,4);
    assert.ok(object.userData.heritageTriangles<60000);for(const mesh of object.children[0].children)assert.ok(Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite));
    decorateHeritage(object,def);assert.equal(object.children.length,1);
  }
});
test('palace grass and transforms remain unchanged while its roof is refined',()=>{
  const root=new T.Group(),grass=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()),roof=new T.Mesh(new T.SphereGeometry(4),new T.MeshStandardMaterial());grass.name='topkapi_grass';roof.name='topkapi_lead';root.add(grass,roof);root.position.set(100,20,30);const material=grass.material;
  refineHeritageSurfaces(root,'topkapi');assert.equal(grass.material,material);assert.deepEqual(root.position.toArray(),[100,20,30]);assert.equal(roof.material.name,'heritage_lead');
});
