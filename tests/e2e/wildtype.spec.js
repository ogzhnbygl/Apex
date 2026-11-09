import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APEX_DIR = path.resolve(__dirname, '../..');

// Ensure JWT_SECRET is loaded for test cookie signing & temporary user setup
if (!process.env.JWT_SECRET) {
    const envPath = path.join(APEX_DIR, '.env');
    if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
            const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
            if (m && !process.env[m[1]]) {
                process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
            }
        }
    }
}

process.env.VERCEL_ENV = 'preview';
delete process.env.FORCE_PROD_DB;

const URLS = {
    apex: 'http://localhost:4171',
    circa: 'http://localhost:4172',
    dispo: 'http://localhost:4173',
    labproject: 'http://localhost:4174',
    silo: 'http://localhost:4175',
    pulsus: 'http://localhost:4176'
};

function makeSessionCookie(email, role = 'admin') {
    const token = jwt.sign({ email, role }, process.env.JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '1h'
    });
    return {
        name: 'interapp_session_test',
        value: token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax'
    };
}

test.describe('Wildtype Uçtan Uca (E2E) Tarayıcı & Dosya İndirme Testleri', () => {

    test('1. Apex: Giriş hata mesajı, standart kullanıcı kısıtları, çıkış yap ve admin self-delete engeli', async ({ page, request, context }) => {
        const adminCookieHeader = `interapp_session_test=${makeSessionCookie('oguzhan.baygul@medeniyet.edu.tr', 'admin').value}`;
        const tempEmail = `e2e.login.${Date.now()}@medeniyet.edu.tr`;
        const tempPassword = 'E2eLoginPass123!';

        // 1. Wrong credentials check
        await page.goto(`${URLS.apex}/login`);
        await page.locator('#email').fill('yanlis.kullanici@medeniyet.edu.tr');
        await page.locator('#password').fill('YanlisSifre999!');
        await page.getByRole('button', { name: 'Giriş Yap' }).click();
        await expect(page.locator('.text-red-600')).toBeVisible();

        // 2. Create temporary standard user in Apex_test_db via API
        const createRes = await request.post(`${URLS.apex}/api/admin/users`, {
            headers: { Cookie: adminCookieHeader },
            data: {
                name: 'E2E Standart Kullanıcı',
                email: tempEmail,
                password: tempPassword,
                role: 'user',
                apps: ['circa', 'silo']
            }
        });
        expect(createRes.status()).toBe(201);

        try {
            // 3. Valid Login
            await page.locator('#email').fill(tempEmail);
            await page.locator('#password').fill(tempPassword);
            await page.getByRole('button', { name: 'Giriş Yap' }).click();

            // Redirected to Dashboard, sees Circa & Silo, does NOT see Yönetici link
            await expect(page.getByRole('heading', { name: 'Panel' })).toBeVisible();
            await expect(page.getByText('Circa')).toBeVisible();
            await expect(page.getByText('Silo')).toBeVisible();
            await expect(page.getByRole('link', { name: 'Yönetici' })).toHaveCount(0);

            // Direct navigation to /admin redirects non-admin back to /
            await page.goto(`${URLS.apex}/admin`);
            await expect(page).toHaveURL(`${URLS.apex}/`);

            // 4. Logout button clears session and redirects to /login
            await page.getByTitle('Çıkış Yap').click();
            await expect(page).toHaveURL(`${URLS.apex}/login`);

            // 5. Admin user visits /admin and verifies self-delete button is disabled
            await context.addCookies([makeSessionCookie('oguzhan.baygul@medeniyet.edu.tr', 'admin')]);
            await page.goto(`${URLS.apex}/admin`);
            await expect(page.getByRole('heading', { name: 'Kullanıcı Yönetimi' })).toBeVisible();

            const searchInput = page.getByPlaceholder('Ad soyad veya e-posta ile kullanıcı ara...');
            await expect(searchInput).toBeVisible();

            const selfDeleteBtn = page.getByTitle('Kendi hesabınızı silemezsiniz');
            await expect(selfDeleteBtn).toBeVisible();
            await expect(selfDeleteBtn).toBeDisabled();

        } finally {
            await request.delete(`${URLS.apex}/api/admin/users?email=${encodeURIComponent(tempEmail)}`, {
                headers: { Cookie: adminCookieHeader }
            });
        }
    });

    test('2. Circa: Gerçek form ile mesai ekleme, silme, mobil navigasyon & CSV rapor indirme', async ({ context, page }) => {
        await context.addCookies([makeSessionCookie('oguzhan.baygul@medeniyet.edu.tr', 'admin')]);

        // Auto-accept confirmation dialogs
        page.on('dialog', (dialog) => dialog.accept());

        // 1. Mobile viewport test
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(URLS.circa);
        const mobileNav = page.getByRole('navigation', { name: 'Mobil Menü' });
        await expect(mobileNav).toBeVisible();

        // 2. Return to desktop viewport
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(URLS.circa);

        // 3. Fill and submit AddShiftForm
        const testDescription = `E2E Mesai Kaydı ${Date.now()}`;
        const formDesc = page.getByPlaceholder('Bugün neler yaptınız?');
        await formDesc.fill(testDescription);
        await page.getByRole('button', { name: 'Hafta Sonu' }).click();
        await page.getByRole('button', { name: /Kaydet/i }).click();

        // Verify shift appears in recent movements
        const shiftHeading = page.getByRole('heading', { name: testDescription, level: 3 });
        await expect(shiftHeading).toBeVisible();

        // 4. Delete the shift
        const shiftRow = page.locator('.group', { has: shiftHeading });
        const deleteBtn = shiftRow.getByRole('button', { name: 'Mesai kaydını sil' });
        await deleteBtn.click();
        await expect(shiftHeading).toHaveCount(0);

        // 5. Navigate to /reports and trigger real CSV file download
        await page.goto(`${URLS.circa}/reports`);
        await expect(page.getByText('Toplam Efor')).toBeVisible();

        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: /Excel İndir \(CSV\)/i }).click();
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toMatch(/^circa_mesai_raporu_\d{4}_\d{2}\.csv$/);
    });

    test('3. Dispo: Gerçek hayvan kaydı girişi, arama, satır silme, Dashboard & JSON indirme', async ({ context, page }) => {
        await context.addCookies([makeSessionCookie('oguzhan.baygul@medeniyet.edu.tr', 'admin')]);

        // Auto-accept confirmation dialogs
        page.on('dialog', (dialog) => dialog.accept());

        await page.goto(URLS.dispo);
        await expect(page.getByText(/Kayıt Listesi/)).toBeVisible();

        // 1. Fill EntryForm to add an animal disposal record
        await page.locator('select[name="species"]').selectOption('Fare');
        await page.locator('select[name="sex"]').selectOption('Erkek');
        await page.locator('input[name="count"]').fill('3');
        await page.locator('input[name="dob"]').fill('2025-06-01');
        await page.locator('select[name="reason"]').selectOption('COL-01');
        await page.getByRole('button', { name: 'Kaydet' }).click();

        // 2. Search box test
        const searchInput = page.locator('#dispo-record-search');
        await expect(searchInput).toBeVisible();
        await searchInput.fill('COL-01');

        const table = page.locator('table');
        await expect(table.getByText('Damızlık Dışı').first()).toBeVisible();

        // 3. Delete the newly added animal row
        const row = table.locator('tr', { hasText: 'Damızlık Dışı' }).first();
        const rowDeleteBtn = row.locator('button');
        await rowDeleteBtn.click({ force: true });

        // 4. Dashboard navigation
        await searchInput.fill('');
        await page.getByRole('link', { name: 'Dashboard' }).click();
        await expect(page).toHaveURL(`${URLS.dispo}/dashboard`);
        await expect(page.getByText('Bu Yıl Sürüden Çıkan')).toBeVisible();

        // 5. Open DataTransfer modal & trigger real JSON export download
        await page.goto(URLS.dispo);
        await page.getByRole('button', { name: /Veri İçe\/Dışa Aktar/i }).click();
        await page.getByRole('button', { name: 'Dışa Aktar (Export)' }).click();

        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'JSON İndir' }).click();
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toMatch(/^lab_colony_export_.*\.json$/);
    });

    test('4. LabProject: Tarih doğrulama uyarısı, kullanılan kota, /edit/:id F5 yenileme & güncel takvim', async ({ context, page, request }) => {
        const cookie = makeSessionCookie('kubra.celik@medeniyet.edu.tr', 'user');
        await context.addCookies([cookie]);

        // 1. Inverted ethics dates client-side alert
        await page.goto(`${URLS.labproject}/new`);
        await expect(page.getByRole('heading', { name: 'Yeni Proje Tanımla' })).toBeVisible();

        const uniqueCode = `E2E/${Date.now()}`;
        await page.locator('#project-title').fill('E2E Otomatik Test Projesi');
        await page.locator('#project-pi').fill('Prof. Dr. E2E Test');
        await page.locator('#project-code').fill(uniqueCode);

        await page.locator('#ethics-start-date').fill('2026-10-15');
        await page.locator('#ethics-end-date').fill('2026-03-01');
        await page.locator('#ethics-end-date').blur();
        await expect(page.getByRole('alert')).toContainText('Etik bitiş tarihi, etik başlangıç tarihinden önce olamaz.');

        // 2. Fix dates & enter quota + used count
        await page.locator('#ethics-end-date').fill('2027-10-15');
        await page.locator('#quota-count-0').fill('25');
        await page.locator('#quota-used-0').fill('7');
        await page.getByRole('button', { name: 'Projeyi Kaydet' }).click();

        await expect(page).toHaveURL(`${URLS.labproject}/`);
        await expect(page.getByText('E2E Otomatik Test Projesi')).toBeVisible();

        // 3. Open /edit/:id and verify reload (F5) persistence
        await page.getByText('E2E Otomatik Test Projesi').first().click();
        await expect(page).toHaveURL(/\/edit\/[a-f0-9]{24}$/);
        const editUrl = page.url();
        const projectId = editUrl.split('/edit/')[1];

        try {
            await page.reload();
            await expect(page.getByRole('heading', { name: 'Projeyi Düzenle' })).toBeVisible();
            await expect(page.locator('#project-title')).toHaveValue('E2E Otomatik Test Projesi');
            await expect(page.locator('#quota-used-0')).toHaveValue('7');

            // 4. Project Calendar opens on current year (not 2026)
            await page.goto(`${URLS.labproject}/timeline`);
            await expect(page.getByRole('heading', { name: 'Proje Zaman Çizelgesi' })).toBeVisible();
            const curYear = String(new Date().getFullYear());
            await expect(page.locator('select').nth(1)).toHaveValue(curYear);

        } finally {
            await request.delete(`${URLS.labproject}/api/projects?id=${projectId}`, {
                headers: { Cookie: `interapp_session_test=${cookie.value}` }
            });
        }
    });

    test('5. Silo: Yem filtresi, canlı kg hesabı, yetersiz stok uyarısı & PDF raporu indirme', async ({ context, page }) => {
        await context.addCookies([makeSessionCookie('oguzhan.baygul@medeniyet.edu.tr', 'admin')]);

        await page.goto(URLS.silo);
        await expect(page.getByText('Haftalık Yem Tüketimi')).toBeVisible();

        // 1. Filter button aria-pressed check
        const filterGroup = page.getByRole('group', { name: 'Yem türüne göre filtrele' });
        const a03Btn = filterGroup.getByRole('button', { name: 'SAFE® A03' });
        await a03Btn.click();
        await expect(a03Btn).toHaveAttribute('aria-pressed', 'true');

        // 2. Open "Teslimat Al" modal and verify live weight calculation
        await page.getByRole('button', { name: 'Teslimat Al' }).click();
        const amountInput = page.locator('dialog input[name="amount"]');
        await expect(amountInput).toBeVisible();
        await amountInput.fill('2');
        await expect(page.locator('dialog')).toContainText('20 kg');

        // Close modal
        await page.locator('dialog button[aria-label="Pencereyi kapat"]').click();

        // 3. Open "Paket Çıkışı" modal, input excessive amount and verify client-side insufficient stock error
        await page.getByRole('button', { name: 'Paket Çıkışı' }).click();
        const outAmountInput = page.locator('dialog input[name="amount"]');
        await expect(outAmountInput).toBeVisible();
        await outAmountInput.fill('99999');
        await page.getByRole('button', { name: 'Çıkışı Onayla' }).click();
        await expect(page.locator('dialog')).toContainText('yeterli stok yok');

        // Close modal
        await page.locator('dialog button[aria-label="Pencereyi kapat"]').click();

        // 4. Trigger real PDF report download
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'PDF Raporu Al' }).click();
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toMatch(/^silo-yem-tuketim-raporu-.*\.pdf$/);
    });

    test('6. Pulsus: Nabız birleşik pano, Ritus şablon planlayıcı, Sequa panosu ve CSV/JSON rapor indirme', async ({ context, page }) => {
        await context.addCookies([makeSessionCookie('oguzhan.baygul@medeniyet.edu.tr', 'admin')]);

        // 1. Open Pulsus Unified Dashboard (Nabız)
        await page.goto(URLS.pulsus);
        await expect(page.getByText(/Ritus — Haftalık Rutin Görevlerim/)).toBeVisible();
        await expect(page.getByText(/Sequa — Kişi Bazlı Görev/)).toBeVisible();

        // 2. Navigate to Ritus Board & open Template Planner
        await page.locator('nav').getByRole('link', { name: /Ritus/ }).click();
        await expect(page.getByText('Periyodik Laboratuvar Rutinleri ve Denetim Akışı')).toBeVisible();
        await page.getByRole('button', { name: /Rutin Şablon Planlayıcı/ }).click();
        await expect(page.getByRole('button', { name: 'Yeni Rutin Şablonu' })).toBeVisible();

        // 3. Navigate to Sequa Board
        await page.locator('nav').getByRole('link', { name: /Sequa/ }).click();
        await expect(page.getByText('Rutin Olmayan İşler, Hekim Muayene Talepleri ve Arıza Yönetimi')).toBeVisible();

        // 4. Navigate to Reports & Team and verify CSV download
        await page.locator('nav').getByRole('link', { name: /Raporlar & Ekip/ }).click();
        await expect(page.getByText('Laboratuvar Ekibi, Canlı Circa İzin Durumu ve Performans Matrisi')).toBeVisible();

        const csvDownloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'CSV İndir' }).click();
        const csvDownload = await csvDownloadPromise;
        expect(csvDownload.suggestedFilename()).toMatch(/^pulsus-personel-performans-.*\.csv$/);
    });
});
