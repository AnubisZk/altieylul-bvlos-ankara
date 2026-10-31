// Classroom rubric v1. Durations use simulation time, never render frame counts.
export const RUBRIC = { routeTolerance: 30, altitudeTolerance: 10, graceSeconds: 2, reserve: 10 };
const round = n => Math.round(n * 10) / 10;

export function segmentDistance(p, a, b) {
  const dx=b.x-a.x, dz=b.z-a.z, length=dx*dx+dz*dz;
  const t=length ? Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/length)) : 0;
  return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);
}

export class FlightAssessment {
  constructor(altitude) {
    this.altitude=altitude;
    this.cruising=false;
    this.route={seconds:0,episodes:0,max:0,run:0};
    this.height={seconds:0,episodes:0,max:0,run:0};
    this.boundary={seconds:0,episodes:0,inside:false};
    this.returnStart=null;
    this.returning=false;
    this.returns=[];
    this.failure=null;
    this.forcedBattery=false;
  }
  noteReturn(sim,reason) {
    this.returning=true;
    this.returnStart={x:sim.x,z:sim.z};
    this.returns.push({time:round(sim.elapsed),battery:round(sim.battery),reason,
      source:reason.startsWith('Pilot komutu')?'Pilot':'Otopilot'});
  }
  measure(metric,value,tolerance,dt) {
    metric.max=Math.max(metric.max,value);
    if(value<=tolerance){metric.run=0;return;}
    const before=metric.run;
    metric.run+=dt;
    if(before+1e-9<RUBRIC.graceSeconds && metric.run+1e-9>=RUBRIC.graceSeconds)metric.episodes++;
    metric.seconds+=Math.max(0,metric.run-RUBRIC.graceSeconds)-Math.max(0,before-RUBRIC.graceSeconds);
  }
  sample(sim,dt,mode,index) {
    // Takeoff and landing are not cruise-altitude violations. Holds after takeoff are assessed.
    if(sim.agl>=this.altitude-RUBRIC.altitudeTolerance)this.cruising=true;
    const cruise=sim.flightKind!=='free' && this.cruising && ['mission','manual','hold','rth'].includes(mode);
    this.measure(this.height,cruise?Math.abs(sim.agl-this.altitude):0,RUBRIC.altitudeTolerance,dt);
    let a=sim.route[index-1]||sim.home,b=sim.route[index];
    if(this.returning){a=this.returnStart||sim.home;b=sim.home;}
    const deviation=cruise&&b?segmentDistance(sim,a,b):0;
    this.measure(this.route,deviation,RUBRIC.routeTolerance,dt);
    const outside=Math.hypot(sim.x-sim.home.x,sim.z-sim.home.z)>2000;
    if(outside){this.boundary.seconds+=dt;if(!this.boundary.inside)this.boundary.episodes++;}
    this.boundary.inside=outside;
  }
}

