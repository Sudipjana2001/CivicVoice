import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  ChevronDown,
  ChevronUp,
  ListFilter,
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
  showHeader?: boolean;
  onClose?: () => void;
}

const avatarToneClasses = [
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200',
  'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-200',
];

export function CommentsSection({
  postId,
  initialCount = 0,
  isFullPage,
  onCountChange,
  showHeader = false,
  onClose,
}: CommentsSectionProps) {
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
  const [expandedThreadIds, setExpandedThreadIds] = useState<Record<string, boolean>>({});
  const [sortMode, setSortMode] = useState<'newest' | 'oldest'>('newest');
  const [isMainComposerExpanded, setIsMainComposerExpanded] = useState(false);
  const mainCommentTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setCommentCount(initialCount);
  }, [initialCount, postId]);

  useEffect(() => {
    setExpandedThreadIds({});
    setReplyingToCommentId(null);
    setReplyContent('');
    setEditingCommentId(null);
    setEditContent('');
    setNewComment('');
    setIsMainComposerExpanded(false);
  }, [postId]);

  useEffect(() => {
    onCountChange?.(commentCount);
  }, [commentCount, onCountChange]);

  const autoResizeTextarea = useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;

    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 44), 220)}px`;
  }, []);

  useEffect(() => {
    autoResizeTextarea(replyTextareaRef.current);
  }, [replyingToCommentId, replyContent, autoResizeTextarea]);

  useEffect(() => {
    autoResizeTextarea(mainCommentTextareaRef.current);
  }, [newComment, autoResizeTextarea]);

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

  const fetchInitialComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const page = await commentService.fetchByPostId(postId, {
        limit: COMMENTS_PAGE_SIZE,
      });

      setComments(page.comments);
      setHasMore(page.hasMore);
      setCommentCount(page.totalCount);
      syncPostCommentCount(page.totalCount);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  }, [postId, syncPostCommentCount]);

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
      setCommentCount(page.totalCount);
      syncPostCommentCount(page.totalCount);
    } catch (error) {
      console.error('Error loading more comments:', error);
      toast.error('Failed to load more comments');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const applyCommentCount = useCallback((updater: (current: number) => number) => {
    setCommentCount((current) => {
      const nextCount = Math.max(0, updater(current));
      syncPostCommentCount(nextCount);
      return nextCount;
    });
  }, [syncPostCommentCount]);

  const orderedComments = useMemo(() => {
    const nextComments = [...comments];
    nextComments.sort((left, right) => {
      const diff = new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      return sortMode === 'newest' ? diff : -diff;
    });
    return nextComments;
  }, [comments, sortMode]);

  const getAvatarFallback = (anonymousId: string) => {
    const normalized = anonymousId.replace(/^CVC-/, '').trim();
    return (normalized[0] ?? anonymousId[0] ?? 'C').toUpperCase();
  };

  const getAvatarTone = (anonymousId: string) => {
    const seed = anonymousId.split('').reduce((total, character) => total + character.charCodeAt(0), 0);
    return avatarToneClasses[seed % avatarToneClasses.length];
  };

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

  const getReplyCount = (comment: CommentRow) => comment.replies.length;

  const toggleThread = (commentId: string) => {
    setExpandedThreadIds((prev) => ({
      ...prev,
      [commentId]: !(prev[commentId] ?? false),
    }));
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
      setIsMainComposerExpanded(false);
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
    const wasTopLevelComment = comments.some((comment) => comment.id === commentId);
    try {
      await commentService.delete(commentId);
      const { nextComments } = removeCommentFromTree(comments, commentId);
      setComments(nextComments);
      if (wasTopLevelComment) {
        applyCommentCount((current) => current - 1);
      }
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
      setExpandedThreadIds((prev) => ({ ...prev, [parentComment.id]: true }));
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
    const replyCount = getReplyCount(comment);
    const isThreadExpanded = expandedThreadIds[comment.id] ?? false;
    const avatarSize = depth === 0 ? 'h-9 w-9 sm:h-10 sm:w-10' : 'h-8 w-8 sm:h-9 sm:w-9';
    const threadIndent = depth === 0 ? '' : 'ml-3 pl-3 border-l border-border/40 sm:ml-4 sm:pl-4';

    return (
      <div key={comment.id} className={threadIndent}>
        <div className="flex items-start gap-2.5 sm:gap-3">
          <Avatar className={`${avatarSize} shrink-0 ring-1 ring-border/40`}>
            <AvatarFallback className={`text-sm font-semibold ${getAvatarTone(comment.anonymous_id)}`}>
              {getAvatarFallback(comment.anonymous_id)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 pb-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-sm text-foreground truncate max-w-full">
                    {comment.anonymous_id}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </span>
                  {comment.edited_at && (
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      Edited
                    </span>
                  )}
                </div>
              </div>

              {isOwner && !isEditing && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-muted/70">
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
              <div className="mt-2 space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[92px] resize-none rounded-2xl border-border/60 bg-background text-sm"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      setEditingCommentId(null);
                      setEditContent('');
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" className="rounded-full" onClick={handleSaveEdit} disabled={!editContent.trim() || isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-1 text-sm leading-6 text-foreground whitespace-pre-wrap break-words sm:text-[15px] sm:leading-7">
                  {comment.content}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-1 text-sm">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReactionClick(comment, 'upvote')}
                    disabled={isReactionPending || isDeleting || (Boolean(user?.id) && comment.user_id === user.id)}
                    className={`h-8 rounded-full px-2 text-muted-foreground hover:bg-muted/60 sm:px-2.5 ${comment.viewer_reaction === 'upvote' ? 'text-foreground' : ''}`}
                  >
                    {isReactionPending && comment.viewer_reaction === 'upvote' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ThumbsUp className={`h-4 w-4 ${comment.viewer_reaction === 'upvote' ? 'fill-current' : ''}`} />
                    )}
                    <span className="ml-2 text-sm">{comment.upvote_count}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReactionClick(comment, 'downvote')}
                    disabled={isReactionPending || isDeleting || (Boolean(user?.id) && comment.user_id === user.id)}
                    className={`h-8 rounded-full px-2 text-muted-foreground hover:bg-muted/60 sm:px-2.5 ${comment.viewer_reaction === 'downvote' ? 'text-foreground' : ''}`}
                  >
                    {isReactionPending && comment.viewer_reaction === 'downvote' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ThumbsDown className={`h-4 w-4 ${comment.viewer_reaction === 'downvote' ? 'fill-current' : ''}`} />
                    )}
                    <span className="ml-2 text-sm">{comment.downvote_count}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full px-2.5 font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground sm:px-3"
                    onClick={() => {
                      setEditingCommentId(null);
                      setEditContent('');
                      setReplyingToCommentId((current) => current === comment.id ? null : comment.id);
                      setReplyContent('');
                      setExpandedThreadIds((prev) => ({ ...prev, [comment.id]: true }));
                    }}
                  >
                    Reply
                  </Button>

                  {isDeleting && (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Deleting...
                    </span>
                  )}
                </div>

                {isReplying && (
                  <div className="mt-4 flex items-start gap-2.5 sm:gap-3">
                    <Avatar className="mt-1 h-8 w-8 shrink-0 ring-1 ring-border/40 sm:h-9 sm:w-9">
                      <AvatarFallback className={`text-sm font-semibold ${getAvatarTone(user?.id ?? 'reply-user')}`}>
                        {user?.email?.[0]?.toUpperCase() ?? 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="border-b border-border/70 pb-2">
                        <p className="mb-2 text-xs text-muted-foreground sm:text-sm">
                          Replying to <span className="font-medium text-foreground">@{comment.anonymous_id}</span>
                        </p>
                        <Textarea
                          ref={replyTextareaRef}
                          value={replyContent}
                          onChange={(e) => {
                            setReplyContent(e.target.value);
                            autoResizeTextarea(e.currentTarget);
                          }}
                          placeholder={`Write a reply to ${comment.anonymous_id}...`}
                          rows={1}
                          autoFocus
                          className="min-h-[44px] max-h-[220px] resize-none overflow-y-auto rounded-none border-0 bg-transparent px-0 py-1 text-sm leading-6 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-[15px] sm:leading-7"
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap justify-end gap-2 sm:gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-full px-3 sm:px-4"
                          onClick={() => {
                            setReplyingToCommentId(null);
                            setReplyContent('');
                          }}
                        >
                          Cancel
                        </Button>
                        <Button size="sm" className="rounded-full px-4 sm:px-5" onClick={() => handleReplySubmit(comment)} disabled={!replyContent.trim() || isSubmittingReply}>
                          {isSubmittingReply ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                          Reply
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {comment.replies.length > 0 && (
                  <div className="mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-full px-2 font-semibold text-sm text-primary hover:bg-primary/10"
                      onClick={() => toggleThread(comment.id)}
                    >
                      {isThreadExpanded ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
                      {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                    </Button>

                    {isThreadExpanded && (
                      <div className="mt-3 space-y-5">
                        {comment.replies.map((reply) => renderComment(reply, depth + 1))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const showInitialSkeleton = isLoading && comments.length === 0;

  return (
    <div className={`flex flex-col bg-background ${isFullPage ? 'h-auto' : 'h-full'}`}>
      {showHeader && (
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="flex items-end gap-2">
            <h3 className="text-[1.65rem] font-bold leading-none text-foreground sm:text-[2rem]">Comments</h3>
            <span className="pb-0.5 text-base font-medium text-muted-foreground sm:text-lg">{commentCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => setSortMode((current) => current === 'newest' ? 'oldest' : 'newest')}
              title={sortMode === 'newest' ? 'Showing newest first' : 'Showing oldest first'}
            >
              <ListFilter className="h-5 w-5" />
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      )}

      <ScrollArea className={isFullPage ? 'h-auto' : 'flex-1 min-h-0'}>
        <div className="px-3 py-4 sm:px-5 sm:py-6">
          {showInitialSkeleton ? (
            <div className="space-y-6">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-full cv-shimmer" />
                  <div className="min-w-0 flex-1 space-y-2 pt-1">
                    <div className="h-3 w-40 rounded cv-shimmer" />
                    <div className="h-4 w-full rounded cv-shimmer" />
                    <div className="h-4 w-3/4 rounded cv-shimmer" />
                    <div className="h-8 w-36 rounded-full cv-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : orderedComments.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment.</p>
            </div>
          ) : (
            <div className="space-y-5 sm:space-y-6">
              {orderedComments.map((comment) => renderComment(comment))}
            </div>
          )}

          {hasMore && (
            <div className="pt-5 flex justify-center">
              <Button variant="outline" size="sm" className="rounded-full" onClick={handleLoadMore} disabled={isLoadingMore}>
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

      <div className="border-t border-border/50 bg-background/95 px-3 py-3 backdrop-blur sm:px-5">
        {user ? (
          <div className="flex items-start gap-2.5 sm:gap-3">
            <Avatar className="mt-1 h-9 w-9 shrink-0 ring-1 ring-border/40 sm:h-10 sm:w-10">
              <AvatarFallback className={`text-sm font-semibold ${getAvatarTone(user.id)}`}>
                {user.email?.[0]?.toUpperCase() ?? 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="border-b border-border/70 transition-colors focus-within:border-foreground/40">
                <Textarea
                  ref={mainCommentTextareaRef}
                  value={newComment}
                  onChange={(e) => {
                    setNewComment(e.target.value);
                    autoResizeTextarea(e.currentTarget);
                  }}
                  onFocus={() => setIsMainComposerExpanded(true)}
                  placeholder="Add a comment..."
                  rows={1}
                  className="min-h-[44px] max-h-[220px] resize-none overflow-y-auto rounded-none border-0 bg-transparent px-0 py-1 text-sm leading-6 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-[15px] sm:leading-7"
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />
              </div>
              {(isMainComposerExpanded || Boolean(newComment.trim())) && (
                <div className="mt-3 flex flex-wrap justify-end gap-2 sm:gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full px-3 sm:px-4"
                    onClick={() => {
                      setNewComment('');
                      setIsMainComposerExpanded(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={!newComment.trim() || isSubmitting}
                    className="rounded-full px-4 sm:px-5"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                    Comment
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-1 text-sm text-muted-foreground">
            <LogIn className="h-4 w-4" />
            <span>
              <button onClick={() => navigate('/auth')} className="font-medium text-primary hover:underline">
                Sign in
              </button>{' '}
              to add a comment
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
