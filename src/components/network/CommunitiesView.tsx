import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CommunityCard } from '@/components/CommunityCard';
import { CommunityService } from '@/services/CommunityService';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Plus, Globe, User as UserIcon, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { CommunityVisibility } from '@/lib/civicSocial';

const communityService = CommunityService.getInstance();

export function CommunitiesView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<CommunityVisibility>('public');
  const [civicFocus, setCivicFocus] = useState('');
  const [location, setLocation] = useState('');

  const { data: communities = [], isLoading } = useQuery({
    queryKey: ['communities'],
    queryFn: () => communityService.listCommunities(),
  });

  const { data: memberships = [] } = useQuery({
    queryKey: ['community-memberships'],
    queryFn: () => communityService.listMemberships(),
    enabled: !!user,
  });

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

  const createMutation = useMutation({
    mutationFn: () =>
      communityService.createCommunity({
        name: name.trim(),
        slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
        description: description.trim() || undefined,
        visibility,
        civicFocus: civicFocus.trim() || undefined,
        location: location.trim() || undefined,
      }),
    onSuccess: (community) => {
      toast.success('Community created!');
      setCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['community-memberships'] });
      navigate(`/communities/${community.slug}`);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create community'),
  });

  const resetForm = () => {
    setName('');
    setSlug('');
    setDescription('');
    setVisibility('public');
    setCivicFocus('');
    setLocation('');
  };

  const memberCommunityIds = new Set(memberships.map((m) => m.communityId));
  const myCommunities = communities.filter((c) => memberCommunityIds.has(c.id));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            Local Communities
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Join civic communities near you.
          </p>
        </div>
        {user && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create Community</span>
                <span className="sm:hidden">Create</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Create Community
                </DialogTitle>
                <DialogDescription>
                  Build a civic community around local issues.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs mb-1.5 block">Community Name *</Label>
                  <Input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!slug || slug === name.trim().toLowerCase().replace(/\s+/g, '-')) {
                        setSlug(e.target.value.trim().toLowerCase().replace(/\s+/g, '-'));
                      }
                    }}
                    placeholder="e.g., Clean Rivers Initiative"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Slug *</Label>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="clean-rivers-initiative"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this community about?"
                    className="min-h-[80px] resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1.5 block">Visibility</Label>
                    <Select value={visibility} onValueChange={(v) => setVisibility(v as CommunityVisibility)}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Civic Focus</Label>
                    <Input
                      value={civicFocus}
                      onChange={(e) => setCivicFocus(e.target.value)}
                      placeholder="e.g., Environment"
                      className="h-9"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Location</Label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Kolkata, India"
                    className="h-9"
                  />
                </div>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!name.trim() || !slug.trim() || createMutation.isPending}
                  className="w-full gap-2"
                >
                  {createMutation.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
                  Create Community
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="bg-transparent border-b border-border w-full justify-start rounded-none h-auto p-0 space-x-4">
          <TabsTrigger 
            value="all" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 data-[state=active]:shadow-none font-medium text-muted-foreground data-[state=active]:text-foreground"
          >
            All Communities
          </TabsTrigger>
          {user && (
            <TabsTrigger 
              value="mine" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 data-[state=active]:shadow-none font-medium text-muted-foreground data-[state=active]:text-foreground"
            >
              My Communities
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all" className="pt-2">
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
            </div>
          ) : communities.length === 0 ? (
            <div className="text-center py-12 glass-card">
              <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">No communities yet</p>
              <p className="text-xs text-muted-foreground mt-1">Be the first to create one!</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {communities.map((community) => (
                <CommunityCard
                  key={community.id}
                  community={community}
                  isMember={memberCommunityIds.has(community.id)}
                  onJoin={(id) => joinMutation.mutate(id)}
                  onLeave={(id) => leaveMutation.mutate(id)}
                  onOpen={(slug) => navigate(`/communities/${slug}`)}
                  isLoading={joinMutation.isPending || leaveMutation.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {user && (
          <TabsContent value="mine" className="pt-2">
            {myCommunities.length === 0 ? (
              <div className="text-center py-12 glass-card">
                <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">You haven't joined any communities yet</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {myCommunities.map((community) => (
                  <CommunityCard
                    key={community.id}
                    community={community}
                    isMember={true}
                    onJoin={(id) => joinMutation.mutate(id)}
                    onLeave={(id) => leaveMutation.mutate(id)}
                    onOpen={(slug) => navigate(`/communities/${slug}`)}
                    isLoading={leaveMutation.isPending}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
