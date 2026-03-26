import { Card, CardContent } from '@/components/ui/card';
import { CommentsSection } from './CommentsSection';

interface CommentsCardProps {
  postId: string;
  commentCount: number;
  onClose: () => void;
  height?: number;
  onCountChange?: (count: number) => void;
}

export function CommentsCard({ postId, commentCount, onClose, height, onCountChange }: CommentsCardProps) {
  return (
    <Card
      className="glass-card overflow-hidden"
      style={{ height: height ? `${height}px` : 'auto' }}
    >
      <CardContent className="p-0 h-full flex flex-col">
        <CommentsSection
          postId={postId}
          initialCount={commentCount}
          onCountChange={onCountChange}
          onClose={onClose}
          showHeader
        />
      </CardContent>
    </Card>
  );
}
