import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('Error: MONGODB_URI is not defined in .env');
    process.exit(1);
}

console.log('Attempting to connect to MongoDB...');

const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        console.log('Successfully connected to MongoDB!');

        // Optional: List databases to confirm permissions
        const adminDb = client.db().admin();
        const dbInfo = await adminDb.listDatabases();
        console.log('Databases:');
        dbInfo.databases.forEach(db => console.log(` - ${db.name}`));

    } catch (err) {
        console.error('Connection failed:', err);
    } finally {
        await client.close();
        console.log('Connection closed.');
    }
}

run();
