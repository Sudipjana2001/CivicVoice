import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AlertService } from '@/services/AlertService';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  BellRing,
  Check,
  X,
  Clock,
  Users,
  UserPlus,
  MessageSquare,
  Megaphone,
  Heart,
  MessageCircle,
  Loader2,
  Filter,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { CivicAlert, CivicAlertType } from '@/lib/civicSocial';

const alertService = AlertService.getInstance();

const alertTypeIcons: Record<string, typeof Bell> = {
  connection_request: UserPlus,
  connection_accepted: Users,
  conversation_message: MessageSquare,
  community_join: Users,
  community_activity: Megaphone,
  voice_supported: Heart,
  voice_commented: MessageCircle,
};

const alertTypeColors: Record<string, string> = {
  connection_request: 'bg-blue-500/10 text-blue-600',
  connection_accepted: 'bg-green-500/10 text-green-600',
  conversation_message: 'bg-primary/10 text-primary',
  community_join: 'bg-violet-500/10 text-violet-600',
  community_activity: 'bg-orange-500/10 text-orange-600',
  voice_supported: 'bg-pink-500/10 text-pink-600',
  voice_commented: 'bg-teal-500/10 text-teal-600',
};

const filterOptions: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Alerts' },
  { value: 'connection', label: 'Connections' },
  { value: 'conversation', label: 'Messages' },
  { value: 'community', label: 'Communities' },
  { value: 'engagement', label: 'Engagement' },
];

function getFilterGroup(type: string): string {
  if (type.startsWith('connection')) return 'connection';
  if (type.startsWith('conversation')) return 'conversation';
  if (type.startsWith('community')) return 'community';
  return 'engagement';
}

export default function AlertsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['civic-alerts'],
    queryFn: () => alertService.fetchAlerts(),
    enabled: !!user,
  });

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = alertService.subscribeToAlerts(user.id, () => {
      queryClient.invalidateQueries({ queryKey: ['civic-alerts'] });
    });

    return () => {
      channel.unsubscribe();
    };
  }, [user, queryClient]);

  const markReadMutation = useMutation({
    mutationFn: (alertId: string) => alertService.markAsRead(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['civic-alerts'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => alertService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['civic-alerts'] });
      toast.success('All alerts marked as read');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (alertId: string) => alertService.deleteAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['civic-alerts'] });
    },
  });

  const filteredAlerts = filter === 'all'
    ? alerts
    : alerts.filter((a) => getFilterGroup(a.type) === filter);

  const unreadCount = alerts.filter((a) => !a.read).length;

  const handleAlertClick = (alert: CivicAlert) => {
    if (!alert.read) {
      markReadMutation.mutate(alert.id);
    }
    if (alert.actionUrl) {
      navigate(alert.actionUrl);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-16 text-center">
          <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h2 className="text-lg font-semibold mb-2">Sign in to view alerts</h2>
          <p className="text-sm text-muted-foreground mb-6">Stay updated on civic activity</p>
          <Button onClick={() => navigate('/auth')}>Sign In</Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container py-6 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              {unreadCount > 0 ? (
                <BellRing className="h-5 w-5 text-primary" />
              ) : (
                <Bell className="h-5 w-5 text-primary" />
              )}
              Alerts
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="gap-1.5 text-xs"
            >
              <Check className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto py-1">
          <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          {filterOptions.map((option) => (
            <Button
              key={option.value}
              variant={filter === option.value ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter(option.value)}
              className="text-xs h-7 flex-shrink-0"
            >
              {option.label}
            </Button>
          ))}
        </div>

        {/* Alerts List */}
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-12 glass-card">
            <Bell className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              {alerts.length === 0 ? 'No alerts yet' : 'No alerts in this category'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAlerts.map((alert) => {
              const Icon = alertTypeIcons[alert.type] || Bell;
              const colorClass = alertTypeColors[alert.type] || 'bg-muted text-muted-foreground';

              return (
                <div
                  key={alert.id}
                  onClick={() => handleAlertClick(alert)}
                  className={cn(
                    'glass-card p-4 flex items-start gap-3 cursor-pointer transition-all hover:border-border',
                    !alert.read && 'border-primary/20 bg-primary/5'
                  )}
                >
                  <div className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0', colorClass)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn('text-sm', !alert.read ? 'font-semibold' : 'font-medium text-muted-foreground')}>
                        {alert.title}
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!alert.read && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-40 hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(alert.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {alert.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.description}</p>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(alert.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
