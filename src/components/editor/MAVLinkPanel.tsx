import { useState, useEffect, useRef, useCallback } from 'react';
import { Radio, Play, Pause, Trash2, Send, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useMAVLinkStore } from '@/store/useMAVLinkStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useBoidsStore } from '@/store/useBoidsStore';
import {
  createDefaultTelemetry,
  updateTelemetryFromSim,
  generateFullPacket,
  formatMessageLog,
  generateHeartbeat,
  MAVMode,
  MAVState,
} from '@/lib/mavlinkProtocol';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function MAVLinkPanel({ onClose }: { onClose: () => void }) {
  const {
    connected, bridgeActive, drones, log, packetCount, bytesTransferred,
    selectedDroneId, rateConfig,
    setConnected, setBridgeActive, initDrone, updateDrone,
    addPacket, addLog, setSelectedDroneId, clearLog, resetAll,
  } = useMAVLinkStore();

  const { droneFormations, currentTime } = useProjectStore();
  const { agents, running: boidsRunning } = useBoidsStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [autoStream, setAutoStream] = useState(false);

  // Init drones from formations
  const initFromFormations = useCallback(() => {
    if (droneFormations.length === 0 && agents.length === 0) return;
    const count = agents.length > 0 ? agents.length : (droneFormations[0]?.droneCount ?? 0);
    for (let i = 0; i < Math.min(count, 50); i++) { // cap at 50 for performance
      initDrone(i + 1);
    }
    setConnected(true);
    toast.success(`MAVLink: ${Math.min(count, 50)} drones inicializados`);
  }, [droneFormations, agents.length, initDrone, setConnected]);

  // Connect to bridge
  const connectBridge = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('mavlink-bridge', {
        body: { action: 'status' },
      });
      if (error) throw error;
      setBridgeActive(true);
      addLog({ timestamp: Date.now(), direction: 'rx', message: `Bridge connected: ${data.protocol}`, systemId: 0 });
      toast.success('Bridge MAVLink conectado');
    } catch (e) {
      toast.error('Falha ao conectar bridge');
      console.error(e);
    }
  };

  // Stream telemetry from Boids agents
  useEffect(() => {
    if (!autoStream || !connected || agents.length === 0) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }

    intervalRef.current = setInterval(() => {
      const dronesMap = useMAVLinkStore.getState().drones;
      const currentAgents = useBoidsStore.getState().agents;

      for (let i = 0; i < Math.min(currentAgents.length, 50); i++) {
        const sysId = i + 1;
        const agent = currentAgents[i];
        if (!agent) continue;

        let tel = dronesMap.get(sysId) || createDefaultTelemetry(sysId);
        tel = updateTelemetryFromSim(tel, agent, 0.1);
        useMAVLinkStore.getState().updateDrone(sysId, tel);

        const packet = generateFullPacket(tel);
        useMAVLinkStore.getState().addPacket(packet);
      }

      // Log summary
      useMAVLinkStore.getState().addLog({
        timestamp: Date.now(),
        direction: 'tx',
        message: `Telemetry batch: ${Math.min(currentAgents.length, 50)} drones`,
        systemId: 0,
      });
    }, 1000 / rateConfig.heartbeatHz); // At heartbeat rate

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoStream, connected, agents.length, rateConfig.heartbeatHz]);

  // Send telemetry to bridge
  const sendToBridge = async () => {
    if (!bridgeActive) { toast.error('Bridge não conectado'); return; }

    const packets = Array.from(drones.values()).map(tel => generateFullPacket(tel));
    try {
      const { data, error } = await supabase.functions.invoke('mavlink-bridge', {
        body: { action: 'telemetry', packets },
      });
      if (error) throw error;

      // Log warnings
      for (const result of (data.results || [])) {
        for (const w of (result.warnings || [])) {
          addLog({ timestamp: Date.now(), direction: 'rx', message: w, systemId: result.systemId });
        }
      }
      addLog({ timestamp: Date.now(), direction: 'tx', message: `Sent ${packets.length} packets → Bridge`, systemId: 0 });
    } catch (e) {
      toast.error('Falha ao enviar telemetria');
    }
  };

  // Send command
  const sendCommand = async (type: string) => {
    if (!bridgeActive) return;
    try {
      const { data, error } = await supabase.functions.invoke('mavlink-bridge', {
        body: { action: 'command', command: { type, targetSystem: selectedDroneId || 1 } },
      });
      if (error) throw error;
      addLog({ timestamp: Date.now(), direction: 'tx', message: `CMD ${type} → SYS ${selectedDroneId || 1}: ${data.ack}`, systemId: selectedDroneId || 1 });
      toast.success(`${type} → ${data.ack}`);
    } catch (e) {
      toast.error(`Falha: ${type}`);
    }
  };

  const selectedTel = selectedDroneId ? drones.get(selectedDroneId) : null;

  return (
    <div className="h-full bg-surface-1 border-l border-border flex flex-col">
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">MAVLink Bridge</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Status */}
        <div className="grid grid-cols-3 gap-1 text-center">
          <div className="bg-surface-2 rounded-sm p-1">
            <p className="text-sm font-bold font-mono-code" style={{ color: connected ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))' }}>
              {connected ? drones.size : 0}
            </p>
            <p className="text-[8px] text-muted-foreground">Drones</p>
          </div>
          <div className="bg-surface-2 rounded-sm p-1">
            <p className="text-sm font-bold text-electric font-mono-code">{packetCount}</p>
            <p className="text-[8px] text-muted-foreground">Pacotes</p>
          </div>
          <div className="bg-surface-2 rounded-sm p-1">
            <p className="text-sm font-bold font-mono-code text-foreground">
              {(bytesTransferred / 1024).toFixed(1)}
            </p>
            <p className="text-[8px] text-muted-foreground">KB</p>
          </div>
        </div>

        {/* Connection */}
        <div className="flex items-center gap-1">
          <Button size="sm" className="h-6 text-[10px] flex-1 gap-1" onClick={initFromFormations} disabled={connected}>
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {connected ? 'Conectado' : 'Iniciar'}
          </Button>
          <Button
            size="sm"
            variant={bridgeActive ? 'default' : 'outline'}
            className="h-6 text-[10px] flex-1 gap-1"
            onClick={connectBridge}
            disabled={bridgeActive}
          >
            <Radio className="h-3 w-3" />
            {bridgeActive ? 'Bridge ON' : 'Bridge'}
          </Button>
        </div>

        {/* Auto-stream toggle */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Stream Boids → MAVLink</span>
          <Switch checked={autoStream} onCheckedChange={setAutoStream} disabled={!connected || agents.length === 0} />
        </div>

        {/* Commands */}
        {bridgeActive && (
          <div className="space-y-1.5">
            <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Comandos</p>
            <div className="grid grid-cols-3 gap-1">
              {['ARM', 'TAKEOFF', 'GUIDED', 'LAND', 'RTL', 'DISARM'].map(cmd => (
                <Button key={cmd} size="sm" variant="outline" className="h-6 text-[8px] px-1" onClick={() => sendCommand(cmd)}>
                  {cmd}
                </Button>
              ))}
            </div>
            <Button size="sm" variant="outline" className="h-6 text-[10px] w-full gap-1" onClick={sendToBridge}>
              <Send className="h-3 w-3" />
              Enviar Telemetria
            </Button>
          </div>
        )}

        {/* Drone selector */}
        {connected && drones.size > 0 && (
          <div className="space-y-1">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase">Drone Selecionado</span>
            <Select value={String(selectedDroneId || '')} onValueChange={v => setSelectedDroneId(Number(v))}>
              <SelectTrigger className="h-7 text-[10px]">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                {Array.from(drones.keys()).slice(0, 50).map(id => (
                  <SelectItem key={id} value={String(id)} className="text-[10px]">SYS {id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Telemetry HUD */}
        {selectedTel && (
          <div className="bg-surface-2 rounded-sm p-2 space-y-1 font-mono-code text-[9px]">
            <p className="text-[10px] font-semibold text-foreground mb-1">SYS {selectedTel.systemId} — {MAVState[selectedTel.state]}</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
              <p>Pos: <span className="text-foreground">{selectedTel.x.toFixed(1)}, {selectedTel.y.toFixed(1)}, {selectedTel.z.toFixed(1)}</span></p>
              <p>Vel: <span className="text-foreground">{selectedTel.groundSpeed.toFixed(1)} m/s</span></p>
              <p>Roll: <span className="text-foreground">{selectedTel.roll.toFixed(1)}°</span></p>
              <p>Pitch: <span className="text-foreground">{selectedTel.pitch.toFixed(1)}°</span></p>
              <p>Yaw: <span className="text-foreground">{selectedTel.yaw.toFixed(1)}°</span></p>
              <p>Throttle: <span className="text-foreground">{selectedTel.throttle.toFixed(0)}%</span></p>
              <p>Batt: <span style={{ color: selectedTel.batteryPercent < 20 ? 'hsl(0 80% 50%)' : 'hsl(120 60% 45%)' }}>{selectedTel.batteryPercent.toFixed(0)}%</span></p>
              <p>Voltage: <span className="text-foreground">{selectedTel.voltageV.toFixed(1)}V</span></p>
              <p>GPS: <span className="text-foreground">{selectedTel.gpsFix}D ({selectedTel.satellites} sat)</span></p>
              <p>RSSI: <span className="text-foreground">{selectedTel.rssi}%</span></p>
            </div>
          </div>
        )}

        {/* Message log */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Log ({log.length})</p>
            <button onClick={clearLog} className="text-[9px] text-muted-foreground hover:text-foreground">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          <div className="bg-surface-2 rounded-sm p-1 max-h-32 overflow-y-auto">
            {log.length === 0 && (
              <p className="text-[8px] text-muted-foreground text-center py-2">Nenhum log</p>
            )}
            {log.slice(-20).reverse().map((entry, i) => (
              <div key={i} className="text-[8px] font-mono-code flex gap-1 py-0.5 border-b border-border/30 last:border-0">
                <span className={entry.direction === 'tx' ? 'text-primary' : 'text-electric'}>
                  {entry.direction === 'tx' ? '→' : '←'}
                </span>
                <span className="text-muted-foreground truncate">{entry.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Reset */}
        <Button size="sm" variant="outline" className="h-6 text-[10px] w-full" onClick={() => { resetAll(); setAutoStream(false); }}>
          Reset MAVLink
        </Button>

        <div className="bg-surface-2 rounded-sm p-2 text-[9px] text-muted-foreground space-y-1">
          <p><strong>MAVLink 2.0:</strong> Protocolo padrão para telemetria de drones</p>
          <p><strong>Bridge:</strong> Relé virtual via backend function</p>
          <p className="text-primary/70">Ative "Stream Boids" para telemetria em tempo real</p>
        </div>
      </div>
    </div>
  );
}
