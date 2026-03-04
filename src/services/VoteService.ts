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
  async getUserVote(postId: string, voterId: string): Promise<'credible' | 'suspicious' | null> {
    const { data } = await supabase
      .from('votes')
      .select('vote_type')
      .eq('post_id', postId)
      .eq('voter_id', voterId)
      .maybeSingle();

    return data ? (data.vote_type as 'credible' | 'suspicious') : null;
  }

  /** Cast or toggle a vote. Returns the new vote state and updated counts. */
  async toggleVote(
    postId: string,
    voterId: string,
    voteType: 'credible' | 'suspicious',
    currentVote: 'credible' | 'suspicious' | null,
    currentCredible: number,
    currentSuspicious: number,
  ): Promise<{
    newVote: 'credible' | 'suspicious' | null;
    credibleVotes: number;
    suspiciousVotes: number;
  }> {
    let newCredible = currentCredible;
    let newSuspicious = currentSuspicious;
    let newVote: 'credible' | 'suspicious' | null;

    if (currentVote === voteType) {
      // Remove vote
      await supabase
        .from('votes')
        .delete()
        .eq('post_id', postId)
        .eq('voter_id', voterId);

      if (voteType === 'credible') newCredible--;
      else newSuspicious--;
      newVote = null;
    } else {
      // Remove old vote if switching
      if (currentVote === 'credible') newCredible--;
      else if (currentVote === 'suspicious') newSuspicious--;

      // Upsert new vote
      await supabase
        .from('votes')
        .upsert(
          { post_id: postId, voter_id: voterId, vote_type: voteType },
          { onConflict: 'post_id,voter_id' }
        );

      if (voteType === 'credible') newCredible++;
      else newSuspicious++;
      newVote = voteType;
    }

    // Update post counts
    await supabase
      .from('posts')
      .update({ credible_votes: newCredible, suspicious_votes: newSuspicious })
      .eq('id', postId);

    return { newVote, credibleVotes: newCredible, suspiciousVotes: newSuspicious };
  }
}
