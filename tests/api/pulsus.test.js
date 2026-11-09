import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

// Load Apex/.env if env vars are not already injected
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

const pulsusMongo = await import(path.join(ROOT_DIR, 'Pulsus/lib/mongodb.js'));
assert.equal(pulsusMongo.isProdEnv(), false, 'SAFETY ABORT: Pulsus tests must never run against production DB!');
assert.equal(pulsusMongo.getDbName('Pulsus_db'), 'Pulsus_test_db');
assert.equal(pulsusMongo.getDbName('Circa_db'), 'Circa_test_db');
assert.equal(pulsusMongo.getDbName('Apex_db'), 'Apex_test_db');
assert.equal(pulsusMongo.getSessionCookieName(), 'interapp_session_test');

// Import Pulsus API handlers & engines
const sessionHandler = (await import(path.join(ROOT_DIR, 'Pulsus/api/auth/session.js'))).default;
const membersHandler = (await import(path.join(ROOT_DIR, 'Pulsus/api/members/index.js'))).default;
const templatesHandler = (await import(path.join(ROOT_DIR, 'Pulsus/api/ritus/templates.js'))).default;
const runsHandler = (await import(path.join(ROOT_DIR, 'Pulsus/api/ritus/runs.js'))).default;
const sequaTasksHandler = (await import(path.join(ROOT_DIR, 'Pulsus/api/sequa/tasks.js'))).default;
const reportsHandler = (await import(path.join(ROOT_DIR, 'Pulsus/api/reports/index.js'))).default;

const {
    isFridayDistributionTimeReached,
    getMondayOfDate,
    addDays,
    distributeWeekPackage
} = await import(path.join(ROOT_DIR, 'Pulsus/lib/ritusEngine.js'));

const { resolveTaskAssignment } = await import(path.join(ROOT_DIR, 'Pulsus/lib/assignmentResolver.js'));

function mockRes() {
    return {
        statusCode: 200,
        headers: {},
        body: null,
        setHeader(k, v) {
            this.headers[k] = v;
            return this;
        },
        status(c) {
            this.statusCode = c;
            return this;
        },
        json(b) {
            this.body = b;
            return this;
        },
        send(b) {
            this.body = b;
            return this;
        },
        end(b) {
            if (b !== undefined) this.body = b;
            return this;
        }
    };
}

function signSession(email, role = 'user') {
    const token = jwt.sign({ email, role }, process.env.JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '24h'
    });
    return `interapp_session_test=${token}`;
}

const VET_EMAIL = 'oguzhan.baygul@medeniyet.edu.tr';
const TECH_KUBRA = 'kubra.celik@medeniyet.edu.tr';
const TECH_GAMZE = 'gamze.demir@medeniyet.edu.tr';
const CARE_GOKHAN = 'gokhan.sert@medeniyet.edu.tr';
const CARE_YUSUF = 'yusufenes.isik@medeniyet.edu.tr';

const vetCookie = signSession(VET_EMAIL, 'admin');
const kubraCookie = signSession(TECH_KUBRA, 'user');
const gokhanCookie = signSession(CARE_GOKHAN, 'user');

// Track original user documents in Apex_test_db to restore after tests if modified
const originalUserSnapshots = new Map();
const createdTempUsers = [];

before(async () => {
    const client = await pulsusMongo.default;
    const apexDb = client.db(pulsusMongo.getDbName('Apex_db'));
    const usersCol = apexDb.collection('users');

    const staffSetup = [
        { email: VET_EMAIL, name: 'Oğuzhan Baygül', role: 'admin', apps: ['pulsus', 'circa', 'locus', 'silo', 'dispo', 'labproject'] },
        { email: TECH_KUBRA, name: 'Kübra Çelik', role: 'user', apps: ['pulsus', 'circa', 'locus', 'silo', 'dispo', 'labproject'] },
        { email: TECH_GAMZE, name: 'Gamze Demir', role: 'user', apps: ['pulsus', 'circa', 'locus', 'silo'] },
        { email: CARE_GOKHAN, name: 'Gökhan Sert', role: 'user', apps: ['pulsus', 'circa', 'silo'] },
        { email: CARE_YUSUF, name: 'Yusuf Enes Işık', role: 'user', apps: ['pulsus', 'circa', 'silo'] }
    ];

    for (const s of staffSetup) {
        const existing = await usersCol.findOne({ email: s.email });
        if (existing) {
            originalUserSnapshots.set(s.email, { ...existing });
            const mergedApps = Array.from(new Set([...(existing.apps || []), 'pulsus']));
            await usersCol.updateOne({ email: s.email }, { $set: { apps: mergedApps } });
        } else {
            createdTempUsers.push(s.email);
            await usersCol.insertOne({
                email: s.email,
                name: s.name,
                role: s.role,
                apps: s.apps,
                createdAt: new Date()
            });
        }
    }
});

