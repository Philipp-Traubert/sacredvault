import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AccessProvider, useAccessControl } from "@/hooks/useAccessControl";
import Login from "./pages/Login";
import VideoLibrary from "./pages/VideoLibrary";
import VideoPlayer from "./pages/VideoPlayer";
import Admin from "./pages/Admin";
import NoAccess from "./pages/NoAccess";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function hasCachedSession(): boolean {
  try {
    return !!localStorage.getItem("video_vault_session_user");
  } catch {
    return false;
  }
}

function AppRoutes() {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: accessLoading } = useAccessControl();

  if (authLoading || accessLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Offline edge case: auth lib cleared session but we have cached user — keep loader.
  if (!user && hasCachedSession() && !navigator.onLine) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  if (!hasAccess) {
    return (
      <Routes>
        <Route path="*" element={<NoAccess />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<VideoLibrary />} />
      <Route path="/player/:id" element={<VideoPlayer />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AccessProvider>
            <AppRoutes />
          </AccessProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
