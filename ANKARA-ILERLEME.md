# Ankara / Anıtkabir — ilerleme ve devir notu

## 1 Kasım 2026 · Yerel sürüm `ank-0.2.0`

Sağ görev haritası açılışta Ordular Sokak, İlk Sokak, Hedef Sokak, Akdeniz Caddesi, İleri Sokak ve Anıtkabir'i gösterir. Sokak çizgileri ve etiketleri pakette bulunur. **Merkezle** görev rotasını, **Anıtkabir sokakları** açılış görünümünü getirir.

Müzik açıkken drone Anıtkabir yerleşkesi içinde **Atam Sen Rahat Uyu**, dışında **Ankara’nın Taşına Bak** çalar. Tandoğan tarafındaki kalkış pedi yerleşke sınırı içindedir. İki kayıt da yerel pakettedir.

Üç boyutlu sahne Copernicus yüksekliklerini ve OpenStreetMap bina, yol ve park verilerini kullanır. Gece termal arama dersi hedefi yakındaki uygun bir yeşil alana yerleştirir. Ankara sesli kılavuzu güncellendi. Ayrıntılı Anıtkabir modeli bekliyor.

Node.js 22+ ile proje klasöründe sırasıyla `npm ci`, `npm test`, `npm run build` ve `npm start` çalıştırılır. Önizleme <http://127.0.0.1:5188/> adresindedir. Bu sürüm yerelde test edildi. Vercel yayını ayrı bir adımdır.

İsteğe bağlı ArcGIS hava görüntüsü için derleme `ARCGIS_API_KEY` ortam değişkenini okur. Yerel seçenek Git dışında tutulan `imagery.local.json` dosyasındaki `apiKey` alanıdır. Anahtar tarayıcıya gönderildiği için yalnız gerekli görüntüleme yetkisini verin ve izinli kaynağı Ankara sitesine kısıtlayın. Vercel değişkenini ayarladıktan sonra yeni derleme gerekir. Hesap parolası kullanılmaz.

## 31 Ekim 2026 tarihli önceki devir kaydı · `ank-0.1.0`

Bu dosya, çalışma başka bir hesapta veya oturumda sürdürülürken ilk okunacak nottur. Önce bunu, sonra
`CLAUDE-ANKARA-DEVIR.md` dosyasını okuyun.

## Alınmış kararlar (Zafer Hoca onayladı)

- Kalkış **Tandoğan** tarafından yapılır. Senaryo "özel izinli uçuş"tur. Anıt Blok üzerinde yasak bölge (geofence) yoktur.
- Anıtkabir'e çarpmada kırılma veya hasar efekti gösterilmez; drone durur ve uyarı verir (henüz kodlanmadı).
- Normal sürümle ilerlenir; Quest ayrı tutulur. İstanbul sitelerine yayın yapılmaz; Ankara ayrı site olacak.
- **Yayın Vercel'e yapılacak** (Netlify değil). Yeni ayrı Vercel projesi; `vercel.json` hazır (build: `npm run build`, çıktı: `dist`).
- Veri: Copernicus GLO-30 (arazi) ve OSM (bina, yol, park). Zafer Hoca dosyaları indirip gönderecek.
- ArcGIS anahtarını Zafer Hoca alacak; anahtar yalnız yeni Ankara sitesinin adresine kısıtlı olacak. Anahtar koda değil
  `imagery.local.json` dosyasına konur (build bunu `dist/data/ank/imagery.json` içine yazar).
- Anıtkabir modeli: Blender'da (Zafer Hoca'nın bilgisayarındaki Blender bağlantısıyla) plan ölçülerinden betikle
  üretilecek, "temsili" diye etiketlenecek. Meshy yalnız ağaç, bank, araç gibi çevre süsleri için kullanılacak.

## Yapılanlar (ank-0.1.0)

