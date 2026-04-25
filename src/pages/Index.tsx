import React, { lazy, Suspense, useState, useCallback, useEffect, Component, type ReactNode, type ErrorInfo } from 'react';
import { lazyRetry } from '@/lib/lazyRetry';
import { commandBus } from '@/core/command/CommandBus';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '@/store/useProjectStore';
import { useUndoKeyboard } from '@/hooks/useUndoKeyboard';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEditorKeyboardShortcuts } from '@/hooks/useEditorKeyboardShortcuts';
import { useViewportDrop } from '@/hooks/useViewportDrop';
import { Upload, ChevronDown, ChevronLeft, ChevronRight, Sparkles, Paintbrush, Cog, X, RotateCcw } from 'lucide-react';
import ViewportNavControls from '@/components/editor/ViewportNavControls';
import { useDisplayStore } from '@/store/useDisplayStore';
import type { WorldShowPreset } from '@/data/worldShowPresets';
import PanelTabBar, { type PanelId } from '@/components/editor/PanelTabBar';
import { type MobileTab } from '@/components/editor/MobileTabBar';
import { loadTimelineView, saveTimelineView } from '@/lib/timelineViewState';

// ── Critical-path (static): shell chrome loaded immediately ──
import Toolbar from '@/components/editor/Toolbar';
import CrashRecoveryBanner from '@/components/editor/CrashRecoveryBanner';
import BoxSelectOverlay from '@/components/editor/BoxSelectOverlay';
import SelectionModeBar from '@/components/editor/SelectionModeBar';
import RadialMenu from '@/components/editor/RadialMenu';
import EngineProvider from '@/orchestration/EngineProvider';
import LiveCard from '@/components/editor/LiveCard';

// ── Lazy helper — one-liner for 80+ panels ──
const lz = (loader: () => Promise<{ default: React.ComponentType<any> }>) => lazy(loader);

// ── Verification ──


// ── Phase screens ──
const CinematicIntro = lz(() => import('@/components/editor/CinematicIntro'));
const SplashScreen = lz(() => import('@/components/editor/SplashScreen'));

// ── Core editor components (loaded on first interaction) ──
const Timeline = lz(() => import('@/components/editor/Timeline'));
const EffectLibrary = lz(() => import('@/components/editor/EffectLibrary'));
const PropertiesPanel = lz(() => import('@/components/editor/PropertiesPanel'));
const GeoLocationSetup = lz(() => import('@/components/editor/GeoLocationSetup'));
const ViewportTransitionOverlay = lz(() => import('@/components/editor/ViewportTransitionOverlay'));

const SmartScriptAssistant = lz(() => import('@/components/editor/SmartScriptAssistant'));
const ShortcutsOverlay = lz(() => import('@/components/editor/PopupEditors').then(m => ({ default: m.ShortcutsOverlay })));

// ── Mobile shell ──
const MobileTabBar = lz(() => import('@/components/editor/MobileTabBar'));
const MobileFloatingPanel = lz(() => import('@/components/editor/MobileFloatingPanel'));
const UnifiedPanelMenu = lz(() => import('@/components/editor/UnifiedPanelMenu'));
const MobileHUD = lz(() => import('@/components/editor/MobileHUD'));
const MobileQuickActions = lz(() => import('@/components/editor/MobileQuickActions'));
const LiveModeOverlay = lz(() => import('@/components/editor/LiveModeOverlay'));
const MobileConsoleFullscreen = lz(() => import('@/components/editor/MobileConsoleFullscreen'));
const MobileWelcomeScreen = lz(() => import('@/components/editor/MobileWelcomeScreen'));

