import { supabase } from '@/integrations/supabase/client';

export type AdminRole = 'master_admin' | 'moderator';
export type PostModerationStatus =
  | 'submitted'
  | 'under_review'
  | 'escalated'
  | 'action_noted'
  | 'resolved'
  | 'closed';
export type ReportModerationStatus = 'open' | 'reviewing' | 'closed' | 'dismissed';

export interface AdminAccess {
  userId: string | null;
  role: AdminRole | null;
  isAdmin: boolean;
}

export interface AdminDashboardSummary {
  totalPosts: number;
  openReports: number;
  reviewingReports: number;
  totalComments: number;
  totalUsers: number;
  activeAdmins: number;
  underReviewPosts: number;
}

export interface AdminPostRow {
  id: string;
  anonymousId: string;
  content: string;
  category: string;
  severity: string;
  location: string | null;
  status: PostModerationStatus;
  createdAt: string;
  credibleVotes: number;
  suspiciousVotes: number;
  commentCount: number;
  reportCount: number;
  userId: string | null;
  incidentDate: string | null;
  incidentTime: string | null;
  evidenceType: string | null;
  selfDestructAt: string | null;
}

export interface AdminReportRow {
  id: string;
  postId: string;
  reporterUserId: string;
  reporterAnonymousId: string | null;
  postAnonymousId: string;
  reason: string;
  details: string | null;
  status: ReportModerationStatus;
  createdAt: string;
  postStatus: PostModerationStatus;
  postExcerpt: string;
}

export interface AdminCommentRow {
  id: string;
  postId: string;
  parentCommentId: string | null;
  anonymousId: string;
  content: string;
  userId: string | null;
  createdAt: string;
  editedAt: string | null;
  upvoteCount: number;
  downvoteCount: number;
  postAnonymousId: string;
  postExcerpt: string;
  directReplyCount: number;
}

export interface AdminProfileRow {
  userId: string;
  profileId: string;
  anonymousId: string;
  credibilityScore: number;
  credibilityLevel: string;
  reportsCount: number;
  inboxEnabled: boolean;
  selfDestructDays: number | null;
  createdAt: string;
  updatedAt: string;
  postCount: number;
  commentCount: number;
  reportCount: number;
}

export interface AdminUserRow {
  userId: string;
  role: AdminRole;
  createdAt: string;
  createdBy: string | null;
  anonymousId: string | null;
  createdByAnonymousId: string | null;
}

