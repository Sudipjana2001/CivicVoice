import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type CommentRow = Tables<'comments'>;

/**
 * CommentService - Handles all comment-related database operations.
 * Uses the Singleton pattern.
 */
export class CommentService {
  private static instance: CommentService;

  private constructor() {}

  static getInstance(): CommentService {
    if (!CommentService.instance) {
      CommentService.instance = new CommentService();
    }
    return CommentService.instance;
  }

  /** Fetch comments for a specific post, ordered newest first. */
  async fetchByPostId(postId: string): Promise<CommentRow[]> {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /** Create a new comment and increment the post's comment count. */
  async create(postId: string, content: string): Promise<CommentRow> {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error('Comment content cannot be empty');
    }

    const { data, error } = await supabase.rpc('create_comment_and_increment', {
      p_post_id: postId,
      p_content: trimmed,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('Comment creation returned no data');
    }

    return row as CommentRow;
  }
}
