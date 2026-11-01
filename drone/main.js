import * as THREE from 'three';
import {createAssetLoader} from '../src/core/assets.js';
import {createAnkaraWorld,ANK_DATA} from './ankara-world.js';
import {lonLatToLocal,localToLonLat,setGeoRegion} from '../src/geo.js';
import {createUtm} from '../src/maps/utm.js';
import {QUALITY} from '../src/core/quality.js';
import {DroneSim,validRoute} from './sim.js';
import {createLaunchSite} from './launch-site.js';
import {createDefaultRoute,HERITAGE} from './mission.js';
import {createMusic} from './music.js';
import {createStreetMap} from './street-map.js';
import {createGuide} from './guide.js';
import {addHeritageGround} from './ground.js';
import {createAerialImagery} from './imagery.js';
import {assessFlight,assessmentCsv} from './assessment.js';
import {resultHtml} from './result.js';
import {createClassroom} from './classroom.js';
import {createWeatherControls} from './weather.js';
import {createPilotControls} from './pilot-controls.js';
import {createNightTraining} from './night-training.js';
import {searchOutcome} from './night-state.js';
import {createGamepadPanel} from './gamepad-panel.js';
import {blendControls} from './gamepad-input.js';
import {gamepadSafety,canLandHere} from './gamepad-flight.js';

