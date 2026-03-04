import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Clock, LogIn } from 'lucide-react';
import { CommentService } from '@/services/CommentService';
import type { CommentRow } from '@/services/CommentService';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const commentService = CommentService.getInstance();

interface CommentsSectionProps {
  postId: string;
  initialCount?: number;
  isFullPage?: boolean;
}

export function CommentsSection({ postId, initialCount, isFullPage }: CommentsSectionProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await commentService.fetchByPostId(postId);
      setComments(data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
    setIsLoading(false);
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

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
      setComments(prev => [data, ...prev]);
      setNewComment('');
      toast.success('Comment posted anonymously');
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast.error('Failed to post comment');
    }
    setIsSubmitting(false);
  };

  return (
    <div className={`flex flex-col ${isFullPage ? 'h-auto' : 'h-full'}`}>
      {/* Comment input */}
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
              <Send className="h-4 w-4" />
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

      {/* Comments list */}
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
              <div key={comment.id} className="p-3 rounded-lg bg-muted/30 border border-border/50 cv-stagger-enter" style={{ animationDelay: `${Math.min(idx * 35, 350)}ms` }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium anonymous-id">{comment.anonymous_id}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-foreground/90">{comment.content}</p>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
