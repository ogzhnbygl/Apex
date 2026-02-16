# Apex - Vizyon ve Blueprint

## 🌟 Vizyon

Apex, organizasyonun dijital omurgasıdır. Sadece bir kullanıcı yönetim sistemi değil, büyüyen bir ekosistemin **Merkezi Sinir Sistemi** olarak tasarlanmıştır.

Temel amacı, laboratuvar ve araştırma süreçlerindeki farklı ihtiyaçları karşılayan **mikro-uygulamaları** (Dispo, Circa, Silo, LabProject) tek bir çatı altında toplamaktır. Kullanıcılar, tek bir hesapla giriş yaparak yetkili oldukları tüm araçlara sorunsuz bir şekilde erişebilmelidir.

> "Apex, karmaşayı düzene sokan merkezdir."

## 🏗️ Mimari

Apex, **Modüler Monolit** benzeri, ancak fiziksel olarak ayrık bir mikro-uygulama (micro-app) mimarisini benimser.

### Modüler Yapı
Sistem, yeni modüllerin "Tak-Çıkar" mantığıyla eklenebileceği şekilde kurgulanmıştır.

1.  **Core (Apex):** Kimlik yönetimi, Dashboard, Admin Paneli.
2.  **Bağımlı Modüller:**
    - **Dispo:** Laboratuvar hayvanları raporlama.
    - **Circa:** Mesai ve vardiya takibi.
    - **Silo:** Stok ve envanter yönetimi.
    - **LabProject:** Proje ve etik kurul yönetimi.

## 🎨 Tasarım Prensipleri

- **Tutarlılık:** Tüm modüller, Apex'in belirlediği tasarım dilini (Design System) kullanmalıdır.
- **Bağımsızlık:** Bir modüldeki hata, diğerlerini veya Apex'i etkilememelidir (İzole çalışma).
- **Kullanıcı Odaklılık:** Karmaşık süreçleri basitleştiren, temiz ve modern arayüzler.
- **Güvenlik:** Her zaman, her yerde "önce güvenlik" yaklaşımı.

## 🗺️ Yol Haritası (Roadmap)

### Faz 1: Temel Altyapı (Tamamlandı ✅)
- [x] Merkezi kimlik doğrulama (SSO).
- [x] Dashboard ve uygulama yönlendirmesi.
- [x] Temel kullanıcı yönetimi (Admin Paneli).

### Faz 2: Entegrasyon ve Genişleme (Devam Ediyor 🚧)
- [ ] **API Gateway:** İleride tüm modüllerin API'lerinin tek bir gateway üzerinden yönetilmesi.
- [ ] **Cross-App Veri Paylaşımı:** Modüller arasında veri akışını sağlayacak olay tabanlı (Event-driven) iletişim.
- [ ] **Audit Genişlemesi:** Sistemdeki tüm hareketlerin (kim, ne zaman, hangi modüle girdi) merkezi olarak loglanması.

### Faz 3: Kurumsal Özellikler
- [ ] **SSO Entegrasyonu:** LDAP / Google Auth gibi kurumsal kimlik sağlayıcıları ile entegrasyon.
- [ ] **Gelişmiş Analitik:** Tüm modüllerden toplanan verilerle organizasyonel içgörüler sunan raporlar.
