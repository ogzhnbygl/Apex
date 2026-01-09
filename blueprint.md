# Apex - Blueprint & Yol Haritası

Apex, sadece bir kullanıcı yönetim sistemi değil, büyüyen bir ekosistemin omurgası olarak tasarlanmıştır. Bu doküman, projenin vizyonunu ve gelecekteki genişleme planlarını içerir.

## 🌟 Vizyon

Apex'in temel amacı, laboratuvar ve araştırma süreçlerindeki farklı ihtiyaçları karşılayan **mikro-uygulamaları** tek bir çatı altında toplamaktır. Kullanıcılar, tek bir hesapla giriş yaparak yetkili oldukları tüm araçlara (Dispo, Stok Takip, Raporlama vb.) erişebilmelidir.

## 🧩 Modüler Mimari

Sistem, yeni modüllerin "Tak-Çıkar" mantığıyla eklenebileceği şekilde kurgulanmıştır.

### Mevcut Modüller
1.  **Core (Apex):** Kimlik yönetimi, Dashboard, Admin Paneli.
2.  **Dispo:** Laboratuvar hayvanları raporlama ve takip sistemi.

### Planlanan Modüller (Örnekler)
- **Inventory:** Kimyasal ve sarf malzeme stok takibi.
- **Scheduler:** Laboratuvar ekipmanları için rezervasyon sistemi.
- **EthicApp:** Etik kurul başvuru ve onay süreçleri.

## 📈 Genişleme Stratejisi

1.  **API Gateway:** İleride tüm modüllerin API'lerinin tek bir gateway üzerinden yönetilmesi.
2.  **SSO Entegrasyonu:** Kurumsal LDAP veya Google Auth entegrasyonları.
3.  **Cross-App Veri Paylaşımı:** Modüller arasında veri akışını sağlayacak olay tabanlı (Event-driven) iletişim.
4.  **Audit Logs:** Sistemdeki tüm hareketlerin (kim, ne zaman, hangi modüle girdi) merkezi olarak loglanması.

## 🎨 Tasarım Prensipleri

- **Tutarlılık:** Tüm modüller, Apex'in belirlediği tasarım dilini (Design System) kullanmalıdır.
- **Bağımsızlık:** Bir modüldeki hata, diğerlerini veya Apex'i etkilememelidir (İzole çalışma).
- **Kullanıcı Odaklılık:** Karmaşık süreçleri basitleştiren, temiz arayüzler.

---
> "Apex, karmaşayı düzene sokan merkezdir."
