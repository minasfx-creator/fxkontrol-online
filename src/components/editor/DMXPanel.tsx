import { useState, useMemo, useCallback } from 'react';
import { Lightbulb, Plus, Trash2, Send, Wifi, Activity, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore } from '@/store/useProjectStore';
import {
  autoPatchDrones,
  setFixtureColor,
  hexToDMX,
  exportDMXCSV,
  type DMXUniverse,
  type DMXKeyframe,
} from '@/lib/dmxEngine';
import { downloadFile } from '@/lib/exportEngine';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DiagnosticLog {
  timestamp: Date;
  type: 'send' | 'validate' | 'error' | 'info';
  message: string;
  latency?: number;
  packets?: Array<{ universe: number; hex: string; channels: number; packetSize: number }>;
  raw?: any;
}

export default function DMXPanel({ onClose }: { onClose: () => void }) {
  const { droneFormations, currentTime } = useProjectStore();
  const [universes, setUniverses] = useState<DMXUniverse[]>([]);
  const [keyframes, setKeyframes] = useState<DMXKeyframe[]>([]);
  const [selectedFixture, setSelectedFixture] = useState<string | null>(null);
  const [channelsPerFixture, setChannelsPerFixture] = useState(4);
  const [artNetIp, setArtNetIp] = useState('255.255.255.255');
  const [artNetPort, setArtNetPort] = useState(6454);
  const [sending, setSending] = useState(false);
  const [diagLogs, setDiagLogs] = useState<DiagnosticLog[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [showDiag, setShowDiag] = useState(true);

  const addDiagLog = useCallback((log: DiagnosticLog) => {
    setDiagLogs(prev => [log, ...prev].slice(0, 50));
  }, []);

  const totalDrones = useMemo(() => {
    if (droneFormations.length === 0) return 0;
    return droneFormations[0].droneCount;
  }, [droneFormations]);

  const totalFixtures = useMemo(() => universes.reduce((sum, u) => sum + u.fixtures.length, 0), [universes]);

  const autoPatch = () => {
    if (totalDrones === 0) {
      toast.error('Nenhuma formação de drones encontrada');
      return;
    }
    const newUniverses = autoPatchDrones(totalDrones, channelsPerFixture);
    setUniverses(newUniverses);
    addDiagLog({ timestamp: new Date(), type: 'info', message: `Auto-Patch: ${totalDrones} fixtures → ${newUniverses.length} universo(s)` });
    toast.success(`Patch automático: ${totalDrones} fixtures em ${newUniverses.length} universo(s)`);
  };

  const addKeyframe = () => {
    if (!selectedFixture) {
      toast.error('Selecione uma fixture primeiro');
      return;
    }
    const kf: DMXKeyframe = {
      time: currentTime,
      fixtureId: selectedFixture,
      r: 255, g: 255, b: 255, w: 0,
    };
    setKeyframes(prev => [...prev, kf]);
    toast.success(`Keyframe DMX adicionado em ${currentTime.toFixed(1)}s`);
  };

  const exportCSV = () => {
    if (keyframes.length === 0) {
      toast.error('Adicione keyframes antes de exportar');
      return;
    }
    const csv = exportDMXCSV({ universes, keyframes, fps: 44 });
    downloadFile(csv, 'dmx_show.csv', 'text/csv');
    toast.success('DMX CSV exportado!');
  };

  const testConnection = async () => {
    setConnectionStatus('testing');
    const t0 = performance.now();
    try {
      const testUniverse = {
        universe: 0, subnet: 0, net: 0,
        channels: Array.from({ length: 512 }, () => 0),
        sequence: 0,
      };
      const { data, error } = await supabase.functions.invoke('artnet-bridge', {
        body: { action: 'validate', universes: [testUniverse] },
      });
      const latency = Math.round(performance.now() - t0);
      if (error) throw error;
      setConnectionStatus(data.valid ? 'ok' : 'error');
      addDiagLog({
        timestamp: new Date(), type: data.valid ? 'validate' : 'error',
        message: data.valid
          ? `Conexão OK — ${data.universeCount} uni, ${data.totalChannels} ch`
          : `Validação falhou: ${data.errors?.join(', ')}`,
        latency, raw: data,
      });
    } catch (e: any) {
      setConnectionStatus('error');
      const latency = Math.round(performance.now() - t0);
      addDiagLog({ timestamp: new Date(), type: 'error', message: e.message || 'Falha na conexão', latency });
    }
  };

  const sendArtNet = async () => {
    if (universes.length === 0) {
      toast.error('Faça o Auto-Patch primeiro');
      return;
    }
    setSending(true);
    const t0 = performance.now();
    try {
      const artNetUniverses = universes.map((u, i) => ({
        universe: u.id % 16,
        subnet: Math.floor(u.id / 16) % 16,
        net: Math.floor(u.id / 256),
        channels: Array.from(u.channels),
        sequence: i,
      }));

      const { data, error } = await supabase.functions.invoke('artnet-bridge', {
        body: { action: 'send', universes: artNetUniverses, targetIp: artNetIp, targetPort: artNetPort },
      });
      const latency = Math.round(performance.now() - t0);
      if (error) throw error;

      setConnectionStatus('ok');
      addDiagLog({
        timestamp: new Date(), type: 'send',
        message: `${data.packetCount} pacote(s) → ${artNetIp}:${artNetPort} · ${data.totalBytes} bytes`,
        latency,
        packets: data.packets,
        raw: data,
      });
      toast.success(`${data.packetCount} pacote(s) Art-Net preparados`, {
        description: `Target: ${artNetIp}:${artNetPort} · ${data.totalBytes} bytes`,
      });
    } catch (e: any) {
      const latency = Math.round(performance.now() - t0);
      setConnectionStatus('error');
      addDiagLog({ timestamp: new Date(), type: 'error', message: e.message || 'Erro ao enviar Art-Net', latency });
      toast.error(e.message || 'Erro ao enviar Art-Net');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full bg-surface-1 border-l border-border flex flex-col">
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">DMX512 / Art-Net</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Status */}
        <div className="grid grid-cols-3 gap-1 text-center">
          <div className="bg-surface-2 rounded-sm p-1">
            <p className="text-sm font-bold text-primary font-mono-code">{universes.length}</p>
            <p className="text-[8px] text-muted-foreground">Universos</p>
          </div>
          <div className="bg-surface-2 rounded-sm p-1">
            <p className="text-sm font-bold text-electric font-mono-code">{totalFixtures}</p>
            <p className="text-[8px] text-muted-foreground">Fixtures</p>
          </div>
          <div className="bg-surface-2 rounded-sm p-1">
            <p className="text-sm font-bold font-mono-code text-foreground">{keyframes.length}</p>
            <p className="text-[8px] text-muted-foreground">Keyframes</p>
          </div>
        </div>

        {/* Config */}
        <div className="space-y-1">
          <span className="text-[9px] text-muted-foreground font-semibold uppercase">Canais por Fixture</span>
          <Select value={String(channelsPerFixture)} onValueChange={v => setChannelsPerFixture(Number(v))}>
            <SelectTrigger className="h-7 text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3" className="text-[10px]">3 (RGB)</SelectItem>
              <SelectItem value="4" className="text-[10px]">4 (RGBW)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Auto Patch */}
        <Button size="sm" className="h-6 text-[10px] w-full gap-1" onClick={autoPatch}>
          <Plus className="h-3 w-3" />
          Auto-Patch ({totalDrones} drones)
        </Button>

        {/* Universe list */}
        {universes.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Universos</p>
            {universes.map(u => (
              <div key={u.id} className="bg-surface-2 rounded-sm p-1.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-foreground">{u.label}</span>
                  <span className="text-[9px] text-muted-foreground">{u.fixtures.length} fixtures</span>
                </div>
                <div className="flex flex-wrap gap-0.5">
                  {u.fixtures.slice(0, 32).map(f => (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFixture(f.id)}
                      className={`w-4 h-4 rounded-sm text-[6px] flex items-center justify-center transition-colors ${
                        selectedFixture === f.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-surface-3 text-muted-foreground hover:bg-surface-4'
                      }`}
                      title={`${f.label} (Ch ${f.startChannel})`}
                    >
                      {f.droneIndex + 1}
                    </button>
                  ))}
                  {u.fixtures.length > 32 && (
                    <span className="text-[8px] text-muted-foreground self-center ml-1">+{u.fixtures.length - 32}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Keyframe controls */}
        {selectedFixture && (
          <div className="space-y-1.5 border-t border-border/50 pt-2">
            <p className="text-[9px] text-muted-foreground font-semibold uppercase">
              Fixture: {universes.flatMap(u => u.fixtures).find(f => f.id === selectedFixture)?.label}
            </p>
            <Button size="sm" variant="outline" className="h-6 text-[10px] w-full gap-1" onClick={addKeyframe}>
              <Plus className="h-3 w-3" />
              Keyframe em {currentTime.toFixed(1)}s
            </Button>
          </div>
        )}

        {/* Art-Net Output */}
        <div className="space-y-1.5 border-t border-border/50 pt-2">
          <div className="flex items-center gap-1.5">
            <Wifi className="h-3 w-3 text-primary" />
            <span className="text-[9px] text-muted-foreground font-semibold uppercase">Art-Net Output</span>
          </div>
          <div className="flex gap-1">
            <Input
              value={artNetIp}
              onChange={e => setArtNetIp(e.target.value)}
              className="h-6 text-[9px] font-mono-code bg-surface-0 border-border flex-1"
              placeholder="IP"
            />
            <Input
              type="number"
              value={artNetPort}
              onChange={e => setArtNetPort(Number(e.target.value))}
              className="h-6 text-[9px] font-mono-code bg-surface-0 border-border w-16"
            />
          </div>
          <Button
            size="sm" className="h-6 text-[10px] w-full gap-1"
            onClick={sendArtNet}
            disabled={universes.length === 0 || sending}
          >
            <Send className="h-3 w-3" />
            {sending ? 'Enviando...' : `Send Art-Net (${universes.length} uni)`}
          </Button>
        </div>

        {/* Export */}
        <div className="flex items-center gap-1">
          <Button
            size="sm" variant="outline"
            className="h-6 text-[10px] flex-1"
            onClick={exportCSV}
            disabled={keyframes.length === 0}
          >
            Export CSV ({keyframes.length})
          </Button>
        </div>

        <div className="bg-surface-2 rounded-sm p-2 text-[9px] text-muted-foreground space-y-1">
          <p><strong>DMX512:</strong> 512 canais por universo, 128 fixtures RGBW</p>
          <p><strong>Art-Net:</strong> Protocolo UDP porta 6454 para fixtures reais</p>
          <p className="text-primary/70">Use Auto-Patch para mapear drones como fixtures</p>
        </div>
      </div>
    </div>
  );
}
