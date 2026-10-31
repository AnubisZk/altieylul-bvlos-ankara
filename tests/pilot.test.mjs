import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DroneSim} from '../drone/sim.js';
import {assessFlight} from '../drone/assessment.js';
import {resultHtml} from '../drone/result.js';
import {zoomFov} from '../drone/pilot-controls.js';
const run=(s,t)=>{for(let i=0;i<t*20;i++)s.tick(.05);};
function free(){const s=new DroneSim({x:0,z:0});assert.equal(s.startFree(),true);run(s,3);assert.equal(s.mode,'manual');return s;}
test('free flight needs no route; starts above platform and returns with an appropriate report',()=>{
  const s=free();assert.deepEqual(s.route,[]);assert.ok(s.agl>2);assert.equal(s.startFree(),false);
  s.manual.forward=1;run(s,8);assert.ok(s.z<-40);s.returnHome();run(s,100);assert.equal(s.mode,'complete');
  const r=assessFlight(s);assert.equal(r.score,100);assert.equal(r.rows.length,3);assert.equal(r.outcome,'Serbest uçuş tamamlandı');
  assert.ok(!r.rows.some(r=>r.name==='Rota takibi'));assert.match(resultHtml(s),/Toplam 60 puan/);
  s.resetFlight();assert.equal(s.flightKind,'route');assert.equal(s.manualProfile,'normal');assert.equal(s.manualForward,0);
  assert.equal(s.start([{x:0,z:-50}],30),true);assert.equal(s.flightKind,'route');
});
test('manual profiles persist at launch and limit smooth acceleration and diagonal motion',()=>{
  for(const [profile,limit]of [['precise',3],['normal',8],['fast',12]]){
    const s=new DroneSim({x:0,z:0});assert.equal(s.setManualProfile(profile),true);s.startFree();run(s,3);assert.equal(s.manualProfile,profile);
    s.manual.forward=1;s.tick(.05);assert.ok(s.speed<=.301);run(s,4);assert.ok(Math.abs(s.speed-limit)<.001);
    s.manual.side=1;run(s,4);assert.ok(s.speed<=limit+.001);
    s.manual.forward=s.manual.side=0;run(s,4);assert.ok(s.speed<.001);
  }
  const s=free();assert.equal(s.setManualProfile('__proto__'),false);assert.equal(s.setManualProfile('invalid'),false);
});
test('pause freezes free flight; hold resumes manual and link failure still returns automatically',()=>{
  const s=free();s.manual.forward=1;run(s,3);s.paused=true;const saved=[s.x,s.z,s.elapsed,s.battery];run(s,3);assert.deepEqual([s.x,s.z,s.elapsed,s.battery],saved);assert.equal(s.enterManual(),false);
  s.paused=false;s.hold();assert.equal(s.resume(),true);assert.equal(s.mode,'manual');s.setScenario('link');run(s,6);assert.ok(['rth','landing'].includes(s.mode));assert.equal(s.enterManual(),false);run(s,100);assert.equal(s.mode,'complete');
});
test('free-flight crash and low-energy outcomes retain safety scoring',()=>{
  const s=free();s.hit=()=>true;s.tick(.05);assert.equal(s.mode,'crashed');assert.ok(assessFlight(s).score<=39);
  const b=free();b.battery=24;run(b,20);assert.equal(b.mode,'complete');assert.equal(b.reason,'Düşük batarya');
});
test('zoom narrows the field of view by the selected optical ratio',()=>{
  assert.ok(Math.abs(zoomFov(1)-62)<1e-10);
  for(const z of [2,4])assert.ok(Math.abs(Math.tan(zoomFov(1)*Math.PI/360)/Math.tan(zoomFov(z)*Math.PI/360)-z)<1e-10);
});
