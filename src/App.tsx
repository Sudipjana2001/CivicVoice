import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { BrowserRouter, Navigate, Routes, Route, useLocation, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import Index from "./pages/Index";
import Heatmap from "./pages/Heatmap";
import InboxPage from "./pages/InboxPage";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import CommentsPage from "./pages/CommentsPage";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const RouteGuardFallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center px-4">
    <div className="glass-card w-full max-w-xl p-6 sm:p-8 space-y-4">
      <div className="h-7 w-40 rounded cv-shimmer" />
      <div className="h-4 w-60 rounded cv-shimmer" />
      <div className="space-y-3 pt-2">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="h-12 rounded-xl cv-shimmer" />
        ))}
      </div>
    </div>
  </div>
);

const AdminAccessDenied = () => (
  <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
    <Card className="w-full max-w-xl border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <AlertTriangle className="h-5 w-5 text-primary" />
          Access Denied
        </CardTitle>
        <CardDescription>
          This admin panel is restricted to authorized moderator and master-admin accounts only.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/">Go to User Feed</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/profile">Open Profile</Link>
        </Button>
      </CardContent>
    </Card>
  </div>
);

const UserOnlyRoute = ({ children }: { children: JSX.Element }) => {
  const { loading, adminLoading, user, isAdmin } = useAuth();

  if (loading || adminLoading) {
    return <RouteGuardFallback />;
  }

  if (user && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return children;
};

const AdminOnlyRoute = ({ children }: { children: JSX.Element }) => {
  const { loading, adminLoading, user, isAdmin } = useAuth();

  if (loading || adminLoading) {
    return <RouteGuardFallback />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return <AdminAccessDenied />;
  }

  return children;
};

const AppRoutes = () => {
  const location = useLocation();

  return (
    <div key={location.pathname} className="cv-page-enter pb-16 md:pb-0">
      <Routes>
        <Route path="/" element={<UserOnlyRoute><Index /></UserOnlyRoute>} />
        <Route path="/heatmap" element={<UserOnlyRoute><Heatmap /></UserOnlyRoute>} />
        <Route path="/inbox" element={<UserOnlyRoute><InboxPage /></UserOnlyRoute>} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/profile" element={<UserOnlyRoute><Profile /></UserOnlyRoute>} />
        <Route path="/admin" element={<AdminOnlyRoute><Admin /></AdminOnlyRoute>} />
        <Route path="/comments/:postId" element={<UserOnlyRoute><CommentsPage /></UserOnlyRoute>} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppErrorBoundary>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
            <BottomNav />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </AppErrorBoundary>
  </QueryClientProvider>
);

export default App;
