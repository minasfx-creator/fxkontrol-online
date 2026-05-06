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
import { startDiscoveryRegistryBridge } from "@/core/hardware/discoveryRegistryBridge";

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
const PairingWizard = lazy(lazyRetry(() => import("./pages/PairingWizard")));
const RealDiscoveryProbe = lazy(lazyRetry(() => import("./pages/RealDiscoveryProbe")));

// SkyCanvas dev lab — unified harness for smoke / r3f / v2 variants.
// Substitui as 3 rotas dev (/dev/skycanvas-{smoke,3d,2}) com um único
// chunk lazy + toggle de variante na própria UI (Rodada 6).
const SkyCanvasLab = lazy(lazyRetry(() => import("./pages/dev/SkyCanvasLab")));
const UE5BridgePage = lazy(lazyRetry(() => import("./pages/dev/UE5BridgePage")));
const VideoEditor = lazy(lazyRetry(() => import("./pages/VideoEditor")));
const SkyCanvasPage = lazy(lazyRetry(() => import("./pages/SkyCanvas")));
const DesignSystemShowcase = lazy(lazyRetry(() => import("./pages/dev/DesignSystemShowcase")));
const EditorShellPreview = lazy(lazyRetry(() => import("./pages/dev/EditorShellPreview")));
const ReadinessAudit = lazy(lazyRetry(() => import("./pages/dev/ReadinessAudit")));
const ModuleRoster = lazy(lazyRetry(() => import("./pages/dev/ModuleRoster")));
const E2ETestPage = lazy(lazyRetry(() => import("./pages/dev/E2ETestPage")));
const GoldenShowsCatalog = lazy(lazyRetry(() => import("./pages/dev/GoldenShows")));

const FXK16Hub = lazy(lazyRetry(() => import("./pages/dev/FXK16Hub")));
const DevIndex = lazy(lazyRetry(() => import("./pages/dev/DevIndex")));

// Office — consolidated productivity area (Etapa 1 do refactor 3-áreas)
const Office = lazy(lazyRetry(() => import("./pages/Office")));

// Create-flow (Action Layer) — Blueprint UX entry funnel
const Create = lazy(lazyRetry(() => import("./pages/Create")));
const CreateBlank = lazy(lazyRetry(() => import("./pages/create/CreateBlank")));
const CreateTemplate = lazy(lazyRetry(() => import("./pages/create/CreateTemplate")));
const CreateGenerate = lazy(lazyRetry(() => import("./pages/create/CreateGenerate")));

