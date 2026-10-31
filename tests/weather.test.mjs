import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWeatherState,WEATHER_PRESETS} from '../drone/weather.js';

test('clear preserves original atmosphere; invalid weather and time cannot poison it',()=>{
  const w=createWeatherState();assert.deepEqual(w.step(1),{overcast:0,hazeBoost:0});
  for(const id of ['rain','__proto__','toString',undefined])assert.equal(w.select(id),false);
  for(const dt of [NaN,Infinity,-1])assert.deepEqual(w.step(dt),{overcast:0,hazeBoost:0});
  assert.equal(w.selected,'clear');
});
test('weather transition is gradual, bounded and independent of render rate',()=>{
  function run(hz){const w=createWeatherState();w.select('hazy');let value;for(let i=0;i<hz*3;i++)value=w.step(1/hz);return value;}
  const a=run(30),b=run(90);assert.ok(Math.abs(a.hazeBoost-b.hazeBoost)<1e-9);
  assert.ok(a.hazeBoost>0&&a.hazeBoost<65);
  const w=createWeatherState();w.select('cloudy');assert.ok(w.step(1/60).overcast<.02);
  assert.deepEqual(w.step(100),{overcast:1,hazeBoost:2});
});
test('switching during a transition is continuous and clear fully restores the baseline',()=>{
  const w=createWeatherState();w.select('hazy');const before=w.step(2);w.select('cloudy');
  const after=w.step(0);assert.deepEqual(before,after);
  w.select('clear');assert.deepEqual(w.step(100),{overcast:0,hazeBoost:0});
  for(const id of Object.keys(WEATHER_PRESETS)){w.select(id);const value=w.step(100);assert.ok(value.overcast>=0&&value.overcast<=1);assert.ok(value.hazeBoost>=0&&value.hazeBoost<=80);}
});
