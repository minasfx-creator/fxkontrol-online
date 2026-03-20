/**
 * ─── Fleet Management Panel ────────────────────────────────────────
 * Skybrush Live-style UAV fleet management dashboard.
 * Real-time status monitoring, preflight checks, mission upload.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Radio, Battery, Satellite, Signal, AlertTriangle, CheckCircle2, XCircle, Wifi, WifiOff, RefreshCw, Zap, Navigation, ArrowUp, ArrowDown, Power, Search, Filter, Eye, ChevronDown, Shield, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useFleetStore } from '@/store/useFleetStore';
import { flockwave } from '@/lib/flockwaveProtocol';
import { runPreflightChecks, exportPreflightReport } from '@/lib/preflightChecks';
import type { UAVStatus } from '@/lib/flockwaveProtocol';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { usePBusHardware } from '@/hooks/usePBusHardware';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Status Color Helpers ────────────────────────────────────────────

function getModeColor(mode: UAVStatus['mode']): string {
  switch (mode) {
    case 'idle': return 'text-muted-foreground';
    case 'takeoff': return 'text-primary';
    case 'hovering': return 'text-success';
    case 'mission': return 'text-electric';
    case 'rth': return 'text-warning';
    case 'landing': return 'text-warning';
    case 'landed': return 'text-muted-foreground';
    case 'error': return 'text-destructive';
    default: return 'text-muted-foreground';
  }
}

function getBatteryColor(pct: number): string {
  if (pct >= 75) return 'text-success';
  if (pct >= 50) return 'text-warning';
  return 'text-destructive';
}

function getSignalIcon(rssi: number) {
  if (rssi >= -60) return <Signal className="w-3 h-3 text-success" />;
  if (rssi >= -80) return <Signal className="w-3 h-3 text-warning" />;
  return <Signal className="w-3 h-3 text-destructive" />;
}

// ── UAV Card ────────────────────────────────────────────────────────

function UAVCard({ uav, selected, onSelect }: { uav: UAVStatus; selected: boolean; onSelect: () => void }) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "p-2 rounded border cursor-pointer transition-all",
        selected ? "border-primary bg-primary/10" : "border-border bg-surface-0 hover:border-primary/50"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono-code font-bold text-foreground">{uav.id}</span>
        <Badge variant="outline" className={cn("text-[8px] h-4 px-1", getModeColor(uav.mode))}>
          {uav.mode.toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-1 text-[8px]">
        {/* Battery */}
        <div className="flex items-center gap-0.5">
          <Battery className={cn("w-2.5 h-2.5", getBatteryColor(uav.battery.percentage))} />
          <span className={getBatteryColor(uav.battery.percentage)}>
            {uav.battery.percentage.toFixed(0)}%
          </span>
        </div>

        {/* GPS */}
        <div className="flex items-center gap-0.5">
          <Satellite className={cn("w-2.5 h-2.5", uav.gps.numSat >= 12 ? 'text-success' : 'text-warning')} />
          <span className="text-muted-foreground">{uav.gps.numSat}sat</span>
        </div>

        {/* Signal */}
        <div className="flex items-center gap-0.5">
          {getSignalIcon(uav.signal.rssi)}
          <span className="text-muted-foreground">{uav.signal.rssi}dBm</span>
        </div>
      </div>

      {/* Errors */}
      {uav.errors.length > 0 && (
        <div className="mt-1 text-[8px] text-destructive flex items-center gap-0.5">
          <AlertTriangle className="w-2.5 h-2.5" />
          {uav.errors[0]}
        </div>
      )}

      {/* LED Color indicator */}
      {(uav.light.r > 0 || uav.light.g > 0 || uav.light.b > 0) && (
        <div
          className="w-full h-1 rounded-full mt-1"
          style={{ backgroundColor: `rgb(${uav.light.r},${uav.light.g},${uav.light.b})` }}
        />
      )}
    </div>
  );
}

