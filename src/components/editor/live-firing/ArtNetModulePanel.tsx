/**
 * Art-Net Module Control Panel with Cloning & Redundancy
 */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Wifi, WifiOff, Globe, Radio, Shield, ShieldCheck, ShieldOff,
  Plus, Trash2, MapPin, Battery, Loader2, AlertTriangle,
  Maximize2, Minimize2, Search, Link2, Unlink2, Copy
} from 'lucide-react';
import {
  artnetModuleService,
  type ArtNetModuleConfig,
  type ArtNetControllerConfig,
  type ModuleTransport,
  type ModuleConnectionState,
  type RedundancyMode,
} from '@/services/artnetModuleService';
import { useArtNetModulePersistence } from '@/hooks/useArtNetModulePersistence';
import { useProjectStore } from '@/store/useProjectStore';

function ConnectionBadge({ state }: { state: ModuleConnectionState }) {
  const config: Record<ModuleConnectionState, { color: string; label: string; icon: React.ReactNode }> = {
    disconnected: { color: 'text-muted-foreground', label: 'OFFLINE', icon: <WifiOff className="w-3 h-3" /> },
    connecting: { color: 'text-amber-400', label: 'LINKING', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    connected: { color: 'text-emerald-400', label: 'ONLINE', icon: <Wifi className="w-3 h-3" /> },
    error: { color: 'text-red-400', label: 'ERROR', icon: <AlertTriangle className="w-3 h-3" /> },
    timeout: { color: 'text-orange-400', label: 'TIMEOUT', icon: <WifiOff className="w-3 h-3" /> },
  };
  const c = config[state];
  return (
    <span className={`flex items-center gap-1 text-[10px] font-mono font-bold ${c.color}`}>
      {c.icon} {c.label}
    </span>
  );
}

function TransportIcon({ transport }: { transport: ModuleTransport }) {
  switch (transport) {
    case 'lan': return <Wifi className="w-3.5 h-3.5 text-cyan-400" />;
    case 'wan': return <Globe className="w-3.5 h-3.5 text-violet-400" />;
    case 'relay': return <Radio className="w-3.5 h-3.5 text-amber-400" />;
  }
}

function RedundancyBadge({ module }: { module: ArtNetModuleConfig }) {
  if (module.cloneOf) {
    return <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 border-amber-500/40 text-amber-400 font-mono">BACKUP</Badge>;
  }
  const clones = artnetModuleService.getClones(module.id);
  if (clones.length > 0) {
    return <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 border-cyan-500/40 text-cyan-400 font-mono">PRIMARY × {clones.length}</Badge>;
  }
  return null;
}

interface ModuleCardProps {
  module: ArtNetModuleConfig;
  connectionState: ModuleConnectionState;
  masterArmed: boolean;
  isClone: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onArm: () => void;
  onDisarm: () => void;
  onRemove: () => void;
  onFire: (ch: number) => void;
  onClone: () => void;
  onSetRedundancy: (mode: RedundancyMode) => void;
}

function ModuleCard({ module, connectionState, masterArmed, isClone, onConnect, onDisconnect, onArm, onDisarm, onRemove, onFire, onClone, onSetRedundancy }: ModuleCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isOnline = connectionState === 'connected';
  const canArm = isOnline && masterArmed;

  return (
    <div className={`rounded-lg border p-3 transition-colors ${isClone ? 'ml-6 border-dashed' : ''} ${
      isOnline
        ? module.armed ? 'border-red-500/50 bg-red-500/5' : 'border-emerald-500/30 bg-emerald-500/5'
        : 'border-border/30 bg-muted/5'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TransportIcon transport={module.transport} />
          <span className="font-mono text-xs font-bold text-foreground">{module.name}</span>
          <span className="text-[9px] font-mono text-muted-foreground">#{module.moduleAddress}</span>
          <RedundancyBadge module={module} />
        </div>
        <div className="flex items-center gap-2">
          <ConnectionBadge state={connectionState} />
          {module.latencyMs !== null && isOnline && (
            <span className="flex items-center gap-0.5 text-[9px] font-mono text-violet-300">
              <Globe className="w-3 h-3 text-violet-400" />
              {module.latencyMs}ms
            </span>
          )}
        </div>
      </div>

      {/* Info Row */}
      <div className="flex items-center gap-3 mb-2 text-[10px] text-muted-foreground font-mono flex-wrap">
        <span>U:{module.dmxUniverse} S:{module.dmxSubnet} N:{module.dmxNet}</span>
        <span>DMX {module.dmxStartAddress}-{module.dmxStartAddress + module.dmxChannelCount - 1}</span>
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {module.ip}:{module.port}
        </span>
        {module.batteryLevel != null && (
          <span className="flex items-center gap-1">
            <Battery className="w-3 h-3" /> {module.batteryLevel}%
          </span>
        )}
        {module.label && <span className="text-cyan-400">{module.label}</span>}
        {module.redundancyMode !== 'failover' && (
          <span className="text-amber-400">MODE: {module.redundancyMode.toUpperCase()}</span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {isOnline ? (
          <Button size="sm" variant="outline" className="h-7 text-[10px] font-mono" onClick={onDisconnect}>
            <Unlink2 className="w-3 h-3 mr-1" /> DISCONNECT
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-[10px] font-mono border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={onConnect}>
            <Link2 className="w-3 h-3 mr-1" /> CONNECT
          </Button>
        )}

        {canArm && !module.armed && (
          <Button size="sm" className="h-7 text-[10px] font-mono bg-amber-600 hover:bg-amber-700" onClick={onArm}>
            <Shield className="w-3 h-3 mr-1" /> ARM
          </Button>
        )}
        {module.armed && (
          <Button size="sm" variant="destructive" className="h-7 text-[10px] font-mono" onClick={onDisarm}>
            <ShieldOff className="w-3 h-3 mr-1" /> DISARM
          </Button>
        )}

        {!isClone && (
          <Button size="sm" variant="outline" className="h-7 text-[10px] font-mono border-amber-500/20 text-amber-400 hover:bg-amber-500/10" onClick={onClone}>
            <Copy className="w-3 h-3 mr-1" /> CLONE
          </Button>
        )}

        {/* Redundancy mode selector for primaries with clones */}
        {!isClone && artnetModuleService.getClones(module.id).length > 0 && (
          <Select value={module.redundancyMode} onValueChange={v => onSetRedundancy(v as RedundancyMode)}>
            <SelectTrigger className="h-7 w-[110px] text-[9px] font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="failover">Failover</SelectItem>
              <SelectItem value="simultaneous">Simultaneous</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Button size="sm" variant="ghost" className="h-7 text-[10px] ml-auto" onClick={() => setExpanded(!expanded)}>
          {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-[10px] text-red-400 hover:text-red-300" onClick={onRemove}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {/* Expanded: Channel Grid */}
      {expanded && isOnline && (
        <div className="mt-3 pt-3 border-t border-border/20">
          <div className="text-[9px] font-mono text-muted-foreground mb-1">FIRE CHANNELS ({module.channelCount})</div>
          <div className="grid grid-cols-8 gap-1">
            {Array.from({ length: Math.min(module.channelCount, 32) }, (_, i) => (
              <Button
                key={i}
                size="sm"
                disabled={!module.armed}
                className={`h-7 text-[9px] font-mono p-0 ${
                  module.armed
                    ? 'bg-red-600/20 border-red-500/30 hover:bg-red-600/40 text-red-300'
                    : 'bg-muted/10 text-muted-foreground/40'
                }`}
                variant="outline"
                onClick={() => onFire(i)}
              >
                {i + 1}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ArtNetModulePanel() {
  const projectId = useProjectStore(s => s.projectId);
  const { saveModule, deleteModule } = useArtNetModulePersistence(projectId);
  const [controller, setController] = useState<ArtNetControllerConfig | null>(null);
  const [moduleStates, setModuleStates] = useState<Map<string, ModuleConnectionState>>(new Map());
  const [showAddModule, setShowAddModule] = useState(false);
  const [newModule, setNewModule] = useState({
    name: '', ip: '192.168.1.100', port: '6454', transport: 'lan' as ModuleTransport,
    universe: '0', subnet: '0', net: '0', startAddr: '1', channels: '32', label: '',
    relayUrl: '',
  });

  useEffect(() => {
    let ctrl = artnetModuleService.getController();
    if (!ctrl) {
      ctrl = artnetModuleService.initController({ name: 'FXK MASTER CONTROLLER' });
    }
    setController({ ...ctrl });

    const unsub = artnetModuleService.subscribe((type, data) => {
      const c = artnetModuleService.getController();
      if (c) setController({ ...c });

      if (type === 'module-connected' || type === 'module-disconnected' || type === 'module-error') {
        setModuleStates(prev => {
          const next = new Map(prev);
          next.set(data.moduleId, artnetModuleService.getModuleState(data.moduleId));
          return next;
        });
      }
    });

    return unsub;
  }, []);

  const handleAddModule = useCallback(() => {
    const m = artnetModuleService.addModule({
      name: newModule.name || `MODULE ${(controller?.modules.length || 0) + 1}`,
      ip: newModule.ip,
      port: parseInt(newModule.port) || 6454,
      transport: newModule.transport,
      dmxUniverse: parseInt(newModule.universe) || 0,
      dmxSubnet: parseInt(newModule.subnet) || 0,
      dmxNet: parseInt(newModule.net) || 0,
      dmxStartAddress: parseInt(newModule.startAddr) || 1,
      dmxChannelCount: parseInt(newModule.channels) || 32,
      channelCount: parseInt(newModule.channels) || 32,
      label: newModule.label,
    });
    saveModule(m, controller?.modules.length || 0);
    setShowAddModule(false);
    setNewModule({ name: '', ip: '192.168.1.100', port: '6454', transport: 'lan', universe: '0', subnet: '0', net: '0', startAddr: '1', channels: '32', label: '', relayUrl: '' });
  }, [newModule, controller, saveModule]);

  const handleCloneModule = useCallback((moduleId: string) => {
    const clone = artnetModuleService.cloneModule(moduleId);
    if (clone) {
      saveModule(clone, controller?.modules.length || 0);
    }
  }, [controller, saveModule]);

  const handleSetRedundancy = useCallback((moduleId: string, mode: RedundancyMode) => {
    artnetModuleService.updateModule(moduleId, { redundancyMode: mode } as any);
    const mod = artnetModuleService.getController()?.modules.find(m => m.id === moduleId);
    if (mod) saveModule(mod);
  }, [saveModule]);

  const handleMasterArm = useCallback(() => {
    if (!controller) return;
    artnetModuleService.setMasterArm(!controller.masterArmed);
  }, [controller]);

  const handleEStop = useCallback(() => {
    artnetModuleService.eStopAll();
  }, []);

  const handleConnectAll = useCallback(() => {
    artnetModuleService.connectAllModules();
  }, []);

  const handleDiscover = useCallback(async () => {
    await artnetModuleService.discoverModules();
  }, []);

  if (!controller) return null;

  const onlineCount = controller.modules.filter(m => moduleStates.get(m.id) === 'connected').length;
  const armedCount = controller.modules.filter(m => m.armed).length;

  // Sort: primaries first, then their clones indented below
  const primaries = controller.modules.filter(m => !m.cloneOf);
  const orderedModules: { module: ArtNetModuleConfig; isClone: boolean }[] = [];
  for (const p of primaries) {
    orderedModules.push({ module: p, isClone: false });
    const clones = controller.modules.filter(m => m.cloneOf === p.id);
    for (const c of clones) {
      orderedModules.push({ module: c, isClone: true });
    }
  }
  // Orphan clones (primary deleted)
  const orphans = controller.modules.filter(m => m.cloneOf && !primaries.find(p => p.id === m.cloneOf));
  for (const o of orphans) {
    orderedModules.push({ module: o, isClone: true });
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <div className="p-3 border-b border-border/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <span className="font-mono text-xs font-bold">ART-NET MODULE CONTROL</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
            <span className="text-emerald-400">{onlineCount} ONLINE</span>
            <span>/ {controller.modules.length} TOTAL</span>
            {armedCount > 0 && <span className="text-red-400">{armedCount} ARMED</span>}
          </div>
        </div>

        {/* Master Controls */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className={`h-8 text-[10px] font-mono font-bold flex-1 ${
              controller.masterArmed
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30'
            }`}
            onClick={handleMasterArm}
          >
            {controller.masterArmed ? (
              <><ShieldCheck className="w-3.5 h-3.5 mr-1" /> MASTER ARMED</>
            ) : (
              <><Shield className="w-3.5 h-3.5 mr-1" /> MASTER ARM</>
            )}
          </Button>

          <Button size="sm" variant="destructive" className="h-8 text-[10px] font-mono font-bold" onClick={handleEStop}>
            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> E-STOP
          </Button>

          <Button size="sm" variant="outline" className="h-8 text-[10px] font-mono" onClick={handleConnectAll}>
            <Link2 className="w-3.5 h-3.5 mr-1" /> ALL
          </Button>

          <Button size="sm" variant="outline" className="h-8 text-[10px] font-mono" onClick={handleDiscover}>
            <Search className="w-3.5 h-3.5 mr-1" /> SCAN
          </Button>

          <Button size="sm" variant="outline" className="h-8 text-[10px] font-mono" onClick={() => setShowAddModule(!showAddModule)}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Add Module Form */}
      {showAddModule && (
        <div className="p-3 border-b border-border/30 bg-muted/5">
          <div className="text-[10px] font-mono font-bold text-muted-foreground mb-2">ADD MODULE</div>
          <div className="grid grid-cols-4 gap-2 mb-2">
            <Input value={newModule.name} onChange={e => setNewModule(p => ({ ...p, name: e.target.value }))} placeholder="Name" className="h-7 text-[10px] font-mono" />
            <Input value={newModule.ip} onChange={e => setNewModule(p => ({ ...p, ip: e.target.value }))} placeholder="IP Address" className="h-7 text-[10px] font-mono" />
            <Input value={newModule.port} onChange={e => setNewModule(p => ({ ...p, port: e.target.value }))} placeholder="Port" className="h-7 text-[10px] font-mono" />
            <Select value={newModule.transport} onValueChange={v => setNewModule(p => ({ ...p, transport: v as ModuleTransport }))}>
              <SelectTrigger className="h-7 text-[10px] font-mono"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lan">LAN</SelectItem>
                <SelectItem value="wan">WAN (Internet)</SelectItem>
                <SelectItem value="relay">Relay Server</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-5 gap-2 mb-2">
            <Input value={newModule.universe} onChange={e => setNewModule(p => ({ ...p, universe: e.target.value }))} placeholder="Universe" className="h-7 text-[10px] font-mono" />
            <Input value={newModule.subnet} onChange={e => setNewModule(p => ({ ...p, subnet: e.target.value }))} placeholder="Subnet" className="h-7 text-[10px] font-mono" />
            <Input value={newModule.net} onChange={e => setNewModule(p => ({ ...p, net: e.target.value }))} placeholder="Net" className="h-7 text-[10px] font-mono" />
            <Input value={newModule.startAddr} onChange={e => setNewModule(p => ({ ...p, startAddr: e.target.value }))} placeholder="DMX Start" className="h-7 text-[10px] font-mono" />
            <Input value={newModule.label} onChange={e => setNewModule(p => ({ ...p, label: e.target.value }))} placeholder="Label" className="h-7 text-[10px] font-mono" />
          </div>
          {(newModule.transport === 'wan' || newModule.transport === 'relay') && (
            <Input value={newModule.relayUrl} onChange={e => setNewModule(p => ({ ...p, relayUrl: e.target.value }))} placeholder="Relay Server URL (ws://...)" className="h-7 text-[10px] font-mono mb-2" />
          )}
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-[10px] font-mono" onClick={handleAddModule}>
              <Plus className="w-3 h-3 mr-1" /> ADD
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[10px] font-mono" onClick={() => setShowAddModule(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Module List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {orderedModules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-mono">No modules configured</p>
              <p className="text-[10px] font-mono opacity-60">Click + to add an FXK-M1 module</p>
            </div>
          ) : (
            orderedModules.map(({ module, isClone }) => (
              <ModuleCard
                key={module.id}
                module={module}
                isClone={isClone}
                connectionState={moduleStates.get(module.id) || 'disconnected'}
                masterArmed={controller.masterArmed}
                onConnect={() => artnetModuleService.connectModule(module.id)}
                onDisconnect={() => artnetModuleService.disconnectModule(module.id)}
                onArm={() => artnetModuleService.armModule(module.id)}
                onDisarm={() => artnetModuleService.disarmModule(module.id)}
                onRemove={() => { artnetModuleService.removeModule(module.id); deleteModule(module.id); }}
                onFire={(ch) => artnetModuleService.fireChannel(module.id, ch)}
                onClone={() => handleCloneModule(module.id)}
                onSetRedundancy={(mode) => handleSetRedundancy(module.id, mode)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer Status */}
      <div className="p-2 border-t border-border/20 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
        <span>Art-Net 4 · UDP {controller.modules[0]?.port || 6454}</span>
        <span>Transport: {controller.transport.toUpperCase()}</span>
        <span>{controller.masterArmed ? '🔴 SYSTEM ARMED' : '🟢 SAFE'}</span>
      </div>
    </div>
  );
}
