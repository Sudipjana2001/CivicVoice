import { supabase } from '@/integrations/supabase/client';

/**
 * VoteService - Handles all voting-related database operations.
 * Uses the Singleton pattern for consistency.
 */
export class VoteService {
  private static instance: VoteService;

  private constructor() {}

  static getInstance(): VoteService {
    if (!VoteService.instance) {
      VoteService.instance = new VoteService();
    }
    return VoteService.instance;
  }

  /** Get the current user's vote on a post. */
  async getUserVote(postId: string): Promise<'credible' | 'suspicious' | null> {
    const { data, error } = await supabase.rpc('get_user_vote', {
      p_post_id: postId,
    });
    if (error) throw error;

    return data ? (data as 'credible' | 'suspicious') : null;
  }

  /** Cast or toggle a vote. Returns the new vote state and updated counts. */
  async toggleVote(
    postId: string,
    voteType: 'credible' | 'suspicious',
  ): Promise<{
    newVote: 'credible' | 'suspicious' | null;
    credibleVotes: number;
    suspiciousVotes: number;
  }> {
    const { data, error } = await supabase.rpc('toggle_vote_and_update_counts', {
      p_post_id: postId,
      p_vote_type: voteType,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : null;
    if (!row) {
      throw new Error('Vote operation returned no data');
    }

    return {
      newVote: (row.new_vote as 'credible' | 'suspicious' | null) ?? null,
      credibleVotes: row.credible_votes,
      suspiciousVotes: row.suspicious_votes,
    };
  }
}
