import { useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ReportPostDialog } from './ReportPostDialog';
import { ReportService } from '@/services/ReportService';

const reportService = ReportService.getInstance();

interface ReportPostButtonProps {
  postId: string;
  initialCount?: number;
  className?: string;
}

export function ReportPostButton({ postId, initialCount = 0, className }: ReportPostButtonProps) {
  const { user } = useAuth();
  const [reportCount, setReportCount] = useState(initialCount);
  const [hasReported, setHasReported] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadReportMeta = async () => {
      try {
        const meta = await reportService.getMeta(postId, user?.id);
        if (isMounted) {
          setReportCount(meta.count);
          setHasReported(meta.hasReported);
        }
      } catch {
        if (isMounted) {
          setHasReported(false);
        }
      }
    };

    loadReportMeta();
    return () => {
      isMounted = false;
    };
  }, [postId, user]);

  const triggerClass = `${className ?? ''} ${hasReported ? 'text-destructive' : ''}`.trim();

  return (
    <ReportPostDialog
      postId={postId}
      onReported={() => {
        setHasReported(true);
        setReportCount((prev) => prev + 1);
      }}
      trigger={
        <Button variant="ghost" size="sm" className={triggerClass}>
          <Flag className="h-4 w-4" />
          <span className="text-xs ml-1">{reportCount}</span>
        </Button>
      }
    />
  );
}
