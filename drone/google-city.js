// Gerçekçi şehir: Google Photorealistic 3D Tiles (Map Tiles API) → Ankara yerel çerçevesi.
//
// - Anahtar data/ank/tiles3d.json'dan gelir (derlemede GOOGLE_MAPS_TILES_KEY ortam değişkeni; kaynakta anahtar yok).
//   Anahtar yoksa katman hiç kurulmaz, OSM kutu binaları ve GLO-30 arazi kullanılır.
// - Çerçeve: ECEF → başlangıç noktasında ENU (x doğu, y yukarı, z güney); UTM 36N ızgara yakınsaması ve ölçek
//   düzeltilir. Dikey: GLO-30 (EGM2008, deniz seviyesi) ile elipsoit arasındaki geoit farkı önce tahmini değerle,
//   tiles yüklenince Tören Meydanı zeminine ışın atılarak kalibre edilir.
// - "Koruma alanı" (Anıtkabir modeli + Aslanlı Yol): Google ağı orada gölgelendiricide atılır, bizim modellerimiz
//   görünür; koruma alanı dışında bizim arazimiz ve OSM binaları gizlenir (çarpışma için OSM kutuları kalır).
// - Google koşulları: önbelleğe/çevrimdışı alma yok, Google adı ve veri kaynakları ekranda gösterilir.
import * as T from 'three';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {TilesRenderer} from '3d-tiles-renderer';
import {GoogleCloudAuthPlugin,GLTFExtensionsPlugin,TileCompressionPlugin,UpdateOnChangePlugin} from '3d-tiles-renderer/plugins';
import {keepUniforms,clipToKeep} from './keep-zone.js';

const GEOID_GUESS=36.5;          // Ankara'da EGM2008 geoit yüksekliği yaklaşık (m); kalibrasyonla düzeltilir
/** ECEF → yerel (x doğu, y elipsoit yüksekliği, z güney) matrisi; UTM ızgara yakınsaması ve ölçeği dahil. */
export function localFrame(ell,region,utm){
  const D=Math.PI/180,{lon,lat}=region.origin;
  const enu=new T.Matrix4();ell.getEastNorthUpFrame(lat*D,lon*D,0,enu);
  const toEnu=enu.clone().invert();
  // başlangıçtan 1 km gerçek kuzeydeki noktanın UTM'deki yerel karşılığı → dönüş açısı ve ölçek
  const [e0,n0]=utm.fwd(lon,lat),[e1,n1]=utm.fwd(lon,lat+0.009);
  const p=new T.Vector3();ell.getCartographicToPosition((lat+0.009)*D,lon*D,0,p);p.applyMatrix4(toEnu);
  const lx=e1-e0,lz=-(n1-n0),theta=Math.atan2(-lx,-lz),k=Math.hypot(lx,lz)/Math.hypot(p.x,p.y);
  const conv=new T.Matrix4().set(1,0,0,0, 0,0,1,0, 0,-1,0,0, 0,0,0,1);   // (doğu, kuzey, yukarı) → (x, y, z=güney)
  return new T.Matrix4().makeRotationY(theta).multiply(new T.Matrix4().makeScale(k,1,k)).multiply(conv).multiply(toEnu);
}

