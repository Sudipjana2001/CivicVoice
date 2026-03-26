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
   * This is a best-effort server cleanup for records older than 6 months.
   */
  async emergencyWipe(): Promise<{ success: boolean; deletedCounts: Record<string, number> }> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const cutoffDate = sixMonthsAgo.toISOString();

    try {
      const { data, error } = await supabase.rpc('wipe_old_user_data', {
        p_cutoff: cutoffDate,
      });

      if (error) throw error;

      return {
        success: true,
        deletedCounts: (data as Record<string, number> | null) || {},
      };
    } catch (error) {
      console.error('Emergency wipe failed:', error);
      return { success: false, deletedCounts: {} };
    }
  }
}
