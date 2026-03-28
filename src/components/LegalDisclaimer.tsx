import { useCallback, useState } from 'react';
import { AlertTriangle, Info, Scale, X } from 'lucide-react';

interface LegalDisclaimerProps {
  variant?: 'inline' | 'banner' | 'compact';
}

const BANNER_DISMISSAL_STORAGE_KEY = 'civicvoice.banner-disclaimer-dismissed';

export function LegalDisclaimer({ variant = 'inline' }: LegalDisclaimerProps) {
  const [isBannerDismissed, setIsBannerDismissed] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      return window.localStorage.getItem(BANNER_DISMISSAL_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const handleDismissBanner = useCallback(() => {
    setIsBannerDismissed(true);

    try {
      window.localStorage.setItem(BANNER_DISMISSAL_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage failures so the banner can still be dismissed for the current view.
    }
  }, []);

  if (variant === 'compact') {
    return (
      <p className="text-xs text-muted-foreground italic flex items-center gap-1">
        <Scale className="h-3 w-3 flex-shrink-0" />
        This is a public allegation, not a verified fact or legal judgment.
      </p>
    );
  }

  if (variant === 'banner') {
    if (isBannerDismissed) {
      return null;
    }

    return (
      <div className="bg-primary/5 border-y border-primary/20 px-4 py-2">
        <div className="container flex items-start gap-2 text-xs text-muted-foreground sm:items-center">
          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-primary sm:mt-0" />
          <span className="flex-1">
            <strong className="text-foreground">Disclaimer:</strong> All posts are unverified allegations for public awareness.
            The platform does not endorse, verify, or take responsibility for the accuracy of user-submitted content.
          </span>
          <button
            type="button"
            onClick={handleDismissBanner}
            aria-label="Dismiss disclaimer"
            className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
      <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Legal Notice:</strong> This post contains unverified allegations 
          submitted anonymously for public awareness. The platform does not verify claims and is not responsible 
          for content accuracy.
        </p>
        <p className="text-xs text-muted-foreground italic">
          Posts are public allegations, not legal judgments or verified facts.
        </p>
      </div>
    </div>
  );
}
