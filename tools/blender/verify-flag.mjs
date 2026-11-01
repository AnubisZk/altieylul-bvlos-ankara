// Türk bayrağı GLB doğrulaması (Node; tarayıcı gerekmez):  node tools/blender/verify-flag.mjs [models/turk-bayragi.glb]
// Kontroller: FlagPole + TurkishFlag düğümleri, morph target'lar ve "weights" animasyonu, 120 kare döngü (ilk = son),
// direk kenarı tüm hedeflerde sabit, ön/arka yüz, gömülü dokular (dış dosya yok). Hata varsa çıkış kodu 1.
// Three.js GLTFLoader + AnimationMixer ile tarayıcı içi kontrol: tools/blender/flag-check.html (npm start sonrası).
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';

export async function verifyFlag(file){
  const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file);
  const root=doc.getRoot(),fails=[],info={};
  const node=n=>root.listNodes().find(x=>x.getName()===n);
  const flag=node('TurkishFlag'),pole=node('FlagPole');
  if(!flag)fails.push('TurkishFlag düğümü yok');if(!pole)fails.push('FlagPole düğümü yok');
  if(!flag)return {fails,info};
  const prim=flag.getMesh().listPrimitives()[0];
  const targets=prim.listTargets();info.morphTargets=targets.length;
  if(targets.length<2)fails.push('morph target yok');
  const pos=prim.getAttribute('POSITION'),n=pos.getCount();info.vertices=n;
  // direk kenarı: dinlenme konumunda en küçük x (direğe en yakın) köşeler
  const v=[0,0,0],d=[0,0,0];let minX=Infinity;for(let i=0;i<n;i++){pos.getElement(i,v);minX=Math.min(minX,v[0])}
  const hoist=[];for(let i=0;i<n;i++){pos.getElement(i,v);if(Math.abs(v[0]-minX)<1e-4)hoist.push(i)}
  info.hoistVertices=hoist.length;
  let maxHoist=0,maxFly=0;
  for(const t of targets){const tp=t.getAttribute('POSITION');for(let i=0;i<n;i++){tp.getElement(i,d);const m=Math.hypot(...d);if(hoist.includes(i))maxHoist=Math.max(maxHoist,m);else maxFly=Math.max(maxFly,m)}}
  info.maxHoistDelta=maxHoist;info.maxFlyDelta=maxFly;
  if(maxHoist>1e-4)fails.push(`direk kenarı hareket ediyor (${maxHoist.toFixed(5)} m)`);
  if(maxFly<0.05)fails.push('serbest uç hareket etmiyor');
  // animasyon
  const anims=root.listAnimations();info.animations=anims.map(a=>a.getName());
  const ch=anims.flatMap(a=>a.listChannels()).find(c=>c.getTargetPath()==='weights'&&c.getTargetNode()===flag);
  if(!ch)fails.push('morph ağırlık (weights) animasyonu yok');
  else{
    const s=ch.getSampler(),times=s.getInput().getArray(),vals=s.getOutput().getArray(),k=targets.length;
    info.duration=+times[times.length-1].toFixed(4);info.keyframes=times.length;info.interpolation=s.getInterpolation();
    const first=vals.slice(0,k),last=vals.slice(vals.length-k);
    const jump=Math.max(...first.map((x,i)=>Math.abs(x-last[i])));info.loopJump=jump;
    if(jump>1e-4)fails.push('ilk ve son kare ağırlıkları farklı (döngüde sıçrama)');
    for(let f=0;f<times.length;f++){const sum=vals.slice(f*k,f*k+k).reduce((a,b)=>a+b,0);if(Math.abs(sum-1)>1e-3){fails.push(`kare ${f}: ağırlık toplamı ${sum.toFixed(3)} (1 olmalı)`);break}}
  }
  // ön/arka yüz: aynı konumda ters normallerle iki katman
  const nor=prim.getAttribute('NORMAL');let opposite=0;
  if(nor){const seen=new Map(),a=[0,0,0],b=[0,0,0];for(let i=0;i<n;i++){pos.getElement(i,v);const key=v.map(x=>x.toFixed(4)).join();if(seen.has(key)){nor.getElement(i,a);nor.getElement(seen.get(key),b);if(a[0]*b[0]+a[1]*b[1]+a[2]*b[2]<-0.9)opposite++}else seen.set(key,i)}}
  info.backFacePairs=opposite;if(opposite<n/4)fails.push('ön/arka yüz katmanı bulunamadı');
  // dokular gömülü mü
  const tex=root.listTextures();info.textures=tex.map(t=>`${t.getMimeType()} ${t.getSize()?.join('×')}`);
  if(!tex.length)fails.push('doku yok');if(tex.some(t=>t.getURI()&&!t.getImage()))fails.push('dış dosyaya bağlı doku var');
  const flagMat=prim.getMaterial();if(!flagMat?.getBaseColorTexture())fails.push('bayrak malzemesinde ana renk dokusu yok');
  return {fails,info};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const file=process.argv[2]||'models/turk-bayragi.glb';
  const {fails,info}=await verifyFlag(file);
  console.log(JSON.stringify(info,null,1));
  if(fails.length){console.error('HATALAR:\n - '+fails.join('\n - '));process.exit(1)}
  console.log('Tamam: bayrak GLB doğrulandı.');
}
