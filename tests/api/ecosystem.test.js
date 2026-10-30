import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

// Load Apex/.env if env vars are not already injected (e.g. local run vs GitHub Actions)
const envPath = path.join(ROOT_DIR, 'Apex/.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m && !process.env[m[1]]) {
            process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
        }
    }
}

// HARD SAFETY LOCK: Force isolated *_test_db and interapp_session_test cookie
process.env.VERCEL_ENV = 'preview';
delete process.env.FORCE_PROD_DB;

const apexMongo = await import(path.join(ROOT_DIR, 'Apex/api/lib/mongodb.js'));
assert.equal(apexMongo.isProdEnv(), false, 'SAFETY ABORT: Tests must never run against production DB!');
assert.equal(apexMongo.getDbName('Apex_db'), 'Apex_test_db');
assert.equal(apexMongo.getSessionCookieName(), 'interapp_session_test');

// Import handlers & auth utilities across all 6 modules
const { verifyToken, verifyAuthWithStatus } = await import(path.join(ROOT_DIR, 'Dispo/lib/auth.js'));
const loginHandler = (await import(path.join(ROOT_DIR, 'Apex/api/auth/login.js'))).default;
const registerHandler = (await import(path.join(ROOT_DIR, 'Apex/api/auth/register.js'))).default;
const logoutHandler = (await import(path.join(ROOT_DIR, 'Apex/api/auth/logout.js'))).default;
const meHandler = (await import(path.join(ROOT_DIR, 'Apex/api/auth/me.js'))).default;
const adminUsersHandler = (await import(path.join(ROOT_DIR, 'Apex/api/admin/users.js'))).default;

const circaShiftsHandler = (await import(path.join(ROOT_DIR, 'Circa/api/shifts/index.js'))).default;
const circaProcessHandler = (await import(path.join(ROOT_DIR, 'Circa/api/shifts/process.js'))).default;
const circaStatusHandler = (await import(path.join(ROOT_DIR, 'Circa/api/shifts/status.js'))).default;
const circaLeavesHandler = (await import(path.join(ROOT_DIR, 'Circa/api/leaves/index.js'))).default;
const circaApproveHandler = (await import(path.join(ROOT_DIR, 'Circa/api/leaves/approve.js'))).default;
const circaBalanceHandler = (await import(path.join(ROOT_DIR, 'Circa/api/leaves/balance.js'))).default;

const dispoAnimalsHandler = (await import(path.join(ROOT_DIR, 'Dispo/api/animals.js'))).default;
const dispoProjectSearchHandler = (await import(path.join(ROOT_DIR, 'Dispo/api/projects-search.js'))).default;
const dispoProjectDetailsHandler = (await import(path.join(ROOT_DIR, 'Dispo/api/project-details.js'))).default;
const dispoDashboardStatsHandler = (await import(path.join(ROOT_DIR, 'Dispo/api/dashboard-stats.js'))).default;
const dispoSessionHandler = (await import(path.join(ROOT_DIR, 'Dispo/api/auth/session.js'))).default;

const labProjectsHandler = (await import(path.join(ROOT_DIR, 'LabProject/api/projects.js'))).default;
const labCalendarHandler = (await import(path.join(ROOT_DIR, 'LabProject/api/calendar.js'))).default;

const locusRoomsHandler = (await import(path.join(ROOT_DIR, 'Locus/api/rooms.js'))).default;
const locusRacksHandler = (await import(path.join(ROOT_DIR, 'Locus/api/racks.js'))).default;
const locusCagesHandler = (await import(path.join(ROOT_DIR, 'Locus/api/cages.js'))).default;
const locusAnimalsHandler = (await import(path.join(ROOT_DIR, 'Locus/api/animals.js'))).default;
const locusProjectsSearchHandler = (await import(path.join(ROOT_DIR, 'Locus/api/projects-search.js'))).default;

const siloInventoryHandler = (await import(path.join(ROOT_DIR, 'Silo/api/inventory.js'))).default;

function mockRes() {
    return {
        statusCode: 200,
        headers: {},
        body: null,
        setHeader(k, v) { this.headers[k] = v; return this; },
        status(c) { this.statusCode = c; return this; },
        json(b) { this.body = b; return this; },
        send(b) { this.body = b; return this; },
        end(b) { if (b !== undefined) this.body = b; return this; }
    };
}

