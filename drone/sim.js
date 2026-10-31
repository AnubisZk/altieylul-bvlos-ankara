// Educational kinematics: not a calibrated aircraft or RF propagation model.
import {FlightAssessment} from './assessment.js';
export const LIMITS = { radius: 2000, maxAgl: 120, speed: 12, climb: 3, descent: 2, endurance: 1500 };
export const MANUAL_SPEEDS=Object.freeze({precise:{label:'Hassas',speed:3},normal:{label:'Normal',speed:8},fast:{label:'Hızlı',speed:12}});
export const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
export const angleDelta = (target,current) => Math.atan2(Math.sin(target-current),Math.cos(target-current));
export function validRoute(route,home) {
  return Array.isArray(route) && route.length>=1 && route.length<=12 && route.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.hypot(p.x-home.x,p.z-home.z)<=LIMITS.radius);
}
export class DroneSim {
  constructor(home,ground=()=>0,hit=()=>false,landingAllowed=()=>false) { this.home={...home};this.ground=ground;this.hit=hit;this.landingAllowed=landingAllowed;this.reset(); }
  reset(){this.stickLanding=false;this.landingNotified=false;this.stickFlight=false;this.armed=false;this.landingPoint=null;this.x=this.home.x;this.z=this.home.z;this.y=this.ground(this.x,this.z)+0.5;this.heading=0;this.agl=0.5;this.mode='ready';this.battery=100;this.elapsed=0;this.distance=0;this.speed=0;this.link=100;this.events=[];this.track=[];this.route=[];this.index=0;this.targetAgl=80;this.paused=false;this.scenario='normal';this.lossTime=0;this.violations=0;this.reason='';this.completed=false;this.flightKind='route';this.manualProfile='normal';this.manualForward=0;this.manualSide=0;this.manual={forward:0,side:0,vertical:0,yaw:0};this.verticalSpeed=0;this.yawSpeed=0;this.wind={speed:0,direction:0};this.limitNotified=false;this.log('Oturum hazır');}
  log(message){this.events.push({time:this.elapsed,message});}
  setWind(speed=0,direction=0){
    if(!Number.isFinite(speed)||!Number.isFinite(direction))return false;
    this.wind={speed:clamp(speed,0,12),direction:((direction%360)+360)%360};
    if(this.active())this.log(`Rüzgâr: ${this.wind.speed} m/s · ${this.wind.direction}° yönünden`);
    return true;
  }
  resetFlight(){this.reset();this.assessment=null;this.verticalSpeed=0;this.yawSpeed=0;this.wind={speed:0,direction:0};this.limitNotified=false;}
  start(route,alt=80){if(!['ready','complete','crashed'].includes(this.mode)||!validRoute(route,this.home))return false;const wind=this.wind,profile=this.manualProfile;this.reset();this.wind=wind;this.manualProfile=profile;this.route=route.map(p=>({...p}));this.targetAgl=clamp(alt,30,120);this.assessment=new FlightAssessment(this.targetAgl);this.armed=true;this.mode='takeoff';this.log('Görev başladı • otomatik kalkış');if(this.wind.speed)this.log(`Başlangıç rüzgârı: ${this.wind.speed} m/s · ${this.wind.direction}° yönünden`);return true;}
  setManualProfile(id){if(!Object.hasOwn(MANUAL_SPEEDS,id))return false;this.manualProfile=id;if(this.active())this.log('Manuel hız: '+MANUAL_SPEEDS[id].label+' · '+MANUAL_SPEEDS[id].speed+' m/s');return true;}
  startFree(){
    if(!['ready','complete','crashed'].includes(this.mode))return false;
    const wind=this.wind,profile=this.manualProfile;this.reset();this.wind=wind;this.manualProfile=profile;
    this.flightKind='free';this.targetAgl=3;this.assessment=new FlightAssessment(3);this.armed=true;this.mode='takeoff';
    this.log('Serbest uçuş · 3 m otomatik kalkış sonrası manuel kontrol');return true;
  }
  startStickFlight(vertical){
    if(!this.armed||this.paused||!['ready','complete'].includes(this.mode)||!Number.isFinite(vertical)||vertical<=0)return false;
    const {x,y,z,heading,wind,manualProfile,battery}=this;
    this.reset();Object.assign(this,{x,y,z,heading,wind,manualProfile,battery});
    this.agl=y-this.ground(x,z);this.targetAgl=this.agl;this.stickFlight=true;
    this.flightKind='free';this.assessment=new FlightAssessment(this.agl);this.armed=true;this.mode='manual';
    this.log('Sol çubukla kalkış · yukarı iterek yüksel; ortalayınca yüksekliği koru.');return true;
  }
  toggleMotors(){
    if(this.active()||this.mode==='crashed'||this.paused)return false;
    this.armed=!this.armed;this.log(this.armed?'Motorlar hazır · sol çubukla yüksel veya Y ile otomatik kalkış':'Motorlar kapalı');return true;
  }
  landHere(allowed){
    if(!allowed||!this.active()||this.paused||this.link<=0||this.mode==='landing')return false;
    this.landingPoint={x:this.x,z:this.z};this.reason='Pilot komutu · bulunduğu yere iniş';
    this.assessment.noteReturn(this,this.reason);this.assessment.returning=false;this.mode='landing';
    this.manualForward=this.manualSide=this.yawSpeed=0;this.log('Bulunulan yere kontrollü iniş başladı');return true;
  }
  enterManual(){if(!this.active()||this.paused||this.link<=0||(this.flightKind==='free'&&this.mode==='takeoff'))return false;this.targetAgl=clamp(this.agl,this.stickFlight?.5:2,120);this.mode='manual';this.yawSpeed=0;this.manualForward=0;this.manualSide=0;this.assessment.returning=false;this.log('Manuel kontrol • W/S A/D Q/E R/F');return true;}
  active(){return !['ready','complete','crashed'].includes(this.mode);}
  hold(){if(!this.active()||this.link===0)return false;this.holdY=this.y;this.mode='hold';this.log('Konum koruma');return true;}
  resume(){if(this.flightKind==='free')return this.enterManual();if(!this.active()||this.link===0)return false;this.assessment.returning=false;this.mode='mission';this.log('Rota takibi sürüyor');return true;}
  returnHome(reason='Pilot komutu'){if(!this.active())return false;if(this.mode==='rth'||this.mode==='landing')return false;this.landingPoint=null;this.assessment.noteReturn(this,reason);this.mode='rth';this.reason=reason;this.log('Eve dönüş: '+reason);return true;}
  setScenario(value){if(!this.active())return;this.scenario=value;this.lossTime=0;if(value==='wind'&&!this.wind.speed)this.setWind(8,0);if(value==='normal')this.setWind(0,0);this.log('Eğitmen senaryosu: '+({normal:'Normal',wind:'Kuvvetli rüzgâr',link:'Bağlantı kaybı',battery:'Düşük batarya'}[value]||value));if(value==='battery'){this.battery=Math.min(24,this.battery);this.assessment.forcedBattery=true;}}
  tick(dt){if(this.paused||!this.active())return;dt=Math.min(dt,0.1);this.elapsed+=dt;const ox=this.x,oz=this.z,oy=this.y;const range=Math.hypot(this.x-this.home.x,this.z-this.home.z);this.link=this.scenario==='link'?0:clamp(100-range/35,20,100);
    if(this.link===0){this.lossTime+=dt;if(this.lossTime>=5)this.returnHome('5 saniye bağlantı kaybı');}else this.lossTime=0;
    if(this.battery<=25)this.returnHome('Düşük batarya');
    if(range>LIMITS.radius&&this.mode!=='rth'&&this.mode!=='landing'){this.violations++;this.returnHome('Eğitim sınırı aşıldı');}
    const assessmentMode=this.mode,assessmentIndex=this.index;
    let target=this.mode==='rth'||this.mode==='landing'?this.home:this.route[this.index];let targetY=this.mode==='hold'?this.holdY:this.ground(this.x,this.z)+this.targetAgl;
    if(this.mode==='takeoff'){if(Math.abs(this.y-targetY)<1){this.mode=this.flightKind==='free'?'manual':'mission';this.log(this.flightKind==='free'?'Kalkış tamamlandı · W/S A/D Q/E R/F ile uç; Eve dön ile in.':'Kalkış tamamlandı');}}
    else if(this.mode==='mission'||this.mode==='rth'){
      if(!target){this.returnHome('Rota tamamlandı');target=this.home;}
      const dx=target.x-this.x,dz=target.z-this.z,d=Math.hypot(dx,dz);
      const desired=Math.atan2(dx,-dz),error=angleDelta(desired,this.heading);
      this.heading+=clamp(error,-.65*dt,.65*dt);
      const windFrom=this.wind.direction*Math.PI/180;
      const headwind=this.wind.speed*Math.max(0,Math.cos(desired-windFrom));
      const command=Math.max(2,LIMITS.speed-headwind*.45);
      // Turn at bounded yaw rate; slow near a waypoint and while aligning the nose.
      const travel=Math.min(d,Math.min(command,Math.max(1,Math.sqrt(4*d)))*clamp(1-Math.abs(error)/.5,0,1)*dt);
      if(d>0.1){this.x+=Math.sin(this.heading)*travel;this.z-=Math.cos(this.heading)*travel;}
      if(d<(this.mode==='rth'?.4:3)){if(this.mode==='rth'){this.x=this.home.x;this.z=this.home.z;this.mode='landing';this.log('İniş başladı');}else{this.index++;this.log('Görev noktası '+this.index+' tamamlandı');if(this.index>=this.route.length){this.completed=true;this.returnHome('Rota tamamlandı');}}}
    } else if(this.mode==='manual'&&this.link>0){const wanted=this.manual.yaw*.42;this.yawSpeed+=clamp(wanted-this.yawSpeed,-.8*dt,.8*dt);this.heading+=this.yawSpeed*dt;const limit=MANUAL_SPEEDS[this.manualProfile].speed,scale=Math.max(1,Math.hypot(this.manual.forward,this.manual.side));const wantedForward=this.manual.forward/scale*limit,wantedSide=this.manual.side/scale*limit*.75;this.manualForward+=clamp(wantedForward-this.manualForward,-6*dt,6*dt);this.manualSide+=clamp(wantedSide-this.manualSide,-6*dt,6*dt);const f=this.manualForward,s=this.manualSide;this.x+=(Math.sin(this.heading)*f+Math.cos(this.heading)*s)*dt;this.z+=(-Math.cos(this.heading)*f+Math.sin(this.heading)*s)*dt;if(this.stickFlight){
        // Altitude-assisted stick flight: centered input holds the current world height.
        // The existing vertical speed limiter below integrates the commanded climb/descent.
        const ground=this.ground(this.x,this.z),v=clamp(this.manual.vertical,-1,1);
        targetY=clamp(this.y+v*(v<0?LIMITS.descent:LIMITS.climb),ground+.5,ground+LIMITS.maxAgl);
        this.targetAgl=clamp(targetY-ground,.5,LIMITS.maxAgl);
      }else this.targetAgl=clamp(this.targetAgl+this.manual.vertical*3*dt,2,120);
      if(this.manual.vertical>0&&this.targetAgl>=120){if(!this.limitNotified)this.log('120 m eğitim sınırına ulaşıldı');this.limitNotified=true;}else this.limitNotified=false;
      const a=this.wind.direction*Math.PI/180;this.x-=Math.sin(a)*this.wind.speed*.15*dt;this.z+=Math.cos(a)*this.wind.speed*.15*dt;}
    if(this.mode==='landing'){const point=this.landingPoint||this.home;targetY=this.ground(point.x,point.z)+0.5;}
    const vy=clamp(targetY-this.y,-LIMITS.descent,LIMITS.climb);this.y+=vy*dt;
    this.verticalSpeed=(this.y-oy)/dt;this.agl=this.y-this.ground(this.x,this.z);this.speed=Math.hypot(this.x-ox,this.z-oz)/dt;this.distance+=this.speed*dt;
    this.battery=Math.max(0,this.battery-(100/LIMITS.endurance)*(1+this.wind.speed/16)*dt);
    if(this.battery<=0||this.agl<0||this.hit(this.x,this.y,this.z)){this.assessment.failure=this.battery<=0?'battery':'collision';this.mode='crashed';this.armed=false;this.violations++;this.log(this.battery<=0?'Batarya tükendi':'Çarpışma • eğitim sona erdi');}
    if(this.mode==='landing'&&Math.abs(this.y-targetY)<0.1){this.mode='complete';this.armed=false;this.speed=0;this.verticalSpeed=0;this.log('Güvenli iniş • oturum tamamlandı');}
    if(this.mode==='manual'&&this.stickFlight&&this.manual.vertical<0&&this.agl<=.6){
      if(this.speed<.8&&this.landingAllowed(this)){
        this.y=this.ground(this.x,this.z)+.5;this.agl=.5;this.targetAgl=.5;
        this.landingPoint={x:this.x,z:this.z};this.reason='Pilot komutu · sol çubukla iniş';
        this.assessment.noteReturn(this,this.reason);this.assessment.returning=false;
        this.mode='complete';this.stickLanding=true;this.speed=this.verticalSpeed=this.manualForward=this.manualSide=this.yawSpeed=0;
        this.log('Yere inildi · motorlar açık. A ile motorları kapatabilirsin.');
      }else if(!this.landingNotified){this.landingNotified=true;this.log('İniş için düz, engelsiz kara veya platform üzerinde yatay hareketi durdur.');}
    }else this.landingNotified=false;
    this.assessment.sample(this,dt,assessmentMode,assessmentIndex);
    if(!this.track.length||this.elapsed-this.track.at(-1).t>=1||!this.active())this.track.push({t:+this.elapsed.toFixed(1),x:this.x,y:this.y,z:this.z,battery:this.battery,mode:this.mode});
  }
}
