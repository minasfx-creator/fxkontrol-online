import React, { lazy, Suspense, useState, useCallback, useEffect, Component, type ReactNode, type ErrorInfo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProjectStore } from '@/store/useProjectStore';
import { useUndoStore } from '@/store/useUndoStore';
import { useUndoKeyboard } from '@/hooks/useUndoKeyboard';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import Toolbar from '@/components/editor/Toolbar';
import SplashScreen from '@/components/editor/SplashScreen';
import CrashRecoveryBanner from '@/components/editor/CrashRecoveryBanner';
import StockAlertsBadge from '@/components/editor/StockAlertsBadge';
import GeoLocationSetup from '@/components/editor/GeoLocationSetup';
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
import USBConnectionPanel from '@/components/editor/USBConnectionPanel';
import VideoChoreoPanel from '@/components/editor/VideoChoreoPanel';
import ShowvenEquipmentPanel from '@/components/editor/ShowvenEquipmentPanel';
import GenerativeEffectsPanel from '@/components/editor/GenerativeEffectsPanel';
import SmartScriptAssistant from '@/components/editor/SmartScriptAssistant';
import CinematicIntro from '@/components/editor/CinematicIntro';
import SetlistPanel from '@/components/editor/SetlistPanel';
import RiderPanel from '@/components/editor/RiderPanel';
import BudgetPanel from '@/components/editor/BudgetPanel';
import ShowPreviewPanel from '@/components/editor/ShowPreviewPanel';
import MobileLinkPanel from '@/components/editor/MobileLinkPanel';
import MobileLinkMonitor from '@/components/editor/MobileLinkMonitor';
import SiteModelsPanel from '@/components/editor/SiteModelsPanel';
import VirtualControllerHub from '@/components/editor/VirtualControllerHub';
import FieldMap2D from '@/components/editor/FieldMap2D';
import ShowCommanderPanel from '@/components/editor/ShowCommanderPanel';
import PositionWindow from '@/components/editor/PositionWindow';
import BluetoothPanel from '@/components/editor/BluetoothPanel';
import NFCPairPanel from '@/components/editor/NFCPairPanel';
import DMXOutputPanel from '@/components/editor/DMXOutputPanel';
import RemoteControlPanel from '@/components/editor/RemoteControlPanel';
import ConnectionManagerPanel from '@/components/editor/ConnectionManagerPanel';
import RadioControlPanel from '@/components/editor/RadioControlPanel';
import MA3ControlPanel from '@/components/editor/MA3ControlPanel';
import SACNMonitorPanel from '@/components/editor/SACNMonitorPanel';
import PanelTabBar, { type PanelId } from '@/components/editor/PanelTabBar';
import { ShortcutsOverlay } from '@/components/editor/PopupEditors';
import BoxSelectOverlay from '@/components/editor/BoxSelectOverlay';
import SelectionModeBar from '@/components/editor/SelectionModeBar';
import PositionContextMenu from '@/components/editor/PositionContextMenu';
import MobileTabBar, { type MobileTab } from '@/components/editor/MobileTabBar';
import MobileFloatingPanel from '@/components/editor/MobileFloatingPanel';
import UnifiedPanelMenu from '@/components/editor/UnifiedPanelMenu';
import MobileHUD from '@/components/editor/MobileHUD';
import MobileQuickActions from '@/components/editor/MobileQuickActions';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