const $=s=>document.getElementById(s), L=window.L;
const music=createMusic();
const names={ready:'UÇUŞA HAZIR',takeoff:'OTOMATİK KALKIŞ',mission:'ROTA TAKİBİ',hold:'KONUM KORUMA',manual:'MANUEL UÇUŞ',rth:'EVE DÖNÜŞ',landing:'OTOMATİK İNİŞ',complete:'OTURUM TAMAMLANDI',crashed:'EĞİTİM SONA ERDİ'};
const clock=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
let world,harbor,model,rotors=[],sim,route=[],home,ready=false,editing=false,view='fpv',rate=1,lastEvent=-1,lastMode='',shownReport=false;
let markers=[],routeLine,trailLine,droneMarker,homeMarker,geofence;
// Anıtkabir protection: touching the monument's safety margin never crashes the drone. The step is undone, the drone
// holds position and the pilot is warned (no damage or debris effects on the monument).
let monumentGuard=null,guardNotice=0;
function guardedTick(dt){
  const safe={x:sim.x,y:sim.y,z:sim.z};monumentGuard=null;sim.tick(dt);
  if(!monumentGuard)return;
  sim.x=safe.x;sim.y=safe.y;sim.z=safe.z;sim.speed=0;sim.manualForward=0;sim.manualSide=0;
  if(sim.mode==='mission'||sim.mode==='rth')sim.hold();
  const now=performance.now();if(now-guardNotice>4000){guardNotice=now;sim.log?.('Anıtkabir koruma mesafesi • drone durduruldu');status('Anıtkabir koruma mesafesi: drone durduruldu. Yükselerek veya geri çekilerek uzaklaş.')}
}
// Prevent commands before world/model initialization.
for(const id of ['hold','resume','rth','manual','pause','preset','edit','undo','save','load'])$(id).disabled=true;
let cameraOrbit=0,cameraDistance=2.1,dragX=null;
let heritageSite=null,heritageDistance=210;
for(const site of HERITAGE){const option=document.createElement('option');option.value=site.id;option.textContent=site.name;$('heritage').append(option)}
$('scene').addEventListener('pointerdown',e=>{if(view==='follow'||view==='heritage'||sim?.mode==='ready'){dragX=e.clientX;$('scene').setPointerCapture(e.pointerId)}});
$('scene').addEventListener('pointermove',e=>{if(dragX!==null){cameraOrbit+=(e.clientX-dragX)*.008;dragX=e.clientX}});
$('scene').addEventListener('pointerup',()=>dragX=null);
$('scene').addEventListener('pointercancel',()=>dragX=null);
$('scene').addEventListener('wheel',e=>{if(view==='follow'||view==='heritage'||sim?.mode==='ready'){e.preventDefault();if(view==='heritage')heritageDistance=Math.max(100,Math.min(1600,heritageDistance+e.deltaY*.3));else cameraDistance=Math.max(1.1,Math.min(8,cameraDistance+e.deltaY*.004))}},{passive:false});
const map=L.map('map',{zoomControl:false,zoomSnap:.25});
const streets=createStreetMap(map,L);
streets.show();
$('show-streets').onclick=()=>streets.show();
L.control.zoom({position:'bottomright'}).addTo(map);
const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> katkıcıları'}).addTo(map);
tiles.on('tileerror',()=>{$('map-hint').textContent='Arka plan haritasına ulaşılamadı. Yerel sokak çizgilerini Sokaklar düğmesiyle görebilirsiniz.'});
const coord=p=>{const g=localToLonLat(p.x,p.z);return[g.lat,g.lon]};
function status(text){$('status').textContent=text;}
function dialog(html){$('dialog').setAttribute('aria-label','Bilgi paneli');guide.stop();keys.clear();if(sim?.active()&&!sim.paused)$('pause').click();$('dialog-content').innerHTML=html;$('dialog').showModal();}
$('close-dialog').onclick=()=>$('dialog').close();
const quickStart=`<span class="eyebrow">İLK UÇUŞUN</span><h2>Haritadan gökyüzüne.</h2><ol><li>Altı noktalı örnek rotayı kullan veya <b>Rotayı düzenle</b> seçeneğiyle haritaya en fazla 12 nokta ekle.</li><li>Yüksekliği belirle ve <b>Görevi başlat</b> düğmesine bas. Drone kalkar ve noktaları sırayla takip eder.</li><li>Kamera, harita ve telemetriyi izle. <b>Konum koru</b> ile bekle, <b>Eve dön</b> ile görevi sonlandır.</li><li>Eğitmen masasından rüzgâr hızını ve yönünü seçip uygula. Bağlantı kaybı ve düşük bataryayı da deneyebilirsin. Hava durumu menüsünden açık, bulutlu veya puslu görünümü seç; bu seçim rüzgârı değiştirmez.</li><li>İniş sonrası raporu incele ve CSV olarak indir.</li></ol><p><b>Tarihi yapılar:</b> Kamera altındaki Tarihi yapı incele menüsünden bir yapı seç. Sürükleyerek çevresinde dön, fare tekerleğiyle yaklaş. Uçuş sırasında bu görünüm simülasyonu duraklatır; Drone kamerası ve Devam et ile uçuşa dön.</p><p><b>Gece ve arama eğitimi:</b> Eğitmen menüsündeki açılır bölümden akşam/gece ortamını ve termal kamerayı seç. Kayıp kişi arama rotasını uçuş öncesi hazırla; altı noktalı taramada temsili kişiyi kameranın merkez çevresinde 3 saniye tut. Kamera aşağı eğimini ayarlayabilir, Konum koru ve manuel yön kontrolü kullanabilirsin. Tespitten sonra Eve dön. Termal görüntü gerçek sıcaklık ölçümü değildir.</p><p><b>Serbest uçuş ve yakınlaştırma:</b> Görev başlatmadan kamera altındaki Serbest uçuş düğmesine bas. 3 m otomatik kalkışın ardından W/S, A/D, Q/E ve R/F ile uç. Eve dön ile inişi başlat. Eğitmen masasındaki Uçuş ve kamera ayarlarından Hassas (3), Normal (8), Hızlı (12 m/s) ve 1×/2×/4× kamera yakınlaştırmasını seç. Manuel uçuş zaman hızı 1× kalır. Serbest uçuşta rota ve sabit irtifa puanlanmaz. Manuel uçuş klavye veya oyun koluyla yapılır. Uçuş ve kamera ayarları → Oyun Kolu sekmesinde Mode 2 eşlemesini ve deadzone değerini ayarla.</p><p><b>Yeni deneme:</b> Uçuşu sıfırla ile mevcut uçuşu temizle. Haritayı ⛶ ile büyüt; planını isimle kaydet ve Yükle listesinden seç. Hızın altındaki dikey değer yükselme/alçalma hızıdır.</p><p><b>Manuel kontrol:</b> W/S ileri–geri, A/D yana hareket, Q/E yön, R/F yüksel–alçal. P duraklatır. Oyun kolunda sol analog yükseklik/yön, sağ analog ileri–geri/sağ–sol kontrolüdür. A motorları hazırlar; çubukları bırakıp sol çubuğu yukarı iterek kalk. Çubuğu ortalayınca mevcut yüksekliği korur. Aşağı çekerek uygun zemine in; motorlar açık kalır, A ile kapat. Y ayrıca 3 m otomatik kalkış yapar; B uygun zemine iner, X kamera değiştirir. LT/RT kamera eğimi; Start duraklatma; sol çubuğa basma manuel kontrol; RB eve dön. Havada motor kapatma engellenir. Kol kopunca manuel uçuş konum korur. Kol ayarları açıkken uçuş girdileri kapalıdır; ayarlardan çıkıp çubukları ortalayarak devam et.</p><p>AGL: araziye göre yükseklik. 2 km sınır ve 120 m tavan bu dersin senaryo sınırlarıdır. Model, gerçek uçuş onayı veya sertifikalı pilot eğitimi sağlamaz.</p>`;
const guide=createGuide({music,openDialog:dialog,quickStart});
$('help').onclick=()=>guide.open();
$('credits').onclick=()=>dialog(`<h2>Kaynaklar ve künye</h2><p>Altıeylül BİLSEM için BVLOS Drone Lab · Ankara sürümü ank-0.2.0 (İstanbul v0.9.2 tabanlı)</p><p>Müzik: Anıtkabir yerleşkesinde Atam Sen Rahat Uyu; diğer bölgelerde Ankara’nın Taşına Bak. Kullanıcı tarafından sağlanan kayıtlar; seçim drone konumuna göre yapılır.</p><p>Gökyüzü motoru ve atmosfer sistemi: <a href="https://github.com/erendikmenn/gokyuzu" target="_blank" rel="noopener">Mehmet Eren Dikmen — Gökyüzü</a>. Kod Apache-2.0; varlık paketi CC BY-NC 4.0. Drone, arayüz ve eğitim görevleri bu uyarlama için hazırlanmıştır.</p><p>Arazi: Copernicus DEM GLO-30. İsteğe bağlı ayrıntılı hava / uydu görüntüsü: ArcGIS World Imagery (Esri, Vantor, Earthstar Geographics ve GIS User Community). Anıtkabir çevresindeki yol, yaya yolu ve yeşil alan geometrisi: © OpenStreetMap katkıcıları (<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">ODbL</a>). Yüklü arazi kaynağı: ${world?.sources.terrain||"henüz yüklenmedi"}. Yüklü bina sayısı: ${world?.obstacles.list.length||0}. Zemin renkleri ve eksik yol genişlikleri temsili; bu katman yüksek çözünürlüklü hava fotoğrafı değildir. Binalar: OpenStreetMap (yükseklikler çoğunlukla tahminidir). 2B harita: OpenStreetMap katkıcıları. Ayrıntılar ve üçüncü taraf bildirimleri: <a href="NOTICE">NOTICE</a> · <a href="ASSETS-LICENSE.md">Varlık lisansı</a>.</p><p>Kalkış pedi ve uçuş izni eğitim senaryosudur; gerçekte Anıtkabir çevresinde drone uçuşu yetkili izin gerektirir. Anıtkabir çevresindeki mevcut yapılar OSM tabanlı temsili kütlelerdir; ölçülmüş mimari rekonstrüksiyon değildir. Drone modeli Blender ile üretilmiş özgün BİLSEM Surveyor modelidir. Harita görüntüleri canlı değildir; küçük engellerin tamamını içermez. Bu sürümde rüzgârın hız/enerji etkisi ve bağlantı kaybı eğitim amaçlı basitleştirilmiştir.</p>`);
function plannedDistance(){let last=home,total=0;for(const p of route){total+=Math.hypot(p.x-last.x,p.z-last.z);last=p}return total+Math.hypot(last.x-home.x,last.z-home.z)}
function refreshRoute(){if(!home)return;document.querySelector('.planner h2').textContent=route.length+' noktalı görev';markers.forEach(m=>m.remove());markers=route.map((p,i)=>L.marker(coord(p),{icon:L.divIcon({className:'map-waypoint',html:String(i+1),iconSize:[27,27],iconAnchor:[13,13]})}).addTo(map));if(routeLine)routeLine.remove();routeLine=L.polyline([home,...route,home].map(coord),{color:'#20c9b4',weight:3,dashArray:'6 7'}).addTo(map);$('route-list').innerHTML=route.map((p,i)=>{const g=localToLonLat(p.x,p.z);return `<li><span>${i+1}</span><div>Gözlem noktası ${i+1}<small>${g.lat.toFixed(4)}° K · ${g.lon.toFixed(4)}° D</small></div></li>`}).join('')||'<li>Haritaya dokunarak nokta ekleyin.</li>';$('route-distance').textContent=(plannedDistance()/1000).toFixed(2)+' km';$('route-time').textContent=Math.ceil(plannedDistance()/12/60+Number($('altitude').value)/3/60+Number($('altitude').value)/2/60)+' dk';$('launch').disabled=!ready||route.length===0||!!sim?.active();}
function preset(){if(!home||sim?.active())return;route=createDefaultRoute(home);refreshRoute();}
$('altitude').oninput=()=>{$('alt-out').textContent=$('altitude').value;refreshRoute()};
$('edit').onclick=()=>{if(!editing)training.cancel();editing=!editing;$('edit').classList.toggle('selected',editing);$('edit').textContent=editing?'Düzenlemeyi bitir':'Rotayı düzenle';$('map-hint').textContent=editing?'Nokta eklemek için 2 km sınırı içinde haritaya dokunun.':'Haritayı kaydırabilir ve yakınlaştırabilirsiniz.';};
map.on('click',e=>{if(!editing||!ready||sim.active())return;const p=lonLatToLocal(e.latlng.lng,e.latlng.lat);if(route.length>=12||!validRoute([...route,p],home)){status('En fazla 12 nokta; kalkıştan en çok 2 km uzaklık.');return}route.push(p);refreshRoute()});
$('undo').onclick=()=>{if(sim?.active())return;training.cancel();route.pop();refreshRoute()};$('preset').onclick=preset;
function frameRoute(){streets.hide();map.fitBounds(L.latLngBounds([home,...route].map(coord)),{padding:[35,35],maxZoom:16});}
$('center').onclick=()=>{if(home)frameRoute()};
$('launch').onclick=()=>{if(sim.start(route,+$('altitude').value)){frameRoute();weather.recordStart();training.begin();music.setPaused(false);if(view==='heritage')setView('fpv');shownReport=false;lastEvent=-1;editing=false;$('edit').textContent='Rotayı düzenle';$('edit').classList.remove('selected');$('map-hint').textContent='Görev sürüyor. Turkuaz rota, açık yeşil uçuş izi.';status('Otomatik kalkış başladı. Telemetriyi izleyin.');refreshRoute();}};
$('hold').onclick=()=>{if(!sim.hold())status('Komut iletilemedi: bağlantı yok veya uçuş başlamadı.')};$('resume').onclick=()=>{if(!sim.resume())status('Komut iletilemedi: bağlantı yok veya uçuş başlamadı.')};$('rth').onclick=()=>{if(sim.link===0){status('Bağlantı yok. Otopilotun otomatik eve dönüşünü izleyin.');return}sim.returnHome()};
function beginFreeFlight(stick=false,vertical=0){
  if(!ready||!sim||sim.paused)return;
  if(!sim.active()){
    if(!(stick?sim.startStickFlight(vertical):sim.startFree()))return;training.cancel();training.begin();weather.recordStart();keys.clear();
    shownReport=false;lastEvent=-1;lastMode='';lastTelemetry=null;editing=false;$('edit').textContent='Rotayı düzenle';$('edit').classList.remove('selected');
    $('pause').textContent='Ⅱ Duraklat';setView('fpv');music.setPaused(false);refreshRoute();
    $('map-hint').textContent='Serbest uçuş · planlanan rota izlenmez. Eve dön ile iniş yap.';
    status(stick?'Sol çubukla yüksel; ortalayınca yüksekliği koru.':'Serbest uçuş başladı · 3 m kalkıştan sonra W/S A/D Q/E R/F.');
  }else if(!sim.enterManual())return;
  rate=1;$('rate').textContent='Hız: 1×';updateUI();
}
$('manual').onclick=()=>beginFreeFlight();
$('pause').onclick=()=>{if(!sim?.active())return;sim.paused=!sim.paused;gamepad.suspend();music.setPaused(sim.paused);$('pause').textContent=sim.paused?'▷ Devam et':'Ⅱ Duraklat';status(sim.paused?'Simülasyon duraklatıldı.':'Simülasyon devam ediyor.')};
$('apply-scenario').onclick=()=>{if(!sim?.active()){status('Senaryoyu uygulamak için önce görevi başlatın.');return}sim.setScenario($('scenario').value);if($('scenario').value==='wind')sim.setWind(+$('wind-speed').value,+$('wind-direction').value)};
$('rate').onclick=()=>{if(sim?.mode==='manual'||sim?.flightKind==='free'){status('Manuel kontrol gerçek zaman hızında çalışır.');return;}rate=rate===1?4:1;$('rate').textContent='Hız: '+rate+'×';status(rate===4?'Eğitim zamanı 4 kat hızlandırıldı.':'Gerçek zaman hızına dönüldü.')};
function setView(v){view=v;if(v!=='heritage')$('heritage').value='';$('fpv').classList.toggle('selected',v==='fpv');$('follow').classList.toggle('selected',v==='follow');$('camera-label').textContent=v==='heritage'?'02 / YAPI İNCELEME · '+heritageSite.name:v==='fpv'?'02 / DRONE KAMERASI':'02 / DIŞ GÖRÜNÜM';$('crosshair').hidden=v!=='fpv';$('coordinates').hidden=v==='heritage';$('heading').hidden=v==='heritage'}
$('fpv').onclick=()=>setView('fpv');$('follow').onclick=()=>setView('follow');
$('heritage').onchange=()=>{if(!ready)return;const choice=HERITAGE.find(s=>s.id===$('heritage').value);if(!choice){setView('fpv');return}const point=world.landmarks.landmarks.find(s=>s.id===choice.id);heritageSite={...point,name:choice.name};heritageDistance=choice.distance;cameraOrbit=0;if(sim.active()&&!sim.paused)$('pause').click();setView('heritage');status('Yapı inceleme kamerası · Sürükleyerek dön, tekerlekle yaklaş. Uçuşa dönmek için Drone kamerasını seç.');};
const classroom=createClassroom({getState:()=>({sim,home,route,alt:+$('altitude').value}),dialog,status,
  resizeMap:()=>requestAnimationFrame(()=>map.invalidateSize()),
  loadPlan:plan=>{if(sim?.active())return;training.cancel();route=plan.route.map(p=>({...p}));$('altitude').value=plan.alt;$('alt-out').textContent=plan.alt;refreshRoute();frameRoute();status('Plan yüklendi: '+plan.name);},
  reset:()=>{sim.resetFlight();training.reset();pilot.reset();gamepad.suspend();keys.clear();lastTelemetry=null;lastEvent=-1;lastMode='';shownReport=false;editing=false;rate=1;$('rate').textContent='Hız: 1×';$('pause').textContent='Ⅱ Duraklat';$('edit').textContent='Rotayı düzenle';$('edit').classList.remove('selected');$('scenario').value='normal';$('wind-speed').value=0;$('wind-direction').value=0;$('wind-out').textContent='0 m/s';setView('fpv');$('map-hint').textContent='Haritayı kaydırabilir ve yakınlaştırabilirsiniz.';trailLine.setLatLngs([]);refreshRoute();updateUI();status('Uçuş sıfırlandı. Planı düzenleyip yeni uçuş başlatabilirsin.');}
});
const weather=createWeatherControls({getEnvironment:()=>world?.environment,getSim:()=>sim,status});
const keys=new Set();window.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||$('dialog').open)return;if(e.code==='KeyP'&&!e.repeat)$('pause').click();if(['KeyW','KeyS','KeyA','KeyD','KeyQ','KeyE','KeyR','KeyF'].includes(e.code)){keys.add(e.code);e.preventDefault()}});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>{keys.clear();if(document.hidden&&sim?.active()&&!sim.paused)$('pause').click()});
function report(){if(!sim?.track.length){status('Rapor için önce bir uçuş yapın.');return}const rows=['saniye,enlem,boylam,irtifa_msl_m,batarya_yuzde,ucus_modu',...sim.track.map(p=>{const g=localToLonLat(p.x,p.z);return[p.t,g.lat.toFixed(7),g.lon.toFixed(7),p.y.toFixed(2),p.battery.toFixed(2),p.mode].join(',')}),'','olay_saniye,olay',...sim.events.map(e=>`${e.time.toFixed(1)},"${e.message.replaceAll('"','""')}"`),'',...assessmentCsv(assessFlight(sim)),...(sim.searchResult?['','arama_sonucu,tespit_saniye',`"${searchOutcome(sim.searchResult,sim.mode)}",${sim.searchResult.foundAt??''}`]:[])];const u=URL.createObjectURL(new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download='bilsem-bvlos-ucus-raporu.csv';a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);status('CSV raporu hazırlandı; tarayıcının indirmeler bölümünden açabilirsiniz.');}
$('report').onclick=()=>{if(['complete','crashed'].includes(sim?.mode))showResult();else report()};
function showResult(){dialog(resultHtml(sim));$('dialog').setAttribute('aria-label','Uçuş değerlendirmesi');$('result-report').onclick=report;}

