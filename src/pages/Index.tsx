import { memo, useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { FilterButton } from '@/components/FilterButton';
import { EnhancedPostCard } from '@/components/EnhancedPostCard';
import { GuidedReportDialog } from '@/components/GuidedReportDialog';
import { Footer } from '@/components/Footer';
import { LegalDisclaimer } from '@/components/LegalDisclaimer';
import { TopicFollowing } from '@/components/TopicFollowing';
import { CommentsCard } from '@/components/CommentsCard';
import { ScrollReveal } from '@/components/ScrollReveal';
import { PostService } from '@/services/PostService';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CATEGORIES as CATEGORY_OPTIONS } from '@/lib/anonymity';
import type { Post, Category, Severity } from '@/lib/anonymity';
import type { FollowedTopic } from '@/lib/types';
import { TrendingUp, Clock, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type SortOption = 'recent' | 'trending';

const postService = PostService.getInstance();
const POSTS_PAGE_SIZE = 10;

type CachedPost = Post & { userId?: string };
type InfinitePostsCache = {
  pages: Array<{
    posts: CachedPost[];
    hasMore: boolean;
  }>;
  pageParams: unknown[];
};

interface PostWithCommentsProps {
  post: Post;
  eagerMedia: boolean;
  isCommentsOpen: boolean;
  onCommentsClick: (post: Post) => void;
  onCloseComments: () => void;
}

function mergeRealtimePost(currentPost: CachedPost, row: Record<string, unknown>): CachedPost {
  return {
    ...currentPost,
    anonymousId: typeof row.anonymous_id === 'string' ? row.anonymous_id : currentPost.anonymousId,
    content: typeof row.content === 'string' ? row.content : currentPost.content,
    category: typeof row.category === 'string' ? row.category as Category : currentPost.category,
    severity: typeof row.severity === 'string' ? row.severity as Severity : currentPost.severity,
    evidenceType: typeof row.evidence_type === 'string' ? row.evidence_type as Post['evidenceType'] : currentPost.evidenceType,
    location: row.location === null ? undefined : typeof row.location === 'string' ? row.location : currentPost.location,
    incidentDate: row.incident_date === null ? undefined : typeof row.incident_date === 'string' ? row.incident_date : currentPost.incidentDate,
    incidentTime: row.incident_time === null ? undefined : typeof row.incident_time === 'string' ? row.incident_time : currentPost.incidentTime,
    imageUrl: row.image_url === null ? undefined : typeof row.image_url === 'string' ? row.image_url : currentPost.imageUrl,
    createdAt: typeof row.created_at === 'string' ? new Date(row.created_at) : currentPost.createdAt,
    credibleVotes: typeof row.credible_votes === 'number' ? row.credible_votes : currentPost.credibleVotes,
    suspiciousVotes: typeof row.suspicious_votes === 'number' ? row.suspicious_votes : currentPost.suspiciousVotes,
    commentCount: typeof row.comment_count === 'number' ? row.comment_count : currentPost.commentCount,
    reportCount: typeof row.report_count === 'number' ? row.report_count : currentPost.reportCount,
    status: typeof row.status === 'string' ? row.status : currentPost.status,
    selfDestructAt: row.self_destruct_at === null
      ? undefined
      : typeof row.self_destruct_at === 'string'
        ? new Date(row.self_destruct_at)
        : currentPost.selfDestructAt,
    userId: row.user_id === null ? undefined : typeof row.user_id === 'string' ? row.user_id : currentPost.userId,
  };
}

const PostWithComments = memo(function PostWithComments({
  post,
  eagerMedia,
  isCommentsOpen,
  onCommentsClick,
  onCloseComments,
}: PostWithCommentsProps) {
  const postRef = useRef<HTMLDivElement>(null);
  const [postHeight, setPostHeight] = useState<number | undefined>(undefined);
  const [commentCount, setCommentCount] = useState(post.commentCount);

  useEffect(() => {
    setCommentCount(post.commentCount);
  }, [post.commentCount]);

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
          post={{ ...post, commentCount }}
          eagerMedia={eagerMedia}
          onCommentsClick={onCommentsClick}
          isCommentsOpen={isCommentsOpen}
        />
      </div>
      {isCommentsOpen && (
        <CommentsCard
          postId={post.id}
          commentCount={commentCount}
          onCountChange={setCommentCount}
          onClose={onCloseComments}
          height={postHeight}
        />
      )}
    </div>
  );
});

