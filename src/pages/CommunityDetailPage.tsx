import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { VoiceCard } from '@/components/VoiceCard';
import { CreateVoiceDialog } from '@/components/CreateVoiceDialog';
import { CommunityService } from '@/services/CommunityService';
import { CivicFeedService } from '@/services/CivicFeedService';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  MapPin,
  Globe,
  Lock,
  ArrowLeft,
  Loader2,
  Megaphone,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';

const communityService = CommunityService.getInstance();
const feedService = CivicFeedService.getInstance();

export default function CommunityDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: allCommunities = [], isLoading } = useQuery({
    queryKey: ['communities'],
    queryFn: () => communityService.listCommunities(),
  });

  const community = allCommunities.find((c) => c.slug === slug);

  const { data: memberships = [] } = useQuery({
    queryKey: ['community-memberships'],
    queryFn: () => communityService.listMemberships(),
    enabled: !!user,
  });

  const isMember = community
    ? memberships.some((m) => m.communityId === community.id)
    : false;

  const myMembership = community
    ? memberships.find((m) => m.communityId === community.id)
    : undefined;

  const joinMutation = useMutation({
    mutationFn: (communityId: string) => communityService.joinCommunity(communityId),
    onSuccess: () => {
      toast.success('Joined community!');
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['community-memberships'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to join'),
  });

  const leaveMutation = useMutation({
    mutationFn: (communityId: string) => communityService.leaveCommunity(communityId),
    onSuccess: () => {
      toast.success('Left community');
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['community-memberships'] });
    },
    onError: () => toast.error('Failed to leave community'),
  });

  const handleVoiceSupport = async (voiceId: string, supported: boolean) => {
    try {
      await feedService.setVoiceSupport(voiceId, supported);
    } catch {
      toast.error('Failed to update support');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-16 text-center">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-16 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h2 className="text-lg font-semibold mb-2">Community not found</h2>
          <Button onClick={() => navigate('/communities')} variant="outline" className="gap-2 mt-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Communities
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container py-6 max-w-3xl">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/communities')}
          className="gap-1.5 mb-4 -ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Communities
        </Button>

        {/* Community Header */}
        <div className="glass-card p-5 sm:p-6 space-y-4 mb-6">
          {community.bannerUrl && (
            <div className="h-32 -m-5 sm:-m-6 mb-0 rounded-t-lg overflow-hidden">
              <img src={community.bannerUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {community.avatarUrl ? (
                <img
                  src={community.avatarUrl}
                  alt={community.name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-background"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-7 w-7 text-primary" />
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold">{community.name}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  {community.visibility === 'private' ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                      <Lock className="h-3 w-3" /> Private
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                      <Globe className="h-3 w-3" /> Public
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground hidden sm:inline">•</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                    <Users className="h-3 w-3" /> {community.memberCount} members
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {user && (
                isMember ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => leaveMutation.mutate(community.id)}
                    disabled={leaveMutation.isPending}
                  >
                    Leave
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => joinMutation.mutate(community.id)}
                    disabled={joinMutation.isPending}
                  >
                    Join
                  </Button>
                )
              )}
            </div>
          </div>

          {community.description && (
            <p className="text-sm text-muted-foreground">{community.description}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {community.civicFocus && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Shield className="h-3 w-3" />
                {community.civicFocus}
              </Badge>
            )}
            {community.location && (
              <Badge variant="outline" className="text-xs gap-1">
                <MapPin className="h-3 w-3" />
                {community.location}
              </Badge>
            )}
            {myMembership && (
              <Badge variant="outline" className="text-xs capitalize">
                {myMembership.role}
              </Badge>
            )}
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="feed" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:flex">
              <TabsTrigger value="feed" className="text-xs gap-1.5">
                <Megaphone className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Community Feed</span>
                <span className="sm:hidden">Feed</span>
              </TabsTrigger>
              <TabsTrigger value="about" className="text-xs gap-1.5">
                <Users className="h-3.5 w-3.5" />
                About
              </TabsTrigger>
            </TabsList>

            {isMember && (
              <div className="w-full sm:w-auto flex justify-center sm:justify-end">
                <CreateVoiceDialog
                  communityId={community.id}
                  onCreated={() => queryClient.invalidateQueries({ queryKey: ['community-feed'] })}
                />
              </div>
            )}
          </div>

          <TabsContent value="feed" className="space-y-4">
            <CommunityFeedContent
              communityId={community.id}
              onSupport={handleVoiceSupport}
            />
          </TabsContent>

          <TabsContent value="about">
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold">About this Community</h3>
              <p className="text-sm text-muted-foreground">
                {community.description || 'No description provided.'}
              </p>
              <div className="text-xs text-muted-foreground">
                Created {community.createdAt.toLocaleDateString()}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}

function CommunityFeedContent({
  communityId,
  onSupport,
}: {
  communityId: string;
  onSupport: (id: string, supported: boolean) => void;
}) {
  const { data: feedItems = [], isLoading } = useQuery({
    queryKey: ['community-feed', communityId],
    queryFn: () => CivicFeedService.getInstance().fetchGlobalFeed('latest', 50),
  });

  const communityItems = feedItems.filter((item) => item.communityId === communityId);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (communityItems.length === 0) {
    return (
      <div className="text-center py-12 glass-card">
        <Megaphone className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">No voices in this community yet</p>
        <p className="text-xs text-muted-foreground mt-1">Be the first to raise your voice!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {communityItems.map((item) => (
        <VoiceCard
          key={item.id}
          item={item}
          onSupport={onSupport}
        />
      ))}
    </div>
  );
}
