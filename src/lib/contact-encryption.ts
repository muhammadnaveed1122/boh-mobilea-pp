import { gcm } from '@noble/ciphers/aes.js';

const PREFIX = 'enc:v1:';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

let cachedKey: Uint8Array | null = null;

function base64ToBytes(b64: string): Uint8Array {
  const binary = globalThis.atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.codePointAt(i) ?? 0;
  }
  return out;
}

function getKey(): Uint8Array {
  if (cachedKey !== null) return cachedKey;
  const keyB64 = process.env.EXPO_PUBLIC_LEAD_CONTACT_ENCRYPTION_KEY;
  if (keyB64 === undefined || keyB64 === '') {
    throw new Error(
      'EXPO_PUBLIC_LEAD_CONTACT_ENCRYPTION_KEY env var is required (32-byte key, base64-encoded)',
    );
  }
  const raw = base64ToBytes(keyB64);
  if (raw.length !== KEY_LENGTH) {
    throw new Error(
      `EXPO_PUBLIC_LEAD_CONTACT_ENCRYPTION_KEY must decode to ${String(KEY_LENGTH)} bytes (got ${String(raw.length)})`,
    );
  }
  cachedKey = raw;
  return cachedKey;
}

/**
 * Decrypts an `enc:v1:<base64>` payload produced by backend's
 * `encryptContactValue`. Pass-through for null, empty, or non-encrypted strings.
 *
 * Wire format: `enc:v1:<base64( iv(12) || ciphertext || authTag(16) )>`.
 */
export function decryptContact(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value === '') return value;
  if (!value.startsWith(PREFIX)) return value;

  try {
    const payload = base64ToBytes(value.slice(PREFIX.length));
    if (payload.length <= IV_LENGTH) return value;
    const iv = payload.slice(0, IV_LENGTH);
    const ciphertextWithTag = payload.slice(IV_LENGTH);
    const plain = gcm(getKey(), iv).decrypt(ciphertextWithTag);
    return new TextDecoder().decode(plain);
  } catch {
    return value;
  }
}

/** True for a value still in `enc:v1:` wire form (decrypt unavailable / failed). */
export function isEncryptedContactValue(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

const CONTACT_KEY_NAMES = new Set(['email', 'phone', 'whatsappNumber', 'number']);

/**
 * Mirror of the backend's `encryptContactsInJson`: walks a JSON blob and
 * decrypts `enc:v1:` strings sitting under whitelisted contact keys, passing
 * everything else through. Used for activity-log oldValue / newValue / metadata.
 */
export function decryptContactsInJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((entry) => decryptContactsInJson(entry));
  if (typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] =
      CONTACT_KEY_NAMES.has(key) && typeof entry === 'string'
        ? decryptContact(entry)
        : decryptContactsInJson(entry);
  }
  return out;
}

export function decryptLeadContact<T extends { email?: string | null; phone?: string | null }>(
  lead: T,
): T {
  return {
    ...lead,
    email: decryptContact(lead.email),
    phone: decryptContact(lead.phone),
  };
}
