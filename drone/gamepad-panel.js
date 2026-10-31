import {AXES,ACTIONS,DEFAULTS,GamepadInput,settingsFrom,mappingError} from './gamepad-input.js';
const STORAGE='bilsem-gamepad-v1';
export function createGamepadPanel({getSim,onSuspend,status}){
  let settings,storage;
  try{storage=localStorage;settings=settingsFrom(JSON.parse(storage.getItem(STORAGE)));}catch{settings=settingsFrom();}
  const input=new GamepadInput(settings);
  const host=document.querySelector('.pilot-controls'),flight=host.querySelector('.wind-controls');
  const tabs=document.createElement('div');tabs.className='pilot-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Uçuş ayarları');
  tabs.innerHTML='<button id="pilot-flight-tab" role="tab" aria-selected="true" aria-controls="pilot-flight-panel">Uçuş / kamera</button><button id="pilot-pad-tab" role="tab" aria-selected="false" aria-controls="pilot-pad-panel" tabindex="-1">Oyun Kolu</button>';
  flight.id='pilot-flight-panel';flight.setAttribute('role','tabpanel');flight.setAttribute('aria-labelledby','pilot-flight-tab');
  host.insertBefore(tabs,flight);
  const panel=document.createElement('div');panel.id='pilot-pad-panel';panel.className='gamepad-panel';panel.hidden=true;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','pilot-pad-tab');host.append(panel);
  panel.innerHTML=`<p id="pad-status" role="status"></p><label for="pad-device">Bağlı kumanda</label><select id="pad-device"><option value="">Otomatik seç</option></select>
    <p id="pad-info"></p><p id="pad-motors"></p>
    <div class="pad-sticks" aria-label="Ham analog hareketleri"><div><span>Sol analog</span><div class="pad-stick"><i id="pad-left"></i></div></div><div><span>Sağ analog</span><div class="pad-stick"><i id="pad-right"></i></div></div></div>
    <output id="pad-values" aria-label="Analog ve düğme değerleri"></output>
    <p>Varsayılan Mode 2: sol çubuk yükseklik/yön, sağ çubuk ileri–geri/sağ–sol. Ortada irtifa korunur. A: motorları hazırla, çubukları bırak; sol çubuğu yukarı iterek kalk. Ortalayınca mevcut yüksekliği korur. Aşağı çekerek uygun zemine in; ardından A ile motorları kapat. Y: 3 m otomatik kalkış. B: uygun zemine iniş. X: görünüm. LT/RT: kamera eğimi. Start: duraklat. Sol çubuğa bas: manuel kontrol. RB: eve dön. Eşlemeyi değiştirdiğinde yeni atamalar geçerlidir.</p>
    <p>Klavye aynı eksende önceliklidir. Havada motorlar kapatılamaz. Kol koparsa manuel uçuş konum korur; rota ve eve dönüş devam eder. Ayarlar açıkken kol yalnız test edilir, uçuş komutu vermez.</p>
    <label for="pad-deadzone">Deadzone <output id="pad-deadzone-value"></output></label><input id="pad-deadzone" type="range" min="0" max=".35" step=".01">
    <details open><summary>Eksen eşleme ve hassasiyet</summary><div id="pad-axes"></div></details>
    <details><summary>Tuş eşleme</summary><div id="pad-buttons"></div></details>
    <details><summary>Kalibrasyon ve tarayıcı testi</summary><p>Çubukları serbest bırakıp merkez ölçümünü başlat. Ardından çubukları tüm yönlere götürerek üstteki değerlerin −1 ile +1 arasında değiştiğini kontrol et. Düğmelere basınca numaraları görünür. Uygun eksen ve ters yönü aşağıdaki ayarlardan seç.</p><button id="pad-calibrate">Merkezi ölç · 1 saniye</button><button id="pad-center-reset">Merkez düzeltmesini kaldır</button><p id="pad-calibration" role="status"></p><small>İlk tanıma için sayfaya tıkla ve kolda bir düğmeye bas. Chrome, Edge veya Firefox'ta bu ekranla test edebilirsin. Model adı tek başına uyumluluk garantisi değildir.</small></details>
    <button id="pad-approve">Bu kol için eşlemeyi onayla</button><button id="pad-defaults">Mode 2 varsayılanlarını yükle</button><p id="pad-settings-status" role="status"></p>`;
  const $=id=>panel.querySelector('#'+id);
  const options=(count,none=false)=>`${none?'<option value="-1">Kullanma</option>':''}`+Array.from({length:count},(_,i)=>`<option value="${i}">${i}</option>`).join('');
  for(const [key,label] of Object.entries(AXES)){
    const row=document.createElement('fieldset');row.innerHTML=`<legend>${label}</legend><label for="pad-axis-${key}">Eksen numarası</label><select id="pad-axis-${key}">${options(32)}</select><label for="pad-gain-${key}">Hassasiyet <output id="pad-gain-value-${key}"></output></label><input id="pad-gain-${key}" type="range" min=".2" max="2" step=".05"><label class="pad-check"><input id="pad-invert-${key}" type="checkbox">Yönü ters çevir</label>`;
    $('pad-axes').append(row);
  }
  for(const [key,label] of Object.entries(ACTIONS)){
    const row=document.createElement('label');row.htmlFor='pad-button-'+key;row.textContent=label;
    const select=document.createElement('select');select.id='pad-button-'+key;select.innerHTML=options(64,true);$('pad-buttons').append(row,select);
  }
  let active=false,last=null,lastDevices='',uiTime=0,calibration=null;
  function latch(){input.suspend();onSuspend();}
  function tab(usePad){
    active=usePad;panel.hidden=!active;flight.hidden=active;
    for(const [i,b] of [...tabs.children].entries()){const selected=!!i===active;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;}
    if(active)latch();
  }
  tabs.children[0].onclick=()=>tab(false);tabs.children[1].onclick=()=>tab(true);
  tabs.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();tab(e.key==='Home'?false:e.key==='End'?true:!active);tabs.children[+active].focus();}};
  host.addEventListener('toggle',()=>{input.suspend();if(host.open&&active)latch();});
  function renderSettings(){
    $('pad-deadzone').value=settings.deadzone;$('pad-deadzone-value').textContent=settings.deadzone.toFixed(2);
    for(const [key,a] of Object.entries(settings.axes)){$('pad-axis-'+key).value=a.index;$('pad-gain-'+key).value=a.sensitivity;$('pad-gain-value-'+key).textContent=a.sensitivity.toFixed(2);$('pad-invert-'+key).checked=a.invert;}
    for(const [key,v] of Object.entries(settings.buttons))$('pad-button-'+key).value=v;
  }
  function save(){
    input.configure(settings);
    const error=mappingError(settings);
    if(error){$('pad-settings-status').textContent=error;return;}
    try{storage.setItem(STORAGE,JSON.stringify(settings));$('pad-settings-status').textContent='Ayarlar bu tarayıcıya kaydedildi.';}
    catch{$('pad-settings-status').textContent='Tarayıcı kaydı kullanılamıyor; ayarlar bu oturumda geçerli.';}
  }
  panel.addEventListener('input',e=>{
    if(e.target.id==='pad-deadzone')settings.deadzone=Number(e.target.value);
    else if(e.target.id.startsWith('pad-axis-'))settings.axes[e.target.id.slice(9)].index=Number(e.target.value);
    else if(e.target.id.startsWith('pad-gain-'))settings.axes[e.target.id.slice(9)].sensitivity=Number(e.target.value);
    else if(e.target.id.startsWith('pad-invert-'))settings.axes[e.target.id.slice(11)].invert=e.target.checked;
    else if(e.target.id.startsWith('pad-button-'))settings.buttons[e.target.id.slice(11)]=Number(e.target.value);
    else return;
    calibration=null;save();renderSettings();
  });
  $('pad-device').onchange=()=>{input.select($('pad-device').value===''?null:Number($('pad-device').value));calibration=null;latch();};
  $('pad-defaults').onclick=()=>{settings=settingsFrom(DEFAULTS);calibration=null;save();renderSettings();};
  $('pad-center-reset').onclick=()=>{settings.centers={};calibration=null;save();$('pad-calibration').textContent='Merkez düzeltmesi kaldırıldı.';};
  $('pad-approve').onclick=()=>{if(last?.pad&&!mappingError(settings)){settings.approvedDevices=[...new Set([...settings.approvedDevices,last.pad.id])].slice(-20);save();}};
  $('pad-calibrate').onclick=()=>{if(!last?.pad)return;calibration={device:input.device,start:performance.now(),samples:[]};$('pad-calibration').textContent='Çubukları bırak; merkez ölçülüyor…';latch();};
  function updateCalibration(now,pad){
    if(!calibration)return;
    const indices=Object.values(settings.axes).map(a=>a.index),values=pad?indices.map(i=>pad.axes[i]):[];
    if(calibration.device!==input.device||!values.length||values.some(v=>!Number.isFinite(v)||Math.abs(v)>.25)){calibration=null;$('pad-calibration').textContent='Ölçüm iptal: çubukları bırak veya doğru kumandayı seç.';return;}
    calibration.samples.push(values);
    if(now-calibration.start<1000)return;
    const samples=calibration.samples;calibration=null;
    if(samples.length<10){$('pad-calibration').textContent='Ölçüm yetersiz; sayfa açıkken tekrar dene.';return;}
    const centers={};for(let i=0;i<values.length;i++){
      const a=samples.map(v=>v[i]);if(Math.max(...a)-Math.min(...a)>.08){$('pad-calibration').textContent='Ölçüm sırasında çubuk oynadı; tekrar dene.';return;}
      centers[indices[i]]=a.reduce((a,b)=>a+b,0)/a.length;
    }
    settings.centers=centers;save();$('pad-calibration').textContent='Merkez ölçüldü. Çubukları hareket ettirerek yönleri kontrol et.';
  }
  // Listen as well as poll: a tab can miss an event, and a disconnected device can reuse an index.
  const disconnected=e=>{if(last?.pad?.index===e.gamepad.index){latch();if(getSim()&&!getSim().active())getSim().armed=false;}};
  window.addEventListener('gamepadconnected',()=>input.suspend());
  window.addEventListener('gamepaddisconnected',disconnected);
  window.addEventListener('blur',()=>{input.suspend();if(last?.pad)onSuspend();});
  renderSettings();
  return {
    suspend:()=>input.suspend(),
    get diagnostic(){return {connected:!!last?.pad,ready:!!last?.ready,mapping:last?.pad?.mapping||'',settingsOpen:active&&host.open};},
    update(now,blocked=false){
      let pads=[],error='';try{pads=navigator.getGamepads?.()||[];}catch{error='Tarayıcı oyun kolu erişimini engelledi; klavye kullanılabilir.';}
      const frame=input.step(pads,blocked||(active&&host.open)||!!calibration);
      if(frame.disconnected){onSuspend();if(getSim()&&!getSim().active())getSim().armed=false;}
      last=frame;updateCalibration(now,frame.pad);
      if(now-uiTime>100){uiTime=now;
        const signature=frame.devices.map(p=>p.index+':'+p.id).join('|');
        if(signature!==lastDevices){lastDevices=signature;const selected=$('pad-device').value;$('pad-device').replaceChildren(new Option('Otomatik seç',''),...frame.devices.map(p=>new Option(p.id,String(p.index))));$('pad-device').value=selected;if(input.index!==null&&!frame.devices.some(p=>p.index===input.index))$('pad-device').add(new Option('Seçili kumanda bağlı değil',String(input.index),true,true));}
        $('pad-status').textContent=error||(!navigator.getGamepads?'Bu tarayıcı Gamepad API sunmuyor; klavye kullanılabilir.':frame.message);
        $('pad-info').textContent=frame.pad?`${frame.pad.id} · ${frame.pad.mapping||'özel eşleme'} · ${frame.pad.axes.length} eksen / ${frame.pad.buttons.length} düğme`:'Kumandayı bağla ve bir düğmeye bas.';
        $('pad-motors').textContent=getSim()?.armed?'Motorlar açık':'Motorlar kapalı';
        const axes=frame.pad?.axes||[];
        for(const [id,x,y] of [['pad-left',0,1],['pad-right',2,3]])$(id).style.transform=`translate(${(axes[x]||0)*28}px,${(axes[y]||0)*28}px)`;
        $('pad-values').textContent=Array.from(axes,(v,i)=>`E${i}: ${v.toFixed(2)}`).join(' · ')+' | Basılı: '+Array.from(frame.pad?.buttons||[],(b,i)=>b.pressed?i:null).filter(i=>i!==null).join(', ');
        $('pad-calibrate').disabled=!frame.pad||!!calibration;$('pad-approve').disabled=!frame.pad;
      }
      return frame;
    }
  };
}
