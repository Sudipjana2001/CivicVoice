import { supabase } from '@/integrations/supabase/client';
import type { Post, Category, Severity, EvidenceType, MediaAsset, MediaKind } from '@/lib/anonymity';

interface MediaAssetRow {
  id: string;
  kind: string;
  original_path: string;
  thumb_path: string | null;
  card_path: string | null;
  full_path: string | null;
  poster_path: string | null;
  preview_path: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  mime_type: string | null;
  lqip_data_url: string | null;
}

interface PostRow {
  id: string;
  anonymous_id: string;
  content: string;
  category: string;
  severity: string;
  evidence_type: string | null;
  location: string | null;
  incident_date: string | null;
  incident_time: string | null;
  image_url: string | null;
  created_at: string;
  credible_votes: number;
  suspicious_votes: number;
  comment_count: number;
  report_count: number;
  status: string;
  self_destruct_at: string | null;
  user_id: string | null;
  media_assets?: MediaAssetRow | MediaAssetRow[] | null;
}

/**
 * PostService - Handles all post-related database operations.
 * Uses the Singleton pattern to ensure one instance across the app.
 */
export class PostService {
  private static instance: PostService;

  private constructor() {}

  static getInstance(): PostService {
    if (!PostService.instance) {
      PostService.instance = new PostService();
    }
    return PostService.instance;
  }

  /** Map a Supabase row to the local Post type. */
  mapRowToPost(row: PostRow): Post & { userId?: string } {
    const mediaAssetRow = Array.isArray(row.media_assets) ? row.media_assets[0] : row.media_assets;
    const mediaAsset: MediaAsset | undefined = mediaAssetRow ? {
      id: mediaAssetRow.id,
      kind: mediaAssetRow.kind as MediaKind,
      originalPath: mediaAssetRow.original_path,
      thumbPath: mediaAssetRow.thumb_path || undefined,
      cardPath: mediaAssetRow.card_path || undefined,
      fullPath: mediaAssetRow.full_path || undefined,
      posterPath: mediaAssetRow.poster_path || undefined,
      previewPath: mediaAssetRow.preview_path || undefined,
      width: mediaAssetRow.width || undefined,
      height: mediaAssetRow.height || undefined,
      durationMs: mediaAssetRow.duration_ms || undefined,
      mimeType: mediaAssetRow.mime_type || undefined,
      lqipDataUrl: mediaAssetRow.lqip_data_url || undefined,
    } : undefined;

    return {
      id: row.id,
      anonymousId: row.anonymous_id,
      content: row.content,
      category: row.category as Category,
      severity: row.severity as Severity,
      evidenceType: row.evidence_type || undefined,
      location: row.location || undefined,
      incidentDate: row.incident_date || undefined,
      incidentTime: row.incident_time || undefined,
      imageUrl: row.image_url || undefined,
      createdAt: new Date(row.created_at),
      credibleVotes: row.credible_votes,
      suspiciousVotes: row.suspicious_votes,
      commentCount: row.comment_count,
      reportCount: row.report_count ?? 0,
      userId: row.user_id || undefined,
      status: row.status,
      selfDestructAt: row.self_destruct_at ? new Date(row.self_destruct_at) : undefined,
      mediaAsset,
    };
  }

  async fetchTopLevelCommentCounts(postIds: string[]): Promise<Map<string, number>> {
    const uniquePostIds = Array.from(new Set(postIds.filter(Boolean)));

    if (uniquePostIds.length === 0) {
      return new Map();
    }

    const { data, error } = await supabase
      .from('comments')
      .select('post_id')
      .in('post_id', uniquePostIds)
      .is('parent_comment_id', null);

    if (error) throw error;

    const countMap = new Map(uniquePostIds.map((postId) => [postId, 0]));
    for (const row of data || []) {
      const postId = row.post_id;
      if (!postId) continue;
      countMap.set(postId, (countMap.get(postId) ?? 0) + 1);
    }

    return countMap;
  }

  async fetchTopLevelCommentCount(postId: string): Promise<number> {
    const counts = await this.fetchTopLevelCommentCounts([postId]);
    return counts.get(postId) ?? 0;
  }

  private async withTopLevelCommentCounts<T extends Post & { userId?: string }>(posts: T[]): Promise<T[]> {
    if (posts.length === 0) {
      return posts;
    }

    const countMap = await this.fetchTopLevelCommentCounts(posts.map((post) => post.id));
    return posts.map((post) => ({
      ...post,
      commentCount: countMap.get(post.id) ?? 0,
    }));
  }

