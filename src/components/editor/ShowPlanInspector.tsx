/**
 * ShowPlanInspector — Navigable tree view of the ShowPlan data structure.
 * Shows counters per domain: pyro cues, DMX cues, drone paths, hardware modules.
 * Quick-export buttons for .fir, Art-Net patch CSV and drone waypoints CSV.
 */
import { useCallback, useState } from 'react';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { useVerificationStore } from '@/core/verification/useVerificationStore';
import { downloadFireOneScript } from '@/core/export/FireOneExporter';
import { downloadArtNetPatch } from '@/core/export/ArtNetPatchExporter';
import { downloadDroneCSV } from '@/core/export/DroneCSVExporter';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { Flame, Radio, Layers, Cpu, Shield, MapPin, FileOutput, Download, TestTube2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function CountBadge({ count, color }: { count: number; color: string }) {
  return (
    <span className={cn('text-[9px] font-mono font-bold px-1.5 py-0.5 rounded', color)}>
      {count}
    </span>
  );
}

export default function ShowPlanInspector() {
  const [, setTick] = useState(0);
  const sp = showPlanManager.current;
  const level = useVerificationStore(s => s.level);

  const handleLoadTestData = useCallback(() => {
    showPlanManager.loadTestData();
    setTick(t => t + 1);
  }, []);

  const sections = [
    {
      id: 'metadata',
      icon: Shield,
      label: 'METADATA',
      color: 'text-amber-400',
      badgeColor: 'bg-amber-500/15 text-amber-400',
      count: 1,
      content: (
        <div className="space-y-1 text-[9px] font-mono text-muted-foreground">
          <div><span className="text-foreground/60">Name:</span> {sp.metadata.name}</div>
          <div><span className="text-foreground/60">Venue:</span> {sp.metadata.venue || '—'}</div>
          <div><span className="text-foreground/60">Duration:</span> {sp.metadata.duration}s</div>
          <div><span className="text-foreground/60">Version:</span> {sp.metadata.version}</div>
          <div><span className="text-foreground/60">Author:</span> {sp.metadata.author || '—'}</div>
        </div>
      ),
    },
    {
      id: 'pyro',
      icon: Flame,
      label: 'PYRO CUES',
      color: 'text-red-400',
      badgeColor: 'bg-red-500/15 text-red-400',
      count: sp.pyroCues.length,
      content: sp.pyroCues.length === 0 ? (
        <p className="text-[9px] font-mono text-muted-foreground/50">No pyro cues defined</p>
      ) : (
        <div className="space-y-0.5 text-[9px] font-mono text-muted-foreground max-h-32 overflow-y-auto">
          {sp.pyroCues.slice(0, 20).map(c => (
            <div key={c.id} className="flex items-center gap-2">
              <span className="text-red-400/70">T{c.time.toFixed(1)}s</span>
              <span>M{c.module}:CH{c.channel}</span>
              <span className="text-muted-foreground/40">{c.caliber}mm</span>
            </div>
          ))}
          {sp.pyroCues.length > 20 && <p className="text-muted-foreground/40">+{sp.pyroCues.length - 20} more</p>}
        </div>
      ),
    },
    {
      id: 'dmx',
      icon: Radio,
      label: 'DMX CUES',
      color: 'text-blue-400',
      badgeColor: 'bg-blue-500/15 text-blue-400',
      count: sp.dmxCues.length,
      content: sp.dmxCues.length === 0 ? (
        <p className="text-[9px] font-mono text-muted-foreground/50">No DMX cues defined</p>
      ) : (
        <div className="space-y-0.5 text-[9px] font-mono text-muted-foreground max-h-32 overflow-y-auto">
          {sp.dmxCues.slice(0, 20).map(c => (
            <div key={c.id} className="flex items-center gap-2">
              <span className="text-blue-400/70">T{c.time.toFixed(1)}s</span>
              <span>U{c.universe}:CH{c.channel}</span>
              <span className="text-muted-foreground/40">V{c.value}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'drones',
      icon: Layers,
      label: 'DRONE PATHS',
      color: 'text-teal-400',
      badgeColor: 'bg-teal-500/15 text-teal-400',
      count: sp.dronePaths.length,
      content: sp.dronePaths.length === 0 ? (
        <p className="text-[9px] font-mono text-muted-foreground/50">No drone paths defined</p>
      ) : (
        <div className="space-y-0.5 text-[9px] font-mono text-muted-foreground">
          {sp.dronePaths.map(d => (
            <div key={d.id} className="flex items-center gap-2">
              <span className="text-teal-400/70">{d.droneId}</span>
              <span>{d.waypoints.length} waypoints</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'hardware',
      icon: Cpu,
      label: 'HARDWARE MODULES',
      color: 'text-cyan-400',
      badgeColor: 'bg-cyan-500/15 text-cyan-400',
      count: sp.hardwareConfig.modules.length,
      content: sp.hardwareConfig.modules.length === 0 ? (
        <p className="text-[9px] font-mono text-muted-foreground/50">No hardware modules configured</p>
      ) : (
        <div className="space-y-0.5 text-[9px] font-mono text-muted-foreground">
          {sp.hardwareConfig.modules.map(m => (
            <div key={m.id} className="flex items-center gap-2">
              <span className="text-cyan-400/70">{m.label}</span>
              <span>{m.channelCount}ch</span>
              <span className="text-muted-foreground/40">@{m.address}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'positions',
      icon: MapPin,
      label: 'POSITIONS',
      color: 'text-violet-400',
      badgeColor: 'bg-violet-500/15 text-violet-400',
      count: sp.positions.length,
      content: sp.positions.length === 0 ? (
        <p className="text-[9px] font-mono text-muted-foreground/50">No positions defined</p>
      ) : (
        <div className="text-[9px] font-mono text-muted-foreground">
          {sp.positions.slice(0, 10).map(p => (
            <div key={p.id}>{p.name} ({p.type})</div>
          ))}
          {sp.positions.length > 10 && <p className="text-muted-foreground/40">+{sp.positions.length - 10} more</p>}
        </div>
      ),
    },
    {
      id: 'exports',
      icon: FileOutput,
      label: 'EXPORT PROFILES',
      color: 'text-amber-400',
      badgeColor: 'bg-amber-500/15 text-amber-400',
      count: sp.exportProfiles.length,
      content: (
        <div className="space-y-0.5 text-[9px] font-mono text-muted-foreground">
          {sp.exportProfiles.map(e => (
            <div key={e.id}>{e.label} ({e.format})</div>
          ))}
        </div>
      ),
    },
  ];

  const handleExportFir = useCallback(() => downloadFireOneScript(), []);
  const handleExportArtNet = useCallback(() => downloadArtNetPatch(), []);
  const handleExportDrone = useCallback(() => downloadDroneCSV(), []);

  const hasPyro = sp.pyroCues.length > 0;
  const hasDmx = sp.dmxCues.length > 0;
  const hasDrones = sp.dronePaths.length > 0;
  const exportBlocked = level === 'BLOCKED';

  return (
    <div className="flex flex-col h-full p-3 gap-2 bg-background/80">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">
          ShowPlan Inspector
        </span>
        <span className={cn(
          'text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border',
          level === 'READY_FOR_FIELD' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
          level === 'BLOCKED' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
          'bg-amber-500/15 text-amber-400 border-amber-500/30'
        )}>
          {level.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Test Data + Quick Export */}
      <div className="flex items-center gap-1.5 border border-border/10 rounded p-2">
        <Button size="sm" variant="outline" onClick={handleLoadTestData}
          className="h-5 text-[8px] font-mono gap-1 px-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
          <TestTube2 className="w-2.5 h-2.5" /> LOAD TEST DATA
        </Button>
        <span className="text-[8px] font-mono text-muted-foreground/60 tracking-widest mr-auto">QUICK EXPORT</span>
        <Button size="sm" variant="outline" onClick={handleExportFir} disabled={!hasPyro || exportBlocked}
          className="h-5 text-[8px] font-mono gap-1 px-2">
          <Download className="w-2.5 h-2.5" /> .FIR
        </Button>
        <Button size="sm" variant="outline" onClick={handleExportArtNet} disabled={!hasDmx || exportBlocked}
          className="h-5 text-[8px] font-mono gap-1 px-2">
          <Download className="w-2.5 h-2.5" /> ART-NET
        </Button>
        <Button size="sm" variant="outline" onClick={handleExportDrone} disabled={!hasDrones || exportBlocked}
          className="h-5 text-[8px] font-mono gap-1 px-2">
          <Download className="w-2.5 h-2.5" /> DRONE
        </Button>
      </div>

      {/* Accordion tree */}
      <Accordion type="multiple" defaultValue={['metadata', 'pyro']} className="flex-1 overflow-y-auto">
        {sections.map(section => (
          <AccordionItem key={section.id} value={section.id} className="border-border/10">
            <AccordionTrigger className="py-2 text-[10px] font-mono tracking-widest hover:no-underline">
              <div className="flex items-center gap-2">
                <section.icon className={cn('w-3 h-3', section.color)} />
                <span className={section.color}>{section.label}</span>
                <CountBadge count={section.count} color={section.badgeColor} />
              </div>
            </AccordionTrigger>
            <AccordionContent className="pl-5 pb-2">
              {section.content}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
