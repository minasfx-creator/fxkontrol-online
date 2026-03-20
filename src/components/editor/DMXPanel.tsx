import { useState, useMemo, useCallback } from 'react';
import { Lightbulb, Plus, Trash2, Send, Wifi, Activity, CheckCircle2, XCircle, Clock, Zap, Usb, Monitor } from 'lucide-react';
import DMXMonitorGrid from './DMXMonitorGrid';
import { useUSBDeviceStore } from '@/store/useUSBDeviceStore';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
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
  const { dmxDevices, sendDMXToAll, getConnectedDMXDevices } = useUSBDeviceStore();
  const hardware = useFireOneHardware();
  const [universes, setUniverses] = useState<DMXUniverse[]>([]);
  const [keyframes, setKeyframes] = useState<DMXKeyframe[]>([]);
  const [selectedFixture, setSelectedFixture] = useState<string | null>(null);
  const [channelsPerFixture, setChannelsPerFixture] = useState(4);
  const [outputMode, setOutputMode] = useState<'artnet' | 'usb' | 'fireone'>('artnet');
  const [artNetIp, setArtNetIp] = useState('192.168.15.2');
  const [artNetPort, setArtNetPort] = useState(6454);
  const [sending, setSending] = useState(false);
  const [diagLogs, setDiagLogs] = useState<DiagnosticLog[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [showDiag, setShowDiag] = useState(true);
  const [showMonitor, setShowMonitor] = useState(false);

  const addDiagLog = useCallback((log: DiagnosticLog) => {
    setDiagLogs(prev => [log, ...prev].slice(0, 50));
  }, []);

  // WebSocket Relay state
  const [relayUrl, setRelayUrl] = useState('ws://localhost:9001');
  const [relayWs, setRelayWs] = useState<WebSocket | null>(null);
  const [relayConnected, setRelayConnected] = useState(false);
  const [useRelay, setUseRelay] = useState(false);

  const connectRelay = useCallback(() => {
    if (relayWs) { relayWs.close(); }
    try {
      const ws = new WebSocket(relayUrl);
      ws.onopen = () => {
        setRelayConnected(true);
        setConnectionStatus('ok');
        addDiagLog({ timestamp: new Date(), type: 'info', message: `Relay conectado: ${relayUrl}` });
        toast.success('Relay Art-Net conectado!');
        ws.send(JSON.stringify({ action: 'ping' }));
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.action === 'pong') {
            addDiagLog({ timestamp: new Date(), type: 'info', message: `Relay pong — ${msg.packetsSent} pkts enviados, uptime ${Math.round(msg.uptime)}s` });
          }
        } catch {}
      };
      ws.onclose = () => {
        setRelayConnected(false);
        setConnectionStatus('idle');
        addDiagLog({ timestamp: new Date(), type: 'info', message: 'Relay desconectado' });
      };
      ws.onerror = () => {
        setRelayConnected(false);
        setConnectionStatus('error');
        addDiagLog({ timestamp: new Date(), type: 'error', message: `Falha ao conectar relay: ${relayUrl}` });
        toast.error('Falha ao conectar ao relay Art-Net');
      };
      setRelayWs(ws);
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [relayUrl, relayWs, addDiagLog]);

  const disconnectRelay = useCallback(() => {
    relayWs?.close();
    setRelayWs(null);
    setRelayConnected(false);
  }, [relayWs]);

  const sendViaRelay = useCallback(() => {
    if (!relayWs || relayWs.readyState !== WebSocket.OPEN || universes.length === 0) return;
    const batch = universes.map((u, i) => ({
      universe: u.id % 16,
      subnet: Math.floor(u.id / 16) % 16,
      net: Math.floor(u.id / 256),
      channels: Array.from(u.channels),
    }));
    relayWs.send(JSON.stringify({ action: 'dmx-batch', universes: batch }));
    addDiagLog({ timestamp: new Date(), type: 'send', message: `Relay → ${batch.length} universo(s) via WebSocket` });
  }, [relayWs, universes, addDiagLog]);

  const connectedUSBDMX = useMemo(() => getConnectedDMXDevices(), [dmxDevices]);
  const hasUSBDMX = connectedUSBDMX.length > 0;

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

  const sendUSBDirect = async () => {
    if (universes.length === 0) {
      toast.error('Faça o Auto-Patch primeiro');
      return;
    }
    setSending(true);
    const t0 = performance.now();
    try {
      // Send each universe's channels to all connected USB DMX devices
      for (const u of universes) {
        const result = await sendDMXToAll(u.channels);
        const latency = Math.round(performance.now() - t0);
        addDiagLog({
          timestamp: new Date(), type: 'send',
          message: `USB → Uni ${u.id} · ${result.deviceCount} device(s) · ${result.totalBytes}B`,
          latency,
        });
      }
      setConnectionStatus('ok');
      const latency = Math.round(performance.now() - t0);
      toast.success(`DMX enviado via USB (${universes.length} uni, ${connectedUSBDMX.length} device)`, {
        description: `Latência: ${latency}ms`,
      });
    } catch (e: any) {
      const latency = Math.round(performance.now() - t0);
      setConnectionStatus('error');
      addDiagLog({ timestamp: new Date(), type: 'error', message: e.message || 'Erro USB', latency });
      toast.error(e.message || 'Erro ao enviar via USB');
    } finally {
      setSending(false);
    }
  };

  const sendFireOneDMX = async () => {
    if (universes.length === 0 || !hardware.isConnected) {
      toast.error(!hardware.isConnected ? 'FireOne não conectado' : 'Faça o Auto-Patch primeiro');
      return;
    }
    setSending(true);
    const t0 = performance.now();
    try {
      for (let i = 0; i < universes.length; i++) {
        const u = universes[i];
        const moduleAddr = i + 1; // universe 1 → module 1
        await hardware.sendDmxOut(moduleAddr, 1, Array.from(u.channels.slice(0, 512)));
        const latency = Math.round(performance.now() - t0);
        addDiagLog({
          timestamp: new Date(), type: 'send',
          message: `FireOne DMX → Module ${moduleAddr} · ${u.channels.length} ch`,
          latency,
        });
      }
      setConnectionStatus('ok');
      const latency = Math.round(performance.now() - t0);
      toast.success(`DMX via FireOne IFMx-i32Q (${universes.length} uni)`, {
        description: `Latência: ${latency}ms`,
      });
    } catch (e: any) {
      const latency = Math.round(performance.now() - t0);
      setConnectionStatus('error');
      addDiagLog({ timestamp: new Date(), type: 'error', message: e.message || 'FireOne DMX error', latency });
      toast.error(e.message || 'Erro ao enviar DMX via FireOne');
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

        {/* Output Mode Selector */}
        <div className="space-y-1.5 border-t border-border/50 pt-2">
          <span className="text-[9px] text-muted-foreground font-semibold uppercase">Modo de Saída</span>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setOutputMode('artnet')}
              className={`flex items-center justify-center gap-1 rounded-sm p-1.5 text-[9px] font-semibold transition-colors ${
                outputMode === 'artnet'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface-2 text-muted-foreground hover:bg-surface-3'
              }`}
            >
              <Wifi className="h-3 w-3" />
              Art-Net
            </button>
            <button
              onClick={() => setOutputMode('usb')}
              className={`flex items-center justify-center gap-1 rounded-sm p-1.5 text-[9px] font-semibold transition-colors ${
                outputMode === 'usb'
                  ? 'bg-primary text-primary-foreground'
                  : hasUSBDMX
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    : 'bg-surface-2 text-muted-foreground hover:bg-surface-3'
              }`}
            >
              <Usb className="h-3 w-3" />
              USB Direct {hasUSBDMX && `(${connectedUSBDMX.length})`}
            </button>
          </div>
        </div>

        {/* Art-Net Output */}
        {outputMode === 'artnet' && (
          <div className="space-y-1.5">
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
              onClick={useRelay && relayConnected ? sendViaRelay : sendArtNet}
              disabled={universes.length === 0 || sending || (useRelay && !relayConnected)}
            >
              <Send className="h-3 w-3" />
              {sending ? 'Enviando...' : `Send Art-Net (${universes.length} uni)`}
            </Button>

            {/* WebSocket Relay */}
            <div className="border-t border-border/50 pt-2 mt-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-primary" />
                <span className="text-[9px] text-muted-foreground font-semibold uppercase flex-1">UDP Relay (Local)</span>
                <button
                  onClick={() => setUseRelay(!useRelay)}
                  className={`w-7 h-3.5 rounded-full transition-colors relative ${useRelay ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-foreground transition-transform ${useRelay ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {useRelay && (
                <>
                  <div className="flex gap-1">
                    <Input
                      value={relayUrl}
                      onChange={e => setRelayUrl(e.target.value)}
                      className="h-6 text-[9px] font-mono-code bg-surface-0 border-border flex-1"
                      placeholder="ws://localhost:9001"
                    />
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm" variant={relayConnected ? 'destructive' : 'outline'}
                      className="h-6 text-[10px] flex-1 gap-1"
                      onClick={relayConnected ? disconnectRelay : connectRelay}
                    >
                      {relayConnected ? <CheckCircle2 className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
                      {relayConnected ? 'Desconectar' : 'Conectar Relay'}
                    </Button>
                  </div>
                  {relayConnected && (
                    <p className="text-[8px] text-green-400">
                      ● Conectado — pacotes serão enviados via UDP na rede local
                    </p>
                  )}
                  {!relayConnected && (
                    <p className="text-[8px] text-muted-foreground">
                      Execute <code className="bg-muted px-1 rounded text-[7px]">node artnet-relay.js</code> na máquina local
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* USB Direct Output */}
        {outputMode === 'usb' && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Usb className="h-3 w-3 text-primary" />
              <span className="text-[9px] text-muted-foreground font-semibold uppercase">USB Direct Output</span>
            </div>

            {!hasUSBDMX ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-sm p-2 text-[9px] text-yellow-400">
                <p className="font-bold mb-0.5">⚠ Nenhum dispositivo DMX USB conectado</p>
                <p>Abra o painel <strong>USB Connect</strong> e pareie um ENTTEC Open/Pro DMX.</p>
              </div>
            ) : (
              <>
                {/* Connected USB DMX devices */}
                <div className="space-y-1">
                  {connectedUSBDMX.map(d => (
                    <div key={d.id} className="flex items-center gap-1.5 bg-surface-2 rounded-sm p-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                      <span className="text-[9px] text-foreground flex-1 truncate">{d.label}</span>
                      <span className="text-[7px] text-muted-foreground">{d.isENTTECPro ? 'PRO' : 'OPEN'}</span>
                    </div>
                  ))}
                </div>

                {/* Send via USB */}
                <Button
                  size="sm" className="h-6 text-[10px] w-full gap-1"
                  onClick={sendUSBDirect}
                  disabled={universes.length === 0 || sending}
                >
                  <Usb className="h-3 w-3" />
                  {sending ? 'Enviando...' : `Send USB (${connectedUSBDMX.length} device${connectedUSBDMX.length > 1 ? 's' : ''})`}
                </Button>
              </>
            )}
          </div>
        )}

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

        {/* Diagnostics */}
        <div className="border-t border-border/50 pt-2 space-y-1.5">
          <button
            onClick={() => setShowDiag(v => !v)}
            className="flex items-center gap-1.5 w-full text-left"
          >
            <Activity className="h-3 w-3 text-primary" />
            <span className="text-[9px] text-muted-foreground font-semibold uppercase flex-1">Diagnóstico Art-Net</span>
            <span className="text-[8px] text-muted-foreground">{showDiag ? '▼' : '▶'}</span>
          </button>

          {showDiag && (
            <div className="space-y-1.5">
              {/* Connection status indicator */}
              <div className="flex items-center gap-1.5 bg-surface-2 rounded-sm p-1.5">
                {connectionStatus === 'idle' && <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />}
                {connectionStatus === 'testing' && <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />}
                {connectionStatus === 'ok' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                {connectionStatus === 'error' && <XCircle className="w-3 h-3 text-destructive" />}
                <span className="text-[9px] text-foreground flex-1">
                  {connectionStatus === 'idle' && 'Não testado'}
                  {connectionStatus === 'testing' && 'Testando...'}
                  {connectionStatus === 'ok' && 'Edge Function OK'}
                  {connectionStatus === 'error' && 'Falha na conexão'}
                </span>
                <Button
                  size="sm" variant="outline"
                  className="h-5 text-[8px] px-2 gap-0.5"
                  onClick={testConnection}
                  disabled={connectionStatus === 'testing'}
                >
                  <Zap className="h-2.5 w-2.5" />
                  Test
                </Button>
              </div>

              {/* Log entries */}
              <div className="max-h-48 overflow-y-auto scrollbar-thin space-y-1">
                {diagLogs.length === 0 && (
                  <p className="text-[8px] text-muted-foreground text-center py-2">
                    Clique "Test" ou "Send Art-Net" para gerar logs
                  </p>
                )}
                {diagLogs.map((log, i) => (
                  <div key={i} className="bg-surface-2 rounded-sm p-1.5 space-y-0.5">
                    <div className="flex items-center gap-1">
                      {log.type === 'send' && <Send className="w-2.5 h-2.5 text-primary" />}
                      {log.type === 'validate' && <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />}
                      {log.type === 'error' && <XCircle className="w-2.5 h-2.5 text-destructive" />}
                      {log.type === 'info' && <Activity className="w-2.5 h-2.5 text-muted-foreground" />}
                      <span className="text-[8px] text-foreground flex-1 truncate">{log.message}</span>
                      {log.latency != null && (
                        <span className="text-[7px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-2 h-2" />{log.latency}ms
                        </span>
                      )}
                    </div>
                    <p className="text-[7px] text-muted-foreground">
                      {log.timestamp.toLocaleTimeString()}
                    </p>
                    {/* Hex dump */}
                    {log.packets && log.packets.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {log.packets.map((pkt, j) => (
                          <div key={j} className="bg-surface-0 rounded-sm p-1">
                            <p className="text-[7px] text-muted-foreground mb-0.5">
                              Uni {pkt.universe} · {pkt.channels}ch · {pkt.packetSize}B
                            </p>
                            <p className="text-[7px] font-mono-code text-primary/80 break-all leading-relaxed">
                              {pkt.hex}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {diagLogs.length > 0 && (
                <Button
                  size="sm" variant="ghost"
                  className="h-5 text-[8px] w-full text-muted-foreground"
                  onClick={() => setDiagLogs([])}
                >
                  Limpar logs
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Monitor Toggle */}
        <Button
          size="sm" variant={showMonitor ? 'default' : 'outline'}
          className="h-6 text-[9px] w-full gap-1"
          onClick={() => setShowMonitor(!showMonitor)}
        >
          <Monitor className="w-3 h-3" />
          {showMonitor ? 'Ocultar Monitor 512ch' : 'Abrir Monitor 512ch'}
        </Button>

        {/* DMX Monitor Grid */}
        {showMonitor && universes.length > 0 && (
          <DMXMonitorGrid universes={universes} />
        )}

        {showMonitor && universes.length === 0 && (
          <div className="bg-surface-2 rounded-sm p-3 text-center text-[9px] text-muted-foreground">
            Faça Auto-Patch para visualizar os canais DMX
          </div>
        )}

        <div className="bg-surface-2 rounded-sm p-2 text-[9px] text-muted-foreground space-y-1">
          <p><strong>DMX512:</strong> 512 canais por universo, 128 fixtures RGBW</p>
          <p><strong>Art-Net:</strong> Protocolo UDP porta 6454 para fixtures reais</p>
          <p className="text-primary/70">Use Auto-Patch para mapear drones como fixtures</p>
        </div>
      </div>
    </div>
  );
}
