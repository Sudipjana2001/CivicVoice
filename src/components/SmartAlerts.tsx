import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  BellRing, 
  MapPin, 
  Tag, 
  RefreshCw,
  X,
  Check,
  Clock,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { InboxService } from '@/services/InboxService';
import type { Alert } from '@/services/InboxService';
import { useAuth } from '@/hooks/useAuth';

const inboxService = InboxService.getInstance();

const alertTypeConfig = {
  new_incident: { icon: MapPin, color: 'text-primary', bgColor: 'bg-primary/10' },
  status_change: { icon: RefreshCw, color: 'text-severity-medium', bgColor: 'bg-severity-medium/10' },
  follow_up: { icon: Tag, color: 'text-credible', bgColor: 'bg-credible/10' },
};

export function SmartAlerts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await inboxService.fetchAlerts();
      setAlerts(data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open && user) fetchAlerts();
    if (!user) setAlerts([]);
  }, [open, user, fetchAlerts]);

  const unreadCount = alerts.filter(a => !a.read).length;

  const markAsRead = async (alertId: string) => {
    await inboxService.markAlertRead(alertId);
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
  };

  const markAllAsRead = async () => {
    const unreadIds = alerts.filter(a => !a.read).map(a => a.id);
    await inboxService.markAlertsRead(unreadIds);
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  };

  const dismissAlert = async (alertId: string) => {
    await inboxService.deleteAlert(alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`${unreadCount} unread alerts`}>
          {unreadCount > 0 ? <BellRing className="h-5 w-5 text-primary" /> : <Bell className="h-5 w-5 text-muted-foreground" />}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-severity-high text-xs font-bold flex items-center justify-center text-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-card border-border" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border/50">
          <h4 className="font-medium flex items-center gap-2"><Bell className="h-4 w-4" />Smart Alerts</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs text-muted-foreground hover:text-foreground">
              <Check className="h-3 w-3 mr-1" />Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[300px]">
          {!user ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sign in to receive alerts</p>
            </div>
          ) : loading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No alerts yet</p>
              <p className="text-xs mt-1">Follow topics to receive alerts</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {alerts.map((alert) => {
                const config = alertTypeConfig[alert.type];
                const Icon = config.icon;
                return (
                  <div key={alert.id} className={`p-3 relative hover:bg-muted/50 transition-colors ${!alert.read ? 'bg-primary/5' : ''}`} onClick={() => markAsRead(alert.id)}>
                    <div className="flex gap-3">
                      <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium ${!alert.read ? 'text-foreground' : 'text-muted-foreground'}`}>{alert.title}</p>
                          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-50 hover:opacity-100" onClick={(e) => { e.stopPropagation(); dismissAlert(alert.id); }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.description}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />{formatDistanceToNow(alert.timestamp, { addSuffix: true })}
                          </span>
                          {alert.topic && <Badge variant="secondary" className="text-xs h-5">{alert.topic.label}</Badge>}
                        </div>
                      </div>
                    </div>
                    {!alert.read && <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={() => {
              setOpen(false);
              navigate('/profile?tab=alerts');
            }}
          >
            Manage alert preferences
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