const scene=new THREE.Scene();scene.background=new THREE.Color('#8faec4');
const camera=new THREE.PerspectiveCamera(62,1,.1,80000);
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.shadowMap.enabled=false;}catch(e){$('load-text').textContent='Bu cihaz WebGL 2 açamadı. Güncel bir tarayıcı ve donanım hızlandırma gerekiyor.';throw e;}
const loader=createAssetLoader(renderer);
new ResizeObserver(()=>{const w=$('viewport').clientWidth,h=$('viewport').clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();map.invalidateSize()}).observe($('viewport'));
const light=new THREE.HemisphereLight(0xcdeaff,0x48505a,1.2);scene.add(light);
const training=createNightTraining({scene,camera,fill:light,getState:()=>({world,model,home,sim,view,weather:weather.selected}),status,
  setPlan:(points,alt)=>{editing=false;$('edit').textContent='Rotayı düzenle';$('edit').classList.remove('selected');route=points;$('altitude').value=alt;$('alt-out').textContent=alt;refreshRoute();frameRoute();setView('fpv');}
});
const pilot=createPilotControls({camera,getSim:()=>sim,getView:()=>view,status});
const gamepad=createGamepadPanel({getSim:()=>sim,status,onSuspend:()=>{
  keys.clear();if(gamepadSafety(sim))status('Kol kontrolü bekliyor · konum korunuyor.');
}});
document.addEventListener('focusin',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))keys.clear();});
function padAction(action){
  if(!ready||!sim)return;
  if(action==='pause'){$('pause').click();return;}
  if(sim.paused)return;
  if(action==='camera'){setView(view==='fpv'?'follow':'fpv');return;}
  if(action==='motor'){
    if(!sim.toggleMotors())status('Motorlar yalnız yerde açılıp kapatılır. Havada B ile in veya Eve dön.');
    else gamepad.suspend();
    return;
  }
  if(action==='takeoff'){
    if(sim.active()){status('Uçuş zaten sürüyor.');return;}
    if(!sim.armed){status('Önce A ile motorları hazırla.');return;}
    $('manual').click();return;
  }
  if(action==='manual'&&sim.active()){$('manual').click();return;}
  if(action==='rth'){$('rth').click();return;}
  if(action==='land'){
    if(!sim.landHere(canLandHere(sim,world,harbor)))status('Bu noktada iniş uygun değil: düz ve engelsiz kara seç veya Eve dön.');
  }
}
const target=new THREE.Vector3(),eye=new THREE.Vector3();
let aerialImagery=null;
let last=performance.now(),uiAcc=0,frames=0,fpsAt=last,lastTelemetry=null;
function animate(now){requestAnimationFrame(animate);const dt=Math.min(.08,(now-last)/1000);last=now;frames++;if(now-fpsAt>1000){$('fps').textContent=Math.round(frames*1000/(now-fpsAt));frames=0;fpsAt=now}
  const padFrame=gamepad.update(now,document.hidden||!document.hasFocus()||$('dialog').open||/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName));
  if(sim&&ready){for(const action of padFrame.actions)padAction(action);
    const keyboard={forward:+keys.has('KeyW')-+keys.has('KeyS'),side:+keys.has('KeyD')-+keys.has('KeyA'),yaw:+keys.has('KeyE')-+keys.has('KeyQ'),vertical:+keys.has('KeyR')-+keys.has('KeyF')};
    if(!sim.active()&&sim.armed&&padFrame.ready&&!padFrame.actions.includes('motor')&&padFrame.controls.vertical>0&&keyboard.vertical>=0)beginFreeFlight(true,padFrame.controls.vertical);
    sim.manual=blendControls(keyboard,padFrame.controls);
    if(sim.mode==='manual'&&padFrame.ready&&padFrame.controls.vertical!==0)sim.stickFlight=true;
    if(padFrame.camera&&!sim.paused&&sim.link>0&&view==='fpv')training.adjustPitch(padFrame.camera*30*dt);
    for(let i=0;i<(sim.mode==='manual'?1:rate);i++)guardedTick(dt);
    const {x,y,z,heading:h}=sim;model.position.set(x,y-.2,z);model.rotation.set(-sim.speed*.007,-h,0);if(sim.armed&&!sim.paused){model.rotation.z=(sim.mode==='manual'?-sim.manualSide*.025:0)-(sim.wind?.speed||0)*.012*Math.sin((sim.wind?.direction||0)*Math.PI/180-h);rotors.forEach((r,i)=>r.rotation.y+=(i%2?1:-1)*dt*80)}
    const fpv=view==='fpv'&&sim.mode!=='ready'&&!(sim.mode==='complete'&&sim.armed);model.visible=!fpv;if(view==='heritage'&&heritageSite){const p=heritageSite;const y=world.getGroundHeight(p.x,p.z)+28;target.set(p.x,y,p.z);eye.set(p.x+Math.sin(cameraOrbit+.65)*heritageDistance,y+heritageDistance*.55,p.z+Math.cos(cameraOrbit+.65)*heritageDistance)}else if(fpv){eye.set(x+Math.sin(h)*.4,y+.3,z-Math.cos(h)*.4);target.set(x+Math.sin(h)*100,y-Math.tan(training.pitch)*100,z-Math.cos(h)*100)}else{const a=h+cameraOrbit+.65;eye.set(x+Math.sin(a)*cameraDistance,y+cameraDistance*.4,z+Math.cos(a)*cameraDistance);target.set(x,y+.1,z)}camera.position.copy(eye);camera.lookAt(target);
    music.updatePosition(sim);pilot.update();weather.update(dt);world.update(dt,camera);training.update(dt);aerialImagery?.update(now,target);harbor.update(sim.paused?0:dt*(sim.mode==='manual'?1:rate),sim.wind);uiAcc+=dt;if(uiAcc>.2){uiAcc=0;updateUI()}
  }
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);
function updateUI(){if(sim.link>0||!sim.active())lastTelemetry={x:sim.x,z:sim.z,agl:sim.agl,speed:sim.speed,verticalSpeed:sim.verticalSpeed,battery:sim.battery};const telemetry=lastTelemetry||sim;const p=coord(telemetry);droneMarker.setLatLng(p);if(sim.link>0||!sim.active())trailLine.setLatLngs(sim.track.filter((_,i)=>i%3===0).map(coord));$('alt-value').innerHTML=Math.max(0,telemetry.agl).toFixed(0)+' <em>m</em>';$('speed-value').innerHTML=telemetry.speed.toFixed(1)+' <em>m/s</em>';$('battery-value').innerHTML=Math.ceil(telemetry.battery)+' <em>%</em>';$('link-value').innerHTML=Math.round(sim.link)+' <em>%</em>';$('battery-value').style.color=sim.battery<=25?'#ffc478':'';$('link-value').style.color=sim.link===0?'#ffc478':'';$('timer').textContent=clock(sim.elapsed);$('heading').textContent=String(Math.round((sim.heading*180/Math.PI+360)%360)).padStart(3,'0')+'°';$('coordinates').textContent=p[0].toFixed(5)+'° K / '+p[1].toFixed(5)+'° D';$('signal-lost').hidden=sim.link>0||view!=='fpv'||!sim.active();$('flight-mode').textContent=sim.paused?'DURAKLATILDI':names[sim.mode];$('view-status').textContent=view==='heritage'?'SERBEST İNCELEME':sim.link===0&&sim.active()?'SON ALINAN TELEMETRİ':sim.active()?'CANLI SİMÜLASYON':'3B ARAZİ';
  if(lastEvent!==sim.events.length){lastEvent=sim.events.length;$('events').innerHTML=sim.events.slice(-5).reverse().map(e=>`<p><time>${clock(e.time)}</time>${e.message}</p>`).join('');$('event-count').textContent=sim.events.length+' olay';status(sim.events.at(-1).message)}
  if(lastMode!==sim.mode){lastMode=sim.mode;const active=sim.active();for(const id of ['altitude','edit','undo','preset','load'])$(id).disabled=active;$('launch').disabled=active||route.length===0;$('launch').textContent=active?'Görev sürüyor…':['complete','crashed'].includes(sim.mode)?'Yeni uçuş başlat':'▷ Görevi başlat';for(const id of ['hold','resume','rth','manual','pause'])$(id).disabled=!active;}
  classroom.update(sim,telemetry,markers);
  $('manual').disabled=!ready||sim.paused||(sim.active()&&(sim.link===0||(sim.flightKind==='free'&&sim.mode==='takeoff')));$('manual').textContent=sim.active()?'Manuel':'Serbest uçuş';
  $('resume').textContent=sim.flightKind==='free'?'Manuele dön':'▷ Rotayı sürdür';
  if(view==='fpv')$('camera-label').textContent='02 / '+training.label+' · '+pilot.zoom+'×';
  $('scene').dataset.flight=JSON.stringify({mode:sim.mode,paused:sim.paused,index:sim.index,flightKind:sim.flightKind,manualProfile:sim.manualProfile,zoom:pilot.zoom,verticalSpeed:sim.verticalSpeed,wind:sim.wind,heading:sim.heading});
  $('report').textContent=['complete','crashed'].includes(sim.mode)?'Uçuş değerlendirmesini aç':'↓ Uçuş raporunu indir';
  if(!shownReport&&!(sim.stickLanding&&sim.armed)&&['complete','crashed'].includes(sim.mode)){shownReport=true;showResult()}
  // Read-only diagnostics for classroom troubleshooting and automated verification.
  window.bvlosState={ready,mode:sim.mode,paused:sim.paused,elapsed:sim.elapsed,agl:sim.agl,battery:sim.battery,link:sim.link,waypoints:sim.index,total:sim.route.length,position:{x:sim.x,y:sim.y,z:sim.z},terrainTiles:world.terrain.stats.loaded,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,flightKind:sim.flightKind,manualProfile:sim.manualProfile,zoom:pilot.zoom,armed:sim.armed,gamepad:gamepad.diagnostic,stickFlight:sim.stickFlight,stickLanding:sim.stickLanding,version:'ank-0.2.0',world:{...world.sources,buildings:world.obstacles?.list.length||0,landmarks:world.landmarks.landmarks.map(l=>l.id)}};
}
async function init(){try{const regionResponse=await fetch(ANK_DATA+'region.json');if(!regionResponse.ok)throw Error('Bölge tanımı '+regionResponse.status);const region=await regionResponse.json();setGeoRegion(region,createUtm(region.crs));home=lonLatToLocal(region.home.lon,region.home.lat);camera.position.set(home.x,180,home.z+150);camera.lookAt(home.x,30,home.z);preset();homeMarker=L.marker(coord(home),{icon:L.divIcon({className:'map-home',html:'⌂',iconSize:[27,27]})}).addTo(map);geofence=L.circle(coord(home),{radius:2000,color:'#749377',weight:1,dashArray:'4 7',fillOpacity:.025}).addTo(map);droneMarker=L.marker(coord(home),{icon:L.divIcon({className:'map-drone',html:'✥',iconSize:[30,30],iconAnchor:[15,15]})}).addTo(map);trailLine=L.polyline([],{color:'#bddc81',weight:3}).addTo(map);
    const modelP=loader.loadGLTF('models/bilsem-surveyor.glb');modelP.catch(()=>{});
    const quality={...QUALITY.low,deviceClass:'tablet',imageryMaxLevel:0,maxImageryTiles:160,maxTerrainTiles:420,cityLodScale:.75,treeDensity:.3,treeDistance:.65,terrainError:1.6,anisotropy:8,water:'medium',textureMaxSize:2048};
    world=await createAnkaraWorld({scene,renderer,camera,loader,quality,onProgress:(p,t)=>{$('load-progress').value=p;$('load-text').textContent=t}});
    model=(await modelP).scene;model.traverse(o=>{if(o.name.startsWith('Rotor_'))rotors.push(o)});scene.add(model);
    harbor=createLaunchSite({scene,home,world,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
    $('scene').dataset.scenery=JSON.stringify(harbor.counts);
    sim=new DroneSim(home,(x,z)=>world.getGroundHeight(x,z),(x,y,z)=>{const hit=world.hitTest(x,y,z,.2);if(hit?.type==='landmark'){monumentGuard=hit;return false}return !!hit||harbor.hitTest(x,y,z,.2)},s=>canLandHere(s,world,harbor));
    const pad=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,.07,48),new THREE.MeshStandardMaterial({color:'#162c39',roughness:.85}));pad.position.set(home.x,sim.y-.4,home.z);scene.add(pad);const ring=new THREE.Mesh(new THREE.TorusGeometry(1.1,.035,8,64),new THREE.MeshBasicMaterial({color:'#51ddc6'}));ring.rotation.x=-Math.PI/2;ring.position.set(home.x,pad.position.y+.05,home.z);scene.add(ring);
    world.setPlayable();addHeritageGround({world,renderer,url:ANK_DATA+'ground.json'}).then(counts=>{$('scene').dataset.ground=JSON.stringify(counts)}).catch(e=>{console.warn('[ground] Ayrıntı katmanı yüklenemedi; mevcut arazi korunuyor.',e.message)});ready=true;$('heritage').disabled=false;for(const id of ['preset','edit','undo','save','load'])$(id).disabled=false;$('loading').hidden=true;$('launch').textContent='▷ Görevi başlat';refreshRoute();updateUI();status('Hazır. Örnek rotayla uçabilir veya haritada kendi rotanı oluşturabilirsin.');
  }catch(e){console.error(e);$('load-text').textContent='Harita yüklenemedi: '+e.message;$('loading').querySelector('h3').textContent='Bağlantıyı kontrol edin';$('loading').querySelector('.spinner').hidden=true;const retry=document.createElement('button');retry.textContent='Yeniden dene';retry.onclick=()=>location.reload();$('loading').append(retry);}}
function showImageryState(info){
  const label=$('imagery-state');label.hidden=false;
  label.textContent=info.status==='disabled'?'Hava görüntüsü henüz etkin değil · Ankara arazi ve yol verileri gösteriliyor':info.status==='ready'?'Ayrıntılı hava / uydu görüntüsü':info.status==='loading'?'Ayrıntılı zemin yükleniyor…':info.status==='partial'?'Zemin kısmen yüklendi':'Görüntü servisine ulaşılamadı · mevcut zemin korunuyor';
  $('scene').dataset.imagery=JSON.stringify(info);
  if(info.tiles){$('imagery-credit').hidden=false;document.querySelector('.region small').textContent='Ankara · ArcGIS hava görüntüsü'}
}
init().then(()=>{if(world)createAerialImagery({world,renderer,url:ANK_DATA+'imagery.json',bounds:world.region.bboxLonLat,onState:showImageryState}).then(value=>{aerialImagery=value}).catch(()=>showImageryState({status:'unavailable'}))});


