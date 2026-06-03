import { verifyAuth } from '../lib/auth.js';

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
