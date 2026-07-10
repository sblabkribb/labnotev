import * as crypto from 'crypto';

const NONCE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const NONCE_LENGTH = 32;

/**
 * Generate a Content-Security-Policy script nonce.
 *
 * Uses `crypto.randomBytes` (CSPRNG) rather than `Math.random`, which is not
 * cryptographically secure and should never seed a security token. The output
 * stays a 32-character alphanumeric string so it is safe to embed directly in
 * the `nonce-...` CSP directive and the `<script nonce>` attribute.
 */
export function generateNonce(): string {
  const bytes = crypto.randomBytes(NONCE_LENGTH);
  let text = '';
  for (let i = 0; i < NONCE_LENGTH; i++) {
    text += NONCE_CHARS.charAt(bytes[i] % NONCE_CHARS.length);
  }
  return text;
}
