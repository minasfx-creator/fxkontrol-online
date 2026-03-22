/**
 * AES-128-GCM Encryption for FireOne Wi-Fi Direct Transport
 * 
 * Uses native Web Crypto API — zero external dependencies.
 * Pre-shared key (PSK) is derived via PBKDF2 to produce a 128-bit AES key.
 * 
 * Wire format: [12-byte IV][ciphertext + 16-byte GCM tag]
 */

const SALT = new TextEncoder().encode('FireOne-WFD-AES128');
const IV_LENGTH = 12;
const KEY_LENGTH = 128; // bits

/**
 * Derive an AES-128 key from a pre-shared key string using PBKDF2.
 */
export async function deriveKey(psk: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(psk),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a binary frame with AES-128-GCM.
 * Returns packed Uint8Array: [12-byte IV][ciphertext + GCM tag]
 */
export async function encrypt(key: CryptoKey, plaintext: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );
  const cipher = new Uint8Array(cipherBuffer);
  const packed = new Uint8Array(IV_LENGTH + cipher.length);
  packed.set(iv, 0);
  packed.set(cipher, IV_LENGTH);
  return packed;
}

/**
 * Decrypt a packed AES-128-GCM frame.
 * Input: [12-byte IV][ciphertext + GCM tag]
 */
export async function decrypt(key: CryptoKey, packed: Uint8Array): Promise<Uint8Array> {
  const iv = packed.slice(0, IV_LENGTH);
  const ciphertext = packed.slice(IV_LENGTH);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new Uint8Array(plainBuffer);
}
