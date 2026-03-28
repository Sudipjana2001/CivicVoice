import { memo } from 'react';
import { Users, MapPin, Lock, Globe, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CivicCommunity } from '@/lib/civicSocial';

interface CommunityCardProps {
  community: CivicCommunity;
  isMember: boolean;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  onOpen: (slug: string) => void;
  isLoading?: boolean;
}

export const CommunityCard = memo(function CommunityCard({
  community,
  isMember,
  onJoin,
  onLeave,
  onOpen,
  isLoading,
}: CommunityCardProps) {
  return (
    <Card className="border-border/50 hover:border-border/80 transition-all hover:shadow-md group">
      {community.bannerUrl && (
        <div className="h-24 rounded-t-lg overflow-hidden">
          <img
            src={community.bannerUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {community.avatarUrl ? (
              <img
                src={community.avatarUrl}
                alt={community.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <CardTitle className="text-base leading-tight">{community.name}</CardTitle>
              <div className="flex items-center gap-1.5 mt-0.5">
                {community.visibility === 'private' ? (
                  <Lock className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <Globe className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground capitalize">{community.visibility}</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {community.description && (
          <CardDescription className="line-clamp-2 text-xs">
            {community.description}
          </CardDescription>
        )}

        <div className="flex flex-wrap gap-1.5">
          {community.civicFocus && (
            <Badge variant="secondary" className="text-xs">{community.civicFocus}</Badge>
          )}
          {community.location && (
            <Badge variant="outline" className="text-xs gap-1">
              <MapPin className="h-3 w-3" />
              {community.location}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {community.memberCount} {community.memberCount === 1 ? 'member' : 'members'}
          </span>
          <div className="flex gap-1.5">
            {isMember ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onLeave(community.id)}
                  disabled={isLoading}
                  className="text-xs h-7 text-muted-foreground"
                >
                  Leave
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onOpen(community.slug)}
                  className="text-xs h-7 gap-1"
                >
                  Open <ArrowRight className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="default"
                onClick={() => onJoin(community.id)}
                disabled={isLoading}
                className="text-xs h-7"
              >
                Join Community
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
