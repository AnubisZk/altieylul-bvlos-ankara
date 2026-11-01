// Gerçekçi ama hafif şehir binaları (OSM ayak izleri): cephe dokusu (kat ve pencere aksı, gerçek metre ölçeğinde),
// bina başına sıva rengi, düz beton / kiremit çatılar. Üç malzeme + çatı = 4 çizim çağrısı, tek birleşik geometri
// grubu; dokular tarayıcıda canvas ile üretilir (indirilecek ek dosya yok). Yükseklikler OSM'de çoğunlukla tahminidir.
import * as T from 'three';

const BAY=3.2,FLOOR=3.0;   // bir pencere aksı ve kat yüksekliği (m) — doku tekrarı bunlara göre
// Ankara apartman sıvaları: krem, bej, açık oker, kirli beyaz, somon, açık gri
const PLASTER=['#e9dfcc','#ddd0b6','#d8c49d','#efe9df','#e3c9b3','#cfcac0','#e6d6bd','#d9cfc2','#c9b8a0','#eadbc8'];

function canvasTexture(draw,size=256){
  const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');draw(g,size);
  const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;return t;
}
function plaster(g,s,seed){
  g.fillStyle='#fff';g.fillRect(0,0,s,s);let r=seed;
  for(let i=0;i<2600;i++){r=(r*1664525+1013904223)>>>0;const x=r%s;r=(r*1664525+1013904223)>>>0;const y=r%s;g.fillStyle=i%2?'rgba(0,0,0,.035)':'rgba(255,255,255,.05)';g.fillRect(x,y,2,2)}
  g.fillStyle='rgba(0,0,0,.10)';g.fillRect(0,s-3,s,3);                      // kat silmesi
}
function windowPane(g,x,y,w,h){
  g.fillStyle='#4b4b48';g.fillRect(x-3,y-3,w+6,h+6);                       // doğrama
  const grd=g.createLinearGradient(0,y,0,y+h);grd.addColorStop(0,'#5f7480');grd.addColorStop(1,'#23303a');
  g.fillStyle=grd;g.fillRect(x,y,w,h);
  g.fillStyle='#3a3a38';g.fillRect(x+w/2-2,y,4,h);g.fillRect(x,y+h*0.32,w,4);
  g.fillStyle='rgba(255,255,255,.10)';g.fillRect(x+4,y+4,w*0.18,h*0.5);    // yansıma
  g.fillStyle='#bdb6a8';g.fillRect(x-8,y+h+3,w+16,7);                       // denizlik
}
export function facadeTextures(){
  return {
    // pencereli apartman cephesi
    flat:canvasTexture((g,s)=>{plaster(g,s,7);windowPane(g,s*0.27,s*0.22,s*0.46,s*0.52)}),
    // balkonlu cephe (ön cephe izlenimi; her aksta)
    balcony:canvasTexture((g,s)=>{plaster(g,s,11);windowPane(g,s*0.18,s*0.12,s*0.64,s*0.6);
      g.fillStyle='#d9d4c9';g.fillRect(0,s*0.74,s,s*0.06);g.fillStyle='rgba(60,60,58,.85)';for(let x=6;x<s;x+=12)g.fillRect(x,s*0.56,3,s*0.18);g.fillRect(0,s*0.55,s,4)}),
    // ofis / kamu binası: bant pencere, cam giydirme
    office:canvasTexture((g,s)=>{g.fillStyle='#d6d8d6';g.fillRect(0,0,s,s);const grd=g.createLinearGradient(0,0,0,s);grd.addColorStop(0,'#6c8796');grd.addColorStop(1,'#2d3c46');
      g.fillStyle=grd;g.fillRect(0,s*0.18,s,s*0.62);g.fillStyle='#8d9397';for(let x=0;x<s;x+=s/4)g.fillRect(x,s*0.18,5,s*0.62);g.fillStyle='rgba(255,255,255,.12)';g.fillRect(0,s*0.2,s,s*0.08)}),
    roof:canvasTexture((g,s)=>{g.fillStyle='#d2d0ca';g.fillRect(0,0,s,s);let r=3;for(let i=0;i<3000;i++){r=(r*1664525+1013904223)>>>0;g.fillStyle=`rgba(${r&1?40:220},${r&1?40:220},${r&1?40:210},.06)`;g.fillRect(r%s,(r>>>9)%s,3,3)}
      g.strokeStyle='rgba(0,0,0,.12)';g.lineWidth=2;g.strokeRect(1,1,s-2,s-2)}),
  };
}

