import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {heightSampler,createObstacleIndex} from '../drone/ankara-world.js';
import {createUtm} from '../src/maps/utm.js';
import {createDefaultRoute} from '../drone/mission.js';
import {DroneSim,validRoute} from '../drone/sim.js';
import {searchRoute} from '../drone/night-state.js';
import {searchAreas,chooseSearchPoint} from '../drone/search-site.js';
import {musicTrackAt} from '../drone/music-zone.js';
import {pointInRing} from '../drone/area.js';
import {createLaunchSite} from '../drone/launch-site.js';
import {imageryConfig} from '../tools/build/imagery-config.mjs';

const read=file=>JSON.parse(fs.readFileSync(new URL('../data/ank/'+file,import.meta.url),'utf8'));
const region=read('region.json'),utm=createUtm(region.crs);
const local=(lon,lat)=>{const [e,n]=utm.fwd(lon,lat);return {x:e-region.originUTM[0],z:region.originUTM[1]-n}};
const home=local(region.home.lon,region.home.lat),ground=heightSampler(read('terrain.json'),880);
const index=createObstacleIndex(read('buildings.json').buildings,ground);
const world={getGroundHeight:ground,getObstacleHeight:index.heightAt,hitTest:index.hitTest,isWater:()=>false,searchAreas:searchAreas(read('ground.json'),local)};
function fly(route,alt){const sim=new DroneSim(home,ground,(x,y,z)=>!!index.hitTest(x,y,z,.2));assert(sim.start(route,alt));for(let i=0;i<30000&&sim.active();i++)sim.tick(.1);return sim;}

test('all Ankara presets complete over the packaged terrain and 8313 building obstacles',()=>{
  const full=createDefaultRoute(home);
  for(const [route,alt] of [[full,80],[[full[0],full[1],full[5]],60],[[...full].reverse(),80]]){
    const sim=fly(route,alt);assert.equal(sim.mode,'complete');assert.equal(sim.index,route.length);assert(sim.battery>10);
  }
});
test('Ankara night search selects an actual green polygon and completes the route with real obstacles',()=>{
  const p=chooseSearchPoint(world,home);assert(p,'packaged OSM data must offer a search location');
  const area=world.searchAreas.find(a=>a.id===p.areaId);assert(pointInRing(p.x,p.z,area.ring));
  assert(world.getObstacleHeight(p.x,p.z)<=p.y+.2);
  assert(validRoute(searchRoute(p),home));assert.equal(fly(searchRoute(p),80).mode,'complete');
});
test('search never silently chooses a street or blocked ground when green areas are absent or unsafe',()=>{
  assert.equal(chooseSearchPoint({...world,searchAreas:[]},home),null);
  assert.equal(chooseSearchPoint({...world,getObstacleHeight:()=>Infinity},home),null);
  assert.equal(chooseSearchPoint({...world,isWater:()=>true},home),null);
});
test('music uses Anıtkabir park geometry and holds its selection within the boundary band',()=>{
  const zone=read('music-zone.json');
  assert.equal(musicTrackAt({x:0,z:0},zone),'anitkabir');
  assert.equal(musicTrackAt({x:1900,z:0},zone),'ankara');
  const box={ring:[[0,0],[100,0],[100,100],[0,100]]};
  assert.equal(musicTrackAt({x:2,z:50},box,'ankara'),'ankara');
  assert.equal(musicTrackAt({x:10,z:50},box,'ankara'),'anitkabir');
  assert.equal(musicTrackAt({x:-2,z:50},box,'anitkabir'),'anitkabir');
  assert.equal(musicTrackAt({x:-10,z:50},box,'anitkabir'),'ankara');
});
test('Vercel public key overrides local configuration; missing keys clear any previous build configuration',()=>{
  const key='test-placeholder-not-a-real-key';
  assert.equal(imageryConfig({env:{ARCGIS_API_KEY:key},readLocal:()=>{throw Error('must not read local credentials')}}).apiKey,key);
  assert.equal(imageryConfig({env:{},readLocal:()=>({apiKey:key})}).apiKey,key);
  assert.equal(imageryConfig({env:{}}).apiKey,'');
  assert.throws(()=>imageryConfig({env:{ARCGIS_API_KEY:'invalid'}}),/yapılandırması/);
  assert.throws(()=>imageryConfig({env:{},readLocal:()=>({apiKey:12})}),/yapılandırması/);
});
test('Tandoğan windsock responds to wind and leaves the takeoff column clear',()=>{
  const scene=new T.Scene(),site=createLaunchSite({scene,home,world,reducedMotion:true});
  assert.equal(site.counts.windsocks,1);assert.equal(site.hitTest(home.x,ground(home.x,home.z)+1,home.z,.3),null);
  const sock=scene.children[0].children[1];site.update(.1,{speed:0,direction:0});const droop=sock.rotation.z;
  site.update(.1,{speed:8,direction:90});assert.equal(sock.rotation.z,0);assert(droop<0);assert(Math.abs(sock.rotation.y+Math.PI)<1e-8);
});
