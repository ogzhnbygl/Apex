# 🏔️ Apex - Merkezi Yönetim ve Kimlik Doğrulama Sistemi (SSO Hub)

Apex, **Antigravity (WildType)** ekosisteminin çekirdek otorite ve merkezi kimlik doğrulama omurgasıdır (**Core Identity & SSO Hub**). Bünyesindeki tüm bağımsız mikro-uygulamaların (**Spoke** modülleri: Dispo, Circa, Silo, LabProject, Locus) tek bir noktadan güvenli biçimde kimlik doğrulamasını, kullanıcı yaşam döngüsünü, rol hiyerarşisini ve uygulama bazlı erişim yetkilerini koordine eder.

---

## 🌟 Ekosistemdeki Rolü ve Hub & Spoke Mimarisi

Antigravity mimarisi, **Hub & Spoke** prensibine dayanır:

```
                            ┌─────────────────┐
                            │      APEX       │
                            │  (Identity Hub) │
                            │   wildtype.app  │
                            └────────┬────────┘
                                     │
          ┌──────────────┬───────────┴───────────┬──────────────┐
          │              │                       │              │
          ▼              ▼                       ▼              ▼
    ┌───────────┐  ┌───────────┐           ┌───────────┐  ┌───────────┐
    │   DISPO   │  │   CIRCA   │           │   SILO    │  │LABPROJECT │
    │(Kayıt/Çıkış)││ (Mesai)   │           │ (Yem/Stok)│  │(Etik/Proje)│
    └───────────┘  └───────────┘           └───────────┘  └───────────┘
                         ▲                       ▲
                         │       ┌───────────┐   │
                         └───────┤   LOCUS   ├───┘
                                 │(Dijital   │
                                 │  İkiz)    │
                                 └───────────┘
```

1. **Merkezi Kimlik Otoritesi (Hub):** Kullanıcı oturum açma, şifre değiştirme, hesap aktivasyonu ve yetki atama işlemlerinin tek adresidir.
2. **Çapraz Uygulama Oturumu (Single Sign-On - SSO):** Apex üzerinde oturum açıldığında, `*.wildtype.app` kök etki alanına özel imzalı bir JWT oturum çerezi (`interapp_session`) atanır. Kullanıcı hiçbir spoke uygulamada tekrar kimlik doğrulamak zorunda kalmaz.
3. **Rol ve Erişim Filtreleme:** Kullanıcılar sistem genelinde `admin` veya `user` rolüne sahiptir. Standart kullanıcılar yalnızca kendilerine Apex Admin Paneli üzerinden tanımlanmış olan uygulamalara (örn. `['dispo', 'silo']`) erişebilirler.

---

## 🚀 Özellikler

### 🔐 Kimlik Doğrulama & Oturum Yönetimi
- **JWT Tabanlı Güvenli SSO:** HS256 algoritmasıyla imzalanan, süresi sınırlandırılmış (1 gün), manipülasyona kapalı JSON Web Token oturumları.
- **HttpOnly & Secure Çerezler:** İstemci tarafı JavaScript'in erişemediği, XSS ve çerez çalma saldırılarına karşı tam korumalı oturum çerezi (`interapp_session` veya test ortamlarında `interapp_session_test`).
- **Dinamik Domain Tespiti:** Canlı ortamda `Domain=.wildtype.app`, geliştirme veya test ortamlarında localhost/preview bazlı esnek çerez kapsamı.
- **Timing-Safe İmza Doğrulaması:** `crypto.timingSafeEqual` kullanılarak yan kanal ve zamanlama saldırılarına (timing attacks) karşı korumalı oturum kontrolü.
- **Güvenli Çıkış (Logout):** Apex veya herhangi bir spoke modülden oturum sonlandırıldığında çerezin `Max-Age=0` ile tüm alt etki alanlarında geçersiz kılınması.

