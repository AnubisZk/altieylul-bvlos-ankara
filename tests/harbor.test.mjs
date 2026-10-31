import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene} from 'three';
import {createHarbor} from '../drone/harbor.js';
import {DroneSim} from '../drone/sim.js';

// Texture drawing is irrelevant to the physics integration exercised here.
const drawing={fillRect(){},beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){}};
globalThis.document={createElement:()=>({getContext:()=>({...drawing})})};

test('harbor obstacles block rails while the complete route can use the landing pad',()=>{
  const home={x:1300,z:-420}, scene=new Scene();
  const harbor=createHarbor({scene,home,world:{isWater:()=>true}});
  const sim=new DroneSim(home,()=>0,(x,y,z)=>harbor.hitTest(x,y,z));
  assert.equal(harbor.hitTest(home.x,0.5,home.z),false);
  assert.equal(harbor.hitTest(home.x+6.75,0.8,home.z),true);
  assert.equal(harbor.hitTest(home.x,5,home.z),false);
  sim.start([{x:1070,z:-780},{x:670,z:-720},{x:850,z:-250}],80);
  for(let i=0;i<10000&&sim.active();i++){harbor.update(.05);sim.tick(.05)}
  assert.equal(sim.mode,'complete');
  assert.equal(sim.index,3);
  assert.equal(sim.violations,0);
  harbor.dispose();
});

test('water mask prevents vessels and buoys from being placed on land',()=>{
  const harbor=createHarbor({scene:new Scene(),home:{x:0,z:0},world:{isWater:()=>false}});
  assert.equal(harbor.counts.boats,0);
  assert.equal(harbor.counts.buoys,0);
  harbor.dispose();
});
