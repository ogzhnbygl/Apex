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
    silo: 'http://localhost:4175'
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

test.describe('Wildtype Uçtan Uca (E2E) Tarayıcı Testleri', () => {
    test('1. Apex: Gerçek form ile giriş ve standart kullanıcı için /admin koruması', async ({ page, request }) => {
        const adminCookieHeader = `interapp_session_test=${makeSessionCookie('oguzhan.baygul@medeniyet.edu.tr', 'admin').value}`;
        const tempEmail = `e2e.login.${Date.now()}@medeniyet.edu.tr`;
        const tempPassword = 'E2eLoginPass123!';

        // Create temporary standard user in Apex_test_db via API
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
            await page.goto(`${URLS.apex}/login`);
            await expect(page.getByRole('heading', { name: 'Tekrar Hoşgeldiniz' })).toBeVisible();

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
        } finally {
            await request.delete(`${URLS.apex}/api/admin/users?email=${encodeURIComponent(tempEmail)}`, {
                headers: { Cookie: adminCookieHeader }
            });
        }
    });

    test('2. Circa: Mobil navigasyon geçişi ve Raporlar gerçek efor / CSV butonu', async ({ context, page }) => {
        await context.addCookies([makeSessionCookie('oguzhan.baygul@medeniyet.edu.tr', 'admin')]);

        // Set mobile viewport (iPhone 13 width) to verify mobile nav bar
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(URLS.circa);

        const mobileNav = page.getByRole('navigation', { name: 'Mobil Menü' });
        await expect(mobileNav).toBeVisible();

        await mobileNav.getByRole('link', { name: 'Raporlar' }).click();
        await expect(page).toHaveURL(`${URLS.circa}/reports`);
        await expect(page.getByText('Toplam Efor')).toBeVisible();
        await expect(page.getByRole('button', { name: /Excel İndir/i })).toBeVisible();
    });

    test('3. Dispo: Kayıt listesi semantik arama kutusu ve Dashboard görünümü', async ({ context, page }) => {
        await context.addCookies([makeSessionCookie('oguzhan.baygul@medeniyet.edu.tr', 'admin')]);

        await page.goto(URLS.dispo);
        await expect(page.getByText(/Kayıt Listesi/)).toBeVisible();

        const searchInput = page.locator('#dispo-record-search');
        await expect(searchInput).toBeVisible();
        await searchInput.fill('OLMAYAN_TEST_KODU_99999');
        await expect(page.getByText('Kayıt Listesi (0)')).toBeVisible();

        await searchInput.fill('');
        await page.getByRole('link', { name: 'Dashboard' }).click();
        await expect(page).toHaveURL(`${URLS.dispo}/dashboard`);
        await expect(page.getByText('Bu Yıl Sürüden Çıkan')).toBeVisible();
    });

    test('4. LabProject: Tarih doğrulama, kullanılan kota düzenleme ve /edit/:id F5 yenileme', async ({ context, page, request }) => {
        const cookie = makeSessionCookie('kubra.celik@medeniyet.edu.tr', 'user');
        await context.addCookies([cookie]);

        await page.goto(`${URLS.labproject}/new`);
        await expect(page.getByRole('heading', { name: 'Yeni Proje Tanımla' })).toBeVisible();

        const uniqueCode = `E2E/${Date.now()}`;
        await page.locator('#project-title').fill('E2E Otomatik Test Projesi');
        await page.locator('#project-pi').fill('Prof. Dr. E2E Test');
        await page.locator('#project-code').fill(uniqueCode);

        // Inverted ethics dates must trigger accessible client-side alert
        await page.locator('#ethics-start-date').fill('2026-10-15');
        await page.locator('#ethics-end-date').fill('2026-03-01');
        await page.locator('#ethics-end-date').blur();
        await expect(page.getByRole('alert')).toContainText('Etik bitiş tarihi, etik başlangıç tarihinden önce olamaz.');

        // Fix ethics end date & set quota + used count
        await page.locator('#ethics-end-date').fill('2027-10-15');
        await page.locator('#quota-count-0').fill('25');
        await page.locator('#quota-used-0').fill('7');
        await page.getByRole('button', { name: 'Projeyi Kaydet' }).click();

        await expect(page).toHaveURL(`${URLS.labproject}/`);
        await expect(page.getByText('E2E Otomatik Test Projesi')).toBeVisible();

        // Click project to open /edit/:id
        await page.getByText('E2E Otomatik Test Projesi').first().click();
        await expect(page).toHaveURL(/\/edit\/[a-f0-9]{24}$/);
        const editUrl = page.url();
        const projectId = editUrl.split('/edit/')[1];

        try {
            // Reload page (F5) and verify data persists from URL param!
            await page.reload();
            await expect(page.getByRole('heading', { name: 'Projeyi Düzenle' })).toBeVisible();
            await expect(page.locator('#project-title')).toHaveValue('E2E Otomatik Test Projesi');
            await expect(page.locator('#quota-used-0')).toHaveValue('7');
        } finally {
            await request.delete(`${URLS.labproject}/api/projects?id=${projectId}`, {
                headers: { Cookie: `interapp_session_test=${cookie.value}` }
            });
        }
    });

    test('5. Silo: Yem stok kartları ve haftalık tüketim ürün filtresi', async ({ context, page }) => {
        await context.addCookies([makeSessionCookie('oguzhan.baygul@medeniyet.edu.tr', 'admin')]);

        await page.goto(URLS.silo);
        await expect(page.getByText('Haftalık Yem Tüketimi')).toBeVisible();

        const filterGroup = page.getByRole('group', { name: 'Yem türüne göre filtrele' });
        const a03Btn = filterGroup.getByRole('button', { name: 'SAFE® A03' });
        await a03Btn.click();
        await expect(a03Btn).toHaveAttribute('aria-pressed', 'true');
    });
});