const SkyCanvas = lazy(() =>
  import('@/components/editor/SkyCanvas').catch((err) => {
    console.error('[FXK] SkyCanvas chunk failed:', err);
    const Fallback = () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-surface-0 gap-3 p-8 text-center">
        <p className="text-sm font-semibold text-foreground">3D Engine Unavailable</p>
        <p className="text-xs text-muted-foreground">Could not load the renderer module.</p>
        <button className="text-xs text-primary underline" onClick={() => window.location.reload()}>Reload</button>
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

function Index() {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activePanel, setActivePanel] = useState<PanelId | null>('properties');
  const [appPhase, setAppPhase] = useState<'cinematic' | 'splash' | 'editor'>('editor');
  const [showGeoSetup, setShowGeoSetup] = useState(true);
  const [showPositionEditor, setShowPositionEditor] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab | null>(null);
  const [smartScriptOpen, setSmartScriptOpen] = useState(false);
  const [mobilePanelHeight, setMobilePanelHeight] = useState<'collapsed' | 'half' | 'full'>('collapsed');
  const [isDragOver, setIsDragOver] = useState(false);
  const [remoteMode, setRemoteMode] = useState<'cloud' | 'wifi-auto'>('cloud');
  const selectedPositionId = useProjectStore(s => s.selectedPositionId);

  useUndoKeyboard();

  // Deep-link: auto-open panel from ?panel= query param (used by Dashboard hubs)
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
      // Selection mode shortcuts
      if (!e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        if (e.key === '1') useProjectStore.getState().setSelectionMode('positions');
        if (e.key === '2') useProjectStore.getState().setSelectionMode('events');
        if (e.key === '3') useProjectStore.getState().setSelectionMode('both');
      }
      // Ctrl+Shift+A → Smart Script Assistant
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setSmartScriptOpen(prev => !prev);
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
    window.dispatchEvent(new CustomEvent('box-select-active', { detail: false }));
    setAppPhase('editor');
    setShowGeoSetup(false);
  }, []);

  // Reabre GeoLocationSetup via evento do Toolbar
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

  if (appPhase === 'cinematic') {
    return <CinematicIntro onComplete={() => setAppPhase('splash')} />;
  }

  if (appPhase === 'splash') {
    return <SplashScreen onStart={handleSplashStart} showVideoBackground />;
  }

  if (appPhase === 'globe') {
    setAppPhase('editor');
  }

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
        {activePanel === 'remotecontrol' && (
          <RemoteControlPanel onClose={() => setActivePanel(null)} initialMode={remoteMode} />
        )}
        {activePanel === 'controllers' && <VirtualControllerHub onClose={() => setActivePanel(null)} />}
        {activePanel === 'fieldmap' && <FieldMap2D onClose={() => setActivePanel(null)} />}
        {activePanel === 'connections' && <ConnectionManagerPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'radio' && <RadioControlPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'ma3' && <MA3ControlPanel onClose={() => setActivePanel(null)} />}
        {activePanel === 'sacnmonitor' && <SACNMonitorPanel onClose={() => setActivePanel(null)} />}
      </>
    );
  };

  // Mobile layout — Full-screen 3D with transparent HUD overlays
  if (isMobile) {
    const handleDismissPanel = () => {
      setMobileTab(null);
      setMobilePanelHeight('collapsed');
    };

    return (
      <div className="h-[100dvh] w-screen relative overflow-hidden bg-background">
        {/* Full-screen 3D Canvas */}
        <div className="absolute inset-0">
          <CanvasErrorBoundary>
            <Suspense fallback={<CanvasLoader />}>
              <SkyCanvas />
            </Suspense>
          </CanvasErrorBoundary>
          <BoxSelectOverlay />
        </div>

        {/* HUD Top Bar */}
        <MobileHUD
          onOpenPanel={handleMobileOpenPanel}
          onMenuOpen={() => {
            setMobileTab('more');
            setMobilePanelHeight('full');
          }}
        />

        {/* Quick Actions (left FABs) */}
        <MobileQuickActions />

        {/* Floating Panel (tabs content) */}
        <MobileFloatingPanel
          activeTab={mobileTab}
          height={mobilePanelHeight}
          onHeightChange={setMobilePanelHeight}
          onDismiss={handleDismissPanel}
        >
          {mobileTab === 'timeline' && <Timeline />}
          {mobileTab === 'assets' && <EffectLibrary />}
          {mobileTab === 'properties' && <PropertiesPanel />}
          {mobileTab === 'more' && (
            <UnifiedPanelMenu
              activePanel={activePanel}
              onSelectPanel={(id) => {
                handleMobileOpenPanel(id);
                setMobileTab(null);
                setMobilePanelHeight('full');
              }}
              variant="sheet"
              onDismiss={handleDismissPanel}
            />
          )}
          {/* Panel-based tabs (livefx, controllers, remote, fieldmap) */}
          {mobileTab && !['timeline', 'assets', 'properties', 'more'].includes(mobileTab) && activePanel && (
            <div className="h-full overflow-y-auto">{renderPanelContent()}</div>
          )}
        </MobileFloatingPanel>

        {/* Panel content from More menu or direct panel open */}
        {activePanel && mobileTab === null && mobilePanelHeight !== 'collapsed' && (
          <MobileFloatingPanel
            activeTab={'more' as MobileTab}
            height={mobilePanelHeight}
            onHeightChange={setMobilePanelHeight}
            onDismiss={handleDismissPanel}
          >
            <div className="h-full overflow-y-auto">{renderPanelContent()}</div>
          </MobileFloatingPanel>
        )}

        {/* Glass Dock */}
        <MobileTabBar
          activeTab={mobileTab}
          onTabChange={setMobileTab}
          onOpenPanel={(id) => handleTogglePanel(id as PanelId)}
          panelHeight={mobilePanelHeight}
          onPanelHeightChange={setMobilePanelHeight}
        />

        <PositionContextMenu />
      </div>
    );
  }

  // Desktop layout — fully resizable with react-resizable-panels
  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-background">
      <CrashRecoveryBanner />
      <Toolbar onOpenPanel={(id) => handleTogglePanel(id as PanelId)} />

      <ResizablePanelGroup direction="vertical" className="flex-1">
        {/* Top section: sidebar + viewport + panel */}
        <ResizablePanel defaultSize={75} minSize={40}>
          <div className="relative h-full">
            <ResizablePanelGroup direction="horizontal" className="pr-[52px]">
              {/* Left sidebar - Effect Library */}
              <ResizablePanel defaultSize={14} minSize={8} maxSize={30} collapsible collapsedSize={0}>
                <EffectLibrary />
              </ResizablePanel>
              <ResizableHandle withHandle />

              {/* Center viewport */}
              <ResizablePanel defaultSize={activePanel ? 66 : 86} minSize={30}>
                <div
                  className="h-full w-full relative"
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes('application/showven-equipment')) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                      return;
                    }
                    if (e.dataTransfer.types.includes('Files')) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                      setIsDragOver(true);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    setIsDragOver(false);
                  }}
                  onDrop={(e) => {
                    setIsDragOver(false);
                    if (e.dataTransfer.files?.length > 0) {
                      const file = e.dataTransfer.files[0];
                      const ext = file.name.split('.').pop()?.toLowerCase() || '';
                      if (SUPPORTED_DROP_EXTENSIONS.includes(ext)) {
                        e.preventDefault();
                        const type = getDropType(ext);
                        window.dispatchEvent(new CustomEvent('viewport-file-drop', { detail: { file, type } }));
                        toast.info(`📂 ${file.name} dropped — opening importer...`);
                        return;
                      }
                    }
                    // Handle showven equipment drag
                    const raw = e.dataTransfer.getData('application/showven-equipment');
                    if (!raw) return;
                    e.preventDefault();
                    try {
                      const data = JSON.parse(raw) as { id: string; category: string; effectType: string; name: string };
                      if (!data.effectType) return;
                      const store = useProjectStore.getState();
                      useUndoStore.getState().checkpoint();
                      const posId = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                      const offset = store.positions.length * 2;
                      store.addPosition({
                        id: posId, name: data.name,
                        x: offset, y: 0, z: 0, type: 'pyro',
                        color: '#ff8800', heading: 0, pitch: 0, roll: 0,
                      });
                      store.addTimelineItem({
                        id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        effectId: data.effectType,
                        startTime: store.currentTime,
                        trackIndex: 0,
                        position: { x: offset, y: 0, z: 0 },
                        notes: `Showven ${data.name}`,
                      });
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
                    <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-md backdrop-blur-[2px] transition-all">
                      <div className="flex flex-col items-center gap-2 text-primary">
                        <Upload className="h-10 w-10 animate-bounce" />
                        <p className="text-sm font-semibold">Solte o arquivo para importar</p>
                        <p className="text-[10px] text-muted-foreground">.mvr · .csv · .json · .vviz · .uasset</p>
                      </div>
                    </div>
                  )}
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
            </ResizablePanelGroup>

            <div className="absolute inset-y-0 right-0">
              <PanelTabBar activePanel={activePanel} onTogglePanel={handleTogglePanel} />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Bottom timeline */}
        <ResizablePanel defaultSize={25} minSize={8} maxSize={50} collapsible collapsedSize={0}>
          <Timeline />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Position properties now unified in PositionContextMenu */}
      {showShortcuts && (
        <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />
      )}
      <PositionContextMenu />
      <SmartScriptAssistant open={smartScriptOpen} onClose={() => setSmartScriptOpen(false)} />
      {showGeoSetup && (
        <GeoLocationSetup onClose={() => setShowGeoSetup(false)} />
      )}
    </div>
  );
}

export default Index;
