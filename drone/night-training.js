import * as T from 'three';
import {createNightState,createSearchState,TIMES,searchRoute,searchOutcome} from './night-state.js';
import {createNightVisuals} from './night-visuals.js';
import {chooseSearchPoint} from './search-site.js';
import {localToLonLat} from '../src/geo.js';

export function createNightTraining({scene,camera,fill,getState,setPlan,status}){
  const state=createNightState(),search=createSearchState();let visuals,person,point,armed=false,lastElapsed=0,losTimer=0,clear=false;
  const panel=document.createElement('details');panel.className='night-training';
  panel.innerHTML=`<summary>Gece ve arama eğitimi</summary><div class="wind-controls">
    <label for="time-of-day">Günün saati</label><select id="time-of-day"><option value="day">Gündüz</option><option value="dusk">Akşam</option><option value="night">Gece</option></select>
    <label for="thermal-camera">Drone kamera modu</label><select id="thermal-camera"><option value="0">Normal kamera</option><option value="1">Termal · beyaz sıcak</option><option value="2">Termal · siyah sıcak</option></select>
    <label for="gimbal-pitch">Kamera aşağı eğimi <output id="gimbal-value">10°</output></label><input id="gimbal-pitch" aria-label="Kamera aşağı eğimi" type="range" min="10" max="85" value="10" step="1">
    <button id="prepare-search" disabled>Kayıp kişi arama rotasını hazırla</button>
    <small id="search-status" role="status">Arama görevini uçuş öncesinde hazırlayabilirsin.</small>
    <small>Termal görüntü ve kişi eğitim için üretilmiştir; gerçek sıcaklık veya canlı kişi verisi değildir. Kamera modu yalnız drone görüntüsüne uygulanır.</small>
    <small>Arama: termal kamerada kişiyi merkez çevresinde 3 saniye tut. Konum koru ve manuel yön kontrolü yardımcı olur. Tespitten sonra Eve dön.</small>
  </div>`;
  document.querySelector('.event-title').before(panel);
  const $=id=>panel.querySelector('#'+id),time=$('time-of-day'),sensor=$('thermal-camera'),pitch=$('gimbal-pitch'),button=$('prepare-search'),feedback=$('search-status');
  function log(message){const sim=getState().sim;if(sim?.active())sim.log(message);status(message);}
  time.onchange=()=>{state.select(time.value);log('Ortam: '+TIMES[state.selected].label);};
  sensor.onchange=()=>log('Kamera: '+sensor.selectedOptions[0].textContent+' · sentetik eğitim görüntüsü');
  pitch.oninput=()=>{$('gimbal-value').textContent=pitch.value+'°';};
  function cancel(){armed=false;if(person)person.visible=false;point=null;search.reset();feedback.textContent='Arama görevi kapalı.';}
  function makePerson(){
    const root=new T.Group();root.name='Synthetic missing person';
    const coat=new T.MeshStandardMaterial({color:0xa16338,roughness:.96});coat.userData.trainingHeat=.88;
    const skin=new T.MeshStandardMaterial({color:0xc99c7a,roughness:.9});skin.userData.trainingHeat=.96;
    const body=new T.Mesh(new T.CapsuleGeometry(.23,.53,3,6),coat);body.position.y=1.08;root.add(body);
    const head=new T.Mesh(new T.SphereGeometry(.16,8,6),skin);head.position.y=1.65;root.add(head);
    for(const s of [-1,1]){const leg=new T.Mesh(new T.CapsuleGeometry(.09,.56,2,6),coat);leg.position.set(s*.13,.41,0);root.add(leg);const arm=new T.Mesh(new T.CapsuleGeometry(.075,.48,2,6),coat);arm.position.set(s*.32,1.07,0);arm.rotation.z=s*.14;root.add(arm);}
    scene.add(root);return root;
  }
  button.onclick=()=>{
    const {world,sim,home}=getState();if(!world||!sim||sim.active())return;
    const choice=chooseSearchPoint(world,home);if(!choice){status('Arama için uygun OSM yeşil alanı bulunamadı. Arazi ve zemin verilerini kontrol edin.');return;}
    setPlan(searchRoute(choice),80);point=choice;armed=true;search.reset();
    person??=makePerson();person.position.set(point.x,point.y,point.z);person.visible=true;
    state.select('night');time.value='night';sensor.value='1';pitch.value='55';pitch.oninput();
    feedback.textContent='Hazır · 6 noktalı tarama, 80 m. Görevi başlat; termal görüntüyü izle.';status(feedback.textContent);
  };
  function begin(){const {sim}=getState();search.reset();lastElapsed=sim.elapsed;losTimer=0;clear=false;sim.searchResult=armed?{found:false,foundAt:null}:null;sim.log('Başlangıç ortamı: '+TIMES[state.selected].label+' · '+sensor.selectedOptions[0].textContent);if(armed)sim.log('Kayıp kişi arama başladı · termal kadrajda 3 saniye tespit');}
  const projected=new T.Vector3(),sight=new T.Vector3();
  function lineOfSight(world,from,to){const d=from.distanceTo(to),steps=Math.ceil(d/2);for(let i=1;i<steps;i++){const a=i/steps,x=from.x+(to.x-from.x)*a,y=from.y+(to.y-from.y)*a,z=from.z+(to.z-from.z)*a;if(world.getGroundHeight(x,z)>y||world.hitTest(x,y,z,.1))return false;}return true;}
  return {
    begin,cancel,reset(){search.reset();lastElapsed=0;losTimer=0;clear=false;const sim=getState().sim;if(sim)sim.searchResult=null;feedback.textContent=armed?'Arama rotası hazır; yeni uçuşu başlat.':'Arama görevi kapalı.';},
    adjustPitch(delta){pitch.value=Math.max(10,Math.min(85,Number(pitch.value)+delta));pitch.oninput();},
    get pitch(){return Number(pitch.value)===10?Math.atan(.18):Number(pitch.value)*Math.PI/180;},get armed(){return armed;},
    get label(){return Number(sensor.value)>0?`TERMAL · ${sensor.value==='1'?'BEYAZ':'SİYAH'} SICAK · TEMSİLİ`:'DRONE KAMERASI';},
    update(dt){
      const {world,model,home,sim,view,weather}=getState();button.disabled=!world||!sim||sim.active();if(!world||!model)return;
      visuals??=createNightVisuals({scene,world,model,home,fill});
      const thermal=view==='fpv'?Number(sensor.value):0,values=state.step(dt);
      visuals.update({...values,thermal,haze:weather==='hazy'?1:0});
      document.getElementById('scene').dataset.training=JSON.stringify({time:state.selected,thermal,armed,area:point?.areaName,point:point?{x:point.x,y:point.y,z:point.z}:null,...search.snapshot});
      if(!sim||!armed||!point)return;
      camera.updateMatrixWorld();sight.set(point.x,point.y+1.1,point.z);projected.copy(sight).project(camera);
      const range=camera.position.distanceTo(sight),inFrame=projected.z>-1&&projected.z<1&&Math.abs(projected.x)<.35&&Math.abs(projected.y)<.35;
      losTimer-=dt;if(losTimer<=0){clear=inFrame&&range<=240&&lineOfSight(world,camera.position,sight);losTimer=.15;}
      const elapsedDelta=Math.max(0,sim.elapsed-lastElapsed);lastElapsed=sim.elapsed;
      const found=search.step({dt:elapsedDelta,elapsed:sim.elapsed,active:sim.active(),paused:sim.paused,thermal:thermal>0,inFrame,clear,range,link:sim.link});
      if(found){const geo=localToLonLat(point.x,point.z);sim.searchResult={found:true,foundAt:sim.elapsed,lat:geo.lat,lon:geo.lon};sim.log(`Kişi tespit edildi · ${geo.lat.toFixed(5)}° K / ${geo.lon.toFixed(5)}° D · Güvenli dönüş yapın.`);}
      if(sim.mode==='ready')return;
      const progress=search.snapshot.progress;
      feedback.textContent=search.snapshot.found?searchOutcome(sim.searchResult,sim.mode):!sim.active()?'Görev sona erdi; kişi tespit edilemedi.':sim.paused?'Arama duraklatıldı.':thermal===0?'Tespit için Drone kamerası ve termal modu seç.':sim.link===0?'Bağlantı yok; tespit durduruldu.':progress>0?`Isı izi kadrajda · ${progress.toFixed(1)} / 3 sn`:'Aranıyor · ısı izini merkez çevresinde 3 saniye tut.';
    }
  };
}
