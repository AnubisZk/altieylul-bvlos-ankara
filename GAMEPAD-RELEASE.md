# Normal simülatör · Oyun kolu desteği · 0.9.0

20 Ekim 2026. Yalnız normal BVLOS uygulaması güncellenir; XR kaynakları ve yayını değişmez.

## Kullanım

1. Kumandayı bilgisayara bağla. Simülatör sayfasına tıkla ve kolda bir düğmeye bas.
2. Eğitmen Masası → Uçuş ve kamera ayarları → Oyun Kolu sekmesini aç. Bağlı cihazı, canlı analogları ve düğme numaralarını kontrol et.
3. Varsayılan Mode 2: sol analog dikey yükselme/alçalma; yatay yön. Sağ analog dikey ileri/geri; yatay sağ/sol hareket.
4. A motorları yerde açar/kapatır; Y yaklaşık 3 m otomatik kalkış yapar. Havada motor kapatma reddedilir. B uygun zemine yerel iniş, X kamera değiştirme, LT/RT kamera eğimi. Start duraklat/sürdür, sol çubuğa basma manuel kontrolü alma, RB eve dönüş.
5. Oyun Kolu sekmesini kapat veya Uçuş/kamera sekmesine dön. Çubukları ortala ve düğmeleri bırak; ardından uçuş komutlarını kullan.

Standart dışı eşleme algılanırsa eksen/düğme numaralarını canlı göstergelerle kontrol edip “Bu kol için eşlemeyi onayla” seçilir. Her eksen ve düğme yeniden atanabilir; kullanılmayan düğmeler devre dışı bırakılabilir. Çakışan veya cihazda bulunmayan atamalar kontrolü kilitler.

Başlangıç deadzone 0.10; her eksen için 0.20–2.00 hassasiyet ve ters yön seçimi var. Merkez kalibrasyonu bir saniye ölçer, büyük sapma/hareket varsa ölçümü reddeder. Ayarlar localStorage'da tutulur; depolama engelliyse oturumda kullanılabilir. Canlı sayılar ham eksenleri gösterir.

## Mimari ve davranış

- `drone/gamepad-input.js`: bağımsız, test edilebilir ayar doğrulama, analog dönüştürme, düğme kenarları, cihaz seçimi ve nötr konuma dönme kilidi.
- `drone/gamepad-panel.js`: mevcut ayar bölümü içinde iki erişilebilir sekme, cihaz durumu, canlı çubuklar, eşleme, merkez kalibrasyonu ve yerel kayıt.
- `drone/gamepad-flight.js`: kumanda kesilmesi ve mevcut arazi/engel verisi üzerinden iniş uygunluğu.
- `drone/main.js`: mevcut requestAnimationFrame döngüsünde navigator.getGamepads() okunur; gamepadconnected/gamepaddisconnected olayları da dinlenir. Klavye aynı eksende önceliklidir. Analoglar görev otopilotunu kendiliğinden devralmaz.
- `drone/sim.js`: motor hazırlama durumu ve yerel iniş hedefi eklenir. Mevcut hız, dönüş, rüzgâr, batarya, rota ve eve dönüş denklemleri korunur. Roll girdisi dış görünümde yatış olarak da gösterilir.
- `drone/night-training.js`: mevcut gimbal eğimi tetiklerle ayarlanabilir; kamera/harita yerleşimi korunur.
- `drone/assessment.js`, `drone/result.js`: yerel iniş eve dönüş diye raporlanmaz; pilot kararı olarak kaydedilir.

Kol kesilirse manuel uçuş/kalkış konum korur; rota, eve dönüş veya iniş otopilotu sürer. Yeniden bağlantı, menüden çıkış ve sıfırlama sonrası çubuklar ortalanıp düğmeler bırakılmadan kol komutu kabul edilmez. Uçak bağlantı kaybı senaryosunun mevcut beş saniyelik eve dönüşü korunur. Oyun Kolu ayarları açıkken kol yalnız test girdisi verir.

B inişi deniz, eğimli veya engelli zemin üzerinde reddedilir. Kalkış platformunun merkezinde iniş kabul edilir. Kontrol mevcut model verileriyle sınırlıdır; gerçek dünyadaki bütün engellerin bilgisi yoktur.

## Doğrulama

- 61 Node testi: önceki 52 test ve 9 yeni oyun kolu testi başarılı.
- Üretim derlemesi başarılı.
- Chrome ve Edge'de sentetik Gamepad API girdileriyle: kolsuz klavye uçuşu, Mode 2, kademeli hareket, tek basış davranışı, havada motor kapatma engeli, kamera/tetikler, klavye önceliği, denizde iniş reddi, bağlantı kesilmesi, deflekte çubukla yeniden bağlanma kilidi, manuel kontrolü geri alma, duraklatma, eve dönüş ve kalkış platformuna yerel iniş kontrol edildi.
- Her iki tarayıcıda tuş yeniden atama, hassasiyet/ters yön/deadzone, merkez kalibrasyonu, yerel kayıt ve yeniden yükleme kontrol edildi. 390 px görünümde yatay taşma yok. Uygulama hatası görülmedi.
- Fiziksel GamePower kolu ve Firefox bu ortamda test edilmedi. Tarayıcılar arasında test için aynı canlı gösterge ve kalibrasyon ekranı kullanılabilir; gerçek cihazdaki bağlantı modu/eşleme ayrıca doğrulanmalıdır.

Yeni bağımlılık, ücretli hizmet veya harita isteği türü eklenmedi. Önceki normal sürüm: commit `f3c29fe`, Netlify yayını `6ad3c7bb0181010f70676b0b` (0.8.0). Gerekirse Netlify'den bu yayına dönülebilir. XR tabanı `c6dd2fc` (0.5.0) korunur.
