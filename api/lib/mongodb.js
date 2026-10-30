import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {};

let client;
let clientPromise;

if (!process.env.MONGODB_URI) {
    // In development mode, we might not have the env var set yet, 
    // but we should warn about it.
    console.warn('Please add your Mongo URI to .env.local');
} else {
    if (process.env.NODE_ENV === 'development') {
        // In development mode, use a global variable so that the value
        // is preserved across module reloads caused by HMR (Hot Module Replacement).
        if (!global._mongoClientPromise) {
            client = new MongoClient(uri, options);
            global._mongoClientPromise = client.connect();
        }
        clientPromise = global._mongoClientPromise;
    } else {
        // In production mode, it's best to not use a global variable.
        client = new MongoClient(uri, options);
        clientPromise = client.connect();
    }
}

export function isProdEnv() {
    return process.env.VERCEL_ENV === 'production' || process.env.FORCE_PROD_DB === 'true';
}

export function getDbName(baseName) {
    if (isProdEnv()) return baseName;
    return baseName.endsWith('_db')
        ? baseName.replace(/_db$/, '_test_db')
        : `${baseName}_test`;
}

export function getSessionCookieName() {
    return isProdEnv() ? 'interapp_session' : 'interapp_session_test';
}

export default clientPromise;
