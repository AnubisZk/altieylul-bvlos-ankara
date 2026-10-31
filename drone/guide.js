import sections from './guide-content.json';

const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Supplied text is content, never application commands. Each paragraph is escaped.
export function createGuide({music,openDialog,quickStart}){
  const modal=document.getElementById('dialog');
  const audio=new Audio();
  audio.preload='none';
  let run=0,reading=false,current=0,readingEnd=Infinity,loaded=-1;
  const paragraphs=sections.flatMap((s,section)=>s.paragraphs.map(text=>({text,section})));
  const el=id=>document.getElementById(id);
  const message=text=>{if(el('guide-audio-status'))el('guide-audio-status').textContent=text};
  function stop(){
    run++;reading=false;audio.pause();audio.onended=null;
    el('guide-read')?.setAttribute('aria-pressed','false');
    if(el('guide-read'))el('guide-read').textContent='▷ Kadın sesiyle dinle';
    music.setNarrating(false);
    modal.querySelectorAll('.guide-reading').forEach(p=>p.classList.remove('guide-reading'));
  }
  function read(index,end=paragraphs.length,resume=false){
    stop();current=index;readingEnd=Math.min(end,paragraphs.length);
    if(audio.error)loaded=-1;
    if(!resume&&loaded===index)audio.currentTime=0;
    const token=run;reading=true;music.setNarrating(true);
    el('guide-read').textContent='Ⅱ Okumayı duraklat';el('guide-read').setAttribute('aria-pressed','true');
    function next(){
      if(token!==run)return;
      if(current>=Math.min(readingEnd,paragraphs.length)){const complete=readingEnd===paragraphs.length;stop();current=0;loaded=-1;readingEnd=paragraphs.length;message(complete?'Okuma tamamlandı.':'Bölüm tamamlandı.');return}
      const p=paragraphs[current],node=el('guide-paragraph-'+current);
      modal.querySelectorAll('.guide-reading').forEach(n=>n.classList.remove('guide-reading'));
      node.closest('details').open=true;node.classList.add('guide-reading');
      message(`${sections[p.section].title} · ${current+1}/${paragraphs.length} · Türkçe kadın sesi`);
      if(loaded!==current){audio.src=`/music/guide-emel-v2/${String(current).padStart(2,'0')}.mp3`;loaded=current}
      audio.onended=()=>{if(token===run){current++;next()}};
      audio.play().catch(()=>{if(token===run){stop();message('Ses yüklenemedi. İnternet bağlantını kontrol edip Dinle düğmesiyle tekrar deneyebilirsin.')}});
    }
    next();
  }
  audio.addEventListener('error',()=>{if(reading){stop();message('Ses yüklenemedi. İnternet bağlantını kontrol edip Dinle düğmesiyle tekrar deneyebilirsin.')}});
  modal.addEventListener('close',stop);
  modal.addEventListener('cancel',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();message('Okuma duraklatıldı. Dinle düğmesiyle devam edebilirsin.')}});
  return {stop,open(){
    let i=0;
    openDialog(`<section class="guide"><span class="eyebrow">UÇUŞ ÖNCESİ / REHBER</span><h2 id="guide-title">Kullanım kılavuzu</h2><p class="guide-intro">Kısa başlangıç, bölüm bölüm eğitim metni ve sesli okuma.</p><details class="guide-quick" open><summary>Bu sürümde hızlı başlangıç</summary>${quickStart}</details><div class="guide-audio"><b>Sesli rehber</b><p>Kılavuzu Türkçe kadın sesiyle dinleyebilir, okumayı duraklatabilir veya bir bölümden başlatabilirsin.</p><div class="guide-actions"><button id="guide-read" aria-pressed="false">▷ Kadın sesiyle dinle</button><button id="guide-restart">Baştan oku</button></div><p id="guide-audio-status" role="status">Dinlerken arka plan müziği duraklatılır.</p></div><p class="guide-note">Bu rehber mevcut kontrollerle eşleşir. Batarya göstergesi kalan yüzdeyi verir; uçuş süresi tahmini değildir. Görev değerlendirmesi ve CSV raporu uçuş sonunda açılır.</p><div class="guide-chapters">${sections.map((s,n)=>`<details><summary><span>${String(n).padStart(2,'0')}</span> ${escape(s.title)}</summary><button class="guide-section-read" data-start="${i}">Bu bölümü dinle</button>${s.paragraphs.map(p=>`<p id="guide-paragraph-${i++}">${escape(p)}</p>`).join('')}</details>`).join('')}</div></section>`);
    modal.setAttribute('aria-label','Kullanım kılavuzu');
    el('guide-read').onclick=()=>{if(reading){stop();message('Okuma duraklatıldı. Kaldığın yerden devam edebilirsin.')}else read(current,readingEnd,true)};
    el('guide-restart').onclick=()=>read(0);
    modal.querySelectorAll('.guide-section-read').forEach(b=>b.onclick=()=>{const start=Number(b.dataset.start);const end=paragraphs.findIndex((p,i)=>i>start&&p.section!==paragraphs[start].section);read(start,end<0?paragraphs.length:end)});
  }};
}
