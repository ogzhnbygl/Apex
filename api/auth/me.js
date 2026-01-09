import clientPromise from '../lib/mongodb.js';

export default async function handler(req, res) {
    // Enable CORS for *.wildtype.app and localhost
    const origin = req.headers.origin;
    if (origin && (origin.endsWith('.wildtype.app') || origin.includes('localhost'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    }

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // 1. Check for cookie
        const cookies = req.headers.cookie;
        let userFromCookie = null;

        if (cookies) {
            const match = cookies.match(/interapp_session=([^;]+)/);
            if (match && match[1]) {
                const token = match[1];
                try {
                    const sessionData = Buffer.from(token, 'base64').toString('utf-8');
                    userFromCookie = JSON.parse(sessionData);
                } catch (e) {
                    console.error('Invalid session cookie');
                }
            }
        }

        if (userFromCookie) {
            // Validate user existence (optional but recommended for security)
            const client = await clientPromise;
            const db = client.db('Apex_db');
            const user = await db.collection('users').findOne({ email: userFromCookie.email });

            if (user) {
                return res.status(200).json({
                    email: user.email,
                    role: user.role,
                    apps: user.apps
                });
            }
        }

        // 2. Fallback to Bearer token (legacy/testing support)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const email = authHeader.split(' ')[1];
            const client = await clientPromise;
            const db = client.db('Apex_db');
            const user = await db.collection('users').findOne({ email });

            if (user) {
                return res.status(200).json({
                    email: user.email,
                    role: user.role,
                    apps: user.apps
                });
            }
        }

        return res.status(401).json({ message: 'Unauthorized' });

    } catch (error) {
        console.error('Auth check error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
