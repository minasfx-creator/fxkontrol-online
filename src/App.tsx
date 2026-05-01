import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { lazy, Suspense } from "react";
import PageTransitionOverlay from "@/components/ui/PageTransitionOverlay";
import { LazyChunkBoundary } from "@/components/errors/LazyChunkBoundary";
import { AppErrorBoundary } from "@/components/errors/AppErrorBoundary";
import CanvasLoaderWithTimeout from "@/components/editor/CanvasLoaderWithTimeout";

// Route-level Suspense fallback. Same timeout-aware loader used inside Studio,
// so a stalled route-level dynamic import surfaces a "Reload Studio" button
// after 8s instead of leaving the user trapped on a spinner.
function RouteLoaderWithTimeout() {
  return (
    <div className="min-h-[100dvh] w-full">
      <CanvasLoaderWithTimeout timeoutMs={8000} label="Loading..." />
    </div>
  );
}

// MainLayout + UpgradeDialog are lazy-split so the public routes
// (/landing, /auth, /legal/*, /pricing) don't pay for the dashboard
// chrome (Sidebar, DockBar, Tactical UI) on first load.
const MainLayout = lazy(() => import("@/layouts/MainLayout"));
const UpgradeDialog = lazy(() => import("@/components/upgrade/UpgradeDialog"));
const SonnerToaster = lazy(() =>
  import("@/components/ui/sonner").then((m) => ({ default: m.Toaster })),
);

import { lazyRetry } from "@/lib/lazyRetry";
import { isEnabled } from "@/lib/featureFlags";
import { useRouteTracing } from "@/observability/useRouteTracing";
// Profiler is dev-only and lazy so production rota pública doesn't ship it.
import { useHardwareSyncLoop } from "@/hooks/useHardwareSyncLoop";

const PlaybackProfilerProvider = lazy(() =>
  import("@/core/performance/PlaybackProfilerProvider").then((m) => ({ default: m.PlaybackProfilerProvider })),
);
const PlaybackProfilerPanel = lazy(() =>
  import("@/components/dev/PlaybackProfilerPanel").then((m) => ({ default: m.PlaybackProfilerPanel })),
);
const IS_DEV = import.meta.env.DEV;
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const Install = lazy(lazyRetry(() => import("./pages/Install")));
const UsbPairingWizard = lazy(lazyRetry(() => import("./pages/UsbPairingWizard")));
const BlePairingWizard = lazy(lazyRetry(() => import("./pages/BlePairingWizard")));
const RealDiscoveryProbe = lazy(lazyRetry(() => import("./pages/RealDiscoveryProbe")));
const FXK16ValidatePage = lazy(lazyRetry(() => import("./pages/FXK16ValidatePage")));
const SkyCanvasSmoke = lazy(lazyRetry(() => import("./pages/dev/SkyCanvasSmoke")));
const DesignSystemShowcase = lazy(lazyRetry(() => import("./pages/dev/DesignSystemShowcase")));
const EditorShellPreview = lazy(lazyRetry(() => import("./pages/dev/EditorShellPreview")));
const FXK16CalibrationPage = lazy(lazyRetry(() => import("./pages/FXK16CalibrationPage")));

// Office — consolidated productivity area (Etapa 1 do refactor 3-áreas)
const Office = lazy(lazyRetry(() => import("./pages/Office")));

// Create-flow (Action Layer) — Blueprint UX entry funnel
const Create = lazy(lazyRetry(() => import("./pages/Create")));
const CreateBlank = lazy(lazyRetry(() => import("./pages/create/CreateBlank")));
const CreateTemplate = lazy(lazyRetry(() => import("./pages/create/CreateTemplate")));
const CreateGenerate = lazy(lazyRetry(() => import("./pages/create/CreateGenerate")));

// Lazy-loaded heavy pages
const Index = lazy(lazyRetry(() => import("./pages/Index")));
const CommandCenter = lazy(lazyRetry(() => import("./pages/CommandCenter")));

