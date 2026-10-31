import {searchOutcome} from './night-state.js';
import {assessFlight} from './assessment.js';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=t=>`${Math.floor(t/60)} dk ${Math.floor(t%60)} sn`;

export function resultHtml(sim) {
  const r=assessFlight(sim);
  return `<section class="flight-result" aria-labelledby="result-title">
    <span class="eyebrow">UÇUŞ DEĞERLENDİRMESİ</span><h2 id="result-title">${r.outcome}</h2>
    <div class="result-score"><strong>${r.score??'—'}<small> / 100</small></strong><span>Uçuş güvenliği puanı</span></div>
    <p class="result-context">${sim.flightKind==='free'?'Serbest uçuşta rota ve sabit görev yüksekliği puanlanmaz.':sim.completed?'Planlanan tüm gözlem noktaları tamamlandı.':sim.mode==='complete'?(sim.landingPoint?'Görev kısmen tamamlandı; bulunulan yere güvenli iniş yapıldı.':'Görev kısmen tamamlandı. Güvenli erken dönüş puan kaybettirmez.'):'Görev tamamlanamadı. Önce güvenli dönüş ve inişi çalış.'} Bu puan otopilotun uçuşunu da içerir; tek başına öğrencinin pilotluk becerisini ölçmez.</p>
    <div class="metric-row"><div><b>${sim.flightKind==='free'?'Serbest':`${r.completed}/${r.total}`}</b><small>Görev noktası</small></div><div><b>${Math.round(r.battery)}%</b><small>Kalan batarya</small></div><div><b>${clock(r.elapsed)}</b><small>Uçuş süresi</small></div></div>
    <dl class="result-breakdown">${r.rows.map(row=>`<div><dt>${row.name}<small>${escape(row.detail)}</small></dt><dd>${row.earned}<span> / ${row.max}</span></dd></div>`).join('')}</dl>
    ${r.capped?'<p class="result-warning">Güvenli inişle bitmeyen uçuşlarda toplam puan en fazla 39 olur.</p>':''}
    <p><b>Dönüş / iniş nedeni:</b> ${escape(sim.reason||'Dönüş başlamadı')}<br><b>Son dönüşü başlatan:</b> ${r.returns.at(-1)?.source||'—'}</p>
    ${sim.searchResult?`<p><b>Kayıp kişi arama:</b> ${escape(searchOutcome(sim.searchResult,sim.mode))}${sim.searchResult.foundAt!=null?`<br>Tespit zamanı: ${clock(sim.searchResult.foundAt)}`:''}</p>`:''}
    <h3>Bir sonraki uçuş için</h3><ul class="result-tips">${r.suggestions.map(s=>`<li>${escape(s)}</li>`).join('')}</ul>
    <details class="result-rules"><summary>Puan nasıl hesaplanıyor?</summary>${sim.flightKind==='free'?'<p>Serbest uçuşta eğitim sınırı, enerji payı ve güvenli iniş 20’şer puandır. Toplam 60 puan, 100 üzerinden gösterilir. Rota ve sabit irtifa puanı uygulanmaz.</p>':'<p>Her ölçüt 20 puan. Rota toleransı 30 m, seçilen görev yüksekliği toleransı ±10 m. Kesintisiz sapmanın ilk 2 saniyesi tolerans süresidir; 2 saniyeye ulaşan her olay 2 puan, tolerans sonrası toplam her 5 saniye 1 puan düşürür. Aynı kesintisiz sapma tek olay sayılır. Kalkış ve iniş, seyir yüksekliği puanına katılmaz; dönüş kendi doğrudan hattına göre ölçülür.</p>'}<p>2 km eğitim sınırının her aşılması 10 puan düşürür. Normal uçuşta iniş bataryası %10 altında ise enerji payından 10 puan, enerji tükenirse 20 puan düşer. Eğitmenin zorladığı düşük yüzde tek başına cezalandırılmaz. Güvenli iniş 20 puandır. Süre ve nokta tamamlama oranı bilgi amaçlıdır. Özel yasak bölgeler ve yakın geçiş riski bu sürümde ölçülmez.</p><p>BİLSEM uçuş güvenliği v1 · Eğitim değerlendirmesidir.</p></details>
    <button id="result-report" class="primary">Puanlı CSV raporunu indir</button>
  </section>`;
}
