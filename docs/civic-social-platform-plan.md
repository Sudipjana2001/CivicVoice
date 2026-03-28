# Civic Voice Social Extension

## Architecture Direction

Civic Voice already uses React, TypeScript, Supabase, and PostgreSQL. The most scalable extension path is to:

- keep PostgreSQL as the single source of truth
- use Supabase Auth and Row Level Security for access control
- use Supabase Realtime for Conversations and Alerts
- keep civic issue reports in `posts`
- add civic-social primitives for Connections, Communities, Voices, and Conversations

This keeps the platform civic-first instead of introducing a generic social clone or a second backend.

## Naming System

- Friends -> Connections
- Chat -> Conversations
- Groups -> Communities
- Feed -> Community Feed
- Posts -> Voices / Updates
- Likes -> Support
- Notifications -> Alerts

## Data Model

### Existing domain reused

- `profiles`: identity shell for authenticated users
- `posts`: civic issue reports
- `comments`: issue comments
- `alerts`: existing alert rail that can be extended for social events

### New models

#### ConnectionRequest

- `id: uuid`
- `requester_user_id: uuid`
- `recipient_user_id: uuid`
- `note: text`
- `status: pending | accepted | rejected | cancelled`
- `responded_at: timestamptz`
- `created_at: timestamptz`
- `updated_at: timestamptz`

#### UserConnection

- `id: uuid`
- `user_id: uuid`
- `connection_user_id: uuid`
- `source_request_id: uuid`
- `created_at: timestamptz`

This is stored bidirectionally with one row per direction for fast reads.

#### Community

- `id: uuid`
- `slug: text`
- `name: text`
- `description: text`
- `visibility: public | private`
- `civic_focus: text`
- `location: text`
- `avatar_url: text`
- `banner_url: text`
- `member_count: integer`
- `created_by: uuid`
- `created_at: timestamptz`
- `updated_at: timestamptz`

#### CommunityMember

- `id: uuid`
- `community_id: uuid`
- `user_id: uuid`
- `role: admin | moderator | member`
- `status: active | pending`
- `joined_at: timestamptz`
- `created_at: timestamptz`
- `created_by: uuid`

#### Voice

- `id: uuid`
- `author_user_id: uuid`
- `community_id: uuid | null`
- `linked_issue_post_id: uuid | null`
- `kind: voice | update`
- `visibility: public | connections | community`
- `title: text | null`
- `content: text`
- `image_url: text | null`
- `support_count: integer`
- `comment_count: integer`
- `status: active | archived | removed`
- `created_at: timestamptz`
- `updated_at: timestamptz`
- `edited_at: timestamptz | null`

#### VoiceSupport

- `id: uuid`
- `voice_id: uuid`
- `supporter_user_id: uuid`
- `created_at: timestamptz`

#### VoiceComment

- `id: uuid`
- `voice_id: uuid`
- `user_id: uuid`
- `parent_comment_id: uuid | null`
- `content: text`
- `created_at: timestamptz`
- `updated_at: timestamptz`

#### Conversation

- `id: uuid`
- `conversation_type: direct | community`
- `community_id: uuid | null`
- `created_by: uuid`
- `created_at: timestamptz`
- `updated_at: timestamptz`
- `last_message_at: timestamptz`

#### ConversationParticipant

- `id: uuid`
- `conversation_id: uuid`
- `user_id: uuid`
- `joined_at: timestamptz`
- `last_read_message_id: uuid | null`
- `last_read_at: timestamptz | null`
- `muted: boolean`

#### ConversationMessage

- `id: uuid`
- `conversation_id: uuid`
- `sender_user_id: uuid`
- `body: text`
- `attachment_url: text | null`
- `status: sent | delivered | seen`
- `created_at: timestamptz`
- `delivered_at: timestamptz | null`
- `seen_at: timestamptz | null`

## API Contract

Preferred implementation in this repo:

- table reads via Supabase queries
- state-changing actions via RPC functions
- real-time delivery via Supabase Realtime channels

Canonical REST contract for future edge functions:

### Connections

`POST /api/connections/requests`

```json
{
  "recipientUserId": "70f6c1a2-1a55-4d4e-bb55-c4a398baf8f1",
  "note": "Let's coordinate on ward safety updates."
}
```

```json
{
  "id": "4f7df0a6-d8cb-4d59-8ce0-5ef4c687e4ef",
  "status": "pending",
  "createdAt": "2026-03-28T12:00:00.000Z"
}
```

`PATCH /api/connections/requests/:requestId`

```json
{
  "action": "accepted"
}
```

```json
{
  "id": "4f7df0a6-d8cb-4d59-8ce0-5ef4c687e4ef",
  "status": "accepted",
  "connectionCreated": true
}
```

`GET /api/connections`

```json
{
  "items": [
    {
      "id": "c3f7cb37-57bb-4d84-a12d-b21ec36d7e29",
      "userId": "current-user-id",
      "connectionUserId": "other-user-id",
      "createdAt": "2026-03-28T12:10:00.000Z"
    }
  ]
}
```

### Conversations

