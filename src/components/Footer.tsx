import { Shield, AlertTriangle } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-card/50 mt-auto">
      <div className="container pt-8 pb-24 md:pb-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <span className="font-semibold">CivicVoice</span>
              <p className="text-xs text-muted-foreground">Privacy-First Civic Reporting</p>
            </div>
          </div>

          <div className="flex items-start gap-2 max-w-md text-center md:text-left">
            <AlertTriangle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              <strong>Disclaimer:</strong> This platform does not verify claims. 
              All posts are allegations for public awareness, not legal judgments. 
              Content is subject to community review.
            </p>
          </div>
        </div>

        <div className="border-t border-border/40 mt-6 pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Your anonymity is our priority. No personal data collected. No tracking.
          </p>
        </div>
      </div>
    </footer>
  );
}
