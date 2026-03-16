import React, { lazy, Suspense, useState, useCallback, useEffect, Component, type ReactNode, type ErrorInfo } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useUndoStore } from '@/store/useUndoStore';
import { useUndoKeyboard } from '@/hooks/useUndoKeyboard';
import { useIsMobile } from '@/hooks/use-mobile';
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

import SupplierCatalogPanel from '@/components/editor/SupplierCatalogPanel';
import SafetyPanel from '@/components/editor/SafetyPanel';
import ChainEditorPanel from '@/components/editor/ChainEditorPanel';
import PositionGroupsPanel from '@/components/editor/PositionGroupsPanel';

import SceneEditorPanel from '@/components/editor/SceneEditorPanel';
import SoundLevelPanel from '@/components/editor/SoundLevelPanel';
import AROverlayPanel from '@/components/editor/AROverlayPanel';
import ShowSharePanel from '@/components/editor/ShowSharePanel';

import ParticleEditorPanel from '@/components/editor/ParticleEditorPanel';
import VersioningPanel from '@/components/editor/VersioningPanel';
import WeatherPanel from '@/components/editor/WeatherPanel';
import CollisionPanel from '@/components/editor/CollisionPanel';
import ClientApprovalPanel from '@/components/editor/ClientApprovalPanel';
import TrajectoryOptimizerPanel from '@/components/editor/TrajectoryOptimizerPanel';
import ShowTemplatesPanel from '@/components/editor/ShowTemplatesPanel';
import TelemetryDashboard from '@/components/editor/TelemetryDashboard';
import FlightLogPanel from '@/components/editor/FlightLogPanel';

import TemplateMarketplace from '@/components/editor/TemplateMarketplace';
import SiteLayoutPanel from '@/components/editor/SiteLayoutPanel';
import ShowSettingsPanel from '@/components/editor/ShowSettingsPanel';
import ManufacturerCalibrationPanel from '@/components/editor/ManufacturerCalibrationPanel';
import LiveFiringPanel from '@/components/editor/LiveFiringPanel';
import FleetManagementPanel from '@/components/editor/FleetManagementPanel';
import GeofencePanel from '@/components/editor/GeofencePanel';
import StoryboardPanel from '@/components/editor/StoryboardPanel';
import ShowControlPanel from '@/components/editor/ShowControlPanel';
import ShowInspectorPanel from '@/components/editor/ShowInspectorPanel';
import LightProgramPanel from '@/components/editor/LightProgramPanel';
import SafetyCheckPanel from '@/components/editor/SafetyCheckPanel';
import TakeoffGridPanel from '@/components/editor/TakeoffGridPanel';
import TransitionPlannerPanel from '@/components/editor/TransitionPlannerPanel';
import LaserControlPanel from '@/components/editor/LaserControlPanel';
import CinematicIntro from '@/components/editor/CinematicIntro';
import PanelTabBar, { type PanelId } from '@/components/editor/PanelTabBar';
import { PositionPopupEditor, ShortcutsOverlay } from '@/components/editor/PopupEditors';
import BoxSelectOverlay from '@/components/editor/BoxSelectOverlay';
import PositionContextMenu from '@/components/editor/PositionContextMenu';
import MobileTabBar, { type MobileTab } from '@/components/editor/MobileTabBar';
import MobileFloatingPanel from '@/components/editor/MobileFloatingPanel';
import MobileMoreMenu from '@/components/editor/MobileMoreMenu';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

const SkyCanvas = lazy(() =>
  import('@/components/editor/SkyCanvas').catch(() => ({
    default: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-surface-0 gap-3 p-8 text-center">
        <p className="text-sm font-semibold text-foreground">3D Engine Unavailable</p>
        <p className="text-xs text-muted-foreground">Could not load the renderer. Try reloading the page.</p>
        <button className="text-xs text-primary underline" onClick={() => window.location.reload()}>Reload</button>
      </div>
    ),
  }))
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
        <div className="w-full h-full flex flex-col items-center justify-center bg-surface-0 gap-3 p-8 text-center">
          <p className="text-sm font-semibold text-foreground">3D Engine Error</p>
          <p className="text-xs text-muted-foreground">WebGL context could not be initialized.</p>
          <button className="text-xs text-primary underline" onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

