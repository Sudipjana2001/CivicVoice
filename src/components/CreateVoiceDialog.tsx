import { useState } from 'react';
import { PenLine, Megaphone, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { CivicFeedService } from '@/services/CivicFeedService';
import { VOICE_KIND_OPTIONS, COMMUNITY_VISIBILITY_OPTIONS } from '@/lib/civicSocial';
import type { VoiceKind, VoiceVisibility } from '@/lib/civicSocial';

const feedService = CivicFeedService.getInstance();

interface CreateVoiceDialogProps {
  communityId?: string;
  onCreated?: () => void;
}

export function CreateVoiceDialog({ communityId, onCreated }: CreateVoiceDialogProps) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<VoiceKind>('voice');
  const [visibility, setVisibility] = useState<VoiceVisibility>(communityId ? 'community' : 'public');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error('Please write something before posting');
      return;
    }

    setIsSubmitting(true);
    try {
      await feedService.createVoice({
        kind,
        visibility,
        title: title.trim() || undefined,
        content: content.trim(),
        communityId,
      });
      toast.success(`${kind === 'voice' ? 'Voice' : 'Update'} published!`);
      setOpen(false);
      setTitle('');
      setContent('');
      setKind('voice');
      setVisibility(communityId ? 'community' : 'public');
      onCreated?.();
    } catch (error) {
      toast.error('Failed to publish. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" size="sm">
          <Megaphone className="h-4 w-4" />
          Raise Your Voice
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-primary" />
            Create {kind === 'voice' ? 'Voice' : 'Update'}
          </DialogTitle>
          <DialogDescription>
            Share your perspective on civic matters with the community.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block">Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as VoiceKind)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_KIND_OPTIONS.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Visibility</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as VoiceVisibility)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="connections">Connections Only</SelectItem>
                  {communityId && <SelectItem value="community">Community Only</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Title (optional)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your voice a title..."
              className="h-9"
              maxLength={200}
            />
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What civic matter do you want to voice about?"
              className="min-h-[120px] resize-none"
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground text-right mt-1">
              {content.length}/2000
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !content.trim()}
            className="w-full gap-2"
          >
            {isSubmitting && <RefreshCw className="h-4 w-4 animate-spin" />}
            Publish {kind === 'voice' ? 'Voice' : 'Update'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
