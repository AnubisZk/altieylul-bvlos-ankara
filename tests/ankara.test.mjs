import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {heightSampler,createObstacleIndex} from '../drone/ankara-world.js';
import {createDefaultRoute,ANCHOR_FROM_HOME} from '../drone/mission.js';
import {validRoute} from '../drone/sim.js';
import {createUtm} from '../src/maps/utm.js';

const region=JSON.parse(fs.readFileSync('data/ank/region.json','utf8'));

test('Ankara region frame: UTM 36N, origin at Anıt Blok, Tandoğan pad matches the mission anchor',()=>{
  assert.equal(region.crs,'EPSG:32636');
  const u=createUtm(region.crs),[e,n]=u.fwd(region.origin.lon,region.origin.lat);
  assert.ok(Math.abs(e-region.originUTM[0])<.01&&Math.abs(n-region.originUTM[1])<.01);
  const [he,hn]=u.fwd(region.home.lon,region.home.lat),home={x:he-e,z:n-hn};
  assert.ok(Math.abs(-home.x-ANCHOR_FROM_HOME[0])<2&&Math.abs(-home.z-ANCHOR_FROM_HOME[1])<2,'ANCHOR_FROM_HOME is stale');
  const route=createDefaultRoute(home);
  assert.equal(validRoute(route,home),true);
  for(const p of route){const d=Math.hypot(p.x,p.z);assert.ok(d>300&&d<500,'ring point ~400 m from Anıt Blok')}
});

test('height grid is sampled bilinearly and held at the edges; no grid = fallback',()=>{
  const g=heightSampler({x0:0,z0:0,step:10,cols:2,rows:2,heights:[0,10,20,30]},5);
  assert.equal(g(5,5),15);assert.equal(g(-50,-50),0);assert.equal(g(99,99),30);
  assert.equal(heightSampler(null,880)(1,2),880);
});

test('building index: top height inside the footprint, hit test with radius',()=>{
  const idx=createObstacleIndex([{id:'b',height:12,ring:[[0,0],[10,0],[10,10],[0,10]]}],()=>900);
  assert.equal(idx.heightAt(5,5),912);assert.equal(idx.heightAt(15,5),-Infinity);
  assert.ok(idx.hitTest(5,905,5,.2));assert.equal(idx.hitTest(5,913,5,.2),null);
  assert.ok(idx.hitTest(10.25,905,5,.3));assert.equal(idx.hitTest(11,905,5,.3),null);
});