describe('SUITE-1: Güvenlik, Ortam İzolasyonu (Pulsus_test_db) ve Zod v4 Doğrulaması', () => {
    it('T1.1: isProdEnv() === false, getDbName("Pulsus_db") === "Pulsus_test_db", getSessionCookieName() === "interapp_session_test"', () => {
        assert.equal(pulsusMongo.isProdEnv(), false);
        assert.equal(pulsusMongo.getDbName('Pulsus_db'), 'Pulsus_test_db');
        assert.equal(pulsusMongo.getDbName('Circa_db'), 'Circa_test_db');
        assert.equal(pulsusMongo.getSessionCookieName(), 'interapp_session_test');
    });

    it('T1.2: Oturumsuz istek 401, pulsus yetkisi olmayan kullanıcı 403, yetkili personel 200 ve doğru pulsusRole döner', async () => {
        // 1. Unauthenticated -> 401
        const unauthRes = mockRes();
        await sessionHandler({ method: 'GET', headers: {} }, unauthRes);
        assert.equal(unauthRes.statusCode, 401);

        // 2. User without 'pulsus' in apps -> 403
        const client = await pulsusMongo.default;
        const apexDb = client.db(pulsusMongo.getDbName('Apex_db'));
        const noPulsusEmail = `nopulsus.${Date.now()}@medeniyet.edu.tr`;
        await apexDb.collection('users').insertOne({
            email: noPulsusEmail,
            name: 'Yetkisiz Kullanıcı',
            role: 'user',
            apps: ['silo']
        });

        try {
            const noPulsusCookie = signSession(noPulsusEmail, 'user');
            const forbiddenRes = mockRes();
            await sessionHandler({ method: 'GET', headers: { cookie: noPulsusCookie } }, forbiddenRes);
            assert.equal(forbiddenRes.statusCode, 403);
        } finally {
            await apexDb.collection('users').deleteOne({ email: noPulsusEmail });
        }

        // 3. Authorized Vet -> 200 + pulsusRole === 'vet'
        const vetRes = mockRes();
        await sessionHandler({ method: 'GET', headers: { cookie: vetCookie } }, vetRes);
        assert.equal(vetRes.statusCode, 200);
        assert.equal(vetRes.body.pulsusRole, 'vet');

        // 4. Authorized Technician (Kübra) -> 200 + pulsusRole === 'technician'
        const techRes = mockRes();
        await sessionHandler({ method: 'GET', headers: { cookie: kubraCookie } }, techRes);
        assert.equal(techRes.statusCode, 200);
        assert.equal(techRes.body.pulsusRole, 'technician');

        // 5. Authorized Caretaker (Gökhan) -> 200 + pulsusRole === 'caretaker'
        const careRes = mockRes();
        await sessionHandler({ method: 'GET', headers: { cookie: gokhanCookie } }, careRes);
        assert.equal(careRes.statusCode, 200);
        assert.equal(careRes.body.pulsusRole, 'caretaker');
    });

    it('T1.3: Zod v4 & NoSQL enjeksiyon kalkanı ({ $ne: null }, saat "29:99", geçersiz enum) 400 ile reddeder', async () => {
        // NoSQL operator injection in /api/members
        const nosqlMemberRes = mockRes();
        await membersHandler(
            {
                method: 'POST',
                headers: { cookie: vetCookie },
                body: { email: { $ne: null }, pulsusRole: 'caretaker', title: 'Test' }
            },
            nosqlMemberRes
        );
        assert.equal(nosqlMemberRes.statusCode, 400);

        // Invalid scheduledTime "29:99" in /api/ritus/templates
        const badTimeRes = mockRes();
        await templatesHandler(
            {
                method: 'POST',
                headers: { cookie: vetCookie },
                body: {
                    title: 'Geçersiz Saat Şablonu',
                    frequency: 'weekly',
                    daysOfWeek: [1],
                    scheduledTime: '29:99',
                    primaryAssignee: CARE_GOKHAN,
                    primaryReviewer: TECH_KUBRA
                }
            },
            badTimeRes
        );
        assert.equal(badTimeRes.statusCode, 400);

        // Invalid enum in /api/sequa/tasks
        const badEnumRes = mockRes();
        await sequaTasksHandler(
            {
                method: 'POST',
                headers: { cookie: vetCookie },
                body: {
                    title: 'Geçersiz Enum Görevi',
                    taskType: 'invalid_type_xyz',
                    priority: 'super_urgent'
                }
            },
            badEnumRes
        );
        assert.equal(badEnumRes.statusCode, 400);
    });
});

