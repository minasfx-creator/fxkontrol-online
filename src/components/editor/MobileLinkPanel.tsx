/**
 * MobileLinkPanel — Test Art-Net/Relay connectivity & trigger virtual fixtures
 * from mobile → desktop via Supabase Realtime broadcast.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Cable, Wifi, WifiOff, Plus, Trash2, Flame, X, Lightbulb, Zap, Wind, Snowflake, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import { useProjectStore } from '@/store/useProjectStore';

const FIXTURES_KEY = 'fxk-virtual-fixtures';
const CHANNEL_NAME = 'mobile-link';

type FixtureType = 'par' | 'wash' | 'strobe' | 'flame' | 'co2' | 'spark';

interface VirtualFixture {
  id: string;
  name: string;
  type: FixtureType;
  color: string;
  dmxUniverse: number;
  dmxAddress: number;
  intensity: number;
}

const FIXTURE_ICONS: Record<FixtureType, typeof Lightbulb> = {
  par: Lightbulb,
  wash: Lightbulb,
  strobe: Zap,
  flame: Flame,
  co2: Wind,
  spark: Sparkles,
};

const FIXTURE_LABELS: Record<FixtureType, string> = {
  par: 'PAR',
  wash: 'Wash',
  strobe: 'Strobe',
  flame: 'Flame',
  co2: 'CO2 Jet',
  spark: 'Spark',
};

const SFX_MAP: Record<FixtureType, 'flame' | 'cryo' | 'spark' | 'co2' | 'confetti' | 'custom'> = {
  par: 'custom',
  wash: 'custom',
  strobe: 'custom',
  flame: 'flame',
  co2: 'co2',
  spark: 'spark',
};

interface MobileLinkPanelProps {
  onClose: () => void;
}

export default function MobileLinkPanel({ onClose }: MobileLinkPanelProps) {
  const [fixtures, setFixtures] = useState<VirtualFixture[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [artnetStatus, setArtnetStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [artnetLatency, setArtnetLatency] = useState<number | null>(null);
  const [relayStatus, setRelayStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [relayLatency, setRelayLatency] = useState<number | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [firedIds, setFiredIds] = useState<Set<string>>(new Set());

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<FixtureType>('par');
  const [formColor, setFormColor] = useState('#ff0000');
  const [formUniverse, setFormUniverse] = useState(0);
  const [formAddress, setFormAddress] = useState(1);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fireEffect = useLiveSfxStore((s) => s.fireEffect);
  const projectId = useProjectStore((s) => s.projectId);

  // Load fixtures from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(FIXTURES_KEY) || '[]');
      setFixtures(stored);
    } catch { setFixtures([]); }
  }, []);

  // Save fixtures
  const saveFixtures = useCallback((f: VirtualFixture[]) => {
    setFixtures(f);
    localStorage.setItem(FIXTURES_KEY, JSON.stringify(f));
  }, []);

  // Subscribe to Realtime broadcast
  useEffect(() => {
    const ch = supabase.channel(CHANNEL_NAME);
    ch.on('broadcast', { event: 'fixture-fire' }, (msg) => {
      const p = msg.payload as { fixtureId: string; type: FixtureType; color: string; intensity: number };
      fireEffect({
        id: `link-${p.fixtureId}-${Date.now()}`,
        type: SFX_MAP[p.type] || 'custom',
        position: [0, 0, 0],
        color: p.color,
        intensity: p.intensity,
        startedAt: performance.now(),
        duration: 2000,
      });
    });
    ch.subscribe((status) => {
      setRealtimeConnected(status === 'SUBSCRIBED');
    });
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [fireEffect]);

  // Test Art-Net
  const testArtNet = useCallback(async () => {
    setArtnetStatus('testing');
    const t0 = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke('artnet-bridge', {
        body: {
          action: 'validate',
          universes: [{ universe: 0, subnet: 0, net: 0, channels: [0], sequence: 0 }],
        },
      });
      const lat = Math.round(performance.now() - t0);
      setArtnetLatency(lat);
      setArtnetStatus(error ? 'fail' : 'ok');
    } catch {
      setArtnetLatency(null);
      setArtnetStatus('fail');
    }
  }, []);

  // Test Relay
  const testRelay = useCallback(() => {
    setRelayStatus('testing');
    const t0 = performance.now();
    try {
      const ws = new WebSocket('ws://localhost:9001');
      const timeout = setTimeout(() => { ws.close(); setRelayStatus('fail'); }, 3000);
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'ping' }));
      };
      ws.onmessage = () => {
        clearTimeout(timeout);
        setRelayLatency(Math.round(performance.now() - t0));
        setRelayStatus('ok');
        ws.close();
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        setRelayStatus('fail');
        setRelayLatency(null);
      };
    } catch {
      setRelayStatus('fail');
    }
  }, []);

  // Add fixture
  const addFixture = useCallback(() => {
    if (!formName.trim()) return;
    const f: VirtualFixture = {
      id: crypto.randomUUID(),
      name: formName.trim(),
      type: formType,
      color: formColor,
      dmxUniverse: formUniverse,
      dmxAddress: formAddress,
      intensity: 255,
    };
    saveFixtures([...fixtures, f]);
    setFormName('');
    setShowForm(false);
    navigator.vibrate?.(15);
  }, [formName, formType, formColor, formUniverse, formAddress, fixtures, saveFixtures]);

  // Remove fixture
  const removeFixture = useCallback((id: string) => {
    saveFixtures(fixtures.filter(f => f.id !== id));
    navigator.vibrate?.(15);
  }, [fixtures, saveFixtures]);

  // Update intensity
  const updateIntensity = useCallback((id: string, intensity: number) => {
    saveFixtures(fixtures.map(f => f.id === id ? { ...f, intensity } : f));
  }, [fixtures, saveFixtures]);

  // FIRE a fixture
  const handleFire = useCallback((fixture: VirtualFixture) => {
    navigator.vibrate?.(30);

    // Local effect
    fireEffect({
      id: `link-${fixture.id}-${Date.now()}`,
      type: SFX_MAP[fixture.type] || 'custom',
      position: [0, 0, 0],
      color: fixture.color,
      intensity: fixture.intensity,
      startedAt: performance.now(),
      duration: 2000,
    });

    // Broadcast to other devices
    channelRef.current?.send({
      type: 'broadcast',
      event: 'fixture-fire',
      payload: {
        fixtureId: fixture.id,
        type: fixture.type,
        color: fixture.color,
        intensity: fixture.intensity,
      },
    });

    // Send to Art-Net bridge
    const channels = new Array(512).fill(0);
    const addr = fixture.dmxAddress - 1;
    channels[addr] = fixture.intensity;
    channels[addr + 1] = parseInt(fixture.color.slice(1, 3), 16);
    channels[addr + 2] = parseInt(fixture.color.slice(3, 5), 16);
    channels[addr + 3] = parseInt(fixture.color.slice(5, 7), 16);

    supabase.functions.invoke('artnet-bridge', {
      body: {
        action: 'send',
        universes: [{
          universe: fixture.dmxUniverse,
          subnet: 0,
          net: 0,
          channels,
          sequence: 0,
        }],
      },
    }).catch(() => {});

    // Flash feedback
    setFiredIds(prev => new Set(prev).add(fixture.id));
    setTimeout(() => setFiredIds(prev => {
      const next = new Set(prev);
      next.delete(fixture.id);
      return next;
    }), 300);
  }, [fireEffect]);

  const statusBadge = (status: 'idle' | 'testing' | 'ok' | 'fail', latency: number | null) => {
    if (status === 'idle') return <Badge variant="outline" className="text-[10px]">—</Badge>;
    if (status === 'testing') return <Badge variant="secondary" className="text-[10px] animate-pulse">Testing…</Badge>;
    if (status === 'ok') return <Badge className="text-[10px] bg-green-600 text-white">{latency}ms</Badge>;
    return <Badge variant="destructive" className="text-[10px]">Offline</Badge>;
  };

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Cable className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">Mobile Link</span>
          {realtimeConnected ? (
            <Wifi className="w-3 h-3 text-green-500" />
          ) : (
            <WifiOff className="w-3 h-3 text-destructive" />
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Slave Mode Indicator */}
      <div className="px-3 py-2 border-b border-border bg-accent/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5 text-accent-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Modo: SLAVE (Mobile)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "w-2 h-2 rounded-full",
              realtimeConnected ? "bg-green-500 animate-pulse" : "bg-destructive"
            )} />
            <span className="text-[9px] text-muted-foreground">
              {realtimeConnected ? 'Master conectado' : 'Sem Master'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Connection Tests */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Conexão</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-12 flex flex-col gap-0.5"
              onClick={testArtNet}
              disabled={artnetStatus === 'testing'}
            >
              <span className="text-[10px] font-bold">Art-Net</span>
              {statusBadge(artnetStatus, artnetLatency)}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-12 flex flex-col gap-0.5"
              onClick={testRelay}
              disabled={relayStatus === 'testing'}
            >
              <span className="text-[10px] font-bold">Relay UDP</span>
              {statusBadge(relayStatus, relayLatency)}
            </Button>
          </div>
        </div>

        {/* Virtual Fixtures */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fixtures Virtuais</h3>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setShowForm(!showForm)}>
              <Plus className="w-3 h-3 mr-1" /> Adicionar
            </Button>
          </div>

          {/* Add Form */}
          {showForm && (
            <Card className="border-primary/30">
              <CardContent className="p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px]">Nome</Label>
                    <Input
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="PAR 1"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Tipo</Label>
                    <Select value={formType} onValueChange={(v) => setFormType(v as FixtureType)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(FIXTURE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px]">Cor</Label>
                    <input
                      type="color"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      className="w-full h-8 rounded-md cursor-pointer border border-input"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Universo</Label>
                    <Input
                      type="number"
                      min={0}
                      max={15}
                      value={formUniverse}
                      onChange={(e) => setFormUniverse(Number(e.target.value))}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Endereço</Label>
                    <Input
                      type="number"
                      min={1}
                      max={512}
                      value={formAddress}
                      onChange={(e) => setFormAddress(Number(e.target.value))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <Button size="sm" className="w-full h-8" onClick={addFixture}>
                  <Plus className="w-3 h-3 mr-1" /> Criar Fixture
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Fixture Grid */}
          {fixtures.length === 0 && !showForm && (
            <p className="text-center text-[10px] text-muted-foreground py-6">
              Nenhuma fixture. Toque em "Adicionar" acima.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            {fixtures.map((fixture) => {
              const Icon = FIXTURE_ICONS[fixture.type];
              const isFired = firedIds.has(fixture.id);
              return (
                <Card
                  key={fixture.id}
                  className={cn(
                    "relative overflow-hidden transition-all",
                    isFired && "ring-2 ring-accent shadow-[0_0_16px_hsl(var(--accent)/0.5)]"
                  )}
                >
                  <CardContent className="p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-3 h-3 rounded-full border border-border"
                          style={{ backgroundColor: fixture.color }}
                        />
                        <span className="text-[10px] font-bold truncate max-w-[60px]">{fixture.name}</span>
                      </div>
                      <button
                        onClick={() => removeFixture(fixture.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
                      <Icon className="w-2.5 h-2.5" />
                      <span>{FIXTURE_LABELS[fixture.type]}</span>
                      <span>U{fixture.dmxUniverse}.{fixture.dmxAddress}</span>
                    </div>

                    <Slider
                      min={0}
                      max={255}
                      step={1}
                      value={[fixture.intensity]}
                      onValueChange={([v]) => updateIntensity(fixture.id, v)}
                      className="py-1"
                    />

                    <Button
                      size="sm"
                      variant="destructive"
                      className={cn(
                        "w-full h-12 text-sm font-black uppercase tracking-wider",
                        "active:scale-95 transition-transform"
                      )}
                      onClick={() => handleFire(fixture)}
                    >
                      <Flame className="w-4 h-4 mr-1" />
                      FIRE
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
