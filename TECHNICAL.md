# ⚙️ Apex - Derinlemesine Teknik Mimari ve API Spesifikasyonu

Bu doküman, Apex projesinin mimari tasarımını, Hub & Spoke SSO mekanizmasını, veritabanı şemalarını, API referanslarını, ön yüz durum yönetimini ve güvenlik standartlarını eksiksiz olarak detaylandırır.

---

## 1. 🏗️ Sistem Mimarisi ve Hub & Spoke SSO Modeli

Apex, Antigravity ekosisteminin çekirdek kimlik sağlayıcısıdır (**Identity Provider - IdP**). Dağıtık çalışan mikro ön yüzler ve mikro servisler (Spoke modülleri), yetkilendirme kararlarını Apex tarafından üretilen imzalı çerez üzerinden yürütür.

### 1.1 Hub & Spoke Oturum ve Doğrulama Akışı

Aşağıdaki Mermaid sequence diyagramı, bir kullanıcının Apex üzerinden sisteme giriş yapması ve akabinde bir Spoke uygulamasına (örn. Dispo) kesintisiz geçiş yapma sürecini göstermektedir:

```mermaid
sequenceDiagram
    autonumber
    actor Kullanici as Kullanıcı (Tarayıcı)
    participant ApexUI as Apex Frontend (wildtype.app)
    participant ApexAPI as Apex Auth API (/api/auth/login)
    participant MongoDB as Apex_db (users koleksiyonu)
    participant DispoUI as Dispo Spoke (dispo.wildtype.app)
    participant DispoAPI as Dispo Backend API

    Kullanici->>ApexUI: E-posta ve şifre girer
    ApexUI->>ApexAPI: POST /api/auth/login { email, password }
    ApexAPI->>ApexAPI: Zod şeması ile payload doğrulaması
    ApexAPI->>MongoDB: findOne({ email })
    MongoDB-->>ApexAPI: Kullanıcı belgesi (Bcrypt hashli şifre)
    ApexAPI->>ApexAPI: bcrypt.compare(password, user.password)
    ApexAPI->>ApexAPI: jwt.sign(payload, JWT_SECRET, HS256, 1d)
    ApexAPI-->>ApexUI: Set-Cookie: interapp_session=JWT; Domain=.wildtype.app; HttpOnly; Secure; SameSite=Lax
    ApexUI-->>Kullanici: Dashboard yönlendirmesi (Uygulama listesi görünür)

    Note over Kullanici,DispoUI: Kullanıcı Dashboard'dan Dispo kartına tıklar
    Kullanici->>DispoUI: https://dispo.wildtype.app açılır
    Note over DispoUI: Tarayıcı, .wildtype.app kapsamındaki interapp_session çerezini otomatik iletir
    DispoUI->>DispoAPI: GET /api/auth/session (Cookie ile birlikte)
    DispoAPI->>DispoAPI: verifyAuthWithStatus(req, 'dispo')
    DispoAPI->>DispoAPI: Timing-safe imza ve apps['dispo'] yetki kontrolü
    DispoAPI-->>DispoUI: 200 OK { email, name, role, apps }
    DispoUI-->>Kullanici: Dispo Paneli açılır (Tekrar giriş gerekmez!)
```

### 1.2 Çerez Kapsamı ve Dinamik Alan Adı Yönetimi

Oturum çerezinin güvenliği ve erişim kapsamı, `api/lib/auth.js` ve `api/lib/mongodb.js` içerisinde merkezi olarak yönetilir:

```
+-----------------------------------------------------------------------------------+
| Cookie Adı         : interapp_session (Canlı) / interapp_session_test (Test)     |
| Domain Niteliği    : .wildtype.app (Tüm alt domainler tarafından okunabilir)      |
| Yol (Path)         : /                                                            |
| Güvenlik Nitelikleri: HttpOnly, Secure, SameSite=Lax                              |
| Geçerlilik Süresi  : Max-Age=86400 (24 saat)                                     |
+-----------------------------------------------------------------------------------+
```

