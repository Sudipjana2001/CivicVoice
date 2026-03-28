import { memo } from 'react';
import { Check, CheckCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { ConversationMessage } from '@/lib/civicSocial';

interface ChatBubbleProps {
  message: ConversationMessage;
  isOwn: boolean;
}

const statusIcons = {
  sent: Clock,
  delivered: Check,
  seen: CheckCheck,
};

export const ChatBubble = memo(function ChatBubble({ message, isOwn }: ChatBubbleProps) {
  const StatusIcon = statusIcons[message.status] || Clock;

  return (
    <div className={cn('flex mb-2', isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2.5 relative',
          isOwn
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted text-foreground rounded-bl-md'
        )}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.body}
        </p>
        <div
          className={cn(
            'flex items-center gap-1 mt-1',
            isOwn ? 'justify-end' : 'justify-start'
          )}
        >
          <span
            className={cn(
              'text-[10px]',
              isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'
            )}
          >
            {formatDistanceToNow(message.createdAt, { addSuffix: true })}
          </span>
          {isOwn && (
            <StatusIcon
              className={cn(
                'h-3 w-3',
                message.status === 'seen'
                  ? 'text-blue-300'
                  : isOwn
                    ? 'text-primary-foreground/50'
                    : 'text-muted-foreground'
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
});
