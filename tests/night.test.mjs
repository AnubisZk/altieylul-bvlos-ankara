import test from 'node:test';
import assert from 'node:assert/strict';
import {createNightState,createSearchState,searchRoute,searchOutcome} from '../drone/night-state.js';
import {validRoute} from '../drone/sim.js';

test('daylight is default, transition is bounded and frame-rate independent',()=>{
  const a=createNightState(),b=createNightState();assert.deepEqual(a.step(0),{dusk:0,night:0});
  assert.equal(a.select('__proto__'),false);assert.equal(a.select('unknown'),false);
  a.select('night');b.select('night');
  for(let i=0;i<60;i++)a.step(1/30);for(let i=0;i<180;i++)b.step(1/90);
  assert.ok(Math.abs(a.step(0).night-b.step(0).night)<1e-10);
  a.select('dusk');assert.ok(a.step(.1).night>0);assert.ok(a.step(.1).dusk>0);
  const before=a.step(0);assert.deepEqual(a.step(NaN),before);assert.deepEqual(a.step(-1),before);
  a.select('day');for(let i=0;i<600;i++)a.step(1/30);assert.deepEqual(a.step(0),{dusk:0,night:0});
});
const visible={dt:.1,elapsed:10,active:true,paused:false,thermal:true,inFrame:true,clear:true,range:100,link:100};
test('search requires three continuous visible thermal seconds, reports only once and resets',()=>{
  const s=createSearchState();for(let i=0;i<29;i++)assert.equal(s.step(visible),false);
  assert.equal(s.step({...visible,elapsed:13}),true);assert.equal(s.snapshot.foundAt,13);
  assert.equal(s.step(visible),false);s.reset();assert.deepEqual(s.snapshot,{found:false,foundAt:null,progress:0});
});
test('occlusion, camera mode, pause, range and link loss reset incomplete acquisition',()=>{
  for(const invalid of [{clear:false},{thermal:false},{paused:true},{link:0},{inFrame:false},{active:false},{range:241},{range:NaN},{range:2}]){
    const s=createSearchState();for(let i=0;i<20;i++)s.step(visible);
    assert.equal(s.step({...visible,...invalid}),false);assert.equal(s.snapshot.progress,0);
  }
  const s=createSearchState();s.step({...visible,dt:NaN});assert.equal(s.snapshot.progress,0);
  s.step({...visible,dt:100});assert.equal(s.snapshot.found,false);
});
test('six-point search pattern fits training area and result separates detection from safe return',()=>{
  const home={x:0,z:0},route=searchRoute({x:-1550,z:450});assert.equal(route.length,6);assert.equal(validRoute(route,home),true);
  assert.match(searchOutcome({found:true},'crashed'),/tamamlanamadı/);
  assert.match(searchOutcome({found:true},'complete'),/güvenli dönüş tamamlandı/);
  assert.match(searchOutcome({found:false},'complete'),/tespit edilemedi/);
  assert.equal(searchOutcome(null,'complete'),'');
});
