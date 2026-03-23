/**
 * DMXIOPanel — DMX Send/Receive visualization
 * Shows universe I/O status, buffer activity, and packet stats
 * BR2049 holographic aesthetics
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';

type DMXMode = 'send' | 'receive' | 'duplex';
type DMXProtocol = 'artnet' | 'sacn';

interface UniverseIO {
  id: number;
  mode: DMXMode;
  protocol: DMXProtocol;
  priority: number;
  active: boolean;
  pps: number; // packets per second
  lastActivity: number;
  sendBuffer: Uint8Array;
  recvBuffer: Uint8Array;
}

function generateSimBuffers(): { send: Uint8Array; recv: Uint8Array } {
  const send = new Uint8Array(512);
  const recv = new Uint8Array(512);
  const t = performance.now() * 0.001;
  for (let i = 0; i < 512; i++) {
    send[i] = Math.floor((Math.sin(t * 2 + i * 0.05) * 0.5 + 0.5) * 255);
    recv[i] = Math.floor((Math.cos(t * 1.5 + i * 0.03) * 0.5 + 0.5) * 180);
  }
  return { send, recv };
}

function BufferViz({ sendBuf, recvBuf }: { sendBuf: Uint8Array; recvBuf: Uint8Array }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const mid = h / 2;

    ctx.fillStyle = 'hsl(220, 12%, 4%)';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'hsl(270, 60%, 50%, 0.06)';
    ctx.lineWidth = 0.5;
    for (let y = 0; y < h; y += 8) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const barW = w / 64; // show 64 bars (8ch avg each)

    // Send buffer — cyan, top half
    for (let i = 0; i < 64; i++) {
      let sum = 0;
      for (let j = 0; j < 8; j++) sum += sendBuf[i * 8 + j];
      const avg = sum / 8 / 255;
      const barH = avg * mid * 0.9;
      ctx.fillStyle = `hsla(185, 80%, 55%, ${0.4 + avg * 0.6})`;
      ctx.fillRect(i * barW + 1, mid - barH, barW - 1, barH);
    }

    // Recv buffer — amber, bottom half
    for (let i = 0; i < 64; i++) {
      let sum = 0;
      for (let j = 0; j < 8; j++) sum += recvBuf[i * 8 + j];
      const avg = sum / 8 / 255;
      const barH = avg * mid * 0.9;
      ctx.fillStyle = `hsla(32, 100%, 50%, ${0.3 + avg * 0.6})`;
      ctx.fillRect(i * barW + 1, mid + 1, barW - 1, barH);
    }

    // Center divider
    ctx.strokeStyle = 'hsl(270, 60%, 50%, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
  }, [sendBuf, recvBuf]);

  return (
    <div className="relative">
      <canvas ref={canvasRef} width={320} height={80} className="w-full rounded" style={{ imageRendering: 'pixelated' }} />
      <div className="absolute top-0.5 left-1 flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(185, 80%, 55%)' }} />
        <span className="text-[5px] font-mono" style={{ color: 'hsl(185, 80%, 55%)' }}>TX</span>
      </div>
      <div className="absolute bottom-0.5 left-1 flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(32, 100%, 50%)' }} />
        <span className="text-[5px] font-mono" style={{ color: 'hsl(32, 100%, 50%)' }}>RX</span>
      </div>
    </div>
  );
}

const MODE_COLORS: Record<DMXMode, string> = {
  send: 'hsl(185, 80%, 50%)',
  receive: 'hsl(32, 100%, 50%)',
  duplex: 'hsl(270, 60%, 55%)',
};

export default function DMXIOPanel({ fs = false }: { fs?: boolean }) {
  const [universes, setUniverses] = useState<UniverseIO[]>(() => {
    const initial = generateSimBuffers();
    return [
      { id: 1, mode: 'duplex', protocol: 'artnet', priority: 100, active: true, pps: 44, lastActivity: Date.now(), sendBuffer: initial.send, recvBuffer: initial.recv },
      { id: 2, mode: 'send', protocol: 'artnet', priority: 100, active: true, pps: 40, lastActivity: Date.now(), sendBuffer: initial.send, recvBuffer: new Uint8Array(512) },
      { id: 3, mode: 'receive', protocol: 'sacn', priority: 120, active: false, pps: 0, lastActivity: Date.now() - 5000, sendBuffer: new Uint8Array(512), recvBuffer: initial.recv },
    ];
  });
  const [selectedUni, setSelectedUni] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [newId, setNewId] = useState(4);
  const [newMode, setNewMode] = useState<DMXMode>('duplex');
  const [newProto, setNewProto] = useState<DMXProtocol>('artnet');

  // Simulate activity
  useEffect(() => {
    const interval = setInterval(() => {
      setUniverses(prev => prev.map(u => {
        const bufs = generateSimBuffers();
        return {
          ...u,
          active: u.mode !== 'receive' || Math.random() > 0.3,
          pps: u.active ? 38 + Math.floor(Math.random() * 12) : 0,
          lastActivity: u.active ? Date.now() : u.lastActivity,
          sendBuffer: u.mode !== 'receive' ? bufs.send : u.sendBuffer,
          recvBuffer: u.mode !== 'send' ? bufs.recv : u.recvBuffer,
        };
      }));
    }, 250);
    return () => clearInterval(interval);
  }, []);

  const selected = universes.find(u => u.id === selectedUni) || universes[0];

  const addUniverse = () => {
    if (universes.find(u => u.id === newId)) return;
    const bufs = generateSimBuffers();
    setUniverses(prev => [...prev, {
      id: newId, mode: newMode, protocol: newProto, priority: 100,
      active: false, pps: 0, lastActivity: Date.now(),
      sendBuffer: bufs.send, recvBuffer: bufs.recv,
    }]);
    setShowAdd(false);
    setNewId(prev => prev + 1);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'hsl(220, 12%, 4%)' }}>
      {/* Header */}
      <div className="shrink-0 px-3 py-2 border-b" style={{ borderColor: 'hsl(270, 60%, 50%, 0.08)' }}>
        <div className="flex items-center justify-between">
          <span className="text-[7px] font-mono font-bold tracking-[0.2em]" style={{ color: 'hsl(270, 60%, 55%)' }}>DMX I/O CONTROLLER</span>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="text-[6px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: 'hsl(270, 60%, 50%, 0.1)', color: 'hsl(270, 60%, 65%)' }}
          >
            + ADD UNIVERSE
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="shrink-0 px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: 'hsl(270, 60%, 50%, 0.08)', background: 'hsl(220, 12%, 6%)' }}>
          <div className="flex items-center gap-1">
            <span className="text-[6px] font-mono text-muted-foreground/40">UNI</span>
            <input
              type="number" value={newId} onChange={e => setNewId(Number(e.target.value))}
              className="w-8 text-[7px] font-mono bg-transparent border rounded px-1 py-0.5 text-center"
              style={{ borderColor: 'hsl(270, 60%, 50%, 0.2)', color: 'hsl(270, 60%, 65%)' }}
            />
          </div>
          <select
            value={newMode} onChange={e => setNewMode(e.target.value as DMXMode)}
            className="text-[6px] font-mono bg-transparent border rounded px-1 py-0.5"
            style={{ borderColor: 'hsl(270, 60%, 50%, 0.2)', color: 'hsl(270, 60%, 65%)' }}
          >
            <option value="send">SEND</option>
            <option value="receive">RECV</option>
            <option value="duplex">DUPLEX</option>
          </select>
          <select
            value={newProto} onChange={e => setNewProto(e.target.value as DMXProtocol)}
            className="text-[6px] font-mono bg-transparent border rounded px-1 py-0.5"
            style={{ borderColor: 'hsl(270, 60%, 50%, 0.2)', color: 'hsl(270, 60%, 65%)' }}
          >
            <option value="artnet">ART-NET</option>
            <option value="sacn">sACN</option>
          </select>
          <button onClick={addUniverse} className="text-[6px] font-mono px-2 py-0.5 rounded" style={{ background: 'hsl(120, 70%, 30%, 0.3)', color: 'hsl(120, 70%, 55%)' }}>
            ADD
          </button>
        </div>
      )}

      {/* Universe list */}
      <div className="shrink-0 px-2 py-1.5 space-y-1 overflow-y-auto" style={{ maxHeight: '140px' }}>
        {universes.map(u => (
          <button
            key={u.id}
            onClick={() => setSelectedUni(u.id)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded transition-all text-left",
              selectedUni === u.id ? "ring-1" : "hover:bg-white/[0.02]"
            )}
            style={{
              background: selectedUni === u.id ? 'hsl(270, 60%, 50%, 0.06)' : 'transparent',
              outlineColor: selectedUni === u.id ? 'hsl(270, 60%, 50%, 0.2)' : undefined,
              outlineWidth: selectedUni === u.id ? '1px' : undefined,
              outlineStyle: selectedUni === u.id ? 'solid' : undefined,
            }}
          >
            {/* Activity dot */}
            <div className="relative w-2 h-2 shrink-0">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: u.active ? 'hsl(120, 70%, 45%)' : 'hsl(0, 0%, 25%)' }}
              />
              {u.active && (
                <div
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{ background: 'hsl(120, 70%, 45%, 0.4)' }}
                />
              )}
            </div>

            <span className="text-[8px] font-mono font-bold" style={{ color: 'hsl(0, 0%, 70%)' }}>
              U{u.id}
            </span>

            {/* Mode badge */}
            <span
              className="text-[5px] font-mono font-bold px-1 py-0.5 rounded"
              style={{ background: `${MODE_COLORS[u.mode]}22`, color: MODE_COLORS[u.mode] }}
            >
              {u.mode.toUpperCase()}
            </span>

            {/* Protocol badge */}
            <span className="text-[5px] font-mono px-1 py-0.5 rounded" style={{ background: 'hsl(220, 10%, 15%)', color: 'hsl(0, 0%, 50%)' }}>
              {u.protocol.toUpperCase()}
            </span>

            <span className="flex-1" />

            {/* PPS */}
            <span className="text-[6px] font-mono" style={{ color: u.active ? 'hsl(120, 70%, 45%)' : 'hsl(0, 0%, 30%)' }}>
              {u.pps} pps
            </span>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="h-[1px] shrink-0" style={{ background: 'linear-gradient(90deg, transparent 10%, hsl(270, 60%, 50%, 0.1) 50%, transparent 90%)' }} />

      {/* Selected universe detail */}
      {selected && (
        <div className="flex-1 px-3 py-2 space-y-2 overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-[7px] font-mono font-bold" style={{ color: MODE_COLORS[selected.mode] }}>
              UNIVERSE {selected.id} — {selected.mode.toUpperCase()}
            </span>
            <span className="text-[5px] font-mono" style={{ color: 'hsl(0, 0%, 40%)' }}>
              PRI: {selected.priority}
            </span>
          </div>

          {/* Buffer visualization */}
          <BufferViz sendBuf={selected.sendBuffer} recvBuf={selected.recvBuffer} />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'PACKETS/S', value: `${selected.pps}`, color: 'hsl(185, 80%, 55%)' },
              { label: 'BUFFER UTIL', value: `${Math.floor(55 + Math.random() * 30)}%`, color: 'hsl(270, 60%, 55%)' },
              { label: 'LAST ACTIVE', value: selected.active ? 'NOW' : `${Math.floor((Date.now() - selected.lastActivity) / 1000)}s ago`, color: selected.active ? 'hsl(120, 70%, 45%)' : 'hsl(32, 100%, 50%)' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-[5px] font-mono text-muted-foreground/30">{s.label}</div>
                <div className="text-[8px] font-mono font-bold" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
