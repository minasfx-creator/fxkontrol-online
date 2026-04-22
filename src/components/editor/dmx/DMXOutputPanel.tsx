/**
 * DMXOutputPanel — Wired USB-C/Lightning DMX output dashboard
 * Port selection, adapter detection, universe, FPS, live channel monitor.
 */
import { useState, useCallback, useRef } from 'react';
import { Cable, Play, Square, RefreshCw, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  DMX_ADAPTERS,
  openDMXOutput,
  closeDMXOutput,
  startDMXStream,
  stopDMXStream,
  type DMXOutputStream,
  type DMXOutputAdapter,
} from '@/lib/wiredDmxEngine';
import { isWebSerialSupported } from '@/lib/usbEngine';

interface DMXOutputPanelProps {
  onClose?: () => void;
}

export default function DMXOutputPanel({ onClose }: DMXOutputPanelProps) {
  const [stream, setStream] = useState<DMXOutputStream | null>(null);
  const [selectedAdapter, setSelectedAdapter] = useState<DMXOutputAdapter>(DMX_ADAPTERS[0]);
  const [universe, setUniverse] = useState(1);
  const [fps, setFps] = useState(44);
  const [streaming, setStreaming] = useState(false);
  const channelsRef = useRef(new Uint8Array(512));
  const supported = isWebSerialSupported();

  const handleOpenPort = useCallback(async () => {
    try {
      const s = await openDMXOutput(selectedAdapter);
      s.universe = universe;
      s.fps = fps;
      setStream(s);
      toast.success(`🔌 ${selectedAdapter.name} conectado`);
    } catch (err: any) {
      toast.error(`DMX: ${err.message}`);
    }
  }, [selectedAdapter, universe, fps]);

  const handleClosePort = useCallback(async () => {
    if (stream) {
      await closeDMXOutput(stream);
      setStream(null);
      setStreaming(false);
      toast.info('DMX output fechado');
    }
  }, [stream]);

  const handleToggleStream = useCallback(() => {
    if (!stream) return;
    if (streaming) {
      stopDMXStream(stream);
      setStreaming(false);
      toast.info('Stream parado');
    } else {
      startDMXStream(stream, () => channelsRef.current, fps);
      setStreaming(true);
      toast.success(`▶ DMX streaming @ ${fps}fps`);
    }
  }, [stream, streaming, fps]);

  // Mini channel grid (first 64 channels)
  const channelGrid = Array.from({ length: 64 }, (_, i) => channelsRef.current[i] || 0);

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cable className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-black uppercase tracking-wider text-foreground">DMX Output</h3>
        </div>
        <Badge variant={streaming ? 'default' : 'secondary'} className="text-[8px]">
          {streaming ? 'Streaming' : stream ? 'Pronto' : 'Desconectado'}
        </Badge>
      </div>

      {!supported && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2">
          <p className="text-[9px] text-destructive">WebSerial não disponível. Use Chrome/Edge ou o app nativo.</p>
        </div>
      )}

      {/* Adapter selection */}
      <div className="space-y-1">
        <p className="text-[8px] text-muted-foreground uppercase font-semibold">Adaptador DMX:</p>
        <select
          className="w-full h-8 bg-background border border-border rounded text-[9px] px-2"
          value={selectedAdapter.id}
          onChange={(e) => setSelectedAdapter(DMX_ADAPTERS.find(a => a.id === e.target.value) || DMX_ADAPTERS[0])}
          disabled={!!stream}
        >
          {DMX_ADAPTERS.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <p className="text-[7px] text-muted-foreground/60">{selectedAdapter.description}</p>
      </div>

      {/* Settings */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[8px] text-muted-foreground mb-1">Universo</p>
          <select
            className="w-full h-7 bg-background border border-border rounded text-[9px] px-1"
            value={universe}
            onChange={(e) => setUniverse(Number(e.target.value))}
            disabled={streaming}
          >
            {Array.from({ length: 16 }, (_, i) => (
              <option key={i + 1} value={i + 1}>Universe {i + 1}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-[8px] text-muted-foreground mb-1">FPS: {fps}</p>
          <Slider
            value={[fps]}
            min={1}
            max={44}
            step={1}
            onValueChange={([v]) => setFps(v)}
            disabled={streaming}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {!stream ? (
          <Button onClick={handleOpenPort} disabled={!supported} className="flex-1 h-9 text-[10px]">
            <Cable className="w-3 h-3 mr-1" /> Abrir Porta
          </Button>
        ) : (
          <>
            <Button onClick={handleToggleStream} className={cn("flex-1 h-9 text-[10px]", streaming && "bg-destructive hover:bg-destructive/90")}>
              {streaming ? <><Square className="w-3 h-3 mr-1" /> Parar</> : <><Play className="w-3 h-3 mr-1" /> Iniciar</>}
            </Button>
            <Button onClick={handleClosePort} variant="outline" className="h-9 text-[10px]">
              Fechar
            </Button>
          </>
        )}
      </div>

      {/* Stats */}
      {stream && (
        <div className="flex items-center justify-between text-[8px] text-muted-foreground bg-muted/10 rounded p-1.5">
          <span>Frames: {stream.framesSent}</span>
          <span>{selectedAdapter.baudRate / 1000}k baud</span>
          <span>{selectedAdapter.useWidgetProtocol ? 'Widget' : 'Direct'}</span>
        </div>
      )}

      {/* Channel mini-grid */}
      {stream && (
        <div className="space-y-1">
          <p className="text-[8px] text-muted-foreground uppercase font-semibold flex items-center gap-1">
            <Activity className="w-3 h-3" /> Canais 1–64
          </p>
          <div className="grid grid-cols-16 gap-px">
            {channelGrid.map((val, i) => (
              <div
                key={i}
                className="w-full aspect-square rounded-sm"
                style={{ backgroundColor: `hsl(var(--primary) / ${val / 255})` }}
                title={`CH${i + 1}: ${val}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