  /** Fetch all posts, ordered by most recent first. */
  async fetchAll(): Promise<Post[]> {
    const { data, error } = await supabase
      .from('posts')
      .select('*, media_assets(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return this.withTopLevelCommentCounts((data || []).map(this.mapRowToPost));
  }

  /** Fetch a page of posts for infinite scrolling. */
  async fetchPage(limit: number, offset: number): Promise<{ posts: Post[]; hasMore: boolean }> {
    const { data, error } = await supabase
      .from('posts')
      .select('*, media_assets(*)')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const posts = await this.withTopLevelCommentCounts((data || []).map(this.mapRowToPost));
    return {
      posts,
      hasMore: posts.length === limit,
    };
  }

  /** Fetch a single post by ID. */
  async fetchById(id: string): Promise<Post | null> {
    const { data, error } = await supabase
      .from('posts')
      .select('*, media_assets(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return null;
    }

    return {
      ...this.mapRowToPost(data),
      commentCount: await this.fetchTopLevelCommentCount(data.id),
    };
  }

  /** Fetch all posts by a specific user ID. */
  async fetchByUserId(userId: string): Promise<Post[]> {
    const { data, error } = await supabase
      .from('posts')
      .select('*, media_assets(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return this.withTopLevelCommentCounts((data || []).map(this.mapRowToPost));
  }

  /** Create a new post. Returns the created post. */
  async create(params: {
    content: string;
    category: Category;
    severity: Severity;
    evidenceType?: EvidenceType | '';
    location?: string;
    incidentDate?: string;
    incidentTime?: string;
    imageUrl?: string;
    selfDestructDays?: number | null;
  }): Promise<Post> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Authentication required to create a report');
    }

    const { data, error } = await supabase.rpc('create_post', {
      p_content: params.content.trim(),
      p_category: params.category,
      p_severity: params.severity,
      p_evidence_type: params.evidenceType || null,
      p_location: params.location?.trim() || null,
      p_incident_date: params.incidentDate || null,
      p_incident_time: params.incidentTime || null,
      p_image_path: params.imageUrl?.trim() || null,
      p_self_destruct_days: params.selfDestructDays ?? null,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('Post creation returned no data');
    }

    return this.mapRowToPost(row);
  }

  /** Update a post's content, category, or severity. Only the owner can update. */
  async updatePost(postId: string, updates: {
    content?: string;
    category?: Category;
    severity?: Severity;
    location?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('update_own_post', {
      p_post_id: postId,
      p_content: updates.content?.trim() || null,
      p_category: updates.category ?? null,
      p_severity: updates.severity ?? null,
      p_location: updates.location !== undefined ? updates.location : null,
    });

    if (error) throw error;
  }

  /** Delete a post. Only the owner can delete (enforced by RLS). */
  async deletePost(postId: string): Promise<void> {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) throw error;
  }

  /** Fetch stats for the heatmap page. */
  async fetchStats(): Promise<{
    totalIncidents: number;
    activeHotspots: number;
    criticalReports: number;
    trendingCategory: string;
  }> {
    const { data: posts, error } = await supabase
      .from('posts')
      .select('category, severity, location');

    if (error) throw error;

    const allPosts = posts || [];
    const totalIncidents = allPosts.length;
    const criticalReports = allPosts.filter(p => p.severity === 'critical' || p.severity === 'high').length;
    
    // Count unique locations
    const locations = new Set(allPosts.filter(p => p.location).map(p => p.location));
    const activeHotspots = locations.size;

    // Find trending category
    const categoryCount: Record<string, number> = {};
    allPosts.forEach(p => {
      categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
    });
    const trendingCategory = Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'None';

    return { totalIncidents, activeHotspots, criticalReports, trendingCategory };
  }

  /** Fetch top locations with incident counts. */
  async fetchTopLocations(): Promise<{
    location: string;
    count: number;
    severity: string;
  }[]> {
    const { data, error } = await supabase
      .from('posts')
      .select('location, severity')
      .not('location', 'is', null);

    if (error) throw error;

    const locationMap: Record<string, { count: number; severities: Record<string, number> }> = {};
    for (const post of (data || [])) {
      if (!post.location) continue;
      if (!locationMap[post.location]) {
        locationMap[post.location] = { count: 0, severities: {} };
      }
      locationMap[post.location].count++;
      locationMap[post.location].severities[post.severity] = 
        (locationMap[post.location].severities[post.severity] || 0) + 1;
    }

    return Object.entries(locationMap)
      .map(([location, data]) => {
        let severity = 'low';
        if (data.severities['critical'] || data.severities['high']) severity = 'high';
        else if (data.severities['medium']) severity = 'medium';
        return { location, count: data.count, severity };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }
}