// Lazy-loaded heavy pages
// NOTE: legacy `pages/Index.tsx` aposentado na Rodada 4. /studio, /editor e
// /editor/:showId agora redirecionam para /skycanvas (surface canônica DS v1).
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
const TrainingCenter = lazy(lazyRetry(() => import("./pages/TrainingCenter")));
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
    // New pipeline: post-auth, land on Office Dashboard (overview tab) so the
    // user always starts from the central hub. Safe deep-links are honored.
    const raw = params.get('next');
    const safe =
      raw &&
      raw.startsWith('/') &&
      !raw.startsWith('//') &&
      raw !== '/' &&
      !raw.startsWith('/auth') &&
      !raw.startsWith('/landing');
    const target = safe ? raw! : '/office?tab=overview';
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
  // Boot the Discovery → Registry bridge once. Idempotent.
  // Promotes FXK16ModuleAdapter provenance on real handshake.
  startDiscoveryRegistryBridge();
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
                    {/* Public dev hub — visual index of all dev surfaces. */}
                    <Route path="/dev" element={<DevIndex />} />
                    {/* Public real-hardware discovery probe — loops scanLight() and shows
                        every device the browser sees, with zero simulated data. */}
                    <Route path="/dev/real-discovery" element={<RealDiscoveryProbe />} />
                    {/* FXK16 unified dev hub — Validate (harness) + Calibrate (latency)
                        as tabs. Old paths redirect to ?tab=validate|calibrate. */}
                    <Route path="/dev/fxk16" element={<FXK16Hub />} />
                    <Route path="/dev/fxk16-validate" element={<Navigate to="/dev/fxk16?tab=validate" replace />} />
                    <Route path="/dev/fxk16-calibrate" element={<Navigate to="/dev/fxk16?tab=calibrate" replace />} />
                    {/* SkyCanvas dev lab — variantes smoke / r3f / v2 sob um único
                        chunk lazy. Rotas legadas redirecionam preservando a variante. */}
                    <Route path="/dev/skycanvas-lab" element={<SkyCanvasLab />} />
                    <Route path="/dev/skycanvas-smoke" element={<Navigate to="/dev/skycanvas-lab?v=smoke" replace />} />
                    <Route path="/dev/skycanvas-3d" element={<Navigate to="/dev/skycanvas-lab?v=r3f" replace />} />
                    <Route path="/dev/skycanvas-2" element={<Navigate to="/dev/skycanvas-lab?v=v2" replace />} />
                    {/* UE5 Bridge — inspector dos catálogos importados (MVR/Niagara/MRP). */}
                    <Route path="/dev/ue5-bridge" element={<UE5BridgePage />} />
                    {/* Reference Video Editor surface — sidebars + 3D viewport + timeline. */}
                    <Route path="/dev/video-editor" element={<VideoEditor />} />
                    {/* FXKONTROL DS v1 — public reference page (tokens, segments, status,
                        components, states). No hardware, no auth. */}
                    <Route path="/dev/design-system" element={<DesignSystemShowcase />} />
                    {/* Live demo of <EditorShell> w/ DS components — pure presentation. */}
                    <Route path="/dev/editor-shell" element={<EditorShellPreview />} />
                    {/* Phase 0 deployment plan instrument — read-only consolidated
                        view of VerificationEngine + ReadinessEvaluator + Hardware
                        Registry with adapter provenance. No commands sent. */}
                    <Route path="/dev/readiness-audit" element={<ReadinessAudit />} />
                    <Route path="/dev/module-roster" element={<ModuleRoster />} />
                    <Route path="/dev/e2e-test" element={<E2ETestPage />} />
                    {/* Phase 1 golden show inspector — pure read of the
                        Libertadores ShowPlan + PDF + honest export ZIP. */}
                    <Route path="/dev/libertadores" element={<Navigate to="/dev/golden-shows" replace />} />
                    <Route path="/dev/golden-shows" element={<GoldenShowsCatalog />} />
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
                    {/* Root entry: nunca mostra landing — manda direto pro auth.
                        AuthRoute redireciona usuários já logados pra /office?tab=overview. */}
                    <Route path="/" element={<Navigate to="/auth" replace />} />
                    <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                      {/* ── 3 grandes áreas ───────────────────────────────────── */}
                      <Route path="/office" element={<Office />} />
                      {/* Studio = editor 3D. /editor é endpoint equivalente (mesma página). */}
                      {/* Studio/editor → SkyCanvas (Rodada 4: Index.tsx legado aposentado). */}
                      <Route path="/studio" element={<Navigate to="/skycanvas" replace />} />
                      <Route path="/editor" element={<Navigate to="/skycanvas" replace />} />
                      <Route path="/editor/:showId" element={<Navigate to="/skycanvas" replace />} />
                      <Route path="/command" element={<CommandCenter />} />
                      <Route path="/strategy" element={<Strategy />} />
                      {/* SkyCanvas v3 — surface canônica, capability-driven, isolada do Index.tsx pesado. */}
                      <Route path="/skycanvas" element={<SkyCanvasPage />} />
                      <Route path="/training/center" element={<TrainingCenter />} />

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
                      {/* Unified pairing wizard — single configurable route.
                          /pairing/usb and /pairing/ble are kept as direct routes
                          for backward-compat (deep links, audit log entries). */}
                      <Route path="/pairing/:transport" element={<PairingWizard />} />
                      <Route path="/pairing/usb" element={<UsbPairingWizard />} />
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
