# Apex - Merkezi Yönetim ve Yetkilendirme Sistemi

Apex, organizasyon içindeki birden fazla web uygulamasına (laboratuvar yönetim sistemleri vb.) tek bir noktadan erişim, kimlik doğrulama ve yetkilendirme hizmeti sağlayan merkezi bir yönetim panelidir.

## 🚀 Özellikler

- **Merkezi Kimlik Doğrulama (SSO Benzeri Yapı):**
    - `wildtype.app` ana domaini üzerinde çalışan güvenli oturum yönetimi.
    - Alt uygulamalar (örn. `dispo.wildtype.app`) ile paylaşılan HttpOnly cookie tabanlı oturum.
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
    - Vercel üzerinde yüksek performanslı çalışma.

## 🛠️ Teknolojiler

Apex, modern web standartlarına uygun olarak geliştirilmiştir:

- **Frontend:**
    - [React](https://react.dev/) - Arayüz geliştirme
    - [Vite](https://vitejs.dev/) - Yüksek performanslı build aracı
    - [Tailwind CSS](https://tailwindcss.com/) - Hızlı ve modern stillendirme
    - [Lucide React](https://lucide.dev/) - Modern ikon seti
- **Backend:**
    - [Vercel Serverless Functions](https://vercel.com/docs/functions) - Ölçeklenebilir API mimarisi
- **Veritabanı:**
    - [MongoDB](https://www.mongodb.com/) - Esnek ve güçlü NoSQL veritabanı

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
   `.env` dosyasını oluşturun:
   ```env
   MONGODB_URI=mongodb+srv://...
   ```

4. **Geliştirme Sunucusunu Başlatın:**
   API fonksiyonlarının da çalışması için Vercel CLI kullanılması önerilir:
   ```bash
   npx vercel dev
   ```
   Normal frontend geliştirme için:
   ```bash
   npm run dev
   ```

## 📂 Proje Yapısı

- `/src`: React frontend kodları (Sayfalar, Bileşenler).
- `/api`: Serverless backend fonksiyonları (Auth, Admin).
- `/public`: Statik dosyalar.

Detaylı teknik bilgi için [TECHNICAL.md](./technical.md) dosyasına bakabilirsiniz.
