/**
 * MA3NetworkPanel — grandMA3 Passive Node UI
 * Console-grade aesthetics: dark greys, monospace, LED indicators, tactile buttons.
 * Real-time universe grid, PPS sparklines, and connection management.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff, RefreshCw, Zap, ArrowDownToLine, ArrowUpFromLine, Radio, Activity } from 'lucide-react';
import { getMA3Node, type MA3NodeState, type MA3Universe } from '@/lib/grandMA3Node';

// ═══ Hook: real-time MA3 node state ═══
function useMA3NodeState() {
  const node = useMemo(() => getMA3Node(), []);
  const [state, setState] = useState<MA3NodeState>(node.getState());
  const [ppsHistory, setPpsHistory] = useState<number[]>([0]);

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    const refresh = () => setState({ ...node.getState() });

    unsubs.push(node.on('connected', refresh));
    unsubs.push(node.on('disconnected', refresh));
    unsubs.push(node.on('dmx-input', refresh));
    unsubs.push(node.on('dmx-output', refresh));
    unsubs.push(node.on('error', refresh));
    unsubs.push(node.on('pps-update', (d: { totalPPS: number }) => {
      setPpsHistory(prev => {
        const next = [...prev, d.totalPPS];
        return next.length > 30 ? next.slice(-30) : next;
      });
      refresh();
    }));
    unsubs.push(node.on('sync', refresh));

    // Poll state every 500ms for latency/pps
    const interval = setInterval(refresh, 500);

    return () => {
      unsubs.forEach(u => u());
      clearInterval(interval);
    };
  }, [node]);

  return { node, state, ppsHistory };
}

// ═══ LED Indicator ═══
function LED({ on, color = 'green', size = 6, pulse = false }: { on: boolean; color?: 'green' | 'red' | 'amber' | 'cyan'; size?: number; pulse?: boolean }) {
  const colors = {
    green: on ? 'hsl(120 70% 45%)' : 'hsl(120 10% 15%)',
    red: on ? 'hsl(0 85% 48%)' : 'hsl(0 10% 15%)',
    amber: on ? 'hsl(32 100% 50%)' : 'hsl(32 20% 15%)',
    cyan: on ? 'hsl(190 80% 50%)' : 'hsl(190 10% 15%)',
  };
  const glowColors = {
    green: 'hsl(120 70% 45% / 0.5)',
    red: 'hsl(0 85% 48% / 0.5)',
    amber: 'hsl(32 100% 50% / 0.5)',
    cyan: 'hsl(190 80% 50% / 0.5)',
  };

  return (
    <div
      className={cn("rounded-full shrink-0", pulse && on && "animate-pulse")}
      style={{
        width: size,
        height: size,
        backgroundColor: colors[color],
        boxShadow: on ? `0 0 ${size}px ${glowColors[color]}` : 'none',
      }}
    />
  );
}

// ═══ Mini Sparkline ═══
function Sparkline({ data, width = 60, height = 16, color = 'hsl(120 70% 45%)' }: { data: number[]; width?: number; height?: number; color?: string }) {
  if (data.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (v / max) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1} />
      {/* Current value dot */}
      {data.length > 0 && (
        <circle
          cx={width}
          cy={height - (data[data.length - 1] / max) * height}
          r={2}
          fill={color}
        />
      )}
    </svg>
  );
}

