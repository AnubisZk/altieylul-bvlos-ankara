import tracks from './music-tracks.json';
import zone from '../data/ank/music-zone.json';
import {musicTrackAt} from './music-zone.js';
// One streaming audio element: selected by drone position, independent of camera and simulation speed.
export function createMusic(){
  const audio=document.getElementById('background-music');
  const button=document.getElementById('music-toggle');
  const volume=document.getElementById('music-volume');
  const state=document.getElementById('music-state');
  const title=document.getElementById('music-title');
  let enabled=true,unlocked=false,simPaused=false,narrating=false,blocked=false,failed=false,current=null,revision=0;
  try{const saved=JSON.parse(localStorage.getItem('bilsem.bvlos.music.v1'));if(saved){enabled=saved.enabled!==false;if(Number.isFinite(saved.volume))volume.value=Math.max(0,Math.min(100,saved.volume))}}catch{}
  audio.volume=Number(volume.value)/100;
  function save(){try{localStorage.setItem('bilsem.bvlos.music.v1',JSON.stringify({enabled,volume:Number(volume.value)}))}catch{}}
  function render(){
    button.textContent=enabled&&unlocked?'♫ Müziği kapat':'♫ Müziği aç';
    button.setAttribute('aria-pressed',String(enabled&&unlocked));
    volume.setAttribute('aria-valuetext',`%${volume.value}`);
    state.textContent=!tracks[current]?.src?'Müzik dosyası henüz eklenmedi':failed?'Dosya yüklenemedi':!enabled?'Kapalı':narrating?'Sesli kılavuz dinleniyor':blocked?'Çalmak için müzik düğmesine dokun':!unlocked?'Başlatmak için dokun':simPaused||document.hidden?'Duraklatıldı':!audio.paused?(audio.volume===0?'Ses %0':'Çalıyor'):'Yükleniyor…';
  }
  function sync(){
    if(!tracks[current]?.src||!enabled||!unlocked||simPaused||narrating||document.hidden){audio.pause();render();return}
    const token=revision;
    if(audio.paused)audio.play().then(()=>{if(token===revision){blocked=false;failed=false;render()}}).catch(e=>{if(token===revision&&e.name!=='AbortError'){blocked=true;render()}});
    render();
  }
  function select(id){
    if(id===current)return;
    revision++;audio.pause();current=id;blocked=failed=false;
    title.textContent=tracks[id].title;title.dataset.track=id;
    if(tracks[id].src)audio.src=tracks[id].src;else audio.removeAttribute('src');
    audio.load();sync();
  }
  function gesture(e){
    if(unlocked||e.target.closest?.('#music-controls'))return;
    if(e.type==='keydown'&&!['Enter',' '].includes(e.key))return;
    unlocked=true;sync();
  }
  document.addEventListener('pointerdown',gesture,{capture:true});
  document.addEventListener('keydown',gesture,{capture:true});
  button.onclick=()=>{if(!unlocked||blocked){unlocked=true;enabled=true;blocked=false}else enabled=!enabled;save();sync()};
  volume.oninput=()=>{audio.volume=Number(volume.value)/100;save();render()};
  document.addEventListener('visibilitychange',sync);
  audio.addEventListener('playing',render);audio.addEventListener('pause',render);
  audio.addEventListener('error',()=>{failed=true;render()});
  select('ankara');
  return {updatePosition(position){select(musicTrackAt(position,zone,current));},setPaused(value){simPaused=value;sync()},setNarrating(value){narrating=value;sync()}};
}
