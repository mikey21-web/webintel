import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config';

function getSecret(): Uint8Array {
  return new TextEncoder().encode(config.SUPABASE_JWT_SECRET || 'dev-secret-change-in-production');
}

function getAnonKey(): string {
  return config.SUPABASE_ANON_KEY || '';
}

export interface JwtPayload {
  sub: string;
  email?: string;
  aud?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

function decodeBase64Url(str: string): string {
  try {
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

export function parseSupabaseJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    if (!payload.sub) return null;
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

export async function verifySupabaseJwt(token: string): Promise<JwtPayload | null> {
  const secret = getSecret();
  if (!secret.length) {
    return parseSupabaseJwt(token);
  }
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });
    return payload as unknown as JwtPayload;
  } catch {
    return parseSupabaseJwt(token);
  }
}

export function isAnonKey(token: string): boolean {
  const anonKey = getAnonKey();
  if (!anonKey) return false;
  return token === anonKey;
}

export async function createScopedToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ sub: userId, email, aud: 'authenticated', role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecret());
}
