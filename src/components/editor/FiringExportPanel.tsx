import { useState, useCallback } from 'react';
import { Download, FileDown, Search, X, ChevronDown, ChevronUp, Globe, MapPin, FileText, Upload, Zap, CheckCircle2, Wifi, Usb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useProjectStore } from '@/store/useProjectStore';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { FIRING_SYSTEMS, type FiringSystem } from '@/lib/firingSystemExports';
import { downloadFile, exportFormationsToKML } from '@/lib/exportEngine';
import { downloadKMZ, downloadAnimatedKML } from '@/lib/kmzExporter';
import { exportSkyc, downloadSkycFile, exportShowCSV, exportVideoChoreoSkyc } from '@/lib/skycExporter';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function FiringExportPanel({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [expandedSystem, setExpandedSystem] = useState<string | null>(null);
  const items = useProjectStore(s => s.timelineItems);
  const positions = useProjectStore(s => s.positions);
  const projectName = useProjectStore(s => s.projectName);
  const hardware = useFireOneHardware();
  const projectName = useProjectStore(s => s.projectName);

  const pyroCount = items.filter(i => {
    const e = useProjectStore.getState().timelineItems.find(t => t.id === i.id);
    return e;
  }).length;

  const filtered = FIRING_SYSTEMS.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.country.includes(search) ||
    s.format.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = useCallback((sys: FiringSystem) => {
    try {
      const content = sys.exportFn(items, positions);
      const filename = `${projectName.replace(/\s+/g, '_')}_${sys.id}.${sys.fileExt}`;
      downloadFile(content, filename, sys.mimeType);
      toast.success(`Exported to ${sys.name} format`);
    } catch (err) {
      toast.error(`Export failed: ${(err as Error).message}`);
    }
  }, [items, positions, projectName]);

  const grouped = {
    '🇺🇸 Americas': filtered.filter(s => ['🇺🇸', '🇧🇷', '🌐'].includes(s.country)),
    '🇪🇺 Europe': filtered.filter(s => ['🇩🇪', '🇬🇧', '🇪🇸', '🇮🇹', '🇫🇷', '🇳🇱'].includes(s.country)),
    '🇨🇳 Asia': filtered.filter(s => ['🇨🇳'].includes(s.country)),
  };

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border/50">
      <div className="p-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileDown className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">Firing Systems</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-3 h-3" />
        </Button>
      </div>

      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search system..."
            className="pl-7 h-7 text-xs bg-surface-1 border-border/30"
          />
        </div>
        <div className="mt-1 text-[9px] text-muted-foreground font-mono-code">
          {FIRING_SYSTEMS.length} systems • {items.length} cues loaded
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {Object.entries(grouped).map(([region, systems]) => {
          if (systems.length === 0) return null;
          return (
            <div key={region}>
              <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-1 py-1">{region}</div>
              {systems.map(sys => (
                <div key={sys.id} className="mb-1">
                  <button
                    onClick={() => setExpandedSystem(expandedSystem === sys.id ? null : sys.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-2 py-1.5 rounded text-left transition-colors",
                      expandedSystem === sys.id
                        ? "bg-primary/10 border border-primary/20"
                        : "bg-surface-1/50 hover:bg-surface-2/50 border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm">{sys.country}</span>
                      <div className="min-w-0">
                        <div className="text-[10px] font-medium text-foreground truncate">{sys.name}</div>
                        <div className="text-[8px] text-muted-foreground">{sys.format} • {sys.pinsPerSlat}p/slat</div>
                      </div>
                    </div>
                    {expandedSystem === sys.id ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                  </button>
                  {expandedSystem === sys.id && (
                    <div className="mt-1 px-2 py-2 bg-surface-1/30 rounded border border-border/20">
                      <div className="text-[9px] text-muted-foreground mb-2">
                        Format: {sys.format} • Extension: .{sys.fileExt} • Pins/Slat: {sys.pinsPerSlat}
                      </div>
                      <Button
                        size="sm" className="w-full h-7 text-[10px]"
                        onClick={() => handleExport(sys)}
                        disabled={items.length === 0}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Export .{sys.fileExt}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Google Earth & Drone Show Exports */}
      <div className="px-2 pb-2">
        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-1 py-1">🌍 Google Earth / Drone Show</div>
        
        <div className="space-y-1">
          <Button
            variant="outline" size="sm" className="w-full h-7 text-[10px] justify-start"
            onClick={async () => {
              try {
                const store = useProjectStore.getState();
                await downloadKMZ({
                  projectName: store.projectName,
                  positions: store.positions,
                  trajectories: store.trajectories,
                  formations: store.droneFormations,
                  duration: store.duration,
                  gpsOrigin: store.gpsOrigin,
                  cameraKeyframes: store.cameraKeyframes,
                  fps: 4,
                  includeTour: true,
                  includeTrails: true,
                });
                toast.success('KMZ exported with animated tracks!');
              } catch (err) {
                toast.error(`KMZ export failed: ${(err as Error).message}`);
              }
            }}
          >
            <Globe className="w-3 h-3 mr-1.5 text-emerald-500" />
            Export .kmz (Google Earth Animated)
          </Button>

          <Button
            variant="outline" size="sm" className="w-full h-7 text-[10px] justify-start"
            onClick={() => {
              try {
                const store = useProjectStore.getState();
                downloadAnimatedKML({
                  projectName: store.projectName,
                  positions: store.positions,
                  trajectories: store.trajectories,
                  formations: store.droneFormations,
                  duration: store.duration,
                  gpsOrigin: store.gpsOrigin,
                  cameraKeyframes: store.cameraKeyframes,
                  fps: 4,
                  includeTour: true,
                  includeTrails: true,
                });
                toast.success('Animated KML exported!');
              } catch (err) {
                toast.error(`KML export failed: ${(err as Error).message}`);
              }
            }}
          >
            <MapPin className="w-3 h-3 mr-1.5 text-blue-500" />
            Export .kml (Animated Tracks)
          </Button>

          <Button
            variant="outline" size="sm" className="w-full h-7 text-[10px] justify-start"
            onClick={() => {
              try {
                const store = useProjectStore.getState();
                const kml = exportFormationsToKML(
                  store.droneFormations, store.trajectories,
                  store.positions, store.gpsOrigin, store.projectName,
                );
                downloadFile(kml, `${store.projectName.replace(/\s+/g, '_')}_static.kml`, 'application/vnd.google-earth.kml+xml');
                toast.success('Static KML exported!');
              } catch (err) {
                toast.error(`KML export failed: ${(err as Error).message}`);
              }
            }}
          >
            <MapPin className="w-3 h-3 mr-1.5 text-muted-foreground" />
            Export .kml (Static Placemarks)
          </Button>

          <Button
            variant="outline" size="sm" className="w-full h-7 text-[10px] justify-start"
            onClick={() => {
              try {
                const store = useProjectStore.getState();
                const skyc = exportSkyc({
                  projectName: store.projectName,
                  positions: store.positions,
                  trajectories: store.trajectories,
                  formations: store.droneFormations,
                  duration: store.duration,
                  gpsOrigin: store.gpsOrigin,
                });
                downloadSkycFile(skyc);
                toast.success('SKYC exported!');
              } catch (err) {
                toast.error(`SKYC export failed: ${(err as Error).message}`);
              }
            }}
          >
            <FileText className="w-3 h-3 mr-1.5 text-orange-500" />
            Export .skyc (Skybrush)
          </Button>

          <Button
            variant="outline" size="sm" className="w-full h-7 text-[10px] justify-start"
            onClick={() => {
              try {
                const store = useProjectStore.getState();
                const skyc = exportSkyc({
                  projectName: store.projectName,
                  positions: store.positions,
                  trajectories: store.trajectories,
                  formations: store.droneFormations,
                  duration: store.duration,
                  gpsOrigin: store.gpsOrigin,
                });
                const csv = exportShowCSV(skyc);
                downloadFile(csv, `${store.projectName.replace(/\s+/g, '_')}_show.csv`, 'text/csv');
                toast.success('Show CSV exported!');
              } catch (err) {
                toast.error(`CSV export failed: ${(err as Error).message}`);
              }
            }}
          >
            <FileDown className="w-3 h-3 mr-1.5 text-cyan-500" />
            Export .csv (Skybrush Studio)
          </Button>

          <Button
            variant="outline" size="sm" className="w-full h-7 text-[10px] justify-start"
            onClick={() => {
              try {
                const store = useProjectStore.getState();
                // Check if videoChoreoResult exists in store
                const choreoResult = (store as any).videoChoreoResult;
                if (!choreoResult) {
                  toast.error('Nenhum resultado de Video Choreo disponível. Gere uma coreografia primeiro.');
                  return;
                }
                const skyc = exportVideoChoreoSkyc({
                  projectName: store.projectName,
                  gpsOrigin: store.gpsOrigin,
                  choreoResult,
                  depthLayers: (store as any).depthLayers,
                  notes: 'Video choreo export with regional colors & depth layers',
                });
                downloadSkycFile(skyc, `${store.projectName.replace(/\s+/g, '_')}_videochoreo.skyc`);
                toast.success('Video Choreo .skyc exportado com cores regionais e depth layers!');
              } catch (err) {
                toast.error(`Video Choreo SKYC export failed: ${(err as Error).message}`);
              }
            }}
          >
            <FileDown className="w-3 h-3 mr-1.5 text-violet-500" />
            Export .skyc (Video Choreo + Depth)
          </Button>
        </div>
      </div>

      <div className="p-2 border-t border-border/30">
        <Button
          variant="outline" size="sm" className="w-full h-7 text-[10px]"
          onClick={() => {
            FIRING_SYSTEMS.forEach(sys => handleExport(sys));
            toast.success('Exported to all systems!');
          }}
          disabled={items.length === 0}
        >
          <Download className="w-3 h-3 mr-1" />
          Export All ({FIRING_SYSTEMS.length} systems)
        </Button>
      </div>
    </div>
  );
}
