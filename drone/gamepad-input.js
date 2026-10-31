// Pure Gamepad API adapter. Device polling is owned by the existing animation loop.
export const AXES = {vertical:'Throttle · yüksel/alçal',yaw:'Yaw · yön',forward:'Pitch · ileri/geri',side:'Roll · sağ/sol'};
export const ACTIONS = {motor:'Motor aç/kapat',land:'Bulunduğun yere in',camera:'Kamera değiştir',takeoff:'Otomatik kalkış',pitchUp:'Kamerayı yukarı eğ',pitchDown:'Kamerayı aşağı eğ',pause:'Duraklat / sürdür',manual:'Manuel kontrolü al',rth:'Eve dön'};
export const DEFAULTS = {
  deadzone:.10,
  axes:{vertical:{index:1,invert:true,sensitivity:1},yaw:{index:0,invert:false,sensitivity:1},forward:{index:3,invert:true,sensitivity:1},side:{index:2,invert:false,sensitivity:1}},
  buttons:{motor:0,land:1,camera:2,takeoff:3,pitchUp:6,pitchDown:7,pause:9,manual:8,rth:5},
  centers:{},approvedDevices:[]
};
const limit=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=(n,f,a,b)=>typeof n==='number'&&Number.isFinite(n)?limit(n,a,b):f;
export const zero=()=>({vertical:0,yaw:0,forward:0,side:0});
export function settingsFrom(value){
  const s=structuredClone(DEFAULTS);
  if(!value||typeof value!=='object')return s;
  s.deadzone=finite(value.deadzone,.1,0,.35);
  for(const key of Object.keys(AXES)){
    const v=value.axes?.[key];if(!v)continue;
    s.axes[key]={index:Number.isInteger(v.index)?limit(v.index,0,31):s.axes[key].index,invert:typeof v.invert==='boolean'?v.invert:s.axes[key].invert,sensitivity:finite(v.sensitivity,1,.2,2)};
  }
  for(const key of Object.keys(ACTIONS))if(Number.isInteger(value.buttons?.[key]))s.buttons[key]=limit(value.buttons[key],-1,63);
  for(const [key,v] of Object.entries(value.centers||{}))if(/^\d+$/.test(key)&&Number(key)<32)s.centers[key]=finite(v,0,-.25,.25);
  s.approvedDevices=Array.isArray(value.approvedDevices)?value.approvedDevices.filter(v=>typeof v==='string'&&v.length<300).slice(-20):[];
  return s;
}
export function mappingError(s){
  const axes=Object.values(s.axes).map(a=>a.index),buttons=Object.values(s.buttons).filter(b=>b>=0);
  if(new Set(axes).size!==axes.length)return 'Her uçuş ekseni farklı bir analog eksene atanmalı.';
  if(new Set(buttons).size!==buttons.length)return 'Bir düğme birden fazla işleve atanamaz. Gerekirse Kullanma seç.';
  return '';
}
export function axisValue(raw,axis,settings){
  if(!Number.isFinite(raw))return 0;
  const center=settings.centers[axis.index]||0,d=raw-center;
  const adjusted=limit(d/(d<0?1+center:1-center),-1,1);
  const magnitude=Math.abs(adjusted),dz=settings.deadzone;
  return magnitude<=dz?0:limit(Math.sign(adjusted)*(magnitude-dz)/(1-dz)*axis.sensitivity*(axis.invert?-1:1),-1,1);
}
export function blendControls(keyboard,pad){return Object.fromEntries(Object.keys(AXES).map(k=>[k,keyboard[k]||pad[k]||0]));}
export function buttonValue(pad,index){
  const b=index<0?null:pad?.buttons?.[index];
  return b?finite(b.value,b.pressed?1:0,0,1):0;
}
export class GamepadInput {
  constructor(settings=DEFAULTS){this.settings=settingsFrom(settings);this.device=null;this.index=null;this.previous=[];this.neutral=false;}
  suspend(){this.neutral=false;}
  configure(settings){this.settings=settingsFrom(settings);this.suspend();}
  select(index){this.index=index;this.suspend();}
  step(pads,blocked=false){
    const devices=Array.from(pads||[]).filter(p=>p&&p.connected!==false);
    const pad=this.index===null?devices[0]:devices.find(p=>p.index===this.index);
    const id=pad?`${pad.index}:${pad.id}`:null,changed=id!==this.device,disconnected=!!this.device&&changed;
    if(changed){this.device=id;this.neutral=false;}
    const out={pad,devices,disconnected,controls:zero(),actions:[],camera:0,ready:false,message:'Oyun kolu bağlı değil · klavye kullanılabilir.'};
    if(!pad){this.previous=[];return out;}
    const s=this.settings,buttons=Array.from(pad.buttons||[],(_,i)=>buttonValue(pad,i)>.5);
    const controls=Object.fromEntries(Object.entries(s.axes).map(([k,a])=>[k,axisValue(pad.axes[a.index],a,s)]));
    const valid=!mappingError(s)&&Object.values(s.axes).every(a=>Number.isFinite(pad.axes[a.index]))&&Object.values(s.buttons).every(i=>i<0||i<pad.buttons.length);
    const approved=pad.mapping==='standard'||s.approvedDevices.includes(pad.id);
    const centered=Object.values(controls).every(v=>Math.abs(v)<.001)&&!buttons.some(Boolean)&&Object.values(s.buttons).every(i=>buttonValue(pad,i)<.1);
    if(blocked||!valid||!approved)this.neutral=false;
    else if(!this.neutral&&centered)this.neutral=true;
    out.ready=this.neutral&&!blocked&&valid&&approved;
    out.message=!valid?'Eksen/düğme eşlemesini bu kola göre düzenle.':!approved?'Standart dışı kol: canlı göstergeleri kontrol edip eşlemeyi onayla.':blocked?'Ayar/menü açık · kol uçuş komutu göndermiyor.':!out.ready?'Çubukları ortala, tetikleri ve düğmeleri bırak.':'Kumanda hazır · seçilen eşleme etkin.';
    if(out.ready&&!changed){
      out.controls=controls;
      out.actions=Object.entries(s.buttons).filter(([k,i])=>!['pitchUp','pitchDown'].includes(k)&&i>=0&&buttons[i]&&!this.previous[i]).map(([k])=>k);
      out.camera=buttonValue(pad,s.buttons.pitchDown)-buttonValue(pad,s.buttons.pitchUp);
    }
    this.previous=buttons;
    return out;
  }
}
