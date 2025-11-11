// src/auth.ts
import { JWT_SECRET } from './constants';

/**
 * Hashes a password using SHA-256.
 */
export async function simpleHash(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + JWT_SECRET);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compares a plaintext password to a stored hash.
 */
export async function simpleHashCompare(password: string, storedHash: string | null): Promise<boolean> {
    if (!storedHash) {
        return false;
    }
    const inputHash = await simpleHash(password);
    return inputHash === storedHash;
}

/**
 * Generates a new JWT token for a user.
 */
export async function generateToken(username: string): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
        username,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours validity
    };
    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
    let base64Signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${signatureInput}.${base64Signature}`;
}

/**
 * Verifies the integrity and expiration of a JWT token.
 */
export async function verifyToken(token: string): Promise<boolean> {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [encodedHeader, encodedPayload, signature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    try {
        const decodedPayload = atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(decodedPayload);
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            console.log("Token expired");
            return false;
        }
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey('raw', encoder.encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
        let base64 = signature.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) { base64 += '='; }
        const signatureBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        return await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(signatureInput));
    } catch (error) {
        console.error('Token verification error:', error);
        return false;
    }
}
