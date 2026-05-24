import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation, useSearchParams } from "react-router-dom";

// Use HashRouter in Electron (file:// protocol) so routing works without a server.
// BrowserRouter is used for the web version (Lovable, Vercel, etc).
const AppRouter = (window as any).electronBridge ? HashRouter : BrowserRouter;
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { lazy, Suspense } from "react";
import MainLayout from "@/layouts/MainLayout";
import PageTransitionOverlay from "@/components/ui/PageTransitionOverlay";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy-loaded heavy pages
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
            <AppRouter>
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
                    {/* FXK32Q dev hub — Control (bench) + Snapshot (read-only adapter). */}
                    <Route path="/dev/fxk32q" element={<FXK32QHub />} />
                    <Route path="/dev/fxk32" element={<Navigate to="/dev/fxk32q" replace />} />
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
                    {/* Forensic, read-only view of the unified Safety Black Box
                        (hash-chained gate verdicts). Never arms; never writes. */}
                    <Route path="/dev/blackbox-inspector" element={<BlackBoxInspector />} />
                    <Route path="/dev/cue-conflicts" element={<CueConflictsPage />} />
                    <Route path="/dev/addressing" element={<AddressingPage />} />
                    <Route path="/dev/perf-bench" element={<PerfBenchPage />} />
                    <Route path="/dev/effects-libraries" element={<EffectsLibrariesPage />} />
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
                      <Route path="/pairing/xl4" element={<FireOneXL4PairingWizard />} />
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
            </AppRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
  );
}

export default App;
