import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Load Apex/.env for local runs if env vars are not already injected
const envVars = { ...process.env };
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m && !envVars[m[1]]) {
            envVars[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
        }
    }
}

// Force isolated test databases (*_test_db) and test session cookie (interapp_session_test)
envVars.VERCEL_ENV = 'preview';
delete envVars.FORCE_PROD_DB;

const SERVER_SPECS = [
    { name: 'Apex', port: 4171 },
    { name: 'Circa', port: 4172 },
    { name: 'Dispo', port: 4173 },
    { name: 'LabProject', port: 4174 },
    { name: 'Silo', port: 4175 }
];

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 45_000,
    expect: { timeout: 10_000 },
    fullyParallel: false,
    retries: process.env.CI ? 1 : 0,
    reporter: 'list',
    use: {
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure'
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ],
    webServer: SERVER_SPECS.map((srv) => ({
        command: `npx vite --port ${srv.port} --strictPort`,
        cwd: path.join(ROOT_DIR, srv.name),
        url: `http://localhost:${srv.port}`,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
        env: envVars
    }))
});