// ── All panels — loaded on-demand only when opened ──
const PositionWindow = lz(() => import('@/components/editor/PositionWindow'));
const ScriptWindow = lz(() => import('@/components/editor/ScriptWindow'));
const EffectEditor = lz(() => import('@/components/editor/EffectEditor'));
const WindCameraPanel = lz(() => import('@/components/editor/WindCameraPanel'));
const ReportsPanel = lz(() => import('@/components/editor/ReportsPanel'));
const RackManager = lz(() => import('@/components/editor/RackManager'));
const AddressingPanel = lz(() => import('@/components/editor/AddressingPanel'));
const InventoryPanel = lz(() => import('@/components/editor/InventoryPanel'));
const WaypointEditor = lz(() => import('@/components/editor/WaypointEditor'));
const BoidsPanel = lz(() => import('@/components/editor/BoidsPanel'));
const PIDPanel = lz(() => import('@/components/editor/PIDPanel'));
const DMXPanel = lz(() => import('@/components/editor/dmx/DMXPanel'));
const BatteryPanel = lz(() => import('@/components/editor/BatteryPanel'));
const MAVLinkPanel = lz(() => import('@/components/editor/MAVLinkPanel'));
const SMPTEPanel = lz(() => import('@/components/editor/SMPTEPanel'));
const GoogleMapsPanel = lz(() => import('@/components/editor/GoogleMapsPanel'));
const DiagnosticPanel = lz(() => import('@/components/editor/DiagnosticPanel'));
const QAStudioPanel = lz(() => import('@/components/editor/QAStudioPanel'));
const LogisticsPanel = lz(() => import('@/components/editor/LogisticsPanel'));
// SwarmGPT centralized at /swarmgpt — no longer a modal panel here.
const SynesthesiaPanel = lz(() => import('@/components/editor/SynesthesiaPanel'));
const FiringExportPanel = lz(() => import('@/components/editor/FiringExportPanel'));
const LabelsPanel = lz(() => import('@/components/editor/LabelsPanel'));
const VideoRecorderPanel = lz(() => import('@/components/editor/VideoRecorderPanel'));
const ModelImportPanel = lz(() => import('@/components/editor/ModelImportPanel'));
const SupplierCatalogPanel = lz(() => import('@/components/editor/SupplierCatalogPanel'));
const SafetyPanel = lz(() => import('@/components/editor/SafetyPanel'));
const ScriptingToolsPanel = lz(() => import('@/components/editor/ScriptingToolsPanel'));
const AudienceAnalyzerPanel = lz(() => import('@/components/editor/AudienceAnalyzerPanel'));
const IndoorSimPanel = lz(() => import('@/components/editor/IndoorSimPanel'));
const ChainEditorPanel = lz(() => import('@/components/editor/ChainEditorPanel'));
const PositionGroupsPanel = lz(() => import('@/components/editor/PositionGroupsPanel'));
const SceneEditorPanel = lz(() => import('@/components/editor/SceneEditorPanel'));
const SoundLevelPanel = lz(() => import('@/components/editor/SoundLevelPanel'));
const AROverlayPanel = lz(() => import('@/components/editor/AROverlayPanel'));
const ShowSharePanel = lz(() => import('@/components/editor/ShowSharePanel'));
const ParticleEditorPanel = lz(() => import('@/components/editor/ParticleEditorPanel'));
const VersioningPanel = lz(() => import('@/components/editor/VersioningPanel'));
const WeatherPanel = lz(() => import('@/components/editor/WeatherPanel'));
const CollisionPanel = lz(() => import('@/components/editor/CollisionPanel'));
const ClientApprovalPanel = lz(() => import('@/components/editor/ClientApprovalPanel'));
const TrajectoryOptimizerPanel = lz(() => import('@/components/editor/TrajectoryOptimizerPanel'));
const ShowTemplatesPanel = lz(() => import('@/components/editor/ShowTemplatesPanel'));
const TelemetryDashboard = lz(() => import('@/components/editor/TelemetryDashboard'));
const FlightLogPanel = lz(() => import('@/components/editor/FlightLogPanel'));
const TemplateMarketplace = lz(() => import('@/components/editor/TemplateMarketplace'));
const SiteLayoutPanel = lz(() => import('@/components/editor/SiteLayoutPanel'));
const ShowSettingsPanel = lz(() => import('@/components/editor/ShowSettingsPanel'));
const ManufacturerCalibrationPanel = lz(() => import('@/components/editor/ManufacturerCalibrationPanel'));
const LiveFiringPanel = lz(() => import('@/components/editor/LiveFiringPanel'));
const FleetManagementPanel = lz(() => import('@/components/editor/FleetManagementPanel'));
const GeofencePanel = lz(() => import('@/components/editor/GeofencePanel'));
const StoryboardPanel = lz(() => import('@/components/editor/StoryboardPanel'));

const ShowInspectorPanel = lz(() => import('@/components/editor/ShowInspectorPanel'));
const LightProgramPanel = lz(() => import('@/components/editor/LightProgramPanel'));
const FlightCheckTab = lz(() => import('@/components/editor/safety/FlightCheckTab'));
const TakeoffGridPanel = lz(() => import('@/components/editor/TakeoffGridPanel'));
const TransitionPlannerPanel = lz(() => import('@/components/editor/TransitionPlannerPanel'));
const LaserControlPanel = lz(() => import('@/components/editor/LaserControlPanel'));
const USBConnectionPanel = lz(() => import('@/components/editor/USBConnectionPanel'));
const VideoChoreoPanel = lz(() => import('@/components/editor/VideoChoreoPanel'));
const ShowvenEquipmentPanel = lz(() => import('@/components/editor/ShowvenEquipmentPanel'));
const GenerativeEffectsPanel = lz(() => import('@/components/editor/GenerativeEffectsPanel'));
const SetlistPanel = lz(() => import('@/components/editor/SetlistPanel'));
const RiderPanel = lz(() => import('@/components/editor/RiderPanel'));
const BudgetPanel = lz(() => import('@/components/editor/BudgetPanel'));
const ShowPreviewPanel = lz(() => import('@/components/editor/ShowPreviewPanel'));
const MobileLinkPanel = lz(() => import('@/components/editor/MobileLinkPanel'));
const MobileLinkMonitor = lz(() => import('@/components/editor/MobileLinkMonitor'));
const SiteModelsPanel = lz(() => import('@/components/editor/SiteModelsPanel'));
const VirtualControllerHub = lz(() => import('@/components/editor/VirtualControllerHub'));
const FieldMap2D = lz(() => import('@/components/editor/FieldMap2D'));
const ShowCommanderPanel = lz(() => import('@/components/editor/ShowCommanderPanel'));
const BluetoothPanel = lz(() => import('@/components/editor/BluetoothPanel'));
const NFCPairPanel = lz(() => import('@/components/editor/NFCPairPanel'));
const DMXOutputPanel = lz(() => import('@/components/editor/dmx/DMXOutputPanel'));
const RemoteControlPanel = lz(() => import('@/components/editor/RemoteControlPanel'));
const ConnectionManagerPanel = lz(() => import('@/components/editor/ConnectionManagerPanel'));
const RadioControlPanel = lz(() => import('@/components/editor/RadioControlPanel'));
const MA3ControlPanel = lz(() => import('@/components/editor/MA3ControlPanel'));
const SACNMonitorPanel = lz(() => import('@/components/editor/SACNMonitorPanel'));
const EasyConnectPanel = lz(() => import('@/components/editor/EasyConnectPanel'));
const VenueQuickSelector = lz(() => import('@/components/editor/VenueQuickSelector'));
const VenueShowOverlay = lz(() => import('@/components/editor/VenueShowOverlay'));