const hash=s=>{let h=2166136261;for(const ch of String(s))h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0};

/** list: createObstacleIndex(...).list (ring, bottom, top, type, id) → THREE.Group */
export function createCityBuildings(list,{anisotropy=4}={}){
  if(!list.length)return null;
  const tex=facadeTextures();for(const t of Object.values(tex))t.anisotropy=anisotropy;
  const buckets={flat:{p:[],n:[],u:[],c:[]},balcony:{p:[],n:[],u:[],c:[]},office:{p:[],n:[],u:[],c:[]},roof:{p:[],n:[],u:[],c:[]},tile:{p:[],n:[],u:[],c:[]}};
  const col=new T.Color();
  for(const b of list){
    const h=hash(b.id),height=b.top-b.bottom,type=b.type||'yes';
    const kind=/office|commercial|government|public|hospital|university|retail|hotel/.test(type)||height>45?'office':(h%3===0&&height>=9?'balcony':'flat');
    col.set(kind==='office'?'#d3d6d6':PLASTER[h%PLASTER.length]);const shade=0.92+((h>>>8)%16)/100;
    // dış halka saat yönü değilse ters çevir (duvar normalleri dışa)
    let ring=b.ring;let area=0;for(let i=0;i<ring.length;i++){const [x1,z1]=ring[i],[x2,z2]=ring[(i+1)%ring.length];area+=x1*z2-x2*z1}
    if(area>0)ring=[...ring].reverse();
    const W=buckets[kind];let run=0;
    for(let i=0;i<ring.length;i++){
      const [x1,z1]=ring[i],[x2,z2]=ring[(i+1)%ring.length],len=Math.hypot(x2-x1,z2-z1);if(len<0.05)continue;
      const nx=-(z2-z1)/len,nz=(x2-x1)/len;   // üçgen sargısıyla aynı yön (dışa)
      const u0=run/BAY,u1=(run+len)/BAY,v0=0,v1=height/FLOOR;run+=len;
      const quad=[[x1,b.bottom,z1,u0,v0],[x2,b.bottom,z2,u1,v0],[x2,b.top,z2,u1,v1],[x1,b.bottom,z1,u0,v0],[x2,b.top,z2,u1,v1],[x1,b.top,z1,u0,v1]];
      for(const [x,y,z,u,v] of quad){W.p.push(x,y,z);W.n.push(nx,0,nz);W.u.push(u,v);W.c.push(col.r*shade,col.g*shade,col.b*shade)}
    }
    // çatı: düz beton; küçük evlerde kiremit rengi
    const R=(type==='house'||type==='detached'||(height<=7.5&&h%4===0))?buckets.tile:buckets.roof;
    const pts=ring.map(([x,z])=>new T.Vector2(x,z));let tris;try{tris=T.ShapeUtils.triangulateShape(pts,[])}catch{tris=[]}
    col.set(R===buckets.tile?'#a4553a':'#9a9892');const rs=0.9+((h>>>12)%20)/100;
    for(const t of tris){
      const [ax,az]=ring[t[0]],[bx,bz]=ring[t[1]],[cx,cz]=ring[t[2]];
      const up=(bz-az)*(cx-ax)-(bx-ax)*(cz-az)>0;          // (b−a)×(c−a) y bileşeni > 0 → yukarı bakar
      for(const k of up?[t[0],t[1],t[2]]:[t[0],t[2],t[1]]){const [x,z]=ring[k];R.p.push(x,b.top,z);R.n.push(0,1,0);R.u.push(x/6,z/6);R.c.push(col.r*rs,col.g*rs,col.b*rs)}
    }
  }
  const group=new T.Group();group.name='ank-buildings';
  const mats={flat:tex.flat,balcony:tex.balcony,office:tex.office,roof:tex.roof,tile:tex.roof};
  for(const [k,B] of Object.entries(buckets)){
    if(!B.p.length)continue;
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(B.p,3));geo.setAttribute('normal',new T.Float32BufferAttribute(B.n,3));
    geo.setAttribute('uv',new T.Float32BufferAttribute(B.u,2));geo.setAttribute('color',new T.Float32BufferAttribute(B.c,3));
    geo.computeBoundingSphere();
    const m=new T.MeshStandardMaterial({map:mats[k],vertexColors:true,roughness:k==='office'?.55:.9,metalness:0});
    const mesh=new T.Mesh(geo,m);mesh.castShadow=mesh.receiveShadow=true;mesh.name='ank-buildings-'+k;group.add(mesh);
  }
  return group;
}
