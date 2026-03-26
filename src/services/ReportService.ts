import { supabase } from '@/integrations/supabase/client';

export type ReportReason =
  | 'misinformation'
  | 'abuse'
  | 'hate_speech'
  | 'privacy_violation'
  | 'spam'
  | 'other';

export interface PostReportMeta {
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

  async getMeta(postId: string): Promise<PostReportMeta> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { hasReported: false };
    }

    const { data, error } = await supabase
      .from('post_reports')
      .select('id')
      .eq('post_id', postId)
      .eq('reporter_user_id', user.id)
      .maybeSingle();

    if (error) throw error;

    return {
      hasReported: Boolean(data),
    };
  }

  async submit(params: {
    postId: string;
    reason: ReportReason;
    details?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('submit_post_report', {
      p_post_id: params.postId,
      p_reason: params.reason,
      p_details: params.details?.trim() || null,
    });

    if (error) throw error;
  }
}