describe('SUITE-2: 5 Kişilik Ekip ve Operasyonel Rol Kuralları (vet, technician, caretaker)', () => {
    it('T2.1: Caretaker (Gökhan) ve Technician (Kübra) /api/ritus/templates üzerinde POST/PUT/DELETE yapamaz (403); yalnızca Vet (Oğuzhan) yapabilir (201/200)', async () => {
        const samplePayload = {
            title: 'CI Yetki Testi Rutin Şablonu',
            description: 'Sadece Veteriner Hekim oluşturabilir.',
            category: 'biosecurity',
            frequency: 'weekly',
            daysOfWeek: [2, 4],
            scheduledTime: '10:30',
            primaryAssignee: CARE_GOKHAN,
            backupAssignee: CARE_YUSUF,
            primaryReviewer: TECH_KUBRA,
            backupReviewer: TECH_GAMZE,
            checklist: ['Adım 1', 'Adım 2'],
            updateScope: 'next_week'
        };

        // Caretaker POST -> 403
        const carePostRes = mockRes();
        await templatesHandler({ method: 'POST', headers: { cookie: gokhanCookie }, body: samplePayload }, carePostRes);
        assert.equal(carePostRes.statusCode, 403);

        // Technician POST -> 403
        const techPostRes = mockRes();
        await templatesHandler({ method: 'POST', headers: { cookie: kubraCookie }, body: samplePayload }, techPostRes);
        assert.equal(techPostRes.statusCode, 403);

        // Vet POST -> 201
        const vetPostRes = mockRes();
        await templatesHandler({ method: 'POST', headers: { cookie: vetCookie }, body: samplePayload }, vetPostRes);
        assert.equal(vetPostRes.statusCode, 201);
        const createdId = String(vetPostRes.body.template._id);

        try {
            // Technician PUT & DELETE -> 403
            const techPutRes = mockRes();
            await templatesHandler(
                {
                    method: 'PUT',
                    headers: { cookie: kubraCookie },
                    body: { ...samplePayload, id: createdId, title: 'Yetkisiz Güncelleme' }
                },
                techPutRes
            );
            assert.equal(techPutRes.statusCode, 403);

            const careDelRes = mockRes();
            await templatesHandler(
                {
                    method: 'DELETE',
                    headers: { cookie: gokhanCookie },
                    query: { id: createdId }
                },
                careDelRes
            );
            assert.equal(careDelRes.statusCode, 403);

            // Vet PUT -> 200
            const vetPutRes = mockRes();
            await templatesHandler(
                {
                    method: 'PUT',
                    headers: { cookie: vetCookie },
                    body: { ...samplePayload, id: createdId, title: 'CI Yetki Testi Şablonu (Güncellendi)' }
                },
                vetPutRes
            );
            assert.equal(vetPutRes.statusCode, 200);
            assert.equal(vetPutRes.body.template.title, 'CI Yetki Testi Şablonu (Güncellendi)');
        } finally {
            // Vet DELETE -> 200
            const vetDelRes = mockRes();
            await templatesHandler(
                {
                    method: 'DELETE',
                    headers: { cookie: vetCookie },
                    query: { id: createdId }
                },
                vetDelRes
            );
            assert.equal(vetDelRes.statusCode, 200);
        }
    });

    it('T2.2: Caretaker (Gökhan) standart "task" veya "external" görev açamaz (403); ancak Teknikere/Veteriner Hekime yukarı yönlü "issue_report" açabilir (201)', async () => {
        const client = await pulsusMongo.default;
        const db = client.db(pulsusMongo.getDbName('Pulsus_db'));
        const createdTaskIds = [];

        try {
            // Caretaker trying taskType: 'task' -> 403
            const forbiddenTaskRes = mockRes();
            await sequaTasksHandler(
                {
                    method: 'POST',
                    headers: { cookie: gokhanCookie },
                    body: {
                        title: 'Bakıcıdan Bakıcıya Görev Denemesi',
                        taskType: 'task',
                        assignedTo: CARE_YUSUF
                    }
                },
                forbiddenTaskRes
            );
            assert.equal(forbiddenTaskRes.statusCode, 403);

            // Caretaker trying taskType: 'external' -> 403
            const forbiddenExtRes = mockRes();
            await sequaTasksHandler(
                {
                    method: 'POST',
                    headers: { cookie: gokhanCookie },
                    body: {
                        title: 'Bakıcı Dış Birim Denemesi',
                        taskType: 'external',
                        externalUnit: 'Yapı İşleri'
                    }
                },
                forbiddenExtRes
            );
            assert.equal(forbiddenExtRes.statusCode, 403);

            // Caretaker trying to direct an issue_report to another Caretaker -> 403
            const forbiddenPeerRes = mockRes();
            await sequaTasksHandler(
                {
                    method: 'POST',
                    headers: { cookie: gokhanCookie },
                    body: {
                        title: 'Diğer Bakıcıya Bildirim Denemesi',
                        taskType: 'issue_report',
                        assignedTo: CARE_YUSUF
                    }
                },
                forbiddenPeerRes
            );
            assert.equal(forbiddenPeerRes.statusCode, 403);

            // Caretaker opening upward 'issue_report' to Technician (Kübra) -> 201 Created
            const validIssueRes = mockRes();
            await sequaTasksHandler(
                {
                    method: 'POST',
                    headers: { cookie: gokhanCookie },
                    body: {
                        title: 'Yıkama Odası Su Tahliye Borusu Sızıntısı',
                        description: 'Temizlik sırasında gider borusundan su sızdığı fark edildi.',
                        taskType: 'issue_report',
                        priority: 'high',
                        assignedTo: TECH_KUBRA
                    }
                },
                validIssueRes
            );
            assert.equal(validIssueRes.statusCode, 201);
            assert.equal(validIssueRes.body.task.status, 'reported');
            assert.equal(validIssueRes.body.task.taskType, 'issue_report');
            createdTaskIds.push(validIssueRes.body.task._id);
        } finally {
            if (createdTaskIds.length > 0) {
                await db.collection('sequa_tasks').deleteMany({ _id: { $in: createdTaskIds } });
            }
        }
    });

    it('T2.3: Technician (Kübra) Bakıcıya (Gökhan) ve diğer Teknikere (Gamze) görev atayabilir (201), ayrıca Veteriner Hekime "vet_request" açabilir (201)', async () => {
        const client = await pulsusMongo.default;
        const db = client.db(pulsusMongo.getDbName('Pulsus_db'));
        const createdTaskIds = [];

        try {
            // 1. Technician -> Caretaker task (201)
            const toCaretakerRes = mockRes();
            await sequaTasksHandler(
                {
                    method: 'POST',
                    headers: { cookie: kubraCookie },
                    body: {
                        title: 'Oda-2 Yedek Kafes Altlıklarının Hazırlanması',
                        taskType: 'task',
                        priority: 'medium',
                        assignedTo: CARE_GOKHAN
                    }
                },
                toCaretakerRes
            );
            assert.equal(toCaretakerRes.statusCode, 201);
            createdTaskIds.push(toCaretakerRes.body.task._id);

            // 2. Technician (Kübra) -> Technician (Gamze) task (201)
            const toTechRes = mockRes();
            await sequaTasksHandler(
                {
                    method: 'POST',
                    headers: { cookie: kubraCookie },
                    body: {
                        title: 'Anestezi Cihazı Vaporizatör Seviye Kontrolü',
                        taskType: 'task',
                        priority: 'high',
                        assignedTo: TECH_GAMZE
                    }
                },
                toTechRes
            );
            assert.equal(toTechRes.statusCode, 201);
            createdTaskIds.push(toTechRes.body.task._id);

            // 3. Technician -> Vet 'vet_request' (201)
            const vetReqRes = mockRes();
            await sequaTasksHandler(
                {
                    method: 'POST',
                    headers: { cookie: kubraCookie },
                    body: {
                        title: 'X kafesinde değişim yaparken bir hayvanın durumu kötü, hocam gelip bakar mısınız?',
                        description: 'Solunum güçlüğü ve hipotermi bulgusu mevcut.',
                        taskType: 'vet_request',
                        priority: 'critical',
                        assignedTo: VET_EMAIL
                    }
                },
                vetReqRes
            );
            assert.equal(vetReqRes.statusCode, 201);
            assert.equal(vetReqRes.body.task.taskType, 'vet_request');
            assert.equal(vetReqRes.body.task.assignedTo, VET_EMAIL);
            createdTaskIds.push(vetReqRes.body.task._id);
        } finally {
            if (createdTaskIds.length > 0) {
                await db.collection('sequa_tasks').deleteMany({ _id: { $in: createdTaskIds } });
            }
        }
    });

    it('T2.4: Vet (Oğuzhan) herkese görev atayabilir, "external" üniversite birimi işi oluşturabilir (201) ve "issue_report" kaydını "convert_to_task" ile dönüştürebilir', async () => {
        const client = await pulsusMongo.default;
        const db = client.db(pulsusMongo.getDbName('Pulsus_db'));
        const createdTaskIds = [];

        try {
            // 1. Vet creates external university unit task
            const extRes = mockRes();
            await sequaTasksHandler(
                {
                    method: 'POST',
                    headers: { cookie: vetCookie },
                    body: {
                        title: 'İklimlendirme Santrali (AHU) Hepa Filtre Değişimi',
                        description: 'Üniversite teknik biriminden değişim talep edildi.',
                        taskType: 'external',
                        priority: 'critical',
                        assignedTo: TECH_KUBRA,
                        externalUnit: 'Yapı İşleri Daire Başkanlığı',
                        externalTicketNo: 'YIDB-2026-991'
                    }
                },
                extRes
            );
            assert.equal(extRes.statusCode, 201);
            assert.equal(extRes.body.task.taskType, 'external');
            assert.equal(extRes.body.task.externalUnit, 'Yapı İşleri Daire Başkanlığı');
            createdTaskIds.push(extRes.body.task._id);

            // 2. Caretaker creates an upward issue_report, then Vet converts it via convert_to_task
            const issueRes = mockRes();
            await sequaTasksHandler(
                {
                    method: 'POST',
                    headers: { cookie: gokhanCookie },
                    body: {
                        title: 'Koridor Aydınlatma Armatürü Arızası',
                        taskType: 'issue_report',
                        assignedTo: VET_EMAIL
                    }
                },
                issueRes
            );
            assert.equal(issueRes.statusCode, 201);
            const issueId = issueRes.body.task._id;
            createdTaskIds.push(issueId);

            const convertRes = mockRes();
            await sequaTasksHandler(
                {
                    method: 'PATCH',
                    headers: { cookie: vetCookie },
                    body: {
                        id: String(issueId),
                        action: 'convert_to_task',
                        taskType: 'external',
                        assignedTo: TECH_GAMZE,
                        externalUnit: 'Yapı İşleri Daire Başkanlığı',
                        externalTicketNo: 'YIDB-ELK-104',
                        note: 'Yapı İşlerine arıza kaydı açıldı, takibi Gamze yapacak.'
                    }
                },
                convertRes
            );
            assert.equal(convertRes.statusCode, 200);
            assert.equal(convertRes.body.task.taskType, 'external');
            assert.equal(convertRes.body.task.status, 'todo');
            assert.equal(convertRes.body.task.assignedTo, TECH_GAMZE);
            assert.equal(convertRes.body.task.externalUnit, 'Yapı İşleri Daire Başkanlığı');
        } finally {
            if (createdTaskIds.length > 0) {
                await db.collection('sequa_tasks').deleteMany({ _id: { $in: createdTaskIds } });
            }
        }
    });
});

