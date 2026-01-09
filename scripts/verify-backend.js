import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars BEFORE importing modules that use them
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

// Dynamic imports
const { default: registerHandler } = await import('../api/auth/register.js');
const { default: loginHandler } = await import('../api/auth/login.js');
const { default: adminHandler } = await import('../api/admin/users.js');

// Mock Response object
class MockResponse {
    constructor() {
        this.statusCode = 200;
        this.body = null;
        this.headers = {};
    }

    status(code) {
        this.statusCode = code;
        return this;
    }

    json(data) {
        this.body = data;
        return this;
    }

    setHeader(key, value) {
        this.headers[key] = value;
    }
}

async function runTests() {
    console.log('Starting verification...');

    const testEmail = `test_${Date.now()}@example.com`;
    const testPassword = 'password123';

    // 1. Test Register
    console.log('\nTesting Register...');
    const regRes = new MockResponse();
    await registerHandler({
        method: 'POST',
        body: { email: testEmail, password: testPassword }
    }, regRes);

    console.log(`Register Status: ${regRes.statusCode}`);
    console.log('Register Body:', regRes.body);

    if (regRes.statusCode !== 201) {
        console.error('Register failed!');
        process.exit(1);
    }

    // 2. Test Login
    console.log('\nTesting Login...');
    const loginRes = new MockResponse();
    await loginHandler({
        method: 'POST',
        body: { email: testEmail, password: testPassword }
    }, loginRes);

    console.log(`Login Status: ${loginRes.statusCode}`);
    console.log('Login Body:', loginRes.body);

    if (loginRes.statusCode !== 200) {
        console.error('Login failed!');
        process.exit(1);
    }

    // 3. Test Admin Users List
    console.log('\nTesting Admin Users List...');
    const adminRes = new MockResponse();
    await adminHandler({
        method: 'GET'
    }, adminRes);

    console.log(`Admin Status: ${adminRes.statusCode}`);
    console.log(`Found ${adminRes.body.length} users.`);

    const createdUser = adminRes.body.find(u => u.email === testEmail);
    if (!createdUser) {
        console.error('Created user not found in admin list!');
        process.exit(1);
    }
    console.log('Created user found in list:', createdUser);

    console.log('\nVerification Successful!');
    process.exit(0);
}

runTests().catch(console.error);
