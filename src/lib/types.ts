// Extended types for enhanced platform features

export type IncidentStatus = 
  | 'submitted' 
  | 'under_review' 
  | 'escalated' 
  | 'action_noted' 
  | 'resolved' 
  | 'closed';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export type VisibilityTag = 
  | 'shared_ngo' 
  | 'shared_watchdog' 
  | 'media_attention';

export type SelfDestructOption = 7 | 30 | 90 | null;

export interface StatusHistoryEntry {
  status: IncidentStatus;
  timestamp: Date;
  note?: string;
}

export interface RelatedIncident {
  id: string;
  anonymousId: string;
  location?: string;
  category: string;
  createdAt: Date;
}

export interface TimelineEntry {
  id: string;
  type: 'initial' | 'followup' | 'status_change' | 'outcome';
  anonymousId: string;
  content: string;
  timestamp: Date;
  status?: IncidentStatus;
}

export interface AnonymityHealth {
  ipMasked: boolean;
  metadataStripped: boolean;
  noTrackers: boolean;
  secureUpload: boolean;
}

export interface CredibilityBadgeInfo {
  level: 'none' | 'new' | 'trusted' | 'veteran';
  reportsCount: number;
  credibilityScore: number;
}

export interface FollowedTopic {
  type: 'location' | 'category';
  value: string;
  label: string;
}

// Extended Post type with new features
export interface ExtendedPost {
  id: string;
  anonymousId: string;
  content: string;
  category: string;
  severity: string;
  evidenceType?: string;
  location?: string;
  imageUrl?: string;
  createdAt: Date;
  credibleVotes: number;
  suspiciousVotes: number;
  commentCount: number;
  
  // New fields
  status: IncidentStatus;
  statusHistory: StatusHistoryEntry[];
  confidenceScore: ConfidenceLevel;
  visibilityTags: VisibilityTag[];
  relatedIncidentCount: number;
  selfDestructAt?: Date;
  hasFollowUps: boolean;
  credibilityBadge: CredibilityBadgeInfo;
}

export const INCIDENT_STATUSES: { id: IncidentStatus; label: string; color: string }[] = [
  { id: 'submitted', label: 'Submitted', color: 'muted' },
  { id: 'under_review', label: 'Under Review', color: 'primary' },
  { id: 'escalated', label: 'Escalated', color: 'severity-high' },
  { id: 'action_noted', label: 'Action Noted', color: 'severity-medium' },
  { id: 'resolved', label: 'Resolved', color: 'credible' },
  { id: 'closed', label: 'Closed', color: 'muted' },
];

export const CONFIDENCE_LEVELS: { id: ConfidenceLevel; label: string; description: string }[] = [
  { id: 'low', label: 'Low Confidence', description: 'Limited supporting evidence' },
  { id: 'medium', label: 'Medium Confidence', description: 'Some corroborating data' },
  { id: 'high', label: 'High Confidence', description: 'Strong supporting evidence' },
];

export const VISIBILITY_TAGS: { id: VisibilityTag; label: string }[] = [
  { id: 'shared_ngo', label: 'Shared with NGO' },
  { id: 'shared_watchdog', label: 'Shared with Watchdog Community' },
  { id: 'media_attention', label: 'Media Attention' },
];

export const SELF_DESTRUCT_OPTIONS: { value: SelfDestructOption; label: string }[] = [
  { value: null, label: 'Never' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];
