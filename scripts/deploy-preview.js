import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

const MODULES = [
    { name: 'Apex', alias: 'test.wildtype.app' },
    { name: 'Circa', alias: 'test-circa.wildtype.app' },
    { name: 'Dispo', alias: 'test-dispo.wildtype.app' },
    { name: 'LabProject', alias: 'test-labproject.wildtype.app' },
    { name: 'Locus', alias: 'test-locus.wildtype.app' },
    { name: 'Silo', alias: 'test-silo.wildtype.app' },
];

const filterArg = process.argv[2]?.toLowerCase();
const selected = filterArg
    ? MODULES.filter((m) => m.name.toLowerCase() === filterArg)
    : MODULES;

if (selected.length === 0) {
    console.error(`Bilinmeyen modül: ${process.argv[2]}`);
    process.exit(1);
}

for (const mod of selected) {
    const cwd = path.join(ROOT_DIR, mod.name);
    console.log(`\n🚀 [${mod.name}] Preview ortamına deploy ediliyor...`);
    const deployRes = spawnSync('vercel', ['deploy', '--yes'], { cwd, encoding: 'utf8' });
    if (deployRes.status !== 0) {
        console.error(deployRes.stderr || deployRes.stdout);
        process.exit(1);
    }

    const previewUrl = deployRes.stdout.trim().split(/\s+/).pop();
    console.log(`   Preview URL: ${previewUrl}`);

    const aliasRes = spawnSync('vercel', ['alias', 'set', previewUrl, mod.alias], {
        cwd,
        encoding: 'utf8',
    });
    if (aliasRes.status !== 0) {
        console.error(aliasRes.stderr || aliasRes.stdout);
        process.exit(1);
    }
    console.log(`   ✅ Aktif Test Adresi: https://${mod.alias}`);
}