const Index = React.forwardRef<HTMLDivElement>(function Index(_props, _ref) {
  const isMobile = useIsMobile();
  const [activePanel, setActivePanel] = useState<PanelId | null>('properties');
  const [appPhase, setAppPhase] = useState<'cinematic' | 'splash' | 'globe' | 'editor'>('cinematic');
  const [showLocation, setShowLocation] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [showPositionEditor, setShowPositionEditor] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab | null>(null);
  const [mobilePanelHeight, setMobilePanelHeight] = useState<'collapsed' | 'half' | 'full'>('collapsed');
  const selectedPositionId = useProjectStore(s => s.selectedPositionId);

  useUndoKeyboard();

  useEffect(() => {
    const dblClickHandler = () => {
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

  const handleSplashStart = useCallback(() => {
    setAppPhase('globe');
  }, []);

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

  const handleMobileOpenPanel = useCallback((id: PanelId) => {
    setActivePanel(id);
    setMobileTab(null);
    setMobilePanelHeight('half');
  }, []);

  if (appPhase === 'cinematic') {
    return <CinematicIntro onComplete={() => setAppPhase('splash')} />;
  }

  if (appPhase === 'splash') {
    return <SplashScreen onStart={handleSplashStart} showVideoBackground />;
  }

  if (appPhase === 'globe') {
    return <GlobeSelector onLocationSelected={handleLocationSelected} />;
  }

  const renderPanelContent = () => {
    if (!activePanel) return null;
    return (
      <>
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
      </>
    );
  };

  // Mobile layout
  if (isMobile) {
    return (
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
        <Toolbar onOpenPanel={(id) => handleTogglePanel(id as PanelId)} />

        <div className="flex-1 min-w-0 relative">
          <CanvasErrorBoundary>
            <Suspense fallback={<CanvasLoader />}>
              <SkyCanvas />
            </Suspense>
          </CanvasErrorBoundary>
          <BoxSelectOverlay />
        </div>

        <MobileFloatingPanel activeTab={mobileTab} height={mobilePanelHeight}>
          {mobileTab === 'timeline' && <Timeline />}
          {mobileTab === 'assets' && <EffectLibrary />}
          {mobileTab === 'properties' && <PropertiesPanel />}
          {mobileTab === 'more' && <MobileMoreMenu onSelectPanel={handleMobileOpenPanel} />}
        </MobileFloatingPanel>

        {activePanel && mobileTab === null && mobilePanelHeight !== 'collapsed' && (
          <MobileFloatingPanel activeTab={'more' as MobileTab} height={mobilePanelHeight}>
            <div className="h-full overflow-y-auto">{renderPanelContent()}</div>
          </MobileFloatingPanel>
        )}

        <MobileTabBar
          activeTab={mobileTab}
          onTabChange={setMobileTab}
          onOpenPanel={(id) => handleTogglePanel(id as PanelId)}
          panelHeight={mobilePanelHeight}
          onPanelHeightChange={setMobilePanelHeight}
        />

        {showPositionEditor && selectedPositionId && (
          <PositionPopupEditor onClose={() => setShowPositionEditor(false)} />
        )}
        <PositionContextMenu />
      </div>
    );
  }

  // Desktop layout — fully resizable with react-resizable-panels
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <Toolbar onOpenPanel={(id) => handleTogglePanel(id as PanelId)} />

      <ResizablePanelGroup direction="vertical" className="flex-1">
        {/* Top section: sidebar + viewport + panel */}
        <ResizablePanel defaultSize={75} minSize={40}>
          <ResizablePanelGroup direction="horizontal">
            {/* Left sidebar - Effect Library */}
            <ResizablePanel defaultSize={14} minSize={8} maxSize={30} collapsible collapsedSize={0}>
              <EffectLibrary />
            </ResizablePanel>
            <ResizableHandle withHandle />

            {/* Center viewport */}
            <ResizablePanel defaultSize={activePanel ? 60 : 80} minSize={30}>
              <div className="h-full w-full relative">
                <CanvasErrorBoundary>
                  <Suspense fallback={<CanvasLoader />}>
                    <SkyCanvas />
                  </Suspense>
                </CanvasErrorBoundary>
                <BoxSelectOverlay />
              </div>
            </ResizablePanel>

            {/* Right panel (if active) */}
            {activePanel && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={20} minSize={12} maxSize={40} collapsible collapsedSize={0}>
                  <div className="h-full overflow-y-auto" style={{ background: 'hsl(var(--card))' }}>
                    {renderPanelContent()}
                  </div>
                </ResizablePanel>
              </>
            )}

            {/* Icon tab bar (fixed) */}
            <PanelTabBar activePanel={activePanel} onTogglePanel={handleTogglePanel} />
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Bottom timeline */}
        <ResizablePanel defaultSize={25} minSize={8} maxSize={50} collapsible collapsedSize={0}>
          <Timeline />
        </ResizablePanel>
      </ResizablePanelGroup>

      {showPositionEditor && selectedPositionId && (
        <PositionPopupEditor onClose={() => setShowPositionEditor(false)} />
      )}
      {showShortcuts && (
        <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />
      )}
      <PositionContextMenu />
    </div>
  );
}
