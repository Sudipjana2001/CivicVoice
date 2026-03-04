import { Shield, ShieldCheck, ShieldAlert, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ConfidenceLevel } from '@/lib/types';

interface EvidenceConfidenceScoreProps {
  level: ConfidenceLevel;
  size?: 'sm' | 'md';
}

const confidenceConfig: Record<ConfidenceLevel, {
  icon: React.ElementType;
  label: string;
  description: string;
  className: string;
}> = {
  low: {
    icon: ShieldAlert,
    label: 'Low',
    description: 'Limited supporting evidence. This report has minimal corroborating data.',
    className: 'text-muted-foreground bg-muted/50 border-border',
  },
  medium: {
    icon: Shield,
    label: 'Medium',
    description: 'Some corroborating data. This report has partial supporting evidence.',
    className: 'text-severity-medium bg-severity-medium/10 border-severity-medium/30',
  },
  high: {
    icon: ShieldCheck,
    label: 'High',
    description: 'Strong supporting evidence. Multiple data points corroborate this report.',
    className: 'text-credible bg-credible/10 border-credible/30',
  },
};

export function EvidenceConfidenceScore({ level, size = 'sm' }: EvidenceConfidenceScoreProps) {
  const config = confidenceConfig[level] || confidenceConfig.medium;
  const Icon = config.icon;

  const sizeClasses = size === 'sm' 
    ? 'text-xs px-2 py-0.5 gap-1'
    : 'text-sm px-3 py-1 gap-1.5';

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center rounded-md border ${config.className} ${sizeClasses}`}>
            <Icon className={iconSize} />
            <span className="font-medium">{config.label}</span>
            <Info className={`${iconSize} opacity-50`} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs z-[9999]">
          <div className="space-y-1">
            <p className="font-medium">Evidence Confidence: {config.label}</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            <p className="text-xs text-muted-foreground italic">
              Note: This is an algorithmic assessment, not verified truth.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
