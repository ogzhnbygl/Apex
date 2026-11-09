import bcrypt from 'bcryptjs';
import { z } from 'zod';
import clientPromise, { getDbName } from '../lib/mongodb.js';
import { verifyAuth } from '../lib/auth.js';

const ALLOWED_APPS = ['dispo', 'labproject', 'silo', 'circa', 'locus', 'pulsus', 'apex'];

const userPostSchema = z.object({
    name: z.string().trim().min(1, 'Ad Soyad gereklidir.'),
    email: z.string().trim().email('Geçerli bir e-posta adresi gereklidir.'),
    password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır.'),
    role: z.enum(['user', 'admin']).optional().default('user'),
    apps: z.array(z.string().trim().toLowerCase().refine(a => ALLOWED_APPS.includes(a), 'Geçersiz uygulama yetkisi.')).optional().default(['dispo'])
});

const userPutSchema = z.object({
    email: z.string().trim().email('Geçerli bir e-posta adresi gereklidir.'),
    name: z.string().trim().min(1, 'Ad Soyad boş bırakılamaz.').optional(),
    password: z.string().optional(),
    role: z.enum(['user', 'admin']).optional(),
    apps: z.array(z.string().trim().toLowerCase().refine(a => ALLOWED_APPS.includes(a), 'Geçersiz uygulama yetkisi.')).optional()
});

const emailSchema = z.string().trim().email('Geçerli bir e-posta adresi gereklidir.');

function isAllowedOrigin(origin) {
    if (!origin) return false;
    try {
        const parsed = new URL(origin);
        const hostname = parsed.hostname;
        return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'wildtype.app' || hostname.endsWith('.wildtype.app');
    } catch {
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
        return res.status(403).json({ message: 'Bu işlem için yönetici yetkisi gereklidir.' });
    }

    const client = await clientPromise;
    const db = client.db(getDbName('Apex_db'));

    if (req.method === 'GET') {
        try {
            const users = await db.collection('users').find({}).toArray();
            // Remove passwords from result
            const safeUsers = users.map(u => {
                const { password: _password, ...rest } = u;
                return rest;
            });
            return res.status(200).json(safeUsers);
        } catch (_error) {
            return res.status(500).json({ message: 'Kullanıcı listesi alınamadı.' });
        }
    }

    if (req.method === 'PUT') {
        const validation = userPutSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                message: validation.error.issues?.[0]?.message || 'Geçersiz kullanıcı verisi.'
            });
        }

        const { email, name, password, role, apps } = validation.data;

        if (email.toLowerCase() === sessionUser.email.toLowerCase() && role && role !== 'admin') {
            return res.status(400).json({ message: 'Güvenlik gereği kendi yönetici (Admin) rolünüzü düşüremezsiniz.' });
        }

        try {
            const updateDoc = { updatedAt: new Date() };
            if (name !== undefined) updateDoc.name = name;
            if (role !== undefined) updateDoc.role = role;
            if (apps !== undefined) updateDoc.apps = apps;

            if (password && password.trim().length > 0) {
                if (password.length < 6) {
                    return res.status(400).json({ message: 'Yeni şifre en az 6 karakter olmalıdır.' });
                }
                updateDoc.password = await bcrypt.hash(password, 10);
            }

            const result = await db.collection('users').updateOne(
                { email },
                { $set: updateDoc }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
            }

            return res.status(200).json({ message: 'Kullanıcı güncellendi.' });
        } catch (error) {
            console.error('Error updating user:', error);
            return res.status(500).json({ message: 'Kullanıcı güncellenirken hata oluştu.' });
        }
    }

    if (req.method === 'POST') {
        const validation = userPostSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                message: validation.error.issues?.[0]?.message || 'Geçersiz kullanıcı verisi.'
            });
        }

        const { name, email, password, role, apps } = validation.data;

        try {
            const existingUser = await db.collection('users').findOne({ email });
            if (existingUser) {
                return res.status(409).json({ message: 'Bu e-posta adresiyle kayıtlı kullanıcı zaten mevcut.' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const newUser = {
                name,
                email,
                username: email,
                password: hashedPassword,
                role,
                apps,
                createdAt: new Date()
            };

            await db.collection('users').insertOne(newUser);
            return res.status(201).json({ message: 'Kullanıcı başarıyla oluşturuldu.' });
        } catch (error) {
            console.error('Error creating user:', error);
            return res.status(500).json({ message: 'Kullanıcı oluşturulurken hata oluştu.' });
        }
    }

    if (req.method === 'DELETE') {
        const emailValidation = emailSchema.safeParse(req.query?.email);
        if (!emailValidation.success) {
            return res.status(400).json({
                message: emailValidation.error.issues?.[0]?.message || 'Geçerli e-posta gereklidir.'
            });
        }

        const email = emailValidation.data;

        if (email.toLowerCase() === sessionUser.email.toLowerCase()) {
            return res.status(400).json({ message: 'Kendi yönetici hesabınızı silemezsiniz.' });
        }

        try {
            const result = await db.collection('users').deleteOne({ email });
            if (result.deletedCount === 0) {
                return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
            }
            return res.status(200).json({ message: 'Kullanıcı silindi.' });
        } catch (_error) {
            return res.status(500).json({ message: 'Kullanıcı silinirken hata oluştu.' });
        }
    }

    return res.status(405).json({ message: 'Method not allowed' });
}
