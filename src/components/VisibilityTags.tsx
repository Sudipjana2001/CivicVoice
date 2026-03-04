import { Building, Eye, Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { VisibilityTag } from '@/lib/types';

interface VisibilityTagsProps {
  tags: VisibilityTag[];
}

const tagConfig: Record<VisibilityTag, {
  icon: React.ElementType;
  label: string;
  description: string;
}> = {
  shared_ngo: {
    icon: Building,
    label: 'Shared with NGO',
    description: 'This report has been shared with relevant NGO partners. No enforcement action implied.',
  },
  shared_watchdog: {
    icon: Eye,
    label: 'Shared with Watchdog',
    description: 'This report has been shared with a watchdog group for monitoring. No enforcement action implied.',
  },
  media_attention: {
    icon: Radio,
    label: 'Media Attention',
    description: 'This incident has received media attention.',
  },
};

export function VisibilityTags({ tags }: VisibilityTagsProps) {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const config = tagConfig[tag];
        const Icon = config.icon;
        
        return (
          <TooltipProvider key={tag}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline" 
                  className="gap-1 text-xs bg-accent/50 border-accent text-accent-foreground cursor-help"
                >
                  <Icon className="h-3 w-3" />
                  {config.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs z-[9999]">
                <p className="text-xs">{config.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}