`POST /api/conversations/direct`

```json
{
  "otherUserId": "other-user-id"
}
```

```json
{
  "conversationId": "b4c99d28-9987-4dd9-96f4-e43d5bb4a2d0"
}
```

`POST /api/conversations/:conversationId/messages`

```json
{
  "body": "Can we gather support for the sanitation petition tonight?"
}
```

```json
{
  "id": "message-id",
  "status": "sent",
  "createdAt": "2026-03-28T12:11:00.000Z"
}
```

### Communities

`POST /api/communities`

```json
{
  "name": "Ward 8 Water Watch",
  "slug": "ward-8-water-watch",
  "description": "Residents tracking water outages and repair updates.",
  "visibility": "public",
  "civicFocus": "Water access",
  "location": "Ward 8"
}
```

```json
{
  "id": "community-id",
  "slug": "ward-8-water-watch",
  "memberCount": 1
}
```

### Voices

`POST /api/voices`

```json
{
  "kind": "voice",
  "visibility": "public",
  "title": "Street light outage cluster",
  "content": "Five poles on Lake Road are still dark after last week's complaint.",
  "communityId": null,
  "linkedIssuePostId": "optional-issue-id"
}
```

```json
{
  "id": "voice-id",
  "supportCount": 0,
  "commentCount": 0
}
```

`POST /api/voices/:voiceId/support`

```json
{
  "supported": true
}
```

```json
{
  "voiceId": "voice-id",
  "supportCount": 12,
  "supported": true
}
```

### Alerts

`GET /api/alerts`

```json
{
  "items": [
    {
      "id": "alert-id",
      "type": "connection_request",
      "title": "New connection request",
      "description": "A resident wants to connect around Ward 8 safety updates.",
      "read": false
    }
  ]
}
```

## Community Feed Strategy

Community Feed is not a generic timeline. It merges:

- civic issue reports from `posts`
- public Voices from `voices`
- community-scoped Voices where the viewer has access

Sort modes:

- `latest`
- `most_supported`

Phase 1 can merge issue reports and voices in the service layer.
Phase 2 should materialize this into a dedicated feed view or cached projection.

## Frontend Folder Structure

```text
src/
  features/
    connections/
      components/
      hooks/
      pages/
      types.ts
    conversations/
      components/
      hooks/
      pages/
      types.ts
    communities/
      components/
      hooks/
      pages/
      types.ts
    community-feed/
      components/
      hooks/
      pages/
      types.ts
    voices/
      components/
      hooks/
      pages/
      types.ts
    alerts/
      components/
      hooks/
      pages/
      types.ts
  services/
    ConnectionService.ts
    ConversationService.ts
    CommunityService.ts
    CivicFeedService.ts
  lib/
    civicSocial.ts
supabase/
  migrations/
  functions/
    connections/
    communities/
    conversations/
    alerts/
```

## UI / UX Hierarchy

```text
App
  CivicShell
    Header
      CommunityFeedLink
      ConnectionsButton
      ConversationsButton
      AlertsButton
      CommunitiesButton
    CommunityFeedPage
      FeedHeader
      FeedSortTabs
      VoiceComposer
      FeedFilters
      FeedStream
        IssueCard
        VoiceCard
        CommunityVoiceCard
    ConnectionsPage
      PendingRequestsPanel
      ConnectionsGrid
      SuggestedConnectionsRail
    ConversationsPage
      ConversationList
      ConversationThread
      MessageComposer
    CommunitiesPage
      CommunityDirectory
      CommunityDetails
      CommunityMembersPanel
      CommunityFeedPanel
    AlertsCenter
      AlertFilters
      AlertList
```

## Sample Starter Code

Starter files added in this repo:

- `src/lib/civicSocial.ts`
- `src/services/ConnectionService.ts`
- `src/services/ConversationService.ts`
- `src/services/CommunityService.ts`
- `src/services/CivicFeedService.ts`
- `supabase/migrations/20260328130000_add_civic_social_foundation.sql`

These files intentionally align with the current frontend service pattern and Supabase backend.

## Implementation Phases

### Phase 1: Social foundation

- ship schema, RLS, RPCs, indexes
- scaffold civic-social service layer
- extend alerts model for social activity

### Phase 2: Connections + Communities

- wire connection requests and connection lists
- wire community creation, join, leave
- add community directory and membership controls

### Phase 3: Voices + Community Feed

- add Voice composer and cards
- merge issue reports with voices
- add support and threaded comments

### Phase 4: Conversations + Realtime Alerts

- direct conversations for connected users
- real-time message delivery
- alert center updates for requests, engagement, and community activity

### Phase 5: Scale hardening

- introduce feed projections or materialized views
- add moderation tools for communities and voices
- add rate limits, abuse detection, and background jobs
- regenerate Supabase types after each migration

## Production Notes

- keep issue reports and social voices distinct in moderation flows
- do not expose private communities or direct conversations in global feed queries
- use bidirectional `user_connections` rows for cheap access checks
- prefer RPCs for state transitions like accepting a connection or joining a private community
- use realtime subscriptions only for active threads and unread alert counters
