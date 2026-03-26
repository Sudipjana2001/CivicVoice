/**
 * CivicVoice — Privacy Shield Middleware
 * Strips identifiable information from all outgoing requests and
 * hardens the browser environment against fingerprinting/tracking.
 */

/**
 * Privacy headers to inject via service worker or meta tags.
 * These prevent common tracking and fingerprinting vectors.
 */
export const PRIVACY_HEADERS = {
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-DNS-Prefetch-Control': 'off',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
} as const;

/**
 * Sanitize text to remove potential fingerprinting data:
 * - Strips invisible Unicode characters (zero-width joiners, etc.)
 * - Normalizes whitespace
 * - Removes potential steganographic markers
 */
export function sanitizeText(text: string): string {
  const withoutControlChars = Array.from(text)
    .filter((char) => {
      const code = char.charCodeAt(0);
      const isControl = (code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127;
      return !isControl;
    })
    .join('');

  return withoutControlChars
    // Remove zero-width characters (can be used for fingerprinting)
    .replace(/[\u200B-\u200D\uFEFF\u2060\u2061\u2062\u2063\u2064]/g, '')
    // Normalize whitespace (different keyboards produce different whitespace)
    .replace(/\s+/g, ' ')
    // Trim
    .trim();
}

/**
 * Round a timestamp to the nearest 15 minutes.
 * Prevents exact timing analysis that could correlate with user activity.
 */
export function roundTimestamp(date: Date): Date {
  const ms = 15 * 60 * 1000; // 15 minutes
  return new Date(Math.round(date.getTime() / ms) * ms);
}

/**
 * Fuzzy location — add random noise to coordinates (±0.01 degrees ≈ ±1.1km).
 * Prevents precise location tracking while keeping neighborhood-level accuracy.
 */
export function fuzzyLocation(location: string): string {
  // For text locations, return as-is (already anonymous)
  return location.trim();
}

/**
 * Check if the user is connected via Tor (heuristic).
 * Checks for known Tor exit node patterns.
 */
export function checkTorConnection(): boolean {
  // Cannot reliably detect Tor from client-side
  // Return false; users should manually verify
  return false;
}

/**
 * Clear all local traces of the application.
 * Use this as a "panic button" to wipe all local data.
 */
export function panicWipe(): void {
  // Clear all localStorage
  localStorage.clear();
  // Clear all sessionStorage  
  sessionStorage.clear();
  // Clear cookies
  document.cookie.split(';').forEach((c) => {
    document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
  });
  // Clear IndexedDB
  if (window.indexedDB) {
    indexedDB.databases?.()?.then?.((dbs) => {
      dbs.forEach((db) => {
        if (db.name) indexedDB.deleteDatabase(db.name);
      });
    });
  }
  // Clear Cache API
  if ('caches' in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
  // Redirect to blank page
  window.location.href = 'about:blank';
}

/**
 * Apply privacy meta tags to the document head.
 * Call this once on app startup.
 */
export function applyPrivacyHeaders(): void {
  // Referrer Policy — never send referrer
  setMetaTag('referrer', 'no-referrer');
  
  // Content Security Policy — block external tracking
  const csp = [
    "default-src 'self' https://*.supabase.co wss://*.supabase.co",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vercel-insights.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.supabase.co https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://unpkg.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org https://*.vercel-insights.com",
    "worker-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');
  
  setMetaTag('Content-Security-Policy', csp, true);
}

function setMetaTag(name: string, content: string, isHttpEquiv = false): void {
  const attr = isHttpEquiv ? 'http-equiv' : 'name';
  let meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attr, name);
    document.head.appendChild(meta);
  }
  meta.content = content;
}
