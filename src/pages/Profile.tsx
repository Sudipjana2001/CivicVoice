import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  Shield, 
  User, 
  Bell, 
  Clock, 
  MapPin, 
  Tag, 
  Trash2, 
  Plus,
  FileText,
  ThumbsUp,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EnhancedPostCard } from '@/components/EnhancedPostCard';
import { Post } from '@/lib/anonymity';
import { CATEGORIES as CATEGORY_OPTIONS } from '@/lib/anonymity';
import { PostService } from '@/services/PostService';

interface Profile {
  id: string;
  anonymous_id: string;
  credibility_score: number;
  reports_count: number;
  credibility_level: string;
  inbox_enabled: boolean;
  self_destruct_days: number | null;
}

interface FollowedTopic {
  id: string;
  topic_type: string;
  topic_value: string;
  topic_label: string;
}

interface AlertPreferences {
  new_incidents: boolean;
  status_updates: boolean;
  weekly_digest: boolean;
}

interface ActivityItem {
  id: string;
  activity_type: string;
  description: string;
  created_at: string;
}

type ProfileTab = 'posts' | 'settings' | 'topics' | 'alerts' | 'activity';

function isProfileTab(value: string | null): value is ProfileTab {
  return value === 'posts' || value === 'settings' || value === 'topics' || value === 'alerts' || value === 'activity';
}

