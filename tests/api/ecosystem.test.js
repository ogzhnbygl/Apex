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
const adminUsersHandler = (await import(path.join(ROOT_DIR, 'Apex/api/admin/users.js'))).default;

const circaShiftsHandler = (await import(path.join(ROOT_DIR, 'Circa/api/shifts/index.js'))).default;
const circaLeavesHandler = (await import(path.join(ROOT_DIR, 'Circa/api/leaves/index.js'))).default;

const dispoAnimalsHandler = (await import(path.join(ROOT_DIR, 'Dispo/api/animals.js'))).default;
const dispoProjectSearchHandler = (await import(path.join(ROOT_DIR, 'Dispo/api/projects-search.js'))).default;
const dispoSessionHandler = (await import(path.join(ROOT_DIR, 'Dispo/api/auth/session.js'))).default;

const labProjectsHandler = (await import(path.join(ROOT_DIR, 'LabProject/api/projects.js'))).default;

const locusRoomsHandler = (await import(path.join(ROOT_DIR, 'Locus/api/rooms.js'))).default;
const locusRacksHandler = (await import(path.join(ROOT_DIR, 'Locus/api/racks.js'))).default;
const locusCagesHandler = (await import(path.join(ROOT_DIR, 'Locus/api/cages.js'))).default;

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

describe('1. Sistem Geneli SSO, JWT ve Güvenlik Kontrolleri', () => {
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
});

describe('2. Apex (Merkezi Kimlik ve Admin Paneli)', () => {
    const tempEmail = `ci.temp.${Date.now()}@medeniyet.edu.tr`;

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

    it('Admin geçici kullanıcı oluşturabilir, şifresiyle giriş yapabilir ve silebilir', async () => {
        const createRes = mockRes();
        await adminUsersHandler({
            method: 'POST',
            headers: { cookie: adminCookie },
            body: {
                name: 'CI Test Kullanıcısı',
                email: tempEmail,
                password: 'TestPass123!',
                role: 'user',
                apps: ['circa', 'silo']
            }
        }, createRes);
        assert.equal(createRes.statusCode, 201);

        const loginRes = mockRes();
        await loginHandler({
            method: 'POST',
            headers: { host: 'localhost:5173' },
            body: { email: tempEmail, password: 'TestPass123!' }
        }, loginRes);
        assert.equal(loginRes.statusCode, 200);
        assert.equal(loginRes.body.user.email, tempEmail);

        const deleteRes = mockRes();
        await adminUsersHandler({
            method: 'DELETE',
            headers: { cookie: adminCookie },
            query: { email: tempEmail }
        }, deleteRes);
        assert.equal(deleteRes.statusCode, 200);
    });
});

describe('3. Circa (Mesai & İzin Takip)', () => {
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

    it('İzin talebinde sunucu totalHours değerini kendisi hesaplar (istemci manipülasyonunu yok sayar)', async () => {
        const createRes = mockRes();
        await circaLeavesHandler({
            method: 'POST',
            headers: { cookie: kubraCookie },
            body: {
                unit: 'daily',
                dates: ['2099-11-03', '2099-11-04'],
                totalHours: 0.5, // Manipulated client value — server must enforce 2 * 8 = 16
                description: 'CI Otomatik İzin Testi'
            }
        }, createRes);
        assert.equal(createRes.statusCode, 201);
        assert.equal(createRes.body.totalHours, 16);

        // Delete created pending request via API & remove any prior interrupted CI Otomatik İzin Testi
        const delRes = mockRes();
        await circaLeavesHandler({
            method: 'DELETE',
            headers: { cookie: kubraCookie },
            query: { id: String(createRes.body._id) }
        }, delRes);
        assert.equal(delRes.statusCode, 200);

        const circaMongo = await import(path.join(ROOT_DIR, 'Circa/lib/mongodb.js'));
        const client = await circaMongo.default;
        const db = client.db(circaMongo.getDbName('Circa_db'));
        await db.collection('time_offs').deleteMany({ description: 'CI Otomatik İzin Testi' });
    });
});

describe('4. Dispo (Hayvan Çıkış ve Toplu Aktarım)', () => {
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

        // Cleanup inserted test record
        const listRes = mockRes();
        await dispoAnimalsHandler({ method: 'GET', headers: { cookie: adminCookie } }, listRes);
        for (const item of listRes.body.filter((r) => r.project === 'CI-BULK-TEST')) {
            const delRes = mockRes();
            await dispoAnimalsHandler({ method: 'DELETE', headers: { cookie: adminCookie }, query: { id: item.id } }, delRes);
            assert.equal(delRes.statusCode, 200);
        }
    });
});

describe('5. LabProject (Proje Takip ve Tarih Doğrulama)', () => {
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
});

describe('6. Locus & Silo (Fiziksel Oda RBAC ve Yem Envanteri)', () => {
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

        try {
            const roomRes = mockRes();
            await locusRoomsHandler({
                method: 'POST',
                headers: { cookie: adminCookie },
                body: { name: `CI Test Odası ${Date.now()}` }
            }, roomRes);
            assert.equal(roomRes.statusCode, 201);
            roomId = roomRes.body.id;

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

            // Shrinking rack to 2x2 while cage sits at (4,4) must fail with 400
            const shrinkRes = mockRes();
            await locusRacksHandler({
                method: 'PUT',
                headers: { cookie: adminCookie },
                body: { id: rackId, name: 'CI Raf 1', rows: 2, cols: 2 }
            }, shrinkRes);
            assert.equal(shrinkRes.statusCode, 400);
        } finally {
            if (cageId) await locusCagesHandler({ method: 'DELETE', headers: { cookie: adminCookie }, query: { id: cageId } }, mockRes());
            if (rackId) await locusRacksHandler({ method: 'DELETE', headers: { cookie: adminCookie }, query: { id: rackId } }, mockRes());
            if (roomId) await locusRoomsHandler({ method: 'DELETE', headers: { cookie: adminCookie }, query: { id: roomId } }, mockRes());

            // Also clean any prior interrupted CI Test Odası from Locus_test_db
            const locusMongo = await import(path.join(ROOT_DIR, 'Locus/lib/mongodb.js'));
            const client = await locusMongo.default;
            const db = client.db(locusMongo.getDbName('Locus_db'));
            await db.collection('racks').deleteMany({ name: 'CI Raf 1' });
            await db.collection('rooms').deleteMany({ name: /^CI Test Odası / });
        }
    });

    it('Silo: GET /api/inventory ürün istatistiklerini döner ve geçersiz miktar 400 ile reddedilir', async () => {
        const getRes = mockRes();
        await siloInventoryHandler({
            method: 'GET',
            headers: { cookie: adminCookie },
            query: {}
        }, getRes);
        assert.equal(getRes.statusCode, 200);
        assert.ok(getRes.body.stats?.products?.A03);
        assert.ok(getRes.body.stats?.products?.A04);

        const badPostRes = mockRes();
        await siloInventoryHandler({
            method: 'POST',
            headers: { cookie: adminCookie },
            body: { type: 'IN', product: 'A03', amount: -5 }
        }, badPostRes);
        assert.equal(badPostRes.statusCode, 400);
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