- **Ortama Göre Çerez İsmi (`getSessionCookieName()`):**
  - Üretim ortamında: `interapp_session`
  - Önizleme / Test ortamında: `interapp_session_test`
- **Dinamik Domain Belirleme:**
  Gelen istek başlığındaki `req.headers.host` değeri incelenir. İstek `wildtype.app` veya `*.wildtype.app` üzerinden geliyorsa `Domain=.wildtype.app;` eklenir. Bu sayede Vercel önizleme URL'lerinde (`*.vercel.app`) tarayıcının üçüncü taraf çerez engelleme mekanizmaları tetiklenmez.

### 1.3 Veritabanı Ayrıştırma Mantığı (`getDbName`)

Veri güvenliğini ve test izolasyonunu sağlamak adına fiziksel veritabanı adları çalışma ortamına göre dinamik olarak belirlenir:

```javascript
export function isProdEnv() {
    return process.env.VERCEL_ENV === 'production' || process.env.FORCE_PROD_DB === 'true';
}

export function getDbName(baseName) {
    if (isProdEnv()) return baseName; // örn. Apex_db
    return baseName.endsWith('_db')
        ? baseName.replace(/_db$/, '_test_db') // örn. Apex_test_db
        : `${baseName}_test`;
}
```

---

## 2. 📂 Derinlemesine Dizin ve Dosya Mimarisi

```
/Users/oguzhan/Antigravity/Apex
├── api/                                      # Serverless Arka Yüz İşlevleri
│   ├── admin/
│   │   └── users.js                          # Yönetici CRUD işlemleri (Kullanıcı listeleme, ekleme, güncelleme, silme)
│   ├── auth/
│   │   ├── login.js                          # Kullanıcı oturum açma, Zod doğrulaması, JWT üretimi ve Set-Cookie
│   │   ├── logout.js                         # Oturumu sonlandırma ve çerezi Max-Age=0 ile düşürme
│   │   ├── me.js                             # Canlı oturum ve kullanıcı kimlik doğrulama, CORS yönetimi
│   │   └── register.js                       # Sadece yönetici yetkisiyle yeni kullanıcı kaydı
│   └── lib/
│       ├── auth.js                           # JWT ayrıştırma, timing-safe doğrulama ve verifyAuthWithStatus ara katmanı
│       └── mongodb.js                        # Singleton MongoClient bağlantı havuzu ve veritabanı isim eşleyicisi
├── public/                                   # İstemci Tarafı Statik Varlıklar
├── scripts/                                  # DevOps, Test ve Dağıtım Komut Dosyaları
│   ├── deploy-preview.js                     # Vercel preview dağıtımı
│   ├── deploy-prod.js                        # Vercel production dağıtımı
│   ├── run-ci-checks.js                      # 6 modüllü derleme, API ve E2E koşucusu
│   ├── sync-test-db.js                       # Canlı DB verilerini *_test_db veritabanlarına güvenli klonlayıcı
│   ├── test-db.js                            # MongoDB doğrudan bağlantı kontrolü
│   └── verify-backend.js                     # API durum ve yetki testi
├── src/                                      # React 19 Ön Yüz Uygulaması
│   ├── components/
│   │   ├── Layout.jsx                        # Üst navigasyon çubuğu, ortam etiketi ve çıkış kontrolü
│   │   ├── RequireAdmin.jsx                  # Yetkisiz kullanıcıları engelleyen admin rota kalkanı
│   │   └── RequireAuth.jsx                   # Oturumu olmayanları login'e yönlendiren kimlik kalkanı ve AuthContext
│   ├── pages/
│   │   ├── Admin.jsx                         # Kullanıcı yönetim konsolu, tablo, arama ve modal pencereleri
│   │   ├── Dashboard.jsx                     # İzinli uygulamaların listelendiği mikro-uygulama fırlatıcı kartları
│   │   └── Login.jsx                         # Apex kimlik doğrulama formu
│   ├── App.jsx                               # React Router DOM v7 yönlendirme hiyerarşisi
│   ├── index.css                             # Tailwind CSS v3 yönergeleri
│   └── main.jsx                              # React kök montaj dosyası
├── tests/                                    # Otomasyon ve Kalite Güvence
│   ├── api/
│   │   └── ecosystem.test.js                 # Ekosistem geneli 1200+ satırlık API, SSO ve NoSQL güvenlik testleri
│   └── e2e/
│       └── wildtype.spec.js                  # Playwright tarayıcı, indirme ve navigasyon E2E testleri
├── eslint.config.js                          # Modern ESLint flat konfigürasyonu
├── package.json                              # Proje bağımlılıkları ve çalıştırma komutları
├── playwright.config.js                      # 5 portlu webServer orkestrasyonu ve Playwright ayarları
├── postcss.config.js                         # PostCSS yapılandırması
├── tailwind.config.js                        # Tailwind CSS tema ayarları
├── vercel.json                               # SPA yönlendirme yeniden yazım kuralı (rewrites)
└── vite.config.js                            # Vite ve yerel Serverless API middleware eklentisi
```