// Field ops console — wraps DevicePairing + FieldTest + MobileLinkPanel as tabs.
const FieldOps = lazy(lazyRetry(() => import("./pages/FieldOps")));
const Settings = lazy(lazyRetry(() => import("./pages/Settings")));
const PlatformStatus = lazy(lazyRetry(() => import("./pages/PlatformStatus")));
// Legacy AI pages (SwarmGPT / AIChoreography) consolidated under /ai-builder.
const AIBuilder = lazy(lazyRetry(() => import("./pages/AIBuilder")));
const DmxPyroDiagnostics = lazy(lazyRetry(() => import("./components/diagnostics/DmxPyroDiagnostics")));
const NetworkSettings = lazy(lazyRetry(() => import("./pages/NetworkSettings")));
const Terms = lazy(lazyRetry(() => import("./pages/legal/Terms")));
const Refund = lazy(lazyRetry(() => import("./pages/legal/Refund")));
const Privacy = lazy(lazyRetry(() => import("./pages/legal/Privacy")));
const CheckoutSuccess = lazy(lazyRetry(() => import("./pages/CheckoutSuccess")));
const Pricing = lazy(lazyRetry(() => import("./pages/Pricing")));
const Landing = lazy(lazyRetry(() => import("./pages/Landing")));
const Manifesto = lazy(lazyRetry(() => import("./pages/Manifesto")));
const Comercial = lazy(lazyRetry(() => import("./pages/Comercial")));
const IOSReadiness = lazy(lazyRetry(() => import("./pages/IOSReadiness")));
const Unsubscribe = lazy(lazyRetry(() => import("./pages/Unsubscribe")));
const Strategy = lazy(lazyRetry(() => import("./pages/Strategy")));
const PitchUS = lazy(lazyRetry(() => import("./pages/PitchUS")));

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
    // Preserve where the user was trying to go so AuthRoute can resume there
    // post-login. Skip preservation for entry / public routes — landing back
    // there after login is never useful.
    const path = location.pathname;
    const skip = path === '/' || path === '/landing' || path === '/auth';
    const next = skip ? '' : `${path}${location.search}${location.hash}`;
    const search = next ? `?next=${encodeURIComponent(next)}` : '';
    return <Navigate to={`/auth${search}`} replace />;
  }
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) return null;
  if (user) {
    // Resume the originally-requested route ONLY when it is a safe deep-link.
    // Otherwise default to /studio (3D viewport principal) so first-time
    // signups / Google sign-ins land directly on the editor — never on Office.
    const raw = params.get('next');
    const safe =
      raw &&
      raw.startsWith('/') &&
      !raw.startsWith('//') &&
      raw !== '/' &&
      !raw.startsWith('/auth') &&
      !raw.startsWith('/landing');
    const target = safe ? raw! : '/studio';
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
}

function RouteTracker() {
  useRouteTracing();
  return null;
}

