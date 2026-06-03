import { createHash, randomBytes } from 'crypto';

export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

export function generateApiKey(): string {
  const prefix = 'wi';
  const key = randomBytes(32).toString('hex');
  return `${prefix}_${key}`;
}