---

## 3. 🗄️ Veritabanı ve Şema Spesifikasyonu

Apex, verilerini MongoDB üzerinde `Apex_db` (test modunda `Apex_test_db`) altında depolar.

### Koleksiyon: `users`

Sistemdeki tüm yöneticilerin ve kullanıcıların kimlik, rol ve yetki detaylarını barındırır.

```json
{
  "_id": { "$oid": "664fa1b2390a4c21980a1234" },
  "name": "Oğuzhan Baygül",
  "email": "oguzhan.baygul@medeniyet.edu.tr",
  "username": "oguzhan.baygul@medeniyet.edu.tr",
  "password": "$2a$10$wT8K4Zz8yK3x.Bq1U6gK9u5l7Fm.bT7y9O3p8hL5r1u9k8e7a6",
  "role": "admin",
  "apps": ["dispo", "labproject", "silo", "circa", "locus", "apex"],
  "createdAt": { "$date": "2025-01-10T12:00:00.000Z" },
  "updatedAt": { "$date": "2026-06-04T15:30:00.000Z" }
}
```

| Alan Adı | Veri Tipi | Zorunlu? | İndeks / Kısıt | Açıklama |
| :--- | :--- | :---: | :--- | :--- |
| `_id` | `ObjectId` | Evet | Primary Key | Benzersiz MongoDB doküman kimliği |
| `name` | `String` | Evet | Min: 1 karakter | Kullanıcının Adı ve Soyadı |
| `email` | `String` | Evet | Unique, Lowercase | Kullanıcının kurumsal e-posta adresi (Giriş anahtarı) |
| `username` | `String` | Evet | - | Genellikle `email` ile aynı değeri taşır |
| `password` | `String` | Evet | Bcrypt (10 rounds) | Hashlenmiş parola özeti (asla düz metin saklanmaz) |
| `role` | `String` | Evet | Enum: `['admin', 'user']` | Sistem erişim seviyesi |
| `apps` | `Array<String>` | Evet | Valid enum listesi | Yetkili olduğu Spoke uygulamalar: `['dispo', 'labproject', 'silo', 'circa', 'locus', 'apex']` |
| `createdAt`| `Date` | Evet | - | Hesabın oluşturulma zaman damgası |
| `updatedAt`| `Date` | Hayır | - | Son güncelleme zaman damgası |

---

## 4. 🔌 Tam API Referansı

Apex'in sunduğu tüm backend endpoint'leri, gelen verileri **Zod v4** şemalarıyla doğrular. Hatalı biçimlendirilmiş istekler `400 Bad Request` kodu ile geri çevrilir.

### 4.1 POST `/api/auth/login`
Kullanıcı girişi yapar, parolayı Bcrypt ile doğrular ve istemciye `interapp_session` çerezini atar.