### 🛡️ Güvenlik & Veri Bütünlüğü
- **Bcrypt Şifreleme:** Düz metin (plain-text) parola saklanmaz; tüm parolalar `bcryptjs` ile 10 tuzlama turu (salt rounds) ile hashlenerek saklanır.
- **Zod 4 ile Katı Şema Doğrulaması:** Tüm API uç noktaları (giriş, kayıt, kullanıcı güncelleme, silme), gelen gövdeleri ve sorgu parametrelerini Zod şemalarıyla doğrular. Hatalı tipler ve NoSQL enjeksiyonu operatörleri (`$ne`, `$gt` vb.) 400 Bad Request ile engellenir.
- **Yönetici Hesabı Koruma Kilidi (Self-Delete Lock):** Giriş yapmış olan bir yönetici kendi hesabını silemez ve kendi admin rolünü `user` seviyesine düşüremez.
- **Katı CORS Güvenliği:** Sadece yetkili etki alanları (`wildtype.app`, `*.wildtype.app`, `localhost`) kimlik bilgisi (credential) içeren istekler yapabilir.
- **Test ve Prod DB İzolasyonu:** `VERCEL_ENV=preview` veya test modunda tüm işlemler otomatik olarak izole edilmiş `*_test_db` veritabanlarına yönlendirilir.

### 💻 Modern Kullanıcı Deneyimi & Ön Yüz
- **Reaktif Dashboard:** Kullanıcının yetkili olduğu uygulamaları dinamik olarak listeleyen, ortama göre (prod vs test) dinamik subdomain üreten hızlı başlatıcı kartları.
- **Admin Yönetim Paneli:**
  - Kullanıcı arama (anlık isim ve e-posta filtreleme).
  - Modal tabanlı yeni kullanıcı ekleme ve düzenleme.
  - Parola sıfırlama (şifre gizle/göster desteğiyle).
  - Tek tıklamayla uygulama yetkilerini (Dispo, Circa, Silo, LabProject, Locus) açıp kapatabilen rozet seçici.
- **Gerçek Zamanlı Rota Koruması:** `RequireAuth` ve `RequireAdmin` koruyucuları sayfa yenilenmelerinde `/api/auth/me` üzerinden sunucu taraflı canlı doğrulama yapar; manipüle edilebilir istemci durumlarına güvenmez.
- **Test Ortamı Rozeti:** Test veya Vercel Preview ortamlarında otomatik beliren uyarı rozeti ("Test Ortamı").

---

## 🛠️ Teknoloji Yığını

