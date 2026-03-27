import React, { lazy, Suspense, useState, useCallback, useEffect, Component, type ReactNode, type ErrorInfo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProjectStore } from '@/store/useProjectStore';
import { useUndoStore } from '@/store/useUndoStore';
import { useUndoKeyboard } from '@/hooks/useUndoKeyboard';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { Upload, ZoomIn, ZoomOut, Compass, Layers, ChevronDown, Sparkles, Paintbrush, Cog, X } from 'lucide-react';
import { useDisplayStore } from '@/store/useDisplayStore';
import PanelTabBar, { type PanelId } from '@/components/editor/PanelTabBar';
import { type MobileTab } from '@/components/editor/MobileTabBar';

// ── Critical-path (static): shell chrome loaded immediately ──
import Toolbar from '@/components/editor/Toolbar';
import CrashRecoveryBanner from '@/components/editor/CrashRecoveryBanner';
import BoxSelectOverlay from '@/components/editor/BoxSelectOverlay';
import SelectionModeBar from '@/components/editor/SelectionModeBar';
import PositionContextMenu from '@/components/editor/PositionContextMenu';

// ── Lazy helper — one-liner for 80+ panels ──
const lz = (loader: () => Promise<{ default: React.ComponentType<any> }>) => lazy(loader);

// ── Phase screens ──
const CinematicIntro = lz(() => import('@/components/editor/CinematicIntro'));
const SplashScreen = lz(() => import('@/components/editor/SplashScreen'));

// ── Core editor components (loaded on first interaction) ──
const Timeline = lz(() => import('@/components/editor/Timeline'));
const EffectLibrary = lz(() => import('@/components/editor/EffectLibrary'));
const PropertiesPanel = lz(() => import('@/components/editor/PropertiesPanel'));
const GeoLocationSetup = lz(() => import('@/components/editor/GeoLocationSetup'));
const ViewportTransitionOverlay = lz(() => import('@/components/editor/ViewportTransitionOverlay'));
const FXKAssistant = lz(() => import('@/components/FXKAssistant').then(m => ({ default: m.FXKAssistant })));
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
const DMXPanel = lz(() => import('@/components/editor/DMXPanel'));
const BatteryPanel = lz(() => import('@/components/editor/BatteryPanel'));
const MAVLinkPanel = lz(() => import('@/components/editor/MAVLinkPanel'));
const SMPTEPanel = lz(() => import('@/components/editor/SMPTEPanel'));
const GoogleMapsPanel = lz(() => import('@/components/editor/GoogleMapsPanel'));
const DiagnosticPanel = lz(() => import('@/components/editor/DiagnosticPanel'));
const LogisticsPanel = lz(() => import('@/components/editor/LogisticsPanel'));
const SwarmGPTPanel = lz(() => import('@/components/editor/SwarmGPTPanel'));
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
const ShowControlPanel = lz(() => import('@/components/editor/ShowControlPanel'));
const ShowInspectorPanel = lz(() => import('@/components/editor/ShowInspectorPanel'));
const LightProgramPanel = lz(() => import('@/components/editor/LightProgramPanel'));
const SafetyCheckPanel = lz(() => import('@/components/editor/SafetyCheckPanel'));
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
const DMXOutputPanel = lz(() => import('@/components/editor/DMXOutputPanel'));
const RemoteControlPanel = lz(() => import('@/components/editor/RemoteControlPanel'));
const ConnectionManagerPanel = lz(() => import('@/components/editor/ConnectionManagerPanel'));
const RadioControlPanel = lz(() => import('@/components/editor/RadioControlPanel'));
const MA3ControlPanel = lz(() => import('@/components/editor/MA3ControlPanel'));
const SACNMonitorPanel = lz(() => import('@/components/editor/SACNMonitorPanel'));
const EasyConnectPanel = lz(() => import('@/components/editor/EasyConnectPanel'));

const SkyCanvas = lazy(() =>
  import('@/components/editor/SkyCanvas').catch((err) => {
    console.error('[FXK] SkyCanvas chunk failed:', err);
    const Fallback = () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 gap-3 p-8 text-center">
        <p className="text-sm font-semibold text-white">3D Engine Unavailable</p>
        <p className="text-xs text-zinc-500">Could not load the renderer module.</p>
        <button className="text-xs text-cyan-400 underline" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
    return { default: Fallback };
  })
);

class CanvasErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[FXK] Canvas failed to load:', error.message);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 gap-3 p-8 text-center">
          <p className="text-sm font-semibold text-white">3D Engine Error</p>
          <p className="text-xs text-zinc-500">WebGL context could not be initialized.</p>
          <button className="text-xs text-cyan-400 underline" onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}>Reload</button>
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
    <div className="w-full h-full flex items-center justify-center bg-zinc-950">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-zinc-500 font-mono">Loading 3D Engine...</p>
      </div>
    </div>
  );
}

const SUPPORTED_DROP_EXTENSIONS = ['mvr', 'csv', 'json', 'vviz', 'uasset', 'umap', 'copy', 't3d', 'png', 'jpg', 'jpeg', 'tif', 'tiff', 'bmp', 'udatasmith', 'ds', 'fbx', 'obj', 'gltf', 'glb', 'skp', 'ifc', '3ds', 'dae', 'dwg'];

function getDropType(ext: string): 'mvr' | 'csv' | 'ue5json' | 'vviz' | 'uasset' | 'ue5map' | 'heightmap' | 'twinmotion' {
  if (ext === 'mvr') return 'mvr';
  if (ext === 'csv') return 'csv';
  if (ext === 'vviz') return 'vviz';
  if (ext === 'uasset' || ext === 'umap') return 'uasset';
  if (['png', 'jpg', 'jpeg', 'tif', 'tiff', 'bmp'].includes(ext)) return 'heightmap';
  if (ext === 't3d') return 'ue5map';
  if (['udatasmith', 'ds', 'fbx', 'obj', 'gltf', 'glb', 'skp', 'ifc', '3ds', 'dae', 'dwg', 'c4d', 'rvt'].includes(ext)) return 'twinmotion';
  return 'ue5json';
}

