// One streaming HTML audio element: independent of simulation time and camera.
export function createMusic(){
  const audio=document.getElementById('background-music');
  const button=document.getElementById('music-toggle');
  const volume=document.getElementById('music-volume');
  const state=document.getElementById('music-state');
  let enabled=true,unlocked=false,simPaused=false,narrating=false,blocked=false,failed=false;
  try{const saved=JSON.parse(localStorage.getItem('bilsem.bvlos.music.v1'));if(saved){enabled=saved.enabled!==false;if(Number.isFinite(saved.volume))volume.value=Math.max(0,Math.min(100,saved.volume))}}catch{}
  audio.volume=Number(volume.value)/100;
  function save(){try{localStorage.setItem('bilsem.bvlos.music.v1',JSON.stringify({enabled,volume:Number(volume.value)}))}catch{}}
  function render(){
    button.textContent=enabled&&unlocked?'♫ Müziği kapat':'♫ Müziği aç';
    button.setAttribute('aria-pressed',String(enabled&&unlocked));
    volume.setAttribute('aria-valuetext',`%${volume.value}`);
    state.textContent=failed?'Dosya yüklenemedi':!enabled?'Kapalı':narrating?'Sesli kılavuz dinleniyor':blocked?'Çalmak için müzik düğmesine dokun':!unlocked?'Başlatmak için dokun':simPaused||document.hidden?'Duraklatıldı':!audio.paused?(audio.volume===0?'Ses %0':'Çalıyor'):'Yükleniyor…';
  }
  function sync(){
    if(!enabled||!unlocked||simPaused||narrating||document.hidden){audio.pause();render();return}
    if(audio.paused)audio.play().then(()=>{blocked=false;render()}).catch(e=>{if(e.name!=='AbortError'){blocked=true;render()}});
    render();
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
  render();
  return {setPaused(value){simPaused=value;sync()},setNarrating(value){narrating=value;sync()}};
}
