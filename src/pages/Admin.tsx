import { useCallback, useDeferredValue, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Shield,
  Trash2,
  UserCog,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  AdminService,
  type AdminCommentRow,
  type AdminDashboardSummary,
  type AdminPostRow,
  type AdminProfileRow,
  type AdminReportRow,
  type AdminRole,
  type AdminUserRow,
  type PostModerationStatus,
  type ReportModerationStatus,
} from '@/services/AdminService';

const postStatuses: PostModerationStatus[] = [
  'submitted',
  'under_review',
  'escalated',
  'action_noted',
  'resolved',
  'closed',
];

const reportStatuses: ReportModerationStatus[] = ['open', 'reviewing', 'closed', 'dismissed'];
const adminService = AdminService.getInstance();

type AdminTab = 'overview' | 'posts' | 'reports' | 'comments' | 'users' | 'admins';

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Unknown';

  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function clipText(value: string, limit = 220) {
  return value.length > limit ? `${value.slice(0, limit).trim()}...` : value;
}

function roleTone(role: AdminRole | null): 'default' | 'secondary' {
  if (role === 'master_admin') return 'default';
  return 'secondary';
}

function AdminMetricCard(props: { label: string; value: number; helper: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{props.label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight">{props.value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{props.helper}</p>
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading, isAdmin, adminRole, adminLoading, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [posts, setPosts] = useState<AdminPostRow[]>([]);
  const [reports, setReports] = useState<AdminReportRow[]>([]);
  const [comments, setComments] = useState<AdminCommentRow[]>([]);
  const [profiles, setProfiles] = useState<AdminProfileRow[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);

  const [summaryLoading, setSummaryLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [adminUsersLoading, setAdminUsersLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  const [postSearch, setPostSearch] = useState('');
  const [postStatusFilter, setPostStatusFilter] = useState<'all' | PostModerationStatus>('all');
  const [reportSearch, setReportSearch] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | ReportModerationStatus>('all');
  const [commentSearch, setCommentSearch] = useState('');
  const [profileSearch, setProfileSearch] = useState('');

  const [selectedRecipient, setSelectedRecipient] = useState<AdminProfileRow | null>(null);
  const [messageSubject, setMessageSubject] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [messageRelatedPostId, setMessageRelatedPostId] = useState('');

  const [adminUserIdDraft, setAdminUserIdDraft] = useState('');
  const [adminRoleDraft, setAdminRoleDraft] = useState<AdminRole>('moderator');

  const deferredPostSearch = useDeferredValue(postSearch);
  const deferredReportSearch = useDeferredValue(reportSearch);
  const deferredCommentSearch = useDeferredValue(commentSearch);
  const deferredProfileSearch = useDeferredValue(profileSearch);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, navigate, user]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);

    try {
      const nextSummary = await adminService.getDashboardSummary();
      setSummary(nextSummary);
    } catch (error) {
      console.error('Failed to load admin summary:', error);
      toast({
        title: 'Could not load admin summary',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setSummaryLoading(false);
    }
  }, [toast]);

  const loadPosts = useCallback(async () => {
    setPostsLoading(true);

    try {
      const rows = await adminService.listPosts({
        search: deferredPostSearch,
        status: postStatusFilter === 'all' ? null : postStatusFilter,
      });
      setPosts(rows);
    } catch (error) {
      console.error('Failed to load admin posts:', error);
      toast({
        title: 'Could not load posts',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setPostsLoading(false);
    }
  }, [deferredPostSearch, postStatusFilter, toast]);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);

    try {
      const rows = await adminService.listReports({
        search: deferredReportSearch,
        status: reportStatusFilter === 'all' ? null : reportStatusFilter,
      });
      setReports(rows);
    } catch (error) {
      console.error('Failed to load admin reports:', error);
      toast({
        title: 'Could not load reports',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setReportsLoading(false);
    }
  }, [deferredReportSearch, reportStatusFilter, toast]);

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);

    try {
      const rows = await adminService.listComments({
        search: deferredCommentSearch,
      });
      setComments(rows);
    } catch (error) {
      console.error('Failed to load admin comments:', error);
      toast({
        title: 'Could not load comments',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setCommentsLoading(false);
    }
  }, [deferredCommentSearch, toast]);

  const loadProfiles = useCallback(async () => {
    setProfilesLoading(true);

    try {
      const rows = await adminService.listProfiles({
        search: deferredProfileSearch,
      });
      setProfiles(rows);
    } catch (error) {
      console.error('Failed to load admin users:', error);
      toast({
        title: 'Could not load users',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setProfilesLoading(false);
    }
  }, [deferredProfileSearch, toast]);

  const loadAdminUsers = useCallback(async () => {
    if (adminRole !== 'master_admin') {
      setAdminUsers([]);
      setAdminUsersLoading(false);
      return;
    }

    setAdminUsersLoading(true);

    try {
      const rows = await adminService.listAdminUsers();
      setAdminUsers(rows);
    } catch (error) {
      console.error('Failed to load admin users:', error);
      toast({
        title: 'Could not load admin access list',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setAdminUsersLoading(false);
    }
  }, [adminRole, toast]);

  const refreshEverything = async () => {
    if (!isAdmin) return;

    setIsRefreshingAll(true);

    try {
      await Promise.all([
        loadSummary(),
        loadPosts(),
        loadReports(),
        loadComments(),
        loadProfiles(),
        loadAdminUsers(),
      ]);
    } finally {
      setIsRefreshingAll(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void loadSummary();
  }, [isAdmin, loadSummary]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadPosts();
  }, [isAdmin, loadPosts]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadReports();
  }, [isAdmin, loadReports]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadComments();
  }, [isAdmin, loadComments]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadProfiles();
  }, [isAdmin, loadProfiles]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadAdminUsers();
  }, [isAdmin, loadAdminUsers]);

  const handlePostStatusChange = async (postId: string, status: PostModerationStatus) => {
    setBusyAction(`post-status-${postId}`);

    try {
      await adminService.setPostStatus(postId, status);
      toast({ title: 'Post status updated', description: `Marked as ${status.replace('_', ' ')}.` });
      await Promise.all([loadPosts(), loadSummary()]);
    } catch (error) {
      console.error('Failed to update post status:', error);
      toast({
        title: 'Could not update post status',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Delete this post and all related comments and reports?')) return;

    setBusyAction(`delete-post-${postId}`);

    try {
      await adminService.deletePost(postId);
      toast({ title: 'Post deleted', description: 'The post and its linked data were removed.' });
      await Promise.all([loadSummary(), loadPosts(), loadReports(), loadComments(), loadProfiles()]);
    } catch (error) {
      console.error('Failed to delete post:', error);
      toast({
        title: 'Could not delete post',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleReportStatusChange = async (reportId: string, status: ReportModerationStatus) => {
    setBusyAction(`report-status-${reportId}`);

    try {
      await adminService.setReportStatus(reportId, status);
      toast({ title: 'Report status updated', description: `Marked as ${status}.` });
      await Promise.all([loadSummary(), loadReports()]);
    } catch (error) {
      console.error('Failed to update report status:', error);
      toast({
        title: 'Could not update report status',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Delete this comment? Replies under it will also be removed.')) return;

    setBusyAction(`delete-comment-${commentId}`);

    try {
      await adminService.deleteComment(commentId);
      toast({ title: 'Comment deleted', description: 'The comment was removed.' });
      await Promise.all([loadSummary(), loadComments(), loadProfiles(), loadPosts()]);
    } catch (error) {
      console.error('Failed to delete comment:', error);
      toast({
        title: 'Could not delete comment',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedRecipient) return;

    setBusyAction(`send-message-${selectedRecipient.userId}`);

    try {
      await adminService.sendInboxMessage({
        recipientUserId: selectedRecipient.userId,
        subject: messageSubject,
        content: messageContent,
        relatedPostId: messageRelatedPostId || undefined,
      });

      toast({
        title: 'Moderator message sent',
        description: `Sent to ${selectedRecipient.anonymousId}.`,
      });

      setMessageSubject('');
      setMessageContent('');
      setMessageRelatedPostId('');
      setSelectedRecipient(null);
    } catch (error) {
      console.error('Failed to send moderator message:', error);
      toast({
        title: 'Could not send message',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleUpsertAdmin = async () => {
    setBusyAction('admin-upsert');

    try {
      await adminService.upsertAdminUser(adminUserIdDraft.trim(), adminRoleDraft);
      toast({
        title: 'Admin access updated',
        description: `User now has ${adminRoleDraft.replace('_', ' ')} access.`,
      });
      setAdminUserIdDraft('');
      await Promise.all([loadAdminUsers(), loadSummary()]);
    } catch (error) {
      console.error('Failed to update admin access:', error);
      toast({
        title: 'Could not update admin access',
        description: 'Please check the user ID and try again.',
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRemoveAdmin = async (targetUserId: string) => {
    if (!window.confirm('Remove admin access for this user?')) return;

    setBusyAction(`admin-remove-${targetUserId}`);

    try {
      await adminService.removeAdminUser(targetUserId);
      toast({ title: 'Admin access removed' });
      await Promise.all([loadAdminUsers(), loadSummary()]);
    } catch (error) {
      console.error('Failed to remove admin access:', error);
      toast({
        title: 'Could not remove admin access',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-6xl px-4 py-6 sm:py-8 space-y-6">
          <div className="glass-card p-6 space-y-4">
            <div className="h-8 w-56 rounded cv-shimmer" />
            <div className="h-4 w-80 rounded cv-shimmer" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-28 rounded-xl cv-shimmer cv-stagger-enter" style={{ animationDelay: `${idx * 45}ms` }} />
              ))}
            </div>
          </div>
          <div className="glass-card p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="h-16 rounded-xl cv-shimmer cv-stagger-enter" style={{ animationDelay: `${idx * 35}ms` }} />
            ))}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-3xl px-4 py-12">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Admin Access Required
              </CardTitle>
              <CardDescription>
                This panel is only available to moderator and master-admin accounts.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/">Go to Feed</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/profile">Back to Profile</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 py-6 sm:py-8 space-y-6">
        <Card className="border-border/50">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Shield className="h-6 w-6 text-primary" />
                    Admin Panel
                  </CardTitle>
                  <Badge variant={roleTone(adminRole)}>{adminRole?.replace('_', ' ')}</Badge>
                </div>
                <CardDescription className="max-w-2xl">
                  Moderate reports, manage post and comment safety, send official inbox messages, and control admin access from one place.
                </CardDescription>
              </div>

              <Button variant="outline" onClick={() => void refreshEverything()} disabled={isRefreshingAll}>
                {isRefreshingAll ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh
              </Button>
              <Button variant="ghost" onClick={() => void handleSignOut()}>
                Sign Out
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AdminTab)} className="space-y-6">
          <TabsList
            className={`grid h-auto w-full gap-2 bg-transparent p-0 ${
              adminRole === 'master_admin' ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5'
            }`}
          >
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            {adminRole === 'master_admin' && <TabsTrigger value="admins">Admins</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <AdminMetricCard
                label="Total Posts"
                value={summaryLoading ? 0 : summary?.totalPosts ?? 0}
                helper="All reports currently stored"
              />
              <AdminMetricCard
                label="Open Reports"
                value={summaryLoading ? 0 : summary?.openReports ?? 0}
                helper="Still waiting for moderator review"
              />
              <AdminMetricCard
                label="Under Review Posts"
                value={summaryLoading ? 0 : summary?.underReviewPosts ?? 0}
                helper="Posts already moved into review"
              />
              <AdminMetricCard
                label="Known Users"
                value={summaryLoading ? 0 : summary?.totalUsers ?? 0}
                helper="Profiles linked to authenticated users"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Queue Snapshot</CardTitle>
                  <CardDescription>Useful counts to help you decide what to review next.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reviewing Reports</p>
                    <p className="mt-2 text-2xl font-semibold">{summary?.reviewingReports ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Comments</p>
                    <p className="mt-2 text-2xl font-semibold">{summary?.totalComments ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admins</p>
                    <p className="mt-2 text-2xl font-semibold">{summary?.activeAdmins ?? 0}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Recommended Workflow</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>1. Review `open` reports first and move urgent posts into `under_review` or `escalated`.</p>
                  <p>2. Remove unsafe comments and posts before sending official moderator messages.</p>
                  <p>3. Use the `Admins` tab only for trusted operators. Master-admin access is global.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="posts" className="space-y-4">
            <Card className="border-border/50">
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                <div className="flex-1">
                  <Label htmlFor="admin-post-search">Search posts</Label>
                  <Input
                    id="admin-post-search"
                    value={postSearch}
                    onChange={(event) => setPostSearch(event.target.value)}
                    placeholder="Search by content, pseudonym, location, or category"
                    className="mt-2"
                  />
                </div>
                <div className="w-full md:w-56">
                  <Label>Post status</Label>
                  <Select value={postStatusFilter} onValueChange={(value) => setPostStatusFilter(value as 'all' | PostModerationStatus)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {postStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {postsLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="h-48 rounded-2xl cv-shimmer" />
                ))
              ) : posts.length === 0 ? (
                <Card className="border-border/50">
                  <CardContent className="py-10 text-center text-muted-foreground">No posts matched the current filters.</CardContent>
                </Card>
              ) : (
                posts.map((post) => (
                  <Card key={post.id} className="border-border/50">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{post.anonymousId}</Badge>
                            <Badge>{post.status.replace('_', ' ')}</Badge>
                            <Badge variant="secondary">{post.severity}</Badge>
                            <Badge variant="secondary">{post.category}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Created {formatDateTime(post.createdAt)}
                            {post.location ? ` • ${post.location}` : ''}
                            {post.incidentDate ? ` • Incident ${post.incidentDate}` : ''}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <p>{post.credibleVotes} credible</p>
                          <p>{post.suspiciousVotes} suspicious</p>
                          <p>{post.commentCount} comments</p>
                          <p>{post.reportCount} reports</p>
                        </div>
                      </div>

                      <p className="whitespace-pre-wrap break-words text-sm leading-6">{clipText(post.content)}</p>

                      <div className="flex flex-col gap-3 border-t border-border/60 pt-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Select
                            value={post.status}
                            onValueChange={(value) => void handlePostStatusChange(post.id, value as PostModerationStatus)}
                            disabled={busyAction === `post-status-${post.id}`}
                          >
                            <SelectTrigger className="w-full sm:w-52">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {postStatuses.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status.replace('_', ' ')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" onClick={() => setActiveTab('comments')}>
                            Review comments
                          </Button>
                        </div>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => void handleDeletePost(post.id)}
                          disabled={busyAction === `delete-post-${post.id}`}
                        >
                          {busyAction === `delete-post-${post.id}` ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                          )}
                          Delete post
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <Card className="border-border/50">
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                <div className="flex-1">
                  <Label htmlFor="admin-report-search">Search reports</Label>
                  <Input
                    id="admin-report-search"
                    value={reportSearch}
                    onChange={(event) => setReportSearch(event.target.value)}
                    placeholder="Search by reason, details, post, or reporter"
                    className="mt-2"
                  />
                </div>
                <div className="w-full md:w-56">
                  <Label>Report status</Label>
                  <Select value={reportStatusFilter} onValueChange={(value) => setReportStatusFilter(value as 'all' | ReportModerationStatus)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {reportStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {reportsLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="h-44 rounded-2xl cv-shimmer" />
                ))
              ) : reports.length === 0 ? (
                <Card className="border-border/50">
                  <CardContent className="py-10 text-center text-muted-foreground">No reports matched the current filters.</CardContent>
                </Card>
              ) : (
                reports.map((report) => (
                  <Card key={report.id} className="border-border/50">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge>{report.status}</Badge>
                            <Badge variant="secondary">Post {report.postStatus.replace('_', ' ')}</Badge>
                            <Badge variant="outline">{report.postAnonymousId}</Badge>
                            {report.reporterAnonymousId && <Badge variant="outline">Reporter {report.reporterAnonymousId}</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">Created {formatDateTime(report.createdAt)}</p>
                        </div>
                        <Badge variant="secondary">{report.reason.replace('_', ' ')}</Badge>
                      </div>

                      <div className="space-y-2 text-sm">
                        <p className="font-medium">Post excerpt</p>
                        <p className="text-muted-foreground">{report.postExcerpt}</p>
                      </div>

                      {report.details && (
                        <div className="space-y-2 text-sm">
                          <p className="font-medium">Reporter details</p>
                          <p className="whitespace-pre-wrap break-words text-muted-foreground">{clipText(report.details)}</p>
                        </div>
                      )}

                      <div className="border-t border-border/60 pt-4">
                        <Select
                          value={report.status}
                          onValueChange={(value) => void handleReportStatusChange(report.id, value as ReportModerationStatus)}
                          disabled={busyAction === `report-status-${report.id}`}
                        >
                          <SelectTrigger className="w-full sm:w-52">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {reportStatuses.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="comments" className="space-y-4">
            <Card className="border-border/50">
              <CardContent className="p-4">
                <Label htmlFor="admin-comment-search">Search comments</Label>
                <Input
                  id="admin-comment-search"
                  value={commentSearch}
                  onChange={(event) => setCommentSearch(event.target.value)}
                  placeholder="Search by comment content, pseudonym, or parent post"
                  className="mt-2"
                />
              </CardContent>
            </Card>

            <div className="space-y-4">
              {commentsLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="h-40 rounded-2xl cv-shimmer" />
                ))
              ) : comments.length === 0 ? (
                <Card className="border-border/50">
                  <CardContent className="py-10 text-center text-muted-foreground">No comments matched the current filters.</CardContent>
                </Card>
              ) : (
                comments.map((comment) => (
                  <Card key={comment.id} className="border-border/50">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{comment.anonymousId}</Badge>
                            <Badge variant="secondary">Post {comment.postAnonymousId}</Badge>
                            {comment.parentCommentId && <Badge variant="secondary">Reply</Badge>}
                            {comment.editedAt && <Badge variant="outline">Edited</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Created {formatDateTime(comment.createdAt)} • {comment.upvoteCount} upvotes • {comment.downvoteCount} downvotes • {comment.directReplyCount} direct replies
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => void handleDeleteComment(comment.id)}
                          disabled={busyAction === `delete-comment-${comment.id}`}
                        >
                          {busyAction === `delete-comment-${comment.id}` ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                          )}
                          Delete
                        </Button>
                      </div>

                      <p className="whitespace-pre-wrap break-words text-sm leading-6">{clipText(comment.content)}</p>

                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
                        <p className="font-medium">Parent post excerpt</p>
                        <p className="mt-1 text-muted-foreground">{comment.postExcerpt}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card className="border-border/50">
              <CardContent className="p-4">
                <Label htmlFor="admin-user-search">Search users</Label>
                <Input
                  id="admin-user-search"
                  value={profileSearch}
                  onChange={(event) => setProfileSearch(event.target.value)}
                  placeholder="Search by pseudonym or auth user ID"
                  className="mt-2"
                />
              </CardContent>
            </Card>

            {selectedRecipient && (
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Message {selectedRecipient.anonymousId}
                  </CardTitle>
                  <CardDescription>
                    This sends an official moderator inbox message to the selected user.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-message-subject">Subject</Label>
                    <Input
                      id="admin-message-subject"
                      value={messageSubject}
                      onChange={(event) => setMessageSubject(event.target.value)}
                      placeholder="Why you are contacting this user"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-message-post-id">Related post ID (optional)</Label>
                    <Input
                      id="admin-message-post-id"
                      value={messageRelatedPostId}
                      onChange={(event) => setMessageRelatedPostId(event.target.value)}
                      placeholder="Attach a post UUID if the note is about a specific report"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-message-content">Message</Label>
                    <Textarea
                      id="admin-message-content"
                      value={messageContent}
                      onChange={(event) => setMessageContent(event.target.value)}
                      placeholder="Explain the moderation action or request more context."
                      className="min-h-36"
                    />
                  </div>

                  <div className="flex flex-wrap justify-end gap-3">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSelectedRecipient(null);
                        setMessageSubject('');
                        setMessageContent('');
                        setMessageRelatedPostId('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => void handleSendMessage()}
                      disabled={
                        busyAction === `send-message-${selectedRecipient.userId}` ||
                        !messageSubject.trim() ||
                        !messageContent.trim()
                      }
                    >
                      {busyAction === `send-message-${selectedRecipient.userId}` ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Send moderator message
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              {profilesLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="h-44 rounded-2xl cv-shimmer" />
                ))
              ) : profiles.length === 0 ? (
                <Card className="border-border/50">
                  <CardContent className="py-10 text-center text-muted-foreground">No users matched the current filters.</CardContent>
                </Card>
              ) : (
                profiles.map((profile) => (
                  <Card key={profile.profileId} className="border-border/50">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{profile.anonymousId}</Badge>
                            <Badge variant="secondary">{profile.credibilityLevel}</Badge>
                            {!profile.inboxEnabled && <Badge variant="outline">Inbox off</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            User ID {profile.userId} • Joined {formatDateTime(profile.createdAt)}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-sm">
                          <div className="rounded-lg bg-muted/20 px-3 py-2">
                            <p className="font-semibold">{profile.postCount}</p>
                            <p className="text-xs text-muted-foreground">posts</p>
                          </div>
                          <div className="rounded-lg bg-muted/20 px-3 py-2">
                            <p className="font-semibold">{profile.commentCount}</p>
                            <p className="text-xs text-muted-foreground">comments</p>
                          </div>
                          <div className="rounded-lg bg-muted/20 px-3 py-2">
                            <p className="font-semibold">{profile.reportCount}</p>
                            <p className="text-xs text-muted-foreground">reports</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>Credibility score: {profile.credibilityScore}%</span>
                        <span>•</span>
                        <span>Reports submitted: {profile.reportsCount}</span>
                        <span>•</span>
                        <span>Self-destruct: {profile.selfDestructDays ? `${profile.selfDestructDays} days` : 'Never'}</span>
                      </div>

                      <div className="border-t border-border/60 pt-4">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedRecipient(profile);
                            setActiveTab('users');
                          }}
                        >
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Message user
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {adminRole === 'master_admin' && (
            <TabsContent value="admins" className="space-y-4">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <UserCog className="h-5 w-5 text-primary" />
                    Manage Admin Access
                  </CardTitle>
                  <CardDescription>
                    Add or update moderator and master-admin access by authenticated user ID.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-[1fr_180px_auto]">
                  <div className="space-y-2">
                    <Label htmlFor="admin-user-id">Target auth user ID</Label>
                    <Input
                      id="admin-user-id"
                      value={adminUserIdDraft}
                      onChange={(event) => setAdminUserIdDraft(event.target.value)}
                      placeholder="Paste the user's auth UUID"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={adminRoleDraft} onValueChange={(value) => setAdminRoleDraft(value as AdminRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="moderator">moderator</SelectItem>
                        <SelectItem value="master_admin">master_admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button
                      className="w-full md:w-auto"
                      onClick={() => void handleUpsertAdmin()}
                      disabled={busyAction === 'admin-upsert' || !adminUserIdDraft.trim()}
                    >
                      {busyAction === 'admin-upsert' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Shield className="mr-2 h-4 w-4" />
                      )}
                      Save access
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                {adminUsersLoading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="h-36 rounded-2xl cv-shimmer" />
                  ))
                ) : adminUsers.length === 0 ? (
                  <Card className="border-border/50">
                    <CardContent className="py-10 text-center text-muted-foreground">No admin users are configured yet.</CardContent>
                  </Card>
                ) : (
                  adminUsers.map((adminUser) => (
                    <Card key={adminUser.userId} className="border-border/50">
                      <CardContent className="space-y-4 p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge>{adminUser.role.replace('_', ' ')}</Badge>
                              {adminUser.anonymousId && <Badge variant="outline">{adminUser.anonymousId}</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              User ID {adminUser.userId} • Added {formatDateTime(adminUser.createdAt)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Added by {adminUser.createdByAnonymousId || adminUser.createdBy || 'manual SQL seed'}
                            </p>
                          </div>

                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => void handleRemoveAdmin(adminUser.userId)}
                            disabled={busyAction === `admin-remove-${adminUser.userId}` || adminUser.userId === user.id}
                          >
                            {busyAction === `admin-remove-${adminUser.userId}` ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Remove access
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
