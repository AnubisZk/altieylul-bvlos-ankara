# Ankara / Anıtkabir — ilerleme ve devir notu

## 1 Kasım 2026 · Aslanlı Yol ve bayrak yayın kontrolü

- Güncel kalkış açıklaması iki satırdır. “Tandoğan tarafında kalkış noktası.” ve “Anıtkabir çevresi gözlem rotası simülasyonudur.”
- Aslanlı Yol, Anıtkabir ve bayrak entegrasyonu önceki model teslimlerinden alınmıştır. Gönderilen `turk-bayragi-paketi.zip` içindeki GLB ve Blender dosyaları repodakilerle SHA-256 bakımından aynıdır.
- Yerel uygulamada **Tarihi yapı incele → Aslanlı Yol** ile yol, aslanlar, ağaçlar, ziyaretçiler ve meydandaki bayrak görüntülendi. Model yükleme hatası görülmedi. 80 test geçti.
- `node tools/blender/verify-flag.mjs models/turk-bayragi.glb` komutunun Windows'ta da doğrulamayı çalıştırması düzeltildi. Bayrağın 24 morph hedefi, sabit direk kenarı ve beş saniyelik kesintisiz döngüsü doğrulandı.
- ArcGIS `ARCGIS_API_KEY` Vercel Production ortamında tanımlıdır. Hava görüntüsü Ankara canlı adresinde çalışır. Bayrak direğinin konumu ve giriş kuleleri mevcut modelde temsili olarak korunmuştur.
- Aşağıdaki eski kayıtlar geliştirme geçmişidir. Aslanlı Yol ve Anıtkabir modelleri artık paket içindedir.

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

## Aslanlı Yol (1 Kasım)

- Kaynak: `tools/blender/aslanli_yol.py` (Blender 4.2 bpy ile çalıştırıldı) + `tools/ankara/prepare-aslanli-yol.mjs`
  (OSM ekseni ve GLO-30 → `data/ank/aslanli-yol.json`). Aslan heykeli: Zafer Hoca'nın Meshy modeli
  (`Meshy_AI_Stone_Guardian_of_Daw_…glb`, 500 bin üçgen, 8K; repoda yok, betik `--lion` ile okur).
- Çıktılar `models/aslanli-yol/`: `aslanli_yol_master.blend` (19 MB; 8K kaynak aslan çıkarılmış),
  `aslanli_yol_high.glb` (2.2 MB, ~190 bin üçgen), `aslanli_yol_low.glb` (0.4 MB, ~33 bin), `aslanli_yol_colliders.glb`
  (185 kutu), `rapor.json`, `kontrol/*.jpg` (üstten, yandan, drone yüksekliği, aslan yakın).
- Ölçü: 262.20 m × 12.80 m (OSM ekseni 258.3 m; başlangıç OSM merdiven üstü, bitiş Tören Meydanı zemini 902.7 m).
  Yerel +X yol yönü (kerteriz 142.3°), kök düğüm yol başında; GLB doğrudan simülatör yerel metre koordinatında.
- 24 aslan: 7'şer çim şerit (OSM) arasındaki 6 boşlukta her yanda ikişer; bağlı kopya + EXT_mesh_gpu_instancing.
  Aslan 2.6 × 1.34 × 1.31 m (yaklaşık), 0.45 m kaide; yüzleri Tören Meydanı'na dönük, iki yan simetrik.
  Yakın 6000, orta 900 üçgen; doku 2048 / 512.
- Traverten zemin: numpy ile üretilmiş 4.8 m döşenen doku (levha derzleri, gözenek, damar) + normal haritası, pürüz 0.74.
- 151 ardıç (4 biçim, düzensiz kümeli sütun formu, köşe renkli), çiçek tarhları, yan çimler, 46 ziyaretçi (6 tip, 1.55–1.85 m).
- Başlangıç: 6 basamak (~1 m), 50 m genişlik; Hürriyet ve İstiklal kuleleri temsili kütle; heykel grupları için yalnız
  kaide var (kadın/erkek heykel grubu modelleri yok, ayrı model gerekir).
- Oyunda (`drone/aslanli-yol.js`): THREE.LOD yakın < 320 m < orta < 1100 m < uzak (orta sürüm, aslansız). Zemin yol
  yüzeyine oturur; çarpışma kutu tabanlı, anıt gibi "durdur ve uyar" (koruma payı 2.5 m). Yol ayak izindeki OSM binaları
  gösterilmiyor. Anıt Blok, meydan ve bayrak dosyalarına dokunulmadı.
- Yeniden üretim: `node tools/ankara/prepare-aslanli-yol.mjs --osm <osm.json>` sonra
  `blender -b -P tools/blender/aslanli_yol.py -- --lion <aslan.glb> --out models/aslanli-yol`.

## Anıt Blok yeniden yapımı, cilalı meydan ve şehir cepheleri (1 Kasım akşam)

- Zafer Hoca'nın referans fotoğrafına göre Meshy'nin Anıt Blok'u (yuvarlak/eğri sütunlar) modelden kesildi
  (`prepare-anitkabir.mjs` CUT kutusu, ~18.7 bin üçgen) ve `tools/blender/anit_blok.py` ile yeniden kuruldu:
  peristil 41.65 × 57.35 m, 8 × 14 kare pilon (1.4 × 1.3 × 16 m; ODTÜ yapısal makale), meydana bakan kısa cephe,
  6.4 m kaide + 36 basamak (yaklaşık), saçak kuşağı, korniş, kurşun çatı, koyu revak/cam yüzeyler. Çıktı:
  `models/anit-blok.glb` (0.3 MB, ~1.7 bin üçgen + traverten dokular), `anit-blok-colliders.glb`, `anit-blok.blend`.
- Tören Meydanı: 129 × 84 m bilgisiyle cilalı traverten levha zemin (pürüz 0.32), Meshy zemininin 0.98 m üstünde.
  Kökü floorY + 0.92 m (`anitBlok.lift`); oyun zemini `anitkabir.json → anitBlok` (kaide, merdiven, meydan) ile.
- Meshy'nin kendi bayrak direği kesildi. Bayrak direği fotoğraftaki gibi meydanın Anıt Blok ucunda, yan revak önüne
  taşındı (a = −58, p = +40; OSM'de "flagpole" bilgi panosu aynı yanda). Konum yine yaklaşık.
- Şehir binaları (`drone/city-buildings.js`): canvas ile üretilen cephe dokuları (pencere aksı 3.2 m, kat 3.0 m),
  bina başına Ankara sıva renkleri, balkonlu / ofis cephe tipleri, düz beton ve kiremit çatılar; 5 çizim çağrısı.

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
