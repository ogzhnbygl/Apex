export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const isProd = process.env.NODE_ENV === 'production';
    const domainAttribute = isProd ? 'Domain=.wildtype.app;' : '';

    res.setHeader('Set-Cookie', `interapp_session=; Path=/; ${domainAttribute} HttpOnly; SameSite=Lax; Max-Age=0`);

    return res.status(200).json({ message: 'Logged out' });
}
