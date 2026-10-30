import { getSessionCookieName } from '../lib/mongodb.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    // Determine domain dynamically to avoid browser blocking cookies on vercel.app
    const host = (req.headers.host || '').split(':')[0];
    const cookieName = getSessionCookieName();
    const isWildtypeDomain = host === 'wildtype.app' || host.endsWith('.wildtype.app');
    const domainAttribute = isWildtypeDomain ? 'Domain=.wildtype.app;' : '';
    const secureAttribute = (process.env.NODE_ENV === 'production' || isWildtypeDomain) ? 'Secure;' : '';

    res.setHeader('Set-Cookie', `${cookieName}=; Path=/; ${domainAttribute} ${secureAttribute} HttpOnly; SameSite=Lax; Max-Age=0`);

    return res.status(200).json({ message: 'Logged out' });
}
