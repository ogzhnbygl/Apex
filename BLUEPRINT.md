# 📐 Apex - Ürün Vizyonu ve Mimari Blueprint

## 🌟 1. Ürün Vizyonu ve Felsefesi

Apex, **Antigravity (WildType)** ekosisteminin dijital omurgası ve **Merkezi Sinir Sistemi**dir. 

Geleneksel laboratuvar ve araştırma yönetim süreçlerinde yaşanan en büyük problemler; dağınık kimlik yönetimi, her bir yazılım için ayrı parola zorunluluğu, silolar halinde yaşayan veritabanları ve denetimsiz yetki dağılımıdır. Apex, bu karmaşayı kökten çözmek için tasarlanmıştır.

> **Temel Misyon:** "Karmaşık araştırma, biyo-istatistik, vivaryum ve envanter süreçlerini yürüten bağımsız mikro-uygulamaları, tek ve sarsılmaz bir kimlik otoritesi altında birleştirmek; kullanıcıya akıcı bir deneyim, yöneticiye ise tam hakimiyet sunmak."

### Hedef Kitle
- **Sistem ve Vivaryum Yöneticileri:** Tüm ekosistem kullanıcılarını, erişim izinlerini ve kurumsal rolleri tek ekrandan yöneten yetkililer.
- **Araştırmacılar & Laboratuvar Personeli:** Deney projelerini (LabProject), hayvan çıkışlarını (Dispo), kafes yerleşimlerini (Locus), yem stoklarını (Silo) ve mesai saatlerini (Circa) tek bir oturumla kullanan profesyoneller.

---

## 🏛️ 2. Mimari Tasarım İlkeleri

Apex ve bağlı ekosistemin tasarımında dört temel mimari ilke tavizsiz uygulanır:

### 1. Hub & Spoke Ayrışması (Decoupled Autonomy)
- **Apex (Hub):** Kimlik, yetkilendirme, genel oturum yönetimi ve merkezi kullanıcı paneli.
- **Modüller (Spoke):** Kendi veritabanına, kendi iş kurallarına ve bağımsız yaşam döngüsüne sahip mikro-uygulamalar (Circa, Dispo, Silo, LabProject, Locus).
- **İlke:** Bir Spoke modülünün çökmesi veya bakıma alınması, Apex'i veya diğer Spoke uygulamalarını kesinlikle etkilemez.

### 2. Önce Güvenlik (Zero Trust SSO & Timing-Safe Verification)
- Güvenlik asla istemci tarafına (localStorage, sessionStorage) terk edilemez.
- Tüm Spoke uygulamalar gelen her istekte oturumu `crypto.timingSafeEqual` ve katı JWT doğrulaması ile denetler.
- `interapp_session` çerezi `HttpOnly` ve `Secure` nitelikleriyle XSS ve çerez enjeksiyonuna karşı zırhlandırılmıştır.

### 3. Katı Şema ve Tip Güvenliği (Strict Validation)
- API katmanına giren her bayt veri, modern **Zod v4** şemalarıyla sanitize edilir ve tip kontrolünden geçer.
- NoSQL enjeksiyonu (`$ne`, `$gt`, `$regex`) veya tanımsız alanlar sunucu katmanında `400 Bad Request` ile bloke edilir.

### 4. Kusursuz Test ve Ortam İzolasyonu (Hermetic Isolation)
- Testler veya önizleme dağıtımları (`VERCEL_ENV=preview`) asla canlı üretim veritabanına (`*_db`) dokunamaz.
- Sistem kod seviyesinde `isProdEnv()` mantığıyla üretim dışı her isteği `*_test_db` ve `interapp_session_test` çerezine kilitler.

---

## 🧭 3. İş Mantığı ve Domain Kuralları

### 3.1 Kullanıcı ve Yetki Yaşam Döngüsü

```
[ Yönetici Girişi ]
        │
        ▼
[ Admin Paneli: Yeni Kullanıcı Oluştur ] ──► (Zod Doğrulaması) ──► (Bcrypt Hash: 10 salt) ──► (MongoDB users: role='user', apps=[...])
        │
        ▼
[ Kullanıcı Girişi (POST /api/auth/login) ] ──► (Şifre Karşılaştırma) ──► (HS256 JWT Üretimi: 1d) ──► (Set-Cookie: interapp_session)
        │
        ▼
[ Dashboard Ekranı ] ──► Sadece 'apps' dizisinde tanımlı olan uygulamalar listelenir ve açılabilir
```

### 3.2 Temel Domain Kuralları

1. **Kapalı Sistem Kuralı:** Sistemde "halka açık kayıt" (public register) bulunmaz. `/api/auth/register` ve `/api/admin/users` yalnızca geçerli bir `admin` oturumuyla çalışır.
2. **Yönetici Kendini Koruma Kilidi (Admin Inviolability):**
   - Bir yönetici kullanıcı listesinde kendi profilinin yanındaki "Sil" butonuna basamaz (buton pasiftir).
   - API seviyesinde kendi e-postasına yönelik DELETE istekleri `400 Bad Request` ile reddedilir.
   - Yönetici kendi rolünü `user` seviyesine düşüremez (rol düşürme engeli).
