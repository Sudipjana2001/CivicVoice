import { supabase } from '@/integrations/supabase/client';

/**
 * DataWipeService — Singleton service for emergency data management.
 * Handles wiping user data older than 6 months from the database,
 * keeping only the most recent 6 months of activity.
 */
export class DataWipeService {
  private static instance: DataWipeService;

  private constructor() {}

  static getInstance(): DataWipeService {
    if (!DataWipeService.instance) {
      DataWipeService.instance = new DataWipeService();
    }
    return DataWipeService.instance;
  }

  /**
   * Emergency wipe: delete all user data OLDER than 6 months.
   * Keeps the last 6 months of posts, votes, comments, inbox messages, and alerts.
   */
  async emergencyWipe(userId: string): Promise<{ success: boolean; deletedCounts: Record<string, number> }> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const cutoffDate = sixMonthsAgo.toISOString();

    const deletedCounts: Record<string, number> = {};

    try {
      const { data: allUserAnonIds } = await supabase
        .from('posts')
        .select('anonymous_id')
        .eq('user_id', userId);

      // 1. Delete old posts owned by the user
      const { data: oldPosts } = await supabase
        .from('posts')
        .delete()
        .eq('user_id', userId)
        .lt('created_at', cutoffDate)
        .select('id,anonymous_id');
      deletedCounts.posts = oldPosts?.length || 0;

      const deletedPostIds = (oldPosts || []).map((p) => p.id);
      const ownedAnonymousIds = [...new Set((allUserAnonIds || []).map((p) => p.anonymous_id))];

      // 2. Delete old comments tied to deleted posts (safety for non-cascade setups)
      if (deletedPostIds.length > 0) {
        const { data: oldComments } = await supabase
          .from('comments')
          .delete()
          .in('post_id', deletedPostIds)
          .lt('created_at', cutoffDate)
          .select('id');
        deletedCounts.comments = oldComments?.length || 0;
      } else {
        deletedCounts.comments = 0;
      }

      // 3. Votes for deleted posts should cascade via FK; keep for reporting clarity.
      deletedCounts.votes = 0;

      // 4. Delete old inbox messages addressed to this user's anonymous IDs
      if (ownedAnonymousIds.length > 0) {
        const { data: oldMessages } = await supabase
          .from('inbox_messages')
          .delete()
          .in('recipient_anonymous_id', ownedAnonymousIds)
          .lt('created_at', cutoffDate)
          .select('id');
        deletedCounts.messages = oldMessages?.length || 0;
      } else {
        deletedCounts.messages = 0;
      }

      // 5. Delete old alerts addressed to this user's anonymous IDs
      if (ownedAnonymousIds.length > 0) {
        const { data: oldAlerts } = await supabase
          .from('alerts')
          .delete()
          .in('recipient_anonymous_id', ownedAnonymousIds)
          .lt('created_at', cutoffDate)
          .select('id');
        deletedCounts.alerts = oldAlerts?.length || 0;
      } else {
        deletedCounts.alerts = 0;
      }

      return { success: true, deletedCounts };
    } catch (error) {
      console.error('Emergency wipe failed:', error);
      return { success: false, deletedCounts };
    }
  }
}
