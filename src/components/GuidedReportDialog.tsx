import { useEffect, useState } from 'react';
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
import { CATEGORIES, SEVERITY_LEVELS, EVIDENCE_TYPES } from '@/lib/anonymity';
import type { Category, Severity, EvidenceType } from '@/lib/anonymity';
import type { SelfDestructOption } from '@/lib/types';
import {
  mediaKindFromEvidenceType,
  revokePreparedEvidencePreview,
  type PreparedEvidenceUpload,
} from '@/lib/media';
import { formatIncidentTiming } from '@/lib/postTiming';
import { AnonymityHealthIndicator } from './AnonymityHealthIndicator';
import { SelfDestructOptions } from './SelfDestructOptions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { EvidenceService } from '@/services/EvidenceService';
import { PostService } from '@/services/PostService';

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

const evidenceService = EvidenceService.getInstance();
const postService = PostService.getInstance();

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
  const [evidencePreviewUrl, setEvidencePreviewUrl] = useState('');
  const [uploadedEvidence, setUploadedEvidence] = useState<PreparedEvidenceUpload | null>(null);
  const [selfDestruct, setSelfDestruct] = useState<SelfDestructOption>(null);
  const [profileAnonymousId, setProfileAnonymousId] = useState<string | null>(null);

  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;

    const loadAnonymousId = async () => {
      if (!user) {
        if (!cancelled) {
          setProfileAnonymousId(null);
        }
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('anonymous_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setProfileAnonymousId(null);
        return;
      }

      setProfileAnonymousId(data.anonymous_id);
    };

    loadAnonymousId();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    return () => {
      revokePreparedEvidencePreview(uploadedEvidence);
    };
  }, [uploadedEvidence]);

  useEffect(() => {
    if (!uploadedEvidence) return;
    if (mediaKindFromEvidenceType(evidenceType) === uploadedEvidence.kind) return;

    revokePreparedEvidencePreview(uploadedEvidence);
    setUploadedEvidence(null);
    setEvidencePreviewUrl('');
  }, [evidenceType, uploadedEvidence]);

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

    if (!user) {
      toast.error('Please sign in before submitting a report');
      return;
    }

    setIsSubmitting(true);

    try {
      const post = await postService.create({
        content,
        category,
        severity,
        evidenceType: evidenceType || undefined,
        location,
        incidentDate: incidentDate || undefined,
        incidentTime: incidentTime || undefined,
        imageUrl: uploadedEvidence?.fullPath || uploadedEvidence?.originalPath || undefined,
        selfDestructDays: selfDestruct,
      });

      if (uploadedEvidence) {
        try {
          await evidenceService.attachToPost(post.id, uploadedEvidence);
        } catch (attachError) {
          console.error('Error attaching media manifest:', attachError);
          toast.warning('Report posted, but media optimization metadata could not be attached.');
        }
      }
    } catch (error) {
      console.error('Error creating post:', error);
      setIsSubmitting(false);
      toast.error('Failed to submit report. Please try again.');
      return;
    }

    setIsSubmitting(false);

    onPostCreated();
    resetForm();
    setOpen(false);

    toast.success('Report submitted', {
      description: 'Your public identity stays pseudonymous.',
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
    revokePreparedEvidencePreview(uploadedEvidence);
    setUploadedEvidence(null);
    setEvidencePreviewUrl('');
    setSelfDestruct(null);
    setCurrentStep('what');
  };

  const renderStep = () => {
    const incidentTiming = formatIncidentTiming({ incidentDate, incidentTime });

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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  Where did this incident occur? Add the most specific public-facing place you know.
                </p>
                <p className="text-xs text-muted-foreground mt-1 italic">
                  You can include a village, town, neighborhood, street, lane, ward, or landmark. Avoid sharing private contact details.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location (Optional)</Label>
              <Input
                id="location"
                placeholder="e.g., Rampur village, Shivaji Nagar, MG Road Lane 4"
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
                      if (!user) {
                        toast.error('Please sign in before uploading evidence');
                        return;
                      }

                      // Size check (10MB max)
                      if (file.size > 10 * 1024 * 1024) {
                        toast.error('File too large. Maximum size is 10MB.');
                        return;
                      }

                      try {
                        const upload = await evidenceService.uploadEvidence(file, evidenceType);
                        revokePreparedEvidencePreview(uploadedEvidence);
                        setUploadedEvidence(upload);
                        setEvidencePreviewUrl(upload.previewUrl || '');
                        toast.success('File uploaded successfully');
                      } catch (err) {
                        console.error('Upload error:', err);
                        const message = err instanceof Error ? err.message : 'Unknown error';
                        toast.error(`Upload failed: ${message}`);
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

                  {evidencePreviewUrl && (
                    <div className="rounded-lg border border-border/50 p-2 bg-muted/30">
                      {evidenceType === 'photo' ? (
                        <img src={evidencePreviewUrl} alt="Uploaded evidence" className="w-full h-32 object-cover rounded" />
                      ) : (
                        <p className="text-xs text-muted-foreground truncate">Attached privately to this report</p>
                      )}
                    </div>
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Files stay private in storage and are shared through signed links. Photos now upload optimized feed sizes plus a full version. Max 10MB.
                </p>
              </div>
            )}

            <div className="pt-2">
              <SelfDestructOptions
                value={selfDestruct}
                onChange={setSelfDestruct}
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
                {incidentTiming && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">When:</span>
                    <span className="font-medium text-right">{incidentTiming}</span>
                  </div>
                )}
                {location && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-medium text-right">{location}</span>
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
                    <span className="text-muted-foreground">Deletion request:</span>
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
      <DialogContent className="w-[calc(100vw-1rem)] rounded-2xl bg-card border-border max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Shield className="h-5 w-5 shield-icon" />
            Guided Report Submission
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Posting under <span className="anonymous-id">{profileAnonymousId ?? 'your protected profile ID'}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between gap-3 text-xs text-muted-foreground">
            <span>Step {stepIndex + 1} of {STEPS.length}</span>
            <span className="truncate text-right">{STEPS[stepIndex].label}</span>
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
        <div className="flex flex-col-reverse gap-2 pt-2 border-t border-border sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            onClick={prevStep}
            disabled={stepIndex === 0}
            className="gap-1 w-full sm:w-auto"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          {currentStep === 'review' ? (
            <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary hover:bg-primary/90 gap-2 w-full sm:w-auto">
              <Shield className="h-4 w-4" />
              {isSubmitting ? 'Posting...' : 'Post'}
            </Button>
          ) : (
            <Button
              onClick={nextStep}
              disabled={!canProceed()}
              className="gap-1 w-full sm:w-auto"
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
