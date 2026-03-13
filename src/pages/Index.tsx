import { lazy, Suspense, useState, useCallback, useEffect } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useUndoStore } from '@/store/useUndoStore';
import { useUndoKeyboard } from '@/hooks/useUndoKeyboard';
import { toast } from 'sonner';
import Toolbar from '@/components/editor/Toolbar';
import SplashScreen from '@/components/editor/SplashScreen';
import GlobeSelector from '@/components/editor/GlobeSelector';
import EffectLibrary from '@/components/editor/EffectLibrary';
import AudienceAnalyzerPanel from '@/components/editor/AudienceAnalyzerPanel';
import IndoorSimPanel from '@/components/editor/IndoorSimPanel';
import ScriptingToolsPanel from '@/components/editor/ScriptingToolsPanel';
import Timeline from '@/components/editor/Timeline';
import PropertiesPanel from '@/components/editor/PropertiesPanel';
import ScriptWindow from '@/components/editor/ScriptWindow';
import EffectEditor from '@/components/editor/EffectEditor';
import WindCameraPanel from '@/components/editor/WindCameraPanel';
import ReportsPanel from '@/components/editor/ReportsPanel';
import RackManager from '@/components/editor/RackManager';
import AddressingPanel from '@/components/editor/AddressingPanel';
import InventoryPanel from '@/components/editor/InventoryPanel';
import WaypointEditor from '@/components/editor/WaypointEditor';
import BoidsPanel from '@/components/editor/BoidsPanel';
import PIDPanel from '@/components/editor/PIDPanel';
import DMXPanel from '@/components/editor/DMXPanel';
import BatteryPanel from '@/components/editor/BatteryPanel';
import MAVLinkPanel from '@/components/editor/MAVLinkPanel';
import SMPTEPanel from '@/components/editor/SMPTEPanel';
import GoogleMapsPanel from '@/components/editor/GoogleMapsPanel';
import DiagnosticPanel from '@/components/editor/DiagnosticPanel';
import LogisticsPanel from '@/components/editor/LogisticsPanel';
import SwarmGPTPanel from '@/components/editor/SwarmGPTPanel';
import SynesthesiaPanel from '@/components/editor/SynesthesiaPanel';
import FiringExportPanel from '@/components/editor/FiringExportPanel';
import LabelsPanel from '@/components/editor/LabelsPanel';
import VideoRecorderPanel from '@/components/editor/VideoRecorderPanel';
import ModelImportPanel from '@/components/editor/ModelImportPanel';
import BackgroundPanel from '@/components/editor/BackgroundPanel';
import SupplierCatalogPanel from '@/components/editor/SupplierCatalogPanel';
import SafetyPanel from '@/components/editor/SafetyPanel';
import ChainEditorPanel from '@/components/editor/ChainEditorPanel';
import PositionGroupsPanel from '@/components/editor/PositionGroupsPanel';
import ShowSummaryPanel from '@/components/editor/ShowSummaryPanel';
import SceneEditorPanel from '@/components/editor/SceneEditorPanel';
import SoundLevelPanel from '@/components/editor/SoundLevelPanel';
import AROverlayPanel from '@/components/editor/AROverlayPanel';
import ShowSharePanel from '@/components/editor/ShowSharePanel';
import CollaborationPanel from '@/components/editor/CollaborationPanel';
import ParticleEditorPanel from '@/components/editor/ParticleEditorPanel';
import VersioningPanel from '@/components/editor/VersioningPanel';
import WeatherPanel from '@/components/editor/WeatherPanel';
import CollisionPanel from '@/components/editor/CollisionPanel';
import ClientApprovalPanel from '@/components/editor/ClientApprovalPanel';
import TrajectoryOptimizerPanel from '@/components/editor/TrajectoryOptimizerPanel';
import ShowTemplatesPanel from '@/components/editor/ShowTemplatesPanel';
import TelemetryDashboard from '@/components/editor/TelemetryDashboard';
import FlightLogPanel from '@/components/editor/FlightLogPanel';
import PanelTabBar, { type PanelId } from '@/components/editor/PanelTabBar';
import { PositionPopupEditor, ShortcutsOverlay } from '@/components/editor/PopupEditors';
import BoxSelectOverlay from '@/components/editor/BoxSelectOverlay';
import PositionContextMenu from '@/components/editor/PositionContextMenu';

const SkyCanvas = lazy(() => import('@/components/editor/SkyCanvas'));

function CanvasLoader() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-surface-0">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-muted-foreground font-mono-code">Loading 3D Engine...</p>
      </div>
    </div>
  );
}

const PANEL_WIDTHS: Record<PanelId, string> = {
  script: 'w-[400px]',
  wind: 'w-56',
  reports: 'w-60',
  racks: 'w-56',
  addressing: 'w-60',
  inventory: 'w-64',
  waypoints: 'w-64',
  effects: 'w-56',
  properties: 'w-56',
  boids: 'w-64',
  pid: 'w-64',
  dmx: 'w-64',
  battery: 'w-64',
  mavlink: 'w-72',
  smpte: 'w-64',
  maps: 'w-80',
  diagnostic: 'w-64',
  logistics: 'w-64',
  swarmgpt: 'w-72',
  synesthesia: 'w-64',
  firing: 'w-72',
  labels: 'w-64',
  video: 'w-64',
  models: 'w-64',
  background: 'w-64',
  suppliers: 'w-72',
  safety: 'w-64',
  scripting: 'w-64',
  audience: 'w-64',
  indoor: 'w-72',
  chains: 'w-72',
  groups: 'w-56',
  summary: 'w-64',
  scene: 'w-64',
  soundlevel: 'w-64',
  aroverlay: 'w-64',
  share: 'w-64',
  collab: 'w-64',
  particles: 'w-64',
  versioning: 'w-64',
  weather: 'w-64',
  collisions: 'w-64',
  approval: 'w-72',
  trajectory: 'w-64',
  templates: 'w-72',
};

