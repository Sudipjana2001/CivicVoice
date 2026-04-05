import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import type { Post } from '@/lib/anonymity';
import { PostAssistantPanel } from '@/components/PostAssistantPanel';
import { toast } from 'sonner';

interface PostAssistantButtonProps {
  post: Post;
  className?: string;
}

export function PostAssistantButton({ post, className }: PostAssistantButtonProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    if (!user) {
      toast.error('Please sign in to use the India assistant.', {
        action: {
          label: 'Sign In',
          onClick: () => navigate('/auth'),
        },
      });
      return;
    }

    setOpen(true);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        className={className ?? 'px-2 sm:px-3 text-muted-foreground hover:text-foreground cv-interactive'}
      >
        <Bot className="h-4 w-4" />
        <span className="ml-1 hidden text-xs sm:inline">Assistant</span>
      </Button>
      {open && <PostAssistantPanel post={post} open={open} onOpenChange={setOpen} />}
    </>
  );
}