describe('SUITE-3: Ritus Zamanlama, Cuma 16:30 Dağıtımı, Hafta Ortası Ay Geçişi ve Şablon Güncelleme Seçimi', () => {
    it('T3.1: Cuma 16:30 dağıtım kontrolü (Cuma 16:00 öncesi erken tetiklenmez; Cuma 16:35 ve sonrasında W+1 haftası idempotent olarak dağıtılır)', async () => {
        const client = await pulsusMongo.default;
        const db = client.db(pulsusMongo.getDbName('Pulsus_db'));

        // Pick a synthetic future week: Monday 2097-05-06 .. Friday 2097-05-10, Next week Monday: 2097-05-13
        const fridayBefore1630 = new Date(2097, 4, 10, 16, 0, 0); // Local Friday 16:00
        const fridayAfter1630 = new Date(2097, 4, 10, 16, 35, 0); // Local Friday 16:35
        const baseWeekMonday = getMondayOfDate(fridayBefore1630);
        const nextWeekMonday = addDays(baseWeekMonday, 7);

        assert.equal(isFridayDistributionTimeReached(fridayBefore1630), false);
        assert.equal(isFridayDistributionTimeReached(fridayAfter1630), true);

        let tempTplId = null;

        try {
            // Ensure at least one active weekly template exists for T3.1 even if Pulsus_test_db templates were cleared
            const tplIns = await db.collection('ritus_templates').insertOne({
                title: 'CI Cuma 16:30 Dağıtım Test Şablonu',
                category: 'cleaning',
                frequency: 'weekly',
                daysOfWeek: [1, 4],
                scheduledTime: '09:00',
                primaryAssignee: CARE_GOKHAN,
                backupAssignee: CARE_YUSUF,
                primaryReviewer: TECH_KUBRA,
                backupReviewer: TECH_GAMZE,
                checklist: ['Adım 1'],
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            tempTplId = tplIns.insertedId;

            // 1. Calling POST /api/ritus/runs at Friday 16:00 without explicit scope distributes current week (baseWeekMonday), NOT nextWeekMonday
            const beforeRes = mockRes();
            await runsHandler(
                {
                    method: 'POST',
                    headers: { cookie: vetCookie },
                    body: {
                        action: 'distribute',
                        referenceTime: fridayBefore1630.toISOString()
                    }
                },
                beforeRes
            );
            assert.equal(beforeRes.statusCode, 200);
            assert.equal(beforeRes.body.weekStart, baseWeekMonday);

            const nextWeekCountBefore = await db
                .collection('ritus_runs')
                .countDocuments({ weekStart: nextWeekMonday });
            assert.equal(nextWeekCountBefore, 0, 'Next week must NOT be distributed before Friday 16:30');

            // 2. Calling POST /api/ritus/runs at Friday 16:35 distributes nextWeekMonday (W+1)
            const afterRes1 = mockRes();
            await runsHandler(
                {
                    method: 'POST',
                    headers: { cookie: vetCookie },
                    body: {
                        action: 'distribute',
                        referenceTime: fridayAfter1630.toISOString()
                    }
                },
                afterRes1
            );
            assert.equal(afterRes1.statusCode, 200);
            assert.equal(afterRes1.body.weekStart, nextWeekMonday);
            assert.ok(afterRes1.body.createdCount > 0, 'W+1 runs should be created at Friday 16:35');

            // 3. Running distribution a second time for W+1 is idempotent (createdCount === 0, existingCount > 0)
            const afterRes2 = mockRes();
            await runsHandler(
                {
                    method: 'POST',
                    headers: { cookie: vetCookie },
                    body: {
                        action: 'distribute',
                        referenceTime: fridayAfter1630.toISOString()
                    }
                },
                afterRes2
            );
            assert.equal(afterRes2.statusCode, 200);
            assert.equal(afterRes2.body.weekStart, nextWeekMonday);
            assert.equal(afterRes2.body.createdCount, 0, 'Idempotent distribution must not duplicate cards');
            assert.equal(afterRes2.body.existingCount, afterRes1.body.createdCount);
        } finally {
            if (tempTplId) {
                await db.collection('ritus_templates').deleteOne({ _id: tempTplId });
            }
            await db
                .collection('ritus_runs')
                .deleteMany({ weekStart: { $in: [baseWeekMonday, nextWeekMonday] } });
        }
    });

    it('T3.2: Hafta ortası ay ve çeyrek geçişi: 2026-11-09 haftasında Çarşamba (dayOfMonth: 11) aylık ve çeyreklik görevler o haftanın iş paketine dahil edilir', async () => {
        const client = await pulsusMongo.default;
        const db = client.db(pulsusMongo.getDbName('Pulsus_db'));
        const testWeekMonday = '2026-11-09'; // Mon 2026-11-09 .. Sun 2026-11-15 (Wed is 2026-11-11, month=11)

        let monthlyTemplateId = null;
        let quarterlyTemplateId = null;

        try {
            // Create monthly template on dayOfMonth: 11
            const mRes = mockRes();
            await templatesHandler(
                {
                    method: 'POST',
                    headers: { cookie: vetCookie },
                    body: {
                        title: 'CI Hafta Ortası Aylık Kalibrasyon Görevi',
                        category: 'calibration',
                        frequency: 'monthly',
                        dayOfMonth: 11,
                        scheduledTime: '11:00',
                        primaryAssignee: TECH_KUBRA,
                        primaryReviewer: VET_EMAIL,
                        updateScope: 'next_week'
                    }
                },
                mRes
            );
            assert.equal(mRes.statusCode, 201);
            monthlyTemplateId = mRes.body.template._id;

            // Create quarterly template on dayOfMonth: 12, monthsOfQuarter: [2, 5, 8, 11]
            const qRes = mockRes();
            await templatesHandler(
                {
                    method: 'POST',
                    headers: { cookie: vetCookie },
                    body: {
                        title: 'CI Hafta Ortası Çeyreklik Biyogüvenlik Denetimi',
                        category: 'biosecurity',
                        frequency: 'quarterly',
                        dayOfMonth: 12,
                        monthsOfQuarter: [2, 5, 8, 11],
                        scheduledTime: '14:00',
                        primaryAssignee: TECH_GAMZE,
                        primaryReviewer: VET_EMAIL,
                        updateScope: 'next_week'
                    }
                },
                qRes
            );
            assert.equal(qRes.statusCode, 201);
            quarterlyTemplateId = qRes.body.template._id;

            // Distribute the week of 2026-11-09
            await distributeWeekPackage(client, db, testWeekMonday);

            const runs = await db
                .collection('ritus_runs')
                .find({
                    weekStart: testWeekMonday,
                    templateId: { $in: [String(monthlyTemplateId), String(quarterlyTemplateId)] }
                })
                .toArray();

            assert.equal(runs.length, 2, 'Both mid-week monthly and quarterly tasks must be included in the week package');
            const monthlyRun = runs.find(r => r.templateId === String(monthlyTemplateId));
            const quarterlyRun = runs.find(r => r.templateId === String(quarterlyTemplateId));

            assert.equal(monthlyRun.scheduledDate, '2026-11-11');
            assert.equal(quarterlyRun.scheduledDate, '2026-11-12');
        } finally {
            const idsToClean = [monthlyTemplateId, quarterlyTemplateId].filter(Boolean);
            if (idsToClean.length > 0) {
                await db.collection('ritus_templates').deleteMany({ _id: { $in: idsToClean } });
                await db
                    .collection('ritus_runs')
                    .deleteMany({ templateId: { $in: idsToClean.map(String) } });
            }
            await db.collection('ritus_runs').deleteMany({ weekStart: testWeekMonday });
        }
    });

    it('T3.3: Şablon güncelleme kapsamı: updateScope="next_week" mevcut haftayı değiştirmez; updateScope="current_week" mevcut haftadaki tamamlanmamış görevleri anında günceller', async () => {
        const client = await pulsusMongo.default;
        const db = client.db(pulsusMongo.getDbName('Pulsus_db'));
        const targetWeekStart = '2097-06-03'; // Monday

        let templateId = null;

        try {
            // 1. Create template and distribute for targetWeekStart
            const postRes = mockRes();
            await templatesHandler(
                {
                    method: 'POST',
                    headers: { cookie: vetCookie },
                    body: {
                        title: 'CI Kapsam Testi Görevi',
                        category: 'cleaning',
                        frequency: 'weekly',
                        daysOfWeek: [1, 3],
                        scheduledTime: '09:00',
                        primaryAssignee: CARE_GOKHAN,
                        primaryReviewer: TECH_KUBRA,
                        checklist: ['İlk Madde'],
                        updateScope: 'current_week',
                        targetWeekStart
                    }
                },
                postRes
            );
            assert.equal(postRes.statusCode, 201);
            templateId = postRes.body.template._id;
            assert.equal(postRes.body.affectedCurrentWeekRuns, 2);

            // 2. Update with updateScope: 'next_week' -> current week runs MUST remain unchanged ('09:00', ['İlk Madde'])
            const putNextWeekRes = mockRes();
            await templatesHandler(
                {
                    method: 'PUT',
                    headers: { cookie: vetCookie },
                    body: {
                        id: String(templateId),
                        title: 'CI Kapsam Testi Görevi (Gelecek Hafta)',
                        category: 'cleaning',
                        frequency: 'weekly',
                        daysOfWeek: [1, 3],
                        scheduledTime: '15:30',
                        primaryAssignee: CARE_GOKHAN,
                        primaryReviewer: TECH_KUBRA,
                        checklist: ['İlk Madde', 'İkinci Madde'],
                        updateScope: 'next_week',
                        targetWeekStart
                    }
                },
                putNextWeekRes
            );
            assert.equal(putNextWeekRes.statusCode, 200);
            assert.equal(putNextWeekRes.body.affectedCurrentWeekRuns, 0);

            const runsAfterNextScope = await db
                .collection('ritus_runs')
                .find({ templateId: String(templateId), weekStart: targetWeekStart })
                .toArray();
            assert.equal(runsAfterNextScope.length, 2);
            assert.equal(runsAfterNextScope[0].scheduledTime, '09:00');
            assert.equal(runsAfterNextScope[0].checklist.length, 1);

            // 3. Update with updateScope: 'current_week' -> current week uncompleted runs MUST immediately reflect '16:15' and 2 checklist items
            const putCurrentWeekRes = mockRes();
            await templatesHandler(
                {
                    method: 'PUT',
                    headers: { cookie: vetCookie },
                    body: {
                        id: String(templateId),
                        title: 'CI Kapsam Testi Görevi (Bu Hafta Güncel)',
                        category: 'cleaning',
                        frequency: 'weekly',
                        daysOfWeek: [1, 3],
                        scheduledTime: '16:15',
                        primaryAssignee: CARE_GOKHAN,
                        primaryReviewer: TECH_KUBRA,
                        checklist: ['İlk Madde', 'İkinci Madde'],
                        updateScope: 'current_week',
                        targetWeekStart
                    }
                },
                putCurrentWeekRes
            );
            assert.equal(putCurrentWeekRes.statusCode, 200);
            assert.equal(putCurrentWeekRes.body.affectedCurrentWeekRuns, 2);

            const runsAfterCurScope = await db
                .collection('ritus_runs')
                .find({ templateId: String(templateId), weekStart: targetWeekStart })
                .toArray();
            assert.equal(runsAfterCurScope[0].scheduledTime, '16:15');
            assert.equal(runsAfterCurScope[0].title, 'CI Kapsam Testi Görevi (Bu Hafta Güncel)');
            assert.equal(runsAfterCurScope[0].checklist.length, 2);
        } finally {
            if (templateId) {
                await db.collection('ritus_templates').deleteOne({ _id: templateId });
                await db.collection('ritus_runs').deleteMany({ templateId: String(templateId) });
            }
        }
    });
});

describe('SUITE-4: Circa İzin Entegrasyonu ve Yedek (Backup) Devir Zinciri (Circa_test_db.time_offs)', () => {
    const testDate = '2097-08-12'; // Monday of week 2097-08-12

    after(async () => {
        const client = await pulsusMongo.default;
        const circaDb = client.db(pulsusMongo.getDbName('Circa_db'));
        await circaDb.collection('time_offs').deleteMany({ description: /^CI_PULSUS_LEAVE_TEST/ });
    });

    it('T4.1: Asil sorumlu (Gökhan) izinli değilken effectiveAssignee asil sorumludur (assignmentStatus: "primary")', async () => {
        const client = await pulsusMongo.default;
        const resolved = await resolveTaskAssignment(client, {
            primaryAssignee: CARE_GOKHAN,
            backupAssignee: CARE_YUSUF,
            primaryReviewer: TECH_KUBRA,
            backupReviewer: TECH_GAMZE,
            vetEmail: VET_EMAIL,
            dateStr: testDate,
            scheduledTime: '09:00'
        });

        assert.equal(resolved.effectiveAssignee, CARE_GOKHAN);
        assert.equal(resolved.assignmentStatus, 'primary');
        assert.equal(resolved.delegatedFrom, null);
        assert.equal(resolved.vetFallback, false);
    });

    it('T4.2: Asil sorumlu (Gökhan) Circa_test_db üzerinde onaylı günlük izindeyken görev otomatik olarak Yedek Sorumluya (Yusuf Enes) devredilir (assignmentStatus: "backup")', async () => {
        const client = await pulsusMongo.default;
        const circaDb = client.db(pulsusMongo.getDbName('Circa_db'));

        const leaveInsert = await circaDb.collection('time_offs').insertOne({
            name: 'Gökhan Sert',
            email: CARE_GOKHAN,
            unit: 'daily',
            dates: [testDate],
            totalHours: 8,
            status: 'approved',
            description: 'CI_PULSUS_LEAVE_TEST_GOKHAN'
        });

        try {
            const resolved = await resolveTaskAssignment(client, {
                primaryAssignee: CARE_GOKHAN,
                backupAssignee: CARE_YUSUF,
                primaryReviewer: TECH_KUBRA,
                backupReviewer: TECH_GAMZE,
                vetEmail: VET_EMAIL,
                dateStr: testDate,
                scheduledTime: '09:00'
            });

            assert.equal(resolved.effectiveAssignee, CARE_YUSUF);
            assert.equal(resolved.assignmentStatus, 'backup');
            assert.equal(resolved.delegatedFrom, CARE_GOKHAN);
            assert.equal(resolved.vetFallback, false);
        } finally {
            await circaDb.collection('time_offs').deleteOne({ _id: leaveInsert.insertedId });
        }
    });

    it('T4.3: Hem Asil hem Yedek izinliyken (veya yedek boşken) görev Sorumlu Veteriner Hekime (vet_fallback) düşer ve Veteriner Hekim "vet_reassign" ile yeniden atayabilir', async () => {
        const client = await pulsusMongo.default;
        const circaDb = client.db(pulsusMongo.getDbName('Circa_db'));
        const pulsusDb = client.db(pulsusMongo.getDbName('Pulsus_db'));

        const leaveDocs = await circaDb.collection('time_offs').insertMany([
            {
                name: 'Gökhan Sert',
                email: CARE_GOKHAN,
                unit: 'daily',
                dates: [testDate],
                totalHours: 8,
                status: 'approved',
                description: 'CI_PULSUS_LEAVE_TEST_BOTH_1'
            },
            {
                name: 'Yusuf Enes Işık',
                email: CARE_YUSUF,
                unit: 'daily',
                dates: [testDate],
                totalHours: 8,
                status: 'approved',
                description: 'CI_PULSUS_LEAVE_TEST_BOTH_2'
            }
        ]);

        let tempRunId = null;

        try {
            const resolved = await resolveTaskAssignment(client, {
                primaryAssignee: CARE_GOKHAN,
                backupAssignee: CARE_YUSUF,
                primaryReviewer: TECH_KUBRA,
                backupReviewer: TECH_GAMZE,
                vetEmail: VET_EMAIL,
                dateStr: testDate,
                scheduledTime: '09:00'
            });

            assert.equal(resolved.effectiveAssignee, VET_EMAIL);
            assert.equal(resolved.assignmentStatus, 'vet_fallback');
            assert.equal(resolved.vetFallback, true);
            assert.equal(resolved.delegatedFrom, CARE_GOKHAN);

            // Insert a run in vet_fallback state and test PATCH /api/ritus/runs with action: 'vet_reassign'
            const runInsert = await pulsusDb.collection('ritus_runs').insertOne({
                templateId: 'ci_temp_template',
                title: 'CI Vet Fallback Reassign Testi',
                category: 'feeding',
                frequency: 'weekly',
                weekStart: testDate,
                scheduledDate: testDate,
                scheduledTime: '09:00',
                primaryAssignee: CARE_GOKHAN,
                backupAssignee: CARE_YUSUF,
                effectiveAssignee: VET_EMAIL,
                assignmentStatus: 'vet_fallback',
                delegatedFrom: CARE_GOKHAN,
                vetFallback: true,
                primaryReviewer: TECH_KUBRA,
                backupReviewer: TECH_GAMZE,
                effectiveReviewer: TECH_KUBRA,
                reviewerStatus: 'primary',
                status: 'todo',
                checklist: [],
                revisionCount: 0,
                reviewHistory: [],
                spawnedSequaIds: []
            });
            tempRunId = runInsert.insertedId;

            const reassignRes = mockRes();
            await runsHandler(
                {
                    method: 'PATCH',
                    headers: { cookie: vetCookie },
                    body: {
                        id: String(tempRunId),
                        action: 'vet_reassign',
                        newAssigneeEmail: TECH_GAMZE,
                        note: 'İki bakıcı da izinli olduğu için görev Gamze teknikere devredildi.'
                    }
                },
                reassignRes
            );
            assert.equal(reassignRes.statusCode, 200);
            assert.equal(reassignRes.body.run.effectiveAssignee, TECH_GAMZE);
            assert.equal(reassignRes.body.run.assignmentStatus, 'reassigned_by_vet');
            assert.equal(reassignRes.body.run.reassignedByVet, true);
        } finally {
            await circaDb
                .collection('time_offs')
                .deleteMany({ _id: { $in: Object.values(leaveDocs.insertedIds) } });
            if (tempRunId) {
                await pulsusDb.collection('ritus_runs').deleteOne({ _id: tempRunId });
            }
        }
    });

    it('T4.4: Denetçi (Reviewer) yedek zinciri: Asil denetçi (Kübra) saatlik/günlük izindeyken Yedek Denetçi (Gamze), o da izinliyse Veteriner Hekim devreye girer', async () => {
        const client = await pulsusMongo.default;
        const circaDb = client.db(pulsusMongo.getDbName('Circa_db'));

        // 1. Kübra on approved hourly leave 08:00 - 12:00 at scheduledTime '09:30' -> Gamze becomes effectiveReviewer
        const kubraHourly = await circaDb.collection('time_offs').insertOne({
            name: 'Kübra Çelik',
            email: TECH_KUBRA,
            unit: 'hourly',
            singleDate: testDate,
            startTime: '08:00',
            endTime: '12:00',
            totalHours: 4,
            status: 'approved',
            description: 'CI_PULSUS_LEAVE_TEST_KUBRA_HOURLY'
        });

        let gamzeDailyId = null;

        try {
            const resBackupRev = await resolveTaskAssignment(client, {
                primaryAssignee: CARE_GOKHAN,
                backupAssignee: CARE_YUSUF,
                primaryReviewer: TECH_KUBRA,
                backupReviewer: TECH_GAMZE,
                vetEmail: VET_EMAIL,
                dateStr: testDate,
                scheduledTime: '09:30'
            });

            assert.equal(resBackupRev.effectiveReviewer, TECH_GAMZE);
            assert.equal(resBackupRev.reviewerStatus, 'backup');
            assert.equal(resBackupRev.reviewerDelegatedFrom, TECH_KUBRA);

            // 2. Gamze ALSO on approved leave -> Reviewer falls back to VET_EMAIL
            const gamzeDaily = await circaDb.collection('time_offs').insertOne({
                name: 'Gamze Demir',
                email: TECH_GAMZE,
                unit: 'daily',
                dates: [testDate],
                totalHours: 8,
                status: 'approved',
                description: 'CI_PULSUS_LEAVE_TEST_GAMZE_DAILY'
            });
            gamzeDailyId = gamzeDaily.insertedId;

            const resVetRev = await resolveTaskAssignment(client, {
                primaryAssignee: CARE_GOKHAN,
                backupAssignee: CARE_YUSUF,
                primaryReviewer: TECH_KUBRA,
                backupReviewer: TECH_GAMZE,
                vetEmail: VET_EMAIL,
                dateStr: testDate,
                scheduledTime: '09:30'
            });

            assert.equal(resVetRev.effectiveReviewer, VET_EMAIL);
            assert.equal(resVetRev.reviewerStatus, 'vet_fallback');
            assert.equal(resVetRev.reviewerVetFallback, true);
        } finally {
            const delIds = [kubraHourly.insertedId, gamzeDailyId].filter(Boolean);
            await circaDb.collection('time_offs').deleteMany({ _id: { $in: delIds } });
        }
    });
});

describe('SUITE-5: Denetim (Review), Tekrarlatma (needs_revision), Eskalasyon (escalated) ve Ritus -> Sequa Köprüsü', () => {
    let testRunId = null;
    const spawnedSequaIds = [];

    before(async () => {
        const client = await pulsusMongo.default;
        const db = client.db(pulsusMongo.getDbName('Pulsus_db'));
        const insertRes = await db.collection('ritus_runs').insertOne({
            templateId: 'ci_suite5_template',
            title: 'CI Denetim ve Eskalasyon Test Görevi',
            description: 'Suluk ve kafes kontrolü.',
            category: 'feeding',
            frequency: 'weekly',
            weekStart: '2097-09-02',
            scheduledDate: '2097-09-02',
            scheduledTime: '08:30',
            primaryAssignee: CARE_GOKHAN,
            backupAssignee: CARE_YUSUF,
            effectiveAssignee: CARE_GOKHAN,
            assignmentStatus: 'primary',
            delegatedFrom: null,
            vetFallback: false,
            primaryReviewer: TECH_KUBRA,
            backupReviewer: TECH_GAMZE,
            effectiveReviewer: TECH_KUBRA,
            reviewerStatus: 'primary',
            reviewerDelegatedFrom: null,
            reviewerVetFallback: false,
            status: 'todo',
            checklist: [
                { id: 0, text: 'Suluklar kontrol edildi', done: false },
                { id: 1, text: 'Yemlikler tamamlandı', done: false }
            ],
            revisionCount: 0,
            reviewHistory: [],
            spawnedSequaIds: [],
            createdAt: new Date(),
            updatedAt: new Date()
        });
        testRunId = insertRes.insertedId;
    });

    after(async () => {
        const client = await pulsusMongo.default;
        const db = client.db(pulsusMongo.getDbName('Pulsus_db'));
        if (testRunId) {
            await db.collection('ritus_runs').deleteOne({ _id: testRunId });
        }
        if (spawnedSequaIds.length > 0) {
            await db.collection('sequa_tasks').deleteMany({ sourceRitusRunId: String(testRunId) });
        }
    });

    it('T5.1: Bakıcı görevi denetime gönderir (pending_review), kendi görevini onaylayamaz (403); Tekniker "request_revision" ile tekrar ister -> status: "needs_revision", revisionCount: 1', async () => {
        // 1. Caretaker starts & submits for review
        const startRes = mockRes();
        await runsHandler(
            {
                method: 'PATCH',
                headers: { cookie: gokhanCookie },
                body: { id: String(testRunId), action: 'start' }
            },
            startRes
        );
        assert.equal(startRes.statusCode, 200);
        assert.equal(startRes.body.run.status, 'in_progress');

        const submitRes = mockRes();
        await runsHandler(
            {
                method: 'PATCH',
                headers: { cookie: gokhanCookie },
                body: {
                    id: String(testRunId),
                    action: 'submit_for_review',
                    note: 'Suluklar ve yemlikler kontrol edildi.'
                }
            },
            submitRes
        );
        assert.equal(submitRes.statusCode, 200);
        assert.equal(submitRes.body.run.status, 'pending_review');

        // 2. Caretaker attempting to approve own run -> 403 Forbidden
        const selfApproveRes = mockRes();
        await runsHandler(
            {
                method: 'PATCH',
                headers: { cookie: gokhanCookie },
                body: { id: String(testRunId), action: 'approve' }
            },
            selfApproveRes
        );
        assert.equal(selfApproveRes.statusCode, 403);

        // 3. Technician (Kübra) calls request_revision -> status: 'needs_revision', revisionCount: 1
        const revNote = 'Suluklar eksik kontrol edilmiş, tekrar yapılacak';
        const revRes = mockRes();
        await runsHandler(
            {
                method: 'PATCH',
                headers: { cookie: kubraCookie },
                body: {
                    id: String(testRunId),
                    action: 'request_revision',
                    note: revNote
                }
            },
            revRes
        );
        assert.equal(revRes.statusCode, 200);
        assert.equal(revRes.body.run.status, 'needs_revision');
        assert.equal(revRes.body.run.revisionCount, 1);
        assert.equal(revRes.body.run.lastRevisionNote, revNote);
    });

    it('T5.2: Tekniker "escalate_to_vet" (spawnSequa: true) çağırır -> Ritus durumu "escalated" olur ve bağlı Sequa görevi otomatik oluşturulur', async () => {
        const escRes = mockRes();
        await runsHandler(
            {
                method: 'PATCH',
                headers: { cookie: kubraCookie },
                body: {
                    id: String(testRunId),
                    action: 'escalate_to_vet',
                    note: 'Oda-1 IVC basınç düşüşü ve kafes #8 klinik muayene gereksinimi.',
                    spawnSequa: true,
                    sequaTitle: 'CI Ritus Eskalasyon Klinik & Teknik İnceleme',
                    sequaPriority: 'critical'
                }
            },
            escRes
        );
        assert.equal(escRes.statusCode, 200);
        assert.equal(escRes.body.run.status, 'escalated');
        assert.equal(escRes.body.run.escalatedTo, VET_EMAIL);
        assert.ok(escRes.body.spawnedSequaTask, 'Spawned Sequa task must be returned');
        assert.equal(escRes.body.spawnedSequaTask.sourceRitusRunId, String(testRunId));
        assert.ok(
            escRes.body.run.spawnedSequaIds.includes(String(escRes.body.spawnedSequaTask._id)),
            'spawnedSequaIds must track the new Sequa task ID'
        );
        spawnedSequaIds.push(escRes.body.spawnedSequaTask._id);
    });

    it('T5.3: Denetçi / Veteriner Hekim onaylar (approve) -> status: "done"', async () => {
        const approveRes = mockRes();
        await runsHandler(
            {
                method: 'PATCH',
                headers: { cookie: vetCookie },
                body: {
                    id: String(testRunId),
                    action: 'approve',
                    note: 'Muayene ve düzeltici işlem tamamlandı, onaylandı.'
                }
            },
            approveRes
        );
        assert.equal(approveRes.statusCode, 200);
        assert.equal(approveRes.body.run.status, 'done');
        assert.equal(approveRes.body.run.approvedBy, VET_EMAIL);
    });
});

describe('SUITE-6: Raporlama (GET /api/reports)', () => {
    it('T6.1: /api/reports 200 döner ve summary, staffMetrics, recentRevisionsAndEscalations ile externalTasks verilerini eksiksiz içerir', async () => {
        const repRes = mockRes();
        await reportsHandler({ method: 'GET', headers: { cookie: vetCookie }, query: {} }, repRes);
        assert.equal(repRes.statusCode, 200);

        const { summary, staffMetrics, recentRevisionsAndEscalations, externalTasks } = repRes.body;
        assert.ok(summary && typeof summary.totalRuns === 'number');
        assert.ok(Array.isArray(staffMetrics) && staffMetrics.length >= 5);
        assert.ok(Array.isArray(recentRevisionsAndEscalations));
        assert.ok(Array.isArray(externalTasks));

        // Verify key metrics fields exist on staffMetrics items
        const sampleStaff = staffMetrics[0];
        assert.equal(typeof sampleStaff.totalRevisionsReceived, 'number');
        assert.equal(typeof sampleStaff.escalatedCount, 'number');
        assert.equal(typeof sampleStaff.delegatedOutByLeave, 'number');
    });
});

after(async () => {
    const client = await pulsusMongo.default;
    const apexDb = client.db(pulsusMongo.getDbName('Apex_db'));
    const usersCol = apexDb.collection('users');

    if (createdTempUsers.length > 0) {
        await usersCol.deleteMany({ email: { $in: createdTempUsers } });
    }
    try {
        await client.close();
    } catch {
        // ignore if already closed
    }
});