// ── Main Panel ──────────────────────────────────────────────────────

interface FleetManagementPanelProps {
  onClose?: () => void;
}

export default function FleetManagementPanel({ onClose }: FleetManagementPanelProps) {
  const {
    connectionState, serverUrl, setServerUrl, setConnectionState,
    uavs, selectedUAVIds, selectUAV, toggleUAVSelection, selectAllUAVs, clearUAVSelection,
    preflightResults, preflightSummary, preflightConfig,
    setPreflightResults, clearPreflightResults,
    geofence, showState,
  } = useFleetStore();

  const fireone = useFireOneHardware();
  const pbus = usePBusHardware();

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'id' | 'battery' | 'signal'>('id');
  const [filterMode, setFilterMode] = useState<string>('all');
  const [connecting, setConnecting] = useState(false);

  // Combined fleet stats
  const fireoneModules = useMemo(() => Array.from(fireone.modules.values()), [fireone.modules]);
  const pbusDevices = useMemo(() => Array.from(pbus.devices.values()), [pbus.devices]);
  const totalHardwareDevices = fireoneModules.length + pbusDevices.length;

  // Filter and sort UAVs
  const uavList = Array.from(uavs.values())
    .filter(u => {
      if (search && !u.id.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterMode !== 'all' && u.mode !== filterMode) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'battery') return a.battery.percentage - b.battery.percentage;
      if (sortBy === 'signal') return a.signal.rssi - b.signal.rssi;
      return a.id.localeCompare(b.id);
    });

  // Summary stats
  const totalUAVs = uavs.size;
  const armedCount = Array.from(uavs.values()).filter(u => u.armed).length;
  const errorCount = Array.from(uavs.values()).filter(u => u.errors.length > 0).length;
  const avgBattery = totalUAVs > 0
    ? Array.from(uavs.values()).reduce((sum, u) => sum + u.battery.percentage, 0) / totalUAVs
    : 0;

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      flockwave.disconnect();
      Object.assign(flockwave, { url: serverUrl });
      await flockwave.connect();
      setConnectionState('connected');
      toast.success('Connected to Skybrush Server');
    } catch {
      setConnectionState('error');
      toast.error('Connection failed');
    }
    setConnecting(false);
  }, [serverUrl, setConnectionState]);

  const handleDisconnect = useCallback(() => {
    flockwave.disconnect();
    setConnectionState('disconnected');
  }, [setConnectionState]);

  const handleRunPreflight = useCallback(() => {
    const uavList = Array.from(uavs.values());
    if (uavList.length === 0) {
      toast.error('No UAVs connected');
      return;
    }

    const { results, summary } = runPreflightChecks({
      uavs: uavList,
      geofence: geofence.enabled ? geofence : null,
      windSpeed: 3, // TODO: get from weather
      visibility: 10000,
      showUploaded: showState !== 'idle',
      authorized: showState === 'authorized' || showState === 'running',
    }, preflightConfig);

    setPreflightResults(results, summary);

    if (summary.ready) {
      toast.success(`Preflight PASSED — ${summary.pass}/${summary.total} checks OK`);
    } else {
      toast.error(`Preflight FAILED — ${summary.criticalFails} critical failures`);
    }
  }, [uavs, geofence, showState, preflightConfig, setPreflightResults]);

  const handleExportPreflight = useCallback(() => {
    if (!preflightSummary) return;
    const report = exportPreflightReport(preflightResults, preflightSummary);
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preflight-report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [preflightResults, preflightSummary]);

  // Demo UAVs for development
  const handleLoadDemo = useCallback(() => {
    const demoUAVs: UAVStatus[] = Array.from({ length: 25 }, (_, i) => ({
      id: `UAV-${String(i + 1).padStart(3, '0')}`,
      position: { lat: 47.473 + (Math.random() - 0.5) * 0.001, lon: 19.062 + (Math.random() - 0.5) * 0.001, alt: 0, altMSL: 100 },
      velocity: { vx: 0, vy: 0, vz: 0 },
      attitude: { roll: 0, pitch: 0, yaw: Math.random() * 360 },
      battery: { voltage: 14.4 + Math.random() * 2.4, percentage: 70 + Math.random() * 30, charging: false },
      gps: { fix: 3, numSat: 10 + Math.floor(Math.random() * 10), hAcc: 0.5 + Math.random() * 2, vAcc: 1 + Math.random() * 3 },
      signal: { rssi: -50 - Math.floor(Math.random() * 40), quality: 60 + Math.floor(Math.random() * 40) },
      mode: (['idle', 'idle', 'idle', 'hovering', 'error'] as const)[Math.floor(Math.random() * 5)],
      armed: false,
      errors: Math.random() > 0.85 ? ['Compass calibration needed'] : [],
      light: { r: 0, g: 0, b: 0 },
      timestamp: Date.now(),
    }));

    const store = useFleetStore.getState();
    store.updateMultipleUAVs(demoUAVs);
    toast.success(`Loaded ${demoUAVs.length} demo UAVs`);
  }, []);

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      {/* Header */}
      <div className="p-2 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-electric" />
            <span className="text-xs font-bold text-foreground tracking-wide">FLEET MANAGER</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={cn(
              "w-2 h-2 rounded-full",
              connectionState === 'connected' ? 'bg-success animate-pulse' :
              connectionState === 'connecting' ? 'bg-warning animate-pulse' :
              connectionState === 'error' ? 'bg-destructive' : 'bg-muted-foreground'
            )} />
            <span className="text-[8px] text-muted-foreground">{connectionState.toUpperCase()}</span>
          </div>
        </div>

        {/* Connection */}
        <div className="flex gap-1 mb-2">
          <Input
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            className="h-6 text-[9px] font-mono-code bg-background"
            placeholder="ws://server:5000/api/v1/ws"
          />
          {connectionState === 'connected' ? (
            <Button size="sm" variant="outline" className="h-6 text-[8px] px-2" onClick={handleDisconnect}>
              <WifiOff className="w-3 h-3" />
            </Button>
          ) : (
            <Button size="sm" className="h-6 text-[8px] px-2" onClick={handleConnect} disabled={connecting}>
              <Wifi className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-1 text-[8px]">
          <div className="bg-background rounded px-1.5 py-0.5 text-center">
            <div className="text-foreground font-bold">{totalUAVs}</div>
            <div className="text-muted-foreground">UAVs</div>
          </div>
          <div className="bg-background rounded px-1.5 py-0.5 text-center">
            <div className={cn("font-bold", armedCount > 0 ? 'text-warning' : 'text-muted-foreground')}>{armedCount}</div>
            <div className="text-muted-foreground">Armed</div>
          </div>
          <div className="bg-background rounded px-1.5 py-0.5 text-center">
            <div className={cn("font-bold", errorCount > 0 ? 'text-destructive' : 'text-success')}>{errorCount}</div>
            <div className="text-muted-foreground">Errors</div>
          </div>
          <div className="bg-background rounded px-1.5 py-0.5 text-center">
            <div className={cn("font-bold", getBatteryColor(avgBattery))}>{avgBattery.toFixed(0)}%</div>
            <div className="text-muted-foreground">Avg Bat</div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="fleet" className="flex-1 flex flex-col">
        <TabsList className="h-7 mx-2 mt-1">
          <TabsTrigger value="fleet" className="text-[9px] h-5">Fleet</TabsTrigger>
          <TabsTrigger value="preflight" className="text-[9px] h-5">Preflight</TabsTrigger>
          <TabsTrigger value="commands" className="text-[9px] h-5">Commands</TabsTrigger>
          <TabsTrigger value="hardware" className="text-[9px] h-5">Hardware</TabsTrigger>
        </TabsList>

        {/* Fleet Tab */}
        <TabsContent value="fleet" className="flex-1 flex flex-col px-2 pb-2 mt-0">
          {/* Search & Filter */}
          <div className="flex gap-1 mb-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-6 text-[9px] pl-5 bg-background"
                placeholder="Search UAV..."
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="h-6 w-20 text-[8px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="id" className="text-[9px]">ID</SelectItem>
                <SelectItem value="battery" className="text-[9px]">Battery</SelectItem>
                <SelectItem value="signal" className="text-[9px]">Signal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-1 mb-1.5">
            <Button size="sm" variant="outline" className="h-5 text-[8px] flex-1" onClick={selectAllUAVs}>
              Select All
            </Button>
            <Button size="sm" variant="outline" className="h-5 text-[8px] flex-1" onClick={clearUAVSelection}>
              Clear
            </Button>
            <Button size="sm" variant="outline" className="h-5 text-[8px] px-2" onClick={handleLoadDemo}>
              Demo
            </Button>
          </div>

          {/* UAV List */}
          <ScrollArea className="flex-1">
            <div className="space-y-1 pr-2">
              {uavList.length === 0 ? (
                <div className="text-center py-8">
                  <Radio className="w-6 h-6 text-muted-foreground mx-auto mb-2 opacity-30" />
                  <p className="text-[10px] text-muted-foreground">No UAVs connected</p>
                  <p className="text-[8px] text-muted-foreground mt-1">Connect to server or load demo</p>
                </div>
              ) : (
                uavList.map(uav => (
                  <UAVCard
                    key={uav.id}
                    uav={uav}
                    selected={selectedUAVIds.includes(uav.id)}
                    onSelect={() => toggleUAVSelection(uav.id)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Preflight Tab */}
        <TabsContent value="preflight" className="flex-1 flex flex-col px-2 pb-2 mt-0">
          <Button size="sm" className="h-7 text-[10px] mb-2 w-full" onClick={handleRunPreflight}>
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Run Preflight Checks
          </Button>

          {preflightSummary && (
            <>
              {/* Summary Bar */}
              <div className={cn(
                "rounded p-2 mb-2 border",
                preflightSummary.ready ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30"
              )}>
                <div className="flex items-center gap-1.5 mb-1">
                  {preflightSummary.ready
                    ? <CheckCircle2 className="w-4 h-4 text-success" />
                    : <XCircle className="w-4 h-4 text-destructive" />
                  }
                  <span className="text-xs font-bold">
                    {preflightSummary.ready ? 'READY FOR FLIGHT' : 'NOT READY'}
                  </span>
                </div>
                <div className="flex gap-2 text-[9px]">
                  <span className="text-success">✅ {preflightSummary.pass}</span>
                  <span className="text-warning">⚠️ {preflightSummary.warn}</span>
                  <span className="text-destructive">❌ {preflightSummary.fail}</span>
                  <span className="text-muted-foreground">⏭ {preflightSummary.skip}</span>
                </div>
              </div>

              {/* Results List */}
              <ScrollArea className="flex-1">
                <div className="space-y-1 pr-2">
                  {Array.from(preflightResults.entries()).map(([uavId, checks]) => (
                    <div key={uavId} className="bg-background rounded p-1.5 border border-border">
                      <div className="text-[9px] font-bold text-foreground mb-1">
                        {uavId === '__global__' ? '🌐 Global' : `🛸 ${uavId}`}
                      </div>
                      {checks.map(check => (
                        <div key={check.id} className="flex items-center gap-1 text-[8px] py-0.5">
                          <span>
                            {check.status === 'pass' ? '✅' :
                             check.status === 'warn' ? '⚠️' :
                             check.status === 'fail' ? '❌' : '⏭️'}
                          </span>
                          <span className="text-muted-foreground flex-1">{check.name}</span>
                          <span className="text-foreground">{check.message}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Button size="sm" variant="outline" className="h-6 text-[8px] mt-1" onClick={handleExportPreflight}>
                Export Report (.txt)
              </Button>
            </>
          )}

          {!preflightSummary && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <CheckCircle2 className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                <p className="text-[10px] text-muted-foreground">Run preflight checks</p>
                <p className="text-[8px] text-muted-foreground">GPS, battery, comms, proximity</p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Commands Tab */}
        <TabsContent value="commands" className="flex-1 flex flex-col px-2 pb-2 mt-0">
          <div className="text-[8px] text-muted-foreground mb-2">
            Selected: {selectedUAVIds.length} UAVs
          </div>

          <div className="grid grid-cols-2 gap-1">
            <Button size="sm" variant="outline" className="h-7 text-[9px]"
              onClick={() => { toast.info('Takeoff command sent'); }}>
              <ArrowUp className="w-3 h-3 mr-1" />Takeoff
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[9px]"
              onClick={() => { toast.info('Land command sent'); }}>
              <ArrowDown className="w-3 h-3 mr-1" />Land
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[9px]"
              onClick={() => { toast.info('RTH command sent'); }}>
              <Navigation className="w-3 h-3 mr-1" />RTH
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[9px]"
              onClick={() => { toast.info('Hover command sent'); }}>
              <Eye className="w-3 h-3 mr-1" />Hover
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[9px]"
              onClick={() => { toast.info('Motors armed'); }}>
              <Zap className="w-3 h-3 mr-1 text-warning" />Arm
            </Button>
            <Button size="sm" variant="destructive" className="h-7 text-[9px]"
              onClick={() => { toast.info('Motors disarmed'); }}>
              <Power className="w-3 h-3 mr-1" />Disarm
            </Button>
          </div>

          <div className="mt-3">
            <div className="text-[9px] font-bold text-foreground mb-1">Light Control</div>
            <div className="grid grid-cols-4 gap-1">
              {[
                { color: '#FF0000', label: 'Red' },
                { color: '#00FF00', label: 'Green' },
                { color: '#0000FF', label: 'Blue' },
                { color: '#FFFFFF', label: 'White' },
                { color: '#FFFF00', label: 'Yellow' },
                { color: '#FF00FF', label: 'Magenta' },
                { color: '#00FFFF', label: 'Cyan' },
                { color: '#000000', label: 'Off' },
              ].map(c => (
                <button
                  key={c.label}
                  className="h-6 rounded border border-border text-[7px] font-mono-code"
                  style={{ backgroundColor: c.color, color: c.color === '#000000' || c.color === '#0000FF' ? '#fff' : '#000' }}
                  onClick={() => toast.info(`Light: ${c.label}`)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <div className="text-[9px] font-bold text-foreground mb-1">Signal</div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-6 text-[8px] flex-1"
                onClick={() => toast.info('Beep signal sent')}>
                🔊 Beep
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-[8px] flex-1"
                onClick={() => toast.info('Flash signal sent')}>
                💡 Flash
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-[8px] flex-1"
                onClick={() => toast.info('Locate signal sent')}>
                📍 Locate
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Hardware Tab */}
        <TabsContent value="hardware" className="flex-1 flex flex-col px-2 pb-2 mt-0">
          <div className="grid grid-cols-4 gap-1 text-[8px] mb-2">
            <div className="bg-background rounded px-1.5 py-0.5 text-center">
              <div className="text-foreground font-bold">{fireoneModules.length}</div>
              <div className="text-muted-foreground">FireOne</div>
            </div>
            <div className="bg-background rounded px-1.5 py-0.5 text-center">
              <div className="text-foreground font-bold">{pbusDevices.length}</div>
              <div className="text-muted-foreground">PBUS</div>
            </div>
            <div className="bg-background rounded px-1.5 py-0.5 text-center">
              <div className={cn("font-bold", totalHardwareDevices > 0 ? 'text-success' : 'text-muted-foreground')}>
                {totalHardwareDevices}
              </div>
              <div className="text-muted-foreground">Total</div>
            </div>
            <div className="bg-background rounded px-1.5 py-0.5 text-center">
              <div className={cn("font-bold",
                fireone.isConnected || pbus.isConnected ? 'text-success' : 'text-muted-foreground'
              )}>
                {(fireone.isConnected ? 1 : 0) + (pbus.isConnected ? 1 : 0)}
              </div>
              <div className="text-muted-foreground">Links</div>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-1 pr-2">
              {/* FireOne Modules */}
              {fireoneModules.length > 0 && (
                <div className="text-[8px] font-bold text-red-400 uppercase tracking-wider mb-1">FireOne Modules</div>
              )}
              {fireoneModules.map(mod => (
                <div key={`fo-${mod.moduleAddress}`} className="p-1.5 rounded border border-border bg-background">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="font-bold text-foreground">FO-{mod.moduleAddress}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={cn("text-[8px]", (mod.batteryVoltage ?? 12) < 11 ? 'text-destructive' : 'text-success')}>
                        {(mod.batteryVoltage ?? 0).toFixed(1)}V
                      </span>
                      <span className={cn("text-[8px]", (mod.rssiDbm ?? -50) < -75 ? 'text-warning' : 'text-success')}>
                        {mod.rssiDbm ?? 0}dBm
                      </span>
                      <Badge variant={mod.armed ? 'default' : 'outline'} className="text-[7px] h-3.5 px-1">
                        {mod.armed ? 'ARMED' : 'SAFE'}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-[7px] text-muted-foreground mt-0.5">
                    {mod.igniters ? `${mod.igniters.filter((ig: any) => ig.resistance > 0.5 && ig.resistance < 50).length}/${mod.igniters.length} igniters OK` : 'No continuity data'}
                    {mod.firmwareVersion ? ` · FW ${mod.firmwareVersion}` : ''}
                  </div>
                </div>
              ))}

              {/* PBUS Devices */}
              {pbusDevices.length > 0 && (
                <div className="text-[8px] font-bold text-amber-400 uppercase tracking-wider mb-1 mt-2">PBUS Devices</div>
              )}
              {pbusDevices.map(dev => (
                <div key={`pb-${dev.address}`} className="p-1.5 rounded border border-border bg-background">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="font-bold text-foreground">{dev.type}-{dev.address}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={cn("text-[8px]", dev.batteryV < 3.3 ? 'text-destructive' : 'text-success')}>
                        {dev.batteryV.toFixed(1)}V
                      </span>
                      <span className="text-[8px] text-muted-foreground">
                        433:{dev.rssi433}dBm
                      </span>
                      <span className="text-[8px] text-muted-foreground">
                        868:{dev.rssi868}dBm
                      </span>
                      <Badge variant={dev.armed ? 'default' : 'outline'} className="text-[7px] h-3.5 px-1">
                        {dev.armed ? 'ARMED' : 'SAFE'}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-[7px] text-muted-foreground mt-0.5">
                    {dev.cueStates.filter(c => c.connected).length}/{dev.channels} cues connected
                    · Band: {dev.activeBand}
                    {dev.firmwareVersion ? ` · FW ${dev.firmwareVersion}` : ''}
                  </div>
                </div>
              ))}

              {totalHardwareDevices === 0 && (
                <div className="text-center py-8">
                  <Cpu className="w-6 h-6 text-muted-foreground mx-auto mb-2 opacity-30" />
                  <p className="text-[10px] text-muted-foreground">No firing hardware connected</p>
                  <p className="text-[8px] text-muted-foreground mt-1">Connect FireOne or PBUS in Connection Manager</p>
                </div>
              )}
            </div>
          </ScrollArea>

          {totalHardwareDevices > 0 && (
            <div className="flex gap-1 mt-2">
              <Button size="sm" variant="outline" className="h-6 text-[8px] flex-1"
                onClick={() => toast.info('Scanning continuity on all devices...')}>
                Scan Continuity
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-[8px] flex-1"
                onClick={() => toast.info('Battery report generated')}>
                Battery Report
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