/** cfg: data/ank/tiles3d.json ({apiKey, dracoPath?, geoidHeight?}); anahtar yoksa çağırmayın. */
export async function createGoogleCity({renderer,camera,region,utm,keep,anchor,onState=()=>{},cfg}){
  const key=cfg.apiKey.trim();
  const tiles=new TilesRenderer();
  let auth=new GoogleCloudAuthPlugin({apiToken:key,autoRefreshToken:true});
  tiles.registerPlugin(auth);
  const draco=new DRACOLoader().setDecoderPath(cfg.dracoPath||'vendor/draco/');
  tiles.registerPlugin(new GLTFExtensionsPlugin({dracoLoader:draco}));
  tiles.registerPlugin(new TileCompressionPlugin());
  tiles.registerPlugin(new UpdateOnChangePlugin());
  tiles.errorTarget=12;
  tiles.setCamera(camera);tiles.setResolutionFromRenderer(camera,renderer);

  const ell=tiles.ellipsoid,frame=localFrame(ell,region,utm);
  const holder=new T.Group();holder.name='google-3d-tiles';holder.matrixAutoUpdate=false;
  let geoid=cfg.geoidHeight??GEOID_GUESS;
  const place=()=>{holder.matrix.makeTranslation(0,-geoid,0).multiply(frame);holder.matrixWorldNeedsUpdate=true};
  place();holder.add(tiles.group);

  const uniforms=keepUniforms(keep),shade={uCityShade:{value:1}};
  tiles.addEventListener('load-model',({scene})=>scene.traverse(o=>{
    if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];
    for(const m of mats)if(m&&!m.userData.ankKeep){m.userData.ankKeep=true;clipToKeep(m,uniforms,1,shade)}
  }));
  let errors=0;
  tiles.addEventListener('load-error',e=>{errors++;if(errors===1)onState({status:'error',message:String(e?.error?.message||e?.error||'')})});
  tiles.addEventListener('load-root-tileset',()=>onState({status:'loading'}));

  // dikey kalibrasyon: Tören Meydanı zeminine aşağı ışın
  const ray=new T.Raycaster();let calib=0,calibAt=0,calibrated=false;
  const calibrate=now=>{
    if(!anchor||calib>=6||now-calibAt<4000)return;calibAt=now;
    holder.updateMatrixWorld(true);ray.set(new T.Vector3(anchor.x,anchor.y+400,anchor.z),new T.Vector3(0,-1,0));ray.far=900;
    const hit=ray.intersectObject(tiles.group,true)[0];if(!hit)return;
    const dy=anchor.y-hit.point.y;if(Math.abs(dy)>80)return;   // yanlış yüzey (bulut/çatı) — atla
    geoid-=dy;place();calib++;
    if(!calibrated){calibrated=true;onState({status:'ready',geoid})}
  };
  let enabled=true,lastNow=0,frameMs=16,tuneAt=0,minError=6;
  return {
    object:holder,tiles,uniforms,
    get enabled(){return enabled},
    setEnabled(v){enabled=!!v;holder.visible=enabled},
    retry(){
      if(!errors)return;
      // Failed token refresh promises are retained by the auth plugin. Recreate it
      // for an explicit retry without touching private plugin fields.
      const token=auth.auth.sessionToken;tiles.unregisterPlugin(auth);
      auth=new GoogleCloudAuthPlugin({apiToken:key,autoRefreshToken:true});
      auth.auth.sessionToken=token;tiles.registerPlugin(auth);
      errors=0;calib=0;calibAt=0;calibrated=false;tiles.resetFailedTiles();
    },
    setShade(v){shade.uCityShade.value=v},
    setQuality(q){minError=q==='low'?16:q==='high'?4:6},
    attributions(){try{return tiles.getAttributions().filter(a=>a.type==='string').map(a=>a.value).join(' · ')}catch{return ''}},
    update(now){
      if(!enabled)return;
      // uyarlamalı ayrıntı: kare hızı yüksekse daha keskin (errorTarget ↓), düşükse daha kaba (↑)
      if(lastNow){const dt=now-lastNow;frameMs=frameMs*0.95+dt*0.05}lastNow=now;
      if(now-tuneAt>2000){tuneAt=now;tiles.errorTarget=frameMs<20?Math.max(minError,tiles.errorTarget-2):frameMs>33?Math.min(24,tiles.errorTarget+2):tiles.errorTarget}
      camera.updateMatrixWorld();holder.updateMatrixWorld();
      tiles.setResolutionFromRenderer(camera,renderer);tiles.update();calibrate(now);
    },
    raycastGround(x,z){ray.set(new T.Vector3(x,3000,z),new T.Vector3(0,-1,0));ray.far=4000;const h=ray.intersectObject(tiles.group,true)[0];return h?h.point.y:null},
    dispose(){tiles.dispose();draco.dispose()},
  };
}
