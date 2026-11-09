# Ankara zemin görünürlüğü — 9 Kasım 2026

Canlı Ankara sitesinde Google 3D Tiles kök isteği HTTP 404 / NOT_FOUND dönerken ArcGIS fotoğrafları 200 dönüyordu. Seçili Karma/Gerçek mod, Google verisi hazır olmadan yerel araziyi gizliyordu. Hata mesajı kutu binalara dönüldüğünü söylüyor fakat görünürlük gerçekte geri alınmıyordu.

Düzeltme: Google geometrisi yüklenip kalibre olana kadar DEM/ArcGIS zemini korunur. Servis hatasında görünüm Kutu'ya döner; kullanıcının kaydedilmiş tercihi değiştirilmez. Kullanıcı tekrar Karma/Gerçek seçerse hata öncesi reddedilmiş kimlik doğrulama isteğinin bellekte kalmasını önlemek için Google auth eklentisi yeniden kurulur. Hesap, anahtar, kota veya faturalandırma ayarı değiştirilmedi.

Doğrulama: 83 otomatik test ve üretim derlemesi başarılı. İzole Chrome testinde canlı adresin uygulama dosyaları yerel düzeltmeyle değiştirilerek gecikmiş Google 404 hatası oluşturuldu. Yükleme boyunca ve hata sonrasında zemin görünür kaldı; ArcGIS 64 karo yükledi. Kayıtlı tercih korundu; kullanıcı isteğiyle yeniden deneme yapıldı. Tarayıcı uygulama hatası yok. Anıt Blok görünümünde zemin ekran görüntüsü alındı.

Bu kayıt hazırlanırken düzeltme yerel çalışma dalındadır; henüz yayınlanmadı. Google servisinin 404 yanıtının hesap tarafındaki nedeni kesinleştirilmedi. Kalıcı zemin koruması bu servisten bağımsız çalışır.
