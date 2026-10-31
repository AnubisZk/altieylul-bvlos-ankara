import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DroneSim} from '../drone/sim.js';
import {createDefaultRoute} from '../drone/mission.js';
import {assessFlight,assessmentCsv,FlightAssessment} from '../drone/assessment.js';
import {resultHtml} from '../drone/result.js';
const run=(s,t,dt=.05)=>{for(let i=0;i<Math.round(t/dt);i++)s.tick(dt);};
const start=()=>{const s=new DroneSim({x:0,z:0});s.start(createDefaultRoute(s.home),80);return s;};

test('full six-point flight earns 100, including takeoff, turns and landing',()=>{
  const s=start();run(s,700);const r=assessFlight(s);
  assert.equal(s.mode,'complete');assert.equal(r.completed,6);assert.equal(r.score,100);
  assert.equal(r.returns[0].source,'Otopilot');assert.equal(s.track.at(-1).mode,'complete');
});
test('early manual return is safe, partial and explicitly attributed to pilot',()=>{
  const s=start();run(s,45);s.returnHome();run(s,200);const r=assessFlight(s);
  assert.equal(r.outcome,'Güvenli erken dönüş');assert.equal(r.score,100);assert.ok(r.completed<6);
  assert.equal(r.returns[0].source,'Pilot');assert.match(resultHtml(s),/Güvenli erken dönüş puan kaybettirmez/);
});
test('link-loss and imposed battery scenarios are not attributed to student decisions',()=>{
  for(const scenario of ['link','battery']){
    const s=start();run(s,45);s.setScenario(scenario);run(s,220);
    const r=assessFlight(s);assert.equal(r.score,100);assert.equal(r.returns[0].source,'Otopilot');
    if(scenario==='battery')assert.match(r.rows[3].detail,/Eğitmenin/);
  }
});
test('continuous deviations count once and use simulation duration across tick rates',()=>{
  const results=[];
  for(const dt of [.02,.05,.1]){
    const a=new FlightAssessment(80);
    for(let i=0;i<Math.round(12/dt);i++)a.measure(a.route,45,30,dt);
    assert.equal(a.route.episodes,1);assert.ok(Math.abs(a.route.seconds-10)<1e-6);
    a.measure(a.route,0,30,dt);
    for(let i=0;i<Math.round(3/dt);i++)a.measure(a.route,45,30,dt);
    results.push(a.route.episodes);assert.ok(Math.abs(a.route.seconds-11)<1e-6);
  }
  assert.deepEqual(results,[2,2,2]);
});
test('short deviation below two seconds is not penalized',()=>{
  const a=new FlightAssessment(80);for(let i=0;i<19;i++)a.measure(a.route,100,30,.1);
  a.measure(a.route,0,30,.1);assert.equal(a.route.episodes,0);assert.equal(a.route.seconds,0);
});
test('holding on the return corridor is not a deviation from the abandoned mission leg',()=>{
  const s=start();run(s,190);s.returnHome();run(s,30);s.hold();run(s,15);
  assert.equal(s.assessment.route.episodes,0);s.returnHome();run(s,250);
  assert.equal(assessFlight(s).score,100);
});
test('wind mission and varied tick rates keep the nominal flight score unchanged',()=>{
  for(const dt of [.02,.1]){const s=start();run(s,30,dt);s.setScenario('wind');run(s,800,dt);
    assert.equal(s.mode,'complete');assert.equal(assessFlight(s).score,100);}
});
test('manual off-route descent affects route and altitude scores',()=>{
  const s=start();run(s,35);s.mode='manual';s.manual={forward:0,side:1,vertical:-1,yaw:0};run(s,15);
  s.manual={forward:0,side:0,vertical:0,yaw:0};s.returnHome();run(s,220);
  const r=assessFlight(s);assert.ok(r.rows[0].earned<20);assert.ok(r.rows[1].earned<20);assert.ok(r.score<100);
});
test('pause freezes assessment and restart clears all observations',()=>{
  const s=start();run(s,35);s.paused=true;const before=JSON.stringify(s.assessment);run(s,80);
  assert.equal(JSON.stringify(s.assessment),before);s.paused=false;s.returnHome();run(s,200);
  s.start(createDefaultRoute(s.home),60);assert.equal(s.assessment.altitude,60);assert.equal(s.assessment.returns.length,0);assert.equal(s.assessment.route.max,0);
});
test('one continuous boundary excursion remains one event even during RTH',()=>{
  const s=start();run(s,35);s.x=2020;s.z=0;run(s,4);
  assert.equal(s.assessment.boundary.episodes,1);assert.ok(s.assessment.boundary.seconds>0);
  run(s,280);assert.equal(assessFlight(s).rows[2].earned,10);
});
test('collision and exhaustion cannot produce a successful high score',()=>{
  const s=new DroneSim({x:0,z:0},()=>0,x=>x>20);s.start([{x:100,z:0}],30);run(s,100);
  assert.equal(s.assessment.failure,'collision');assert.ok(assessFlight(s).score<=39);
  const b=start();run(b,35);b.battery=.01;run(b,1);assert.equal(b.assessment.failure,'battery');
  assert.equal(assessFlight(b).rows[3].earned,0);assert.ok(assessFlight(b).score<=39);
});
test('in-progress CSV has no final score; final export includes explainable breakdown',()=>{
  const s=start();run(s,10);assert.equal(assessFlight(s).score,null);
  assert.match(assessmentCsv(assessFlight(s)).join('\n'),/Henüz kesinleşmedi/);
  s.returnHome();run(s,100);const csv=assessmentCsv(assessFlight(s)).join('\n');
  assert.match(csv,/"guvenlik_puani","100"/);assert.match(csv,/"Pilot"/);assert.match(csv,/Rota takibi/);
});
