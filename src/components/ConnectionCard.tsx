import { memo } from 'react';
import { User, Clock, Check, X, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import type { ConnectionRequest, CivicConnection } from '@/lib/civicSocial';

interface ConnectionRequestCardProps {
  request: ConnectionRequest;
  currentUserId: string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onCancel: (id: string) => void;
  isLoading?: boolean;
}

export const ConnectionRequestCard = memo(function ConnectionRequestCard({
  request,
  currentUserId,
  onAccept,
  onReject,
  onCancel,
  isLoading,
}: ConnectionRequestCardProps) {
  const isIncoming = request.recipientUserId === currentUserId;
  const otherUserId = isIncoming ? request.requesterUserId : request.recipientUserId;

  return (
    <Card className="border-border/50 hover:border-border transition-colors">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {otherUserId.slice(0, 8)}...
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="text-xs">
              {isIncoming ? 'Incoming' : 'Sent'}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(request.createdAt, { addSuffix: true })}
            </span>
          </div>
          {request.note && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{request.note}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isIncoming && request.status === 'pending' && (
            <>
              <Button
                size="sm"
                variant="default"
                onClick={() => onAccept(request.id)}
                disabled={isLoading}
                className="gap-1 h-8"
              >
                <Check className="h-3.5 w-3.5" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReject(request.id)}
                disabled={isLoading}
                className="gap-1 h-8"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {!isIncoming && request.status === 'pending' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCancel(request.id)}
              disabled={isLoading}
              className="text-muted-foreground h-8"
            >
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

interface ConnectionCardProps {
  connection: CivicConnection;
  onMessage: (userId: string) => void;
}

export const ConnectionCard = memo(function ConnectionCard({
  connection,
  onMessage,
}: ConnectionCardProps) {
  return (
    <Card className="border-border/50 hover:border-border transition-colors">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {connection.connectionUserId.slice(0, 8)}...
          </p>
          <p className="text-xs text-muted-foreground">
            Connected {formatDistanceToNow(connection.createdAt, { addSuffix: true })}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onMessage(connection.connectionUserId)}
          className="gap-1.5 h-8"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Message
        </Button>
      </CardContent>
    </Card>
  );
});