3. **Uygulama İzin Filtresi (App Whitelisting):**
   - Bir kullanıcıya atanabilecek uygulamalar katı bir beyaz liste (`ALLOWED_APPS`) ile sınırlıdır: `['dispo', 'labproject', 'silo', 'circa', 'locus', 'apex']`.
   - Tanımsız bir uygulama kodu ekleme denemesi Zod tarafından reddedilir.
4. **Çift Yönlü Güvenlik Duvarı (Guard):**
   - Ön yüzde `RequireAuth` ve `RequireAdmin` anlık `/api/auth/me` sorgusu yapar.
   - Arka yüzde `verifyAuthWithStatus` Spoke seviyesinde hem oturumu hem de o modüle özel yetkiyi (`hasRequiredAppAccess`) doğrular.

---

## 🗺️ 4. Tamamlanan Fazlar ve Yol Haritası (Roadmap)

### ✅ Faz 1: Güvenlik, Veri Bütünlüğü ve Altyapı Temelleri (Tamamlandı)
- [x] **Bcrypt Şifreleme Standardı:** Tüm veritabanındaki düz metin parolaların Bcrypt hash yapısına (10 salt rounds) migrasyonu.
- [x] **JWT Tabanlı Merkezi SSO:** `interapp_session` HttpOnly, Secure ve `Domain=.wildtype.app` çerez mekanizmasının kurulması.
- [x] **Sunucu Taraflı Yetki Denetimi:** Tüm arka yüz uç noktalarında `verifyAuth` ve `verifyUser` ara katmanlarının devreye alınması.
- [x] **Silo Bakiye İzolasyonu:** Yem stok operasyonlarında race condition engeli ve atomik bakiye kontrolü.
- [x] **Locus Veri Bütünlüğü:** Oda ve raf silme işlemlerinde yetim kayıt oluşumunu önleyen kaskat silme mekanizması.

### ✅ Faz 2: Mimari Standardizasyon, Reaktif Doğrulama ve Test Orkestrasyonu (Tamamlandı)
- [x] **React Router DOM v7 Entegrasyonu:** Tüm modüllerde (Apex, Circa, Dispo, LabProject, Locus, Silo) modern URL tabanlı yönlendirme ve layout yapısı.
- [x] **React 19 Yükseltmesi:** Apex ön yüzünün React 19 mimarisine tam uyumu.
- [x] **Canlı Guard Sistemi:** `RequireAuth` ve `RequireAdmin` koruyucularının manipüle edilebilir istemci verileri yerine gerçek zamanlı `/api/auth/me` çağrısıyla çalışması.
- [x] **Zod v4 API Doğrulama Katmanı:** Tüm API isteklerinin (Body ve Query) Zod ile katı doğrulanması, NoSQL enjeksiyonu açıklarının tamamen kapatılması.
- [x] **JWT Payload İyileştirmesi:** Kullanıcı Ad-Soyad (`name`) bilgisinin token payload'una eklenmesi ve alt uygulamalarda ek DB sorgusu olmaksızın gösterilmesi.
- [x] **5 Portlu Playwright E2E Orkestrasyonu:** Apex, Circa, Dispo, LabProject ve Silo'yu eşzamanlı ayağa kaldırıp SSO oturum geçişlerini, formları ve dosya indirmelerini (CSV, JSON, PDF) test eden otomatik suite.
- [x] **Otomatik Test Veritabanı İzolasyonu:** `isProdEnv()` ve `getDbName()` ile testlerin canlı veritabanına erişiminin donanımsal düzeyde engellenmesi.
- [x] **Yönetici Hesabı Güvenlik Kilitleri:** Kendi hesabını silme ve kendi admin rolünü düşürme girişimlerinin sunucu ve arayüz düzeyinde engellenmesi.

### 🚀 Faz 3: İleri Seviye Kurumsal Yetenekler ve Entegrasyonlar (Planlanan Yol Haritası)
- [ ] **Kurumsal SSO (Enterprise Identity):** Üniversite ve kurum altyapıları için LDAP / Active Directory ve Google Workspace OAuth 2.0 / SAML 2.0 entegrasyonu.
- [ ] **İki Aşamalı Doğrulama (2FA / MFA):** TOTP tabanlı (Google Authenticator, 1Password) iki faktörlü kimlik doğrulama katmanı.
- [ ] **Merkezi Denetim Günlüğü (Centralized Audit Logs):** Sistem genelinde kimin, ne zaman, hangi modülde, hangi kritik veriyi değiştirdiğini kaydeden değiştirilemez (append-only) loglama servisi.
- [ ] **Granüler Yetkilendirme (Granular RBAC / ABAC):** Spoke uygulamalar içinde salt okuma (viewer), düzenleme (editor) ve onaylama (approver) alt rollerinin Apex üzerinden merkezi atanabilmesi.
- [ ] **Oturum Yönetim Konsolu:** Kullanıcının aktif açık oturumlarını ve cihazlarını görebildiği, dilediğinde diğer oturumları uzaktan sonlandırabildiği güvenlik paneli.
- [ ] **Merkezi Bildirim ve Uyarı Servisi:** Düşük stok (Silo), bekleyen izinler (Circa) ve etik süresi yaklaşan projeler (LabProject) için ortak bildirim merkezi.