export default function Index() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['posts'],
    queryFn: ({ pageParam = 0 }) => postService.fetchPage(POSTS_PAGE_SIZE, pageParam),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length * POSTS_PAGE_SIZE : undefined,
    initialPageParam: 0,
  });

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [followedTopics, setFollowedTopics] = useState<FollowedTopic[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const scrollGateRef = useRef(0);
  const lastConsumedGateRef = useRef(0);
  const posts = useMemo(() => data?.pages.flatMap((page) => page.posts) ?? [], [data]);

  const handleCommentsClick = useCallback((post: Post) => {
    setSelectedPostId((current) => current === post.id ? null : post.id);
  }, []);

  const handleCloseComments = useCallback(() => {
    setSelectedPostId(null);
  }, []);

  // Real-time subscription for new posts
  useEffect(() => {
    const channel = supabase
      .channel('posts-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['posts'] });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['posts'] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        const postId = typeof row.id === 'string' ? row.id : null;

        if (!postId) {
          return;
        }

        queryClient.setQueryData(['posts'], (current: InfinitePostsCache | undefined) => {
          if (!current?.pages) {
            return current;
          }

          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              posts: page.posts.map((post) => post.id === postId ? mergeRealtimePost(post, row) : post),
            })),
          };
        });

        queryClient.setQueryData(['post', postId], (current: CachedPost | null | undefined) => {
          if (!current) {
            return current;
          }

          return mergeRealtimePost(current, row);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    let cancelled = false;

    const loadFollowedTopics = async () => {
      if (!user) {
        if (!cancelled) {
          setProfileId(null);
          setFollowedTopics([]);
        }
        return;
      }

      const { data: initialProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      let profile = initialProfile;

      if (profileError) {
        if (!cancelled) {
          setProfileId(null);
          setFollowedTopics([]);
        }
        return;
      }

      if (!profile) {
        const { data: ensuredProfile, error: ensureError } = await supabase.rpc('update_profile_preferences', {
          p_inbox_enabled: false,
          p_self_destruct_days: null,
        });

        if (ensureError) {
          if (!cancelled) {
            setProfileId(null);
            setFollowedTopics([]);
          }
          return;
        }

        const ensured = Array.isArray(ensuredProfile) ? ensuredProfile[0] : ensuredProfile;
        profile = ensured ? { id: ensured.id as string } : null;
      }

      if (!profile) {
        if (!cancelled) {
          setProfileId(null);
          setFollowedTopics([]);
        }
        return;
      }

      const { data: topics, error: topicsError } = await supabase
        .from('followed_topics')
        .select('topic_type, topic_value, topic_label')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: true });

      if (cancelled) return;

      if (topicsError) {
        setProfileId(profile.id);
        setFollowedTopics([]);
        return;
      }

      setProfileId(profile.id);
      setFollowedTopics((topics || []).map((topic) => ({
        type: topic.topic_type as FollowedTopic['type'],
        value:
          topic.topic_type === 'category'
            ? CATEGORY_OPTIONS.find(
                (category) =>
                  category.id === topic.topic_value || category.label === topic.topic_label
              )?.id ?? topic.topic_value
            : topic.topic_value,
        label: topic.topic_label,
      })));
    };

    loadFollowedTopics();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const handleScroll = () => {
      scrollGateRef.current += 1;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!loadMoreRef.current) return;
    const node = loadMoreRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const userScrolledSinceLastFetch = scrollGateRef.current > lastConsumedGateRef.current;
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage && userScrolledSinceLastFetch) {
          lastConsumedGateRef.current = scrollGateRef.current;
          fetchNextPage();
        }
      },
      { rootMargin: '520px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

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

  const handleFollow = async (topic: FollowedTopic) => {
    if (!user || !profileId) {
      toast.error('Sign in to follow topics', {
        action: {
          label: 'Sign In',
          onClick: () => navigate('/auth'),
        },
      });
      return;
    }

    const normalizedValue = topic.type === 'location' ? topic.value.toLowerCase() : topic.value;

    const { data, error } = await supabase
      .from('followed_topics')
      .insert({
        profile_id: profileId,
        topic_type: topic.type,
        topic_value: normalizedValue,
        topic_label: topic.label,
      })
      .select('topic_type, topic_value, topic_label')
      .single();

    if (error) {
      if (error.code === '23505') {
        toast.info('You are already following this topic');
      } else {
        toast.error('Unable to follow this topic right now');
      }
      return;
    }

    setFollowedTopics((prev) => [
      ...prev,
      {
        type: data.topic_type as FollowedTopic['type'],
        value: data.topic_value,
        label: data.topic_label,
      },
    ]);
    toast.success(`Now following ${data.topic_label}`);
  };

  const handleUnfollow = async (topic: FollowedTopic) => {
    if (!user || !profileId) {
      setFollowedTopics((prev) => prev.filter((t) => !(t.type === topic.type && t.value === topic.value)));
      return;
    }

    const { error } = await supabase
      .from('followed_topics')
      .delete()
      .eq('profile_id', profileId)
      .eq('topic_type', topic.type)
      .eq('topic_value', topic.value);

    if (error) {
      toast.error('Unable to unfollow this topic right now');
      return;
    }

    setFollowedTopics((prev) => prev.filter((t) => !(t.type === topic.type && t.value === topic.value)));
  };

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
            <>
              {filteredPosts.map((post, idx) => (
                <ScrollReveal
                  key={post.id}
                  delayMs={Math.min((idx % POSTS_PAGE_SIZE) * 18, 126)}
                >
                  <PostWithComments
                    post={post}
                    eagerMedia={idx < 2}
                    isCommentsOpen={selectedPostId === post.id && !isMobile}
                    onCommentsClick={handleCommentsClick}
                    onCloseComments={handleCloseComments}
                  />
                </ScrollReveal>
              ))}

              <div ref={loadMoreRef} className="h-4" />

              {isFetchingNextPage && (
                <div className="max-w-2xl mx-auto space-y-3 py-2">
                  {Array.from({ length: 2 }).map((_, idx) => (
                    <div key={idx} className="glass-card p-4 space-y-2 cv-stagger-enter" style={{ animationDelay: `${idx * 60}ms` }}>
                      <div className="h-4 w-3/4 rounded cv-shimmer" />
                      <div className="h-4 w-full rounded cv-shimmer" />
                      <div className="h-4 w-2/3 rounded cv-shimmer" />
                    </div>
                  ))}
                </div>
              )}
            </>
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
