import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { lazy, Suspense } from "react";
import MainLayout from "@/layouts/MainLayout";
import PageTransitionOverlay from "@/components/ui/PageTransitionOverlay";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Use HashRouter in Electron (file:// protocol); BrowserRouter on web.
const AppRouter = (window as any).electronBridge ? HashRouter : BrowserRouter;

// Lazy-loaded pages
const Index = lazy(() => import("./pages/Index"));
const PCBViewer = lazy(() => import("./pages/PCBViewer"));
const CommandCenter = lazy(() => import("./pages/CommandCenter"));
const ShowTestSimulator = lazy(() => import("./pages/ShowTestSimulator"));
const Settings = lazy(() => import("./pages/Settings"));
const FestivalStageDemo = lazy(() => import("./pages/FestivalStageDemo"));
const PairingTwoWire = lazy(() => import("./pages/PairingTwoWire"));

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

const Fallback = () => (
  <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppRouter>
            <PageTransitionOverlay />
            <Suspense fallback={<Fallback />}>
              <Routes>
                <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                <Route path="/festival-demo" element={<FestivalStageDemo />} />
                <Route path="/pairing/two-wire" element={<PairingTwoWire />} />
                <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                  <Route path="/" element={<Index />} />
                  <Route path="/editor" element={<Index />} />
                  <Route path="/command" element={<CommandCenter />} />
                  <Route path="/show-test" element={<ShowTestSimulator />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/pcb-viewer" element={<PCBViewer />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AppRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
