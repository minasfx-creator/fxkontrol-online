import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { lazy, Suspense } from "react";
import MainLayout from "@/layouts/MainLayout";
import PageTransitionOverlay from "@/components/ui/PageTransitionOverlay";
import { LazyChunkBoundary } from "@/components/errors/LazyChunkBoundary";
import { AppErrorBoundary } from "@/components/errors/AppErrorBoundary";
import { lazyRetry } from "@/lib/lazyRetry";
import { useRouteTracing } from "@/observability/useRouteTracing";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const Install = lazy(lazyRetry(() => import("./pages/Install")));

// Dashboard lazy-loaded — it's 658 lines with heavy imports
const Dashboard = lazy(lazyRetry(() => import("./pages/Dashboard")));

// Lazy-loaded heavy pages
const Index = lazy(lazyRetry(() => import("./pages/Index")));
const Agenda = lazy(lazyRetry(() => import("./pages/Agenda")));
const Training = lazy(lazyRetry(() => import("./pages/Training")));
const PCBViewer = lazy(lazyRetry(() => import("./pages/PCBViewer")));
const DevicePairing = lazy(lazyRetry(() => import("./pages/DevicePairing")));
const CommandCenter = lazy(lazyRetry(() => import("./pages/CommandCenter")));

const FieldTest = lazy(lazyRetry(() => import("./pages/FieldTest")));
const Settings = lazy(lazyRetry(() => import("./pages/Settings")));
const Admin = lazy(lazyRetry(() => import("./pages/Admin")));
const AccreditationDashboard = lazy(lazyRetry(() => import("./pages/AccreditationDashboard")));
const PlatformStatus = lazy(lazyRetry(() => import("./pages/PlatformStatus")));
const JoiPanel = lazy(lazyRetry(() => import("./ai/ui/JoiPanel")));
const SwarmGPT = lazy(lazyRetry(() => import("./pages/SwarmGPT")));
const DmxPyroDiagnostics = lazy(lazyRetry(() => import("./components/diagnostics/DmxPyroDiagnostics")));

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

function RouteTracker() {
  useRouteTracing();
  return null;
}

function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <RouteTracker />
              <PageTransitionOverlay />
              <LazyChunkBoundary>
                <Suspense fallback={<div className="min-h-[100dvh] w-full flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
                  <Routes>
                    <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                    <Route path="/install" element={<Install />} />
                    {/* Public diagnostics — intentionally outside ProtectedRoute so it can
                        be opened without login while debugging Live Firing / DMX issues. */}
                    <Route path="/diagnostics/dmx-pyro" element={<DmxPyroDiagnostics />} />
                    <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/editor" element={<Index />} />
                      <Route path="/agenda" element={<Agenda />} />
                      <Route path="/training" element={<Training />} />
                      <Route path="/pcb-viewer" element={<PCBViewer />} />
                      <Route path="/pairing" element={<DevicePairing />} />
                      <Route path="/command" element={<CommandCenter />} />
                      
                      <Route path="/field-test" element={<FieldTest />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/platform-status" element={<PlatformStatus />} />
                      <Route path="/admin" element={<Admin />} />
                      <Route path="/accreditation" element={<AccreditationDashboard />} />
                      <Route path="/joi" element={<JoiPanel />} />
                      <Route path="/swarmgpt" element={<SwarmGPT />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </LazyChunkBoundary>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;
