# Apex - Teknik Dokümantasyon

## 🏗️ Mimari Genel Bakış

Apex, "Hub & Spoke" modeline benzer bir mimari ile çalışır. Kendisi merkezi otorite (Hub) olarak görev yapar ve bağlı modüller (Spoke) için kimlik doğrulama sağlar.

### Kimlik Doğrulama Akışı
1.  Kullanıcı `wildtype.app` (Apex) üzerinden giriş yapar.
2.  Backend, `interapp_session` adında, `Domain=.wildtype.app` özelliğine sahip bir **HttpOnly Cookie** oluşturur.
3.  Bu cookie, tüm alt domainler (`*.wildtype.app`) tarafından okunabilir/gönderilebilir ancak JavaScript ile erişilemez (XSS koruması).
4.  Alt uygulamalar (örn. Dispo), açılışta Apex API'sine (`/api/auth/me`) istek atarak oturumu doğrular.

## 📂 Dizin Yapısı

```
Apex/
├── api/                  # Backend (Vercel Serverless Functions)
│   ├── admin/            # Yönetim paneli endpointleri (users.js)
│   ├── auth/             # Kimlik doğrulama (login, logout, me)
│   └── lib/              # Ortak kütüphaneler (mongodb.js)
├── src/                  # Frontend (React)
│   ├── components/       # Ortak bileşenler (Layout, AuthGuard)
│   ├── pages/            # Sayfa görünümleri (Dashboard, Admin, Login)
│   └── lib/              # Frontend yardımcıları
└── public/               # Statik varlıklar
```

## 🗄️ Veritabanı Şeması

Veriler **MongoDB** üzerinde `Apex_db` veritabanında tutulur.

### `users` Koleksiyonu

Kullanıcı bilgilerini ve yetkilerini tutar.

| Alan | Tip | Açıklama |
| :--- | :--- | :--- |
| `_id` | ObjectId | Benzersiz kimlik |
| `email` | String | Kullanıcı e-postası (Giriş anahtarı) |
| `password` | String | Kullanıcı şifresi |
| `name` | String | Ad Soyad |
| `role` | String | Rol (`admin`, `user`) |
| `apps` | Array<String> | Erişim izni olan uygulamalar (örn. `['dispo']`) |
| `createdAt` | Date | Oluşturulma tarihi |

## 🔌 API Referansı

### Auth

- **POST** `/api/auth/login`: Kullanıcı girişi. `interapp_session` çerezini set eder.
- **POST** `/api/auth/logout`: Çıkış yapar. Çerezi siler.
- **GET** `/api/auth/me`: Mevcut oturumu doğrular. CORS desteği ile alt domainlerden çağrılabilir.

### Admin

- **GET** `/api/admin/users`: Tüm kullanıcıları listeler.
- **POST** `/api/admin/users`: Yeni kullanıcı oluşturur.
- **PUT** `/api/admin/users`: Kullanıcı yetkilerini günceller.
- **DELETE** `/api/admin/users`: Kullanıcı siler.

## 🔐 Güvenlik Önlemleri

- **HttpOnly Cookies:** Session tokenları JS tarafından okunamaz, XSS riskini azaltır.
- **CORS Politikaları:** API, sadece izin verilen originlerden (`*.wildtype.app`) gelen istekleri kabul eder.
- **Role-Based Access Control (RBAC):** Admin sayfaları ve API endpointleri sunucu tarafında rol kontrolü yapar.
