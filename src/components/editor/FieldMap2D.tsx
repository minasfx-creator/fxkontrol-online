/**
 * FieldMap2D — 2D site map with live hardware overlay
 * Shows FireOne modules and PBUS devices with RSSI, continuity, and safety zones
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { MapPin, Wifi, Radio, Battery, Shield, Eye, EyeOff, ZoomIn, ZoomOut, Crosshair, RotateCcw, Zap, Antenna } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { usePBusHardware } from '@/hooks/usePBusHardware';
import { useRadioLink } from '@/hooks/useRadioLink';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ModulePosition {
  id: string;
  type: 'fireone' | 'pbus';
  address: number;
  x: number;
  y: number;
  label: string;
}

interface FieldMap2DProps {
  fs?: boolean;
  onClose?: () => void;
}

export default function FieldMap2D({ fs = false, onClose }: FieldMap2DProps) {
  const isMobile = useIsMobile();
  const fireone = useFireOneHardware();
  const pbus = usePBusHardware();
  const radioLink = useRadioLink();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showRssi, setShowRssi] = useState(true);
  const [showContinuity, setShowContinuity] = useState(true);
  const [showSafetyZones, setShowSafetyZones] = useState(true);
  const [showRadioHeatmap, setShowRadioHeatmap] = useState(true);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [antennaPos, setAntennaPos] = useState({ x: 300, y: 500 });
  const [draggingAntenna, setDraggingAntenna] = useState(false);
  const [firePopup, setFirePopup] = useState<{ id: string; x: number; y: number } | null>(null);

  // Module positions — auto-generate from hardware state
  const [modulePositions, setModulePositions] = useState<ModulePosition[]>([]);

  // Sync module positions from hardware
  useEffect(() => {
    const positions: ModulePosition[] = [];
    let idx = 0;
    fireone.modules.forEach((mod, addr) => {
      const existing = modulePositions.find(p => p.id === `fo-${addr}`);
      positions.push({
        id: `fo-${addr}`,
        type: 'fireone',
        address: addr,
        x: existing?.x ?? 100 + (idx % 6) * 80,
        y: existing?.y ?? 100 + Math.floor(idx / 6) * 80,
        label: `FO-${addr}`,
      });
      idx++;
    });
    pbus.devices.forEach((dev, addr) => {
      const existing = modulePositions.find(p => p.id === `pb-${addr}`);
      positions.push({
        id: `pb-${addr}`,
        type: 'pbus',
        address: addr,
        x: existing?.x ?? 400 + (idx % 6) * 80,
        y: existing?.y ?? 100 + Math.floor(idx / 6) * 80,
        label: `PB-${addr}`,
      });
      idx++;
    });
    // Only add demo modules if no real hardware
    if (positions.length === 0) {
      for (let i = 0; i < 8; i++) {
        positions.push({
          id: `demo-fo-${i}`,
          type: 'fireone',
          address: i + 1,
          x: 80 + (i % 4) * 120,
          y: 120 + Math.floor(i / 4) * 120,
          label: `FO-${i + 1}`,
        });
      }
      for (let i = 0; i < 4; i++) {
        positions.push({
          id: `demo-pb-${i}`,
          type: 'pbus',
          address: i + 1,
          x: 80 + (i % 4) * 120,
          y: 360,
          label: `C16-${i + 1}`,
        });
      }
    }
    setModulePositions(positions);
  }, [fireone.modules, pbus.devices]);

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(2, 2);
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Grid
    ctx.strokeStyle = 'hsla(220, 10%, 20%, 0.3)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < 1200; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 800); ctx.stroke();
    }
    for (let y = 0; y < 800; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1200, y); ctx.stroke();
    }

    // Safety zones
    if (showSafetyZones) {
      // Audience zone
      ctx.fillStyle = 'hsla(200, 60%, 40%, 0.06)';
      ctx.strokeStyle = 'hsla(200, 60%, 50%, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(20, 440, 560, 120);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'hsla(200, 60%, 60%, 0.4)';
      ctx.font = '10px monospace';
      ctx.fillText('AUDIENCE ZONE', 240, 505);

      // Safety perimeter
      ctx.strokeStyle = 'hsla(0, 60%, 50%, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.rect(10, 10, 580, 580);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'hsla(0, 60%, 50%, 0.3)';
      ctx.font = '9px monospace';
      ctx.fillText('SAFETY PERIMETER', 220, 25);
    }

    // Draw modules
    modulePositions.forEach(mod => {
      const isSelected = selectedModule === mod.id;
      const x = mod.x;
      const y = mod.y;

      if (mod.type === 'fireone') {
        // FireOne: square
        const foMod = fireone.modules.get(mod.address);
        const armed = foMod?.armed ?? false;
        const lowBatt = ((foMod as any)?.voltage ?? (foMod as any)?.batteryVoltage ?? 12) < 11;
        const weakSignal = (foMod?.rssiDbm ?? -50) < -75;

        const color = armed ? 'hsla(120, 60%, 45%, 0.8)' : lowBatt ? 'hsla(40, 80%, 50%, 0.8)' : weakSignal ? 'hsla(0, 70%, 50%, 0.8)' : 'hsla(210, 60%, 50%, 0.8)';

        ctx.fillStyle = color;
        ctx.fillRect(x - 16, y - 16, 32, 32);
        ctx.strokeStyle = isSelected ? 'hsla(210, 80%, 60%, 1)' : 'hsla(220, 10%, 30%, 0.5)';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(x - 16, y - 16, 32, 32);

        // RSSI ring
        if (showRssi && foMod?.rssiDbm !== undefined) {
          const rssi = foMod.rssiDbm;
          const radius = 25 + Math.max(0, (rssi + 100) / 2);
          ctx.strokeStyle = rssi >= -60 ? 'hsla(120, 50%, 50%, 0.2)' : rssi >= -75 ? 'hsla(40, 60%, 50%, 0.2)' : 'hsla(0, 60%, 50%, 0.2)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke();
        }

        // Label
        ctx.fillStyle = 'hsla(0, 0%, 90%, 0.7)';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(mod.label, x, y + 4);
        ctx.textAlign = 'start';
      } else {
        // PBUS: circle
        const pbDev = pbus.devices.get(mod.address);

        ctx.fillStyle = pbDev ? 'hsla(40, 70%, 45%, 0.7)' : 'hsla(40, 30%, 40%, 0.4)';
        ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = isSelected ? 'hsla(40, 80%, 60%, 1)' : 'hsla(220, 10%, 30%, 0.5)';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        // Dual-band RSSI rings
        if (showRssi && pbDev) {
          // 433M (inner blue)
          const r433 = 25 + Math.max(0, (pbDev.rssi433 + 100) / 2);
          ctx.strokeStyle = 'hsla(210, 70%, 50%, 0.15)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, r433, 0, Math.PI * 2); ctx.stroke();

          // 868M (outer cyan)
          const r868 = 25 + Math.max(0, (pbDev.rssi868 + 100) / 2);
          ctx.strokeStyle = 'hsla(180, 70%, 50%, 0.15)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, r868, 0, Math.PI * 2); ctx.stroke();
        }

        // Label
        ctx.fillStyle = 'hsla(0, 0%, 90%, 0.7)';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(mod.label, x, y + 4);
        ctx.textAlign = 'start';
      }
    });

    // ── Radio RSSI Heatmap Overlay ──────────────────────
    if (showRadioHeatmap && radioLink.isConnected && radioLink.devices.size > 0) {
      // Draw antenna position marker
      const ax = antennaPos.x;
      const ay = antennaPos.y;

      // Heatmap: calculate RSSI at grid points based on distance from antenna
      const gridStep = 20;
      for (let gx = 0; gx < 1200; gx += gridStep) {
        for (let gy = 0; gy < 800; gy += gridStep) {
          const dist = Math.sqrt((gx - ax) ** 2 + (gy - ay) ** 2);
          // Simulate RSSI decay: -40dBm at 0m, -3dBm per 20px (~5m)
          const simRssi = -40 - dist * 0.15;
          const clampedRssi = Math.max(-100, Math.min(-30, simRssi));
          // Map to color: green(-30 to -60), amber(-60 to -80), red(-80 to -100)
          let hue: number;
          let alpha: number;
          if (clampedRssi >= -60) {
            hue = 120; // green
            alpha = 0.08 + (clampedRssi + 60) / 30 * 0.07;
          } else if (clampedRssi >= -80) {
            hue = 40; // amber
            alpha = 0.05 + (clampedRssi + 80) / 20 * 0.05;
          } else {
            hue = 0; // red
            alpha = 0.03;
          }
          ctx.fillStyle = `hsla(${hue}, 60%, 50%, ${alpha})`;
          ctx.fillRect(gx, gy, gridStep, gridStep);
        }
      }

      // Draw real device RSSI dots
      radioLink.devices.forEach(dev => {
        const modPos = modulePositions.find(m => m.address === dev.address);
        if (modPos) {
          const rssi = dev.rssi;
          const hue = rssi >= -60 ? 120 : rssi >= -80 ? 40 : 0;
          ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.6)`;
          ctx.beginPath();
          ctx.arc(modPos.x, modPos.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `hsla(0, 0%, 100%, 0.5)`;
          ctx.font = '7px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${rssi}dBm`, modPos.x, modPos.y - 10);
          ctx.textAlign = 'start';
        }
      });

      // Antenna marker (draggable triangle)
      ctx.fillStyle = 'hsla(270, 70%, 60%, 0.9)';
      ctx.beginPath();
      ctx.moveTo(ax, ay - 14);
      ctx.lineTo(ax - 10, ay + 8);
      ctx.lineTo(ax + 10, ay + 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'hsla(270, 80%, 70%, 1)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'hsla(0, 0%, 100%, 0.7)';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ANT', ax, ay + 20);
      ctx.textAlign = 'start';

      // Coverage radius ring (approx -80dBm boundary)
      const coverageR = (80 - 40) / 0.15; // pixels where RSSI = -80dBm
      ctx.strokeStyle = 'hsla(270, 50%, 50%, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(ax, ay, coverageR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Distance rulers to audience
    if (showSafetyZones) {
      modulePositions.forEach(mod => {
        const dist = Math.abs(440 - mod.y);
        if (dist > 30) {
          ctx.strokeStyle = 'hsla(0, 0%, 50%, 0.15)';
          ctx.lineWidth = 0.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(mod.x, mod.y + 18); ctx.lineTo(mod.x, 440); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'hsla(0, 0%, 60%, 0.3)';
          ctx.font = '7px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${Math.round(dist * 0.25)}m`, mod.x, (mod.y + 440) / 2);
          ctx.textAlign = 'start';
        }
      });
    }

    ctx.restore();
  }, [modulePositions, zoom, pan, showRssi, showContinuity, showSafetyZones, showRadioHeatmap, selectedModule, fireone.modules, pbus.devices, radioLink, antennaPos]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - pan.x) / zoom;
    const my = (e.clientY - rect.top - pan.y) / zoom;

    const clicked = modulePositions.find(m => Math.abs(m.x - mx) < 20 && Math.abs(m.y - my) < 20);

    // Check antenna click for dragging
    if (Math.abs(mx - antennaPos.x) < 15 && Math.abs(my - antennaPos.y) < 15) {
      setDraggingAntenna(true);
      return;
    }

    // Click-to-fire popup
    if (clicked) {
      setFirePopup({ id: clicked.id, x: e.clientX, y: e.clientY });
      setSelectedModule(clicked.id);
    } else {
      setFirePopup(null);
      setSelectedModule(null);
    }
  }, [modulePositions, zoom, pan, antennaPos]);

  const mob = isMobile;

  return (
    <div className="flex flex-col h-full" style={{ background: 'hsl(220 12% 5%)' }}>
      {/* Toolbar */}
      <div className={cn("flex items-center gap-2 border-b border-border/15 flex-wrap", fs ? "px-4 py-2" : "px-2 py-1.5")} style={{ background: 'hsl(220 15% 8%)' }}>
        <span className={cn("font-black uppercase tracking-wider text-foreground", fs ? "text-xs" : "text-[10px]")}>Field Map</span>
        <div className="flex-1" />
        
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setZoom(z => Math.min(3, z * 1.25))}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[8px] font-mono text-muted-foreground/40 w-8 text-center">{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setZoom(z => Math.max(0.3, z / 1.25))}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-3 text-[8px]">
          <label className="flex items-center gap-1 text-muted-foreground/50 cursor-pointer">
            <Switch checked={showRssi} onCheckedChange={setShowRssi} className="h-3.5 w-7" />
            RSSI
          </label>
          <label className="flex items-center gap-1 text-muted-foreground/50 cursor-pointer">
            <Switch checked={showSafetyZones} onCheckedChange={setShowSafetyZones} className="h-3.5 w-7" />
            Safety
          </label>
          {radioLink.isConnected && (
            <label className="flex items-center gap-1 text-muted-foreground/50 cursor-pointer">
              <Switch checked={showRadioHeatmap} onCheckedChange={setShowRadioHeatmap} className="h-3.5 w-7" />
              Radio
            </label>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={(e) => {
            if (draggingAntenna) {
              const rect = canvasRef.current!.getBoundingClientRect();
              setAntennaPos({
                x: (e.clientX - rect.left - pan.x) / zoom,
                y: (e.clientY - rect.top - pan.y) / zoom,
              });
            }
          }}
          onMouseUp={() => setDraggingAntenna(false)}
          onMouseLeave={() => setDraggingAntenna(false)}
          className="absolute inset-0"
        />
        {/* Click-to-fire popup */}
        {firePopup && (
          <div className="absolute z-10 p-1.5 rounded border border-border/30 bg-background/90 backdrop-blur-sm shadow-lg"
            style={{ left: firePopup.x - 60, top: firePopup.y - 80 }}>
            <div className="text-[8px] font-bold text-foreground mb-1">
              {modulePositions.find(m => m.id === firePopup.id)?.label}
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-5 text-[7px] px-1.5"
                onClick={() => {
                  const mod = modulePositions.find(m => m.id === firePopup.id);
                  if (mod?.type === 'pbus' && pbus.isConnected) {
                    pbus.armDevice(mod.address).catch(() => {});
                    toast.info(`ARM PB-${mod.address}`);
                  }
                  setFirePopup(null);
                }}>
                ARM
              </Button>
              <Button size="sm" variant="destructive" className="h-5 text-[7px] px-1.5"
                onClick={() => {
                  const mod = modulePositions.find(m => m.id === firePopup.id);
                  if (mod?.type === 'pbus' && pbus.isConnected) {
                    pbus.fireCue(mod.address, 0, 500).catch(() => {});
                    toast.warning(`FIRE PB-${mod.address}:0`);
                  } else if (mod?.type === 'fireone' && fireone.isConnected) {
                    fireone.fireIgniter(mod.address, 0, 500).catch(() => {});
                    toast.warning(`FIRE FO-${mod.address}:0`);
                  }
                  setFirePopup(null);
                }}>
                <Zap className="w-2.5 h-2.5 mr-0.5" /> FIRE
              </Button>
              <Button size="sm" variant="ghost" className="h-5 text-[7px] px-1" onClick={() => setFirePopup(null)}>
                ✕
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Legend / Selected info */}
      <div className={cn("flex items-center gap-3 border-t border-border/15", fs ? "px-4 py-2" : "px-2 py-1.5")} style={{ background: 'hsl(220 12% 7%)' }}>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-blue-500/70 rounded-sm" />
          <span className="text-[8px] text-muted-foreground/40">FireOne</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-amber-500/70 rounded-full" />
          <span className="text-[8px] text-muted-foreground/40">PBUS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border border-green-500/30" />
          <span className="text-[8px] text-muted-foreground/40">RSSI</span>
        </div>
        {radioLink.isConnected && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: 'hsla(270, 70%, 60%, 0.6)' }} />
            <span className="text-[8px] text-muted-foreground/40">Radio ({radioLink.devices.size})</span>
          </div>
        )}
        <div className="flex-1" />
        {selectedModule && (
          <Badge variant="outline" className="text-[8px] h-4 px-1.5">
            {modulePositions.find(m => m.id === selectedModule)?.label}
          </Badge>
        )}
        <span className="text-[8px] font-mono text-muted-foreground/30">
          {modulePositions.length} módulos
        </span>
      </div>
    </div>
  );
}
