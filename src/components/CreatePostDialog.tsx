import { useState } from 'react';
import { 
  Plus, 
  Shield, 
  AlertTriangle,
  Image as ImageIcon,
  Video,
  MapPin,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CATEGORIES, SEVERITY_LEVELS, EVIDENCE_TYPES } from '@/lib/anonymity';
import type { Category, Severity, EvidenceType, Post } from '@/lib/anonymity';
import { toast } from 'sonner';

interface CreatePostDialogProps {
  onPostCreated: (post: Post) => void;
}

export function CreatePostDialog({ onPostCreated }: CreatePostDialogProps) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [evidenceType, setEvidenceType] = useState<EvidenceType | ''>('');
  const [location, setLocation] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const handleSubmit = () => {
    if (!content.trim()) {
      toast.error('Please provide a description of the incident');
      return;
    }

    const newPost: Post = {
      id: crypto.randomUUID(),
      anonymousId: 'Protected profile',
      content: content.trim(),
      category,
      severity,
      evidenceType: evidenceType || undefined,
      location: location.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      createdAt: new Date(),
      credibleVotes: 0,
      suspiciousVotes: 0,
      commentCount: 0,
    };

    onPostCreated(newPost);
    
    // Reset form
    setContent('');
    setCategory('other');
    setSeverity('medium');
    setEvidenceType('');
    setLocation('');
    setImageUrl('');
    setOpen(false);

    toast.success('Draft report submitted', {
      description: 'Public identity should be generated from your signed-in profile in the guided flow.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-lg hover:shadow-primary/25 transition-all">
          <Plus className="h-4 w-4" />
          Report Incident
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Shield className="h-5 w-5 shield-icon" />
            Submit Anonymous Report
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Public reports should use the pseudonymous ID attached to your signed-in profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <AlertTriangle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              This platform does not verify claims. Posts are allegations for public awareness, 
              not legal judgments. Misuse may result in content removal.
            </p>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Incident Description *</Label>
            <Textarea
              id="content"
              placeholder="Describe the incident in detail. Include relevant facts, dates, and circumstances..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px] bg-muted/50 border-border resize-none"
            />
          </div>

          {/* Category and Severity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger className="bg-muted/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Severity *</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
                <SelectTrigger className="bg-muted/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {SEVERITY_LEVELS.map((sev) => (
                    <SelectItem key={sev.id} value={sev.id}>
                      {sev.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Evidence Type */}
          <div className="space-y-2">
            <Label>Evidence Type (Optional)</Label>
            <Select value={evidenceType} onValueChange={(v) => setEvidenceType(v as EvidenceType)}>
              <SelectTrigger className="bg-muted/50 border-border">
                <SelectValue placeholder="Select if you have evidence" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {EVIDENCE_TYPES.map((ev) => (
                  <SelectItem key={ev.id} value={ev.id}>
                    {ev.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location" className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" />
              Location (Optional)
            </Label>
            <Input
              id="location"
              placeholder="e.g., Town name, village, street, lane, or landmark"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="bg-muted/50 border-border"
            />
            <p className="text-xs text-muted-foreground">
              Enter the exact public place if you know it, such as a town, village, ward, lane, or landmark.
            </p>
          </div>

          {/* Image URL */}
          <div className="space-y-2">
            <Label htmlFor="imageUrl" className="flex items-center gap-2">
              <ImageIcon className="h-3.5 w-3.5" />
              Image URL (Optional)
            </Label>
            <Input
              id="imageUrl"
              placeholder="https://..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="bg-muted/50 border-border"
            />
            <p className="text-xs text-muted-foreground">
              This legacy dialog is best for text-only drafts. Use the guided report flow for private evidence uploads.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Submit Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
