import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GamepadInput,settingsFrom,axisValue,blendControls,mappingError,zero} from '../drone/gamepad-input.js';
import {gamepadSafety,canLandHere} from '../drone/gamepad-flight.js';
import {DroneSim} from '../drone/sim.js';
import {assessFlight} from '../drone/assessment.js';
const pad=(extra={})=>({id:'Synthetic standard controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false})),...extra});
const press=(p,n,value=1)=>{p.buttons[n]={value,pressed:value>.5};};
const run=(s,t)=>{for(let i=0;i<t*20;i++)s.tick(.05);};
test('Mode 2 maps all directions proportionally; deadzone, inversion and sensitivity are bounded',()=>{
  const s=settingsFrom(),g=new GamepadInput(s),p=pad();g.step([p]);
  p.axes=[.55,-.55,.55,-.55];const v=g.step([p]).controls;
  for(const key of Object.keys(v))assert.ok(Math.abs(v[key]-.5)<1e-9);
  p.axes=[-.55,.55,-.55,.55];for(const v of Object.values(g.step([p]).controls))assert.ok(Math.abs(v+.5)<1e-9);
  assert.equal(axisValue(.1,s.axes.yaw,s),0);assert.equal(axisValue(NaN,s.axes.yaw,s),0);
  s.axes.yaw.invert=true;s.axes.yaw.sensitivity=2;assert.equal(axisValue(1,s.axes.yaw,s),-1);
  s.centers[0]=.05;assert.equal(axisValue(.05,s.axes.yaw,s),0);
});
test('button edges never repeat; trigger camera is proportional; connection starts neutral',()=>{
  const g=new GamepadInput(),p=pad();press(p,0);
  assert.deepEqual(g.step([p]).actions,[]);assert.equal(g.step([p]).ready,false);
  press(p,0,0);g.step([p]);press(p,0);assert.deepEqual(g.step([p]).actions,['motor']);
  assert.deepEqual(g.step([p]).actions,[]);press(p,0,0);g.step([p]);press(p,0);assert.deepEqual(g.step([p]).actions,['motor']);
  press(p,7,.7);assert.equal(g.step([p]).camera,.7);assert.equal(g.step([p]).camera,.7);
});
test('disconnect, reconnect, held sticks, menus and replacement devices require neutral again',()=>{
  const g=new GamepadInput(),p=pad();g.step([p]);p.axes[0]=.8;assert.ok(g.step([p]).controls.yaw>0);
  assert.equal(g.step([]).disconnected,true);assert.equal(g.step([]).disconnected,false);
  assert.equal(g.step([p]).ready,false);p.axes[0]=0;g.step([p]);press(p,3);assert.deepEqual(g.step([p],true).actions,[]);
  assert.equal(g.step([p]).ready,false);press(p,3,0);assert.equal(g.step([p]).ready,true);
  const replacement=pad({id:'Another',axes:[1,0,0,0]});assert.equal(g.step([replacement]).disconnected,true);assert.equal(g.step([replacement]).ready,false);
});
test('nonstandard mapping is opt-in, missing controls and conflicting maps block input',()=>{
  const g=new GamepadInput(),p=pad({mapping:''});assert.equal(g.step([p]).ready,false);
  const s=settingsFrom();s.approvedDevices=[p.id];g.configure(s);assert.equal(g.step([p]).ready,true);
  s.axes.yaw.index=30;g.configure(s);assert.equal(g.step([p]).ready,false);
  const bad=settingsFrom();bad.buttons.land=0;assert.match(mappingError(bad),/düğme/);
  g.configure(bad);assert.equal(g.step([pad()]).ready,false);
  const invalid=settingsFrom({deadzone:NaN,axes:{yaw:{index:2,sensitivity:Infinity}},buttons:{motor:999}});
  assert.equal(invalid.deadzone,.1);assert.equal(invalid.axes.yaw.sensitivity,1);assert.equal(invalid.buttons.motor,63);
});
test('keyboard works without pad and takes per-axis precedence; explicit device selection does not switch silently',()=>{
  const g=new GamepadInput(),keyboard={...zero(),forward:1};assert.deepEqual(blendControls(keyboard,g.step([]).controls),keyboard);
  assert.deepEqual(blendControls(keyboard,{...zero(),forward:-1,yaw:.5}),{...keyboard,yaw:.5});
  g.select(1);assert.equal(g.step([pad()]).pad,undefined);
  const second=pad({index:1});assert.equal(g.step([pad(),second]).pad,second);assert.equal(g.step([pad()]).disconnected,true);
});
test('motor arming does not start flight, airborne shutdown is rejected and landing stops motors',()=>{
  const s=new DroneSim({x:0,z:0});assert.equal(s.toggleMotors(),true);assert.equal(s.armed,true);run(s,5);assert.equal(s.elapsed,0);
  assert.equal(s.toggleMotors(),true);assert.equal(s.armed,false);s.startFree();run(s,4);assert.equal(s.toggleMotors(),false);assert.equal(s.armed,true);
  assert.equal(s.landHere(false),false);assert.equal(s.landHere(true),true);run(s,20);assert.equal(s.mode,'complete');assert.equal(s.armed,false);
  assert.match(assessFlight(s).rows.at(-1).detail,/Seçilen zemine/);assert.equal(assessFlight(s).returns.at(-1).source,'Pilot');
});
test('local landing keeps coordinates while normal RTH and mission still land at home',()=>{
  const s=new DroneSim({x:0,z:0});s.startFree();run(s,4);s.manual.forward=1;run(s,4);const z=s.z;
  s.landHere(true);run(s,20);assert.equal(s.z,z);assert.equal(s.mode,'complete');assert.equal(assessFlight(s).score,100);
  s.resetFlight();s.start([{x:50,z:0}],30);run(s,180);assert.equal(s.mode,'complete');assert.equal(s.x,0);assert.equal(s.landingPoint,null);
});
test('controller loss holds manual flight without altering route or RTH; aircraft link failsafe remains in charge',()=>{
  const s=new DroneSim({x:0,z:0});s.startFree();run(s,4);s.manual.forward=1;run(s,4);const z=s.z;
  assert.equal(gamepadSafety(s),true);run(s,4);assert.equal(s.mode,'hold');assert.equal(s.z,z);
  s.returnHome();assert.equal(gamepadSafety(s),false);assert.equal(s.mode,'rth');
  s.enterManual();s.link=0;assert.equal(gamepadSafety(s),false);s.setScenario('link');run(s,6);assert.equal(s.mode,'rth');
});
test('landing rejects water, slope, roofs, obstacles and unknown terrain, but accepts landing pad and clear ground',()=>{
  const sim={x:100,z:100,y:20,home:{x:0,z:0}};
  const world={getGroundHeight:()=>0,getObstacleHeight:()=>0,isWater:()=>false,hitTest:()=>false};
  assert.equal(canLandHere(sim,world),true);
  assert.equal(canLandHere(sim,{...world,getObstacleHeight:()=>-Infinity}),true);
  assert.equal(canLandHere(sim,{...world,isWater:()=>true}),false);
  assert.equal(canLandHere(sim,{...world,getGroundHeight:x=>x>100?2:0}),false);
  assert.equal(canLandHere(sim,{...world,getObstacleHeight:()=>5}),false);
  assert.equal(canLandHere(sim,{...world,hitTest:()=>true}),false);
  assert.equal(canLandHere(sim,{...world,getGroundHeight:()=>NaN}),false);
  assert.equal(canLandHere({...sim,x:0,z:0},{...world,isWater:()=>true}),true);
});
