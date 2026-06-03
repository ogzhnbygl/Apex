import clientPromise from './mongodb.js';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'wildtype-super-secret-key-123';

// Verify JWT or Legacy Base64 token
export function verifyToken(token) {
    if (!token) return null;
    
    // Try JWT first
    try {
        const parts = token.split('.');
        if (parts.length === 3) {
            const [headerB64, payloadB64, signatureB64] = parts;
            const hmac = crypto.createHmac('sha256', JWT_SECRET);
            hmac.update(`${headerB64}.${payloadB64}`);
            const expectedSignatureB64 = hmac.digest('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
                
            if (signatureB64 === expectedSignatureB64) {
                const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf-8'));
                if (payload.exp && Date.now() >= payload.exp * 1000) {
                    return null; // Expired
                }
                return payload;
            }
        }
    } catch (e) {
        // Fall through to legacy
    }
    
    // Legacy Base64 check
    try {
        const sessionData = Buffer.from(token, 'base64').toString('utf-8');
        const payload = JSON.parse(sessionData);
        if (payload && payload.email) {
            return payload;
        }
    } catch (e) {
        // Ignore
    }
    
    return null;
}

// Check auth and return user record from db
export async function verifyAuth(req, requiredApp = null) {
    // 1. Bearer Token Bypass (only in development)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
        if (isDev) {
            const email = authHeader.split(' ')[1];
            const client = await clientPromise;
            const db = client.db('Apex_db');
            const user = await db.collection('users').findOne({ email });
            if (user) {
                return { email: user.email, role: user.role, apps: user.apps };
            }
        }
    }

    // 2. Cookie Authentication
    const cookies = req.headers.cookie || '';
    const match = cookies.match(/interapp_session=([^;]+)/);
    if (!match || !match[1]) {
        return null;
    }
    
    const token = match[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.email) {
        return null;
    }
    
    // Query database for up-to-date role and apps
    const client = await clientPromise;
    const db = client.db('Apex_db');
    const user = await db.collection('users').findOne({ email: decoded.email });
    if (!user) {
        return null;
    }
    
    // Check permission for app
    if (requiredApp) {
        const isAdmin = user.role === 'admin';
        const hasAppAccess = Array.isArray(user.apps) && user.apps.some(app => app.toLowerCase() === requiredApp.toLowerCase());
        if (!isAdmin && !hasAppAccess) {
            return null;
        }
    }
    
    return { email: user.email, role: user.role, apps: user.apps };
}
