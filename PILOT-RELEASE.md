# İlk öğrenci paketi · 17 Ekim 2026

Kapsam: 1, 9, 10, 12, 14 ve 17.

- Rota başlatmadan Serbest uçuş: yaklaşık 3 m otomatik kalkış, ardından W/S, A/D, Q/E, R/F. Eve dön ile iniş.
- Eğitmen masasındaki kapalı Uçuş ve kamera ayarları: Hassas 3, Normal 8, Hızlı 12 m/s. Yatay kontrol yumuşak hızlanır ve yavaşlar. Rüzgâr yer hızını etkileyebilir. Zaman hızı serbest uçuşta 1×.
- Normal ve termal drone kamerası için 1×, 2×, 4× yakınlaştırma. Harita ve tarihi yapı inceleme kamerası bağımsızdır.
- Rotayı düzenle ve Gece ve arama eğitimi daha belirgin. Sağ üst haritanın yerleşimi korunur.
- Kuşlar sentetik termal görüntüde sıcak iz taşır. Gerçek sıcaklık ölçümü değildir.
- Serbest uçuş raporunda rota ve görev yüksekliği çıkarılır; sınır, enerji ve iniş ölçütleri 60 puandan 100'e ölçeklenir. Güvensiz bitişte 39 puan tavanı korunur.

Doğrulama: 52 standart / 55 XR otomatik testi ve üretim derlemeleri. Tarayıcıda klavyeyle serbest uçuş, yükselme, hız seçimi, duraklatma, güvenli dönüş ve 100 puanlık rapor; sıfırlama sonrası 6 noktalı görev; yakınlaştırmada kamera görüntüsünün değişmesi ve harita ekran görüntüsünün aynı kalması; 390 px taşmasız görünüm; beyaz sıcak termal ve VR masa önizlemesi kontrol edildi. Uygulama hatası görülmedi.

Manuel uçuş klavye gerektirir. Quest çubuklarıyla uçuş bu paketin kapsamı değildir. Fiziksel Quest 3 testi yapılmadı. Mevcut ArcGIS yapılandırması korunur; yeni ücretli hizmet veya bağımlılık yoktur.

Önceki sürüme dönüş: standart c023275 (0.7.0), XR 7aac6f4 (0.4.0). Netlify'deki önceki yayınlar korunur. Kaynak ZIP, yayımlanan committen üretilir; yerel harita erişim yapılandırması arşive alınmaz.