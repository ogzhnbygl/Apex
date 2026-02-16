# Apex - Merkezi Yönetim ve Yetkilendirme Sistemi

Apex, organizasyon içindeki birden fazla web uygulamasına (laboratuvar yönetim sistemleri vb.) tek bir noktadan erişim, kimlik doğrulama ve yetkilendirme hizmeti sağlayan merkezi bir yönetim panelidir. Ekosistemin "Core" (Çekirdek) bileşeni olarak görev yapar.

## 🚀 Özellikler

- **Merkezi Kimlik Doğrulama (SSO Benzeri Yapı):**
    - `wildtype.app` ana domaini üzerinde çalışan güvenli oturum yönetimi.
    - Alt uygulamalar (örn. `dispo.wildtype.app`, `circa.wildtype.app`) ile paylaşılan HttpOnly cookie tabanlı oturum.
    - CORS ve domain güvenliği ile korunan yetkilendirme API'sı.
- **Modüler Uygulama Yönetimi:**
    - Kullanıcıların yetkilerine göre erişebilecekleri uygulamaları listeleyen Dashboard.
    - Yeni uygulamaların ve modüllerin kolayca sisteme entegre edilebilmesi.
- **Kullanıcı ve Rol Yönetimi:**
    - **Admin Paneli:** Kullanıcı oluşturma, düzenleme ve silme işlemleri.
    - **Esnek Yetkilendirme:** Kullanıcılara özel uygulama bazlı erişim izinleri (örn. Sadece "Dispo" modülüne erişim).
    - Standart "User" ve tam yetkili "Admin" rolleri.
- **Modern ve Güvenli Altyapı:**
    - Güçlü şifreleme ve güvenlik standartlarına uygun mimari.
    - Vercel üzerinde yüksek performanslı, sunucusuz (serverless) çalışma.

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
