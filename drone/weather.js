// Visual training presets, not live meteorological data or flight restrictions.
export const WEATHER_PRESETS=Object.freeze({
  clear:Object.freeze({label:'Açık',overcast:0,hazeBoost:0,detail:'Mevcut açık hava görünümü.'}),
  cloudy:Object.freeze({label:'Bulutlu',overcast:1,hazeBoost:2,detail:'Yaygın bulut örtüsü ve yumuşak ışık.'}),
  hazy:Object.freeze({label:'Puslu',overcast:.32,hazeBoost:65,detail:'Uzak yapılar ve ufuk daha az görünür.'})
});

export function createWeatherState(){
  let selected='clear',current={overcast:0,hazeBoost:0};
  return {
    get selected(){return selected;},
    select(id){if(!Object.hasOwn(WEATHER_PRESETS,id))return false;selected=id;return true;},
    step(dt){
      const target=WEATHER_PRESETS[selected],alpha=1-Math.exp(-Math.max(0,Number.isFinite(dt)?dt:0)/1.4);
      for(const key of ['overcast','hazeBoost']){
        current[key]+=(target[key]-current[key])*alpha;
        if(Math.abs(target[key]-current[key])<.001)current[key]=target[key];
      }
      return {...current};
    }
  };
}

export function createWeatherControls({getEnvironment,getSim,status}){
  const state=createWeatherState(),panel=document.createElement('div');panel.className='wind-controls';
  panel.innerHTML='<label for="weather">Hava durumu</label><select id="weather" aria-describedby="weather-note" disabled>'+Object.entries(WEATHER_PRESETS).map(([id,p])=>`<option value="${id}">${p.label}</option>`).join('')+'</select><small id="weather-status" role="status">Açık · Mevcut açık hava görünümü.</small><small id="weather-note">Eğitim senaryosu; canlı hava verisi değildir. Rüzgâr ayrı ayarlanır.</small>';
  document.querySelector('.wind-controls').after(panel);
  const select=panel.querySelector('select'),feedback=panel.querySelector('#weather-status');
  select.onchange=()=>{
    if(!state.select(select.value))return;
    const p=WEATHER_PRESETS[state.selected];feedback.textContent=`${p.label} · ${p.detail}`;
    if(getSim()?.active())getSim().log(`Hava durumu: ${p.label} · görsel eğitim senaryosu`);
    status(`Hava ${p.label.toLocaleLowerCase('tr')} koşullara geçiyor. ${p.detail}`);
  };
  let lastSnapshot='';
  return {
    get selected(){return state.selected;},
    recordStart(){getSim()?.log(`Başlangıç hava durumu: ${WEATHER_PRESETS[state.selected].label} · görsel eğitim senaryosu`);},
    update(dt){
      const env=getEnvironment();select.disabled=!env;if(!env)return;
      const values=state.step(dt);env.setWeather(values);
      const snapshot=JSON.stringify({preset:state.selected,overcast:+values.overcast.toFixed(2),hazeBoost:+values.hazeBoost.toFixed(2)});
      if(snapshot!==lastSnapshot){document.getElementById('scene').dataset.weather=snapshot;lastSnapshot=snapshot;}
    }
  };
}
