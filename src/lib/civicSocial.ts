export type ConnectionRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';
export type ConnectionRequestAction = Extract<ConnectionRequestStatus, 'accepted' | 'rejected' | 'cancelled'>;

export type CommunityVisibility = 'public' | 'private';
export type CommunityMemberRole = 'admin' | 'moderator' | 'member';
export type CommunityMemberStatus = 'active' | 'pending';

export type VoiceKind = 'voice' | 'update';
export type VoiceVisibility = 'public' | 'connections' | 'community';
export type VoiceStatus = 'active' | 'archived' | 'removed';

export type ConversationType = 'direct' | 'community';
export type ConversationMessageStatus = 'sent' | 'delivered' | 'seen';

export type CivicAlertType =
  | 'connection_request'
  | 'connection_accepted'
  | 'conversation_message'
  | 'community_join'
  | 'community_activity'
  | 'voice_supported'
  | 'voice_commented';

export interface CivicProfileSummary {
  userId: string;
  anonymousId?: string;
  credibilityLevel?: string;
}

export interface ConnectionRequest {
  id: string;
  requesterUserId: string;
  recipientUserId: string;
  note?: string;
  status: ConnectionRequestStatus;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CivicConnection {
  id: string;
  userId: string;
  connectionUserId: string;
  sourceRequestId?: string;
  createdAt: Date;
}

export interface CivicCommunity {
  id: string;
  slug: string;
  name: string;
  description?: string;
  visibility: CommunityVisibility;
  civicFocus?: string;
  location?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  memberCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommunityMembership {
  id: string;
  communityId: string;
  userId: string;
  role: CommunityMemberRole;
  status: CommunityMemberStatus;
  joinedAt: Date;
  createdAt: Date;
  createdBy?: string;
}

export interface CivicVoice {
  id: string;
  authorUserId: string;
  communityId?: string;
  linkedIssuePostId?: string;
  kind: VoiceKind;
  visibility: VoiceVisibility;
  title?: string;
  content: string;
  imageUrl?: string;
  supportCount: number;
  commentCount: number;
  status: VoiceStatus;
  createdAt: Date;
  updatedAt: Date;
  editedAt?: Date;
}

export interface VoiceComment {
  id: string;
  voiceId: string;
  userId: string;
  parentCommentId?: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CivicFeedItem {
  id: string;
  itemType: 'issue' | VoiceKind;
  authorUserId?: string;
  communityId?: string;
  title?: string;
  content: string;
  imageUrl?: string;
  supportCount: number;
  commentCount: number;
  createdAt: Date;
  linkedIssuePostId?: string;
  status?: string;
}

export interface ConversationSummary {
  id: string;
  conversationType: ConversationType;
  communityId?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: Date;
  lastReadMessageId?: string;
  lastReadAt?: Date;
  muted: boolean;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  body: string;
  attachmentUrl?: string;
  status: ConversationMessageStatus;
  createdAt: Date;
  deliveredAt?: Date;
  seenAt?: Date;
}

export interface CivicAlert {
  id: string;
  recipientUserId: string;
  type: CivicAlertType | string;
  title: string;
  description: string;
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
  communityId?: string;
  conversationId?: string;
  voiceId?: string;
}

export const COMMUNITY_VISIBILITY_OPTIONS: Array<{ id: CommunityVisibility; label: string }> = [
  { id: 'public', label: 'Public Community' },
  { id: 'private', label: 'Private Community' },
];

export const VOICE_KIND_OPTIONS: Array<{ id: VoiceKind; label: string }> = [
  { id: 'voice', label: 'Voice' },
  { id: 'update', label: 'Update' },
];

export const FEED_SORT_OPTIONS = [
  { id: 'latest', label: 'Latest' },
  { id: 'most_supported', label: 'Most Supported' },
] as const;

export type FeedSortOption = (typeof FEED_SORT_OPTIONS)[number]['id'];
