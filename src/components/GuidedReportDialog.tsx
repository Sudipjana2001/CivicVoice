import { useState } from 'react';
import { 
  Shield, 
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Calendar,
  FileText,
  Camera,
  Video,
  Users,
  Check
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { CATEGORIES, SEVERITY_LEVELS, EVIDENCE_TYPES, getAnonymousSession } from '@/lib/anonymity';
import type { Category, Severity, EvidenceType } from '@/lib/anonymity';
import type { SelfDestructOption } from '@/lib/types';
import { AnonymityHealthIndicator } from './AnonymityHealthIndicator';
import { SelfDestructOptions } from './SelfDestructOptions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface GuidedReportDialogProps {
  onPostCreated: () => void;
}

type Step = 'what' | 'when' | 'where' | 'evidence' | 'review';

const STEPS: { id: Step; label: string; icon: React.ElementType }[] = [
  { id: 'what', label: 'What Happened', icon: FileText },
  { id: 'when', label: 'When', icon: Calendar },
  { id: 'where', label: 'Where', icon: MapPin },
  { id: 'evidence', label: 'Evidence', icon: Camera },
  { id: 'review', label: 'Review', icon: Check },
];

export function GuidedReportDialog({ onPostCreated }: GuidedReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>('what');
  
  // Form state
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [incidentDate, setIncidentDate] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [location, setLocation] = useState('');
  const [evidenceType, setEvidenceType] = useState<EvidenceType | ''>('');
  const [imageUrl, setImageUrl] = useState('');
  const [selfDestruct, setSelfDestruct] = useState<SelfDestructOption>(null);
  const [deleteMediaOnly, setDeleteMediaOnly] = useState(false);

  const session = getAnonymousSession();
  const { user } = useAuth();

  const stepIndex = STEPS.findIndex(s => s.id === currentStep);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 'what':
        return content.trim().length >= 20 && category;
      case 'when':
        return true; // Optional
      case 'where':
        return true; // Optional
      case 'evidence':
        return true; // Optional
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    const idx = STEPS.findIndex(s => s.id === currentStep);
    if (idx < STEPS.length - 1) {
      setCurrentStep(STEPS[idx + 1].id);
    }
  };

  const prevStep = () => {
    const idx = STEPS.findIndex(s => s.id === currentStep);
    if (idx > 0) {
      setCurrentStep(STEPS[idx - 1].id);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error('Please provide a description of the incident');
      return;
    }

    setIsSubmitting(true);

    // Calculate self_destruct_at if set
    let selfDestructAt: string | null = null;
    if (selfDestruct) {
      const date = new Date();
      date.setDate(date.getDate() + selfDestruct);
      selfDestructAt = date.toISOString();
    }

    const { error } = await supabase
      .from('posts')
      .insert({
        anonymous_id: session.id,
        user_id: user?.id || null,
        content: content.trim(),
        category,
        severity,
        evidence_type: evidenceType || null,
        location: location.trim() || null,
        image_url: imageUrl.trim() || null,
        self_destruct_at: selfDestructAt,
      });

    setIsSubmitting(false);

    if (error) {
      console.error('Error creating post:', error);
      toast.error('Failed to submit report. Please try again.');
      return;
    }

    onPostCreated();
    resetForm();
    setOpen(false);

    toast.success('Report submitted anonymously', {
      description: 'Your identity remains protected.',
    });
  };

  const resetForm = () => {
    setContent('');
    setCategory('other');
    setSeverity('medium');
    setIncidentDate('');
    setIncidentTime('');
    setLocation('');
    setEvidenceType('');
    setImageUrl('');
    setSelfDestruct(null);
    setDeleteMediaOnly(false);
    setCurrentStep('what');
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'what':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>What happened? *</Label>
              <Textarea
                placeholder="Describe the incident in detail. Include relevant facts, circumstances, and observations. Be specific but factual..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[120px] bg-muted/50 border-border resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {content.length < 20 
                  ? `Minimum 20 characters required (${20 - content.length} more)`
                  : '✓ Description meets minimum length'
                }
              </p>
            </div>

            <div className="space-y-2">
              <Label>Category *</Label>
              <RadioGroup
                value={category}
                onValueChange={(v) => setCategory(v as Category)}
                className="grid grid-cols-2 gap-2"
              >
                {CATEGORIES.map((cat) => (
                  <div key={cat.id} className="flex items-center space-x-2">
                    <RadioGroupItem value={cat.id} id={`cat-${cat.id}`} />
                    <Label htmlFor={`cat-${cat.id}`} className="font-normal cursor-pointer text-sm">
                      {cat.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Severity *</Label>
              <RadioGroup
                value={severity}
                onValueChange={(v) => setSeverity(v as Severity)}
                className="flex flex-wrap gap-3"
              >
                {SEVERITY_LEVELS.map((sev) => (
                  <div key={sev.id} className="flex items-center space-x-2">
                    <RadioGroupItem value={sev.id} id={`sev-${sev.id}`} />
                    <Label htmlFor={`sev-${sev.id}`} className="font-normal cursor-pointer text-sm">
                      {sev.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
        );

      case 'when':
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                When did this incident occur? Providing a date and time helps establish a timeline and find related reports.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date (Optional)</Label>
                <Input
                  id="date"
                  type="date"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  className="bg-muted/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Approximate Time (Optional)</Label>
                <Input
                  id="time"
                  type="time"
                  value={incidentTime}
                  onChange={(e) => setIncidentTime(e.target.value)}
                  className="bg-muted/50 border-border"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              If unsure, you can skip this step. The submission time will be recorded automatically.
            </p>
          </div>
        );

      case 'where':
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <MapPin className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Where did this incident occur? Use city or district level only.
                </p>
                <p className="text-xs text-muted-foreground mt-1 italic">
                  ⚠️ Do not provide exact addresses to protect your privacy.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location (Optional - City/District level only)</Label>
              <Input
                id="location"
                placeholder="e.g., Downtown District, Metro Area, North Zone"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="bg-muted/50 border-border"
              />
            </div>
          </div>
        );

      case 'evidence':
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <Camera className="h-5 w-5 text-primary flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Do you have evidence to support this report? Evidence increases credibility but is not required.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Evidence Type (Optional)</Label>
              <RadioGroup
                value={evidenceType}
                onValueChange={(v) => setEvidenceType(v as EvidenceType)}
                className="space-y-2"
              >
                {EVIDENCE_TYPES.map((ev) => {
                  const icons: Record<string, React.ElementType> = {
                    photo: Camera,
                    video: Video,
                    document: FileText,
                    witness: Users,
                  };
                  const Icon = icons[ev.id];
                  return (
                    <div key={ev.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={ev.id} id={`ev-${ev.id}`} />
                      <Label htmlFor={`ev-${ev.id}`} className="font-normal cursor-pointer text-sm flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {ev.label}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>

            {(evidenceType === 'photo' || evidenceType === 'video' || evidenceType === 'document') && (
              <div className="space-y-3">
                <Label>Upload Evidence (Optional)</Label>
                
                {/* File upload */}
                <div className="space-y-2">
                  <input
                    type="file"
                    id="evidence-file"
                    className="hidden"
                    accept={
                      evidenceType === 'photo' ? 'image/*' :
                      evidenceType === 'video' ? 'video/*' :
                      '.pdf,.doc,.docx,.txt'
                    }
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      // Size check (10MB max)
                      if (file.size > 10 * 1024 * 1024) {
                        toast.error('File too large. Maximum size is 10MB.');
                        return;
                      }

                      try {
                        let uploadFile: File | Blob = file;

                        // Strip EXIF from images before upload
                        if (file.type.startsWith('image/')) {
                          const { stripImageMetadata } = await import('@/lib/crypto');
                          uploadFile = await stripImageMetadata(file);
                        }

                        const fileName = `${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
                        const { data, error } = await supabase.storage
                          .from('evidence')
                          .upload(fileName, uploadFile, {
                            cacheControl: '3600',
                            upsert: false,
                          });

                        if (error) {
                          // If bucket doesn't exist, fall back to URL input
                          toast.error('Upload failed. You can paste a URL instead.');
                          console.error('Upload error:', error);
                          return;
                        }

                        const { data: urlData } = supabase.storage
                          .from('evidence')
                          .getPublicUrl(data.path);

                        setImageUrl(urlData.publicUrl);
                        toast.success('File uploaded successfully');
                      } catch (err) {
                        console.error('Upload error:', err);
                        toast.error('Upload failed. You can paste a URL instead.');
                      }
                    }}
                  />
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => document.getElementById('evidence-file')?.click()}
                  >
                    <Camera className="h-4 w-4" />
                    Choose File
                  </Button>

                  {imageUrl && (
                    <div className="rounded-lg border border-border/50 p-2 bg-muted/30">
                      {evidenceType === 'photo' ? (
                        <img src={imageUrl} alt="Uploaded evidence" className="w-full h-32 object-cover rounded" />
                      ) : (
                        <p className="text-xs text-muted-foreground truncate">📎 {imageUrl}</p>
                      )}
                    </div>
                  )}

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/50" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-background px-2 text-muted-foreground">or paste URL</span>
                    </div>
                  </div>

                  <Input
                    placeholder="https://..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="bg-muted/50 border-border"
                  />
                </div>
                
                <p className="text-xs text-muted-foreground">
                  ⚠️ Image metadata (EXIF, GPS) is automatically stripped before publishing. Max 10MB.
                </p>
              </div>
            )}

            <div className="pt-2">
              <SelfDestructOptions
                value={selfDestruct}
                onChange={setSelfDestruct}
                deleteMediaOnly={deleteMediaOnly}
                onDeleteMediaOnlyChange={setDeleteMediaOnly}
              />
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <AlertTriangle className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Before you submit</p>
                <p className="text-xs text-muted-foreground">
                  This platform does not verify claims. Posts are allegations for public awareness, 
                  not legal judgments. Misuse may result in content removal.
                </p>
              </div>
            </div>

            <div className="glass-card p-4 space-y-3">
              <h4 className="font-medium text-sm">Your Report Summary</h4>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category:</span>
                  <span className="font-medium">{CATEGORIES.find(c => c.id === category)?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Severity:</span>
                  <span className="font-medium">{SEVERITY_LEVELS.find(s => s.id === severity)?.label}</span>
                </div>
                {location && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-medium">{location}</span>
                  </div>
                )}
                {evidenceType && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Evidence:</span>
                    <span className="font-medium">{EVIDENCE_TYPES.find(e => e.id === evidenceType)?.label}</span>
                  </div>
                )}
                {selfDestruct && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Auto-delete:</span>
                    <span className="font-medium">{selfDestruct} days</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">Description:</p>
                <p className="text-sm">{content}</p>
              </div>
            </div>

            <AnonymityHealthIndicator variant="full" />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-lg hover:shadow-primary/25 transition-all">
          <Shield className="h-4 w-4" />
          Report Incident
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Shield className="h-5 w-5 shield-icon" />
            Guided Report Submission
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Reporting as <span className="anonymous-id">{session.id}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Step {stepIndex + 1} of {STEPS.length}</span>
            <span>{STEPS[stepIndex].label}</span>
          </div>
          <Progress value={progress} className="h-1" />
          <div className="flex justify-between">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === stepIndex;
              const isComplete = idx < stepIndex;
              return (
                <div 
                  key={step.id}
                  className={`flex flex-col items-center gap-1 ${
                    isActive ? 'text-primary' : isComplete ? 'text-credible' : 'text-muted-foreground'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                    isActive ? 'border-primary bg-primary/10' : 
                    isComplete ? 'border-credible bg-credible/10' : 
                    'border-border'
                  }`}>
                    {isComplete ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="py-4">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-2 border-t border-border">
          <Button
            variant="ghost"
            onClick={prevStep}
            disabled={stepIndex === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          {currentStep === 'review' ? (
            <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary hover:bg-primary/90 gap-2">
              <Shield className="h-4 w-4" />
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </Button>
          ) : (
            <Button
              onClick={nextStep}
              disabled={!canProceed()}
              className="gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
