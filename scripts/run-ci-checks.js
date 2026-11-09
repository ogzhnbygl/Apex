import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APEX_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(APEX_DIR, '..');

const ALL_MODULES = ['Apex', 'Circa', 'Dispo', 'LabProject', 'Locus', 'Pulsus', 'Silo'];

const args = process.argv.slice(2);
const withE2E = args.includes('--with-e2e');
const moduleArg = args.find((a) => !a.startsWith('--'));

const targetModules = moduleArg
    ? ALL_MODULES.filter((m) => m.toLowerCase() === moduleArg.toLowerCase())
    : ALL_MODULES;

if (targetModules.length === 0) {
    console.error(`❌ Bilinmeyen modül: ${moduleArg}`);
    process.exit(1);
}

console.log('\n🛡️  [1/3] Derleme (Build) Kontrolleri Başlatılıyor...');
for (const mod of targetModules) {
    const modDir = path.join(ROOT_DIR, mod);
    process.stdout.write(`   • ${mod} derleniyor... `);
    const buildRes = spawnSync('npm', ['run', 'build'], { cwd: modDir, encoding: 'utf8' });
    if (buildRes.status !== 0) {
        console.log('❌ HATA');
        console.error(buildRes.stderr || buildRes.stdout);
        process.exit(1);
    }
    if (mod === 'Dispo') {
        spawnSync('git', ['checkout', '--', 'dist/'], { cwd: modDir, encoding: 'utf8' });
    }
    console.log('✅');
}

console.log('\n🧪 [2/3] Merkezi API, Güvenlik & Yetki Testleri Çalıştırılıyor (*_test_db)...');
const apiRes = spawnSync('node', ['--test', 'tests/api/ecosystem.test.js', 'tests/api/pulsus.test.js'], {
    cwd: APEX_DIR,
    stdio: 'inherit'
});
if (apiRes.status !== 0) {
    console.error('\n❌ API & Yetki testleri başarısız oldu! İşlem durduruldu.');
    process.exit(1);
}

if (withE2E) {
    console.log('\n🌐 [3/3] Playwright Tarayıcı (E2E) Testleri Çalıştırılıyor...');
    const e2eRes = spawnSync('npx', ['playwright', 'test'], {
        cwd: APEX_DIR,
        stdio: 'inherit'
    });
    if (e2eRes.status !== 0) {
        console.error('\n❌ Tarayıcı (E2E) testleri başarısız oldu! İşlem durduruldu.');
        process.exit(1);
    }
} else {
    console.log('\nℹ️  [3/3] Tarayıcı (E2E) adımı hızlı modda atlandı (tam kontrol için: npm test).');
}

console.log('\n✅ Tüm otomatik kontroller başarıyla geçti!\n');
