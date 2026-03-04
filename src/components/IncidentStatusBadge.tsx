import { 
  Circle, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Archive,
  ClipboardCheck
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { IncidentStatus } from '@/lib/types';

interface IncidentStatusBadgeProps {
  status: IncidentStatus;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

const statusConfig: Record<IncidentStatus, {
  icon: React.ElementType;
  label: string;
  description: string;
  className: string;
}> = {
  submitted: {
    icon: Circle,
    label: 'Submitted',
    description: 'Report received and pending review',
    className: 'text-muted-foreground bg-muted/50 border-border',
  },
  under_review: {
    icon: Search,
    label: 'Under Review',
    description: 'This incident is being reviewed by moderators',
    className: 'text-primary bg-primary/10 border-primary/30',
  },
  escalated: {
    icon: AlertTriangle,
    label: 'Escalated',
    description: 'This incident has been escalated for priority attention',
    className: 'text-severity-high bg-severity-high/10 border-severity-high/30',
  },
  action_noted: {
    icon: ClipboardCheck,
    label: 'Action Noted',
    description: 'Actions have been noted regarding this incident',
    className: 'text-severity-medium bg-severity-medium/10 border-severity-medium/30',
  },
  resolved: {
    icon: CheckCircle2,
    label: 'Resolved',
    description: 'This incident has been marked as resolved',
    className: 'text-credible bg-credible/10 border-credible/30',
  },
  closed: {
    icon: Archive,
    label: 'Closed',
    description: 'This incident has been closed',
    className: 'text-muted-foreground bg-muted/50 border-border',
  },
};

export function IncidentStatusBadge({ status, size = 'sm', showLabel = true }: IncidentStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.submitted;
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
            {showLabel && <span className="font-medium">{config.label}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="z-[9999]">
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
