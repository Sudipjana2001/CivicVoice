import { supabase } from '@/integrations/supabase/client';

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
  async fetchByPostId(postId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /** Create a new comment and increment the post's comment count. */
  async create(postId: string, content: string): Promise<any> {
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, content: content.trim() })
      .select()
      .single();

    if (error) throw error;

    // Increment comment count on the post
    const { data: postData } = await supabase
      .from('posts')
      .select('comment_count')
      .eq('id', postId)
      .single();

    if (postData) {
      await supabase
        .from('posts')
        .update({ comment_count: postData.comment_count + 1 })
        .eq('id', postId);
    }

    return data;
  }
}
