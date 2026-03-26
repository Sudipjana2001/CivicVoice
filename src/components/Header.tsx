import { Shield, Eye, Map, Inbox, User, LogIn, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SmartAlerts } from './SmartAlerts';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { href: '/', label: 'Feed' },
  { href: '/heatmap', label: 'Heatmap', icon: Map },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
];

export function Header() {
  const location = useLocation();
  const { user, loading, isAdmin } = useAuth();
  const desktopNavItems = user && isAdmin
    ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck }]
    : navItems;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 sm:h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 sm:gap-3 hover:opacity-90 transition-opacity">
          <div className="relative">
            <Shield className="h-6 w-6 sm:h-8 sm:w-8 shield-icon animate-shield-pulse" />
            <Eye className="h-2.5 w-2.5 sm:h-3 sm:w-3 absolute -bottom-0.5 -right-0.5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-semibold tracking-tight">CivicVoice</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Anonymous Civic Reporting</p>
          </div>
        </Link>

        {/* Desktop nav — hidden on mobile since BottomNav handles it */}
        <nav className="hidden md:flex items-center gap-1">
          {desktopNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-1.5 ${
                  isActive 
                    ? 'bg-primary/10 text-primary font-medium' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <SmartAlerts />
          
          {!loading && (
            <div className="hidden md:flex">
              {user ? (
                <Link to={isAdmin ? "/admin" : "/profile"}>
                  <Button variant="ghost" size="icon" className="h-9 w-9 flex items-center justify-center">
                    {isAdmin ? <ShieldCheck className="h-5 w-5" /> : <User className="h-5 w-5" />}
                  </Button>
                </Link>
              ) : (
                <Link to="/auth">
                  <Button variant="ghost" size="sm" className="flex items-center gap-1.5">
                    <LogIn className="h-4 w-4" />
                    <span>Sign In</span>
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
