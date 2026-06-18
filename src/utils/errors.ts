export function sanitizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg
    .replace(/sk-[a-zA-Z0-9]{20,}/g, '[API_KEY_REDACTED]')
    .replace(/sk-ant-[a-zA-Z0-9]{20,}/g, '[API_KEY_REDACTED]')
    .replace(/[Aa]pi[_-]?[Kk]ey[^:]*:[^,\s}\n]+/g, '[API_KEY_REDACTED]');
}
