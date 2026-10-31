import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DroneSim} from '../drone/sim.js';
import {GamepadInput} from '../drone/gamepad-input.js';
import {gamepadSafety} from '../drone/gamepad-flight.js';
const run=(s,t,dt=.02)=>{for(let i=0;i<Math.round(t/dt);i++)s.tick(dt);};
test('stick launch requires armed, unpaused grounded aircraft and positive throttle',()=>{
 const s=new DroneSim({x:0,z:0});assert.equal(s.startStickFlight(1),false);s.toggleMotors();
 for(const v of [0,-1,NaN,undefined])assert.equal(s.startStickFlight(v),false);
 s.paused=true;assert.equal(s.startStickFlight(1),false);s.paused=false;run(s,2);assert.equal(s.y,.5);
 assert.equal(s.startStickFlight(.5),true);assert.equal(s.mode,'manual');assert.equal(s.y,.5);assert.equal(s.startStickFlight(1),false);
});
test('partial throttle lifts proportionally, centered stick holds even below two metres, descent and ceiling are bounded',()=>{
 for(const dt of [.01,.02,.05]){
  const s=new DroneSim({x:0,z:0});s.toggleMotors();s.startStickFlight(.25);s.manual.vertical=.25;run(s,1,dt);
  assert.ok(Math.abs(s.y-1.25)<1e-8);s.manual.vertical=0;const height=s.y;run(s,3,dt);assert.equal(s.y,height);
  s.manual.vertical=1;run(s,2,dt);assert.ok(Math.abs(s.y-(height+6))<1e-8);
  s.manual.vertical=-.5;run(s,1,dt);assert.ok(Math.abs(s.y-(height+5))<1e-8);
  s.manual.vertical=1;run(s,50,dt);assert.ok(s.agl<=120&&s.agl>119);
 }
});
test('stick flight disconnect holds; resume and landing work; relaunch preserves position and battery',()=>{
 const s=new DroneSim({x:0,z:0});s.toggleMotors();s.startStickFlight(1);s.manual.vertical=1;run(s,2);s.manual.vertical=0;
 s.manual.forward=1;run(s,3);gamepadSafety(s);const location=[s.x,s.y,s.z];run(s,2);assert.deepEqual([s.x,s.y,s.z],location);
 s.resume();run(s,1);assert.equal(s.y,location[1]);s.landHere(true);run(s,20);assert.equal(s.mode,'complete');
 const landed=[s.x,s.y,s.z,s.battery];s.toggleMotors();s.startStickFlight(.5);assert.deepEqual([s.x,s.y,s.z,s.battery],landed);
 s.resetFlight();assert.equal(s.stickFlight,false);assert.equal(s.armed,false);
});
test('automatic free takeoff still targets three metres, mission remains independent',()=>{
 const s=new DroneSim({x:0,z:0});s.startFree();assert.equal(s.mode,'takeoff');assert.equal(s.targetAgl,3);assert.equal(s.stickFlight,false);run(s,8);assert.ok(Math.abs(s.agl-3)<.01);
 s.resetFlight();s.start([{x:20,z:0}],30);run(s,120);assert.equal(s.mode,'complete');assert.equal(s.stickFlight,false);
});
test('arming lock suppresses an already raised stick and controls remain zero while settings are open',()=>{
 const p={index:0,id:'test',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false}))},g=new GamepadInput();
 g.step([p]);p.axes[1]=-1;g.suspend();assert.equal(g.step([p]).controls.vertical,0);
 p.axes[1]=0;g.step([p]);p.axes[1]=-.55;assert.ok(g.step([p]).controls.vertical>.49);
 assert.equal(g.step([p],true).controls.vertical,0);assert.equal(g.step([p]).ready,false);
});
