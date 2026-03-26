import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App error boundary caught a render failure:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-xl border border-border bg-card p-6 space-y-4 text-center">
            <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              CivicVoice hit an unexpected error. You can reload the page or go back to the feed safely.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={() => window.location.reload()}>
                Reload
              </Button>
              <Button variant="outline" onClick={() => { window.location.href = '/'; }}>
                Go to Feed
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
