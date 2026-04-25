import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { lazy, Suspense } from "react";
import MainLayout from "@/layouts/MainLayout";
import PageTransitionOverlay from "@/components/ui/PageTransitionOverlay";
import { LazyChunkBoundary } from "@/components/errors/LazyChunkBoundary";
import { AppErrorBoundary } from "@/components/errors/AppErrorBoundary";
import UpgradeDialog from "@/components/upgrade/UpgradeDialog";

import { lazyRetry } from "@/lib/lazyRetry";
import { isEnabled } from "@/lib/featureFlags";
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
const CommandCenter = lazy(lazyRetry(() => import("./pages/CommandCenter")));

// Field ops console — wraps DevicePairing + FieldTest + MobileLinkPanel as tabs.
const FieldOps = lazy(lazyRetry(() => import("./pages/FieldOps")));
const Settings = lazy(lazyRetry(() => import("./pages/Settings")));
const Admin = lazy(lazyRetry(() => import("./pages/Admin")));
const AccreditationDashboard = lazy(lazyRetry(() => import("./pages/AccreditationDashboard")));
const PlatformStatus = lazy(lazyRetry(() => import("./pages/PlatformStatus")));
const JoiPanel = lazy(lazyRetry(() => import("./ai/ui/JoiPanel")));
const SwarmGPT = lazy(lazyRetry(() => import("./pages/SwarmGPT")));
const DmxPyroDiagnostics = lazy(lazyRetry(() => import("./components/diagnostics/DmxPyroDiagnostics")));
const NetworkSettings = lazy(lazyRetry(() => import("./pages/NetworkSettings")));
const Terms = lazy(lazyRetry(() => import("./pages/legal/Terms")));
const Refund = lazy(lazyRetry(() => import("./pages/legal/Refund")));
const Privacy = lazy(lazyRetry(() => import("./pages/legal/Privacy")));
const CheckoutSuccess = lazy(lazyRetry(() => import("./pages/CheckoutSuccess")));
const Pricing = lazy(lazyRetry(() => import("./pages/Pricing")));

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) {
    // Preserve where the user was trying to go so AuthRoute can resume there post-login.
    const next = `${location.pathname}${location.search}${location.hash}`;
    const search = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
    return <Navigate to={`/auth${search}`} replace />;
  }
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) return null;
  if (user) {
    // Resume the originally-requested route. Falls back to /editor so signed-in
    // users land directly in the 3D viewport instead of the Dashboard splash.
    const raw = params.get("next");
    const target = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/editor";
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
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
              <UpgradeDialog />
              <LazyChunkBoundary>
                <Suspense fallback={<div className="min-h-[100dvh] w-full flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
                  <Routes>
                    <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                    <Route path="/install" element={<Install />} />
                    {/* Public diagnostics — intentionally outside ProtectedRoute so it can
                        be opened without login while debugging Live Firing / DMX issues. */}
                    <Route path="/diagnostics/dmx-pyro" element={<DmxPyroDiagnostics />} />
                    {/* Public legal pages — required by Paddle (Merchant of Record) and must be crawlable without auth. */}
                    <Route path="/legal/terms" element={<Terms />} />
                    <Route path="/legal/refund" element={<Refund />} />
                    <Route path="/legal/privacy" element={<Privacy />} />
                    {/* Public pricing — must be reachable without login (marketing + Paddle compliance). */}
                    <Route path="/pricing" element={<Pricing />} />
                    {/* Checkout success — auth-gated but standalone (no MainLayout chrome) so the
                        confirmation screen is the only thing visible while the webhook lands. */}
                    <Route path="/checkout/success" element={<ProtectedRoute><CheckoutSuccess /></ProtectedRoute>} />
                    <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/editor" element={<Index />} />
                      <Route path="/agenda" element={<Agenda />} />
                      <Route path="/training" element={<Training />} />
                      {/* Unified field ops console (Pairing | Field Test | Mobile Link). Gated. */}
                      <Route path="/field" element={isEnabled('module_pairing_mobilelink') ? <FieldOps /> : <Navigate to="/" replace />} />
                      {/* Legacy routes — redirect to consolidated /field with hash anchor (or home if disabled). */}
                      <Route path="/pairing" element={isEnabled('module_pairing_mobilelink') ? <Navigate to="/field#pairing" replace /> : <Navigate to="/" replace />} />
                      <Route path="/field-test" element={isEnabled('module_pairing_mobilelink') ? <Navigate to="/field#field-test" replace /> : <Navigate to="/" replace />} />
                      <Route path="/command" element={<CommandCenter />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/settings/network" element={<NetworkSettings />} />
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
