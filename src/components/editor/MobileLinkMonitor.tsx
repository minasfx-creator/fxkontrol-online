/**
 * MobileLinkMonitor — Desktop overlay that shows real-time fire events
 * received from mobile devices via Supabase Realtime broadcast.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Cable, Wifi, WifiOff, Flame, Zap, Wind, Sparkles, Lightbulb, X, Monitor, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';

const CHANNEL_NAME = 'mobile-link';

type FixtureType = 'par' | 'wash' | 'strobe' | 'flame' | 'co2' | 'spark';

interface FireEvent {
  id: string;
  fixtureId: string;
  type: FixtureType;
  color: string;
  intensity: number;
  timestamp: number;
  source: 'mobile' | 'desktop';
}

const SFX_MAP: Record<FixtureType, 'flame' | 'cryo' | 'spark' | 'co2' | 'confetti' | 'custom'> = {
  par: 'custom',
  wash: 'custom',
  strobe: 'custom',
  flame: 'flame',
  co2: 'co2',
  spark: 'spark',
};

const ICON_MAP: Record<FixtureType, typeof Lightbulb> = {
  par: Lightbulb,
  wash: Lightbulb,
  strobe: Zap,
  flame: Flame,
  co2: Wind,
  spark: Sparkles,
};

const TYPE_LABELS: Record<FixtureType, string> = {
  par: 'PAR',
  wash: 'Wash',
  strobe: 'Strobe',
  flame: 'Flame',
  co2: 'CO2',
  spark: 'Spark',
};

interface MobileLinkMonitorProps {
  onClose: () => void;
}

export default function MobileLinkMonitor({ onClose }: MobileLinkMonitorProps) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<FireEvent[]>([]);
  const [flashId, setFlashId] = useState<string | null>(null);
  const fireEffect = useLiveSfxStore((s) => s.fireEffect);
  const maxEvents = 20;

  useEffect(() => {
    const ch = supabase.channel(CHANNEL_NAME);
    ch.on('broadcast', { event: 'fixture-fire' }, (msg) => {
      const p = msg.payload as { fixtureId: string; type: FixtureType; color: string; intensity: number };
      const eventId = `${p.fixtureId}-${Date.now()}`;

      // Fire local effect
      fireEffect({
        id: `link-${eventId}`,
        type: SFX_MAP[p.type] || 'custom',
        position: [0, 0, 0],
        color: p.color,
        intensity: p.intensity,
        startedAt: performance.now(),
        duration: 2000,
      });

      // Add to event log
      const evt: FireEvent = {
        id: eventId,
        fixtureId: p.fixtureId,
        type: p.type,
        color: p.color,
        intensity: p.intensity,
        timestamp: Date.now(),
        source: 'mobile',
      };
      setEvents(prev => [evt, ...prev].slice(0, maxEvents));
      setFlashId(eventId);
      setTimeout(() => setFlashId(null), 500);
    });

    ch.subscribe((status) => {
      setConnected(status === 'SUBSCRIBED');
    });

    return () => { supabase.removeChannel(ch); };
  }, [fireEffect]);

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Smartphone className="w-3 h-3 text-primary" />
            <span className="text-[10px] text-muted-foreground">→</span>
            <Monitor className="w-3 h-3 text-primary" />
          </div>
          <span className="text-sm font-bold">Link Monitor</span>
          {connected ? (
            <Badge className="text-[8px] bg-green-600 text-white gap-1 px-1.5 py-0">
              <Wifi className="w-2.5 h-2.5" /> ONLINE
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-[8px] gap-1 px-1.5 py-0">
              <WifiOff className="w-2.5 h-2.5" /> OFFLINE
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Master-Slave Status */}
      <div className="px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Modo: MASTER (Desktop)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "w-2 h-2 rounded-full",
              connected ? "bg-green-500 animate-pulse" : "bg-destructive"
            )} />
            <span className="text-[9px] text-muted-foreground">
              {connected ? 'Slave conectado' : 'Aguardando slave…'}
            </span>
          </div>
        </div>
      </div>

      {/* Event Log */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <Cable className="w-8 h-8 opacity-30" />
            <p className="text-[10px] text-center">
              Aguardando acionamentos do celular…<br />
              Abra o <strong>Mobile Link</strong> no celular e toque <strong>FIRE</strong>.
            </p>
          </div>
        )}
        {events.map((evt) => {
          const Icon = ICON_MAP[evt.type] || Flame;
          const isFlash = flashId === evt.id;
          const time = new Date(evt.timestamp);
          const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}.${time.getMilliseconds().toString().padStart(3, '0')}`;

          return (
            <div
              key={evt.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md border transition-all duration-300",
                isFlash
                  ? "border-accent bg-accent/20 shadow-[0_0_12px_hsl(var(--accent)/0.4)]"
                  : "border-border bg-muted/20"
              )}
            >
              {/* Color dot + icon */}
              <div
                className={cn(
                  "w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-transform",
                  isFlash && "scale-125"
                )}
                style={{ backgroundColor: evt.color + '33' }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: evt.color }} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold">{TYPE_LABELS[evt.type]}</span>
                  <div
                    className="w-2 h-2 rounded-full border border-border shrink-0"
                    style={{ backgroundColor: evt.color }}
                  />
                  <Badge variant="outline" className="text-[8px] px-1 py-0">
                    {Math.round((evt.intensity / 255) * 100)}%
                  </Badge>
                </div>
                <span className="text-[8px] text-muted-foreground font-mono">{timeStr}</span>
              </div>

              {/* Source */}
              <Smartphone className="w-3 h-3 text-primary shrink-0" />
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border">
        <div className="flex items-center justify-between text-[9px] text-muted-foreground">
          <span>{events.length} evento(s) recebido(s)</span>
          {events.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-2 text-[9px]"
              onClick={() => setEvents([])}
            >
              Limpar log
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
