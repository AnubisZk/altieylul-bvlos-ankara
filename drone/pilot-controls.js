import {MANUAL_SPEEDS} from './sim.js';
export function zoomFov(zoom,base=62){return 2*Math.atan(Math.tan(base*Math.PI/360)/zoom)*180/Math.PI;}
export function createPilotControls({camera,getSim,getView,status}){
  const panel=document.createElement('details');panel.className='pilot-controls night-training';
  panel.innerHTML='<summary>Uçuş ve kamera ayarları</summary><div class="wind-controls"><label for="manual-speed">Manuel uçuş hızı</label><select id="manual-speed">'+Object.entries(MANUAL_SPEEDS).map(([id,p])=>`<option value="${id}" ${id==='normal'?'selected':''}>${p.label} · ${p.speed} m/s</option>`).join('')+'</select><label for="camera-zoom">Drone kamera yakınlaştırması</label><select id="camera-zoom"><option value="1">1× · Geniş açı</option><option value="2">2×</option><option value="4">4×</option></select><small>Serbest uçuş: kamera altındaki düğmeye bas. Drone 3 metreye kalkar; W/S, A/D, Q/E, R/F ile kontrol et. Eve dön ile güvenli inişi başlat.</small><small>Hız seçenekleri manuel yatay uçuş içindir; zaman 1× kalır. Yakınlaştırma normal ve termal drone kamerasında çalışır; haritayı etkilemez. Manuel kontrol klavye veya Oyun Kolu sekmesinden ayarlanan kumandayla yapılır.</small></div>';
  document.querySelector('.night-training').before(panel);
  const speed=panel.querySelector('#manual-speed'),zoom=panel.querySelector('#camera-zoom');let lastFov=62;
  speed.onchange=()=>{getSim()?.setManualProfile(speed.value);status('Manuel hız: '+speed.selectedOptions[0].textContent+' · yumuşak hızlanma/yavaşlama.');speed.blur();};
  zoom.onchange=()=>{status('Drone kamera yakınlaştırması: '+zoom.value+'×');zoom.blur();};
  return {get zoom(){return Number(zoom.value);},reset(){speed.value='normal';zoom.value='1';},update(){
    speed.disabled=!getSim();const fov=zoomFov(getView()==='fpv'?Number(zoom.value):1);
    if(fov!==lastFov){camera.fov=fov;camera.updateProjectionMatrix();lastFov=fov;}
  }};
}
