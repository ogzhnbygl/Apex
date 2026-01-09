import clientPromise from '../lib/mongodb.js';

export default async function handler(req, res) {
    // TODO: Add middleware to check if user is admin (check cookie/token)

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
        // Update user role/apps
        const { email, role, apps } = req.body;

        if (!email) return res.status(400).json({ message: 'Email required' });

        try {
            const updateDoc = {};
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

            const newUser = {
                name,
                email,
                username: email,
                password, // TODO: Hash this!
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
