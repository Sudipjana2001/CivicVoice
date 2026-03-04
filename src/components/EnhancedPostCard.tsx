import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Clock, 
  MapPin, 
  ThumbsUp, 
  ThumbsDown, 
  MessageCircle, 
  Share2, 
  Flag,
  FileText,
  Camera,
  Video,
  Users,
  Link2,
  ChevronDown,
  ChevronUp,
  LogIn,
  MoreVertical,
  Edit2,
  Trash2,
  X,
  Check
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CategoryBadge } from './CategoryBadge';
import { SeverityBadge } from './SeverityBadge';
import { EvidenceConfidenceScore } from './EvidenceConfidenceScore';
import { IncidentStatusBadge } from './IncidentStatusBadge';
import { VisibilityTags } from './VisibilityTags';
import { CredibilityBadge } from './CredibilityBadge';
import { LegalDisclaimer } from './LegalDisclaimer';
import { RelatedIncidents } from './RelatedIncidents';

import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { VoteService } from '@/services/VoteService';
import { getAnonymousSession } from '@/lib/anonymity';
import type { Post, EvidenceType } from '@/lib/anonymity';
import type { IncidentStatus, ConfidenceLevel, VisibilityTag, CredibilityBadgeInfo, RelatedIncident } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const voteService = VoteService.getInstance();

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
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const session = getAnonymousSession();
  // Check ownership via auth user_id OR anonymous session id
  const isOwner = (user?.id && post.userId && user.id === post.userId) || (session.id === post.anonymousId);

  // Fetch existing vote on mount
  useEffect(() => {
    if (!user) return; // Only check votes for logged-in users
    voteService.getUserVote(post.id, session.token).then(vote => {
      if (vote) setUserVote(vote);
    });
  }, [post.id, session.token, user]);

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

    try {
      const result = await voteService.toggleVote(
        post.id,
        session.token,
        type,
        userVote,
        credibleVotes,
        suspiciousVotes,
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
  const status = post.status || 'submitted';
  const confidenceScore = post.confidenceScore || 'medium';
  const visibilityTags = post.visibilityTags || [];
  const credibilityBadge = post.credibilityBadge || { level: 'new', reportsCount: 1, credibilityScore: 75 };

  return (
    <Card className="glass-card overflow-hidden animate-fade-in hover:border-border transition-colors">
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
        
        <div className="p-4 sm:p-5">
          {/* Header badges */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
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
            <CredibilityBadge badge={credibilityBadge} />
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
            <p className="text-foreground/90 text-sm leading-relaxed mb-3">
              {post.content}
            </p>
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
                className={`px-2 sm:px-3 ${userVote === 'credible' ? 'credibility-positive' : 'text-muted-foreground hover:text-credible'}`}
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
                className={`px-2 sm:px-3 ${userVote === 'suspicious' ? 'credibility-negative' : 'text-muted-foreground hover:text-suspicious'}`}
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
                className={`px-2 sm:px-3 ${isCommentsOpen ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={handleCommentsClick}
              >
                <MessageCircle className="h-4 w-4" />
                <span className="text-xs ml-1">{post.commentCount}</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="px-2 sm:px-3 text-muted-foreground hover:text-foreground"
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
                    <Button variant="ghost" size="sm" className="px-2 sm:px-3 text-muted-foreground hover:text-foreground">
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
                <Button variant="ghost" size="sm" className="px-2 sm:px-3 text-muted-foreground hover:text-destructive">
                  <Flag className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