// ═══ Tactile Button ═══
function TactileButton({ label, onClick, variant = 'default', disabled = false, icon: Icon, pulse = false }: {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'connect' | 'disconnect' | 'sync' | 'simulate';
  disabled?: boolean;
  icon?: React.ElementType;
  pulse?: boolean;
}) {
  const variantStyles = {
    default: 'border-border/30 text-muted-foreground/60 hover:text-foreground hover:bg-white/5',
    connect: 'border-[hsl(120_70%_45%/0.3)] text-[hsl(120_70%_50%)] hover:bg-[hsl(120_70%_45%/0.1)]',
    disconnect: 'border-[hsl(0_85%_48%/0.3)] text-[hsl(0_85%_55%)] hover:bg-[hsl(0_85%_48%/0.1)]',
    sync: 'border-[hsl(190_80%_50%/0.3)] text-[hsl(190_80%_55%)] hover:bg-[hsl(190_80%_50%/0.1)]',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded border text-[7px] font-mono font-bold uppercase tracking-wider transition-all",
        "disabled:opacity-30 disabled:cursor-not-allowed",
        variantStyles[variant],
      )}
      style={{ background: 'hsl(220 12% 8%)' }}
    >
      {Icon && <Icon className="w-2.5 h-2.5" />}
      {label}
    </button>
  );
}

// ═══ Universe Row ═══
function UniverseRow({ universe, onToggleMode }: { universe: MA3Universe; onToggleMode: (id: number) => void }) {
  const isActive = universe.active && (performance.now() - universe.lastUpdate < 2000);

  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 border-b transition-colors"
      style={{
        borderColor: 'hsl(220 10% 12%)',
        background: isActive ? 'hsl(220 12% 7%)' : 'hsl(220 12% 5%)',
      }}
    >
      {/* Universe ID */}
      <div className="w-8 text-center">
        <span className="text-[9px] font-mono font-bold" style={{ color: 'hsl(32 100% 55%)' }}>
          {String(universe.id).padStart(2, '0')}
        </span>
      </div>

      {/* Activity LED */}
      <LED on={isActive} color="green" size={5} pulse={isActive} />

      {/* Net.Subnet.Universe address */}
      <span className="text-[6px] font-mono text-muted-foreground/40 w-12">
        {universe.net}.{universe.subnet}.{universe.universe}
      </span>

      {/* Mode toggle */}
      <button
        onClick={() => onToggleMode(universe.id)}
        className={cn(
          "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[6px] font-mono font-bold uppercase tracking-wider border transition-all",
          universe.mode === 'input'
            ? "border-[hsl(190_80%_50%/0.3)] text-[hsl(190_80%_55%)]"
            : "border-[hsl(32_100%_50%/0.3)] text-[hsl(32_100%_55%)]"
        )}
        style={{ background: 'hsl(220 12% 8%)' }}
      >
        {universe.mode === 'input'
          ? <><ArrowDownToLine className="w-2 h-2" /> IN</>
          : <><ArrowUpFromLine className="w-2 h-2" /> OUT</>
        }
      </button>

      {/* Priority */}
      <span className="text-[5px] font-mono text-muted-foreground/25 w-6">
        P{universe.priority}
      </span>

      {/* PPS */}
      <div className="flex items-center gap-0.5 ml-auto">
        <span className="text-[7px] font-mono font-bold" style={{
          color: universe.pps > 30 ? 'hsl(120 70% 50%)' : universe.pps > 0 ? 'hsl(32 100% 55%)' : 'hsl(220 10% 25%)',
        }}>
          {universe.pps}
        </span>
        <span className="text-[5px] font-mono text-muted-foreground/20">pps</span>
      </div>
    </div>
  );
}

// ═══ Main Panel ═══
interface MA3NetworkPanelProps {
  fs?: boolean;
}

