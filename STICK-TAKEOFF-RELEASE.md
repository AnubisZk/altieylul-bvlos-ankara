# Sol çubukla kalkış · normal sürüm 0.9.1 · 29 Ekim 2026

Motorları A ile açıp çubukları bıraktıktan sonra sol çubuğu yukarı itmek, mevcut konumdan manuel kalkış başlatır. Y ve ekrandaki Serbest uçuş düğmesi 3 m otomatik kalkışı korur. Sol çubukla başlayan uçuşta dikey hız analog miktarıyla değişir; merkezde mevcut dünya yüksekliği korunur. Kalkış sırasında 2 m veya 3 m otomatik yükselme yoktur. Mevcut 120 m sınırı ve dikey hız sınırları korunur.

Motor açıldıktan sonra kumanda yeniden merkezlenmelidir. Motorlar kapalıyken, menü/ayar ekranında, duraklatılmışken veya yeniden bağlantı kilidi açıkken çubuk kalkış yaptıramaz. Yerel inişten sonra çubukla yeniden kalkış konumu ve kalan bataryayı korur. Klavye kontrolü, görev rotası, B inişi, bağlantı kaybı davranışı, Y otomatik kalkış ve XR sürümü korunur. Yeni arayüz öğesi veya CSS değişikliği yoktur; yalnız mevcut yardım metinleri güncellenir.

Mimari: gamepad frame → mevcut ortak serbest uçuş hazırlığı → DroneSim.startStickFlight → dikey hareket → telemetri. Yeni sunucu API'si, servis veya harita ayarı yoktur.

Doğrulama (verification becerisi):
- 66 otomatik test başarılı; bunların beşi çubukla kalkış, merkezde bekleme, farklı zaman adımları, iniş/yeniden kalkış ve nötr konum kilidi için eklendi.
- Üretim derlemesi başarılı.
- Chrome/Edge, sentetik Gamepad API: motor kapalıyken yükselme yok; A + sol çubuk kalkış; merkezde 1.445 / 1.395 m sabit irtifa; tekrar yükselme/alçalma; B ile platforma iniş; Y ile yaklaşık 3 m otomatik kalkış. Uygulama hatası yok.
- Haritanın ekran sınırları test boyunca aynı kaldı. XR kaynakları c6dd2fc (0.5.0) sürümünde bırakıldı.
- Bu değişiklik fiziksel GamePower ile denenmedi; tarayıcı testleri sentetik kumanda girdisiyle yapıldı.

Önceki normal sürüm: f2d7b24 / 0.9.0; Netlify yayını 6ad7428f8a4caff6f0dbcb09. Geri dönüş için bu yayın kullanılabilir.
