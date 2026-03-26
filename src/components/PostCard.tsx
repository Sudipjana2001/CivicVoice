import { useState } from 'react';
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
  Users
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CategoryBadge } from './CategoryBadge';
import { SeverityBadge } from './SeverityBadge';
import type { Post, EvidenceType } from '@/lib/anonymity';
import { formatDistanceToNow } from 'date-fns';

const evidenceIconMap: Record<EvidenceType, React.ElementType> = {
  photo: Camera,
  video: Video,
  document: FileText,
  witness: Users,
};

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const [credibleVotes, setCredibleVotes] = useState(post.credibleVotes);
  const [suspiciousVotes, setSuspiciousVotes] = useState(post.suspiciousVotes);
  const [userVote, setUserVote] = useState<'credible' | 'suspicious' | null>(null);

  const handleVote = (type: 'credible' | 'suspicious') => {
    if (userVote === type) {
      // Remove vote
      if (type === 'credible') {
        setCredibleVotes(prev => prev - 1);
      } else {
        setSuspiciousVotes(prev => prev - 1);
      }
      setUserVote(null);
    } else {
      // Add/change vote
      if (userVote === 'credible') {
        setCredibleVotes(prev => prev - 1);
      } else if (userVote === 'suspicious') {
        setSuspiciousVotes(prev => prev - 1);
      }
      
      if (type === 'credible') {
        setCredibleVotes(prev => prev + 1);
      } else {
        setSuspiciousVotes(prev => prev + 1);
      }
      setUserVote(type);
    }
  };

  const EvidenceIcon = post.evidenceType ? evidenceIconMap[post.evidenceType] : null;

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
          </div>
        )}
        
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-3">
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
          </div>

          {/* Anonymous ID and metadata */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
            <span className="anonymous-id font-medium">{post.anonymousId}</span>
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
          <p className="text-foreground/90 text-sm leading-relaxed mb-4">
            {post.content}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleVote('credible')}
                className={`px-2 sm:px-3 ${userVote === 'credible' ? 'credibility-positive' : 'text-muted-foreground hover:text-credible'}`}
              >
                <ThumbsUp className="h-4 w-4" />
                <span className="text-xs ml-1 hidden sm:inline">{credibleVotes}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleVote('suspicious')}
                className={`px-2 sm:px-3 ${userVote === 'suspicious' ? 'credibility-negative' : 'text-muted-foreground hover:text-suspicious'}`}
              >
                <ThumbsDown className="h-4 w-4" />
                <span className="text-xs ml-1 hidden sm:inline">{suspiciousVotes}</span>
              </Button>
            </div>

            <div className="flex items-center">
              <Button variant="ghost" size="sm" className="px-2 sm:px-3 text-muted-foreground hover:text-foreground">
                <MessageCircle className="h-4 w-4" />
                <span className="text-xs ml-1 hidden sm:inline">{post.commentCount}</span>
              </Button>
              <Button variant="ghost" size="sm" className="px-2 sm:px-3 text-muted-foreground hover:text-foreground">
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="px-2 sm:px-3 text-muted-foreground hover:text-destructive">
                <Flag className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
