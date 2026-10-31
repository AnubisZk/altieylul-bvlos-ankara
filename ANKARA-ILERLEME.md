# Ankara / Anıtkabir — ilerleme ve devir notu

Son güncelleme: 31 Ekim 2026, 20:20 · sürüm `ank-0.1.0` + gerçek arazi (İstanbul normal v0.9.2 tabanlı)

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

## Vercel yayını — durum

- Vercel bağlantısı (MCP) çalışıyor; hesapta takım `team_cQj2sAnuqQqKoymTzVlCgwG8`. Ankara projesi **henüz oluşturulmadı**.
- Engel: Claude'un çalışma ortamı api.vercel.com'a doğrudan erişemiyor; MCP ile dosya yükleme yalnız küçük metin
  dosyaları için pratik. Site ~20 MB (müzik 10 MB, model 1.9 MB) olduğundan iki yol var:
  1. GitHub bağlandı (AnubisZk) ama oturum yeni repo açamıyor. Zafer Hoca GitHub'da boş özel repo
     `AnubisZk/altieylul-bvlos-ankara` açınca: `add_repo` (push) → `git push` → Vercel projesi Git'e bağlanır.
     Yerel git deposu hazır (dal `main`).
  2. Zafer Hoca kendi bilgisayarında: `dist` klasöründe `npx vercel@latest deploy --prod` (proje adı önerisi:
     `altieylul-bvlos-ankara`).

## Sıradaki adımlar

1. ~~OSM ile konum düzeltme~~ (yapıldı). Veri yenilenirse:
   `node tools/ankara/prepare-data.mjs --dem <GLO-30 .tif> --osm <ankara-merkez.osm.json>`
2. ~~Tarihi yapı menüsü~~ (yapıldı; `mission.js` HERITAGE ↔ `landmarks.json` kimlikleri).
3. Gece arama noktalarının (`night-training.js`) Ankara'da park/açık alana düştüğünü doğrula.
4. Anıtkabir temsili modeli (Blender betiği → GLB → `addLayer` ile çarpışma ve iniş uygunluğu). Anıt Blok merdiven
   ve teras zemini; çarpışmada hasar efekti yok, durup uyarı.
5. Kılavuz (`guide-content.json`) ve hızlı başlangıç metnindeki kalan İstanbul/deniz ifadelerini tek tek gözden geçir.
6. ArcGIS anahtarı gelince `imagery.local.json` ile dene; yeni Netlify sitesi oluştur (İstanbul site kimliklerini
   kullanma).

## Çalıştırma

```sh
npm ci
npm test
npm run build
npm start   # http://127.0.0.1:5188/
```

Veri dosyaları yoksa uygulama düz zeminle açılır ve künyede bunu belirtir.
