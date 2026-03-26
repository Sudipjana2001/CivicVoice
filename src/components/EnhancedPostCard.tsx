import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Calendar,
  Clock, 
  MapPin, 
  ThumbsUp, 
  ThumbsDown, 
  MessageCircle, 
  Share2, 
  FileText,
  Camera,
  Video,
  Users,
  Link2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Edit2,
  Trash2,
  X,
  Check
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CategoryBadge } from './CategoryBadge';
import { SeverityBadge } from './SeverityBadge';
import { IncidentStatusBadge } from './IncidentStatusBadge';
import { CredibilityBadge } from './CredibilityBadge';
import { LegalDisclaimer } from './LegalDisclaimer';
import { RelatedIncidents } from './RelatedIncidents';
import { ReportPostButton } from './ReportPostButton';

import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { VoteService } from '@/services/VoteService';
import { EvidenceService } from '@/services/EvidenceService';
import type { Post, EvidenceType } from '@/lib/anonymity';
import type { IncidentStatus, ConfidenceLevel, VisibilityTag, CredibilityBadgeInfo, RelatedIncident } from '@/lib/types';
import { formatIncidentTiming } from '@/lib/postTiming';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const voteService = VoteService.getInstance();
const evidenceService = EvidenceService.getInstance();

const evidenceIconMap: Record<EvidenceType, React.ElementType> = {
  photo: Camera,
  video: Video,
  document: FileText,
  witness: Users,
};

// Extended post type for display
interface ExtendedPostData extends Post {
  status?: IncidentStatus;
  confidenceScore?: ConfidenceLevel;
  visibilityTags?: VisibilityTag[];
  credibilityBadge?: CredibilityBadgeInfo;
  relatedIncidentCount?: number;
  relatedIncidents?: RelatedIncident[];
}

interface EnhancedPostCardProps {
  post: ExtendedPostData;
  onCommentsClick?: (post: ExtendedPostData) => void;
  isCommentsOpen?: boolean;
  onPostDeleted?: () => void;
}

