import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type CommentRecord = Tables<'comments'>;
export type CommentReaction = 'upvote' | 'downvote' | null;

export interface CommentRow extends CommentRecord {
  viewer_reaction: CommentReaction;
  replies: CommentRow[];
}

export interface CommentPage {
  comments: CommentRow[];
  hasMore: boolean;
}

export interface CommentCursor {
  beforeCreatedAt?: string | null;
  beforeId?: string | null;
  limit?: number;
}

export interface CommentReactionResult {
  reaction: CommentReaction;
  upvoteCount: number;
  downvoteCount: number;
}

/**
 * CommentService - Handles all comment-related database operations.
 * Uses the Singleton pattern.
 */
export class CommentService {
  private static instance: CommentService;
  private static readonly DEFAULT_PAGE_SIZE = 20;

  private constructor() {}

  static getInstance(): CommentService {
    if (!CommentService.instance) {
      CommentService.instance = new CommentService();
    }
    return CommentService.instance;
  }

  private mapCommentRecord(record: CommentRecord, viewerReaction: CommentReaction = null): CommentRow {
    return {
      ...record,
      viewer_reaction: viewerReaction,
      replies: [],
    };
  }

  private buildCommentTree(topLevelComments: CommentRow[], replyComments: CommentRow[]): CommentRow[] {
    const allComments = [...topLevelComments, ...replyComments].map((comment) => ({
      ...comment,
      replies: [],
    }));

    const commentsById = new Map(allComments.map((comment) => [comment.id, comment]));

    replyComments.forEach((reply) => {
      const currentReply = commentsById.get(reply.id);
      const parentComment = reply.parent_comment_id ? commentsById.get(reply.parent_comment_id) : null;

      if (currentReply && parentComment) {
        parentComment.replies.push(currentReply);
      }
    });

    return topLevelComments
      .map((comment) => commentsById.get(comment.id))
      .filter((comment): comment is CommentRow => Boolean(comment));
  }

  /** Fetch a page of top-level comments plus all nested replies for those threads. */
  async fetchByPostId(postId: string, cursor: CommentCursor = {}): Promise<CommentPage> {
    const pageSize = cursor.limit ?? CommentService.DEFAULT_PAGE_SIZE;
    const { data, error } = await supabase.rpc('fetch_comments_with_reaction_state', {
      p_post_id: postId,
      p_limit: pageSize + 1,
      p_before_created_at: cursor.beforeCreatedAt ?? null,
      p_before_id: cursor.beforeId ?? null,
    });

    if (error) throw error;

    const topRows = ((data as Array<CommentRecord & { viewer_reaction: CommentReaction }> | null) || []).map((row) =>
      this.mapCommentRecord(row as CommentRecord, row.viewer_reaction ?? null)
    );

    const pagedTopRows = topRows.slice(0, pageSize);
    const topLevelIds = pagedTopRows.map((comment) => comment.id);

    let replyRows: CommentRow[] = [];
    if (topLevelIds.length > 0) {
      const { data: repliesData, error: repliesError } = await supabase.rpc('fetch_comment_replies_with_reaction_state', {
        p_parent_comment_ids: topLevelIds,
      });

      if (repliesError) throw repliesError;

      replyRows = ((repliesData as Array<CommentRecord & { viewer_reaction: CommentReaction }> | null) || []).map((row) =>
        this.mapCommentRecord(row as CommentRecord, row.viewer_reaction ?? null)
      );
    }

    return {
      comments: this.buildCommentTree(pagedTopRows, replyRows),
      hasMore: topRows.length > pageSize,
    };
  }

  /** Create a new top-level comment or reply. */
  async create(postId: string, content: string, parentCommentId: string | null = null): Promise<CommentRow> {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error('Comment content cannot be empty');
    }

    const { data, error } = await supabase.rpc('create_comment_and_increment', {
      p_post_id: postId,
      p_content: trimmed,
      p_parent_comment_id: parentCommentId,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('Comment creation returned no data');
    }

    return this.mapCommentRecord(row as CommentRecord);
  }

  /** Update a comment owned by the current user. */
  async update(commentId: string, content: string): Promise<CommentRow> {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error('Comment content cannot be empty');
    }

    const { data, error } = await supabase.rpc('update_own_comment', {
      p_comment_id: commentId,
      p_content: trimmed,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('Comment update returned no data');
    }

    return this.mapCommentRecord(row as CommentRecord);
  }

  /** Delete a comment owned by the current user. */
  async delete(commentId: string): Promise<string> {
    const { data, error } = await supabase.rpc('delete_own_comment_and_decrement', {
      p_comment_id: commentId,
    });

    if (error) throw error;

    const deletedId = Array.isArray(data) ? data[0] : data;
    if (!deletedId) {
      throw new Error('Comment deletion returned no data');
    }

    return deletedId as string;
  }

  /** Set the desired reaction state for a comment. */
  async setReactionState(commentId: string, reaction: CommentReaction): Promise<CommentReactionResult> {
    const { data, error } = await supabase.rpc('set_comment_reaction_state', {
      p_comment_id: commentId,
      p_reaction_type: reaction,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('Comment reaction update returned no data');
    }

    return {
      reaction: (row.reaction as CommentReaction | null) ?? null,
      upvoteCount: Number(row.upvote_count ?? 0),
      downvoteCount: Number(row.downvote_count ?? 0),
    };
  }
}
