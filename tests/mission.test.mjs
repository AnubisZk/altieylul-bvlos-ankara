import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultRoute} from '../drone/mission.js';
import {DroneSim,validRoute} from '../drone/sim.js';

test('six-point observation mission stays within the lesson boundary and returns with reserve',()=>{
  const home={x:2740,z:560},route=createDefaultRoute(home);
  assert.equal(route.length,6);
  assert.equal(validRoute(route,home),true);
  const sim=new DroneSim(home);
  sim.start(route,80);
  for(let i=0;i<20000&&sim.active();i++)sim.tick(.05);
  assert.equal(sim.mode,'complete');assert.equal(sim.index,6);
  assert.ok(sim.battery>60);assert.equal(sim.violations,0);
});
