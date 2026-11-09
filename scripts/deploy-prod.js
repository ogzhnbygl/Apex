import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APEX_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(__dirname, '../..');

const MODULES = [
    { name: 'Apex', domain: 'wildtype.app' },
    { name: 'Circa', domain: 'circa.wildtype.app' },
    { name: 'Dispo', domain: 'dispo.wildtype.app' },
    { name: 'LabProject', domain: 'labproject.wildtype.app' },
    { name: 'Locus', domain: 'locus.wildtype.app' },
    { name: 'Pulsus', domain: 'pulsus.wildtype.app' },
    { name: 'Silo', domain: 'silo.wildtype.app' },
];

const rawArgs = process.argv.slice(2);
const skipTests = rawArgs.includes('--skip-tests');
const filterArg = rawArgs.find((a) => !a.startsWith('--'))?.toLowerCase();

const selected = filterArg
    ? MODULES.filter((m) => m.name.toLowerCase() === filterArg)
    : MODULES;

if (selected.length === 0) {
    console.error(`Bilinmeyen modül: ${filterArg}`);
    process.exit(1);
}

if (!skipTests) {
    const checkArgs = ['scripts/run-ci-checks.js', '--with-e2e'];
    if (filterArg) checkArgs.push(filterArg);
    const gateRes = spawnSync('node', checkArgs, { cwd: APEX_DIR, stdio: 'inherit' });
    if (gateRes.status !== 0) {
        console.error('🛑 Otomatik test kapısı (Build + API + Playwright E2E) geçilemedi! Canlı deploy iptal edildi.');
        process.exit(1);
    }
}

for (const mod of selected) {
    const cwd = path.join(ROOT_DIR, mod.name);
    console.log(`\n🚀 [${mod.name}] CANLI (Production) ortama deploy ediliyor...`);
    const deployRes = spawnSync('vercel', ['deploy', '--prod', '--yes'], {
        cwd,
        encoding: 'utf8',
    });
    if (deployRes.status !== 0) {
        console.error(deployRes.stderr || deployRes.stdout);
        process.exit(1);
    }
    console.log(`   ✅ Canlı Adres Güncellendi: https://${mod.domain}`);
}
