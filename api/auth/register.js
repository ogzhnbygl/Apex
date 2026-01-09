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

        const existingUser = await db.collection('users').findOne({ email });

        if (existingUser) {
            return res.status(409).json({ message: 'User already exists' });
        }

        const newUser = {
            email,
            password, // TODO: Hash this!
            role: 'user', // Default role
            apps: [], // Default apps access
            createdAt: new Date()
        };

        await db.collection('users').insertOne(newUser);

        return res.status(201).json({ message: 'User created successfully' });

    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
