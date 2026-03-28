import { supabase } from '@/integrations/supabase/client';
import type { CivicCommunity, CommunityMembership, CommunityVisibility } from '@/lib/civicSocial';

const socialClient = supabase as any;

function firstRow<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export class CommunityService {
  private static instance: CommunityService;

  private constructor() {}

  static getInstance(): CommunityService {
    if (!CommunityService.instance) {
      CommunityService.instance = new CommunityService();
    }

    return CommunityService.instance;
  }

  private mapCommunity(row: any): CivicCommunity {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description ?? undefined,
      visibility: row.visibility,
      civicFocus: row.civic_focus ?? undefined,
      location: row.location ?? undefined,
      avatarUrl: row.avatar_url ?? undefined,
      bannerUrl: row.banner_url ?? undefined,
      memberCount: row.member_count ?? 0,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapMembership(row: any): CommunityMembership {
    return {
      id: row.id,
      communityId: row.community_id,
      userId: row.user_id,
      role: row.role,
      status: row.status,
      joinedAt: new Date(row.joined_at),
      createdAt: new Date(row.created_at),
      createdBy: row.created_by ?? undefined,
    };
  }

  async listCommunities(): Promise<CivicCommunity[]> {
    const { data, error } = await socialClient
      .from('communities')
      .select('*')
      .order('member_count', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => this.mapCommunity(row));
  }

  async listMemberships(): Promise<CommunityMembership[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return [];

    const { data, error } = await socialClient
      .from('community_members')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => this.mapMembership(row));
  }

  async createCommunity(input: {
    name: string;
    slug: string;
    description?: string;
    visibility?: CommunityVisibility;
    civicFocus?: string;
    location?: string;
  }): Promise<CivicCommunity> {
    const { data, error } = await socialClient.rpc('create_community', {
      p_name: input.name.trim(),
      p_slug: input.slug.trim().toLowerCase(),
      p_description: input.description?.trim() || null,
      p_visibility: input.visibility || 'public',
      p_civic_focus: input.civicFocus?.trim() || null,
      p_location: input.location?.trim() || null,
    });

    if (error) throw error;

    const row = firstRow(data);
    if (!row) {
      throw new Error('Community creation returned no data');
    }

    return this.mapCommunity(row);
  }

  async joinCommunity(communityId: string): Promise<CommunityMembership> {
    const { data, error } = await socialClient.rpc('join_community', {
      p_community_id: communityId,
    });

    if (error) throw error;

    const row = firstRow(data);
    if (!row) {
      throw new Error('Community join returned no data');
    }

    return this.mapMembership(row);
  }

  async leaveCommunity(communityId: string): Promise<string> {
    const { data, error } = await socialClient.rpc('leave_community', {
      p_community_id: communityId,
    });

    if (error) throw error;

    return typeof data === 'string' ? data : communityId;
  }
}
