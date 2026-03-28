import { useState, useEffect } from 'react';
import { Home, Users, MessageSquare, User, UserPlus } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { AlertService } from '@/services/AlertService';

const alertService = AlertService.getInstance();

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  badgeKey?: string; // maps to AlertService category
}

const navItems: NavItem[] = [
  { href: '/', label: 'Community Feed', icon: Home, badgeKey: 'voices' },
  { href: '/communities', label: 'Communities', icon: Users, badgeKey: 'communities' },
  { href: '/conversations', label: 'Conversations', icon: MessageSquare, badgeKey: 'conversations' },
];

export function BottomNav() {
  const location = useLocation();
  const { user, isAdmin } = useAuth();
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) {
      setBadgeCounts({});
      return;
    }

    // Fetch initial counts
    alertService.fetchCountsByCategory().then(setBadgeCounts).catch(() => {});

    // Subscribe to real-time alerts for live badge updates
    const channel = alertService.subscribeToAlerts(user.id, () => {
      alertService.fetchCountsByCategory().then(setBadgeCounts).catch(() => {});
    });

    // Poll every 30s as fallback
    const interval = setInterval(() => {
      alertService.fetchCountsByCategory().then(setBadgeCounts).catch(() => {});
    }, 30000);

    return () => {
      channel.unsubscribe();
      clearInterval(interval);
    };
  }, [user]);

  if (isAdmin) {
    return null;
  }

  // Profile / Sign In link
  const profileItem: NavItem = {
    href: user ? '/profile' : '/auth',
    label: user ? 'Profile' : 'Sign In',
    icon: User,
  };

  const allItems = [...navItems, profileItem];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-bottom">
      <div className="flex items-center justify-around h-14 pb-safe px-2">
        {allItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          const count = item.badgeKey ? (badgeCounts[item.badgeKey] || 0) : 0;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center justify-center p-2 rounded-full transition-colors relative",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-6 w-6", isActive && "text-primary")} />
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center leading-none">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </div>
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
