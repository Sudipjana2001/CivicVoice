import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import Index from "./pages/Index";
import Heatmap from "./pages/Heatmap";
import InboxPage from "./pages/InboxPage";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import CommentsPage from "./pages/CommentsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const location = useLocation();

  return (
    <div key={location.pathname} className="cv-page-enter pb-16 md:pb-0">
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/heatmap" element={<Heatmap />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/comments/:postId" element={<CommentsPage />} />
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
