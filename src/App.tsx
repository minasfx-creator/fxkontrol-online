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

// Office — consolidated productivity area (Etapa 1 do refactor 3-áreas)
const Office = lazy(lazyRetry(() => import("./pages/Office")));

// Lazy-loaded heavy pages
const Index = lazy(lazyRetry(() => import("./pages/Index")));
const CommandCenter = lazy(lazyRetry(() => import("./pages/CommandCenter")));

// Field ops console — wraps DevicePairing + FieldTest + MobileLinkPanel as tabs.
const FieldOps = lazy(lazyRetry(() => import("./pages/FieldOps")));
const Settings = lazy(lazyRetry(() => import("./pages/Settings")));
const PlatformStatus = lazy(lazyRetry(() => import("./pages/PlatformStatus")));
const SwarmGPT = lazy(lazyRetry(() => import("./pages/SwarmGPT")));
const DmxPyroDiagnostics = lazy(lazyRetry(() => import("./components/diagnostics/DmxPyroDiagnostics")));
const NetworkSettings = lazy(lazyRetry(() => import("./pages/NetworkSettings")));
const Terms = lazy(lazyRetry(() => import("./pages/legal/Terms")));
const Refund = lazy(lazyRetry(() => import("./pages/legal/Refund")));
const Privacy = lazy(lazyRetry(() => import("./pages/legal/Privacy")));
const CheckoutSuccess = lazy(lazyRetry(() => import("./pages/CheckoutSuccess")));
const Pricing = lazy(lazyRetry(() => import("./pages/Pricing")));
const Landing = lazy(lazyRetry(() => import("./pages/Landing")));

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
    // Resume the originally-requested route. Falls back to /office (Etapa 1
    // do refactor 3-áreas) so signed-in users land na visão geral consolidada.
    const raw = params.get("next");
    const target = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/office";
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
                    {/* Public marketing landing — Apple-style HTML served via iframe; CTAs navigate parent SPA. */}
                    <Route path="/landing" element={<Landing />} />
                    {/* Checkout success — auth-gated but standalone (no MainLayout chrome) so the
                        confirmation screen is the only thing visible while the webhook lands. */}
                    <Route path="/checkout/success" element={<ProtectedRoute><CheckoutSuccess /></ProtectedRoute>} />
                    <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                      {/* ── 3 grandes áreas ───────────────────────────────────── */}
                      <Route path="/" element={<Navigate to="/office" replace />} />
                      <Route path="/office" element={<Office />} />
                      <Route path="/editor" element={<Index />} />
                      {/* Studio = editor 3D pré-carregado com o modal de prompt AI-first */}
                      <Route path="/studio" element={<Navigate to="/editor?prompt=1" replace />} />
                      <Route path="/command" element={<CommandCenter />} />

                      {/* ── Redirects: rotas antigas → nova estrutura ─────────── */}
                      <Route path="/agenda" element={<Navigate to="/office?tab=agenda" replace />} />
                      <Route path="/training" element={<Navigate to="/office?tab=training" replace />} />
                      <Route path="/admin" element={<Navigate to="/office?tab=compliance" replace />} />
                      <Route path="/accreditation" element={<Navigate to="/office?tab=documents" replace />} />
                      <Route path="/joi" element={<Navigate to="/office?tab=joi" replace />} />

                      {/* ── Field ops (gated) ─────────────────────────────────── */}
                      <Route path="/field" element={isEnabled('module_pairing_mobilelink') ? <FieldOps /> : <Navigate to="/office" replace />} />
                      <Route path="/pairing" element={isEnabled('module_pairing_mobilelink') ? <Navigate to="/field#pairing" replace /> : <Navigate to="/office" replace />} />
                      <Route path="/field-test" element={isEnabled('module_pairing_mobilelink') ? <Navigate to="/field#field-test" replace /> : <Navigate to="/office" replace />} />

                      {/* ── Settings & sistema ────────────────────────────────── */}
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/settings/network" element={<NetworkSettings />} />
                      <Route path="/platform-status" element={<PlatformStatus />} />
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