export function EnhancedPostCard({ post, onCommentsClick, isCommentsOpen, onPostDeleted }: EnhancedPostCardProps) {
  const CONTENT_PREVIEW_LIMIT = 280;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [credibleVotes, setCredibleVotes] = useState(post.credibleVotes);
  const [suspiciousVotes, setSuspiciousVotes] = useState(post.suspiciousVotes);
  const [userVote, setUserVote] = useState<'credible' | 'suspicious' | null>(null);
  const [showRelated, setShowRelated] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [isEvidenceViewerOpen, setIsEvidenceViewerOpen] = useState(false);
  const [votePulse, setVotePulse] = useState<'credible' | 'suspicious' | null>(null);
  const [evidenceHref, setEvidenceHref] = useState<string | null>(null);

  // Ownership is server-backed through posts.user_id
  const isOwner = Boolean(user?.id && post.userId && user.id === post.userId);

  // Fetch existing vote on mount
  useEffect(() => {
    if (!user) return; // Only check votes for logged-in users
    voteService.getUserVote(post.id)
      .then(vote => {
        if (vote) setUserVote(vote);
      })
      .catch((error) => {
        console.error('Error loading vote state:', error);
      });
  }, [post.id, user]);

  useEffect(() => {
    let cancelled = false;

    const loadEvidenceUrl = async () => {
      if (!post.imageUrl) {
        setEvidenceHref(null);
        return;
      }

      try {
        const url = await evidenceService.resolveEvidenceUrl(post.imageUrl);
        if (!cancelled) {
          setEvidenceHref(url);
        }
      } catch (error) {
        console.error('Error resolving evidence:', error);
        if (!cancelled) {
          setEvidenceHref(null);
        }
      }
    };

    loadEvidenceUrl();

    return () => {
      cancelled = true;
    };
  }, [post.imageUrl]);

  const handleCommentsClick = () => {
    if (isMobile) {
      navigate(`/comments/${post.id}`);
    } else if (onCommentsClick) {
      onCommentsClick(post);
    }
  };

  const relatedIncidentCount = useMemo(() => 
    post.relatedIncidentCount ?? 0, 
    [post.relatedIncidentCount]
  );

  const relatedIncidents = useMemo(() => {
    if (post.relatedIncidents) return post.relatedIncidents;
    return [];
  }, [post.relatedIncidents]);

  const handleVote = async (type: 'credible' | 'suspicious') => {
    if (!user) {
      toast.error('Please sign in to vote', {
        action: {
          label: 'Sign In',
          onClick: () => navigate('/auth'),
        },
      });
      return;
    }

    if (isVoting) return;
    setIsVoting(true);
    setVotePulse(type);
    window.setTimeout(() => setVotePulse((prev) => (prev === type ? null : prev)), 240);

    try {
      const result = await voteService.toggleVote(
        post.id,
        type,
      );
      setUserVote(result.newVote);
      setCredibleVotes(result.credibleVotes);
      setSuspiciousVotes(result.suspiciousVotes);
    } catch (error) {
      console.error('Error voting:', error);
      toast.error('Failed to register vote');
    } finally {
      setIsVoting(false);
    }
  };

  const handleEdit = async () => {
    if (!editContent.trim() || editContent === post.content) {
      setIsEditing(false);
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const { PostService } = await import('@/services/PostService');
      await PostService.getInstance().updatePost(post.id, { content: editContent });
      toast.success('Post updated successfully');
      setIsEditing(false);
      // We manually update the local state since we don't have a parent callback for updates
      post.content = editContent;
    } catch (error) {
      console.error('Error updating post:', error);
      toast.error('Failed to update post');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this post? This cannot be undone.')) {
      return;
    }

    try {
      const { PostService } = await import('@/services/PostService');
      await PostService.getInstance().deletePost(post.id);
      toast.success('Post deleted successfully');
      // Refresh the feed
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['myPosts'] });
      onPostDeleted?.();
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
    }
  };

  const EvidenceIcon = post.evidenceType ? evidenceIconMap[post.evidenceType] : null;
  const status = (post.status || 'submitted') as IncidentStatus;
  const credibilityBadge = post.credibilityBadge;
  const isLongContent = post.content.length > CONTENT_PREVIEW_LIMIT;
  const displayContent = isContentExpanded || !isLongContent
    ? post.content
    : `${post.content.slice(0, CONTENT_PREVIEW_LIMIT).trimEnd()}...`;
  const incidentTiming = formatIncidentTiming(post);

  return (
    <>
    <Card className="glass-card overflow-hidden animate-fade-in hover:border-border transition-colors">
      <CardContent className="p-0">
        {evidenceHref && (
          <div className="relative h-48 overflow-hidden">
            {post.evidenceType === 'photo' ? (
              <button type="button" onClick={() => setIsEvidenceViewerOpen(true)} className="block w-full h-full">
                <img
                  src={evidenceHref}
                  alt="Evidence"
                  className="w-full h-full object-cover cursor-zoom-in"
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
              <Button size="sm" variant="secondary" className="gap-1 h-8 cv-interactive" onClick={() => setIsEvidenceViewerOpen(true)}>
                <ExternalLink className="h-3.5 w-3.5" />
                View Evidence
              </Button>
            </div>
          </div>
        )}
        
        <div className="p-4 sm:p-5">
          {/* Header badges */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <IncidentStatusBadge status={status} size="sm" />
            <CategoryBadge category={post.category} size="sm" />
            <SeverityBadge severity={post.severity} size="sm" />

            {EvidenceIcon && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <EvidenceIcon className="h-3 w-3" />
                Evidence
              </span>
            )}
          </div>

          {/* Anonymous ID, credibility badge, and metadata */}
          <div className="flex items-center flex-wrap gap-3 text-xs text-muted-foreground mb-3">
            <span className="anonymous-id font-medium">{post.anonymousId}</span>
            {credibilityBadge && <CredibilityBadge badge={credibilityBadge} />}
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

          {post.imageUrl && !evidenceHref && (
            <div className="mb-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              {user
                ? 'Private evidence is attached, but the temporary access link is unavailable right now.'
                : 'Private evidence is attached to this report. Sign in to open it with a temporary access link.'}
            </div>
          )}

          {/* Content */}
          {isEditing ? (
            <div className="mb-3 space-y-2">
              <Textarea 
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="bg-muted/50 border-border min-h-[100px]"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setEditContent(post.content); }}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={handleEdit} disabled={isSubmittingEdit}>
                  <Check className="h-4 w-4 mr-1" /> {isSubmittingEdit ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-3">
              <p
                key={isContentExpanded ? 'expanded' : 'collapsed'}
                className="text-foreground/90 text-sm leading-relaxed cv-content-fade"
              >
                {displayContent}
              </p>
              {isLongContent && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 mt-1 text-primary"
                  onClick={() => setIsContentExpanded((prev) => !prev)}
                >
                  {isContentExpanded ? 'Show less' : 'Show more'}
                </Button>
              )}
            </div>
          )}

          {/* Legal disclaimer */}
          <div className="mb-3">
            <LegalDisclaimer variant="compact" />
          </div>

          {/* Related incidents */}
          {relatedIncidentCount > 0 && (
            <div className="mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRelated(!showRelated)}
                className="w-full justify-between text-primary hover:text-primary/90 hover:bg-primary/5"
              >
                <span className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  {relatedIncidentCount} related independent {relatedIncidentCount === 1 ? 'report' : 'reports'}
                </span>
                {showRelated ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              {showRelated && (
                <div className="mt-2">
                  <RelatedIncidents 
                    count={relatedIncidentCount}
                    incidents={relatedIncidents}
                  />
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleVote('credible')}
                disabled={isVoting}
                className={`px-2 sm:px-3 cv-interactive ${userVote === 'credible' ? 'credibility-positive' : 'text-muted-foreground hover:text-credible'} ${votePulse === 'credible' ? 'cv-tap-pop' : ''}`}
              >
                <ThumbsUp className="h-4 w-4" />
                <span className="text-xs ml-1 hidden sm:inline">Credible ({credibleVotes})</span>
                <span className="text-xs ml-1 sm:hidden">{credibleVotes}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleVote('suspicious')}
                disabled={isVoting}
                className={`px-2 sm:px-3 cv-interactive ${userVote === 'suspicious' ? 'credibility-negative' : 'text-muted-foreground hover:text-suspicious'} ${votePulse === 'suspicious' ? 'cv-tap-pop' : ''}`}
              >
                <ThumbsDown className="h-4 w-4" />
                <span className="text-xs ml-1 hidden sm:inline">Suspicious ({suspiciousVotes})</span>
                <span className="text-xs ml-1 sm:hidden">{suspiciousVotes}</span>
              </Button>
            </div>

            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                className={`px-2 sm:px-3 cv-interactive ${isCommentsOpen ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={handleCommentsClick}
              >
                <MessageCircle className="h-4 w-4" />
                <span className="text-xs ml-1">{post.commentCount}</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="px-2 sm:px-3 text-muted-foreground hover:text-foreground cv-interactive"
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
                    } catch (err) {
                      // User cancelled share — ignore
                    }
                  } else {
                    await navigator.clipboard.writeText(shareUrl);
                    toast.success('Link copied to clipboard');
                  }
                }}
              >
                <Share2 className="h-4 w-4" />
              </Button>
              
              {isOwner ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                   <Button variant="ghost" size="sm" className="px-2 sm:px-3 text-muted-foreground hover:text-foreground cv-interactive">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit Post
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleDelete}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Post
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <ReportPostButton
                  postId={post.id}
                  initialCount={post.reportCount}
                  className="px-2 sm:px-3 text-muted-foreground hover:text-destructive cv-interactive"
                />
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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
    </>
  );
}