function getSingleRow<T>(data: T[] | T | null): T | null {
  if (!data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

export class AdminService {
  private static instance: AdminService;

  private constructor() {}

  static getInstance(): AdminService {
    if (!AdminService.instance) {
      AdminService.instance = new AdminService();
    }
    return AdminService.instance;
  }

  async getMyAccess(): Promise<AdminAccess> {
    const { data, error } = await supabase.rpc('get_my_admin_access');
    if (error) throw error;

    const row = getSingleRow(data);
    return {
      userId: row?.user_id ?? null,
      role: (row?.role as AdminRole | null) ?? null,
      isAdmin: Boolean(row?.is_admin),
    };
  }

  async getDashboardSummary(): Promise<AdminDashboardSummary> {
    const { data, error } = await supabase.rpc('admin_get_dashboard_summary');
    if (error) throw error;

    const row = getSingleRow(data);
    if (!row) {
      throw new Error('Dashboard summary returned no data');
    }

    return {
      totalPosts: row.total_posts,
      openReports: row.open_reports,
      reviewingReports: row.reviewing_reports,
      totalComments: row.total_comments,
      totalUsers: row.total_users,
      activeAdmins: row.active_admins,
      underReviewPosts: row.under_review_posts,
    };
  }

  async listPosts(params?: {
    status?: PostModerationStatus | null;
    search?: string;
    limit?: number;
  }): Promise<AdminPostRow[]> {
    const { data, error } = await supabase.rpc('admin_list_posts', {
      p_status: params?.status ?? null,
      p_search: params?.search?.trim() || null,
      p_limit: params?.limit ?? 50,
    });

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      anonymousId: row.anonymous_id,
      content: row.content,
      category: row.category,
      severity: row.severity,
      location: row.location,
      status: row.status as PostModerationStatus,
      createdAt: row.created_at,
      credibleVotes: row.credible_votes,
      suspiciousVotes: row.suspicious_votes,
      commentCount: row.comment_count,
      reportCount: row.report_count,
      userId: row.user_id,
      incidentDate: row.incident_date,
      incidentTime: row.incident_time,
      evidenceType: row.evidence_type,
      selfDestructAt: row.self_destruct_at,
    }));
  }

  async setPostStatus(postId: string, status: PostModerationStatus): Promise<void> {
    const { error } = await supabase.rpc('admin_set_post_status', {
      p_post_id: postId,
      p_status: status,
    });

    if (error) throw error;
  }

  async deletePost(postId: string): Promise<void> {
    const { error } = await supabase.rpc('admin_delete_post', {
      p_post_id: postId,
    });

    if (error) throw error;
  }

  async listReports(params?: {
    status?: ReportModerationStatus | null;
    search?: string;
    limit?: number;
  }): Promise<AdminReportRow[]> {
    const { data, error } = await supabase.rpc('admin_list_post_reports', {
      p_status: params?.status ?? null,
      p_search: params?.search?.trim() || null,
      p_limit: params?.limit ?? 50,
    });

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      postId: row.post_id,
      reporterUserId: row.reporter_user_id,
      reporterAnonymousId: row.reporter_anonymous_id,
      postAnonymousId: row.post_anonymous_id,
      reason: row.reason,
      details: row.details,
      status: row.status as ReportModerationStatus,
      createdAt: row.created_at,
      postStatus: row.post_status as PostModerationStatus,
      postExcerpt: row.post_excerpt,
    }));
  }

  async setReportStatus(reportId: string, status: ReportModerationStatus): Promise<void> {
    const { error } = await supabase.rpc('admin_set_post_report_status', {
      p_report_id: reportId,
      p_status: status,
    });

    if (error) throw error;
  }

  async listComments(params?: {
    search?: string;
    limit?: number;
  }): Promise<AdminCommentRow[]> {
    const { data, error } = await supabase.rpc('admin_list_comments', {
      p_search: params?.search?.trim() || null,
      p_limit: params?.limit ?? 100,
    });

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      postId: row.post_id,
      parentCommentId: row.parent_comment_id,
      anonymousId: row.anonymous_id,
      content: row.content,
      userId: row.user_id,
      createdAt: row.created_at,
      editedAt: row.edited_at,
      upvoteCount: row.upvote_count,
      downvoteCount: row.downvote_count,
      postAnonymousId: row.post_anonymous_id,
      postExcerpt: row.post_excerpt,
      directReplyCount: row.direct_reply_count,
    }));
  }

  async deleteComment(commentId: string): Promise<void> {
    const { error } = await supabase.rpc('admin_delete_comment', {
      p_comment_id: commentId,
    });

    if (error) throw error;
  }

  async listProfiles(params?: {
    search?: string;
    limit?: number;
  }): Promise<AdminProfileRow[]> {
    const { data, error } = await supabase.rpc('admin_list_profiles', {
      p_search: params?.search?.trim() || null,
      p_limit: params?.limit ?? 100,
    });

    if (error) throw error;

    return (data || []).map((row) => ({
      userId: row.user_id,
      profileId: row.profile_id,
      anonymousId: row.anonymous_id,
      credibilityScore: row.credibility_score,
      credibilityLevel: row.credibility_level,
      reportsCount: row.reports_count,
      inboxEnabled: row.inbox_enabled,
      selfDestructDays: row.self_destruct_days,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      postCount: row.post_count,
      commentCount: row.comment_count,
      reportCount: row.report_count,
    }));
  }

  async sendInboxMessage(params: {
    recipientUserId: string;
    subject: string;
    content: string;
    senderLabel?: string;
    relatedPostId?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('admin_send_inbox_message', {
      p_recipient_user_id: params.recipientUserId,
      p_subject: params.subject.trim(),
      p_content: params.content.trim(),
      p_sender_label: params.senderLabel?.trim() || 'CivicVoice Moderation',
      p_related_post_id: params.relatedPostId?.trim() || null,
    });

    if (error) throw error;
  }

  async listAdminUsers(): Promise<AdminUserRow[]> {
    const { data, error } = await supabase.rpc('admin_list_admin_users');
    if (error) throw error;

    return (data || []).map((row) => ({
      userId: row.user_id,
      role: row.role as AdminRole,
      createdAt: row.created_at,
      createdBy: row.created_by,
      anonymousId: row.anonymous_id,
      createdByAnonymousId: row.created_by_anonymous_id,
    }));
  }

  async upsertAdminUser(userId: string, role: AdminRole): Promise<void> {
    const { error } = await supabase.rpc('admin_upsert_admin_user', {
      p_target_user_id: userId,
      p_role: role,
    });

    if (error) throw error;
  }

  async removeAdminUser(userId: string): Promise<void> {
    const { error } = await supabase.rpc('admin_remove_admin_user', {
      p_target_user_id: userId,
    });

    if (error) throw error;
  }
}