export default function MA3NetworkPanel({ fs = false }: MA3NetworkPanelProps) {
  const { node, state, ppsHistory } = useMA3NodeState();
  const [relayUrl, setRelayUrl] = useState(node.getConfig().relayUrl);

  const handleConnect = useCallback(() => {
    node.updateConfig({ relayUrl });
    node.connect();
  }, [node, relayUrl]);

  const handleDisconnect = useCallback(() => {
    node.disconnect();
  }, [node]);

  const handleSync = useCallback(() => {
    node.sendArtSync();
  }, [node]);

  const handleToggleMode = useCallback((id: number) => {
    const current = state.universes[id]?.mode;
    node.setUniverseMode(id, current === 'input' ? 'output' : 'input');
  }, [node, state.universes]);

  const activeUniverses = state.universes.filter(u => u.active && (performance.now() - u.lastUpdate < 2000)).length;

  return (
    <div className={cn("flex flex-col h-full", fs && "absolute inset-0 z-50")}>
      {/* ═══ Header: grandMA3 node identity ═══ */}
      <div className="shrink-0 px-3 py-2 border-b" style={{ borderColor: 'hsl(220 10% 12%)', background: 'hsl(220 12% 5%)' }}>
        {/* Logo + status */}
        <div className="flex items-center gap-2 mb-2">
          <Radio className="w-3.5 h-3.5" style={{ color: 'hsl(32 100% 55%)' }} />
          <span className="text-[8px] font-mono font-bold tracking-[0.2em]" style={{ color: 'hsl(32 100% 55%)' }}>
            MA3 NODE
          </span>
          <div className="flex items-center gap-1 ml-auto">
            <LED on={state.connected} color={state.connected ? 'green' : 'red'} size={6} />
            <span className="text-[7px] font-mono font-bold" style={{
              color: state.connected ? 'hsl(120 70% 50%)' : 'hsl(0 85% 55%)',
            }}>
              {state.connected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Node label + protocol */}
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'hsl(220 12% 8%)', border: '1px solid hsl(220 10% 15%)' }}>
            <span className="text-[6px] font-mono text-muted-foreground/30">NODE</span>
            <span className="text-[7px] font-mono font-bold text-foreground/70">{state.nodeLabel}</span>
          </div>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'hsl(220 12% 8%)', border: '1px solid hsl(220 10% 15%)' }}>
            <span className="text-[6px] font-mono text-muted-foreground/30">PROTO</span>
            <span className="text-[7px] font-mono font-bold uppercase" style={{ color: 'hsl(270 60% 55%)' }}>
              {state.protocol}
            </span>
          </div>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'hsl(220 12% 8%)', border: '1px solid hsl(220 10% 15%)' }}>
            <span className="text-[6px] font-mono text-muted-foreground/30">MODE</span>
            <span className="text-[7px] font-mono font-bold uppercase" style={{ color: 'hsl(190 80% 55%)' }}>
              {state.mode}
            </span>
          </div>
        </div>

        {/* Relay URL input */}
        <div className="flex items-center gap-1 mb-2">
          <span className="text-[6px] font-mono text-muted-foreground/30 shrink-0">RELAY</span>
          <input
            type="text"
            value={relayUrl}
            onChange={(e) => setRelayUrl(e.target.value)}
            className="flex-1 px-1.5 py-0.5 rounded text-[7px] font-mono bg-transparent border text-foreground/70 focus:outline-none focus:border-[hsl(32_100%_50%/0.5)]"
            style={{ borderColor: 'hsl(220 10% 18%)', background: 'hsl(220 12% 6%)' }}
            placeholder="ws://192.168.1.100:6455"
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <TactileButton
            label="Connect"
            icon={Wifi}
            variant="connect"
            onClick={handleConnect}
            disabled={state.connected}
          />
          <TactileButton
            label="Disconnect"
            icon={WifiOff}
            variant="disconnect"
            onClick={handleDisconnect}
            disabled={!state.connected}
          />
          <TactileButton
            label="ArtSync"
            icon={Zap}
            variant="sync"
            onClick={handleSync}
            disabled={!state.connected}
          />
          <div className="flex-1" />
          {state.artSyncActive && (
            <div className="flex items-center gap-1">
              <LED on={true} color="cyan" size={4} pulse />
              <span className="text-[5px] font-mono" style={{ color: 'hsl(190 80% 55%)' }}>SYNC</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Telemetry strip ═══ */}
      <div className="shrink-0 flex items-center gap-3 px-3 py-1.5 border-b" style={{ borderColor: 'hsl(220 10% 10%)', background: 'hsl(220 12% 4%)' }}>
        {/* Total PPS */}
        <div className="flex items-center gap-1.5">
          <Activity className="w-2.5 h-2.5 text-muted-foreground/30" />
          <span className="text-[9px] font-mono font-bold" style={{ color: state.totalPPS > 0 ? 'hsl(120 70% 50%)' : 'hsl(220 10% 25%)' }}>
            {state.totalPPS}
          </span>
          <span className="text-[5px] font-mono text-muted-foreground/20">PPS</span>
          <Sparkline data={ppsHistory} width={50} height={14} color={state.totalPPS > 0 ? 'hsl(120 70% 50%)' : 'hsl(220 10% 25%)'} />
        </div>

        {/* Latency */}
        <div className="flex items-center gap-1">
          <span className="text-[5px] font-mono text-muted-foreground/25">LAT</span>
          <span className="text-[8px] font-mono font-bold" style={{
            color: state.latencyMs < 5 ? 'hsl(120 70% 50%)' : state.latencyMs < 20 ? 'hsl(32 100% 55%)' : 'hsl(0 85% 55%)',
          }}>
            {state.latencyMs.toFixed(1)}ms
          </span>
        </div>

        {/* Active universes */}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-[5px] font-mono text-muted-foreground/25">ACTIVE</span>
          <span className="text-[8px] font-mono font-bold" style={{ color: 'hsl(32 100% 55%)' }}>
            {activeUniverses}/{state.universes.length}
          </span>
        </div>

        {/* Errors */}
        {state.errors.length > 0 && (
          <div className="flex items-center gap-1">
            <LED on={true} color="red" size={4} />
            <span className="text-[5px] font-mono text-[hsl(0_85%_55%)]">ERR:{state.errors.length}</span>
          </div>
        )}
      </div>

      {/* ═══ Universe Grid (scrollable) ═══ */}
      <div className="shrink-0 px-2 py-1 border-b" style={{ borderColor: 'hsl(220 10% 10%)', background: 'hsl(220 12% 5%)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[6px] font-mono font-bold tracking-[0.15em]" style={{ color: 'hsl(270 60% 55%)' }}>
            UNIVERSE GRID
          </span>
          <span className="text-[5px] font-mono text-muted-foreground/20">
            {state.universes.length} CONFIGURED
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ background: 'hsl(220 12% 4%)' }}>
        {/* Column headers */}
        <div className="flex items-center gap-2 px-2 py-1 sticky top-0 z-10" style={{ background: 'hsl(220 12% 6%)', borderBottom: '1px solid hsl(220 10% 12%)' }}>
          <span className="text-[5px] font-mono text-muted-foreground/25 w-8 text-center">UNIV</span>
          <span className="text-[5px] font-mono text-muted-foreground/25 w-3">●</span>
          <span className="text-[5px] font-mono text-muted-foreground/25 w-12">ADDR</span>
          <span className="text-[5px] font-mono text-muted-foreground/25 w-12">MODE</span>
          <span className="text-[5px] font-mono text-muted-foreground/25 w-6">PRI</span>
          <span className="text-[5px] font-mono text-muted-foreground/25 ml-auto">RATE</span>
        </div>

        {state.universes.map(universe => (
          <UniverseRow
            key={universe.id}
            universe={universe}
            onToggleMode={handleToggleMode}
          />
        ))}
      </div>

      {/* ═══ Footer: last ArtPoll ═══ */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1 border-t" style={{ borderColor: 'hsl(220 10% 10%)', background: 'hsl(220 12% 5%)' }}>
        <span className="text-[5px] font-mono text-muted-foreground/20">LAST ARTPOLL</span>
        <span className="text-[6px] font-mono text-muted-foreground/40">
          {state.lastArtPoll > 0 ? `${((performance.now() / 1000 - state.lastArtPoll)).toFixed(0)}s ago` : '—'}
        </span>
        <div className="flex-1" />
        <span className="text-[5px] font-mono text-muted-foreground/15">FXK·MA3·v1.0</span>
      </div>
    </div>
  );
}
