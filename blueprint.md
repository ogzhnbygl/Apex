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

### Faz 1: Güvenlik ve Veri Bütünlüğü (Tamamlandı ✅)
- [x] Bcrypt şifre hashleme ve veritabanı şifre migrasyonu.
- [x] JWT tabanlı SSO oturum yönetimi (`interapp_session`).
- [x] Tüm kritik sunucu endpoint'lerinin verifyAuth/verifyUser ile korunması.
- [x] Silo modülünde atomik bakiye kontrolü (race condition çözümü).
- [x] Locus modülünde oda/raf kaskat silme mekanizması.

### Faz 2: Mimari Standardizasyon, Doğrulama ve Yönlendirme (Tamamlandı ✅)
- [x] Tüm modüllerde (Locus, Circa, Dispo, LabProject, Silo) `react-router-dom` ile URL tabanlı yönlendirme.
- [x] Apex ön yüzünde `RequireAuth` ve `RequireAdmin` koruyucularının gerçek zamanlı sunucu sorgusuna bağlanması.
- [x] Tüm modüllerin backend API'larında Zod şema doğrulama katmanı.
- [x] Circa modülünde timezone-safe takvim ve UTC tabanlı mesai çarpan hesaplamaları.
- [x] Locus modülünde kafes eklemede grid limit sınır ve slot çakışma (overlapping) kontrolleri.
- [x] Silo modülünde `upsert: true` ile envanter kayıt performans optimizasyonu.
- [x] SSO JWT oturumuna kullanıcı `name` alanının eklenmesi ve alt uygulamalarda isim gösterimi.

> [!NOTE]
> Faz 2 kapsamındaki Adım 5 özellikleri (Locus Drawer UI, Dispo Bulk API ve Silo Çoklu Ürün Kataloğu) kullanıcı talebi doğrultusunda kapsam dışı tutulmuştur.

### Faz 3: İleri Seviye Özellikler ve Kurumsal Entegrasyonlar (Planlanıyor)
- [ ] Locus Kafes Detay Drawer UI (Hayvan CRUD yönetimi).
- [ ] Dispo Toplu Hayvan Girişi (Bulk Import API & UI).
- [ ] Silo Çoklu Ürün Kataloğu / Ürün bazlı stok takibi.
- [ ] Kurumsal SSO Entegrasyonları (LDAP, Google Auth vb.).
- [ ] Gelişmiş merkezi analitik ve audit log genişlemesi.
