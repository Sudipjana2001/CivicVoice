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
      // 1. Delete old posts (cascade should handle related votes/comments)
      const { data: oldPosts } = await supabase
        .from('posts')
        .delete()
        .eq('user_id', userId)
        .lt('created_at', cutoffDate)
        .select('id');
      deletedCounts.posts = oldPosts?.length || 0;

      // 2. Delete old votes
      const { data: oldVotes } = await supabase
        .from('votes')
        .delete()
        .eq('user_id', userId)
        .lt('created_at', cutoffDate)
        .select('id');
      deletedCounts.votes = oldVotes?.length || 0;

      // 3. Delete old comments
      const { data: oldComments } = await supabase
        .from('comments')
        .delete()
        .eq('user_id', userId)
        .lt('created_at', cutoffDate)
        .select('id');
      deletedCounts.comments = oldComments?.length || 0;

      // 4. Delete old inbox messages
      const { data: oldMessages } = await supabase
        .from('inbox_messages')
        .delete()
        .lt('created_at', cutoffDate)
        .select('id');
      deletedCounts.messages = oldMessages?.length || 0;

      // 5. Delete old alerts
      const { data: oldAlerts } = await supabase
        .from('alerts')
        .delete()
        .lt('created_at', cutoffDate)
        .select('id');
      deletedCounts.alerts = oldAlerts?.length || 0;

      return { success: true, deletedCounts };
    } catch (error) {
      console.error('Emergency wipe failed:', error);
      return { success: false, deletedCounts };
    }
  }
}
