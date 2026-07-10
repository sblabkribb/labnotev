import { generateNonce } from '../lib/nonce';

describe('generateNonce', () => {
  it('returns a 32-character token from the CSP-safe alphanumeric set', () => {
    const nonce = generateNonce();
    expect(nonce).toHaveLength(32);
    expect(nonce).toMatch(/^[A-Za-z0-9]{32}$/);
  });

  it('produces distinct values across calls', () => {
    const values = new Set(Array.from({ length: 100 }, () => generateNonce()));
    expect(values.size).toBe(100);
  });
});
