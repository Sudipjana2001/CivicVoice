import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { FilterButton } from '@/components/FilterButton';
import { EnhancedPostCard } from '@/components/EnhancedPostCard';
import { GuidedReportDialog } from '@/components/GuidedReportDialog';
import { Footer } from '@/components/Footer';
import { LegalDisclaimer } from '@/components/LegalDisclaimer';
import { TopicFollowing } from '@/components/TopicFollowing';
import { CommentsCard } from '@/components/CommentsCard';
import { PostService } from '@/services/PostService';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Post, Category, Severity } from '@/lib/anonymity';
import type { FollowedTopic } from '@/lib/types';
import { TrendingUp, Clock, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link } from 'react-router-dom';

type SortOption = 'recent' | 'trending';

const postService = PostService.getInstance();

export default function Index() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: posts = [], isLoading, error } = useQuery({
    queryKey: ['posts'],
    queryFn: () => postService.fetchAll(),
  });

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [followedTopics, setFollowedTopics] = useState<FollowedTopic[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // Real-time subscription for new posts
  useEffect(() => {
    const channel = supabase
      .channel('posts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['posts'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filteredPosts = useMemo(() => {
    let result = [...posts];

    if (selectedCategory) {
      result = result.filter(post => post.category === selectedCategory);
    }

    if (selectedSeverity) {
      result = result.filter(post => post.severity === selectedSeverity);
    }

    if (sortBy === 'recent') {
      result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else {
      result.sort((a, b) => 
        (b.credibleVotes + b.commentCount) - (a.credibleVotes + a.commentCount)
      );
    }

    return result;
  }, [posts, selectedCategory, selectedSeverity, sortBy]);

  const handlePostCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['posts'] });
  };

  const handleFollow = (topic: FollowedTopic) => {
    setFollowedTopics(prev => [...prev, topic]);
  };

  const handleUnfollow = (topic: FollowedTopic) => {
    setFollowedTopics(prev => prev.filter(t => !(t.type === topic.type && t.value === topic.value)));
  };

  const handleCommentsClick = (post: Post) => {
    if (selectedPostId === post.id) {
      setSelectedPostId(null);
    } else {
      setSelectedPostId(post.id);
    }
  };

  const handleCloseComments = () => {
    setSelectedPostId(null);
  };

  // Component to handle post + comments with height sync
  function PostWithComments({ 
    post, 
    isCommentsOpen, 
    onCommentsClick, 
    onCloseComments 
  }: { 
    post: Post; 
    isCommentsOpen: boolean; 
    onCommentsClick: (post: Post) => void; 
    onCloseComments: () => void;
  }) {
    const postRef = useRef<HTMLDivElement>(null);
    const [postHeight, setPostHeight] = useState<number | undefined>(undefined);

    const syncPostHeight = useCallback(() => {
      if (!postRef.current) return;
      const nextHeight = Math.ceil(postRef.current.getBoundingClientRect().height);
      setPostHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    }, []);

    useEffect(() => {
      if (!isCommentsOpen) {
        setPostHeight(undefined);
        return;
      }

      syncPostHeight();

      let resizeObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined' && postRef.current) {
        resizeObserver = new ResizeObserver(() => {
          syncPostHeight();
        });
        resizeObserver.observe(postRef.current);
      }

      const handleWindowResize = () => syncPostHeight();
      window.addEventListener('resize', handleWindowResize);

      return () => {
        window.removeEventListener('resize', handleWindowResize);
        resizeObserver?.disconnect();
      };
    }, [isCommentsOpen, syncPostHeight]);

    return (
      <div className={`grid items-start gap-4 ${isCommentsOpen ? 'grid-cols-2' : 'grid-cols-1 max-w-2xl mx-auto'}`}>
        <div ref={postRef} className="self-start">
          <EnhancedPostCard 
            post={post} 
            onCommentsClick={onCommentsClick}
            isCommentsOpen={isCommentsOpen}
          />
        </div>
        {isCommentsOpen && (
          <CommentsCard 
            postId={post.id} 
            commentCount={post.commentCount}
            onClose={onCloseComments}
            height={postHeight}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <LegalDisclaimer variant="banner" />

      <main className="flex-1 container py-8">
        {/* Header with actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={sortBy === 'recent' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('recent')}
              className="gap-2"
            >
              <Clock className="h-4 w-4" />
              Recent
            </Button>
            <Button
              variant={sortBy === 'trending' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('trending')}
              className="gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Trending
            </Button>
            <FilterButton
              selectedCategory={selectedCategory}
              selectedSeverity={selectedSeverity}
              onCategoryChange={setSelectedCategory}
              onSeverityChange={setSelectedSeverity}
            />
            <TopicFollowing
              followedTopics={followedTopics}
              onFollow={handleFollow}
              onUnfollow={handleUnfollow}
            />
          </div>

          {user ? (
            <GuidedReportDialog onPostCreated={handlePostCreated} />
          ) : (
            <Link to="/auth">
              <Button variant="outline" size="sm" className="gap-2">
                <LogIn className="h-4 w-4" />
                Sign in to Report
              </Button>
            </Link>
          )}
        </div>

        {/* Posts */}
        <div className="max-w-4xl mx-auto space-y-4">
          {isLoading ? (
            <div className="max-w-2xl mx-auto space-y-4">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="glass-card p-4 sm:p-5 space-y-3 cv-stagger-enter" style={{ animationDelay: `${idx * 70}ms` }}>
                  <div className="h-40 rounded-lg cv-shimmer" />
                  <div className="flex gap-2">
                    <div className="h-6 w-20 rounded-full cv-shimmer" />
                    <div className="h-6 w-24 rounded-full cv-shimmer" />
                    <div className="h-6 w-20 rounded-full cv-shimmer" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-full rounded cv-shimmer" />
                    <div className="h-4 w-[88%] rounded cv-shimmer" />
                    <div className="h-4 w-[70%] rounded cv-shimmer" />
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <div className="h-8 w-36 rounded cv-shimmer" />
                    <div className="h-8 w-24 rounded cv-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12 glass-card max-w-2xl mx-auto">
              <p className="text-destructive">Failed to load reports. Please try again.</p>
            </div>
          ) : filteredPosts.length > 0 ? (
            filteredPosts.map((post, idx) => (
              <div
                key={post.id}
                className="cv-stagger-enter"
                style={{ animationDelay: `${Math.min(idx * 70, 560)}ms` }}
              >
                <PostWithComments
                  post={post}
                  isCommentsOpen={selectedPostId === post.id && !isMobile}
                  onCommentsClick={handleCommentsClick}
                  onCloseComments={handleCloseComments}
                />
              </div>
            ))
          ) : (
            <div className="text-center py-12 glass-card max-w-2xl mx-auto">
              <p className="text-muted-foreground">
                {posts.length === 0 
                  ? 'No reports yet. Be the first to report an incident!'
                  : 'No reports match your filters. Try adjusting your criteria.'}
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