### Ön Yüz (Frontend)
- **Kütüphane:** [React](https://react.dev/) `^19.2.0` (React 19 mimarisi)
- **DOM Motoru:** [React DOM](https://react.dev/) `^19.2.0`
- **Yönlendirme:** [React Router DOM](https://reactrouter.com/) `^7.9.6` (React Router v7)
- **İkon Seti:** [Lucide React](https://lucide.dev/) `^0.555.0`
- **Biçimlendirme:** [Tailwind CSS](https://tailwindcss.com/) `^3.4.18` + [PostCSS](https://postcss.org/) `^8.5.6` + [Autoprefixer](https://github.com/postcss/autoprefixer) `^10.4.22`
- **Geliştirme & Derleme:** [Vite](https://vitejs.dev/) `^5.4.11` + `@vitejs/plugin-react` `^4.3.1`

### Arka Yüz (Backend & Serverless)
- **Çalışma Zamanı:** Vercel Serverless Functions (Node.js ESM)
- **Veritabanı Sürücüsü:** [MongoDB Node Driver](https://www.mongodb.com/docs/drivers/node/current/) `^7.0.0`
- **Şema Doğrulama:** [Zod](https://zod.dev/) `^4.4.3` (Modern Zod v4 API)
- **Kriptografi & Parola:** [BcryptJS](https://github.com/dcodeIO/bcrypt.js) `^3.0.3` + Node.js yerleşik `crypto`
- **Oturum İmzası:** [JsonWebToken](https://github.com/auth0/node-jsonwebtoken) `^9.0.3`
- **Yerel Geliştirme:** Vite içi dahili `vercelServerless` middleware simülasyonu

### Test & Kalite Güvence
- **Uçtan Uca (E2E) Test:** [Playwright](https://playwright.dev/) `^1.64.1` (Tüm ekosistem portlarını ayağa kaldıran çoklu webServer orkestrasyonu)
- **API Test Koşucusu:** Node.js yerleşik test motoru (`node:test`, `node:assert/strict`)
- **Statik Kod Analizi:** [ESLint](https://eslint.org/) `^9.39.1` (Flat config formatında)

---

## 📂 Proje Dizin Yapısı

```
Apex/
├── api/                             # Vercel Serverless Backend Fonksiyonları
│   ├── admin/
│   │   └── users.js                 # Yönetici kullanıcı CRUD operasyonları (GET, POST, PUT, DELETE)
│   ├── auth/
│   │   ├── login.js                 # Giriş, parola kontrolü, JWT oluşturma ve Set-Cookie
│   │   ├── logout.js                # Çıkış ve oturum çerezi sıfırlama (Max-Age=0)
│   │   ├── me.js                    # Canlı oturum ve CORS doğrulama uç noktası
│   │   └── register.js              # Yönetici korumalı yeni kullanıcı kaydı
│   └── lib/
│       ├── auth.js                  # Token imza doğrulama, timing-safe kontrol ve yetki ara katmanı
│       └── mongodb.js               # MongoDB bağlantı havuzu, isProdEnv ve dinamik DB/çerez seçici
├── public/                          # Statik varlıklar (favicon vb.)
├── scripts/                         # Otomasyon ve Dağıtım Araçları
│   ├── deploy-preview.js            # Preview ortamı dağıtım otomasyonu
│   ├── deploy-prod.js               # Canlı ortama kontrollü dağıtım
│   ├── run-ci-checks.js             # 3 aşamalı CI kontrol koşucusu (Build -> API -> E2E)
│   ├── sync-test-db.js              # Canlı DB verilerini test DB'sine kopyalama/senkronize etme
│   ├── test-db.js                   # Veritabanı bağlantı testi
│   └── verify-backend.js            # Backend API durum doğrulama
├── src/                             # React 19 Ön Yüz Uygulaması
│   ├── components/
│   │   ├── Layout.jsx               # Ana navigasyon, test ortamı rozeti ve çıkış butonu
│   │   ├── RequireAdmin.jsx         # Yönetici rolü doğrulayan korumalı rota bileşeni
│   │   └── RequireAuth.jsx          # Oturum doğrulayan korumalı rota bileşeni ve AuthContext
│   ├── pages/
│   │   ├── Admin.jsx                # Kullanıcı yönetimi, arama, ekleme/düzenleme modalları
│   │   ├── Dashboard.jsx            # Uygulama fırlatıcı grid paneli (Dispo, Circa, Silo vb.)
│   │   └── Login.jsx                # Apex giriş sayfası
│   ├── App.jsx                      # React Router DOM v7 rota tanımları
│   ├── index.css                    # Tailwind CSS temel yönergeleri
│   └── main.jsx                     # React DOM kök render noktası
├── tests/                           # Otomatik Test Paketleri
│   ├── api/
│   │   └── ecosystem.test.js        # Ekosistem geneli API, güvenlik, JWT ve NoSQL testleri
│   └── e2e/
│       └── wildtype.spec.js         # Playwright tarayıcı, oturum ve dosya indirme testleri
├── eslint.config.js                 # ESLint 9 yapılandırması
├── package.json                     # Proje bağımlılıkları ve npm betikleri
├── playwright.config.js             # Playwright çoklu-uygulama sunucu ve E2E yapılandırması
├── postcss.config.js                # PostCSS yapılandırması
├── tailwind.config.js               # Tailwind CSS tema ve stil kuralları
├── vercel.json                      # Vercel SPA yeniden yazma (rewrite) kuralları
└── vite.config.js                   # Vite yapılandırması ve yerel Serverless API middleware'i
```

---

## ⚙️ Ortam Değişkenleri (.env)

Apex'in yerel ortamda veya sunucuda çalışabilmesi için `.env` (veya `.env.local`) dosyasında aşağıdaki değişkenler tanımlanmalıdır:

| Değişken Adı | Zorunlu mu? | Örnek Değer | Açıklama |
| :--- | :---: | :--- | :--- |
| `MONGODB_URI` | **Evet** | `mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true` | MongoDB bağlantı dizesi. |
| `JWT_SECRET` | **Evet** | `super-secret-jwt-key-min-32-chars` | HS256 JWT oturumlarını imzalamak için gizli anahtar. |
| `VERCEL_ENV` | Hayır | `production` \| `preview` \| `development` | Vercel çalışma ortamı. `preview` durumunda izole test DB kullanılır. |
| `FORCE_PROD_DB` | Hayır | `true` \| `false` | Geliştirme ortamında zorunlu olarak canlı DB'ye bağlanmak istenirse `true` yapılır (dikkatli kullanılmalıdır). |
| `NODE_ENV` | Hayır | `development` \| `production` | Node.js çalışma modu. |

---

## 🚀 Kurulum ve Çalıştırma Rehberi

### Ön Gereksinimler
- **Node.js:** v18.0.0 veya üzeri (v20+ LTS önerilir)
- **MongoDB:** Çalışan bir MongoDB kümesi (Atlas veya yerel)
- **npm:** v9 veya üzeri

### 1. Depoyu Klonlayın ve Bağımlılıkları Yükleyin
```bash
git clone <repo-url>
cd Apex
npm install
```

### 2. Çevresel Değişkenleri Yapılandırın
Kök dizinde `.env` dosyasını oluşturun:
```bash
cp .env.example .env # Veya doğrudan .env oluşturun
```
İçeriğini doldurun:
```env
MONGODB_URI=mongodb+srv://<kullanici>:<sifre>@cluster0.mongodb.net/?retryWrites=true&w=majority
JWT_SECRET=antigravity_apex_jwt_secret_token_key_secure_2026
```

### 3. Geliştirme Sunucusunu Başlatın
Vite konfigürasyonumuzda yerleşik bir Serverless Middleware bulunduğu için harici Vercel CLI kurulumu **gerekmeksizin** hem React ön yüzü hem de API uç noktaları tek komutla ayağa kalkar:
```bash
npm run dev
```
Uygulama varsayılan olarak `http://localhost:5173` adresinde çalışmaya başlar.

---

## 🧪 Testleri Çalıştırma

Apex, hem merkezi API düzeyinde hem de tüm ekosistemi kapsayan uçtan uca (E2E) tarayıcı düzeyinde kapsamlı test suitelerine sahiptir.

### 1. Hızlı CI Kontrolü (Derleme + API Testleri)
```bash
npm run test:ci
```
Tüm Antigravity modüllerinin (Apex, Circa, Dispo, LabProject, Locus, Silo) `npm run build` kontrollerini ve `Apex/tests/api/ecosystem.test.js` entegrasyon testlerini çalıştırır.

### 2. Tam Kapsamlı Test (Derleme + API + Playwright E2E)
```bash
npm test
```
Tüm 5 uygulamayı (Apex: 4171, Circa: 4172, Dispo: 4173, LabProject: 4174, Silo: 4175) otomatik olarak arka planda ayağa kaldırır ve gerçek Chromium tarayıcısı üzerinden test eder.

### 3. Bağımsız Test Komutları
- **Yalnızca API Testleri:**
  ```bash
  npm run test:api
  ```
- **Yalnızca Playwright E2E Testleri:**
  ```bash
  npm run test:e2e
  ```
- **Playwright Arayüzlü (UI) Mod:**
  ```bash
  npm run test:e2e:ui
  ```
- **Test Veritabanı Senkronizasyonu (Canlı DB -> Test DB):**
  ```bash
  npm run sync:test-db
  ```

---

## 🔐 Güvenlik ve Yetkilendirme Modeli Özeti

1. **İmza Bütünlüğü:** Tüm oturum çerezleri HS256 HMAC ile sunucuda doğrulanır. İstemci token içeriğini değiştirirse imza geçersiz kılınır.
2. **Çapraz İstek Koruması (CSRF):** Oturum çerezleri `SameSite=Lax` ile ayarlanmıştır. Dış sitelerden gelen POST/PUT isteklerinde tarayıcı bu çerezi göndermez.
3. **Rol Ayrımı (RBAC):** 
   - `admin`: Tüm sisteme, kullanıcı yönetimine (`/admin`) ve tüm spoke uygulamalara sınırsız erişim.
   - `user`: Yalnızca `apps` dizisinde yer alan spesifik uygulamalara erişim. Admin paneline girişi engellenir.
4. **Kapalı Kayıt:** Yeni kullanıcı kaydı genel internete kapalıdır (`/api/auth/register` sadece geçerli bir admin oturumuyla çağrılabilir).

---

## 📚 İlgili Dokümanlar

- 📘 [TECHNICAL.md](./TECHNICAL.md): Sistem mimarisi, derinlemesine veri modelleri, Zod şemaları ve tam API referansı.
- 📐 [BLUEPRINT.md](./BLUEPRINT.md): Ürün vizyonu, tasarım felsefesi, tamamlanan fazlar ve gelecek yol haritası.

---

## 📜 Lisans ve Telif Hakkı

Bu proje Antigravity ekosisteminin tescilli mülkiyetidir. İzinsiz kopyalanması, dağıtılması ve harici sistemlerde kullanılması yasaktır.
