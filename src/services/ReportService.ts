import { supabase } from '@/integrations/supabase/client';

export type ReportReason =
  | 'misinformation'
  | 'abuse'
  | 'hate_speech'
  | 'privacy_violation'
  | 'spam'
  | 'other';

export interface PostReportMeta {
  count: number;
  hasReported: boolean;
}

export class ReportService {
  private static instance: ReportService;

  private constructor() {}

  static getInstance(): ReportService {
    if (!ReportService.instance) {
      ReportService.instance = new ReportService();
    }
    return ReportService.instance;
  }

  async getMeta(postId: string, reporterUserId?: string): Promise<PostReportMeta> {
    const countPromise = supabase
      .from('post_reports')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);

    const hasReportedPromise = reporterUserId
      ? supabase
          .from('post_reports')
          .select('id')
          .eq('post_id', postId)
          .eq('reporter_user_id', reporterUserId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

    const [{ count, error: countError }, { data, error: hasReportedError }] = await Promise.all([
      countPromise,
      hasReportedPromise,
    ]);

    if (countError) throw countError;
    if (hasReportedError) throw hasReportedError;

    return {
      count: typeof count === 'number' ? count : 0,
      hasReported: Boolean(data),
    };
  }

  async submit(params: {
    postId: string;
    reporterUserId: string;
    reason: ReportReason;
    details?: string;
  }): Promise<void> {
    const { error } = await supabase.from('post_reports').insert({
      post_id: params.postId,
      reporter_user_id: params.reporterUserId,
      reason: params.reason,
      details: params.details?.trim() || null,
    });

    if (error) throw error;
  }
}
