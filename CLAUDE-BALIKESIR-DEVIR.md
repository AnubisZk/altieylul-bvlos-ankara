# Claude için devir notu — Balıkesir / Altıeylül BİLSEM

Tarih: 3 Kasım 2026 · Kaynak: `AnubisZk/altieylul-bvlos-ankara` (main, Ankara sürümü `ank-0.2.0` + gerçek şehir)

## Hedef

Ankara sürümünün bir kopyasıyla **Balıkesir** sürümü yapılacak: drone **Altıeylül BİLSEM** bahçesinden kalkar,
Balıkesir şehir merkezini dolaşır. Şehir görünümü Ankara'daki gibi **Google Photorealistic 3D Tiles** (gerçek zemin)
+ **OSM kutu binalar** (karma görünüm). Anıtkabir'e özel her şey bu sürüme alınmaz.

## Değişmeyecek kurallar (Zafer Hoca)

- Ayrı depo ve ayrı Vercel projesi: önerilen ad `altieylul-bvlos-balikesir`. **Ankara ve İstanbul sitelerine ve
  depolarına yazma.** Quest sürümü ayrı kalır.
- Arayüz, sağ üst harita, drone modeli, gamepad/klavye kontrolleri, uçuş, kamera, rapor, gece/termal, hava, müzik/kılavuz
  korunur.
- Anahtarlar kaynakta durmaz. Google anahtarı yalnız Vercel ortam değişkeni `GOOGLE_MAPS_TILES_KEY`'dir (isteğe bağlı
  `ARCGIS_API_KEY`). Hesap parolası veya yönetim anahtarı koda konmaz. LICENSE, NOTICE, ASSETS-LICENSE ve atıflar korunur.
- Yayın Vercel'e (GitHub `main` → otomatik derleme). GitHub Pages istenmiyor.
- İlerleme notu tutulur (`BALIKESIR-ILERLEME.md`), Codex de aynı depoda çalışabilir: push öncesi `git pull --rebase`.
- Zafer Hoca dosya düzenine önem verir: dosyaları yerinde düzenle, gereksiz kopya/klasör açma.

## Ankara'dan hazır gelenler (kullan)

| Parça | Dosya | Not |
|---|---|---|
| Dünya katmanı | `drone/ankara-world.js` | Bölgeden bağımsız; `ANK_DATA='data/ank/'` → `data/bal/` yap (ve `tools/build.mjs`, `cdn.js`, testler). |
| Gerçek şehir | `drone/google-city.js`, `drone/keep-zone.js` | ECEF→UTM yerel çerçeve, dikey kalibrasyon, uyarlamalı ayrıntı. Bölgeden bağımsız. |
| Kutu binalar | `drone/city-buildings.js` | Duvarlar zemine 4 m gömülü (karma görünüm). |
| Şehir düğmesi | `drone/main.js` (`setCityMode`) | Karma / Gerçek / Kutu, tercih `localStorage`. |
| Veri hazırlama | `tools/ankara/prepare-data.mjs` | GLO-30 .tif + Overpass .json → terrain/buildings/ground/landmarks. Yeni klasöre taşınıp (`tools/balikesir/`) bölge dosyasından okunmalı. |
| Sokak etiketleri | `tools/ankara/prepare-streets.mjs`, `data/ank/opening-streets.json` | Balıkesir için yeniden üretilir. |
| Derleme | `tools/build.mjs`, `tools/build/imagery-config.mjs` | `tiles3d.json`, Draco çözücü kopyası, anahtar doğrulaması hazır. |

## Kaldırılacak / değiştirilecek Ankara'ya özgü parçalar

- `drone/anitkabir.js`, `drone/aslanli-yol.js`, `models/anit*`, `models/heykel-*`, `models/inonu-lahdi.glb`,
  `models/aslanli-yol/`, `models/turk-bayragi.glb` (bayrak istenirse kalabilir), `data/ank/anitkabir.json`,
  `data/ank/aslanli-yol.json`, `tools/blender/anit_blok.py`, `rolyef.py`, `inonu_yazit.py`, `aslanli_yol.py`,
  `tools/ankara/prepare-anitkabir.mjs`, `prepare-aslanli-yol.mjs`, `prepare-heykel.mjs`.
  `ankara-world.js` bu katmanlar yoksa çalışır (veri dosyası yoksa atlanır); importları temizle.
- `keep-zone.js → keepZones`: Balıkesir'de yalnız kalkış pisti (`home`) kalır; ileride özel model eklenirse (ör. Saat
  Kulesi) onun dikdörtgeni eklenir.
- `drone/mission.js`: `ANCHOR_FROM_HOME`, `RING` ve `HERITAGE` Balıkesir'e göre (merkez noktası ve rota yeniden).
- `data/bal/region.json`: **UTM 35N (`EPSG:32635`)** — Balıkesir ~27.9° D, 35. dilimdedir (Ankara 36N idi). `origin`
  (şehir merkezi, ör. Saat Kulesi), `home` (BİLSEM bahçesi), `bboxLonLat`, `local` ±3 km.
- `drone/music-zone.js`, `data/ank/music-zone.json`, `drone/music-tracks.json`: Anıtkabir bölgesi müziği kalkar;
  Balıkesir müziği Zafer Hoca'dan.
