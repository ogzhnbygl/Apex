import bcrypt from 'bcryptjs';
import clientPromise from '../lib/mongodb.js';
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
    // Enable CORS for dashboard and other apps
    const origin = req.headers.origin;
    if (isAllowedOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    }

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Protect all admin user routes - must be logged in as admin
    const sessionUser = await verifyAuth(req);
    if (!sessionUser || sessionUser.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    const client = await clientPromise;
    const db = client.db('Apex_db');

    if (req.method === 'GET') {
        try {
            const users = await db.collection('users').find({}).toArray();
            // Remove passwords from result
            const safeUsers = users.map(u => {
                const { password, ...rest } = u;
                return rest;
            });
            return res.status(200).json(safeUsers);
        } catch (error) {
            return res.status(500).json({ message: 'Error fetching users' });
        }
    }

    if (req.method === 'PUT') {
        // Update user role/apps/name
        const { email, name, role, apps } = req.body;

        if (!email) return res.status(400).json({ message: 'Email required' });

        try {
            const updateDoc = {};
            if (name) updateDoc.name = name;
            if (role) updateDoc.role = role;
            if (apps) updateDoc.apps = apps;

            await db.collection('users').updateOne(
                { email },
                { $set: updateDoc }
            );

            return res.status(200).json({ message: 'User updated' });
        } catch (error) {
            return res.status(500).json({ message: 'Error updating user' });
        }
    }

    if (req.method === 'POST') {
        // Create new user
        const { name, email, password, role, apps } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        try {
            const existingUser = await db.collection('users').findOne({ email });
            if (existingUser) {
                return res.status(409).json({ message: 'User already exists' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const newUser = {
                name,
                email,
                username: email,
                password: hashedPassword,
                role: role || 'user',
                apps: apps || ['dispo'],
                createdAt: new Date()
            };

            await db.collection('users').insertOne(newUser);
            return res.status(201).json({ message: 'User created successfully' });
        } catch (error) {
            console.error('Error creating user:', error);
            return res.status(500).json({ message: `Error creating user: ${error.message}` });
        }
    }

    if (req.method === 'DELETE') {
        // Delete user
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({ message: 'Email required' });
        }

        try {
            const result = await db.collection('users').deleteOne({ email });
            if (result.deletedCount === 0) {
                return res.status(404).json({ message: 'User not found' });
            }
            return res.status(200).json({ message: 'User deleted' });
        } catch (error) {
            return res.status(500).json({ message: 'Error deleting user' });
        }
    }

    return res.status(405).json({ message: 'Method not allowed' });
}