/* ── Nav Controls (Bottom-Right) ─────────────────────────────── */
function ViewportNavControls({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="absolute right-3 z-30 flex flex-col gap-1" style={{ bottom: collapsed ? '40px' : 'calc(25vh + 8px)', transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
      {[
        { icon: ZoomIn, title: 'Zoom In', action: () => window.dispatchEvent(new CustomEvent('viewport-zoom', { detail: 1 })) },
        { icon: ZoomOut, title: 'Zoom Out', action: () => window.dispatchEvent(new CustomEvent('viewport-zoom', { detail: -1 })) },
        { icon: Compass, title: 'Reset Camera', action: () => window.dispatchEvent(new Event('viewport-reset-camera')) },
        { icon: Layers, title: 'Toggle 3D/2D', action: () => window.dispatchEvent(new Event('viewport-toggle-2d')) },
      ].map(({ icon: Icon, title, action }) => (
        <button
          key={title}
          onClick={action}
          title={title}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/50 backdrop-blur-sm border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   INDEX — Immersive Full-Viewport Layout
   ══════════════════════════════════════════════════════════════════ */
function Index() {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const [appPhase, setAppPhase] = useState<'cinematic' | 'splash' | 'editor'>('editor');
  const [showGeoSetup, setShowGeoSetup] = useState(false);
  const [showPositionEditor, setShowPositionEditor] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab | null>(null);
  const [smartScriptOpen, setSmartScriptOpen] = useState(false);
  const [mobilePanelHeight, setMobilePanelHeight] = useState<'collapsed' | 'half' | 'full'>('collapsed');
  const [isDragOver, setIsDragOver] = useState(false);
  const [remoteMode, setRemoteMode] = useState<'cloud' | 'wifi-auto'>('cloud');
  const [timelineCollapsed, setTimelineCollapsed] = useState(true);
  const [viewportMaximized, setViewportMaximized] = useState(false);
  const [leftDockOpen, setLeftDockOpen] = useState<string | null>(null);
  const selectedPositionId = useProjectStore(s => s.selectedPositionId);
  const operationMode = useDisplayStore(s => s.operationMode);
  const nightMode = useDisplayStore(s => s.nightMode);
  useUndoKeyboard();

  // Apply night-mode class to root element
  useEffect(() => {
    document.documentElement.classList.toggle('night-mode', nightMode);
    return () => document.documentElement.classList.remove('night-mode');
  }, [nightMode]);

  // Viewport maximize toggle: F key to toggle, Escape to exit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && !activePanel) {
        e.preventDefault();
        setViewportMaximized(v => !v);
      }
      if (e.key === 'Escape' && viewportMaximized) {
        setViewportMaximized(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [viewportMaximized, activePanel]);

  // Deep-link: auto-open panel from ?panel= query param
  useEffect(() => {
    const panelParam = searchParams.get('panel');
    const modeParam = searchParams.get('mode');
    if (panelParam) {
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
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const dblClickHandler = () => setShowPositionEditor(true);
    window.addEventListener('position-double-click', dblClickHandler);
    return () => window.removeEventListener('position-double-click', dblClickHandler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'e' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        if (selectedPositionId) setShowPositionEditor(prev => !prev);
      }
      if (e.key === '?' && e.shiftKey) setShowShortcuts(prev => !prev);
      if (!e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        if (e.key === '1') useProjectStore.getState().setSelectionMode('positions');
        if (e.key === '2') useProjectStore.getState().setSelectionMode('events');
        if (e.key === '3') useProjectStore.getState().setSelectionMode('both');
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'A') { e.preventDefault(); setSmartScriptOpen(prev => !prev); }
      if (e.key === 'i' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        const store = useProjectStore.getState();
        if (store.isPlaying || store.currentTime > 0) {
          useUndoStore.getState().checkpoint();
          store.addTimelineItem({ id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, effectId: '', startTime: store.currentTime, trackIndex: 0, position: { x: 0, y: 0, z: 0 }, notes: 'Empty cue' });
          toast.success(`Cue inserted at ${store.currentTime.toFixed(2)}s`);
        }
      }
      if (e.key === 'a' && (e.ctrlKey || e.metaKey) && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const store = useProjectStore.getState();
        if (store.editorMode === 'select') store.selectMultiplePositions(store.positions.map(p => p.id));
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        const store = useProjectStore.getState();
        if (store.selectedPositionIds.length > 0) { useUndoStore.getState().checkpoint(); store.selectedPositionIds.forEach(id => store.removePosition(id)); }
      }
      if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const store = useProjectStore.getState();
        if (store.selectedPositionIds.length > 0) {
          useUndoStore.getState().checkpoint();
          const newIds: string[] = [];
          store.selectedPositionIds.forEach(id => {
            const pos = store.positions.find(p => p.id === id);
            if (pos) { const newId = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`; newIds.push(newId); store.addPosition({ ...pos, id: newId, name: `${pos.name}-Copy`, x: pos.x + 2, z: pos.z + 2 }); }
          });
          store.selectMultiplePositions(newIds);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedPositionId]);

  const handleTogglePanel = useCallback((id: PanelId) => {
    setActivePanel((prev) => (prev === id ? null : id));
  }, []);

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
    setActivePanel(id);
    setMobileTab(null);
    setMobilePanelHeight(id === 'effects' ? 'full' : 'half');
  }, []);

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
        {activePanel === 'swarmgpt' && <SwarmGPTPanel onClose={() => setActivePanel(null)} />}
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
        {activePanel === 'showcontrol' && <ShowControlPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'inspector' && <ShowInspectorPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'lightprogram' && <LightProgramPanel />}
        {activePanel === 'safetycheck' && <SafetyCheckPanel />}
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
        <div className="h-[100dvh] w-screen relative overflow-hidden bg-background">
          <div className="absolute inset-0 br2049-atmosphere">
            <CanvasErrorBoundary><Suspense fallback={<CanvasLoader />}><SkyCanvas /></Suspense></CanvasErrorBoundary>
          </div>
          <LiveModeOverlay />
        </div>
      );
    }
    return (
      <div className="h-[100dvh] w-screen relative overflow-hidden bg-background">
        <div className="absolute inset-0">
          <CanvasErrorBoundary><Suspense fallback={<CanvasLoader />}><SkyCanvas /></Suspense></CanvasErrorBoundary>
          <BoxSelectOverlay />
        </div>
        <MobileHUD onOpenPanel={handleMobileOpenPanel} onMenuOpen={() => { setMobileTab('more'); setMobilePanelHeight('full'); }} />
        <MobileQuickActions />
        <MobileFloatingPanel activeTab={mobileTab} height={mobilePanelHeight} onHeightChange={setMobilePanelHeight} onDismiss={handleDismissPanel}>
          {mobileTab === 'timeline' && <Timeline />}
          {mobileTab === 'assets' && <EffectLibrary />}
          {mobileTab === 'properties' && <PropertiesPanel />}
          {mobileTab === 'more' && <UnifiedPanelMenu activePanel={activePanel} onSelectPanel={(id) => { handleMobileOpenPanel(id); setMobileTab(null); setMobilePanelHeight('full'); }} variant="sheet" onDismiss={handleDismissPanel} />}
          {mobileTab && !['timeline', 'assets', 'properties', 'more'].includes(mobileTab) && activePanel && !isConsolePanel && <div className="h-full overflow-y-auto"><Suspense fallback={<PanelLoader />}>{renderPanelContent()}</Suspense></div>}
        </MobileFloatingPanel>

        {/* Regular panels in floating sheet */}
        {activePanel && !isConsolePanel && mobileTab === null && mobilePanelHeight !== 'collapsed' && (
          <MobileFloatingPanel activeTab={'more' as MobileTab} height={mobilePanelHeight} onHeightChange={setMobilePanelHeight} onDismiss={handleDismissPanel}>
            <div className="h-full overflow-y-auto"><Suspense fallback={<PanelLoader />}>{renderPanelContent()}</Suspense></div>
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

        <MobileTabBar activeTab={mobileTab} onTabChange={setMobileTab} onOpenPanel={(id) => handleTogglePanel(id as PanelId)} panelHeight={mobilePanelHeight} onPanelHeightChange={setMobilePanelHeight} />
        <PositionContextMenu />
      </div>
    );
  }

  // ═══ DESKTOP LAYOUT — Full Immersive Viewport ═══
  return (
    <div className="h-[100dvh] w-screen relative overflow-hidden bg-zinc-950">
      {/* ─── Layer 0: Full-screen 3D Canvas ────────────── */}
      <div
        className="absolute inset-0 z-0 br2049-atmosphere"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('application/showven-equipment')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; return; }
          if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setIsDragOver(true); }
        }}
        onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsDragOver(false); }}
        onDrop={(e) => {
          setIsDragOver(false);
          if (e.dataTransfer.files?.length > 0) {
            const file = e.dataTransfer.files[0];
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            if (SUPPORTED_DROP_EXTENSIONS.includes(ext)) { e.preventDefault(); window.dispatchEvent(new CustomEvent('viewport-file-drop', { detail: { file, type: getDropType(ext) } })); toast.info(`📂 ${file.name} dropped — opening importer...`); return; }
          }
          const raw = e.dataTransfer.getData('application/showven-equipment');
          if (!raw) return;
          e.preventDefault();
          try {
            const data = JSON.parse(raw);
            if (!data.effectType) return;
            const store = useProjectStore.getState();
            useUndoStore.getState().checkpoint();
            const posId = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const offset = store.positions.length * 2;
            store.addPosition({ id: posId, name: data.name, x: offset, y: 0, z: 0, type: 'pyro', color: '#ff8800', heading: 0, pitch: 0, roll: 0 });
            store.addTimelineItem({ id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, effectId: data.effectType, startTime: store.currentTime, trackIndex: 0, position: { x: offset, y: 0, z: 0 }, notes: `Showven ${data.name}` });
            toast.success(`${data.name} dropped na cena`);
          } catch { /* ignore */ }
        }}
      >
        <CanvasErrorBoundary>
          <Suspense fallback={<CanvasLoader />}>
            <SkyCanvas />
          </Suspense>
        </CanvasErrorBoundary>
        <BoxSelectOverlay />
        <SelectionModeBar />
        {isDragOver && (
          <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center bg-cyan-500/5 border-2 border-dashed border-cyan-400/30 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-2 text-cyan-400">
              <Upload className="h-10 w-10 animate-bounce" />
              <p className="text-sm font-semibold">Solte o arquivo para importar</p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Layer 1: Top Bar (z-50) ─────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-50">
        <CrashRecoveryBanner />
        <Toolbar onOpenPanel={(id) => handleTogglePanel(id as PanelId)} isMaximized={viewportMaximized} onToggleMaximize={() => setViewportMaximized(v => !v)} />
      </div>

      {/* ─── Layer 2: Right Dock (icon bar, z-40) ──── */}
      {!viewportMaximized && (
        <div className="absolute top-14 right-0 z-40" style={{ bottom: timelineCollapsed ? '32px' : '25vh', transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <PanelTabBar activePanel={activePanel} onTogglePanel={handleTogglePanel} />
        </div>
      )}

      {/* ─── Layer 3: Floating Panel (z-40) ─────────── */}
      {activePanel && !viewportMaximized && (
        <div
          className="absolute top-14 right-[52px] z-40 w-[380px] max-w-[30vw]"
          style={{
            bottom: timelineCollapsed ? '32px' : '25vh',
            transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            background: 'rgba(9, 9, 11, 0.90)',
            backdropFilter: 'blur(16px) saturate(1.4)',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setActivePanel(null)}
            className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
          <div className="h-full overflow-y-auto">
            <Suspense fallback={<PanelLoader />}>{renderPanelContent()}</Suspense>
          </div>
        </div>
      )}

      {/* ─── Layer 4: Left Dock (z-40, icons only) ─── */}
      {!viewportMaximized && (
        <div className="absolute top-14 left-0 z-40 w-[44px] flex flex-col items-center py-2 gap-1" style={{ bottom: timelineCollapsed ? '32px' : '25vh', transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)', background: 'rgba(9, 9, 11, 0.50)', backdropFilter: 'blur(8px)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
          {[
            { id: 'effects', icon: Sparkles, label: 'Effects' },
            { id: 'scene', icon: Paintbrush, label: 'Scene' },
            { id: 'showsettings', icon: Cog, label: 'Settings' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setLeftDockOpen(leftDockOpen === item.id ? null : item.id)}
                title={item.label}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${leftDockOpen === item.id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Left Dock Floating Panel ──────────────── */}
      {leftDockOpen && !viewportMaximized && (
        <div
          className="absolute top-14 left-[44px] z-40 w-[280px]"
          style={{
            bottom: timelineCollapsed ? '32px' : '25vh',
            transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            background: 'rgba(9, 9, 11, 0.92)',
            backdropFilter: 'blur(16px) saturate(1.4)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              {leftDockOpen === 'effects' ? 'Effect Library' : leftDockOpen === 'scene' ? 'Scene Editor' : 'Settings'}
            </span>
            <button onClick={() => setLeftDockOpen(null)} className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-white hover:bg-white/10 transition-all">
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="h-[calc(100%-36px)] overflow-y-auto">
            {leftDockOpen === 'effects' && <EffectLibrary />}
            {leftDockOpen === 'scene' && <SceneEditorPanel onClose={() => setLeftDockOpen(null)} />}
            {leftDockOpen === 'showsettings' && <ShowSettingsPanel onClose={() => setLeftDockOpen(null)} />}
          </div>
        </div>
      )}

      {/* ─── Layer 6: Nav Controls (Bottom-Right) ──── */}
      {!viewportMaximized && <ViewportNavControls collapsed={timelineCollapsed} />}

      {/* ─── Layer 7: Timeline (Bottom, full width) ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-30"
        style={{
          height: viewportMaximized ? '0px' : timelineCollapsed ? '32px' : '25vh',
          background: 'rgba(9, 9, 11, 0.90)',
          backdropFilter: 'blur(12px)',
          borderTop: viewportMaximized ? 'none' : '1px solid rgba(255,255,255,0.06)',
          transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
        }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <button
            onClick={() => setTimelineCollapsed(!timelineCollapsed)}
            className="w-11 h-5 flex items-center justify-center rounded-t-lg bg-zinc-800/90 border border-white/10 border-b-0 text-zinc-400 hover:text-white transition-all backdrop-blur-sm"
            title={timelineCollapsed ? 'Expandir Timeline' : 'Recolher Timeline'}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${timelineCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {!timelineCollapsed && <Timeline />}
      </div>

      {/* ─── Layer 8: GeoLocationSetup (Top-Center) ── */}
      {showGeoSetup && !viewportMaximized && <GeoLocationSetup onClose={() => setShowGeoSetup(false)} />}

      {/* ─── Layer 8b: Viewport Transition Overlay ── */}
      <ViewportTransitionOverlay />

      {/* ─── Layer 9: Overlays & Modals ──────────────── */}
      {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}
      <PositionContextMenu />
      <SmartScriptAssistant open={smartScriptOpen} onClose={() => setSmartScriptOpen(false)} />

      {/* ─── Layer 10: AI Assistant ──────────────────── */}
      <FXKAssistant />
    </div>
  );
}

export default Index;
