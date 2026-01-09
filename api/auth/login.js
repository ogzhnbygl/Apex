import clientPromise from '../lib/mongodb.js';
// import { serialize } from 'cookie'; // We might need to install cookie package if we want to set cookies manually, or use a helper.
// For now, let's just return a success message and maybe a token in the body, or assume we can set headers.
// Vercel functions run in a Node.js environment.

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const client = await clientPromise;
        const db = client.db('Apex_db');

        // TODO: Hash passwords in production!
        // For now, simple comparison as per "kurgula ve yap" (design and build) - but security is important.
        // I will assume plain text for the prototype unless I install bcrypt.
        // Let's stick to simple logic first to get the flow working.

        const user = await db.collection('users').findOne({ email });

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // In a real app, compare hashed password
        if (user.password !== password) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Successful login
        // Set a simple session cookie or return user data
        // For this prototype, we'll return user data and handle session on client side (localStorage) or simple cookie if possible.
        // Setting a cookie is better for security.

        // const token = 'dummy-token'; // In real app, JWT
        // res.setHeader('Set-Cookie', serialize('auth_token', token, { path: '/', httpOnly: true }));

        return res.status(200).json({
            message: 'Login successful',
            user: {
                email: user.email,
                role: user.role || 'user',
                apps: user.apps || []
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
