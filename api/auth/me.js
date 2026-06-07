import { verifyAuth } from '../lib/auth.js';

function isAllowedOrigin(origin) {
    if (!origin) return false;
    try {
        const parsed = new URL(origin);
        const hostname = parsed.hostname;
        return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'wildtype.app' || hostname.endsWith('.wildtype.app');
    } catch (e) {
        return false;
    }
}

export default async function handler(req, res) {
    // Enable CORS for *.wildtype.app and localhost
    const origin = req.headers.origin;
    if (isAllowedOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    }

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const user = await verifyAuth(req);

        if (user) {
            return res.status(200).json({
                email: user.email,
                role: user.role,
                apps: user.apps,
                name: user.name || user.email.split('@')[0]
            });
        }

        return res.status(401).json({ message: 'Unauthorized' });

    } catch (error) {
        console.error('Auth check error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
