import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flag } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ReportService, type ReportReason } from '@/services/ReportService';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const reportService = ReportService.getInstance();

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'abuse', label: 'Abusive content' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'privacy_violation', label: 'Privacy violation' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Other' },
];

interface ReportPostDialogProps {
  postId: string;
  triggerClassName?: string;
  onReported?: () => void;
  trigger?: ReactNode;
}

export function ReportPostDialog({ postId, triggerClassName, onReported, trigger }: ReportPostDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('misinformation');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please sign in to report posts', {
        action: { label: 'Sign In', onClick: () => navigate('/auth') },
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await reportService.submit({
        postId,
        reason,
        details,
      });
    } catch (error) {
      setIsSubmitting(false);
      const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : undefined;
      const message =
        typeof error === 'object' && error && 'message' in error
          ? String((error as { message?: string }).message)
          : 'Unknown error';

      if (code === '23505') {
        toast.error('You have already reported this post');
      } else {
        toast.error(`Failed to submit report: ${message}`);
      }
      return;
    }
    setIsSubmitting(false);

    toast.success('Report submitted. Thank you.');
    onReported?.();
    setOpen(false);
    setReason('misinformation');
    setDetails('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className={triggerClassName}>
            <Flag className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report Post</DialogTitle>
          <DialogDescription>
            Tell us what is wrong with this post. Reports are reviewed by moderators.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as ReportReason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Additional details (optional)</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add context for reviewers..."
              className="min-h-[96px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
