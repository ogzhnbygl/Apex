# Apex - Teknik Dokümantasyon

Bu doküman, Apex projesinin teknik mimarisini, veritabanı yapısını ve API referanslarını detaylandırır.

## 🏗️ Mimari Genel Bakış

Apex, "Hub & Spoke" modeline benzer bir mimari ile çalışır. Kendisi merkezi otorite (Hub) olarak görev yapar ve bağlı modüller (Spoke) için kimlik doğrulama sağlar.

### Kimlik Doğrulama ve Oturum Akışı
1.  **Giriş:** Kullanıcı `/api/auth/login` üzerinden giriş yapar. Gönderilen veriler Zod şemasıyla doğrulanır, şifre Bcrypt ile kontrol edilir.
2.  **Cookie Oluşturma:** Giriş başarılı ise sunucu tarafında kullanıcının `_id`, `email`, `role`, `apps` ve `name` (Ad Soyad) bilgilerini barındıran ve JWT imza anahtarı ile imzalanmış bir token üretilir. Bu token, `interapp_session` adında, `Domain=.wildtype.app`, `HttpOnly`, `Secure` ve `SameSite=Lax` niteliklerine sahip bir cookie olarak set edilir.
3.  **Paylaşım:** Bu cookie, tüm alt domainler (`*.wildtype.app`) tarafından okunabilir/gönderilebilir ancak JavaScript ile erişilemez (XSS koruması).
4.  **Real-Time Doğrulama (Frontend & Backend):** 
    - Ön yüzde `RequireAuth.jsx` ve `RequireAdmin.jsx` rota koruyucuları sayfa yüklenmelerinde doğrudan `/api/auth/me` endpoint'ine istek atarak oturumu sunucuda doğrular.
    - Alt uygulamaların sunucu tarafındaki (backend) tüm istekleri, Apex `verifyAuth` ve `verifyUser` ara katmanları ile JWT imza doğrulaması ve rol kontrolü yapılarak yetkilendirilir.
    - JWT payload'una eklenen `name` parametresi sayesinde alt uygulamalar (örn. Circa) ek veritabanı sorgusu yapmadan kullanıcı adını (Ad Soyad) doğrudan oturumdan çekip kullanabilir.

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

### Koleksiyon: `users`

Kullanıcı bilgilerini ve yetkilerini tutar.

| Alan | Tip | Açıklama |
| :--- | :--- | :--- |
| `_id` | ObjectId | Benzersiz kimlik |
| `email` | String | Kullanıcı e-postası (Giriş anahtarı) |
| `password` | String | Kullanıcı şifresi (Hashlenmiş) |
| `name` | String | Ad Soyad |
| `role` | String | Rol (`admin`, `user`) |
| `apps` | Array<String> | Erişim izni olan uygulamalar (örn. `['dispo', 'circa', 'silo']`) |
| `createdAt` | Date | Oluşturulma tarihi |

## 🔌 API Referansı

Tüm API uç noktalarında gelen istek gövdeleri (request body) **Zod** şemaları aracılığıyla doğrulanır. Hatalı biçimlendirilmiş veriler `400 Bad Request` yanıtı ile geri çevrilir.

### Auth

- **POST** `/api/auth/login`: Kullanıcı girişi. Zod şeması ile `email` ve `password` doğrulanır. Şifre `bcrypt` ile kontrol edilerek eşleşirse signed `interapp_session` çerezini set eder. Eski plain-text şifreler giriş anında otomatik olarak Bcrypt hash formatına migre edilir.
- **POST** `/api/auth/logout`: Çıkış yapar. `interapp_session` çerezini temizler.
- **GET** `/api/auth/me`: Mevcut oturumu doğrular. Cookie içerisindeki JWT doğrulanır ve kullanıcı bilgileri (`id`, `email`, `role`, `apps`, `name`) döndürülür. Alt domainlerden (`*.wildtype.app`) gelen isteklere CORS desteği sunar.

### Admin

Tüm admin API'ları `/api/admin/*` JWT rol doğrulaması ile korunur (`RequireAdmin` sunucu taraflı koruma).

- **GET** `/api/admin/users`: Tüm kullanıcıları listeler.
- **POST** `/api/admin/users`: Yeni kullanıcı oluşturur. Zod doğrulaması ile kullanıcı bilgileri alınır ve şifre `bcrypt` ile hash'lenerek kaydedilir.
- **PUT** `/api/admin/users`: Kullanıcı yetkilerini ve bilgilerini (`email`, `name`, `role`, `apps`) günceller. Zod şeması ile gelen parametrelerin doğruluğu teyit edilir.
- **DELETE** `/api/admin/users`: Kullanıcı siler.

## 🔐 Güvenlik Önlemleri

- **Bcrypt Şifreleme:** Düz metin (plain-text) şifre saklama tamamen kaldırılmış, tüm kullanıcı şifreleri `bcrypt` hashing standartlarına yükseltilmiştir.
- **HttpOnly & Secure Cookies:** SSO çerezi (`interapp_session`) JS tarafından okunamaz niteliktedir. Ortak domain (`.wildtype.app`) üzerinden secure ve SameSite=Lax parametreleriyle iletilir.
- **CORS Politikaları:** API, sadece izin verilen originlerden gelen istekleri ve CORS isteklerini kabul eder.
- **Real-Time Guard Kontrolleri:** Ön yüzdeki yetkilendirme katmanı (`RequireAuth` / `RequireAdmin`), manipüle edilebilir localStorage değerleri yerine doğrudan `/api/auth/me` üzerinden sunucudan dinamik doğrulama alarak çalışır.
- **Bypass Koruması:** Localhost dışında Bearer token bypass veya test amaçlı arka kapılar production ortamında tamamen kapatılmıştır.
