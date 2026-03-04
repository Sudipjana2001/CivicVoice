import { Home, Map, Inbox, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { href: '/', label: 'Feed', icon: Home },
  { href: '/heatmap', label: 'Heatmap', icon: Map },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
];

export function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();

  // Profile / Sign In link
  const profileItem = {
    href: user ? '/profile' : '/auth',
    label: user ? 'Profile' : 'Sign In',
    icon: User,
  };

  const allItems = [...navItems, profileItem];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-bottom">
      <div className="flex items-center justify-around h-14 pb-safe">
        {allItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[60px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
