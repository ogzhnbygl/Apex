import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import clientPromise from '../lib/mongodb.js';

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

        const user = await db.collection('users').findOne({ email });

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Successful login - Create signed JWT token
        const sessionPayload = {
            email: user.email,
            role: user.role || 'user',
            apps: user.apps || [],
            name: user.name || user.email.split('@')[0]
        };

        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET environment variable is missing.');
        }
        const JWT_SECRET = process.env.JWT_SECRET;
        const token = jwt.sign(sessionPayload, JWT_SECRET, { expiresIn: '1d' });

        // Determine domain dynamically to avoid browser blocking cookies on vercel.app
        const host = req.headers.host || '';
        const isProd = process.env.NODE_ENV === 'production';
        const isWildtypeDomain = host.endsWith('wildtype.app');
        const domainAttribute = (isProd && isWildtypeDomain) ? 'Domain=.wildtype.app;' : '';

        res.setHeader('Set-Cookie', `interapp_session=${token}; Path=/; ${domainAttribute} HttpOnly; SameSite=Lax; Max-Age=86400`);

        return res.status(200).json({
            message: 'Login successful',
            user: sessionPayload
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
