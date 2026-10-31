# Claude için devir notu — Ankara / Anıtkabir

Tarih: 31 Ekim 2026

## Hedef ve başlangıç noktası

Altıeylül BİLSEM BVLOS drone simülatörü Ankara için uyarlanacak. İlk odak Anıtkabir çevresi ve altı noktalı eğitim görevleri. Paketler çalışan İstanbul kaynaklarıdır; Ankara haritası ve Anıtkabir modeli henüz oluşturulmadı.

Ana ekranı, özellikle sağ üstteki haritayı koru. Uçuş, kamera, görev raporu, gece/termal eğitim, hava görünümü, müzik/kılavuz ve kumanda kontrollerini bozma. Önce normal sürümde çalış; Quest ayrı projedir. Ankara için ayrı çalışma kopyası ve yeni yayın hedefi kullan; İstanbul sitelerini değiştirme.

- Normal: v0.9.2, commit b7218db; GamePower / Gamepad API ve klavye.
- Quest 3: v0.6.0, commit 2e5b19d; Quest'in kendi kumandaları ve VR masası.
- README içindeki eski açıklamalar tarihsel olabilir. Son davranış için package.json, STICK-LANDING-RELEASE.md (normal) ve QUEST-CONTROLS-RELEASE.md (XR) esas alınmalı.

Son kontrol akışı: A yerde motor aç/kapat; motorları açtıktan sonra çubukları bırak; sol çubuk yukarı kalkış, ortada irtifa koruma, aşağı uygun zemine iniş. Manuel inişte motorlar açık kalır, A ile kapanır. Y 3 m otomatik kalkış, B uygun zemine otomatik iniş. Quest'te A/B sağ, X/Y sol kumandada. Tetikler VR masası düğmelerini kullanır.

## Çalıştırma

Paketleri ayrı klasörlere çıkar. Node.js 22 veya üzeri ve npm gerekir.

```sh
npm ci
npm test
npm run build
npm start
```

Normal: http://127.0.0.1:5188/ — XR: http://127.0.0.1:5190/

Sunucu dist klasörünü sunar; değişiklikten sonra yeniden build gerekir. Quest cihazında WebXR için HTTPS gerekir. Yerel XR emülatörü: build sonrası `node tools/xr-qa.mjs`, ardından `/xr-qa.html`. Yayından önce tekrar build yap; emülatör girişleri dağıtımdan çıkarılır.

## Kod haritası

- index.html / style.css: arayüz.
- drone/main.js: uygulama, kamera, girişler, başlangıç koordinatları ve `loadMap('ist')`.
- drone/sim.js: uçuş, irtifa koruma, motor, iniş, RTH.
- drone/mission.js: altı görev noktası ve tarihi yapılar.
- drone/gamepad-input.js / gamepad-flight.js: analog giriş ve iniş uygunluğu.
- Normalde drone/gamepad-panel.js: kumanda ayarları ve kalibrasyon.
- XR'de drone/quest-input.js / xr-station.js / xr-map.js: Quest ve VR masası.
- drone/assessment.js / result.js: puan ve rapor.
- src/maps/index.js / ist.js / utm.js ve src/geo.js: bölge ve koordinat dönüşümü.
- data/ist/: İstanbul bölge tanımı ve yerel veriler.
- drone/imagery.js / imagery-geo.js: hava fotoğrafı, sınırlar, hizalama.
- drone/heritage*.js / harbor.js: tarihi yapı ayrıntıları ve deniz çevresi.
- drone/night-*.js / weather.js: gece, termal arama, hava görünümü.
- models/bilsem-surveyor.blend / .glb ve models/branding/: drone ve okul logosu.
- tools/build.mjs / cdn.js: derleme ve dış varlık yönlendirmesi.

## Ankara için yapılacaklar

1. Yalnız harita merkezini değiştirmek yeterli değil. Yeni bölgenin projeksiyonu, origin/bounds, arazi yüksekliği, bina/engel verisi ve görselleri birlikte hazırlanmalı. İstanbul yerel koordinatlarını doğrudan kullanma.
2. Ankara için ayrı harita modülü ve veri dizini oluştur. Başlangıç, altı görev noktası, kamera hedefleri, sınırlar ve testleri güncelle. İlk kapsamı Anıtkabir çevresi olarak sınırlandır; bütün Ankara hazırlanmış gibi gösterme.
3. Anıtkabir modelini kaynağı ve kullanım koşulları belli bir varlıktan edin veya özgün üret. Arazi/bina verisinin kullanılabilirliğini önce doğrula. Eksikleri belirt; temsili geometriyi gerçek ölçüm gibi sunma.
4. İstanbul iskele/deniz/tekne öğelerini Ankara çevresine uygun düzenle. Zemin, merdivenler, yapı çarpışmaları ve iniş uygunluğu birlikte ele alınmalı.
5. Hava fotoğrafı yükleyicisinin İstanbul sınırlarını, zemin kaplamalarını, kılavuz metinlerini ve gece arama noktalarını incele. Sağ üst haritanın ekran yerleşimini koru.
6. Build'in yalnız data/ist kopyalamasını ve cdn.js yönlendirmesini yeni bölgeye göre düzenle. Mevcut varlık sunucusunda Ankara verisi bulunduğunu varsayma.
7. Küçük bir çalışan Ankara alanında görev/kumanda akışını doğrula, sonra ayrıntıyı artır. Ankara'yı mevcut İstanbul Netlify site kimlikleriyle yayınlama.

## Paket kapsamı

Kaynak kod, testler, bağımlılık kilidi, drone modelleri, okul logosu, müzik/sesler ve yerel veriler dahildir. node_modules, dist, .git, hesap oturumları ve imagery.local.json dahil değildir. npm ci bağımlılıkları kurar.

Bu tamamen çevrimdışı bir şehir varlık paketi değildir. İstanbul arazi/şehir varlıklarının bir bölümü cdn.js içindeki Cloudflare dağıtımından, 2B harita internetten yüklenir. Ankara'nın veri/model paketi ayrıca hazırlanmalıdır.

ArcGIS anahtarı kaynakta boştur; mevcut sürüm temel zemin yoluna döner. Yeni yayın için alan adına kısıtlı kamu uygulaması anahtarı ayrıca ayarlanmalıdır. Hesap şifresi veya özel yönetim anahtarı koda konmamalı. Harita ve dağıtım oturumları arşivle taşınmaz.

LICENSE, NOTICE, ASSETS-LICENSE.md ve kaynak atıflarını koru; yeni varlıkların koşullarını ayrıca incele.

Son kontrolde normal kaynakta 69, XR'de 75 otomatik test geçti. Normalde Chrome/Edge sentetik kumanda, XR'de Quest 3 emülatörü doğrulandı. Fiziksel GamePower/Quest testi yapılmış sayılmaz.