export default function Profile() {
  const { user, loading: authLoading, signOut, isAdmin, adminRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [followedTopics, setFollowedTopics] = useState<FollowedTopic[]>([]);
  const [alertPrefs, setAlertPrefs] = useState<AlertPreferences>({
    new_incidents: true,
    status_updates: true,
    weekly_digest: false
  });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationInput, setLocationInput] = useState('');

  const tabParam = searchParams.get('tab');
  const activeTab: ProfileTab = isProfileTab(tabParam) ? tabParam : 'settings';

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const fetchProfileData = useCallback(async () => {
    if (!user) return;
    
    try {
      // Fetch profile
      const { data: initialProfileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      let profileData = initialProfileData;

      if (profileError) throw profileError;
      if (!profileData) {
        const { data: ensuredProfile, error: ensureError } = await supabase.rpc('update_profile_preferences', {
          p_inbox_enabled: false,
          p_self_destruct_days: null,
        });

        if (ensureError) throw ensureError;
        profileData = (Array.isArray(ensuredProfile) ? ensuredProfile[0] : ensuredProfile) as Profile | null;
      }

      if (!profileData) {
        throw new Error('Profile could not be created');
      }

      setProfile(profileData);

      // Fetch followed topics
      const { data: topicsData } = await supabase
        .from('followed_topics')
        .select('*')
        .eq('profile_id', profileData.id);
      setFollowedTopics(topicsData || []);

      // Fetch alert preferences
      const { data: alertData } = await supabase
        .from('alert_preferences')
        .select('*')
        .eq('profile_id', profileData.id)
        .single();
      if (alertData) {
        setAlertPrefs({
          new_incidents: alertData.new_incidents,
          status_updates: alertData.status_updates,
          weekly_digest: alertData.weekly_digest
        });
      }

      // Fetch activity history
      const { data: activityData } = await supabase
        .from('activity_history')
        .select('*')
        .eq('profile_id', profileData.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setActivities(activityData || []);

      // Fetch user posts
      const posts = await PostService.getInstance().fetchByUserId(user.id);
      setUserPosts(posts);

    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProfileData();
    }
  }, [user, fetchProfileData]);

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!profile) return;
    
    setSaving(true);
    const nextProfile = {
      ...profile,
      ...updates,
    };

    const { data, error } = await supabase.rpc('update_profile_preferences', {
      p_inbox_enabled: nextProfile.inbox_enabled,
      p_self_destruct_days: nextProfile.self_destruct_days,
    });
    const savedProfile = Array.isArray(data) ? data[0] : data;

    if (error) {
      toast({ title: 'Error', description: 'Failed to update profile', variant: 'destructive' });
    } else {
      setProfile((savedProfile as Profile) || nextProfile);
      toast({ title: 'Saved', description: 'Profile updated successfully' });
    }
    setSaving(false);
  };

  const updateAlertPreferences = async (updates: Partial<AlertPreferences>) => {
    if (!profile) return;
    
    const newPrefs = { ...alertPrefs, ...updates };
    setAlertPrefs(newPrefs);

    const { error } = await supabase
      .from('alert_preferences')
      .upsert({ 
        profile_id: profile.id,
        ...newPrefs 
      }, { onConflict: 'profile_id' });

    if (error) {
      toast({ title: 'Error', description: 'Failed to update preferences', variant: 'destructive' });
    }
  };

  const addFollowedTopic = async (type: 'location' | 'category', value: string, label: string) => {
    if (!profile) return;

    const normalizedValue = type === 'location' ? value.trim().toLowerCase() : value.trim();

    const { data, error } = await supabase
      .from('followed_topics')
      .insert({
        profile_id: profile.id,
        topic_type: type,
        topic_value: normalizedValue,
        topic_label: label
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Already following', description: 'You already follow this topic', variant: 'destructive' });
      }
    } else if (data) {
      setFollowedTopics([...followedTopics, data]);
      toast({ title: 'Following', description: `Now following ${label}` });
    }
  };

  const removeFollowedTopic = async (topicId: string) => {
    const { error } = await supabase
      .from('followed_topics')
      .delete()
      .eq('id', topicId);

    if (!error) {
      setFollowedTopics(followedTopics.filter(t => t.id !== topicId));
      toast({ title: 'Unfollowed', description: 'Topic removed from following' });
    }
  };

  const getCredibilityBadge = () => {
    if (!profile) return null;
    const badges: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      none: { label: 'New User', variant: 'outline' },
      new: { label: 'New Reporter', variant: 'secondary' },
      trusted: { label: 'Trusted Reporter', variant: 'default' },
      veteran: { label: 'Veteran Reporter', variant: 'default' }
    };
    return badges[profile.credibility_level] || badges.new;
  };

  const getActivityIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      report_submitted: <FileText className="h-4 w-4 text-primary" />,
      vote_cast: <ThumbsUp className="h-4 w-4 text-green-500" />,
      topic_followed: <Tag className="h-4 w-4 text-blue-500" />,
      status_changed: <CheckCircle2 className="h-4 w-4 text-yellow-500" />,
      inbox_message: <MessageSquare className="h-4 w-4 text-purple-500" />
    };
    return icons[type] || <AlertTriangle className="h-4 w-4" />;
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl space-y-6">
          <div className="glass-card p-5 sm:p-6 space-y-4">
            <div className="h-8 w-44 rounded cv-shimmer" />
            <div className="h-4 w-60 rounded cv-shimmer" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-10 rounded cv-shimmer cv-stagger-enter" style={{ animationDelay: `${idx * 40}ms` }} />
              ))}
            </div>
          </div>
          <div className="glass-card p-5 sm:p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-4 rounded cv-shimmer cv-stagger-enter" style={{ animationDelay: `${idx * 35}ms` }} />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  const badge = getCredibilityBadge();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl">
        {/* Profile Header */}
        <Card className="mb-6 border-border/50">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                </div>
                <div>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
                    {profile.anonymous_id}
                    {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
                  </CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-xs sm:text-sm">
                    <span>{profile.reports_count} reports</span>
                    <span>•</span>
                    <span>Credibility: {profile.credibility_score}%</span>
                  </CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="cv-interactive">Sign Out</Button>
            </div>
          </CardHeader>
        </Card>

        {isAdmin && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Admin tools enabled</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You currently have {adminRole?.replace('_', ' ')} access. Open the admin panel to moderate posts, comments, and user messages.
                </p>
              </div>
              <Button onClick={() => navigate('/admin')} className="cv-interactive">
                Open Admin Panel
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Profile Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            const next = new URLSearchParams(searchParams);
            if (value === 'settings') next.delete('tab');
            else next.set('tab', value);
            setSearchParams(next, { replace: true });
          }}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="posts" className="text-xs sm:text-sm px-1 sm:px-3">My Reports</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs sm:text-sm px-1 sm:px-3">Settings</TabsTrigger>
            <TabsTrigger value="topics" className="text-xs sm:text-sm px-1 sm:px-3">Following</TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs sm:text-sm px-1 sm:px-3">Alerts</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs sm:text-sm px-1 sm:px-3">Activity</TabsTrigger>
          </TabsList>

          {/* My Reports Tab */}
          <TabsContent value="posts" className="space-y-4">
            <div className="flex flex-col gap-4">
              {userPosts.length > 0 ? (
                userPosts.map((post, idx) => (
                  <div key={post.id} className="cv-stagger-enter" style={{ animationDelay: `${Math.min(idx * 45, 360)}ms` }}>
                    <EnhancedPostCard 
                      post={post} 
                      onPostDeleted={() => {
                        // refresh posts after deletion
                        PostService.getInstance().fetchByUserId(user.id).then(setUserPosts);
                      }}
                    />
                  </div>
                ))
              ) : (
                <Card className="border-border/50 bg-muted/20">
                  <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground mb-3 opacity-20" />
                    <p className="text-muted-foreground font-medium">No reports submitted yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Your anonymous reports will appear here</p>
                    <Button 
                      variant="link" 
                      className="mt-2 text-primary"
                      onClick={() => navigate('/')}
                    >
                      Go to Feed to report
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Privacy & Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Label className="text-sm">Anonymous Inbox</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                      Allow journalists and NGOs to send you messages
                    </p>
                  </div>
                  <Switch
                    checked={profile.inbox_enabled}
                    onCheckedChange={(checked) => updateProfile({ inbox_enabled: checked })}
                    disabled={saving}
                    className="flex-shrink-0"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    Auto-Delete Posts
                  </Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Queue your future reports for scheduled deletion after a set period. This is not immediate erasure and depends on cleanup jobs running.
                  </p>
                  <Select
                    value={profile.self_destruct_days?.toString() || 'never'}
                    onValueChange={(value) => 
                      updateProfile({ 
                        self_destruct_days: value === 'never' ? null : parseInt(value) 
                      })
                    }
                  >
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="7">After 7 days</SelectItem>
                      <SelectItem value="30">After 30 days</SelectItem>
                      <SelectItem value="90">After 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Best-effort wipe */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Best-Effort Wipe
                  </Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Runs a best-effort cleanup of server records older than 6 months that belong to your account, then clears local traces from this device. Storage files or already shared copies may still need separate cleanup.
                  </p>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={async () => {
                      if (!window.confirm(
                        'This will:\n• Run a best-effort cleanup of older server records tied to your account\n• Erase local storage, cookies, and cache from this device\n• Redirect to a blank page\n\nThis is not a guarantee that every copy is erased.\n\nContinue?'
                      )) return;

                      try {
                        const { DataWipeService } = await import('@/services/DataWipeService');
                        const wipeService = DataWipeService.getInstance();
                        const result = await wipeService.emergencyWipe();
                        
                        if (result.success) {
                          const total = Object.values(result.deletedCounts).reduce((a, b) => a + b, 0);
                          alert(`Cleaned up ${total} older records that the server could remove.\nNow clearing local data...`);
                        }

                        const { panicWipe } = await import('@/lib/privacyShield');
                        panicWipe();
                      } catch (err) {
                        console.error('Wipe failed:', err);
                        const { panicWipe } = await import('@/lib/privacyShield');
                        panicWipe();
                      }
                    }}
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Best-Effort Wipe
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Topics Tab */}
          <TabsContent value="topics">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Followed Topics
                </CardTitle>
                <CardDescription>
                  Get notified about new incidents in these areas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Topics */}
                {followedTopics.length > 0 && (
                  <div className="space-y-2">
                    <Label>Currently Following</Label>
                    <div className="flex flex-wrap gap-2">
                      {followedTopics.map((topic) => (
                        <Badge 
                          key={topic.id} 
                          variant="secondary"
                          className="flex items-center gap-1 pr-1"
                        >
                          {topic.topic_type === 'location' ? (
                            <MapPin className="h-3 w-3" />
                          ) : (
                            <Tag className="h-3 w-3" />
                          )}
                          {topic.topic_label}
                          <button
                            onClick={() => removeFollowedTopic(topic.id)}
                            className="ml-1 p-0.5 hover:bg-destructive/20 rounded"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Add Location */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Follow Location
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={locationInput}
                      onChange={(e) => setLocationInput(e.target.value)}
                      placeholder="Enter a town, village, street, or lane"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        !locationInput.trim() ||
                        followedTopics.some(
                          (topic) =>
                            topic.topic_type === 'location' &&
                            topic.topic_value === locationInput.trim().toLowerCase()
                        )
                      }
                      onClick={() => {
                        const trimmedLocation = locationInput.trim();
                        if (!trimmedLocation) return;
                        addFollowedTopic('location', trimmedLocation, trimmedLocation);
                        setLocationInput('');
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>

                {/* Add Category */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Follow Category
                  </Label>
                  <div className="flex gap-2 flex-wrap">
                    {CATEGORY_OPTIONS.filter((category) => 
                      !followedTopics.some(
                        (topic) =>
                          topic.topic_type === 'category' &&
                          (topic.topic_value === category.id || topic.topic_label === category.label)
                      )
                    ).map((category) => (
                      <Button
                        key={category.id}
                        variant="outline"
                        size="sm"
                        onClick={() => addFollowedTopic('category', category.id, category.label)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {category.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Alert Preferences
                </CardTitle>
                <CardDescription>
                  Control how and when you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Label className="text-sm">New Incidents</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                      Notify when new incidents appear in followed topics
                    </p>
                  </div>
                  <Switch
                    checked={alertPrefs.new_incidents}
                    onCheckedChange={(checked) => 
                      updateAlertPreferences({ new_incidents: checked })
                    }
                    className="flex-shrink-0"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Label className="text-sm">Status Updates</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                      Notify when posts you engaged with change status
                    </p>
                  </div>
                  <Switch
                    checked={alertPrefs.status_updates}
                    onCheckedChange={(checked) => 
                      updateAlertPreferences({ status_updates: checked })
                    }
                    className="flex-shrink-0"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Label className="text-sm">Weekly Digest</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                      Receive a summary of activity in your followed topics
                    </p>
                  </div>
                  <Switch
                    checked={alertPrefs.weekly_digest}
                    onCheckedChange={(checked) => 
                      updateAlertPreferences({ weekly_digest: checked })
                    }
                    className="flex-shrink-0"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Activity History
                </CardTitle>
                <CardDescription>
                  Your recent actions on the platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No activity yet</p>
                    <p className="text-sm">Your actions will appear here</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {activities.map((activity, idx) => (
                        <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 cv-stagger-enter" style={{ animationDelay: `${Math.min(idx * 25, 260)}ms` }}>
                          <div className="mt-0.5">
                            {getActivityIcon(activity.activity_type)}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm">{activity.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(activity.created_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
}