// SkyCanvas: wrapped with lazyRetry so stale-chunk errors after deploy/HMR
// trigger a single auto-reload (handled by LazyChunkBoundary in App.tsx).
// Do NOT add a .catch() here — it would swallow the error and prevent retry.
const SkyCanvas = lazy(lazyRetry(() => import('@/components/editor/SkyCanvas')));

interface CanvasErrorState {
  hasError: boolean;
  error?: Error;
  componentStack?: string;
  extras: string[]; // captured window errors / unhandled rejections
}

class CanvasErrorBoundary extends Component<{ children: ReactNode }, CanvasErrorState> {
  state: CanvasErrorState = { hasError: false, extras: [] };
  private onWindowError = (e: ErrorEvent) => {
    const line = `[window.error] ${e.message} @ ${e.filename}:${e.lineno}:${e.colno}${e.error?.stack ? '\n' + e.error.stack : ''}`;
    this.setState((s) => ({ ...s, extras: [...s.extras, line].slice(-20) }));
  };
  private onRejection = (e: PromiseRejectionEvent) => {
    const reason = e.reason;
    const text = reason instanceof Error ? `${reason.message}\n${reason.stack ?? ''}` : String(reason);
    this.setState((s) => ({ ...s, extras: [...s.extras, `[unhandledrejection] ${text}`].slice(-20) }));
  };
  componentDidMount() {
    window.addEventListener('error', this.onWindowError);
    window.addEventListener('unhandledrejection', this.onRejection);
  }
  componentWillUnmount() {
    window.removeEventListener('error', this.onWindowError);
    window.removeEventListener('unhandledrejection', this.onRejection);
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[FXK] Canvas failed to load:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? undefined });
  }
  private copyReport = async () => {
    const { error, componentStack, extras } = this.state;
    const report = [
      `FX Kontrol — SkyCanvas Error Report`,
      `When: ${new Date().toISOString()}`,
      `UA: ${navigator.userAgent}`,
      ``,
      `== Error ==`,
      error?.message ?? '(no message)',
      ``,
      `== Stack ==`,
      error?.stack ?? '(no stack)',
      ``,
      `== Component Stack ==`,
      componentStack ?? '(none)',
      ``,
      `== Window Events ==`,
      extras.length ? extras.join('\n\n') : '(none)',
    ].join('\n');
    try { await navigator.clipboard.writeText(report); } catch { /* ignore */ }
  };
  render() {
    if (this.state.hasError) {
      const { error, componentStack, extras } = this.state;
      return (
        <div className="w-full h-full flex flex-col bg-background text-foreground overflow-auto p-4 gap-3 font-mono text-[11px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-destructive">SkyCanvas crashed</p>
              <p className="text-[10px] text-muted-foreground">React/Three.js error captured below — share with support.</p>
            </div>
            <div className="flex gap-2">
              <button
                className="px-2 py-1 rounded border border-border bg-card hover:bg-accent text-[10px]"
                onClick={this.copyReport}
              >Copy report</button>
              <button
                className="px-2 py-1 rounded border border-border bg-card hover:bg-accent text-[10px]"
                onClick={() => this.setState({ hasError: false, error: undefined, componentStack: undefined })}
              >Retry</button>
              <button
                className="px-2 py-1 rounded border border-border bg-card hover:bg-accent text-[10px]"
                onClick={() => window.location.reload()}
              >Reload</button>
            </div>
          </div>

          <section className="border border-border rounded p-2 bg-card/40">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Error</p>
            <p className="text-destructive whitespace-pre-wrap break-words">{error?.message ?? '(no message)'}</p>
          </section>

          <section className="border border-border rounded p-2 bg-card/40">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Stack trace</p>
            <pre className="whitespace-pre-wrap break-words text-muted-foreground">{error?.stack ?? '(no stack available)'}</pre>
          </section>

          <section className="border border-border rounded p-2 bg-card/40">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">React component stack</p>
            <pre className="whitespace-pre-wrap break-words text-muted-foreground">{componentStack ?? '(none — error thrown outside React tree)'}</pre>
          </section>

          {extras.length > 0 && (
            <section className="border border-border rounded p-2 bg-card/40">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Window errors / promise rejections ({extras.length})</p>
              <pre className="whitespace-pre-wrap break-words text-muted-foreground">{extras.join('\n\n')}</pre>
            </section>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

function PanelLoader() {
  return (
    <div className="w-full h-32 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function CanvasLoader() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-muted-foreground font-mono">Loading 3D Engine...</p>
      </div>
    </div>
  );
}

// Drop extensions and logic moved to useViewportDrop hook

/* ── Nav Controls extracted to src/components/editor/ViewportNavControls.tsx ── */

/* ══════════════════════════════════════════════════════════════════
   INDEX — Immersive Full-Viewport Layout
   ══════════════════════════════════════════════════════════════════ */
function Index() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const [venueSelector, setVenueSelector] = useState(false);
  const [venueOverlay, setVenueOverlay] = useState<WorldShowPreset | null>(null);
  const [appPhase, setAppPhase] = useState<'cinematic' | 'splash' | 'editor'>('editor');
  const [showGeoSetup, setShowGeoSetup] = useState(false);
  const [showPositionEditor, setShowPositionEditor] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab | null>(null);
  const [smartScriptOpen, setSmartScriptOpen] = useState(false);
  const [mobilePanelHeight, setMobilePanelHeight] = useState<'collapsed' | 'half' | 'full'>('collapsed');
  const [isDragOver, setIsDragOver] = useState(false);
  const [remoteMode, setRemoteMode] = useState<'cloud' | 'wifi-auto'>('cloud');
  const [timelineCollapsed, setTimelineCollapsed] = useState(() => {
    // Defensive: storage may throw (private mode, SecurityError) — never block mount.
    try { return loadTimelineView().collapsed ?? false; } catch { return false; }
  });
  useEffect(() => {
    try { saveTimelineView({ collapsed: timelineCollapsed }); } catch { /* noop */ }
  }, [timelineCollapsed]);
  const [viewportMaximized, setViewportMaximized] = useState(false);
  const [leftDockOpen, setLeftDockOpen] = useState<string | null>('effects');
  const [showMobileWelcome, setShowMobileWelcome] = useState(() => {
    if (!isMobile) return false;
    try { return localStorage.getItem('fxk-mobile-location-set') !== '1'; } catch { return true; }
  });
  const selectedPositionId = useProjectStore(s => s.selectedPositionId);
  const operationMode = useDisplayStore(s => s.operationMode);
  const nightMode = useDisplayStore(s => s.nightMode);
  useUndoKeyboard();

  // Wire CommandBus → local UI state
  useEffect(() => {
    const unsubs = [
      commandBus.on('OPEN_PANEL', (cmd) => {
        if (cmd.type === 'OPEN_PANEL') setActivePanel(cmd.panel as PanelId);
      }),
      commandBus.on('CLOSE_PANEL', () => setActivePanel(null)),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  // Apply night-mode class to root element
  useEffect(() => {
    document.documentElement.classList.toggle('night-mode', nightMode);
    return () => document.documentElement.classList.remove('night-mode');
  }, [nightMode]);

  // Keyboard shortcuts (extracted to hook)
  useEditorKeyboardShortcuts({
    selectedPositionId, activePanel, viewportMaximized,
    setShowPositionEditor, setShowShortcuts, setSmartScriptOpen, setViewportMaximized,
  });

  // Drag-drop (extracted to hook)
  const { onDragOver, onDragLeave, onDrop } = useViewportDrop(setIsDragOver);

  // Deep-link: auto-open panel from ?panel= query param
  useEffect(() => {
    const panelParam = searchParams.get('panel');
    const modeParam = searchParams.get('mode');
    if (panelParam) {
      // SwarmGPT lives at /swarmgpt now — redirect any legacy deep links.
      if (panelParam === 'swarmgpt') {
        setSearchParams({}, { replace: true });
        navigate('/swarmgpt');
        return;
      }
      setActivePanel(panelParam as PanelId);
      if (modeParam === 'wifi') setRemoteMode('wifi-auto');
      else if (modeParam === 'cloud') setRemoteMode('cloud');
      setSearchParams({}, { replace: true });
      setAppPhase('editor');
      if (window.innerWidth < 768) {
        setMobileTab(null);
        setMobilePanelHeight('full');
      }
    }
  }, [searchParams, setSearchParams, navigate]);

  useEffect(() => {
    const dblClickHandler = () => setShowPositionEditor(true);
    window.addEventListener('position-double-click', dblClickHandler);
    return () => window.removeEventListener('position-double-click', dblClickHandler);
  }, []);

  const SHARED_PANEL_IDS = new Set(['effects', 'scene', 'showsettings']);

  const handleTogglePanel = useCallback((id: PanelId) => {
    // Intercept worldshows — open VenueQuickSelector instead of panel
    if (id === 'worldshows') {
      setVenueSelector(true);
      return;
    }
    // SwarmGPT is now a dedicated page — navigate instead of opening modal.
    if (id === 'swarmgpt') {
      navigate('/swarmgpt');
      return;
    }
    setActivePanel((prev) => {
      const next = prev === id ? null : id;
      if (next && SHARED_PANEL_IDS.has(next)) setLeftDockOpen(null);
      return next;
    });
  }, [navigate]);

  const handleLocationSelected = useCallback((location: { name: string; lat: number; lng: number }) => {
    useProjectStore.getState().setGpsOrigin({ lat: location.lat, lng: location.lng, heading: 0, altitude: 0 });
    window.dispatchEvent(new CustomEvent('box-select-active', { detail: false }));
    setAppPhase('editor');
    setShowGeoSetup(false);
  }, []);

  useEffect(() => {
    const handler = () => setShowGeoSetup(true);
    window.addEventListener('open-geo-setup', handler);
    return () => window.removeEventListener('open-geo-setup', handler);
  }, []);

  const handleMobileOpenPanel = useCallback((id: PanelId) => {
    if (id === 'swarmgpt') {
      navigate('/swarmgpt');
      return;
    }
    setActivePanel(id);
    setMobileTab(null);
    setMobilePanelHeight(id === 'effects' ? 'full' : 'half');
  }, [navigate]);

  const desktopTopOffset = '56px';
  const desktopTimelineHeight = viewportMaximized ? '0px' : timelineCollapsed ? '42px' : '34vh';
  const leftRailWidth = viewportMaximized ? 0 : 56;
  const leftSidebarWidth = viewportMaximized ? 0 : leftDockOpen === 'effects' ? 312 : 0;
  const leftOverlayWidth = viewportMaximized || !leftDockOpen || leftDockOpen === 'effects' ? 0 : 312;
  const rightDockWidth = viewportMaximized ? 0 : 52;
  const rightPanelWidth = activePanel && !viewportMaximized ? 472 : 0;
  const canvasLeftInset = `${leftRailWidth + leftSidebarWidth}px`;
  const canvasRightInset = `${rightDockWidth + rightPanelWidth}px`;
  const showLeftOverlayPanel = leftDockOpen === 'scene' || leftDockOpen === 'showsettings';

  if (appPhase === 'cinematic') return <Suspense fallback={<CanvasLoader />}><CinematicIntro onComplete={() => setAppPhase('splash')} /></Suspense>;
  if (appPhase === 'splash') return <Suspense fallback={<CanvasLoader />}><SplashScreen onStart={() => setAppPhase('editor')} showVideoBackground /></Suspense>;

  const renderPanelContent = () => {
    if (!activePanel) return null;
    return (
      <>
        {activePanel === 'positions' && <PositionWindow onClose={() => setActivePanel(null)} />}
        {activePanel === 'properties' && <PropertiesPanel />}
        {activePanel === 'script' && <ScriptWindow />}
        {activePanel === 'waypoints' && <WaypointEditor onClose={() => setActivePanel(null)} />}
        {activePanel === 'effects' && <EffectEditor onClose={() => setActivePanel(null)} />}
        {activePanel === 'wind' && <WindCameraPanel />}
        {activePanel === 'reports' && <ReportsPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'racks' && <RackManager onClose={() => setActivePanel(null)} />}
        {activePanel === 'addressing' && <AddressingPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'inventory' && <InventoryPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'boids' && <BoidsPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'pid' && <PIDPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'dmx' && <DMXPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'battery' && <BatteryPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'mavlink' && <MAVLinkPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'smpte' && <SMPTEPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'maps' && <GoogleMapsPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'diagnostic' && <DiagnosticPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'logistics' && <LogisticsPanel onClose={() => setActivePanel(null)} />}
        {/* swarmgpt moved to /swarmgpt route — no in-editor modal */}
        {activePanel === 'synesthesia' && <SynesthesiaPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'firing' && <FiringExportPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'labels' && <LabelsPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'video' && <VideoRecorderPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'models' && <ModelImportPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'suppliers' && <SupplierCatalogPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'safety' && <SafetyPanel />}
        {activePanel === 'scripting' && <ScriptingToolsPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'audience' && <AudienceAnalyzerPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'indoor' && <IndoorSimPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'chains' && <ChainEditorPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'groups' && <PositionGroupsPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'scene' && <SceneEditorPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'soundlevel' && <SoundLevelPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'aroverlay' && <AROverlayPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'share' && <ShowSharePanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'particles' && <ParticleEditorPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'versioning' && <VersioningPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'weather' && <WeatherPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'collisions' && <CollisionPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'approval' && <ClientApprovalPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'trajectory' && <TrajectoryOptimizerPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'templates' && <ShowTemplatesPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'telemetry' && <TelemetryDashboard onClose={() => setActivePanel(null)} />}
        {activePanel === 'flightlog' && <FlightLogPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'marketplace' && <TemplateMarketplace onClose={() => setActivePanel(null)} />}
        {activePanel === 'sitelayout' && <SiteLayoutPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'showsettings' && <ShowSettingsPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'calibration' && <ManufacturerCalibrationPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'livefiring' && <LiveFiringPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'fleet' && <FleetManagementPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'geofence' && <GeofencePanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'storyboard' && <StoryboardPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'showcontrol' && <ShowCommanderPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'inspector' && <ShowInspectorPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'lightprogram' && <LightProgramPanel />}
        {activePanel === 'safetycheck' && <FlightCheckTab />}
        {activePanel === 'takeoffgrid' && <TakeoffGridPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'transitions' && <TransitionPlannerPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'lasercontrol' && <LaserControlPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'usb' && <USBConnectionPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'videochoreo' && <VideoChoreoPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'showven' && <ShowvenEquipmentPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'generative' && <GenerativeEffectsPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'sitemodels' && <SiteModelsPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'setlist' && <SetlistPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'rider' && <RiderPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'budget' && <BudgetPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'showpreview' && <ShowPreviewPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'mobilelink' && <MobileLinkPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'linkmonitor' && <MobileLinkMonitor onClose={() => setActivePanel(null)} />}
        {activePanel === 'showcommander' && <ShowCommanderPanel onClose={() => setActivePanel(null)} onOpenPanel={(id) => setActivePanel(id as PanelId)} />}
        {activePanel === 'bluetooth' && <BluetoothPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'nfc' && <NFCPairPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'dmxoutput' && <DMXOutputPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'remotecontrol' && <RemoteControlPanel onClose={() => setActivePanel(null)} initialMode={remoteMode} />}
        {activePanel === 'controllers' && <VirtualControllerHub onClose={() => setActivePanel(null)} />}
        {activePanel === 'fieldmap' && <FieldMap2D onClose={() => setActivePanel(null)} />}
        {activePanel === 'connections' && <ConnectionManagerPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'radio' && <RadioControlPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'ma3' && <MA3ControlPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'sacnmonitor' && <SACNMonitorPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'easyconnect' && <EasyConnectPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'qastudio' && <QAStudioPanel onClose={() => setActivePanel(null)} />}
        
      </>
    );
  };

  // Console panels that open fullscreen landscape on mobile
  const CONSOLE_PANELS = new Set<PanelId>([
    'livefiring', 'controllers', 'dmx', 'showcommander', 'showcontrol',
    'dmxoutput', 'ma3', 'sacnmonitor', 'radio', 'remotecontrol',
    'fleet', 'telemetry', 'diagnostic', 'fieldmap',
  ]);

  const isConsolePanel = activePanel && CONSOLE_PANELS.has(activePanel);

  // ═══ MOBILE LAYOUT ═══
  if (isMobile) {
    const handleDismissPanel = () => { setMobileTab(null); setMobilePanelHeight('collapsed'); };
    if (operationMode === 'live') {
    return (
       <div className="absolute inset-0 w-full h-full overflow-hidden bg-background">
        <div className="absolute inset-0 w-full h-full br2049-atmosphere">
          <CanvasErrorBoundary><Suspense fallback={<CanvasLoader />}><SkyCanvas /></Suspense></CanvasErrorBoundary>
        </div>
        <LiveModeOverlay />
      </div>
      );
    }
    return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-background">
        <div className="absolute inset-0 w-full h-full">
          <CanvasErrorBoundary><Suspense fallback={<CanvasLoader />}><SkyCanvas key="mobile-skycanvas" /></Suspense></CanvasErrorBoundary>
          <BoxSelectOverlay />
        </div>

        {/* Welcome screen overlay */}
        {showMobileWelcome && (
          <Suspense fallback={null}>
            <MobileWelcomeScreen onComplete={(mode) => {
              setShowMobileWelcome(false);
              if (mode === 'search') setShowGeoSetup(true);
            }} />
          </Suspense>
        )}

        {!showMobileWelcome && (
          <>
            <MobileHUD />
            <MobileQuickActions panelOpen={mobilePanelHeight !== 'collapsed'} />
          </>
        )}

        <MobileFloatingPanel activeTab={mobileTab} height={mobilePanelHeight} onHeightChange={setMobilePanelHeight} onDismiss={handleDismissPanel} title={mobileTab === 'timeline' ? 'Timeline' : mobileTab === 'assets' ? 'Effects Library' : mobileTab === 'properties' ? 'Properties' : mobileTab === 'more' ? 'Painéis' : activePanel ?? undefined}>
          {mobileTab === 'timeline' && <Timeline />}
          {mobileTab === 'assets' && <EffectLibrary />}
          {mobileTab === 'properties' && <PropertiesPanel />}
          {mobileTab === 'more' && <UnifiedPanelMenu activePanel={activePanel} onSelectPanel={(id) => { handleMobileOpenPanel(id); setMobileTab(null); setMobilePanelHeight('full'); }} variant="sheet" onDismiss={handleDismissPanel} />}
          {mobileTab && !['timeline', 'assets', 'properties', 'more'].includes(mobileTab) && activePanel && !isConsolePanel && <Suspense fallback={<PanelLoader />}>{renderPanelContent()}</Suspense>}
        </MobileFloatingPanel>

        {/* Regular panels in floating sheet */}
        {activePanel && !isConsolePanel && mobileTab === null && mobilePanelHeight !== 'collapsed' && (
          <MobileFloatingPanel activeTab={'more' as MobileTab} height={mobilePanelHeight} onHeightChange={setMobilePanelHeight} onDismiss={handleDismissPanel} title={activePanel}>
            <Suspense fallback={<PanelLoader />}>{renderPanelContent()}</Suspense>
          </MobileFloatingPanel>
        )}

        {/* Console panels open fullscreen landscape */}
        {isConsolePanel && (
          <MobileConsoleFullscreen
            title={activePanel}
            onClose={() => { setActivePanel(null); setMobilePanelHeight('collapsed'); }}
          >
            <Suspense fallback={<PanelLoader />}>{renderPanelContent()}</Suspense>
          </MobileConsoleFullscreen>
        )}

        {/* Geo setup (mobile-adapted fullscreen) */}
        {showGeoSetup && <GeoLocationSetup onClose={() => setShowGeoSetup(false)} />}

        {!showMobileWelcome && (
          <MobileTabBar activeTab={mobileTab} onTabChange={setMobileTab} onOpenPanel={(id) => handleTogglePanel(id as PanelId)} panelHeight={mobilePanelHeight} onPanelHeightChange={setMobilePanelHeight} />
        )}
      </div>
    );
  }

  // ═══ DESKTOP LAYOUT — Full Immersive Viewport ═══
  return (
    <div className="absolute inset-0 overflow-hidden bg-background">
      <EngineProvider />
      {/* ─── Layer 0: Structured desktop shell ────────────── */}
      <div
        className="absolute z-0 br2049-atmosphere"
        style={{
          top: desktopTopOffset,
          left: canvasLeftInset,
          right: canvasRightInset,
          bottom: desktopTimelineHeight,
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="relative h-full w-full overflow-hidden border-x border-t border-border/20 bg-surface-0/95 shadow-2xl shadow-background/60">
          <div className="absolute inset-0 border border-border/10 pointer-events-none" />
          <div className="absolute inset-x-0 top-0 z-10 flex h-9 items-center justify-between border-b border-border/10 bg-surface-0/72 px-4 backdrop-blur-md pointer-events-none">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Sky Canvas
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
              Design Viewport
            </div>
          </div>
          <div className="absolute inset-0 top-9">
            <CanvasErrorBoundary>
              <Suspense fallback={<CanvasLoader />}>
                <SkyCanvas />
              </Suspense>
            </CanvasErrorBoundary>
            <BoxSelectOverlay />
            <SelectionModeBar />
            {isDragOver && (
              <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center bg-primary/5 border-2 border-dashed border-primary/30 backdrop-blur-[2px]">
                <div className="flex flex-col items-center gap-2 text-primary">
                  <Upload className="h-10 w-10 animate-bounce" />
                  <p className="text-sm font-semibold">Solte o arquivo para importar</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Layer 1: Top Bar (z-50) ─────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-50">
        <CrashRecoveryBanner />
        <Toolbar onOpenPanel={(id) => handleTogglePanel(id as PanelId)} isMaximized={viewportMaximized} onToggleMaximize={() => setViewportMaximized(v => !v)} />
      </div>

      {/* ─── Layer 2: Right Dock (icon bar, z-40) ──── */}
      {!viewportMaximized && (
        <div className="absolute top-14 right-0 z-40" style={{ bottom: desktopTimelineHeight, transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <PanelTabBar activePanel={activePanel} onTogglePanel={handleTogglePanel} />
        </div>
      )}

      {/* ─── Layer 3: Floating Panel (z-40) ─────────── */}
      {activePanel && !viewportMaximized && (
        <div
          className="absolute top-14 right-[52px] z-40 w-[420px] max-w-[40vw]"
          style={{
            bottom: desktopTimelineHeight,
            transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            background: 'hsl(var(--background) / 0.90)',
            backdropFilter: 'blur(16px) saturate(1.4)',
            borderLeft: '1px solid hsl(var(--border) / 0.3)',
            borderBottom: '1px solid hsl(var(--border) / 0.2)',
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setActivePanel(null)}
            className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
          <div className="h-full overflow-hidden flex flex-col">
            <Suspense fallback={<PanelLoader />}>{renderPanelContent()}</Suspense>
          </div>
        </div>
      )}

      {/* ─── Layer 4: Left Foundation Rail + Sidebar ─── */}
      {!viewportMaximized && (
        <>
          <div
            className="absolute top-14 left-0 z-40 flex w-14 flex-col border-r border-border/20 bg-surface-0/80 backdrop-blur-md"
            style={{ bottom: desktopTimelineHeight, transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
          >
            <div className="flex h-12 items-center justify-center border-b border-border/10">
              <button
                onClick={() => setLeftDockOpen((prev) => (prev === 'effects' ? null : 'effects'))}
                title={leftDockOpen === 'effects' ? 'Recolher biblioteca' : 'Expandir biblioteca'}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-1/70 text-foreground transition-colors hover:bg-surface-2"
              >
                {leftDockOpen === 'effects' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex flex-1 flex-col items-center gap-2 py-3">
              {[
                { id: 'effects', icon: Sparkles, label: 'Effect Library' },
                { id: 'scene', icon: Paintbrush, label: 'Scene Editor' },
                { id: 'showsettings', icon: Cog, label: 'Show Settings' },
              ].map(item => {
                const Icon = item.icon;
                const isActive = leftDockOpen === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      const next = leftDockOpen === item.id ? null : item.id;
                      setLeftDockOpen(next);
                      if (next && SHARED_PANEL_IDS.has(next as PanelId)) setActivePanel(null);
                    }}
                    title={item.label}
                    aria-label={item.label}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-all ${isActive ? 'border-primary/30 bg-primary/10 text-primary' : 'border-transparent bg-transparent text-muted-foreground hover:border-border/20 hover:bg-surface-1/70 hover:text-foreground'}`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {leftDockOpen === 'effects' && (
            <div
              className="absolute top-14 left-14 z-30 overflow-hidden border-r border-border/20 bg-surface-0/88 backdrop-blur-xl"
              style={{ width: '312px', bottom: desktopTimelineHeight, transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
            >
              <EffectLibrary className="h-full border-0 bg-transparent" />
            </div>
          )}

          {showLeftOverlayPanel && (
            <div
              className="absolute top-14 left-14 z-40 overflow-hidden border-r border-border/20 bg-background/92 backdrop-blur-xl"
              style={{ width: `${leftOverlayWidth}px`, bottom: desktopTimelineHeight, transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
            >
              <div className="flex items-center justify-between border-b border-border/10 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {leftDockOpen === 'scene' ? 'Scene Editor' : 'Show Settings'}
                </span>
                <button onClick={() => setLeftDockOpen(null)} className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-all hover:bg-muted/30 hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="h-[calc(100%-36px)] overflow-y-auto">
                {leftDockOpen === 'scene' && <SceneEditorPanel onClose={() => setLeftDockOpen(null)} />}
                {leftDockOpen === 'showsettings' && <ShowSettingsPanel onClose={() => setLeftDockOpen(null)} />}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Layer 6: Nav Controls (Bottom-Right) ──── */}
      {!viewportMaximized && <ViewportNavControls />}

      {/* ─── Layer 7: Timeline (Bottom, full width) ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-30"
        style={{
          height: desktopTimelineHeight,
          background: 'hsl(var(--surface-0) / 0.94)',
          backdropFilter: 'blur(18px)',
          borderTop: viewportMaximized ? 'none' : '1px solid hsl(var(--border) / 0.3)',
          transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
        }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <button
            onClick={() => setTimelineCollapsed(!timelineCollapsed)}
            className="flex items-center gap-1 px-3 h-6 rounded-t-lg bg-surface-1/95 border border-border/30 border-b-0 text-muted-foreground hover:text-foreground transition-all backdrop-blur-sm"
            title={timelineCollapsed ? 'Expandir Timeline' : 'Recolher Timeline'}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${timelineCollapsed ? 'rotate-180' : ''}`} />
            <span className="text-[9px] font-semibold uppercase tracking-wider">Timeline</span>
          </button>
        </div>
        {!timelineCollapsed && <Timeline />}
      </div>

      {/* ─── Layer 8: GeoLocationSetup (Top-Center) ── */}
      {showGeoSetup && !viewportMaximized && <GeoLocationSetup onClose={() => setShowGeoSetup(false)} />}

      {/* ─── Layer 8b: Viewport Transition Overlay ── */}
      <ViewportTransitionOverlay />

      {/* ─── Venue AR HUD Overlay ─── */}
      {venueOverlay && (
        <VenueShowOverlay
          preset={venueOverlay}
          onComplete={() => setVenueOverlay(null)}
        />
      )}

      {/* ─── Venue Quick Selector ─── */}
      <VenueQuickSelector
        open={venueSelector}
        onClose={() => setVenueSelector(false)}
        onSelect={(preset) => {
          setVenueSelector(false);
          // Trigger viewport transition
          window.dispatchEvent(new CustomEvent('viewport-transition', {
            detail: { locationName: `${preset.flag} ${preset.name}`, holdMs: 1000 },
          }));
          // After fade-out, show AR overlay
          setTimeout(() => setVenueOverlay(preset), 500);
        }}
      />

      {/* ─── Layer 9: Overlays & Modals ──────────────── */}
      {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}
      <RadialMenu />
      <LiveCard />
      <SmartScriptAssistant open={smartScriptOpen} onClose={() => setSmartScriptOpen(false)} />

    </div>
  );
}

export default Index;