- **Erişim:** Herkese açık (Public)
- **Zod Doğrulama Şeması:**
  ```javascript
  const loginSchema = z.object({
      email: z.string().trim().email('Geçerli bir e-posta adresi giriniz.'),
      password: z.string().min(1, 'Şifre gereklidir.')
  });
  ```
- **Örnek İstek (Request Body):**
  ```json
  {
    "email": "oguzhan.baygul@medeniyet.edu.tr",
    "password": "GucluSifre2026!"
  }
  ```
- **Başarılı Yanıt (200 OK):**
  - **Set-Cookie Başlığı:** `interapp_session=eyJhbGci...; Path=/; Domain=.wildtype.app; HttpOnly; SameSite=Lax; Max-Age=86400; Secure`
  - **Gövde:**
    ```json
    {
      "message": "Login successful",
      "user": {
        "email": "oguzhan.baygul@medeniyet.edu.tr",
        "role": "admin",
        "apps": ["dispo", "labproject", "silo", "circa", "locus", "apex"],
        "name": "Oğuzhan Baygül"
      }
    }
    ```
- **Olası Hata Kodları:**
  - `400 Bad Request`: Geçersiz e-posta biçimi veya eksik alanlar (NoSQL nesneleri engellenir).
  - `401 Unauthorized`: "Geçersiz e-posta veya şifre."
  - `405 Method Not Allowed`: GET veya diğer metodlar.
  - `500 Internal Server Error`: Sunucu/Veritabanı hatası.

---

### 4.2 POST `/api/auth/logout`
Oturumu sonlandırır, tarayıcıdaki `interapp_session` çerezini geçersiz kılar.

- **Erişim:** Herkese açık (Kullanıcı oturumu varsa temizlenir)
- **İstek Gövdesi:** Boş
- **Başarılı Yanıt (200 OK):**
  - **Set-Cookie Başlığı:** `interapp_session=; Path=/; Domain=.wildtype.app; HttpOnly; SameSite=Lax; Max-Age=0; Secure`
  - **Gövde:**
    ```json
    {
      "message": "Logged out"
    }
    ```
- **Olası Hata Kodları:**
  - `405 Method Not Allowed`: POST harici istekler.

---

### 4.3 GET `/api/auth/me`
Aktif oturum çerezini doğrular ve oturum açmış kullanıcının güncel yetki profilini döndürür. Alt alan adları (`*.wildtype.app`) için dinamik CORS desteği sağlar.

- **Erişim:** Geçerli oturum çerezi gerektirir
- **CORS Başlıkları:**
  - `Access-Control-Allow-Origin`: İstek origin'i `localhost`, `wildtype.app` veya `*.wildtype.app` ile eşleşiyorsa atanır.
  - `Access-Control-Allow-Credentials`: `true`
  - `Access-Control-Allow-Methods`: `GET, OPTIONS`
- **Başarılı Yanıt (200 OK):**
  ```json
  {
    "email": "oguzhan.baygul@medeniyet.edu.tr",
    "role": "admin",
    "apps": ["dispo", "labproject", "silo", "circa", "locus", "apex"],
    "name": "Oğuzhan Baygül"
  }
  ```
- **Olası Hata Kodları:**
  - `401 Unauthorized`: Çerez yok, JWT geçersiz veya süresi dolmuş.
  - `500 Internal Server Error`: Beklenmeyen sunucu hatası.

---

### 4.4 POST `/api/auth/register`
Sisteme yeni bir kullanıcı kaydeder. Sistemin kapalı mimarisi gereği bu uç nokta **yalnızca yönetici (`admin`)** oturumu ile çağrılabilir.

- **Erişim:** Sadece `admin` rolü
- **Zod Doğrulama Şeması:**
  ```javascript
  const registerSchema = z.object({
      name: z.string().trim().min(1, 'Ad Soyad gereklidir.').optional(),
      email: z.string().trim().email('Geçerli bir e-posta adresi gereklidir.'),
      password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır.')
  });
  ```
- **Örnek İstek:**
  ```json
  {
    "name": "Yeni Araştırmacı",
    "email": "arastirmaci@medeniyet.edu.tr",
    "password": "Password123!"
  }
  ```
