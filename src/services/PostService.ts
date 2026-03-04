import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import type { Post, Category, Severity, EvidenceType } from '@/lib/anonymity';

interface PostRow {
  id: string;
  anonymous_id: string;
  content: string;
  category: string;
  severity: string;
  evidence_type: string | null;
  location: string | null;
  image_url: string | null;
  created_at: string;
  credible_votes: number;
  suspicious_votes: number;
  comment_count: number;
  report_count: number;
  user_id: string | null;
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
    return {
      id: row.id,
      anonymousId: row.anonymous_id,
      content: row.content,
      category: row.category as Category,
      severity: row.severity as Severity,
      evidenceType: row.evidence_type || undefined,
      location: row.location || undefined,
      imageUrl: row.image_url || undefined,
      createdAt: new Date(row.created_at),
      credibleVotes: row.credible_votes,
      suspiciousVotes: row.suspicious_votes,
      commentCount: row.comment_count,
      reportCount: row.report_count ?? 0,
      userId: row.user_id || undefined,
    };
  }

  /** Fetch all posts, ordered by most recent first. */
  async fetchAll(): Promise<Post[]> {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapRowToPost);
  }

  /** Fetch a page of posts for infinite scrolling. */
  async fetchPage(limit: number, offset: number): Promise<{ posts: Post[]; hasMore: boolean }> {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const posts = (data || []).map(this.mapRowToPost);
    return {
      posts,
      hasMore: posts.length === limit,
    };
  }

  /** Fetch a single post by ID. */
  async fetchById(id: string): Promise<Post | null> {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? this.mapRowToPost(data) : null;
  }

  /** Fetch all posts by a specific user ID. */
  async fetchByUserId(userId: string): Promise<Post[]> {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapRowToPost);
  }

  /** Create a new post. Returns the created post. */
  async create(params: {
    content: string;
    category: Category;
    severity: Severity;
    evidenceType?: EvidenceType | '';
    location?: string;
    imageUrl?: string;
    selfDestructDays?: number | null;
  }): Promise<Post> {
    let selfDestructAt: string | null = null;
    if (params.selfDestructDays) {
      const date = new Date();
      date.setDate(date.getDate() + params.selfDestructDays);
      selfDestructAt = date.toISOString();
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: user?.id || null,
        content: params.content.trim(),
        category: params.category,
        severity: params.severity,
        evidence_type: params.evidenceType || null,
        location: params.location?.trim() || null,
        image_url: params.imageUrl?.trim() || null,
        self_destruct_at: selfDestructAt,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapRowToPost(data);
  }

  /** Update the comment count for a post (increment by 1). */
  async incrementCommentCount(postId: string): Promise<void> {
    const { data } = await supabase
      .from('posts')
      .select('comment_count')
      .eq('id', postId)
      .single();

    if (data) {
      await supabase
        .from('posts')
        .update({ comment_count: data.comment_count + 1 })
        .eq('id', postId);
    }
  }

  /** Update a post's content, category, or severity. Only the owner can update. */
  async updatePost(postId: string, updates: {
    content?: string;
    category?: Category;
    severity?: Severity;
    location?: string;
  }): Promise<void> {
    const updateData: TablesUpdate<'posts'> = {};
    if (updates.content !== undefined) updateData.content = updates.content.trim();
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.severity !== undefined) updateData.severity = updates.severity;
    if (updates.location !== undefined) updateData.location = updates.location.trim() || null;

    const { error } = await supabase
      .from('posts')
      .update(updateData)
      .eq('id', postId);

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