function signSession(email, role = 'user') {
    const token = jwt.sign({ email, role }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    return `interapp_session_test=${token}`;
}

const adminCookie = signSession('oguzhan.baygul@medeniyet.edu.tr', 'admin');
const kubraCookie = signSession('kubra.celik@medeniyet.edu.tr', 'user');
const gokhanCookie = signSession('gokhan.sert@medeniyet.edu.tr', 'user');

describe('1. Sistem Geneli SSO, JWT, CORS & Cookie Güvenliği', () => {
    it('HS256 imzalı geçerli JWT doğrulanır; alg:none, bozuk imza ve süresi dolmuş token reddedilir', () => {
        const valid = jwt.sign({ email: 'oguzhan.baygul@medeniyet.edu.tr' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
        assert.equal(verifyToken(valid)?.email, 'oguzhan.baygul@medeniyet.edu.tr');

        const tampered = valid.slice(0, -2) + (valid.endsWith('aa') ? 'bb' : 'aa');
        assert.equal(verifyToken(tampered), null);

        const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
        assert.equal(verifyToken(`${noneHeader}.${valid.split('.')[1]}.`), null);

        const expired = jwt.sign({ email: 'oguzhan.baygul@medeniyet.edu.tr' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: -10 });
        assert.equal(verifyToken(expired), null);
    });

    it('Oturumsuz istek 401, uygulama yetkisi olmayan oturum 403, yetkili oturum 200 döner', async () => {
        const unauth = await verifyAuthWithStatus({ headers: {} }, 'dispo');
        assert.equal(unauth.status, 401);

        // Gökhan has ['silo', 'circa'], NOT 'dispo'
        const forbidden = await verifyAuthWithStatus({ headers: { cookie: gokhanCookie } }, 'dispo');
        assert.equal(forbidden.status, 403);

        const allowed = await verifyAuthWithStatus({ headers: { cookie: gokhanCookie } }, 'silo');
        assert.equal(allowed.status, 200);
    });

    it('Spoke modüllerde DELETE /api/auth/session oturum çerezini temizler', async () => {
        const res = mockRes();
        await dispoSessionHandler({ method: 'DELETE', headers: { host: 'test-dispo.wildtype.app' } }, res);
        assert.equal(res.statusCode, 200);
        assert.match(String(res.headers['Set-Cookie']), /interapp_session_test=.*Max-Age=0/);
    });

    it('Apex CORS filtresi: Yetkili alt alan adlarına izin verir, saldırgan originleri engeller', async () => {
        // Trusted origins get reflected CORS headers
        const trustedOrigins = [
            'https://circa.wildtype.app',
            'https://test-silo.wildtype.app',
            'http://localhost:5173'
        ];
        for (const origin of trustedOrigins) {
            const res = mockRes();
            await meHandler({ method: 'OPTIONS', headers: { origin } }, res);
            assert.equal(res.statusCode, 200);
            assert.equal(res.headers['Access-Control-Allow-Origin'], origin);
            assert.equal(res.headers['Access-Control-Allow-Credentials'], 'true');
        }

        // Untrusted/malicious origins MUST NOT receive Access-Control-Allow-Origin
        const maliciousOrigins = [
            'https://evil-wildtype.app',
            'https://attacker.com',
            'https://wildtype.app.attacker.com',
            'https://notwildtype.app'
        ];
        for (const origin of maliciousOrigins) {
            const res = mockRes();
            await meHandler({ method: 'OPTIONS', headers: { origin } }, res);
            assert.equal(res.statusCode, 200);
            assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
        }
    });

    it('Apex Logout: GET 405 döner, POST oturum çerezini Max-Age=0 ile temizler', async () => {
        const getRes = mockRes();
        await logoutHandler({ method: 'GET', headers: {} }, getRes);
        assert.equal(getRes.statusCode, 405);

        const postRes = mockRes();
        await logoutHandler({ method: 'POST', headers: { host: 'test-apex.wildtype.app' } }, postRes);
        assert.equal(postRes.statusCode, 200);
        assert.match(String(postRes.headers['Set-Cookie']), /interapp_session_test=.*Max-Age=0/);
    });
});

describe('2. Apex (Merkezi Kimlik, Admin Paneli & Kullanıcı Yaşam Döngüsü)', () => {
    const tempEmail = `ci.lifecycle.${Date.now()}@medeniyet.edu.tr`;

    it('Herkese açık /api/auth/register 403 ile engellenir', async () => {
        const res = mockRes();
        await registerHandler({ method: 'POST', headers: {}, body: { email: tempEmail, password: 'password123' } }, res);
        assert.equal(res.statusCode, 403);
    });

    it('Login endpoint NoSQL operatör enjeksiyonunu ({ $ne: null }) 400 ile reddeder', async () => {
        const res = mockRes();
        await loginHandler({ method: 'POST', headers: {}, body: { email: { $ne: null }, password: { $ne: null } } }, res);
        assert.equal(res.statusCode, 400);
    });

    it('Login endpoint yanlış şifre ve var olmayan e-posta denemelerini 401 ile reddeder', async () => {
        const badPassRes = mockRes();
        await loginHandler({
            method: 'POST',
            headers: { host: 'localhost:5173' },
            body: { email: 'oguzhan.baygul@medeniyet.edu.tr', password: 'KesinlikleYanlisSifre999!' }
        }, badPassRes);
        assert.equal(badPassRes.statusCode, 401);

        const noUserRes = mockRes();
        await loginHandler({
            method: 'POST',
            headers: { host: 'localhost:5173' },
            body: { email: 'olmayan.kullanici@medeniyet.edu.tr', password: 'SomePassword123!' }
        }, noUserRes);
        assert.equal(noUserRes.statusCode, 401);
    });

    it('Standart kullanıcı Admin API çağrılarını yapamaz (403)', async () => {
        const getRes = mockRes();
        await adminUsersHandler({ method: 'GET', headers: { cookie: kubraCookie } }, getRes);
        assert.equal(getRes.statusCode, 403);

        const postRes = mockRes();
        await adminUsersHandler({
            method: 'POST',
            headers: { cookie: kubraCookie },
            body: { name: 'Hack', email: 'hack@test.com', password: 'Pass12345!', apps: ['circa'] }
        }, postRes);
        assert.equal(postRes.statusCode, 403);
    });

    it('Admin kendi hesabını silemez veya kendi admin yetkisini düşüremez (400)', async () => {
        const delRes = mockRes();
        await adminUsersHandler({
            method: 'DELETE',
            headers: { cookie: adminCookie },
            query: { email: 'oguzhan.baygul@medeniyet.edu.tr' }
        }, delRes);
        assert.equal(delRes.statusCode, 400);

        const putRes = mockRes();
        await adminUsersHandler({
            method: 'PUT',
            headers: { cookie: adminCookie },
            body: { email: 'oguzhan.baygul@medeniyet.edu.tr', role: 'user' }
        }, putRes);
        assert.equal(putRes.statusCode, 400);
    });

    it('Kullanıcı doğrulama: Kısa şifre (<6) ve geçersiz uygulama isimleri 400 ile reddedilir', async () => {
        const shortPassRes = mockRes();
        await adminUsersHandler({
            method: 'POST',
            headers: { cookie: adminCookie },
            body: { name: 'Kısa Şifre', email: `short.${Date.now()}@medeniyet.edu.tr`, password: '123', apps: ['circa'] }
        }, shortPassRes);
        assert.equal(shortPassRes.statusCode, 400);

        const badAppRes = mockRes();
        await adminUsersHandler({
            method: 'POST',
            headers: { cookie: adminCookie },
            body: { name: 'Geçersiz App', email: `badapp.${Date.now()}@medeniyet.edu.tr`, password: 'ValidPass123!', apps: ['gecersiz_app'] }
        }, badAppRes);
        assert.equal(badAppRes.statusCode, 400);
    });

    it('Kullanıcı Yaşam Döngüsü: Admin kullanıcı oluşturur, günceller, şifresini sıfırlar, giriş yapar ve siler', async () => {
        // 1. Create
        const createRes = mockRes();
        await adminUsersHandler({
            method: 'POST',
            headers: { cookie: adminCookie },
            body: {
                name: 'İlk İsim',
                email: tempEmail,
                password: 'InitialPass123!',
                role: 'user',
                apps: ['circa']
            }
        }, createRes);
        assert.equal(createRes.statusCode, 201);

        try {
            // Duplicate email must be rejected
            const dupRes = mockRes();
            await adminUsersHandler({
                method: 'POST',
                headers: { cookie: adminCookie },
                body: { name: 'Mükerrer', email: tempEmail, password: 'Pass12345!', apps: ['silo'] }
            }, dupRes);
            assert.ok(dupRes.statusCode === 400 || dupRes.statusCode === 409);

            // 2. Initial Login
            const login1Res = mockRes();
            await loginHandler({
                method: 'POST',
                headers: { host: 'localhost:5173' },
                body: { email: tempEmail, password: 'InitialPass123!' }
            }, login1Res);
            assert.equal(login1Res.statusCode, 200);
            assert.deepEqual(login1Res.body.user.apps, ['circa']);

            // 3. Admin updates name, apps, and resets password
            const putRes = mockRes();
            await adminUsersHandler({
                method: 'PUT',
                headers: { cookie: adminCookie },
                body: {
                    email: tempEmail,
                    name: 'Güncellenmiş İsim',
                    apps: ['circa', 'silo'],
                    password: 'NewStrongPass123!'
                }
            }, putRes);
            assert.equal(putRes.statusCode, 200);

            // 4. Old password must now fail
            const oldPassLoginRes = mockRes();
            await loginHandler({
                method: 'POST',
                headers: { host: 'localhost:5173' },
                body: { email: tempEmail, password: 'InitialPass123!' }
            }, oldPassLoginRes);
            assert.equal(oldPassLoginRes.statusCode, 401);

            // 5. New password succeeds and reflects updated apps
            const newPassLoginRes = mockRes();
            await loginHandler({
                method: 'POST',
                headers: { host: 'localhost:5173' },
                body: { email: tempEmail, password: 'NewStrongPass123!' }
            }, newPassLoginRes);
            assert.equal(newPassLoginRes.statusCode, 200);
            assert.equal(newPassLoginRes.body.user.name, 'Güncellenmiş İsim');
            assert.deepEqual(newPassLoginRes.body.user.apps, ['circa', 'silo']);
        } finally {
            // 6. Delete
            const deleteRes = mockRes();
            await adminUsersHandler({
                method: 'DELETE',
                headers: { cookie: adminCookie },
                query: { email: tempEmail }
            }, deleteRes);
            assert.equal(deleteRes.statusCode, 200);
        }
    });
});

describe('3. Circa (Mesai Çarpanı, Aylık Kilitleme, İzin Onay & Bakiye Yaşam Döngüsü)', () => {
    it('Mesai kaydı eklenir, başkasının silmesi 403 ile engellenir, sahibi 200 ile siler', async () => {
        const createRes = mockRes();
        await circaShiftsHandler({
            method: 'POST',
            headers: { cookie: kubraCookie },
            body: {
                date: '2099-10-15',
                shiftType: 'weekday',
                startTime: '17:30',
                endTime: '20:00',
                description: 'CI Otomatik Mesai Testi'
            }
        }, createRes);
        assert.equal(createRes.statusCode, 201);
        const shiftId = String(createRes.body._id);

        const forbiddenRes = mockRes();
        await circaShiftsHandler({
            method: 'DELETE',
            headers: { cookie: gokhanCookie },
            query: { id: shiftId }
        }, forbiddenRes);
        assert.equal(forbiddenRes.statusCode, 403);

        const deleteRes = mockRes();
        await circaShiftsHandler({
            method: 'DELETE',
            headers: { cookie: kubraCookie },
            query: { id: shiftId }
        }, deleteRes);
        assert.equal(deleteRes.statusCode, 200);
    });

    it('Hassas Mesai Çarpanı (1.7x & 3.0x), Aylık Bakiye İşleme & İşlenmiş Ay Silme Kilidi', async () => {
        const testPeriod = '2098-07';
        const circaMongo = await import(path.join(ROOT_DIR, 'Circa/lib/mongodb.js'));
        const client = await circaMongo.default;
        const db = client.db(circaMongo.getDbName('Circa_db'));

        // Safety pre-cleanup
        await db.collection('shifts').deleteMany({ date: { $regex: `^${testPeriod}` } });
        await db.collection('balances').deleteMany({ period: testPeriod });

        const insertedShiftIds = [];

        try {
            // 1. Shift 1: Wednesday (2098-07-02), Weekday -> 18:00 - 20:00 (2h x 1.7 = 3.4h)
            const s1 = mockRes();
            await circaShiftsHandler({
                method: 'POST',
                headers: { cookie: kubraCookie },
                body: { date: '2098-07-02', shiftType: 'weekday', startTime: '18:00', endTime: '20:00', description: 'Hafta içi 2s' }
            }, s1);
            assert.equal(s1.statusCode, 201);
            insertedShiftIds.push(String(s1.body._id));

            // 2. Shift 2: Saturday (2098-07-05), Weekend -> 10:00 - 12:00 (2h x 1.7 = 3.4h)
            const s2 = mockRes();
            await circaShiftsHandler({
                method: 'POST',
                headers: { cookie: kubraCookie },
                body: { date: '2098-07-05', shiftType: 'weekend', startTime: '10:00', endTime: '12:00', description: 'Cumartesi 2s' }
            }, s2);
            assert.equal(s2.statusCode, 201);
            insertedShiftIds.push(String(s2.body._id));

            // 3. Shift 3: Sunday (2098-07-06), Sunday -> 09:00 - 12:00 (3h x 3.0 = 9.0h)
            const s3 = mockRes();
            await circaShiftsHandler({
                method: 'POST',
                headers: { cookie: kubraCookie },
                body: { date: '2098-07-06', shiftType: 'weekend', startTime: '09:00', endTime: '12:00', description: 'Pazar 3s' }
            }, s3);
            assert.equal(s3.statusCode, 201);
            insertedShiftIds.push(String(s3.body._id));

            // 4. Shift 4: Holiday (2098-07-09), Holiday -> 13:00 - 15:00 (2h x 3.0 = 6.0h)
            const s4 = mockRes();
            await circaShiftsHandler({
                method: 'POST',
                headers: { cookie: kubraCookie },
                body: { date: '2098-07-09', shiftType: 'holiday', startTime: '13:00', endTime: '15:00', description: 'Resmi Tatil 2s' }
            }, s4);
            assert.equal(s4.statusCode, 201);
            insertedShiftIds.push(String(s4.body._id));

            // 5. Shift 5: Overnight (2098-07-10), 22:00 - 01:00 (3h x 1.7 = 5.1h)
            const s5 = mockRes();
            await circaShiftsHandler({
                method: 'POST',
                headers: { cookie: kubraCookie },
                body: { date: '2098-07-10', shiftType: 'weekday', startTime: '22:00', endTime: '01:00', description: 'Gece Vardiyası 3s' }
            }, s5);
            assert.equal(s5.statusCode, 201);
            insertedShiftIds.push(String(s5.body._id));

            // Non-admin calling process.js must receive 403
            const nonAdminProcessRes = mockRes();
            await circaProcessHandler({
                method: 'POST',
                headers: { cookie: kubraCookie },
                body: { month: 7, year: 2098 }
            }, nonAdminProcessRes);
            assert.equal(nonAdminProcessRes.statusCode, 403);

            // Admin calls process.js for 2098-07
            const adminProcessRes = mockRes();
            await circaProcessHandler({
                method: 'POST',
                headers: { cookie: adminCookie },
                body: { month: 7, year: 2098 }
            }, adminProcessRes);
            assert.equal(adminProcessRes.statusCode, 200);

            // Verify status endpoint reports processed: true
            const statusRes = mockRes();
            await circaStatusHandler({
                method: 'GET',
                headers: { cookie: kubraCookie },
                query: { month: '7', year: '2098' }
            }, statusRes);
            assert.equal(statusRes.statusCode, 200);
            assert.equal(statusRes.body.processed, true);

            // Expected exact math sum: 3.4 + 3.4 + 9.0 + 6.0 + 5.1 = 26.9 hours
            const balanceDoc = await db.collection('balances').findOne({
                email: 'kubra.celik@medeniyet.edu.tr',
                period: testPeriod
            });
            assert.ok(balanceDoc, 'Processed balance document must exist');
            assert.equal(Number(balanceDoc.totalHours.toFixed(2)), 26.9);

            // PROCESSED-MONTH DELETION LOCK CHECK:
            // Standard user trying to delete a shift from a processed month MUST be rejected with 400!
            const blockedDelRes = mockRes();
            await circaShiftsHandler({
                method: 'DELETE',
                headers: { cookie: kubraCookie },
                query: { id: insertedShiftIds[0] }
            }, blockedDelRes);
            assert.equal(blockedDelRes.statusCode, 400);
            assert.match(blockedDelRes.body.error, /bakiyeye işlendiği için kayıt silinemez/);

            // Admin CAN override and delete even after month is processed
            const adminDelRes = mockRes();
            await circaShiftsHandler({
                method: 'DELETE',
                headers: { cookie: adminCookie },
                query: { id: insertedShiftIds[0] }
            }, adminDelRes);
            assert.equal(adminDelRes.statusCode, 200);
            assert.equal(adminDelRes.body.periodProcessed, true);

        } finally {
            // Full teardown
            await db.collection('shifts').deleteMany({ date: { $regex: `^${testPeriod}` } });
            await db.collection('balances').deleteMany({ period: testPeriod });
        }
    });

    it('İzin talebinde saatlik aralık kontrolü (bitiş <= başlangıç 400) ve sunucu saati hesaplaması', async () => {
        // Inverted time range: 17:00 -> 14:00 must be rejected with 400
        const badTimeRes = mockRes();
        await circaLeavesHandler({
            method: 'POST',
            headers: { cookie: kubraCookie },
            body: {
                unit: 'hourly',
                singleDate: '2098-08-10',
                startTime: '17:00',
                endTime: '14:00',
                description: 'Ters saat testi'
            }
        }, badTimeRes);
        assert.equal(badTimeRes.statusCode, 400);

        // Valid hourly: 09:30 - 12:00 -> exactly 2.5 hours
        const validHourlyRes = mockRes();
        await circaLeavesHandler({
            method: 'POST',
            headers: { cookie: kubraCookie },
            body: {
                unit: 'hourly',
                singleDate: '2098-08-10',
                startTime: '09:30',
                endTime: '12:00',
                description: '2.5 saatlik izin testi'
            }
        }, validHourlyRes);
        assert.equal(validHourlyRes.statusCode, 201);
        assert.equal(validHourlyRes.body.totalHours, 2.5);

        // Deduplication in daily leave: selecting duplicate dates counts as 1 day (8 hours, not 16)
        const dupDailyRes = mockRes();
        await circaLeavesHandler({
            method: 'POST',
            headers: { cookie: kubraCookie },
            body: {
                unit: 'daily',
                dates: ['2098-08-15', '2098-08-15'],
                description: 'Mükerrer gün testi'
            }
        }, dupDailyRes);
        assert.equal(dupDailyRes.statusCode, 201);
        assert.equal(dupDailyRes.body.totalHours, 8);

        // Clean up both created leaves
        for (const id of [validHourlyRes.body._id, dupDailyRes.body._id]) {
            await circaLeavesHandler({ method: 'DELETE', headers: { cookie: kubraCookie }, query: { id: String(id) } }, mockRes());
        }
    });

    it('İzin Onaylama, Bakiyeden Düşüm Döngüsü ve İzin İptal Koruması', async () => {
        const circaMongo = await import(path.join(ROOT_DIR, 'Circa/lib/mongodb.js'));
        const client = await circaMongo.default;
        const db = client.db(circaMongo.getDbName('Circa_db'));

        let leaveId = null;
        let usageDoc = null;

        try {
            // 1. User requests 1 day leave (8 hours)
            const createRes = mockRes();
            await circaLeavesHandler({
                method: 'POST',
                headers: { cookie: kubraCookie },
                body: {
                    unit: 'daily',
                    dates: ['2098-09-20'],
                    description: 'Onay Döngüsü Test İzni'
                }
            }, createRes);
            assert.equal(createRes.statusCode, 201);
            leaveId = String(createRes.body._id);

            // 2. Non-admin trying to approve receives 403
            const nonAdminApprove = mockRes();
            await circaApproveHandler({
                method: 'POST',
                headers: { cookie: kubraCookie },
                body: { id: leaveId }
            }, nonAdminApprove);
            assert.equal(nonAdminApprove.statusCode, 403);

            // 3. Admin approves leave
            const adminApprove = mockRes();
            await circaApproveHandler({
                method: 'POST',
                headers: { cookie: adminCookie },
                body: { id: leaveId }
            }, adminApprove);
            assert.equal(adminApprove.statusCode, 200);

            // Verify the newly created negative balance usage entry
            usageDoc = await db.collection('balances').findOne(
                {
                    email: 'kubra.celik@medeniyet.edu.tr',
                    type: 'usage'
                },
                { sort: { processedAt: -1 } }
            );
            assert.ok(usageDoc, 'Usage balance record must exist');
            assert.equal(usageDoc.totalHours, -8);

            // 4. Re-approving already approved leave must return 400
            const reApproveRes = mockRes();
            await circaApproveHandler({
                method: 'POST',
                headers: { cookie: adminCookie },
                body: { id: leaveId }
            }, reApproveRes);
            assert.equal(reApproveRes.statusCode, 400);

            // 5. User attempting to delete an approved leave must receive 400
            const delApprovedRes = mockRes();
            await circaLeavesHandler({
                method: 'DELETE',
                headers: { cookie: kubraCookie },
                query: { id: leaveId }
            }, delApprovedRes);
            assert.equal(delApprovedRes.statusCode, 400);
            assert.match(delApprovedRes.body.error, /Sadece onay bekleyen/);

            // 6. Privacy check on GET /api/leaves/balance?email=...
            // Standard user passing another email must be ignored and return their OWN balance
            const userBalRes = mockRes();
            await circaBalanceHandler({
                method: 'GET',
                headers: { cookie: kubraCookie },
                query: { email: 'oguzhan.baygul@medeniyet.edu.tr' }
            }, userBalRes);
            assert.equal(userBalRes.statusCode, 200);
            assert.equal(userBalRes.body.email, 'kubra.celik@medeniyet.edu.tr');

            // Admin passing target email sees target user's balance
            const adminBalRes = mockRes();
            await circaBalanceHandler({
                method: 'GET',
                headers: { cookie: adminCookie },
                query: { email: 'kubra.celik@medeniyet.edu.tr' }
            }, adminBalRes);
            assert.equal(adminBalRes.statusCode, 200);
            assert.equal(adminBalRes.body.email, 'kubra.celik@medeniyet.edu.tr');

        } finally {
            if (leaveId) {
                await db.collection('time_offs').deleteMany({ description: 'Onay Döngüsü Test İzni' });
                if (usageDoc?._id) {
                    await db.collection('balances').deleteOne({ _id: usageDoc._id });
                }
            }
        }
    });
});

describe('4. Dispo (Hayvan Çıkış, Çapraz Proje Doğrulama & İstatistikler)', () => {
    it('Toplu aktarım (bulk import) geçerli kayıtları ekler, hatalıları sayar ve ReDoS aramaları güvenli çalışır', async () => {
        const bulkRes = mockRes();
        await dispoAnimalsHandler({
            method: 'POST',
            headers: { cookie: adminCookie },
            body: {
                items: [
                    {
                        species: 'Fare',
                        strain: 'C57BL/6',
                        sex: 'Male',
                        count: 4,
                        dob: '2099-01-01',
                        removalDate: '2099-03-01',
                        reason: 'EXP-01',
                        project: 'CI-BULK-TEST'
                    },
                    { species: '', count: -3 }
                ]
            }
        }, bulkRes);
        assert.equal(bulkRes.statusCode, 201);
        assert.equal(bulkRes.body.insertedCount, 1);
        assert.equal(bulkRes.body.errorCount, 1);

        // Regex injection safety check on /api/projects-search
        const searchRes = mockRes();
        await dispoProjectSearchHandler({
            method: 'GET',
            headers: { cookie: adminCookie },
            query: { q: '([a-z]+)+$' }
        }, searchRes);
        assert.equal(searchRes.statusCode, 200);

        // Empty bulk items array must return 400
        const emptyBulkRes = mockRes();
        await dispoAnimalsHandler({
            method: 'POST',
            headers: { cookie: adminCookie },
            body: { items: [] }
        }, emptyBulkRes);
        assert.equal(emptyBulkRes.statusCode, 400);

        // Cleanup inserted test record
        const listRes = mockRes();
        await dispoAnimalsHandler({ method: 'GET', headers: { cookie: adminCookie } }, listRes);
        for (const item of listRes.body.filter((r) => r.project === 'CI-BULK-TEST')) {
            const delRes = mockRes();
            await dispoAnimalsHandler({ method: 'DELETE', headers: { cookie: adminCookie }, query: { id: item.id } }, delRes);
            assert.equal(delRes.statusCode, 200);
        }
    });

    it('Dispo <-> LabProject Çapraz Doğrulama: Sadece aktif projeleri arar ve detayları getirir', async () => {
        const labMongo = await import(path.join(ROOT_DIR, 'LabProject/lib/mongodb.js'));
        const client = await labMongo.default;
        const db = client.db(labMongo.getDbName('LabProject_db'));

        const activeCode = `CI-ACT-${Date.now()}`;
        const completedCode = `CI-DONE-${Date.now()}`;

        try {
            await db.collection('projects').insertOne({
                title: 'Çapraz Test Aktif Proje',
                code: activeCode,
                pi: 'Dr. Çapraz',
                protocol: 'PROT-001',
                status: 'Active'
            });

            await db.collection('projects').insertOne({
                title: 'Çapraz Test Tamamlanmış Proje',
                code: completedCode,
                pi: 'Dr. Eski',
                protocol: 'PROT-002',
                status: 'Completed'
            });

            // 1. Search must find active project
            const searchActive = mockRes();
            await dispoProjectSearchHandler({
                method: 'GET',
                headers: { cookie: kubraCookie },
                query: { q: activeCode }
            }, searchActive);
            assert.equal(searchActive.statusCode, 200);
            assert.ok(searchActive.body.some((p) => p.code === activeCode));
            const foundProject = searchActive.body.find((p) => p.code === activeCode);
            assert.equal(foundProject.title, 'Çapraz Test Aktif Proje');

            // 2. Project details lookup
            const detailsRes = mockRes();
            await dispoProjectDetailsHandler({
                method: 'GET',
                headers: { cookie: kubraCookie },
                query: { code: activeCode }
            }, detailsRes);
            assert.equal(detailsRes.statusCode, 200);
            assert.equal(detailsRes.body.title, 'Çapraz Test Aktif Proje');
            assert.equal(detailsRes.body.pi, 'Dr. Çapraz');
            assert.equal(detailsRes.body.protocol, 'PROT-001');

            // 3. Unknown code returns 404, missing code returns 400
            const notFoundRes = mockRes();
            await dispoProjectDetailsHandler({
                method: 'GET',
                headers: { cookie: kubraCookie },
                query: { code: 'OLMAYAN-KOD-99999' }
            }, notFoundRes);
            assert.equal(notFoundRes.statusCode, 404);

            const missingRes = mockRes();
            await dispoProjectDetailsHandler({
                method: 'GET',
                headers: { cookie: kubraCookie },
                query: {}
            }, missingRes);
            assert.equal(missingRes.statusCode, 400);

        } finally {
            await db.collection('projects').deleteMany({ code: { $in: [activeCode, completedCode] } });
        }
    });

    it('Tekil Hayvan Kaydı Ekleme, Dashboard İstatistikleri ve Silme', async () => {
        // Record baseline stats
        const initialStatsRes = mockRes();
        await dispoDashboardStatsHandler({ method: 'GET', headers: { cookie: adminCookie } }, initialStatsRes);
        assert.equal(initialStatsRes.statusCode, 200);
        const baseYearCount = initialStatsRes.body.year || 0;
        const baseMonthCount = initialStatsRes.body.month || 0;

        const now = new Date();
        const curDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // Insert 1 animal record with count: 7
        const insertRes = mockRes();
        await dispoAnimalsHandler({
            method: 'POST',
            headers: { cookie: adminCookie },
            body: {
                species: 'Fare',
                strain: 'C57BL/6',
                sex: 'Dişi',
                count: 7,
                dob: '2025-01-01',
                removalDate: curDate,
                reason: 'EXP-01',
                project: 'CI-STATS-PROJECT'
            }
        }, insertRes);
        assert.equal(insertRes.statusCode, 201);
        const recordId = insertRes.body.id;

        try {
            // Verify dashboard stats increased
            const newStatsRes = mockRes();
            await dispoDashboardStatsHandler({ method: 'GET', headers: { cookie: adminCookie } }, newStatsRes);
            assert.equal(newStatsRes.statusCode, 200);
            assert.equal(newStatsRes.body.year, baseYearCount + 7);
            assert.equal(newStatsRes.body.month, baseMonthCount + 7);
            assert.ok(Array.isArray(newStatsRes.body.monthlyData));
            assert.equal(newStatsRes.body.monthlyData.length, 12);
        } finally {
            // Teardown
            const delRes = mockRes();
            await dispoAnimalsHandler({
                method: 'DELETE',
                headers: { cookie: adminCookie },
                query: { id: recordId }
            }, delRes);
            assert.equal(delRes.statusCode, 200);
        }
    });
});

describe('5. LabProject (Proje Takip, Takvim Senkronizasyonu & Hata Durumları)', () => {
    it('Ters etik kurul tarihlerini 400 ile reddeder; standart yetkili personel proje ekleyip güncelleyip silebilir', async () => {
        const badDateRes = mockRes();
        await labProjectsHandler({
            method: 'POST',
            headers: { cookie: kubraCookie },
            body: {
                title: 'Hatalı Tarih Projesi',
                code: 'CI/ERR',
                pi: 'Dr. Test',
                ethicsStartDate: '2026-10-10',
                ethicsEndDate: '2026-05-01'
            }
        }, badDateRes);
        assert.equal(badDateRes.statusCode, 400);

        const createRes = mockRes();
        await labProjectsHandler({
            method: 'POST',
            headers: { cookie: kubraCookie },
            body: {
                title: 'CI Geçerli Test Projesi',
                code: `CI/${Date.now()}`,
                pi: 'Dr. Kübra Test',
                ethicsStartDate: '2026-01-01',
                ethicsEndDate: '2026-12-31',
                quotas: [{ species: 'Fare', strain: 'BALB/c', sex: 'Erkek', count: 20, used: 5 }]
            }
        }, createRes);
        assert.equal(createRes.statusCode, 201);
        const projectId = createRes.body.id;

        const updateRes = mockRes();
        await labProjectsHandler({
            method: 'PUT',
            headers: { cookie: kubraCookie },
            body: {
                id: projectId,
                quotas: [{ species: 'Fare', strain: 'BALB/c', sex: 'Erkek', count: 20, used: 12 }]
            }
        }, updateRes);
        assert.equal(updateRes.statusCode, 200);

        const getRes = mockRes();
        await labProjectsHandler({
            method: 'GET',
            headers: { cookie: kubraCookie },
            query: { id: projectId }
        }, getRes);
        assert.equal(getRes.statusCode, 200);
        assert.equal(getRes.body.quotas[0].used, 12);

        const delRes = mockRes();
        await labProjectsHandler({
            method: 'DELETE',
            headers: { cookie: kubraCookie },
            query: { id: projectId }
        }, delRes);
        assert.equal(delRes.statusCode, 200);
    });

    it('Otomatik Takvim Senkronizasyonu: Proje eklenince takvim oluşturulur, güncellenir ve silinince temizlenir', async () => {
        let projectId = null;
        try {
            // 1. Create project with project startDate & endDate
            const createRes = mockRes();
            await labProjectsHandler({
                method: 'POST',
                headers: { cookie: kubraCookie },
                body: {
                    title: 'Takvim Senkron Projesi',
                    code: `CI-CAL-${Date.now()}`,
                    pi: 'Dr. Takvim',
                    startDate: '2027-01-10',
                    endDate: '2027-06-30'
                }
            }, createRes);
            assert.equal(createRes.statusCode, 201);
            projectId = createRes.body.id;

            // 2. Verify calendar event auto-created
            const calGetRes = mockRes();
            await labCalendarHandler({ method: 'GET', headers: { cookie: kubraCookie } }, calGetRes);
            assert.equal(calGetRes.statusCode, 200);
            const calEvent = calGetRes.body.find((e) => String(e.projectId) === String(projectId));
            assert.ok(calEvent, 'Calendar event must be automatically created');
            assert.equal(calEvent.startDate, '2027-01-10');
            assert.equal(calEvent.endDate, '2027-06-30');

            // 3. Update project endDate
            const updateRes = mockRes();
            await labProjectsHandler({
                method: 'PUT',
                headers: { cookie: kubraCookie },
                body: {
                    id: projectId,
                    startDate: '2027-01-10',
                    endDate: '2027-08-15'
                }
            }, updateRes);
            assert.equal(updateRes.statusCode, 200);

            // Verify calendar event updated
            const calGetRes2 = mockRes();
            await labCalendarHandler({ method: 'GET', headers: { cookie: kubraCookie } }, calGetRes2);
            const updatedCalEvent = calGetRes2.body.find((e) => String(e.projectId) === String(projectId));
            assert.equal(updatedCalEvent.endDate, '2027-08-15');

            // 4. Non-admin POST /api/calendar sync rejected (403); Admin allowed (200)
            const nonAdminCalPost = mockRes();
            await labCalendarHandler({ method: 'POST', headers: { cookie: kubraCookie } }, nonAdminCalPost);
            assert.equal(nonAdminCalPost.statusCode, 403);

            const adminCalPost = mockRes();
            await labCalendarHandler({ method: 'POST', headers: { cookie: adminCookie } }, adminCalPost);
            assert.equal(adminCalPost.statusCode, 200);
            assert.equal(adminCalPost.body.success, true);

        } finally {
            if (projectId) {
                // Delete project and verify calendar event is cleaned
                await labProjectsHandler({ method: 'DELETE', headers: { cookie: kubraCookie }, query: { id: projectId } }, mockRes());
                const finalCal = mockRes();
                await labCalendarHandler({ method: 'GET', headers: { cookie: kubraCookie } }, finalCal);
                assert.equal(finalCal.body.some((e) => String(e.projectId) === String(projectId)), false);
            }
        }
    });

    it('LabProject Geçersiz ObjectId ve Olmayan ID Durumları (400 ve 404)', async () => {
        // Bad ObjectId format -> 400
        const badIdGet = mockRes();
        await labProjectsHandler({ method: 'GET', headers: { cookie: kubraCookie }, query: { id: 'gecersiz-id-123' } }, badIdGet);
        assert.equal(badIdGet.statusCode, 400);

        const badIdPut = mockRes();
        await labProjectsHandler({ method: 'PUT', headers: { cookie: kubraCookie }, body: { id: 'gecersiz-id-123' } }, badIdPut);
        assert.equal(badIdPut.statusCode, 400);

        const badIdDel = mockRes();
        await labProjectsHandler({ method: 'DELETE', headers: { cookie: kubraCookie }, query: { id: 'gecersiz-id-123' } }, badIdDel);
        assert.equal(badIdDel.statusCode, 400);

        // Valid 24-char hex ObjectId that does not exist -> 404
        const notFoundGet = mockRes();
        await labProjectsHandler({ method: 'GET', headers: { cookie: kubraCookie }, query: { id: '507f1f77bcf86cd799439011' } }, notFoundGet);
        assert.equal(notFoundGet.statusCode, 404);
    });
});

describe('6. Locus & Silo (Fiziksel Hiyerarşi & Atomik Stok Matematiksel Güvenliği)', () => {
    it('Locus: standart personel oda oluşturamaz (403); admin oda/raf/kafes oluşturup dolu rafın küçültülmesini engeller (400)', async () => {
        const nonAdminRoomRes = mockRes();
        await locusRoomsHandler({
            method: 'POST',
            headers: { cookie: kubraCookie },
            body: { name: 'Yetkisiz Oda' }
        }, nonAdminRoomRes);
        assert.equal(nonAdminRoomRes.statusCode, 403);

        let roomId = null;
        let rackId = null;
        let cageId = null;
        let animalId = null;

        try {
            const roomRes = mockRes();
            await locusRoomsHandler({
                method: 'POST',
                headers: { cookie: adminCookie },
                body: { name: `CI Test Odası ${Date.now()}` }
            }, roomRes);
            assert.equal(roomRes.statusCode, 201);
            roomId = roomRes.body.id;

            // Out-of-bounds rack dimensions must be rejected with 400
            const badRackRes = mockRes();
            await locusRacksHandler({
                method: 'POST',
                headers: { cookie: adminCookie },
                body: { name: 'Hatalı Raf', roomId, rows: 27, cols: 0 }
            }, badRackRes);
            assert.equal(badRackRes.statusCode, 400);

            const rackRes = mockRes();
            await locusRacksHandler({
                method: 'POST',
                headers: { cookie: adminCookie },
                body: { name: 'CI Raf 1', roomId, rows: 4, cols: 4 }
            }, rackRes);
            assert.equal(rackRes.statusCode, 201);
            rackId = rackRes.body.id;

            const cageRes = mockRes();
            await locusCagesHandler({
                method: 'POST',
                headers: { cookie: kubraCookie },
                body: {
                    rackId,
                    name: 'CI-KAFES-D4',
                    row: 4,
                    column: 4,
                    status: 'Active'
                }
            }, cageRes);
            assert.equal(cageRes.statusCode, 201);
            cageId = cageRes.body.id;

            // Animal creation in cage
            const animalRes = mockRes();
            await locusAnimalsHandler({
                method: 'POST',
                headers: { cookie: kubraCookie },
                body: {
                    cageId,
                    species: 'Fare',
                    strain: 'BALB/c',
                    sex: 'Erkek',
                    count: 3,
                    dob: '2026-02-01',
                    projectCode: 'CI-LOCUS-01'
                }
            }, animalRes);
            assert.equal(animalRes.statusCode, 201);
            animalId = animalRes.body.id;

            // Animal list in cage
            const animalListRes = mockRes();
            await locusAnimalsHandler({
                method: 'GET',
                headers: { cookie: kubraCookie },
                query: { cageId }
            }, animalListRes);
            assert.equal(animalListRes.statusCode, 200);
            assert.equal(animalListRes.body.length, 1);
            assert.equal(animalListRes.body[0].count, 3);

            // ReDoS-safe search in Locus
            const locusSearchRes = mockRes();
            await locusProjectsSearchHandler({
                method: 'GET',
                headers: { cookie: kubraCookie },
                query: { q: '([a-z]+)+$' }
            }, locusSearchRes);
            assert.equal(locusSearchRes.statusCode, 200);

            // Shrinking rack to 2x2 while cage sits at (4,4) must fail with 400
            const shrinkRes = mockRes();
            await locusRacksHandler({
                method: 'PUT',
                headers: { cookie: adminCookie },
                body: { id: rackId, name: 'CI Raf 1', rows: 2, cols: 2 }
            }, shrinkRes);
            assert.equal(shrinkRes.statusCode, 400);

        } finally {
            if (animalId) await locusAnimalsHandler({ method: 'DELETE', headers: { cookie: adminCookie }, query: { id: animalId } }, mockRes());
            if (cageId) await locusCagesHandler({ method: 'DELETE', headers: { cookie: adminCookie }, query: { id: cageId } }, mockRes());
            if (rackId) await locusRacksHandler({ method: 'DELETE', headers: { cookie: adminCookie }, query: { id: rackId } }, mockRes());
            if (roomId) await locusRoomsHandler({ method: 'DELETE', headers: { cookie: adminCookie }, query: { id: roomId } }, mockRes());

            const locusMongo = await import(path.join(ROOT_DIR, 'Locus/lib/mongodb.js'));
            const client = await locusMongo.default;
            const db = client.db(locusMongo.getDbName('Locus_db'));
            await db.collection('racks').deleteMany({ name: 'CI Raf 1' });
            await db.collection('rooms').deleteMany({ name: /^CI Test Odası / });
        }
    });

    it('Silo: Atomik Stok Giriş/Çıkış Matematik Doğrulaması ve Yetersiz Stok Koruması', async () => {
        // 1. Initial inventory stats
        const getRes = mockRes();
        await siloInventoryHandler({ method: 'GET', headers: { cookie: adminCookie }, query: {} }, getRes);
        assert.equal(getRes.statusCode, 200);
        const baseA03Stock = getRes.body.stats.products.A03.totalStock || 0;
        const baseA03Weight = getRes.body.stats.products.A03.totalWeight || 0;

        const siloMongo = await import(path.join(ROOT_DIR, 'Silo/lib/mongodb.js'));
        const client = await siloMongo.default;
        const db = client.db(siloMongo.getDbName('Silo_db'));

        try {
            // Invalid product code must return 400
            const badProdRes = mockRes();
            await siloInventoryHandler({
                method: 'POST',
                headers: { cookie: adminCookie },
                body: { type: 'IN', product: 'GEÇERSİZ_ÜRÜN', amount: 5 }
            }, badProdRes);
            assert.equal(badProdRes.statusCode, 400);

            // 2. Deliver IN: 3 packages of A03 (3 x 10 = +30 kg)
            const inRes = mockRes();
            await siloInventoryHandler({
                method: 'POST',
                headers: { cookie: adminCookie },
                body: { type: 'IN', product: 'A03', amount: 3 }
            }, inRes);
            assert.equal(inRes.statusCode, 200);

            const afterInRes = mockRes();
            await siloInventoryHandler({ method: 'GET', headers: { cookie: adminCookie }, query: {} }, afterInRes);
            assert.equal(afterInRes.body.stats.products.A03.totalStock, baseA03Stock + 3);
            assert.equal(afterInRes.body.stats.products.A03.totalWeight, baseA03Weight + 30);

            // 3. Take OUT: 1 package of A03 (-10 kg)
            const outRes = mockRes();
            await siloInventoryHandler({
                method: 'POST',
                headers: { cookie: adminCookie },
                body: { type: 'OUT', product: 'A03', amount: 1 }
            }, outRes);
            assert.equal(outRes.statusCode, 200);

            const afterOutRes = mockRes();
            await siloInventoryHandler({ method: 'GET', headers: { cookie: adminCookie }, query: {} }, afterOutRes);
            assert.equal(afterOutRes.body.stats.products.A03.totalStock, baseA03Stock + 2);
            assert.equal(afterOutRes.body.stats.products.A03.totalWeight, baseA03Weight + 20);

            // Verify weekly consumption reflects the OUT package
            const curWeek = afterOutRes.body.weeklyConsumption?.[afterOutRes.body.weeklyConsumption.length - 1];
            assert.ok(curWeek, 'Current week consumption must exist');
            assert.ok(curWeek.packages >= 1);
            assert.ok(curWeek.weight >= 10);

            // 4. ATOMIC INSUFFICIENT STOCK GUARD:
            // Attempting to withdraw more than available stock MUST be rejected with 400!
            const excessiveOutRes = mockRes();
            await siloInventoryHandler({
                method: 'POST',
                headers: { cookie: adminCookie },
                body: { type: 'OUT', product: 'A03', amount: baseA03Stock + 2 + 5000 }
            }, excessiveOutRes);
            assert.equal(excessiveOutRes.statusCode, 400);
            assert.match(excessiveOutRes.body.error, /yetersiz stok/);

            // Verify stock was NOT altered by the rejected request
            const checkUnchangedRes = mockRes();
            await siloInventoryHandler({ method: 'GET', headers: { cookie: adminCookie }, query: {} }, checkUnchangedRes);
            assert.equal(checkUnchangedRes.body.stats.products.A03.totalStock, baseA03Stock + 2);

            // 5. Take OUT the remaining 2 packages so stock returns exactly to base
            const returnBaseRes = mockRes();
            await siloInventoryHandler({
                method: 'POST',
                headers: { cookie: adminCookie },
                body: { type: 'OUT', product: 'A03', amount: 2 }
            }, returnBaseRes);
            assert.equal(returnBaseRes.statusCode, 200);

            const finalCheckRes = mockRes();
            await siloInventoryHandler({ method: 'GET', headers: { cookie: adminCookie }, query: {} }, finalCheckRes);
            assert.equal(finalCheckRes.body.stats.products.A03.totalStock, baseA03Stock);
            assert.equal(finalCheckRes.body.stats.products.A03.totalWeight, baseA03Weight);

        } finally {
            // Clean up test transactions inserted during this run
            await db.collection('transactions').deleteMany({
                user: 'Oğuzhan Baygül',
                details: { $in: ['Teslimat Alındı', 'Paket Çıkışı'] },
                date: { $gte: new Date(Date.now() - 60_000) }
            });
        }
    });
});

after(async () => {
    // Close MongoDB client pools so node --test exits immediately without hanging
    const modules = [
        'Apex/api/lib/mongodb.js',
        'Circa/lib/mongodb.js',
        'Dispo/lib/mongodb.js',
        'LabProject/lib/mongodb.js',
        'Locus/lib/mongodb.js',
        'Silo/lib/mongodb.js'
    ];
    for (const rel of modules) {
        try {
            const mod = await import(path.join(ROOT_DIR, rel));
            const client = await mod.default;
            await client.close();
        } catch {
            // ignore already closed
        }
    }
});