- **Başarılı Yanıt (201 Created):**
  ```json
  {
    "message": "User created successfully"
  }
  ```
- **Olası Hata Kodları:**
  - `400 Bad Request`: Zod validasyon hatası.
  - `403 Forbidden`: İstek yapan kullanıcının admin olmaması.
  - `409 Conflict`: Bu e-posta adresiyle kayıtlı bir kullanıcı zaten mevcut.

---

### 4.5 Admin API: `/api/admin/users`
Tüm kullanıcı yönetim operasyonlarını barındıran merkezi RESTful uç noktadır. Bütün HTTP metodları `admin` oturumu gerektirir.

#### A) GET `/api/admin/users`
Tüm kullanıcıları listeler (güvenlik gereği `password` hash'i yanıttan silinir).
- **Yetki:** `admin`
- **Başarılı Yanıt (200 OK):**
  ```json
  [
    {
      "_id": "664fa1b2390a4c21980a1234",
      "name": "Oğuzhan Baygül",
      "email": "oguzhan.baygul@medeniyet.edu.tr",
      "role": "admin",
      "apps": ["dispo", "labproject", "silo", "circa", "locus", "apex"],
      "createdAt": "2025-01-10T12:00:00.000Z"
    }
  ]
  ```

#### B) POST `/api/admin/users`
Admin paneli üzerinden yeni kullanıcı tanımlar.
- **Yetki:** `admin`
- **Zod Şeması:**
  ```javascript
  const userPostSchema = z.object({
      name: z.string().trim().min(1, 'Ad Soyad gereklidir.'),
      email: z.string().trim().email('Geçerli bir e-posta adresi gereklidir.'),
      password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır.'),
      role: z.enum(['user', 'admin']).optional().default('user'),
      apps: z.array(z.string().trim().toLowerCase().refine(a => ALLOWED_APPS.includes(a), 'Geçersiz uygulama yetkisi.')).optional().default(['dispo'])
  });
  ```
- **Başarılı Yanıt (201 Created):**
  ```json
  { "message": "Kullanıcı başarıyla oluşturuldu." }
  ```
- **Olası Hatalar:** `400` (Zod hatası), `409` (Mükerrer e-posta).

#### C) PUT `/api/admin/users`
Mevcut bir kullanıcının bilgilerini, rolünü, uygulama erişimlerini veya parolasını günceller.
- **Yetki:** `admin`
- **Güvenlik Kilidi:** Yönetici kendi e-postası için rolünü `user` yapamaz (`400 Bad Request`).
- **Örnek İstek:**
  ```json
  {
    "email": "arastirmaci@medeniyet.edu.tr",
    "name": "Dr. Araştırmacı",
    "role": "user",
    "apps": ["dispo", "circa", "silo"],
    "password": "YeniGucluSifre123!"
  }
  ```
- **Başarılı Yanıt (200 OK):**
  ```json
  { "message": "Kullanıcı güncellendi." }
  ```

#### D) DELETE `/api/admin/users?email=...`
Kullanıcı hesabını kalıcı olarak siler.
- **Yetki:** `admin`
- **Güvenlik Kilidi:** Yönetici kendi hesabını silemez (`400 Bad Request` - "Kendi yönetici hesabınızı silemezsiniz.").
- **Başarılı Yanıt (200 OK):**
  ```json
  { "message": "Kullanıcı silindi." }
  ```

---

## 5. 🖥️ Ön Yüz Mimarisi ve Rota Koruması

Apex ön yüzü, **React 19** ve **React Router DOM v7** üzerine kuruludur. İstemci tarafında `localStorage` verisine asla güvenilmez; tüm güvenlik kontrolleri anlık sunucu doğrulamasına bağlıdır.

### 5.1 Rota Tanımları (`App.jsx`)

```jsx
<BrowserRouter>
  <Routes>
    <Route path="/login" element={<Login />} />

    <Route path="/" element={
      <RequireAuth>
        <Layout />
      </RequireAuth>
    }>
      <Route index element={<Dashboard />} />
      <Route path="admin" element={
        <RequireAdmin>
          <Admin />
        </RequireAdmin>
      } />
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
</BrowserRouter>
```

### 5.2 Rota Kalkanları ve Context Mekanizması

#### `RequireAuth.jsx`:
- Sayfa yüklendiğinde anında `/api/auth/me` çağrısı yapar.
- Oturum doğrulanırken `animate-pulse` ile "Kontrol ediliyor..." durumunu gösterir.
- Oturum yoksa veya 401 dönerse, kullanıcıyı geldiği konumu (`location`) hafızasında tutarak `/login` rotasına yönlendirir.
- Oturum geçerliyse, kullanıcı bilgilerini `AuthUserContext.Provider` ile alt bileşenlerin kullanımına açar.
- Dışa aktarılan `useAuthUser()` hook'u ile oturum açan kullanıcının bilgileri her bileşenden okunabilir.

#### `RequireAdmin.jsx`:
- Önce üst context'teki `useAuthUser()` değerini kontrol eder. Context henüz yüklenmemişse `/api/auth/me` çağrısı ile doğrular.
- Kullanıcı geçerli olsa dahi `user.role !== 'admin'` ise kullanıcıyı sessizce ana panele (`/`) yönlendirir.

---

## 6. 🛡️ Hata Yönetimi ve Güvenlik Mekanizmaları

### 6.1 Parola Güvenliği (Bcrypt Hashing)
Kullanıcı parolaları, veri tabanına yazılmadan önce `bcrypt.hash(password, 10)` ile 10 tuzlama turu ile şifrelenir. Karşılaştırma işlemleri yalnızca `bcrypt.compare` ile yürütülür.

### 6.2 JWT İmza Doğrulama ve Timing Attacks Koruması
JWT token ayrıştırılırken yalnızca standart imza kontrolü yapılmaz; aynı zamanda zamanlama farklarından kaynaklanan yan kanal açıklarını önlemek için Node.js yerleşik `crypto.timingSafeEqual` fonksiyonu kullanılır:
```javascript
const sigBuf = Buffer.from(signatureB64, 'utf-8');
const expectedBuf = Buffer.from(expectedSignatureB64, 'utf-8');
if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null; // İmza geçersiz!
}
```
Ayrıca `alg: "none"` saldırılarına karşı `header.alg !== 'HS256'` kontrolü katı biçimde uygulanır.

### 6.3 NoSQL Enjeksiyon Koruması
MongoDB sorgularında nesne (`{ $ne: null }`) geçirilerek yapılan şifresiz giriş denemeleri, Zod şemasının `z.string()` kontrolü sayesinde HTTP katmanında derhal yakalanır ve veritabanı sürücüsüne dahi ulaşmadan `400 Bad Request` ile reddedilir.

---

## 7. 🧪 Test Mimarisi ve Playwright Orkestrasyonu

Apex, sistem genelindeki tüm uygulamaların E2E testlerini yürütebilecek orkestrasyon merkezidir (`playwright.config.js`):

```javascript
const SERVER_SPECS = [
    { name: 'Apex', port: 4171 },
    { name: 'Circa', port: 4172 },
    { name: 'Dispo', port: 4173 },
    { name: 'LabProject', port: 4174 },
    { name: 'Silo', port: 4175 }
];
```

Testler çalıştırıldığında:
1. `VERCEL_ENV = 'preview'` atanarak üretim veritabanı kesin olarak devre dışı bırakılır (`Apex_test_db`, `Circa_test_db` vb.).
2. Çerez ismi otomatik olarak `interapp_session_test` değerine dönüştürülür.
3. 5 Vite geliştirme sunucusu eşzamanlı olarak ayağa kaldırılır.
4. Çapraz yetki, izinli/izinsiz uygulama erişimleri ve dosya indirmeleri (CSV, JSON, PDF) gerçek Chromium üzerinde test edilir.