- İstanbul dünyası (`src/world-sf` + R2 karoları) yerine **`drone/ankara-world.js`** yazıldı. Drone katmanının kullandığı
  dar API'nin aynısını sunar: `getGroundHeight`, `getObstacleHeight`, `isWater` (her zaman false), `hitTest`,
  `update`, `setPlayable`, `terrain.shared` (hava fotoğrafı ve çizilmiş zemin uniform'ları), `landmarks`,
  `environment` (Gökyüzü atmosferi aynen kullanılıyor). `addLayer()` ile ileride Anıtkabir modeli eklenecek.
- `data/ank/region.json`: UTM 36N (EPSG:32636), başlangıç noktası Anıt Blok (39.925, 32.836944; OSM ile doğrulanacak),
  yerel alan ±3 km. Tandoğan kalkışı `home` alanında (39.9292, 32.8299; **geçici**, OSM ile düzeltilecek).
  `fallbackElevation` 880 m: arazi verisi yokken düz zemin.
- `drone/mission.js`: Anıt Blok çevresinde ~400 m yarıçaplı altı noktalı rota. `ANCHOR_FROM_HOME` değeri kalkış
  konumu değişince yeniden hesaplanmalı (`tests/ankara.test.mjs` eski kalırsa uyarır).
- `drone/launch-site.js`: iskele, tekne ve deniz öğelerinin yerini aldı (yalnız kalkış pedi).
- `drone/ground.js` ve `drone/imagery.js`: veri yolu ve görüntü sınırları parametre oldu; İstanbul varsayılanları korunuyor.
- `cdn.js`: Ankara'da hiçbir istek okulun R2 sunucusuna yönlendirilmiyor.
- `tools/build.mjs`: `data/ist` yerine `data/ank` kopyalanıyor.
- Arayüz metinleri Ankara'ya uyarlandı (başlık, görev planı, yükleme, künye, kılavuz girişi). Sağ üst harita
  Anıtkabir'e ortalı.
- `tools/ankara/prepare-data.mjs`: GLO-30 .tif ve Overpass .json dosyalarından `terrain.json`, `buildings.json`,
  `ground.json`, `landmarks.json`, `report.txt` üretir (Node, `geotiff` geliştirme bağımlılığı). Sentetik veriyle
  denendi; gerçek veriyle henüz çalıştırılmadı.
- `window.bvlosState.world`: hangi veri kaynaklarının yüklendiğini gösterir (otomatik doğrulama için).
- Testler: 72/72 geçiyor (69 eski + 3 Ankara). Headless Chromium'da sayfa açılıyor, `ready` oluyor; sentetik
  veriyle bina, zemin ve simge yükleniyor.

## Gerçek arazi (31 Ekim, 20:15)

- Zafer Hoca GLO-30 paftasını gönderdi (`Copernicus_DSM_COG_10_N39_00_E032_00_DEM.tif`, N39 E032). Ham dosya pakete
  konmadı (40 MB); gerekirse aynı adresten yeniden indirilir.
- `node tools/ankara/prepare-data.mjs --dem <tif>` çalıştırıldı → `data/ank/terrain.json` (301×301, 20 m,
  829.8–993.5 m). Anıt Blok ≈ 902.7 m (ham DSM ≈ 905–906 m), Tandoğan pedi ≈ 871 m.
- Arazi uygulamada yükleniyor; drone pedden kalkıyor. Zemin dokusu yumuşak gürültüye çevrildi.
- Bilinen eksik: 6 km'lik arazi karesinin kenarı ufukta basamak gibi görünüyor (ileride kenar eteği/ufuk halkası).
- `tools/build.mjs` artık `dist/data` klasörünü her build'de temizliyor (eski veri kalmıyor).

## OSM verisi (31 Ekim, 20:30)

- Zafer Hoca `ankara-merkez-osm-verileri.zip` gönderdi (Overpass, `out body geom`, 39.905–39.955 K / 32.815–32.885 D,
  OSM tarihi 2026-10-31T17:21Z). `prepare-data.mjs` artık satır içi geometriyi (`geometry`) ve `building:part` öğelerini okuyor.
- Başlangıç noktası düzeltildi: Anıt Blok = OSM way 28241512 "Mustafa Kemal Atatürk Türbesi" (39.925634, 32.838007).
- Kalkış pedi: Tandoğan kapısı yakınındaki çim alan, OSM way 1128199619 (39.93029, 32.83512), ≈ 883 m.
  `ANCHOR_FROM_HOME` = [246, 517].
- Bina/zemin alanı Anıt Blok çevresinde ±2 km: 8313 bina (7458'inin yüksekliği tahmini, tür bazlı), 4228 yol/park/yeşil alan.
- Tarihi yapı menüsü: Anıt Blok, Aslanlı Yol, İstiklal ve Hürriyet kuleleri, İsmet İnönü Lahdi, Barış Parkı.
- OSM'deki Anıt Blok yüksekliği 11.75 m (gerçek yapıdan düşük); temsili Blender modeli bunu değiştirecek.
- Headless Chromium: 8313 bina tek mesh, ~372 bin üçgen, 28 çizim çağrısı; sayfa ~7 sn'de hazır.

## Yayın (31 Ekim, 20:47)

- GitHub: https://github.com/AnubisZk/altieylul-bvlos-ankara (dal `main`; Claude GitHub uygulaması kurulu).
- Vercel projesi: `altieylul-bvlos-ankara` (prj_NCzS43uma5cfu4gwTNSht12D4UGU, takım team_cQj2sAnuqQqKoymTzVlCgwG8),
  Git'e bağlı: `main`'e her push otomatik üretim yayını yapar. Node 22.x; build `npm run build`, çıktı `dist`.
- Canlı adres: https://altieylul-bvlos-ankara.vercel.app
- Vercel kimlik koruması yalnız önizleme (preview) yayınlarında; üretim adresi herkese açık (öğrenciler girebilsin diye).
- İstanbul siteleri (Netlify) değiştirilmedi.

## Anıtkabir modeli ve Türk bayrağı (1 Kasım)

- Zafer Hoca Meshy ile Anıtkabir modeli üretti (`Meshy_AI_Anıtkabir_Under_Dram_…glb`, 80 MB, 486 bin üçgen, 8K doku).
  Ham dosya repoda yok; yeniden işlemek için: `node tools/ankara/prepare-anitkabir.mjs --in <meshy.glb>`.
- `models/anitkabir.glb`: 68 bin üçgen, 3.6 MB, WebP 2048 doku; Meshy'nin mavi çatıları kurşun griye çevrildi, metalik 0.
- Yerleşim (`data/ank/anitkabir.json`): Anıt Blok → OSM Türbe (yerel 0,0); yön → 8 kule düğümünün merkezinden Türbe'ye
  kerteriz ≈ 52° (rotation.y 38°); ölçek Anıt Blok cephesi 57.35 m → 120.7 m/birim; meydan zemini GLO-30'dan 902.7 m.
  Aslanlı Yol (OSM) modelin yan girişine düşüyor; görsel kontrol yapıldı.
- Çarpışma: 1 m üst yüzey ızgarası (`drone/anitkabir.js`). Meydan/basamaklar zemin; Anıt Blok, revaklar, kuleler engel.
  Anıta 2.5 m'den fazla yaklaşınca çarpışma YOK: adım geri alınır, drone konum korur, uyarı verir (`main.js guardedTick`).
  Ayak izindeki OSM binaları (Türbe, müze, revaklar) gösterilmiyor; görsel arazi meydan altında 2 m çökertildi.
- Türk bayrağı: `tools/blender/turk_bayragi.py` (Blender 4.2'de, bpy modülüyle çalıştırılıp doğrulandı) →
  `models/turk-bayragi.blend` ve `models/turk-bayragi.glb` (FlagPole + TurkishFlag, "FlagWave", 24 morph target,
  120 kare @ 24 fps = 5 sn, 2450 köşe, doku 2048×1336 PNG gömülü). Resmî ölçüler (2994 sayılı Kanun) betikte yazılı.
  Ön/arka yüz ayrı katman; direk kenarı tüm hedeflerde sabit (maks 1e-13 m); ilk/son kare aynı (sıçrama 6e-5 m).
- Doğrulama: `node tools/blender/verify-flag.mjs models/turk-bayragi.glb` (Node) ve `tools/blender/flag-check.html`
  (Three.js GLTFLoader + AnimationMixer; depo kökünde `python3 -m http.server`). İkisi de GEÇTİ.
- Oyunda: bayrak direği meydanda (yerel -92.3, 73.6; **konum temsili**, `anitkabir.json` → `flag.pole`). Eğitmen
  masasındaki rüzgâr hızı animasyon hızını, rüzgâr yönü bayrağın yönünü belirler (kumaş rüzgârın gittiği yöne uzanır).
- Blender'ı yeniden çalıştırma: `blender -b -P tools/blender/turk_bayragi.py -- --out models --wind-speed 8`
  (ayarlar: --width, --pole-height, --wind-dir, --frames, --keys, --nx, --ny, --texture, --anitkabir).

## Sıradaki adımlar

1. ~~OSM ile konum düzeltme~~ (yapıldı). Veri yenilenirse:
   `node tools/ankara/prepare-data.mjs --dem <GLO-30 .tif> --osm <ankara-merkez.osm.json>`
2. ~~Tarihi yapı menüsü~~ (yapıldı; `mission.js` HERITAGE ↔ `landmarks.json` kimlikleri).
3. Gece arama noktalarının (`night-training.js`) Ankara'da park/açık alana düştüğünü doğrula.
4. ~~Anıtkabir modeli ve bayrak~~ (yapıldı). Açık: gerçek bayrak direği konumu; Aslanlı Yol aslanları ve kuleler
   için ayrıntı; modelin doku kalitesi yakın uçuşta düşük (Meshy sınırı).
5. Kılavuz (`guide-content.json`) ve hızlı başlangıç metnindeki kalan İstanbul/deniz ifadelerini tek tek gözden geçir.
6. ArcGIS anahtarı gelince: anahtarın izinli adresine `altieylul-bvlos-ankara.vercel.app` yazılmalı. Vercel'de
   build sırasında `imagery.local.json` yok; anahtarı build'e bir ortam değişkeniyle vermek için `tools/build.mjs`
   küçük bir ekleme ister (ör. `ARCGIS_API_KEY`).

## Çalıştırma

```sh
npm ci
npm test
npm run build
npm start   # http://127.0.0.1:5188/
```

Veri dosyaları yoksa uygulama düz zeminle açılır ve künyede bunu belirtir.
