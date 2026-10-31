import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DroneSim} from '../drone/sim.js';
import {assessFlight} from '../drone/assessment.js';
const run=(s,t)=>{for(let i=0;i<t*50;i++)s.tick(.02);};
const flight=(allowed=true)=>{const s=new DroneSim({x:0,z:0},()=>0,()=>false,()=>allowed);s.toggleMotors();s.startStickFlight(1);s.manual.vertical=1;run(s,2);s.manual.vertical=0;return s;};
test('stick descent lands, keeps motors on, and A shuts them down only on ground',()=>{
 const s=flight();assert.equal(s.toggleMotors(),false);s.manual.vertical=-1;run(s,12);
 assert.equal(s.mode,'complete');assert.equal(s.agl,.5);assert.equal(s.armed,true);assert.equal(s.stickLanding,true);assert.equal(s.verticalSpeed,0);
 const p=[s.x,s.y,s.z];run(s,2);assert.deepEqual([s.x,s.y,s.z],p);assert.equal(assessFlight(s).score,100);
 assert.equal(s.toggleMotors(),true);assert.equal(s.armed,false);assert.equal(s.startStickFlight(1),false);
});
test('centered throttle stops descent before contact, unsafe ground never becomes landed',()=>{
 const s=flight();s.manual.vertical=-.5;run(s,1);s.manual.vertical=0;const y=s.y;run(s,2);assert.equal(s.y,y);assert.equal(s.mode,'manual');
 const unsafe=flight(false);unsafe.manual.vertical=-1;run(unsafe,15);assert.equal(unsafe.mode,'manual');assert.ok(unsafe.agl>=.5);assert.equal(unsafe.toggleMotors(),false);
});
test('touchdown requires slow horizontal movement, airborne controls and automatic landing remain available',()=>{
 const s=flight();s.manual.vertical=-1;s.manual.forward=1;run(s,15);assert.equal(s.mode,'manual');s.manual.forward=0;run(s,4);assert.equal(s.mode,'complete');assert.equal(s.armed,true);
 s.manual.vertical=0;s.startStickFlight(.5);assert.equal(s.stickLanding,false);assert.equal(s.mode,'manual');s.manual.vertical=.5;run(s,2);s.returnHome();run(s,120);assert.equal(s.mode,'complete');assert.equal(s.armed,false);
});
