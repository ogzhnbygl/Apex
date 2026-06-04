# Apex - Merkezi Yönetim ve Yetkilendirme Sistemi

Apex, organizasyon içindeki birden fazla web uygulamasına (laboratuvar yönetim sistemleri vb.) tek bir noktadan erişim, kimlik doğrulama ve yetkilendirme hizmeti sağlayan merkezi bir yönetim panelidir. Ekosistemin "Core" (Çekirdek) bileşeni olarak görev yapar.

## 🚀 Özellikler

- **Merkezi Kimlik Doğrulama (SSO & JWT):**
    - `wildtype.app` ana domaini üzerinde çalışan güvenli oturum yönetimi.
    - Alt uygulamalar (örn. `dispo.wildtype.app`, `circa.wildtype.app`) ile paylaşılan `interapp_session` HttpOnly ve secure JWT çerez tabanlı oturum.
    - Tüm isteklerde geçerli oturumun real-time sunucu kontrolü ile doğrulanması.
    - CORS ve domain güvenliği ile korunan yetkilendirme API'ları.
- **Kullanıcı ve Rol Yönetimi:**
    - **Admin Paneli:** Kullanıcı oluşturma, düzenleme, yetki atama ve silme işlemleri.
    - **Esnek Yetkilendirme:** Kullanıcılara özel uygulama bazlı erişim izinleri (örn. Sadece "Dispo" modülüne erişim).
    - Standart "User" ve tam yetkili "Admin" rolleri.
- **Güvenlik ve Veri Bütünlüğü (Faz 1 & Faz 2):**
    - **Bcrypt Şifreleme:** Düz metin şifre saklama tamamen kaldırılmış, tüm şifreler Bcrypt hash yapısına dönüştürülmüştür.
    - **Zod Giriş Doğrulaması:** Tüm API'lara gelen istek verileri Zod şemaları ile doğrulanarak geçersiz ve zararlı payload'lar engellenir.
    - **Real-time Auth Guards:** Ön yüzdeki `RequireAuth` ve `RequireAdmin` koruyucuları `/api/auth/me` üzerinden canlı oturum doğrulaması yapar.
    - **Geliştirme Bypass Engellemesi:** Prod ortamında tüm Bearer bypass/arka kapı erişimleri engellenmiştir.

## 🛠️ Teknolojiler

Apex, modern web standartlarına uygun olarak geliştirilmiştir:

### Frontend
- **Framework:** [React](https://react.dev/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Icons:** [Lucide React](https://lucide.dev/)

### Backend
- **Runtime:** [Vercel Serverless Functions](https://vercel.com/docs/functions)
- **Database:** [MongoDB](https://www.mongodb.com/)

## 📦 Kurulum

Projeyi geliştirmek veya kendi ortamınızda çalıştırmak için:

### Ön Gereksinimler
- Node.js (v18+)
- MongoDB veritabanı

### Adımlar

1. **Repoyu klonlayın:**
   ```bash
   git clone <repo-url>
   cd Apex
   ```

2. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   ```

3. **Çevresel Değişkenler:**
   `.env` dosyasını oluşturun ve gerekli değişkenleri tanımlayın:
   ```env
   MONGODB_URI=mongodb+srv://...
   ```

4. **Geliştirme Sunucusunu Başlatın:**
   API fonksiyonlarının da çalışması için Vercel CLI kullanılması önerilir:
   ```bash
   npx vercel dev
   ```
   *Alternatif (Sadece Frontend):* `npm run dev`

## 📂 Proje Yapısı

- `/src`: React frontend kodları (Sayfalar, Bileşenler).
- `/api`: Serverless backend fonksiyonları (Auth, Admin).
- `/public`: Statik dosyalar.

Detaylı teknik bilgi için [TECHNICAL.md](./TECHNICAL.md) dosyasına bakabilirsiniz.

## 📜 Lisans

Bu proje özel mülkiyettir. İzinsiz kopyalanması ve dağıtılması yasaktır.
