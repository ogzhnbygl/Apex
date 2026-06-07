export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    // Determine domain dynamically to avoid browser blocking cookies on vercel.app
    const host = req.headers.host || '';
    const isProd = process.env.NODE_ENV === 'production';
    const isWildtypeDomain = host.endsWith('wildtype.app');
    const domainAttribute = (isProd && isWildtypeDomain) ? 'Domain=.wildtype.app;' : '';

    res.setHeader('Set-Cookie', `interapp_session=; Path=/; ${domainAttribute} HttpOnly; SameSite=Lax; Max-Age=0`);

    return res.status(200).json({ message: 'Logged out' });
}
