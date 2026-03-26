import { generateSecureAnonymousId, generateSecureToken } from './crypto';

// Generate anonymous ID using Web Crypto API (not Math.random)
export function generateAnonymousId(): string {
  return generateSecureAnonymousId();
}

// Generate session token for anonymous posting
export function generateSessionToken(): string {
  return generateSecureToken();
}

// Get or create anonymous session
export function getAnonymousSession(): { id: string; token: string } {
  try {
    const stored = sessionStorage.getItem('civic_anon_session');
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<{ id: string; token: string }>;
      if (typeof parsed.id === 'string' && typeof parsed.token === 'string') {
        return parsed as { id: string; token: string };
      }
    }
  } catch {
    sessionStorage.removeItem('civic_anon_session');
  }
  
  const session = {
    id: generateAnonymousId(),
    token: generateSessionToken(),
  };
  // Use sessionStorage instead of localStorage so data is wiped on browser close
  try {
    sessionStorage.setItem('civic_anon_session', JSON.stringify(session));
  } catch {
    // Ignore storage failures and fall back to the in-memory session object.
  }
  return session;
}

// Clear session (for privacy)
export function clearAnonymousSession(): void {
  try {
    sessionStorage.removeItem('civic_anon_session');
    localStorage.removeItem('civic_anon_session'); // also clear legacy
  } catch {
    // Ignore storage failures during cleanup.
  }
}

// Categories
export const CATEGORIES = [
  { id: 'fraud', label: 'Fraud', icon: 'AlertTriangle' },
  { id: 'violence', label: 'Violence', icon: 'Flame' },
  { id: 'corruption', label: 'Corruption', icon: 'Scale' },
  { id: 'governance', label: 'Governance', icon: 'Landmark' },
  { id: 'safety', label: 'Public Safety', icon: 'ShieldAlert' },
  { id: 'healthcare', label: 'Healthcare', icon: 'Heart' },
  { id: 'infrastructure', label: 'Infrastructure', icon: 'Building2' },
  { id: 'other', label: 'Other', icon: 'MoreHorizontal' },
] as const;

export type Category = typeof CATEGORIES[number]['id'];

// Severity levels
export const SEVERITY_LEVELS = [
  { id: 'low', label: 'Low', color: 'severity-low' },
  { id: 'medium', label: 'Medium', color: 'severity-medium' },
  { id: 'high', label: 'High', color: 'severity-high' },
  { id: 'critical', label: 'Critical', color: 'severity-critical' },
] as const;

export type Severity = typeof SEVERITY_LEVELS[number]['id'];

// Evidence types
export const EVIDENCE_TYPES = [
  { id: 'photo', label: 'Photo' },
  { id: 'video', label: 'Video' },
  { id: 'document', label: 'Document' },
  { id: 'witness', label: 'Witness Statement' },
] as const;

export type EvidenceType = typeof EVIDENCE_TYPES[number]['id'];

// Post interface
export interface Post {
  id: string;
  anonymousId: string;
  content: string;
  category: Category;
  severity: Severity;
  evidenceType?: EvidenceType;
  location?: string;
  incidentDate?: string;
  incidentTime?: string;
  imageUrl?: string;
  createdAt: Date;
  credibleVotes: number;
  suspiciousVotes: number;
  commentCount: number;
  reportCount?: number;
  userId?: string;
  status?: string;
  selfDestructAt?: Date;
}