export default function Index() {
  const [activePanel, setActivePanel] = useState<PanelId | null>('properties');
  const [appPhase, setAppPhase] = useState<'splash' | 'globe' | 'editor'>('splash');
  const [fleetSize, setFleetSize] = useState(500);
  const [pyroPositions, setPyroPositions] = useState(24);
  const [showLocation, setShowLocation] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [showPositionEditor, setShowPositionEditor] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const selectedPositionId = useProjectStore(s => s.selectedPositionId);

  // Undo/Redo keyboard shortcuts
  useUndoKeyboard();

  // Open popup editor on double-click a position (via global keyboard shortcut or 3D double-click)
  useEffect(() => {
    const dblClickHandler = (e: Event) => {
      setShowPositionEditor(true);
    };
    window.addEventListener('position-double-click', dblClickHandler);
    return () => window.removeEventListener('position-double-click', dblClickHandler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'e' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        if (selectedPositionId) setShowPositionEditor(prev => !prev);
      }
      if (e.key === '?' && e.shiftKey) {
        setShowShortcuts(prev => !prev);
      }
      // Insert empty cue at current time (Finale 3D "i" key)
      if (e.key === 'i' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        const store = useProjectStore.getState();
        if (store.isPlaying || store.currentTime > 0) {
          useUndoStore.getState().checkpoint();
          store.addTimelineItem({
            id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            effectId: '',
            startTime: store.currentTime,
            trackIndex: 0,
            position: { x: 0, y: 0, z: 0 },
            notes: 'Empty cue',
          });
          toast.success(`Cue inserted at ${store.currentTime.toFixed(2)}s`);
        }
      }
      // Select all positions (Ctrl+A)
      if (e.key === 'a' && (e.ctrlKey || e.metaKey) && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const store = useProjectStore.getState();
        if (store.editorMode === 'select') {
          store.selectMultiplePositions(store.positions.map(p => p.id));
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        const store = useProjectStore.getState();
        if (store.selectedPositionIds.length > 0) {
          useUndoStore.getState().checkpoint();
          store.selectedPositionIds.forEach(id => store.removePosition(id));
        }
      }
      if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const store = useProjectStore.getState();
        if (store.selectedPositionIds.length > 0) {
          useUndoStore.getState().checkpoint();
          const newIds: string[] = [];
          store.selectedPositionIds.forEach(id => {
            const pos = store.positions.find(p => p.id === id);
            if (pos) {
              const newId = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
              newIds.push(newId);
              store.addPosition({ ...pos, id: newId, name: `${pos.name}-Copy`, x: pos.x + 2, z: pos.z + 2 });
            }
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

  const handleSplashStart = (size: number, pyroPos: number) => {
    setFleetSize(size);
    setPyroPositions(pyroPos);
    setAppPhase('globe');
  };

  const handleLocationSelected = useCallback((location: { name: string; lat: number; lng: number }) => {
    setShowLocation(location);
    useProjectStore.getState().setGpsOrigin({
      lat: location.lat,
      lng: location.lng,
      heading: 0,
      altitude: 0,
    });
    setAppPhase('editor');
  }, []);

  if (appPhase === 'splash') {
    return <SplashScreen onStart={handleSplashStart} />;
  }

  if (appPhase === 'globe') {
    return <GlobeSelector onLocationSelected={handleLocationSelected} />;
  }

  const renderPanel = () => {
    if (!activePanel) return null;
    const width = PANEL_WIDTHS[activePanel];
    return (
      <div className={width}>
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
        {activePanel === 'background' && <BackgroundPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'suppliers' && <SupplierCatalogPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'safety' && <SafetyPanel />}
        {activePanel === 'scripting' && <ScriptingToolsPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'audience' && <AudienceAnalyzerPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'indoor' && <IndoorSimPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'chains' && <ChainEditorPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'groups' && <PositionGroupsPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'summary' && <ShowSummaryPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'scene' && <SceneEditorPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'soundlevel' && <SoundLevelPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'aroverlay' && <AROverlayPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'share' && <ShowSharePanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'collab' && <CollaborationPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'particles' && <ParticleEditorPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'versioning' && <VersioningPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'weather' && <WeatherPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'collisions' && <CollisionPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'approval' && <ClientApprovalPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'trajectory' && <TrajectoryOptimizerPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'templates' && <ShowTemplatesPanel onClose={() => setActivePanel(null)} />}
      </div>
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      {/* Top toolbar */}
      <Toolbar />

      {/* Main editor area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Effect Library */}
        <div className="w-52 flex-shrink-0">
          <EffectLibrary />
        </div>

        {/* Center viewport */}
        <div className="flex-1 min-w-0 relative">
          <Suspense fallback={<CanvasLoader />}>
            <SkyCanvas />
          </Suspense>
          <BoxSelectOverlay />
        </div>

        {/* Right: active panel + icon tab bar */}
        <div className="flex flex-shrink-0">
          {renderPanel()}
          <PanelTabBar activePanel={activePanel} onTogglePanel={handleTogglePanel} />
        </div>
      </div>

      {/* Bottom timeline */}
      <div className="h-40 flex-shrink-0">
        <Timeline />
      </div>

      {/* Floating pop-up editors */}
      {showPositionEditor && selectedPositionId && (
        <PositionPopupEditor onClose={() => setShowPositionEditor(false)} />
      )}

      {/* Shortcuts overlay */}
      {showShortcuts && (
        <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />
      )}

      {/* Context menu */}
      <PositionContextMenu />
    </div>
  );
}