- `drone/guide-content.json`, `index.html` metinleri, sayfa başlığı, künye: Balıkesir.
- `tests/ankara.test.mjs` → `tests/balikesir.test.mjs` (Anıtkabir testleri çıkar; bölge/rota/çerçeve testleri kalır).
  `tests/google-city.test.mjs` bölge dosyasını okur, kontrol noktalarını Balıkesir'e çevir.

## Zafer Hoca'dan gelecek veriler

1. **BİLSEM kalkış noktası**: Google Haritalar'da bahçeye uzun basıp alınan koordinat.
2. **Arazi**: Copernicus GLO-30 karosu `Copernicus_DSM_COG_10_N39_00_E027_00_DEM.tif`.
3. **OSM**: Overpass Turbo (overpass-turbo.eu) çıktısı, JSON. Kutu kenarları bölge dosyasıyla uyumlu olmalı. Örnek sorgu
   (merkez ±3 km civarı, köşeler kesinleşince güncellenir):
   ```
   [out:json][timeout:180];
   (
     way["building"](39.620,27.850,39.680,27.930);
     relation["building"](39.620,27.850,39.680,27.930);
     way["building:part"](39.620,27.850,39.680,27.930);
     way["highway"](39.620,27.850,39.680,27.930);
     way["leisure"](39.620,27.850,39.680,27.930);
     way["landuse"](39.620,27.850,39.680,27.930);
     way["natural"](39.620,27.850,39.680,27.930);
     node["historic"](39.620,27.850,39.680,27.930);
     node["tourism"](39.620,27.850,39.680,27.930);
     node["amenity"="school"](39.620,27.850,39.680,27.930);
   );
   out body geom;
   ```
4. **Rota durakları** (öneri: Saat Kulesi, Zağanos Paşa Camii, Kuva-yi Milliye Müzesi, Atatürk Parkı; Balıkesir
   Üniversitesi Çağış kampüsü merkezden ~10 km uzakta, ±3 km alanın dışında kalır) — Zafer Hoca seçer.
5. **Google anahtarı**: yeni anahtar gerekmez. Google Cloud → `bvlos-ankara` projesi → Kimlik bilgileri → anahtar →
   Web sitesi kısıtlamalarına `https://altieylul-bvlos-balikesir.vercel.app/*` eklenir. Yeni Vercel projesine
   `GOOGLE_MAPS_TILES_KEY` (Production) girilir. Ücretsiz kota (ayda 1.000 oturum) iki site arasında paylaşılır.
6. Müzik ve sesli kılavuz metinleri (sonra da gelebilir).

## Önce doğrulanacaklar

- **Google 3D kapsamı**: Balıkesir'de Google'ın gerçek 3D binası var mı belli değil. Ankara'da attribution yalnız
  "Google; Airbus" çıktı ve görüntü düz uydu fotoğrafı gibiydi; bu yüzden **karma görünüm** varsayılan yapıldı. Zafer
  Hoca Google Earth uygulamasında Balıkesir'i eğik açıyla kontrol edecek.
- Container ağı Google, Overpass, Copernicus ve vercel.app adreslerine **erişemez**. Google görüntüsü yalnız Zafer
  Hoca'nın tarayıcısında görülür; veriler dosya olarak gelir. Vercel MCP ile derleme kaydı ve ortam değişkeni varlığı
  kontrol edilebilir.

## Ankara'da öğrenilenler (aynı hatalara düşme)

- `3d-tiles-renderer@0.4.28`; `index.html` import map'inde `3d-tiles-renderer`, `3d-tiles-renderer/plugins` ve isteğe
  bağlı bağımlılıklar (`@mapbox/vector-tile`, `pbf`, `pmtiles` → `drone/optional-missing.js`) olmalı, yoksa esbuild
  derlemesi kırılır.
- `google-city.js` dinamik import edilir (anahtar yoksa ~100 KB hiç yüklenmez). Anahtar yoksa site eskisi gibi çalışır.
- Teğet düzlem: 4.5 km'de ~1.6 m dünya eğriliği farkı normaldir (test bunu hesaba katar).
- Dikey kalibrasyon şu an `realCityAnchor` (Anıtkabir meydanı) ile yapılıyor. Balıkesir'de bunu bilinen düz bir noktaya
  (ör. Saat Kulesi meydanı veya BİLSEM bahçesi) bağla; noktanın zemin yüksekliği DEM'den alınır.
- Çarpışma OSM kutularıyla yapılır; Google ağıyla çarpışma yok. Zemin fiziği DEM'den (Google zemininden birkaç metre
  farklı olabilir).
- Gece/termal görünüm Google ağına otomatik uygulanır (`night-visuals.js` sahnedeki tüm malzemeleri yamalar).
- QA: headless Chromium/Playwright ile `dist/` sunulup ekran görüntüsü alınır; Google katmanı burada görünmez.

## Çalıştırma

Node.js 22+: `npm ci`, `npm test`, `npm run build`, `npm start` (http://127.0.0.1:5188/). Derleme `dist/` üretir;
Vercel `npm run build` → `dist` (vercel.json hazır).
