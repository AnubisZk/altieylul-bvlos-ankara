// Koruma alanı: Anıtkabir modeli, Aslanlı Yol ve kalkış pisti. Gerçekçi şehir (google-city.js) açıkken Google ağı bu
// yönlü dikdörtgenlerin içinde, bizim arazimiz dışında gölgelendiricide atılır.
import * as T from 'three';

const MAX_KEEP=4;
export const KEEP_GLSL=`uniform vec4 uKeepC[${MAX_KEEP}];uniform vec2 uKeepH[${MAX_KEEP}];uniform float uKeepN;uniform float uKeepMode;
bool ankInKeep(vec2 p){for(int i=0;i<${MAX_KEEP};i++){if(float(i)>=uKeepN)break;vec2 d=p-uKeepC[i].xy,u=uKeepC[i].zw;
  if(abs(dot(d,u))<=uKeepH[i].x&&abs(dot(d,vec2(-u.y,u.x)))<=uKeepH[i].y)return true;}return false;}`;

/** Yönlü dikdörtgenler: {c:[x,z], u:[ux,uz] birim eksen, h:[yarı uzunluk u, yarı en]}. */
export function keepZones({monument,road,home=null}){
  const out=[];
  const rectOf=(pts,u)=>{const v=[-u[1],u[0]];let a0=1e9,a1=-1e9,b0=1e9,b1=-1e9;
    for(const [x,z] of pts){const a=x*u[0]+z*u[1],b=x*v[0]+z*v[1];a0=Math.min(a0,a);a1=Math.max(a1,a);b0=Math.min(b0,b);b1=Math.max(b1,b)}
    const ca=(a0+a1)/2,cb=(b0+b1)/2;return {c:[ca*u[0]+cb*v[0],ca*u[1]+cb*v[1]],u,h:[(a1-a0)/2,(b1-b0)/2]}};
  if(monument?.footprint?.length>=4){const [p0,p1]=monument.footprint,l=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]);out.push(rectOf(monument.footprint,[(p1[0]-p0[0])/l,(p1[1]-p0[1])/l]))}
  if(road?.footprint?.length>=3)out.push(rectOf(road.footprint,road.dir));
  if(home)out.push({c:[home.x,home.z],u:[1,0],h:[18,18]});   // kalkış pisti: bizim zemin (pist modeli ve fizik DEM'e göre)
  return out;
}

export function keepUniforms(zones){
  const C=Array.from({length:MAX_KEEP},()=>new T.Vector4()),H=Array.from({length:MAX_KEEP},()=>new T.Vector2());
  zones.slice(0,MAX_KEEP).forEach((z,i)=>{C[i].set(z.c[0],z.c[1],z.u[0],z.u[1]);H[i].set(z.h[0],z.h[1])});
  return {uKeepC:{value:C},uKeepH:{value:H},uKeepN:{value:Math.min(zones.length,MAX_KEEP)},uKeepMode:{value:0}};
}

/** Malzemeye koruma alanı kırpması ekler. mode: 1 = alan içini at (Google), 2 = alan dışını at (bizim arazi). */
export function clipToKeep(material,uniforms,mode,extra=null){
  const prev=material.onBeforeCompile;
  material.onBeforeCompile=(shader,r)=>{
    prev?.call(material,shader,r);
    Object.assign(shader.uniforms,uniforms,{uKeepMode:mode==null?uniforms.uKeepMode:{value:mode}});
    if(extra)Object.assign(shader.uniforms,extra);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vKeepW;')
      .replace('#include <project_vertex>','#include <project_vertex>\nvKeepW=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vKeepW;\n'+KEEP_GLSL+(extra?'\nuniform float uCityShade;':''))
      .replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
if(uKeepMode>0.5){bool k=ankInKeep(vKeepW.xz);if((uKeepMode<1.5&&k)||(uKeepMode>1.5&&!k))discard;
  // bizim arazide koruma alanı kenarındaki dik geçiş yüzleri (anıt zemini ↔ DEM) gerilmiş fotoğraf şeridi gibi görünür
  if(uKeepMode>1.5){vec3 kn=normalize(cross(dFdx(vKeepW),dFdy(vKeepW)));if(abs(kn.y)<0.45)discard;}}`)
      .replace('#include <opaque_fragment>',extra?'gl_FragColor.rgb*=uCityShade;\n#include <opaque_fragment>':'#include <opaque_fragment>');
  };
  const key=material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey=()=>(key?key():'')+'|keep'+mode+(extra?'s':'');
  material.needsUpdate=true;
}

