// iamgrisma/forexnepal/forexnepal-14bb7e1f6fc54805aef98994ccc7f5b19d0b7417/src/auth.ts
import { SignJWT, jwtVerify } from 'jose';

/**
 * Verifies a JWT token.
 * Now requires the secret to be passed from env.
 */
export async function verifyToken(token: string, secret: string): Promise<boolean> {
  if (!secret) {
    console.error('JWT_SECRET is not set. Token verification failed.');
    return false;
  }
  
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: 'forex-nepal',
      audience: 'forex-nepal-users',
    });
    return !!payload.sub; // Check if 'sub' (username) exists
  } catch (e) {
    console.error('Token verification failed:', e);
    return false;
  }
}

/**
 * NEW FUNCTION
 * Verifies a JWT token and returns the username (subject).
 */
export async function getUsernameFromToken(token: string, secret: string): Promise<string | null> {
  if (!secret) {
    console.error('JWT_SECRET is not set. Token verification failed.');
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: 'forex-nepal',
      audience: 'forex-nepal-users',
    });
    return payload.sub || null; // 'sub' (subject) should be the username
  } catch (e) {
    console.error('Token verification failed:', e);
    return null;
  }
}

/**
 * Generates a new JWT token.
 * Now requires the secret to be passed from env.
 */
export async function generateToken(username: string, secret: string): Promise<string> {
  if (!secret) {
    console.error('JWT_SECRET is not set. Token generation failed.');
    throw new Error('Server configuration error.');
  }

  const encodedSecret = new TextEncoder().encode(secret);
  const token = await new SignJWT({ 'username': username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(username)
    .setIssuedAt()
    .setIssuer('forex-nepal')
    .setAudience('forex-nepal-users')
    .setExpirationTime('24h') // Token expires in 24 hours
    .sign(encodedSecret);
  return token;
}

/**
 * Simple hash function (remains unchanged)
 */
export async function simpleHash(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Simple hash comparison (remains unchanged)
 */
export async function simpleHashCompare(password: string, hash: string): Promise<boolean> {
  const passwordHash = await simpleHash(password);
  return passwordHash === hash;
}
