import { describe, it, expect } from 'vitest';
import { normalizeDomain, domainToUrl } from '../../utils/domain';

describe('normalizeDomain', () => {
  it('removes protocol', () => {
    expect(normalizeDomain('https://example.com')).toBe('example.com');
  });
  it('removes www', () => {
    expect(normalizeDomain('www.example.com')).toBe('example.com');
  });
  it('removes trailing path', () => {
    expect(normalizeDomain('example.com/path/to/page')).toBe('example.com');
  });
  it('lowercases', () => {
    expect(normalizeDomain('EXAMPLE.COM')).toBe('example.com');
  });
  it('handles combined', () => {
    expect(normalizeDomain('https://www.Example.COM/path')).toBe('example.com');
  });
});

describe('domainToUrl', () => {
  it('adds https://', () => {
    expect(domainToUrl('example.com')).toBe('https://example.com');
  });
  it('normalizes first', () => {
    expect(domainToUrl('https://www.example.com')).toBe('https://example.com');
  });
});
