import {validRoute} from './sim.js';
export const PLAN_KEY='bilsem.bvlos.plans.v2';
export function validPlan(p,home){return p&&typeof p.name==='string'&&p.name.trim().length>0&&p.name.length<=60&&validRoute(p.route,home)&&Number.isFinite(p.alt)&&p.alt>=30&&p.alt<=120;}
export function readPlans(storage,home){
  const raw=storage.getItem(PLAN_KEY);
  if(raw!==null){const plans=JSON.parse(raw);if(!Array.isArray(plans)||plans.length>30||!plans.every(p=>validPlan(p,home)))throw Error('Plan kayıtları okunamadı; mevcut kayıtlar korunuyor.');return plans;}
  const old=storage.getItem('bilsem.bvlos.plan.v1');if(!old)return [];
  const p={...JSON.parse(old),name:'Önceki kayıt'};
  if(!validPlan(p,home))throw Error('Önceki plan geçerli değil; kayıt korunuyor.');
  return [p];
}
export function saveNamedPlan(storage,home,plan){
  const p={name:plan.name.trim(),alt:plan.alt,route:plan.route.map(({x,z})=>({x,z}))};
  if(!validPlan(p,home))throw Error('Plan adı 1–60 karakter, yükseklik 30–120 m ve rota geçerli olmalı.');
  const plans=readPlans(storage,home);
  if(plans.some(x=>x.name.toLocaleLowerCase('tr')===p.name.toLocaleLowerCase('tr')))throw Error('Bu ad zaten var. Kaydı korumak için farklı bir ad kullan.');
  if(plans.length>=30)throw Error('En fazla 30 plan saklanabilir.');
  storage.setItem(PLAN_KEY,JSON.stringify([...plans,p]));return p;
}
