import {readPlans,saveNamedPlan} from './plans.js';
import {createDefaultRoute} from './mission.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function createClassroom({getState,dialog,status,reset,loadPlan,resizeMap}){
  let expanded=null,focusBefore=null,lastIndex=0,noticeUntil=0;
  $('preset').textContent='Örnek görevler';
  const resetButton=document.createElement('button');resetButton.id='reset-flight';resetButton.textContent='↺ Uçuşu sıfırla';resetButton.disabled=true;$('launch').after(resetButton);
  resetButton.onclick=()=>{
    dialog('<h2>Uçuşu sıfırla</h2><p>Drone kalkış alanına döner; bu uçuşun süresi, puanı ve günlüğü temizlenir. Kaydettiğin planlar korunur. Bu işlem güvenli eve dönüş komutu değildir.</p><div class="route-actions"><button id="confirm-reset">Sıfırla ve planı düzenle</button><button id="cancel-reset">Vazgeç</button></div>');
    $('confirm-reset').onclick=()=>{$('dialog').close();reset();lastIndex=0;noticeUntil=0;$('waypoint-notice').hidden=true;};
    $('cancel-reset').onclick=()=>$('dialog').close();
  };
  const climb=document.createElement('small');climb.id='vertical-speed';climb.textContent='Dikey: 0.0 m/s';$('speed-value').after(climb);
  const notice=document.createElement('div');notice.id='waypoint-notice';notice.setAttribute('role','status');notice.hidden=true;$('viewport').append(notice);
  const wind=document.createElement('div');wind.className='wind-controls';wind.innerHTML='<label for="wind-speed">Rüzgâr <output id="wind-out">0 m/s</output></label><input id="wind-speed" type="range" min="0" max="12" step="1" value="0"><label for="wind-direction">Geldiği yön</label><select id="wind-direction"><option value="0">Kuzey · 0°</option><option value="45">Kuzeydoğu · 45°</option><option value="90">Doğu · 90°</option><option value="135">Güneydoğu · 135°</option><option value="180">Güney · 180°</option><option value="225">Güneybatı · 225°</option><option value="270">Batı · 270°</option><option value="315">Kuzeybatı · 315°</option></select><button id="apply-wind">Rüzgârı uygula</button><small id="wind-status" role="status">Rüzgâr: 0 m/s · Kuzey yönünden</small>';
  $('apply-scenario').after(wind);$('wind-speed').oninput=()=>{$('wind-out').textContent=$('wind-speed').value+' m/s';};
  $('apply-wind').onclick=()=>{const {sim}=getState();if(!sim)return;sim.setWind(+$('wind-speed').value,+$('wind-direction').value);status('Rüzgâr güncellendi. Yön, rüzgârın geldiği yönü gösterir.');};
  document.querySelector('#scenario option[value="wind"]').textContent='Rüzgâr · aşağıdaki ayarlar';
  const expand=document.createElement('button');expand.id='expand-map';expand.textContent='⛶';expand.setAttribute('aria-label','Haritayı büyüt');$('center').before(expand);
  function closeMap(){if(!expanded)return;expanded.classList.remove('expanded-map');expanded=null;document.body.classList.remove('map-open');$('expand-map').textContent='⛶';$('expand-map').setAttribute('aria-label','Haritayı büyüt');resizeMap();focusBefore?.focus();}
  expand.onclick=()=>{if(expanded){closeMap();return;}focusBefore=document.activeElement;expanded=document.querySelector('.map-panel');expanded.classList.add('expanded-map');document.body.classList.add('map-open');expand.textContent='✕ Kapat';expand.setAttribute('aria-label','Haritayı küçült');resizeMap();};
  const mapTools=document.createElement('div');mapTools.className='map-expand-tools';mapTools.innerHTML='<button id="large-edit">Rotayı düzenle</button><button id="large-undo">Son noktayı sil</button><span>Haritaya tıklayarak nokta ekle · Esc ile kapat</span>';$('map').before(mapTools);
  $('large-edit').onclick=()=>$('edit').click();$('large-undo').onclick=()=>$('undo').click();
  document.addEventListener('keydown',e=>{if(!expanded)return;if(e.key==='Escape'){e.preventDefault();closeMap();}if(e.key==='Tab'){const nodes=[...expanded.querySelectorAll('button,a[href],input,select,[tabindex="0"]')].filter(x=>!x.disabled&&x.getClientRects().length);const i=nodes.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&(i<0||i===nodes.length-1)){e.preventDefault();nodes[0]?.focus();}}});
  function formMessage(message){$('plan-message').textContent=message;}
  $('save').onclick=()=>{const {route,alt}=getState();dialog('<h2>Planı isimle kaydet</h2><label for="plan-name">Plan adı</label><input id="plan-name" maxlength="60" placeholder="Örneğin: Anıtkabir gözlemi 1"><button id="save-named">Planı kaydet</button><p id="plan-message" role="status"></p><p>Planlar yalnız bu tarayıcıda saklanır.</p>');$('plan-name').focus();$('save-named').onclick=()=>{try{saveNamedPlan(localStorage,getState().home,{name:$('plan-name').value,route,alt});formMessage('Plan kaydedildi.');}catch(e){formMessage(e.message);}};};
  $('load').onclick=()=>{try{const plans=readPlans(localStorage,getState().home);dialog('<h2>Kayıtlı planlar</h2><p>Yükleme mevcut uçuş planını değiştirir.</p><div class="saved-plans">'+plans.map((p,i)=>`<button data-plan="${i}">${i+1}. ${esc(p.name)} · ${p.route.length} nokta · ${p.alt} m</button>`).join('')+'</div><p id="plan-message" role="status">'+(plans.length?'':'Henüz kaydedilmiş plan yok.')+'</p>');document.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>{loadPlan(plans[+b.dataset.plan]);$('dialog').close();});}catch(e){status(e.message);}};
  $('preset').onclick=()=>{const home=getState().home;if(!home||getState().sim?.active())return;const full=createDefaultRoute(home);const examples=[{name:'Anıtkabir çevresi · 6 nokta',route:full,alt:80},{name:'Kısa başlangıç · 3 nokta',route:[full[0],full[1],full[5]],alt:60},{name:'Anıtkabir çevresi · ters yön',route:[...full].reverse(),alt:80}];dialog('<h2>Örnek görevler</h2><div class="saved-plans">'+examples.map((p,i)=>`<button data-example="${i}">${p.name}</button>`).join('')+'</div>');document.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>{loadPlan(examples[+b.dataset.example]);$('dialog').close();});};
  return {closeMap,update(sim,telemetry,markers){
    resetButton.disabled=!sim||sim.mode==='ready';$('apply-wind').disabled=!sim;
    $('vertical-speed').textContent=`Dikey: ${(telemetry.verticalSpeed||0)>=0?'↑':'↓'} ${Math.abs(telemetry.verticalSpeed||0).toFixed(1)} m/s`;
    const w=sim.wind||{speed:0,direction:0};$('wind-status').textContent=`Uygulanan: ${w.speed} m/s · ${w.direction}° yönünden`;
    $('large-edit').disabled=$('edit').disabled;$('large-edit').textContent=$('edit').textContent;$('large-undo').disabled=$('undo').disabled;
    if(sim.index>lastIndex){notice.textContent=`✓ Görev noktası ${sim.index} / ${sim.route.length} tamamlandı`;notice.hidden=false;noticeUntil=performance.now()+6000;}
    lastIndex=sim.index;if(performance.now()>noticeUntil)notice.hidden=true;
    markers.forEach((m,i)=>{const state=i<sim.index?'done':sim.flightKind!=='free'&&sim.active()&&i===sim.index?'current':'';const el=m.getElement();if(el){el.classList.toggle('waypoint-done',state==='done');el.classList.toggle('waypoint-current',state==='current');el.textContent=state==='done'?`${i+1} ✓`:String(i+1);el.setAttribute('aria-label',`Nokta ${i+1}${state==='done'?' tamamlandı':state==='current'?' sıradaki':''}`);}const row=$('route-list').children[i];row?.classList.toggle('waypoint-done',state==='done');});
  }};
}
