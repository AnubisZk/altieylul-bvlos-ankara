import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {WGS84_ELLIPSOID} from '3d-tiles-renderer';
import {createUtm} from '../src/maps/utm.js';
import {keepZones} from '../drone/keep-zone.js';

const region=JSON.parse(fs.readFileSync('data/ank/region.json','utf8'));
test('Google 3D Tiles çerçevesi: ECEF noktaları UTM yerel koordinatına < 1 m oturur (Atakule 4.5 km)',async()=>{
  const {localFrame}=await import('../drone/google-city.js');
  const utm=createUtm(region.crs),M=localFrame(WGS84_ELLIPSOID,region,utm),[e0,n0]=utm.fwd(region.origin.lon,region.origin.lat);
  // Anıt Blok, Atakule, Kızılay, Tandoğan, 3 km köşe
  for(const [lon,lat] of [[region.origin.lon,region.origin.lat],[32.8556,39.8858],[32.8544,39.9208],[32.8351,39.9303],[32.80,39.95]]){
    const p=new T.Vector3();WGS84_ELLIPSOID.getCartographicToPosition(lat*Math.PI/180,lon*Math.PI/180,900,p);p.applyMatrix4(M);
    const [e,n]=utm.fwd(lon,lat),x=e-e0,z=-(n-n0),d=Math.hypot(p.x-x,p.z-z);
    assert.ok(d<1.0,`${lon},${lat}: ${d.toFixed(2)} m`);
    const drop=(x*x+z*z)/(2*6371000);   // teğet düzlem: uzak noktalar dünya eğriliği kadar alçakta (4.5 km → 1.6 m)
    assert.ok(Math.abs(p.y-(900-drop))<0.3,`yükseklik ${p.y.toFixed(2)}, beklenen ${(900-drop).toFixed(2)}`);
  }
});
test('koruma alanı: Anıtkabir, Aslanlı Yol ve kalkış pisti; Tören Meydanı içeride, Kızılay dışarıda',()=>{
  const mon=JSON.parse(fs.readFileSync('data/ank/anitkabir.json','utf8')),road=JSON.parse(fs.readFileSync('data/ank/aslanli-yol.json','utf8'));
  const zones=keepZones({monument:mon,road,home:{x:-250,z:-500}});assert.equal(zones.length,3);
  const inK=(x,z)=>zones.some(r=>{const dx=x-r.c[0],dz=z-r.c[1];return Math.abs(dx*r.u[0]+dz*r.u[1])<=r.h[0]&&Math.abs(-dx*r.u[1]+dz*r.u[0])<=r.h[1]});
  const [c,sn]=mon.anitBlok.axis;assert.ok(inK(-110*c,-110*sn));assert.ok(inK(0,0));
  assert.ok(inK(...[road.start[0]+road.dir[0]*100,road.start[1]+road.dir[1]*100]));
  assert.ok(!inK(1400,500));
});
