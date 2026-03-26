import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Send,
  Clock,
  LogIn,
  Reply,
  ThumbsDown,
  ThumbsUp,
  Loader2,
  MoreVertical,
  Edit2,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { CommentService } from '@/services/CommentService';
import type { CommentReaction, CommentRow } from '@/services/CommentService';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const commentService = CommentService.getInstance();
const COMMENTS_PAGE_SIZE = 20;

interface CommentsSectionProps {
  postId: string;
  initialCount?: number;
  isFullPage?: boolean;
  onCountChange?: (count: number) => void;
}

export function CommentsSection({ postId, initialCount = 0, isFullPage, onCountChange }: CommentsSectionProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentCount, setCommentCount] = useState(initialCount);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submittingReplyToCommentId, setSubmittingReplyToCommentId] = useState<string | null>(null);
  const [pendingReactionIds, setPendingReactionIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCommentCount(initialCount);
  }, [initialCount, postId]);

  useEffect(() => {
    onCountChange?.(commentCount);
  }, [commentCount, onCountChange]);

  const fetchInitialComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const page = await commentService.fetchByPostId(postId, {
        limit: COMMENTS_PAGE_SIZE,
      });

      setComments(page.comments);
      setHasMore(page.hasMore);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchInitialComments();
  }, [fetchInitialComments]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || comments.length === 0) return;

    const lastComment = comments[comments.length - 1];
    setIsLoadingMore(true);
    try {
      const page = await commentService.fetchByPostId(postId, {
        limit: COMMENTS_PAGE_SIZE,
        beforeCreatedAt: lastComment.created_at,
        beforeId: lastComment.id,
      });

      setComments((prev) => [...prev, ...page.comments]);
      setHasMore(page.hasMore);
    } catch (error) {
      console.error('Error loading more comments:', error);
      toast.error('Failed to load more comments');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const syncPostCommentCount = useCallback((nextCount: number) => {
    queryClient.setQueryData(['post', postId], (current: Record<string, unknown> | null | undefined) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        commentCount: nextCount,
      };
    });

    queryClient.setQueryData(['posts'], (current: { pages?: Array<{ posts?: Array<Record<string, unknown>> }> } | undefined) => {
      if (!current?.pages) {
        return current;
      }

      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          posts: (page.posts ?? []).map((post) =>
            post.id === postId
              ? {
                  ...post,
                  commentCount: nextCount,
                }
              : post
          ),
        })),
      };
    });
  }, [postId, queryClient]);

  const applyCommentCount = useCallback((updater: (current: number) => number) => {
    setCommentCount((current) => {
      const nextCount = Math.max(0, updater(current));
      syncPostCommentCount(nextCount);
      return nextCount;
    });
  }, [syncPostCommentCount]);

  const countCommentTree = (comment: CommentRow): number => (
    1 + comment.replies.reduce((total, reply) => total + countCommentTree(reply), 0)
  );

  const updateCommentInTree = (items: CommentRow[], commentId: string, updater: (comment: CommentRow) => CommentRow): CommentRow[] => (
    items.map((comment) => {
      if (comment.id === commentId) {
        return updater(comment);
      }

      if (comment.replies.length === 0) {
        return comment;
      }

      return {
        ...comment,
        replies: updateCommentInTree(comment.replies, commentId, updater),
      };
    })
  );

  const removeCommentFromTree = (items: CommentRow[], commentId: string): { nextComments: CommentRow[]; removedCount: number } => {
    let removedCount = 0;
    const nextComments: CommentRow[] = [];

    items.forEach((comment) => {
      if (comment.id === commentId) {
        removedCount += countCommentTree(comment);
        return;
      }

      if (comment.replies.length === 0) {
        nextComments.push(comment);
        return;
      }

      const nextReplyState = removeCommentFromTree(comment.replies, commentId);
      removedCount += nextReplyState.removedCount;

      if (nextReplyState.removedCount > 0) {
        nextComments.push({
          ...comment,
          replies: nextReplyState.nextComments,
        });
      } else {
        nextComments.push(comment);
      }
    });

    return { nextComments, removedCount };
  };

  const insertReplyInTree = (items: CommentRow[], parentCommentId: string, reply: CommentRow): CommentRow[] => (
    items.map((comment) => {
      if (comment.id === parentCommentId) {
        return {
          ...comment,
          replies: [...comment.replies, reply],
        };
      }

      if (comment.replies.length === 0) {
        return comment;
      }

      return {
        ...comment,
        replies: insertReplyInTree(comment.replies, parentCommentId, reply),
      };
    })
  );

  const getNextReaction = (currentReaction: CommentReaction, targetReaction: Exclude<CommentReaction, null>): CommentReaction => (
    currentReaction === targetReaction ? null : targetReaction
  );

  const getOptimisticReactionCounts = (comment: CommentRow, nextReaction: CommentReaction) => {
    let upvoteCount = comment.upvote_count;
    let downvoteCount = comment.downvote_count;

    if (comment.viewer_reaction === 'upvote') {
      upvoteCount = Math.max(0, upvoteCount - 1);
    } else if (comment.viewer_reaction === 'downvote') {
      downvoteCount = Math.max(0, downvoteCount - 1);
    }

    if (nextReaction === 'upvote') {
      upvoteCount += 1;
    } else if (nextReaction === 'downvote') {
      downvoteCount += 1;
    }

    return { upvoteCount, downvoteCount };
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please sign in to comment', {
        action: {
          label: 'Sign In',
          onClick: () => navigate('/auth'),
        },
      });
      return;
    }

    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const data = await commentService.create(postId, newComment);
      setComments((prev) => [data, ...prev]);
      applyCommentCount((current) => current + 1);
      setNewComment('');
      toast.success('Comment posted under your public pseudonym');
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast.error('Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (comment: CommentRow) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
    setReplyingToCommentId(null);
    setReplyContent('');
  };

  const handleSaveEdit = async () => {
    if (!editingCommentId || !editContent.trim()) return;

    setSavingCommentId(editingCommentId);
    try {
      const updated = await commentService.update(editingCommentId, editContent);
      setComments((prev) => updateCommentInTree(prev, editingCommentId, (comment) => ({
        ...comment,
        content: updated.content,
        updated_at: updated.updated_at,
        edited_at: updated.edited_at,
      })));
      setEditingCommentId(null);
      setEditContent('');
      toast.success('Comment updated');
    } catch (error) {
      console.error('Error updating comment:', error);
      toast.error('Failed to update comment');
    } finally {
      setSavingCommentId(null);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!window.confirm('Delete this comment? This cannot be undone.')) {
      return;
    }

    setDeletingCommentId(commentId);
    try {
      await commentService.delete(commentId);
      setComments((prev) => {
        const { nextComments, removedCount } = removeCommentFromTree(prev, commentId);
        applyCommentCount((current) => current - removedCount);
        return nextComments;
      });
      toast.success('Comment deleted');
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    } finally {
      setDeletingCommentId(null);
    }
  };

  const handleReplySubmit = async (parentComment: CommentRow) => {
    if (!user) {
      toast.error('Please sign in to reply', {
        action: {
          label: 'Sign In',
          onClick: () => navigate('/auth'),
        },
      });
      return;
    }

    if (!replyContent.trim()) return;

    setSubmittingReplyToCommentId(parentComment.id);
    try {
      const reply = await commentService.create(postId, replyContent, parentComment.id);
      setComments((prev) => insertReplyInTree(prev, parentComment.id, reply));
      applyCommentCount((current) => current + 1);
      setReplyingToCommentId(null);
      setReplyContent('');
      toast.success('Reply posted under your public pseudonym');
    } catch (error) {
      console.error('Error submitting reply:', error);
      toast.error('Failed to post reply');
    } finally {
      setSubmittingReplyToCommentId(null);
    }
  };

  const handleReactionClick = async (comment: CommentRow, targetReaction: Exclude<CommentReaction, null>) => {
    if (!user) {
      toast.error('Please sign in to react to comments', {
        action: {
          label: 'Sign In',
          onClick: () => navigate('/auth'),
        },
      });
      return;
    }

    if (comment.user_id && comment.user_id === user.id) {
      toast.error('You cannot react to your own comment');
      return;
    }

    if (pendingReactionIds[comment.id]) return;

    const nextReaction = getNextReaction(comment.viewer_reaction, targetReaction);
    const optimisticCounts = getOptimisticReactionCounts(comment, nextReaction);
    const previousState = {
      viewer_reaction: comment.viewer_reaction,
      upvote_count: comment.upvote_count,
      downvote_count: comment.downvote_count,
    };

    setPendingReactionIds((prev) => ({ ...prev, [comment.id]: true }));
    setComments((prev) => updateCommentInTree(prev, comment.id, (item) => ({
      ...item,
      viewer_reaction: nextReaction,
      upvote_count: optimisticCounts.upvoteCount,
      downvote_count: optimisticCounts.downvoteCount,
    })));

    try {
      const result = await commentService.setReactionState(comment.id, nextReaction);
      setComments((prev) => updateCommentInTree(prev, comment.id, (item) => ({
        ...item,
        viewer_reaction: result.reaction,
        upvote_count: result.upvoteCount,
        downvote_count: result.downvoteCount,
      })));
    } catch (error) {
      console.error('Error updating comment reaction:', error);
      setComments((prev) => updateCommentInTree(prev, comment.id, (item) => ({
        ...item,
        viewer_reaction: previousState.viewer_reaction,
        upvote_count: previousState.upvote_count,
        downvote_count: previousState.downvote_count,
      })));
      toast.error('Failed to update reaction');
    } finally {
      setPendingReactionIds((prev) => {
        const next = { ...prev };
        delete next[comment.id];
        return next;
      });
    }
  };

  const renderComment = (comment: CommentRow, depth = 0) => {
    const isOwner = Boolean(user?.id && comment.user_id && user.id === comment.user_id);
    const isEditing = editingCommentId === comment.id;
    const isReactionPending = Boolean(pendingReactionIds[comment.id]);
    const isSaving = savingCommentId === comment.id;
    const isDeleting = deletingCommentId === comment.id;
    const isReplying = replyingToCommentId === comment.id;
    const isSubmittingReply = submittingReplyToCommentId === comment.id;

    return (
      <div key={comment.id} className={`rounded-lg border border-border/50 bg-muted/30 p-3 ${depth === 0 ? 'cv-stagger-enter' : ''}`}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs font-medium anonymous-id">{comment.anonymous_id}</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
            {comment.edited_at && (
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground/80">
                Edited
              </span>
            )}
          </div>

          {isOwner && !isEditing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleStartEdit(comment)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit comment
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(comment.id)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete comment
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[80px] resize-none bg-background/60 border-border text-sm"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingCommentId(null);
                  setEditContent('');
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={!editContent.trim() || isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{comment.content}</p>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReactionClick(comment, 'upvote')}
                  disabled={isReactionPending || isDeleting || (Boolean(user?.id) && comment.user_id === user.id)}
                  className={`px-2 h-8 cv-interactive ${comment.viewer_reaction === 'upvote' ? 'text-credible bg-credible/10 hover:bg-credible/15' : 'text-muted-foreground hover:text-credible'}`}
                >
                  {isReactionPending && comment.viewer_reaction === 'upvote' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ThumbsUp className={`h-4 w-4 ${comment.viewer_reaction === 'upvote' ? 'fill-current' : ''}`} />
                  )}
                  <span className="text-xs ml-1">{comment.upvote_count}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReactionClick(comment, 'downvote')}
                  disabled={isReactionPending || isDeleting || (Boolean(user?.id) && comment.user_id === user.id)}
                  className={`px-2 h-8 cv-interactive ${comment.viewer_reaction === 'downvote' ? 'text-suspicious bg-suspicious/10 hover:bg-suspicious/15' : 'text-muted-foreground hover:text-suspicious'}`}
                >
                  {isReactionPending && comment.viewer_reaction === 'downvote' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ThumbsDown className={`h-4 w-4 ${comment.viewer_reaction === 'downvote' ? 'fill-current' : ''}`} />
                  )}
                  <span className="text-xs ml-1">{comment.downvote_count}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2 h-8 text-muted-foreground hover:text-foreground cv-interactive"
                  onClick={() => {
                    setEditingCommentId(null);
                    setEditContent('');
                    setReplyingToCommentId((current) => current === comment.id ? null : comment.id);
                    setReplyContent('');
                  }}
                >
                  <Reply className="h-4 w-4" />
                  <span className="text-xs ml-1">Reply</span>
                </Button>
              </div>

              {isDeleting && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Deleting...
                </span>
              )}
            </div>

            {isReplying && (
              <div className="mt-3 rounded-lg border border-border/50 bg-background/40 p-3 space-y-2">
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Reply to this comment..."
                  className="min-h-[72px] resize-none bg-background/70 border-border text-sm"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setReplyingToCommentId(null);
                      setReplyContent('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => handleReplySubmit(comment)} disabled={!replyContent.trim() || isSubmittingReply}>
                    {isSubmittingReply ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                    Reply
                  </Button>
                </div>
              </div>
            )}

            {comment.replies.length > 0 && (
              <div className="mt-3 pl-4 border-l border-border/60 space-y-2">
                {comment.replies.map((reply) => renderComment(reply, depth + 1))}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col ${isFullPage ? 'h-auto' : 'h-full'}`}>
      <div className="p-3 border-b border-border/50">
        {user ? (
          <div className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add an anonymous comment..."
              className="min-h-[60px] resize-none bg-muted/50 border-border text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <Button
              size="icon"
              onClick={handleSubmit}
              disabled={!newComment.trim() || isSubmitting}
              className="flex-shrink-0 cv-interactive"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
            <LogIn className="h-4 w-4" />
            <span>
              <button
                onClick={() => navigate('/auth')}
                className="text-primary hover:underline font-medium"
              >
                Sign in
              </button>{' '}
              to post a comment
            </span>
          </div>
        )}
      </div>

      <ScrollArea className={isFullPage ? 'h-auto' : 'flex-1'}>
        <div className="p-3 space-y-3">
          {isLoading ? (
            <div className="space-y-3 py-2">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2 cv-stagger-enter" style={{ animationDelay: `${idx * 50}ms` }}>
                  <div className="h-3 w-32 rounded cv-shimmer" />
                  <div className="h-3 w-full rounded cv-shimmer" />
                  <div className="h-3 w-3/4 rounded cv-shimmer" />
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              No comments yet. Be the first to comment!
            </p>
          ) : (
            comments.map((comment, idx) => (
              <div key={comment.id} className="cv-stagger-enter" style={{ animationDelay: `${Math.min(idx * 35, 350)}ms` }}>
                {renderComment(comment)}
              </div>
            ))
          )}

          {hasMore && (
            <div className="pt-2 flex justify-center">
              <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={isLoadingMore}>
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load more comments'
                )}
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
