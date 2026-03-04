/**
 * CivicVoice — Client-side encryption utilities
 * Uses Web Crypto API (AES-256-GCM) for zero-knowledge content encryption.
 * Posts are encrypted before leaving the browser so the server (Supabase) 
 * only stores encrypted blobs — even a database breach reveals nothing.
 */

const ALGO = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96-bit IV for GCM

/**
 * Derive an encryption key from a passphrase using PBKDF2.
 * The passphrase is the user's anonymous session token (never sent to server).
 */
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGO, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt plaintext. Returns a base64 string containing salt + IV + ciphertext.
 */
export async function encryptContent(plaintext: string, passphrase: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(passphrase, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    enc.encode(plaintext)
  );

  // Combine: salt (16) + iv (12) + ciphertext
  const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(ciphertext).length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a base64 encrypted string back to plaintext.
 */
export async function decryptContent(encrypted: string, passphrase: string): Promise<string> {
  const dec = new TextDecoder();
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));

  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 16 + IV_LENGTH);
  const ciphertext = combined.slice(16 + IV_LENGTH);

  const key = await deriveKey(passphrase, salt);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: ALGO, iv },
    key,
    ciphertext
  );

  return dec.decode(plainBuffer);
}

/**
 * Strip EXIF metadata from an image file.
 * Re-draws the image onto a clean canvas — all metadata is lost.
 */
export function stripImageMetadata(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Cannot get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        },
        'image/webp',  // Convert to WebP — smaller + strips all metadata
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };

    img.src = url;
  });
}

/**
 * Generate a cryptographically secure anonymous ID.
 * Uses Web Crypto API instead of Math.random().
 */
export function generateSecureAnonymousId(): string {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  const hex = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  return `Anon_${hex.substring(0, 8).toUpperCase()}`;
}

/**
 * Generate a secure session token (64 hex chars = 256 bits).
 */
export function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}
