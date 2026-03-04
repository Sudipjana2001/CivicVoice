import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, ThumbsUp, ThumbsDown, Share2, Flag, Camera, Video, FileText, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CommentsSection } from '@/components/CommentsSection';
import { CategoryBadge } from '@/components/CategoryBadge';
import { SeverityBadge } from '@/components/SeverityBadge';
import { IncidentStatusBadge } from '@/components/IncidentStatusBadge';
import { EvidenceConfidenceScore } from '@/components/EvidenceConfidenceScore';
import { CredibilityBadge } from '@/components/CredibilityBadge';
import { LegalDisclaimer } from '@/components/LegalDisclaimer';
import { PostService } from '@/services/PostService';
import { VoteService } from '@/services/VoteService';
import { useAuth } from '@/hooks/useAuth';
import { getAnonymousSession } from '@/lib/anonymity';
import type { Post, EvidenceType } from '@/lib/anonymity';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

const postService = PostService.getInstance();
const voteService = VoteService.getInstance();

const evidenceIconMap: Record<EvidenceType, React.ElementType> = {
  photo: Camera,
  video: Video,
  document: FileText,
  witness: Users,
};

export default function CommentsPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const session = getAnonymousSession();

  const { data: post, isLoading, error } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => postService.fetchById(postId!),
    enabled: !!postId,
  });

  const [credibleVotes, setCredibleVotes] = useState(0);
  const [suspiciousVotes, setSuspiciousVotes] = useState(0);
  const [userVote, setUserVote] = useState<'credible' | 'suspicious' | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  useEffect(() => {
    if (post) {
      setCredibleVotes(post.credibleVotes);
      setSuspiciousVotes(post.suspiciousVotes);
    }
  }, [post]);

  useEffect(() => {
    if (post && user) {
      voteService.getUserVote(post.id, session.token).then(vote => {
        if (vote) setUserVote(vote);
      });
    }
  }, [post, user, session.token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!post || error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Post not found</p>
          <Button variant="ghost" onClick={() => navigate(-1)} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go back
          </Button>
        </div>
      </div>
    );
  }

  const handleVote = async (type: 'credible' | 'suspicious') => {
    if (!user) {
      toast.error('Please sign in to vote', {
        action: { label: 'Sign In', onClick: () => navigate('/auth') },
      });
      return;
    }
    if (isVoting) return;
    setIsVoting(true);

    try {
      const result = await voteService.toggleVote(
        post.id, session.token, type, userVote, credibleVotes, suspiciousVotes
      );
      setUserVote(result.newVote);
      setCredibleVotes(result.credibleVotes);
      setSuspiciousVotes(result.suspiciousVotes);
    } catch (err) {
      console.error('Vote error:', err);
      toast.error('Failed to register vote');
    } finally {
      setIsVoting(false);
    }
  };

  const EvidenceIcon = post.evidenceType ? evidenceIconMap[post.evidenceType] : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Comments</h1>
        </div>
      </header>

      {/* Post content */}
      <div className="p-4">
        <Card className="glass-card overflow-hidden mb-4">
          <CardContent className="p-0">
            {post.imageUrl && (
              <div className="relative h-48 overflow-hidden">
                <img 
                  src={post.imageUrl} 
                  alt="Evidence" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                <div className="absolute top-2 right-2 bg-card/80 backdrop-blur-sm px-2 py-1 rounded text-xs text-muted-foreground">
                  Faces auto-blurred
                </div>
              </div>
            )}
            
            <div className="p-4 space-y-3">
              {/* Status badges */}
              <div className="flex flex-wrap items-center gap-2">
                <IncidentStatusBadge status="submitted" size="sm" />
                <EvidenceConfidenceScore level="medium" size="sm" />
              </div>

              {/* Category and severity */}
              <div className="flex flex-wrap items-center gap-2">
                <CategoryBadge category={post.category} size="sm" />
                <SeverityBadge severity={post.severity} size="sm" />
                {EvidenceIcon && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <EvidenceIcon className="h-3 w-3" />
                    Evidence
                  </span>
                )}
              </div>

              {/* Anonymous ID */}
              <div className="flex items-center gap-2">
                <span className="anonymous-id text-xs font-medium">{post.anonymousId}</span>
                <CredibilityBadge badge={{ level: 'new', reportsCount: 1, credibilityScore: 75 }} />
              </div>

              {/* Time and location */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(post.createdAt, { addSuffix: true })}
                </span>
                {post.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {post.location}
                  </span>
                )}
              </div>

              {/* Content */}
              <p className="text-foreground/90 text-sm leading-relaxed">
                {post.content}
              </p>

              {/* Legal disclaimer */}
              <LegalDisclaimer variant="compact" />

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleVote('credible')}
                    disabled={isVoting}
                    className={`px-2 h-8 ${userVote === 'credible' ? 'credibility-positive' : 'text-muted-foreground hover:text-credible'}`}
                  >
                    <ThumbsUp className="h-4 w-4" />
                    <span className="text-xs ml-1">{credibleVotes}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleVote('suspicious')}
                    disabled={isVoting}
                    className={`px-2 h-8 ${userVote === 'suspicious' ? 'credibility-negative' : 'text-muted-foreground hover:text-suspicious'}`}
                  >
                    <ThumbsDown className="h-4 w-4" />
                    <span className="text-xs ml-1">{suspiciousVotes}</span>
                  </Button>
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="px-2 h-8 text-muted-foreground hover:text-foreground">
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="px-2 h-8 text-muted-foreground hover:text-destructive">
                    <Flag className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comments section */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-4">Comments ({post.commentCount})</h2>
            <CommentsSection postId={post.id} initialCount={post.commentCount} isFullPage />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
