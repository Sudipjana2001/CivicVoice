import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, MapPin, ThumbsUp, ThumbsDown, Share2, Camera, Video, FileText, Users, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CommentsSection } from '@/components/CommentsSection';
import { CategoryBadge } from '@/components/CategoryBadge';
import { SeverityBadge } from '@/components/SeverityBadge';
import { IncidentStatusBadge } from '@/components/IncidentStatusBadge';
import { LegalDisclaimer } from '@/components/LegalDisclaimer';
import { ReportPostButton } from '@/components/ReportPostButton';
import { PostService } from '@/services/PostService';
import { VoteService } from '@/services/VoteService';
import { useAuth } from '@/hooks/useAuth';
import { EvidenceService } from '@/services/EvidenceService';
import type { EvidenceType } from '@/lib/anonymity';
import { formatIncidentTiming } from '@/lib/postTiming';
import type { IncidentStatus } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

const postService = PostService.getInstance();
const voteService = VoteService.getInstance();
const evidenceService = EvidenceService.getInstance();

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

  const { data: post, isLoading, error } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => postService.fetchById(postId!),
    enabled: !!postId,
  });

  const [credibleVotes, setCredibleVotes] = useState(0);
  const [suspiciousVotes, setSuspiciousVotes] = useState(0);
  const [userVote, setUserVote] = useState<'credible' | 'suspicious' | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [isEvidenceViewerOpen, setIsEvidenceViewerOpen] = useState(false);
  const [votePulse, setVotePulse] = useState<'credible' | 'suspicious' | null>(null);
  const [evidenceHref, setEvidenceHref] = useState<string | null>(null);

  useEffect(() => {
    if (post) {
      setCredibleVotes(post.credibleVotes);
      setSuspiciousVotes(post.suspiciousVotes);
    }
  }, [post]);

  useEffect(() => {
    if (post && user) {
      voteService.getUserVote(post.id)
        .then(vote => {
          if (vote) setUserVote(vote);
        })
        .catch((error) => {
          console.error('Error loading vote state:', error);
        });
    }
  }, [post, user]);

  useEffect(() => {
    let cancelled = false;

    const loadEvidenceUrl = async () => {
      if (!post?.imageUrl) {
        setEvidenceHref(null);
        return;
      }

      try {
        const url = await evidenceService.resolveEvidenceUrl(post.imageUrl);
        if (!cancelled) {
          setEvidenceHref(url);
        }
      } catch (error) {
        console.error('Evidence error:', error);
        if (!cancelled) {
          setEvidenceHref(null);
        }
      }
    };

    loadEvidenceUrl();

    return () => {
      cancelled = true;
    };
  }, [post?.imageUrl]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-3xl mx-auto space-y-4 pt-16">
          <div className="glass-card p-4 space-y-3">
            <div className="h-40 rounded-lg cv-shimmer" />
            <div className="h-6 w-40 rounded cv-shimmer" />
            <div className="h-4 w-full rounded cv-shimmer" />
            <div className="h-4 w-5/6 rounded cv-shimmer" />
          </div>
          <div className="glass-card p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-4 rounded cv-shimmer cv-stagger-enter" style={{ animationDelay: `${idx * 40}ms` }} />
            ))}
          </div>
        </div>
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
    setVotePulse(type);
    window.setTimeout(() => setVotePulse((prev) => (prev === type ? null : prev)), 240);

    try {
      const result = await voteService.toggleVote(
        post.id, type
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
  const incidentTiming = formatIncidentTiming(post);
  const status = (post.status ?? 'submitted') as IncidentStatus;

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
            {evidenceHref && (
              <div className="relative h-48 overflow-hidden">
                {post.evidenceType === 'photo' ? (
                  <button type="button" onClick={() => setIsEvidenceViewerOpen(true)} className="block w-full h-full">
                    <img
                      src={evidenceHref}
                      alt="Evidence"
                      className="w-full h-full object-cover cursor-zoom-in cv-media-enter"
                    />
                  </button>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted/40">
                    <div className="text-center space-y-2">
                      {post.evidenceType === 'video' ? (
                        <Video className="h-8 w-8 mx-auto text-muted-foreground" />
                      ) : (
                        <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
                      )}
                      <p className="text-xs text-muted-foreground">Evidence available</p>
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                <div className="absolute top-2 right-2 bg-card/80 backdrop-blur-sm px-2 py-1 rounded text-xs text-muted-foreground">
                  Private evidence
                </div>
                <div className="absolute bottom-2 right-2">
                  <Button size="sm" variant="secondary" className="gap-1 h-8" onClick={() => setIsEvidenceViewerOpen(true)}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    View Evidence
                  </Button>
                </div>
              </div>
            )}
            
            <div className="p-4 space-y-3">
              {/* Status badges */}
              <div className="flex flex-wrap items-center gap-2">
                <IncidentStatusBadge status={status} size="sm" />
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
              </div>

              {post.imageUrl && !evidenceHref && (
                <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  {user
                    ? 'Private evidence is attached, but the temporary access link is unavailable right now.'
                    : 'Private evidence is attached to this report. Sign in to open it with a temporary access link.'}
                </div>
              )}

              {/* Time and location */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(post.createdAt, { addSuffix: true })}
                </span>
                {incidentTiming && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {incidentTiming}
                  </span>
                )}
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
                    className={`px-2 h-8 cv-interactive ${userVote === 'credible' ? 'credibility-positive' : 'text-muted-foreground hover:text-credible'} ${votePulse === 'credible' ? 'cv-tap-pop' : ''}`}
                  >
                    <ThumbsUp className="h-4 w-4" />
                    <span className="text-xs ml-1">{credibleVotes}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleVote('suspicious')}
                    disabled={isVoting}
                    className={`px-2 h-8 cv-interactive ${userVote === 'suspicious' ? 'credibility-negative' : 'text-muted-foreground hover:text-suspicious'} ${votePulse === 'suspicious' ? 'cv-tap-pop' : ''}`}
                  >
                    <ThumbsDown className="h-4 w-4" />
                    <span className="text-xs ml-1">{suspiciousVotes}</span>
                  </Button>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-2 h-8 text-muted-foreground hover:text-foreground cv-interactive"
                    onClick={async () => {
                      const shareUrl = `${window.location.origin}/comments/${post.id}`;
                      const shareText = `${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : ''}`;

                      if (navigator.share) {
                        try {
                          await navigator.share({
                            title: 'CivicVoice Report',
                            text: shareText,
                            url: shareUrl,
                          });
                        } catch {
                          // User cancelled share.
                        }
                      } else {
                        await navigator.clipboard.writeText(shareUrl);
                        toast.success('Link copied to clipboard');
                      }
                    }}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <ReportPostButton
                    postId={post.id}
                    initialCount={post.reportCount}
                    className="px-2 h-8 text-muted-foreground hover:text-destructive cv-interactive"
                  />
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
      <Dialog open={isEvidenceViewerOpen} onOpenChange={setIsEvidenceViewerOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Evidence Viewer</DialogTitle>
          </DialogHeader>
          <div className="w-full max-h-[75vh] overflow-auto">
            {post.evidenceType === 'photo' && evidenceHref && (
              <img src={evidenceHref} alt="Evidence full view" className="w-full h-auto rounded-md cv-media-enter" />
            )}
            {post.evidenceType === 'video' && evidenceHref && (
              <video controls className="w-full rounded-md cv-media-enter" src={evidenceHref}>
                Your browser cannot play this video.
              </video>
            )}
            {post.evidenceType === 'document' && evidenceHref && (
              <div className="space-y-3 cv-media-enter">
                <p className="text-sm text-muted-foreground">
                  Documents open in a separate tab so CivicVoice does not embed third-party viewers directly.
                </p>
                <Button asChild>
                  <a href={evidenceHref} target="_blank" rel="noreferrer">
                    Open document
                  </a>
                </Button>
              </div>
            )}
            {post.evidenceType && post.evidenceType !== 'photo' && post.evidenceType !== 'video' && post.evidenceType !== 'document' && evidenceHref && (
              <div className="space-y-3 cv-media-enter">
                <p className="text-sm text-muted-foreground">
                  This attachment opens in a separate tab to avoid embedding unknown content inside the app.
                </p>
                <Button asChild>
                  <a href={evidenceHref} target="_blank" rel="noreferrer">
                    Open attachment
                  </a>
                </Button>
              </div>
            )}
            {post.imageUrl && !evidenceHref && (
              <p className="text-sm text-muted-foreground">
                This evidence is unavailable, expired, or hidden because it does not meet the app&apos;s current privacy rules.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