function App() {
  useHardwareSyncLoop(44);
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Suspense fallback={null}>
              <SonnerToaster />
            </Suspense>
            <BrowserRouter>
              <RouteTracker />
              <PageTransitionOverlay />
              <UpgradeDialog />
              {IS_DEV && (
                <Suspense fallback={null}>
                  <PlaybackProfilerPanel />
                </Suspense>
              )}
              <LazyChunkBoundary>
                <Suspense fallback={<RouteLoaderWithTimeout />}>
                  <Routes>
                    <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                    <Route path="/install" element={<Install />} />
                    {/* Public diagnostics — intentionally outside ProtectedRoute so it can
                        be opened without login while debugging Live Firing / DMX issues. */}
                    <Route path="/diagnostics/dmx-pyro" element={<DmxPyroDiagnostics />} />
                    {/* Public real-hardware discovery probe — loops scanLight() and shows
                        every device the browser sees, with zero simulated data. */}
                    <Route path="/dev/real-discovery" element={<RealDiscoveryProbe />} />
                    {/* FXK16 hardware validation harness — Web Serial / BLE,
                        hold-to-fire per channel, diagnostic-only (bypasses ShowPlan). */}
                    <Route path="/dev/fxk16-validate" element={<FXK16ValidatePage />} />
                    {/* FXK16 calibration & diagnostics — handshake card, detected-channel
                        count, manual hold-to-fire and armed auto-sweep C1..C16. */}
                    <Route path="/dev/fxk16-calibrate" element={<FXK16CalibrationPage />} />
                    {/* Public SkyCanvas smoke route — mounts the 3D viewport in
                        isolation for E2E QA. No auth, no hardware, no ARM. */}
                    <Route path="/dev/skycanvas-smoke" element={<SkyCanvasSmoke />} />
                    {/* FXKONTROL DS v1 — public reference page (tokens, segments, status,
                        components, states). No hardware, no auth. */}
                    <Route path="/dev/design-system" element={<DesignSystemShowcase />} />
                    {/* Live demo of <EditorShell> w/ DS components — pure presentation. */}
                    <Route path="/dev/editor-shell" element={<EditorShellPreview />} />
                    {/* Public alias — promoted shell route. */}
                    <Route path="/editor-ds" element={<EditorShellPreview />} />
                    {/* Public legal pages — required by Paddle (Merchant of Record) and must be crawlable without auth. */}
                    <Route path="/legal/terms" element={<Terms />} />
                    <Route path="/legal/refund" element={<Refund />} />
                    <Route path="/legal/privacy" element={<Privacy />} />
                    {/* Public pricing — must be reachable without login (marketing + Paddle compliance). */}
                    <Route path="/pricing" element={<Pricing />} />
                    {/* Public marketing landing — Apple-style HTML served via iframe; CTAs navigate parent SPA. */}
                    <Route path="/landing" element={<Landing />} />
                    {/* Public brand manifesto — positioning, key messages, tone of voice. */}
                    <Route path="/manifesto" element={<Manifesto />} />
                    {/* Public commercial deck — B2B sales narrative for premium producers
                        (Previs / LiveOps / Enterprise + GO/NO-GO + 90d roadmap). Uses
                        data-theme="commercial" tokens isolated from operational palette. */}
                    <Route path="/comercial" element={<Comercial />} />
                    <Route path="/pitch/us" element={<PitchUS />} />
                    <Route path="/unsubscribe" element={<Unsubscribe />} />
                    {/* Checkout success — auth-gated but standalone (no MainLayout chrome) so the
                        confirmation screen is the only thing visible while the webhook lands. */}
                    <Route path="/checkout/success" element={<ProtectedRoute><CheckoutSuccess /></ProtectedRoute>} />
                    <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                      {/* ── 3 grandes áreas ───────────────────────────────────── */}
                      {/* Default landing → Studio 3D viewport (entrada principal). */}
                      <Route path="/" element={<Navigate to="/studio" replace />} />
                      <Route path="/office" element={<Office />} />
                      {/* Studio = editor 3D. /editor é endpoint equivalente (mesma página). */}
                      <Route path="/studio" element={<Index />} />
                      <Route path="/editor" element={<Index />} />
                      <Route path="/editor/:showId" element={<Index />} />
                      <Route path="/command" element={<CommandCenter />} />
                      <Route path="/strategy" element={<Strategy />} />

                      {/* ── Create flow (Action Layer) ────────────────────────── */}
                      <Route path="/create" element={<Create />} />
                      <Route path="/create/blank" element={<CreateBlank />} />
                      <Route path="/create/template" element={<CreateTemplate />} />
                      <Route path="/create/generate" element={<CreateGenerate />} />


                      {/* ── Redirects: rotas antigas → nova estrutura ─────────── */}
                      <Route path="/agenda" element={<Navigate to="/office?tab=agenda" replace />} />
                      <Route path="/training" element={<Navigate to="/office?tab=training" replace />} />
                      <Route path="/admin" element={<Navigate to="/office?tab=compliance" replace />} />
                      <Route path="/accreditation" element={<Navigate to="/office?tab=documents" replace />} />
                      <Route path="/joi" element={<Navigate to="/office?tab=joi" replace />} />

                      {/* ── Field ops (gated) ─────────────────────────────────── */}
                      <Route path="/field" element={isEnabled('module_pairing_mobilelink') ? <FieldOps /> : <Navigate to="/office" replace />} />
                      <Route path="/pairing" element={isEnabled('module_pairing_mobilelink') ? <Navigate to="/field#pairing" replace /> : <Navigate to="/office" replace />} />
                      {/* iOS-first guided USB authorization wizard. */}
                      <Route path="/pairing/usb" element={<UsbPairingWizard />} />
                      {/* BLE pairing wizard — scans for FXK16-XXXXXX, performs
                          handshake (VERSION+STATUS), shows per-attempt status. */}
                      <Route path="/pairing/ble" element={<BlePairingWizard />} />
                      <Route path="/field-test" element={isEnabled('module_pairing_mobilelink') ? <Navigate to="/field#field-test" replace /> : <Navigate to="/office" replace />} />
                      <Route path="/fxk16" element={isEnabled('module_pairing_mobilelink') ? <Navigate to="/field#fxk16" replace /> : <Navigate to="/office" replace />} />

                      {/* ── Settings & sistema ────────────────────────────────── */}
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/settings/network" element={<NetworkSettings />} />
                      <Route path="/platform-status" element={<PlatformStatus />} />
                      <Route path="/ai-builder" element={<AIBuilder />} />
                      {/* Legacy AI entry points → consolidated under /ai-builder */}
                      <Route path="/swarmgpt" element={<Navigate to="/ai-builder" replace />} />
                      <Route path="/ai-choreography" element={<Navigate to="/ai-builder" replace />} />
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
