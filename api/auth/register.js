import bcrypt from 'bcryptjs';
import { z } from 'zod';
import clientPromise, { getDbName } from '../lib/mongodb.js';
import { verifyAuth } from '../lib/auth.js';

const registerSchema = z.object({
    name: z.string().trim().min(1, 'Ad Soyad gereklidir.').optional(),
    email: z.string().trim().email('Geçerli bir e-posta adresi gereklidir.'),
    password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır.')
});

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    // Restrict user registration exclusively to authenticated system administrators
    const sessionUser = await verifyAuth(req);
    if (!sessionUser || sessionUser.role !== 'admin') {
        return res.status(403).json({ message: 'Kayıt işlemi sadece sistem yöneticisi tarafından yapılabilir.' });
    }

    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({
            message: validation.error.issues?.[0]?.message || 'Geçersiz kayıt verisi.'
        });
    }

    const { name, email, password } = validation.data;

    try {
        const client = await clientPromise;
        const db = client.db(getDbName('Apex_db'));

        const existingUser = await db.collection('users').findOne({ email });

        if (existingUser) {
            return res.status(409).json({ message: 'Bu e-posta adresi ile kayıtlı bir kullanıcı zaten mevcut.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            name: name || email.split('@')[0],
            email,
            username: email,
            password: hashedPassword,
            role: 'user',
            apps: [],
            createdAt: new Date()
        };

        await db.collection('users').insertOne(newUser);

        return res.status(201).json({ message: 'User created successfully' });

    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