export function assessFlight(sim) {
  const a=sim.assessment;
  const finished=['complete','crashed'].includes(sim.mode), landed=sim.mode==='complete';
  const loss=m=>Math.min(20,m.episodes*2+Math.floor((m.seconds+1e-7)/5));
  const batteryLoss=a.failure==='battery'?20:a.forcedBattery?0:landed&&sim.battery<RUBRIC.reserve?10:0;
  const rows=[
    {name:'Rota takibi',max:20,earned:20-loss(a.route),detail:`${a.route.episodes} sapma · tolerans sonrası ${round(a.route.seconds)} sn · en çok ${round(a.route.max)} m`},
    {name:'Görev yüksekliği',max:20,earned:20-loss(a.height),detail:`${a.height.episodes} sapma · tolerans sonrası ${round(a.height.seconds)} sn · en çok ${round(a.height.max)} m fark`},
    {name:'Eğitim sınırı',max:20,earned:Math.max(0,20-a.boundary.episodes*10),detail:`2 km sınırı dışında ${a.boundary.episodes} olay · ${round(a.boundary.seconds)} sn`},
    {name:'Enerji payı',max:20,earned:20-batteryLoss,detail:a.forcedBattery?'Eğitmenin düşürdüğü batarya yüzdesi cezalandırılmaz; enerji tükenmesi değerlendirilir.':`İnişte hedef en az %${RUBRIC.reserve} enerji payı · kalan %${round(sim.battery)}`},
    {name:'Güvenli iniş',max:20,earned:landed?20:0,detail:landed?(sim.landingPoint?'Seçilen zemine iniş tamamlandı.':'Eve dönüş ve iniş tamamlandı.'):a.failure==='battery'?'Batarya tükenmesiyle uçuş sona erdi.':sim.mode==='crashed'?'Çarpışmayla uçuş sona erdi.':'Uçuş henüz bitmedi.'},
  ];
  if(sim.flightKind==='free')rows.splice(0,2);
  const raw=rows.reduce((sum,r)=>sum+r.earned,0);
  const normalized=Math.round(raw/(rows.length*20)*100);
  const score=finished?Math.min(normalized,landed?100:39):null;
  const suggestions=[];
  if(a.route.episodes)suggestions.push('Manuel uçuşta etkin rota bölümüne yaklaş; uzun sapmalarda konum korumayı değerlendir.');
  if(a.height.episodes)suggestions.push(`Seyirde seçilen ${a.altitude} m yüksekliği ±10 m içinde tut.`);
  if(a.boundary.episodes)suggestions.push('Eğitim sınırına ulaşmadan dönüş kararı ver.');
  if(batteryLoss)suggestions.push('Enerji payını daha erken kontrol et; dönüş ve iniş için batarya bırak.');
  if(a.failure==='collision')suggestions.push('Engelleri ve dönüş yolunu kontrol et; çarpışmayla biten uçuşu yeniden dene.');
  if(!suggestions.length)suggestions.push(landed?'Güvenli uçuş tamamlandı. Aynı görevi farklı bir eğitmen senaryosuyla tekrar deneyebilirsin.':'Değerlendirme uçuş sonunda kesinleşir.');
  return {rubric:sim.flightKind==='free'?'BİLSEM serbest uçuş v1 · üç ölçüt, 100 üzerinden':'BİLSEM uçuş güvenliği v1',finished,score,rows,suggestions,
    outcome:!finished?'Uçuş sürüyor':!landed?'Uçuş güvenle tamamlanamadı':sim.flightKind==='free'?'Serbest uçuş tamamlandı':sim.completed?'Görev tamamlandı':sim.landingPoint?'Güvenli yerel iniş':'Güvenli erken dönüş',
    completed:sim.index,total:sim.route.length,elapsed:round(sim.elapsed),battery:round(sim.battery),
    returns:a.returns.map(r=>({...r})),capped:finished&&!landed&&normalized>39};
}

export function assessmentCsv(result) {
  const cell=value=>'"'+String(value??'').replaceAll('"','""')+'"';
  const rows=[['degerlendirme',result.rubric],['sonuc',result.outcome],['guvenlik_puani',result.score??'Uçuş sürüyor'],
    ['tamamlanan_nokta',result.completed],['toplam_nokta',result.total],['sure_sn',result.elapsed],['kalan_batarya',result.battery],
    ['puan_tavani',result.capped?'Güvenli iniş yok: en fazla 39':'Yok'],[],['olcut','puan','azami_puan','aciklama'],
    ...result.rows.map(r=>[r.name,result.finished?r.earned:'Henüz kesinleşmedi',r.max,r.detail]),[],['donus_saniye','donus_batarya','karari_veren','neden'],
    ...result.returns.map(r=>[r.time,r.battery,r.source,r.reason]),[],['gelisim_onerisi'],...result.suggestions.map(s=>[s])];
  return rows.map(row=>row.map(cell).join(','));
}
