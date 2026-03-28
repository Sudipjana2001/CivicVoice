import { memo, useState } from 'react';
import { Heart, MessageCircle, Share2, Clock, Users, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CivicFeedItem } from '@/lib/civicSocial';

interface VoiceCardProps {
  item: CivicFeedItem;
  onSupport?: (id: string, supported: boolean) => void;
  onComment?: (id: string) => void;
  isSupported?: boolean;
}

export const VoiceCard = memo(function VoiceCard({
  item,
  onSupport,
  onComment,
  isSupported = false,
}: VoiceCardProps) {
  const [supported, setSupported] = useState(isSupported);
  const [supportCount, setSupportCount] = useState(item.supportCount);

  const handleSupport = () => {
    const newState = !supported;
    setSupported(newState);
    setSupportCount(prev => newState ? prev + 1 : Math.max(prev - 1, 0));
    onSupport?.(item.id, newState);
  };

  const typeConfig = {
    issue: { label: 'Civic Issue', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
    voice: { label: 'Voice', color: 'bg-primary/10 text-primary border-primary/20' },
    update: { label: 'Update', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  };

  const config = typeConfig[item.itemType] || typeConfig.voice;

  return (
    <Card className="border-border/50 hover:border-border/80 transition-all group">
      <CardContent className="p-4 sm:p-5 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn('text-xs', config.color)}>
              {config.label}
            </Badge>
            {item.communityId && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Users className="h-3 w-3" />
                Community
              </Badge>
            )}
            {item.linkedIssuePostId && item.itemType !== 'issue' && (
              <Badge variant="outline" className="text-xs gap-1">
                <Link2 className="h-3 w-3" />
                Linked
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(item.createdAt, { addSuffix: true })}
          </span>
        </div>

        {/* Title */}
        {item.title && (
          <h3 className="font-semibold text-sm leading-snug">{item.title}</h3>
        )}

        {/* Content */}
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap line-clamp-4">
          {item.content}
        </p>

        {/* Image */}
        {item.imageUrl && (
          <div className="rounded-lg overflow-hidden bg-muted">
            <img
              src={item.imageUrl}
              alt=""
              className="w-full max-h-64 object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSupport}
            className={cn(
              'gap-1.5 h-8 text-xs transition-colors',
              supported
                ? 'text-primary bg-primary/10 hover:bg-primary/20'
                : 'text-muted-foreground hover:text-primary'
            )}
          >
            <Heart
              className={cn('h-4 w-4', supported && 'fill-primary')}
            />
            {supportCount > 0 ? `${supportCount} Support${supportCount !== 1 ? 's' : ''}` : 'Support'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onComment?.(item.id)}
            className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            <MessageCircle className="h-4 w-4" />
            {item.commentCount > 0 ? item.commentCount : 'Comment'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground ml-auto"
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
