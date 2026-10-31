// Synthetic classroom conditions: not measured illumination or thermography.
export const TIMES=Object.freeze({day:{label:'Gündüz',dusk:0,night:0},dusk:{label:'Akşam',dusk:1,night:0},night:{label:'Gece',dusk:0,night:1}});
export function createNightState(){
  let selected='day',dusk=0,night=0;
  return {get selected(){return selected;},select(id){if(!Object.hasOwn(TIMES,id))return false;selected=id;return true;},step(dt){
    const a=1-Math.exp(-Math.max(0,Number.isFinite(dt)?dt:0)/1.2),t=TIMES[selected];
    dusk+=(t.dusk-dusk)*a;night+=(t.night-night)*a;
    if(Math.abs(t.dusk-dusk)<.001)dusk=t.dusk;if(Math.abs(t.night-night)<.001)night=t.night;
    return {dusk,night};
  }};
}
export function createSearchState(){
  let progress=0,found=false,foundAt=null;
  return {reset(){progress=0;found=false;foundAt=null;},get snapshot(){return {found,foundAt,progress};},
    step({dt,elapsed,active,paused,thermal,inFrame,clear,range,link}){
      if(found)return false;
      if(!active||paused||!thermal||!inFrame||!clear||!Number.isFinite(range)||range>240||range<8||!(link>0)){progress=0;return false;}
      progress=Math.min(3,progress+Math.max(0,Math.min(.4,Number.isFinite(dt)?dt:0)));
      if(progress>=3-1e-8){progress=3;found=true;foundAt=elapsed;return true;}return false;
    }};
}
export function searchRoute(point){return [[180,-80],[-180,-80],[-180,0],[180,0],[180,80],[-180,80]].map(([x,z])=>({x:point.x+x,z:point.z+z}));}
export function searchOutcome(result,mode){
  if(!result)return '';
  if(!result.found)return ['complete','crashed'].includes(mode)?'Arama tamamlanmadı: kişi tespit edilemedi.':'Aranıyor · termal kamerada kişiyi merkez çevresinde 3 saniye tut.';
  return mode==='complete'?'Kişi tespit edildi ve güvenli dönüş tamamlandı.':mode==='crashed'?'Kişi tespit edildi; güvenli dönüş tamamlanamadı.':'Kişi tespit edildi. Güvenli dönüş ve iniş bekleniyor.';
}
