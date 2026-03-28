import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { VoiceCard } from '@/components/VoiceCard';
import { CreateVoiceDialog } from '@/components/CreateVoiceDialog';
import { CivicFeedService } from '@/services/CivicFeedService';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Megaphone,
  Clock,
  TrendingUp,
  Loader2,
  AlertTriangle,
  MessageCircle,
  RefreshCw,
  Rss,
} from 'lucide-react';
import { toast } from 'sonner';
import type { CivicFeedItem, FeedSortOption } from '@/lib/civicSocial';

const feedService = CivicFeedService.getInstance();

export default function CivicFeedPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<FeedSortOption>('latest');
  const [typeFilter, setTypeFilter] = useState<'all' | 'issue' | 'voice' | 'update'>('all');

  const { data: feedItems = [], isLoading, error } = useQuery({
    queryKey: ['civic-feed', sortBy],
    queryFn: () => feedService.fetchGlobalFeed(sortBy, 50),
  });

  const filteredItems = useMemo(() => {
    if (typeFilter === 'all') return feedItems;
    return feedItems.filter((item) => item.itemType === typeFilter);
  }, [feedItems, typeFilter]);

  const handleSupport = async (voiceId: string, supported: boolean) => {
    try {
      await feedService.setVoiceSupport(voiceId, supported);
    } catch {
      toast.error('Failed to update support');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container py-6 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Rss className="h-5 w-5 text-primary" />
              Community Feed
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Civic issues, voices, and updates from the community
            </p>
          </div>
          {user && (
            <CreateVoiceDialog
              onCreated={() => queryClient.invalidateQueries({ queryKey: ['civic-feed'] })}
            />
          )}
        </div>

        {/* Sort & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="flex items-center gap-2">
            <Button
              variant={sortBy === 'latest' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('latest')}
              className="gap-1.5 text-xs h-8"
            >
              <Clock className="h-3.5 w-3.5" />
              Latest
            </Button>
            <Button
              variant={sortBy === 'most_supported' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('most_supported')}
              className="gap-1.5 text-xs h-8"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Most Supported
            </Button>
          </div>

          <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)} className="sm:ml-auto">
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs h-6 px-2.5">All</TabsTrigger>
              <TabsTrigger value="issue" className="text-xs h-6 px-2.5 gap-1">
                <AlertTriangle className="h-3 w-3" />Issues
              </TabsTrigger>
              <TabsTrigger value="voice" className="text-xs h-6 px-2.5 gap-1">
                <Megaphone className="h-3 w-3" />Voices
              </TabsTrigger>
              <TabsTrigger value="update" className="text-xs h-6 px-2.5 gap-1">
                <MessageCircle className="h-3 w-3" />Updates
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Feed Content */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="glass-card p-4 space-y-3 cv-stagger-enter" style={{ animationDelay: `${idx * 70}ms` }}>
                  <div className="flex gap-2">
                    <div className="h-6 w-16 rounded-full cv-shimmer" />
                    <div className="h-6 w-24 rounded-full cv-shimmer" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-full rounded cv-shimmer" />
                    <div className="h-4 w-[85%] rounded cv-shimmer" />
                    <div className="h-4 w-[60%] rounded cv-shimmer" />
                  </div>
                  <div className="flex gap-3 pt-1">
                    <div className="h-8 w-24 rounded cv-shimmer" />
                    <div className="h-8 w-20 rounded cv-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12 glass-card">
              <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-destructive opacity-60" />
              <p className="text-sm text-destructive">Failed to load feed</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-1.5"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['civic-feed'] })}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 glass-card">
              <Megaphone className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">
                {feedItems.length === 0
                  ? 'No activity in the community yet'
                  : `No ${typeFilter}s found`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Be the first to raise your voice!
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <VoiceCard
                key={item.id}
                item={item}
                onSupport={handleSupport}
              />
            ))
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
