import { lazy, Suspense, useState, useCallback, useEffect } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
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
import PanelTabBar, { type PanelId } from '@/components/editor/PanelTabBar';
import { PositionPopupEditor, ShortcutsOverlay } from '@/components/editor/PopupEditors';

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
};

export default function Index() {
  const [activePanel, setActivePanel] = useState<PanelId | null>('properties');
  const [appPhase, setAppPhase] = useState<'splash' | 'globe' | 'editor'>('splash');
  const [fleetSize, setFleetSize] = useState(500);
  const [pyroPositions, setPyroPositions] = useState(24);
  const [showLocation, setShowLocation] = useState<{ name: string; lat: number; lng: number } | null>(null);

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
        <div className="flex-1 min-w-0">
          <Suspense fallback={<CanvasLoader />}>
            <SkyCanvas />
          </Suspense>
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
    </div>
  );
}
