import { SignJWT, jwtVerify, importJWK } from 'jose';
import { config } from '../config';

export interface JwtPayload {
  sub: string;
  email?: string;
  aud?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

let jwkKey: any = null;

function getJwk(): any {
  if (jwkKey) return jwkKey;
  if (!config.SUPABASE_JWK) return null;
  try {
    const keys = JSON.parse(config.SUPABASE_JWK);
    jwkKey = Array.isArray(keys) ? keys[0] : keys;
    return jwkKey;
  } catch {
    return null;
  }
}

let importedKey: any = null;

async function getVerificationKey(): Promise<any> {
  if (importedKey) return importedKey;
  const jwk = getJwk();
  if (jwk) {
    importedKey = await importJWK(jwk, jwk.alg || 'ES256');
    return importedKey;
  }
  if (config.SUPABASE_JWT_SECRET) {
    importedKey = new TextEncoder().encode(config.SUPABASE_JWT_SECRET);
    return importedKey;
  }
  return null;
}

export async function verify(token: string): Promise<JwtPayload | null> {
  const key = await getVerificationKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export function parseUnsafe(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload || !payload.sub) return null;
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

export function isAnonKey(token: string): boolean {
  const anonKey = config.SUPABASE_ANON_KEY;
  if (!anonKey) return false;
  return token === anonKey;
}

const SCOPED_SECRET = new TextEncoder().encode(config.SCOPED_JWT_SECRET || 'webintel-scoped-jwt-secret-v1');

export async function createScopedToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ sub: userId, email, aud: 'authenticated', role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(SCOPED_SECRET);
}

export async function verifyScopedToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SCOPED_SECRET);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}
