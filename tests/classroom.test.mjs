import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DroneSim,angleDelta} from '../drone/sim.js';
import {readPlans,saveNamedPlan,PLAN_KEY} from '../drone/plans.js';
const home={x:0,z:0},route=[{x:0,z:-200},{x:200,z:-200}];
const run=(s,t)=>{for(let i=0;i<t*20;i++)s.tick(.05);};
const storage=()=>{const data=new Map();return{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
test('reset discards flight state and permits a fresh mission',()=>{
  const s=new DroneSim(home);s.setWind(6,90);s.start(route,30);run(s,40);s.paused=true;s.resetFlight();
  assert.equal(s.mode,'ready');assert.equal(s.battery,100);assert.equal(s.elapsed,0);assert.equal(s.track.length,0);assert.equal(s.assessment,null);assert.equal(s.paused,false);assert.deepEqual(s.wind,{speed:0,direction:0});assert.equal(s.start(route,60),true);
});
test('climb and descent have signed vertical speed without false horizontal speed',()=>{
  const s=new DroneSim(home);s.start(route,30);s.tick(.05);assert.equal(s.speed,0);assert.ok(s.verticalSpeed>2.99);
  s.mode='landing';s.tick(.05);assert.ok(s.verticalSpeed<0);const y=s.y;s.paused=true;run(s,4);assert.equal(s.y,y);
});
test('autopilot makes bounded turns and completes a zigzag without teleporting',()=>{
  const s=new DroneSim(home);s.start([{x:100,z:0},{x:-100,z:0},{x:0,z:-100}],30);
  for(let i=0;i<6000&&s.active();i++){const h=s.heading,x=s.x,z=s.z;s.tick(.05);assert.ok(Math.abs(angleDelta(s.heading,h))<=.65*.05+1e-8);assert.ok(Math.hypot(s.x-x,s.z-z)<=.61);}
  assert.equal(s.mode,'complete');assert.equal(s.index,3);assert.ok(Math.abs(angleDelta(-Math.PI+.01,Math.PI-.01)-.02)<1e-8);
});
test('manual yaw accelerates smoothly, winds drift downwind, altitude warning is not spammed',()=>{
  const s=new DroneSim(home);s.start(route,120);s.mode='manual';s.manual.yaw=1;s.manual.vertical=1;s.setWind(8,90);s.tick(.05);
  assert.ok(s.heading>0&&s.heading<.01);assert.ok(s.x<0);assert.ok(Math.abs(s.z)<1e-6);run(s,2);assert.ok(s.yawSpeed<=.42);assert.equal(s.events.filter(e=>e.message.includes('120 m')).length,1);
});
test('configured wind survives launch, affects energy and headwind travel, rejects invalid input',()=>{
  const calm=new DroneSim(home),windy=new DroneSim(home);windy.setWind(8,0);assert.equal(windy.setWind(NaN,0),false);
  for(const s of [calm,windy]){s.start(route,30);run(s,20);}
  assert.equal(windy.wind.speed,8);assert.ok(windy.battery<calm.battery);assert.ok(windy.z>calm.z);
});
test('named plans migrate old data, preserve independent copies and reject duplicate names',()=>{
  const st=storage();st.setItem('bilsem.bvlos.plan.v1',JSON.stringify({route,alt:80}));assert.equal(readPlans(st,home)[0].name,'Önceki kayıt');
  const p={name:' Kıyı ',route:route.map(p=>({...p})),alt:60};saveNamedPlan(st,home,p);p.route[0].x=999;
  assert.equal(readPlans(st,home).length,2);assert.equal(readPlans(st,home)[1].route[0].x,0);assert.throws(()=>saveNamedPlan(st,home,{...p,name:'KIYI'}),/zaten/);
});
test('invalid storage and quota failure never overwrite stored plans',()=>{
  const st=storage();st.setItem(PLAN_KEY,'broken');assert.throws(()=>saveNamedPlan(st,home,{name:'Yeni',route,alt:60}));assert.equal(st.getItem(PLAN_KEY),'broken');
  const denied={getItem:()=>null,setItem:()=>{throw Error('quota');}};assert.throws(()=>saveNamedPlan(denied,home,{name:'Yeni',route,alt:60}),/quota/);
});
