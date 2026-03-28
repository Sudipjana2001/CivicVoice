import { supabase } from '@/integrations/supabase/client';
import type { CivicFeedItem, CivicVoice, FeedSortOption, VoiceVisibility } from '@/lib/civicSocial';

const socialClient = supabase as any;

export class CivicFeedService {
  private static instance: CivicFeedService;

  private constructor() {}

  static getInstance(): CivicFeedService {
    if (!CivicFeedService.instance) {
      CivicFeedService.instance = new CivicFeedService();
    }

    return CivicFeedService.instance;
  }

  private mapVoice(row: any): CivicVoice {
    return {
      id: row.id,
      authorUserId: row.author_user_id,
      communityId: row.community_id ?? undefined,
      linkedIssuePostId: row.linked_issue_post_id ?? undefined,
      kind: row.kind,
      visibility: row.visibility,
      title: row.title ?? undefined,
      content: row.content,
      imageUrl: row.image_url ?? undefined,
      supportCount: row.support_count ?? 0,
      commentCount: row.comment_count ?? 0,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      editedAt: row.edited_at ? new Date(row.edited_at) : undefined,
    };
  }

  async createVoice(input: {
    kind?: 'voice' | 'update';
    visibility?: VoiceVisibility;
    title?: string;
    content: string;
    communityId?: string;
    linkedIssuePostId?: string;
    imageUrl?: string;
  }): Promise<CivicVoice> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Authentication required to create a voice');
    }

    const { data, error } = await socialClient
      .from('voices')
      .insert({
        author_user_id: user.id,
        kind: input.kind || 'voice',
        visibility: input.visibility || 'public',
        title: input.title?.trim() || null,
        content: input.content.trim(),
        community_id: input.communityId || null,
        linked_issue_post_id: input.linkedIssuePostId || null,
        image_url: input.imageUrl?.trim() || null,
      })
      .select('*')
      .single();

    if (error) throw error;

    return this.mapVoice(data);
  }

  async setVoiceSupport(voiceId: string, supported: boolean): Promise<{ supportCount: number; supported: boolean }> {
    const { data, error } = await socialClient.rpc('set_voice_support_state', {
      p_voice_id: voiceId,
      p_support: supported,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;

    return {
      supportCount: row?.support_count ?? 0,
      supported: row?.supported ?? supported,
    };
  }

  async fetchGlobalFeed(sortBy: FeedSortOption = 'latest', limit = 20): Promise<CivicFeedItem[]> {
    const [issuesResponse, voicesResponse] = await Promise.all([
      socialClient
        .from('posts')
        .select('id, user_id, category, content, image_url, credible_votes, comment_count, created_at, status')
        .order(sortBy === 'most_supported' ? 'credible_votes' : 'created_at', {
          ascending: false,
        })
        .limit(limit),
      socialClient
        .from('voices')
        .select('id, author_user_id, community_id, kind, title, content, image_url, support_count, comment_count, created_at, status, linked_issue_post_id')
        .eq('status', 'active')
        .order(sortBy === 'most_supported' ? 'support_count' : 'created_at', {
          ascending: false,
        })
        .limit(limit),
    ]);

    if (issuesResponse.error) throw issuesResponse.error;
    if (voicesResponse.error) throw voicesResponse.error;

    const issueItems: CivicFeedItem[] = (issuesResponse.data || []).map((row: any) => ({
      id: row.id,
      itemType: 'issue',
      authorUserId: row.user_id ?? undefined,
      title: row.category,
      content: row.content,
      imageUrl: row.image_url ?? undefined,
      supportCount: row.credible_votes ?? 0,
      commentCount: row.comment_count ?? 0,
      createdAt: new Date(row.created_at),
      linkedIssuePostId: row.id,
      status: row.status,
    }));

    const voiceItems: CivicFeedItem[] = (voicesResponse.data || []).map((row: any) => ({
      id: row.id,
      itemType: row.kind,
      authorUserId: row.author_user_id,
      communityId: row.community_id ?? undefined,
      title: row.title ?? undefined,
      content: row.content,
      imageUrl: row.image_url ?? undefined,
      supportCount: row.support_count ?? 0,
      commentCount: row.comment_count ?? 0,
      createdAt: new Date(row.created_at),
      linkedIssuePostId: row.linked_issue_post_id ?? undefined,
      status: row.status,
    }));

    return [...issueItems, ...voiceItems]
      .sort((left, right) => {
        if (sortBy === 'most_supported') {
          return right.supportCount - left.supportCount;
        }

        return right.createdAt.getTime() - left.createdAt.getTime();
      })
      .slice(0, limit);
  }
}
