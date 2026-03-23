/**
 * PixelMappingPanel — Interactive UI for PixelMappingManager
 * Create/manage pixel mapping groups, topology selection, grid preview, DMX output
 * BR2049 aesthetic
 */
import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  PixelMappingManager,
  mapFixturesToDMXOutput,
  type Topology,
  type PixelMapConfig,
  type MappedPixel,
} from '@/lib/pixelMapper';
import { Trash2 } from 'lucide-react';

const TOPOLOGIES: Topology[] = ['grid', 'snake', 'matrix', 'circle', 'custom'];
const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

// Generate dummy fixtures for preview
function generateDummyFixtures(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `fix-${i}`,
    x: (i % 8) * 2,
    z: Math.floor(i / 8) * 2,
  }));
}

function GridPreview({ pixels, cols, rows, topology }: { pixels: MappedPixel[]; cols: number; rows: number; topology: Topology }) {
  const cellSize = 14;
  const pad = 2;
  const w = cols * (cellSize + pad) + pad;
  const h = rows * (cellSize + pad) + pad;

  return (
    <svg width={Math.min(w, 280)} height={Math.min(h, 160)} viewBox={`0 0 ${w} ${h}`} className="mx-auto">
      {/* Grid cells */}
      {pixels.map((p, i) => {
        const cx = p.gridX * (cellSize + pad) + pad + cellSize / 2;
        const cy = p.gridY * (cellSize + pad) + pad + cellSize / 2;
        const hue = (p.index / pixels.length) * 270;
        return (
          <g key={p.fixtureId}>
            <rect
              x={cx - cellSize / 2}
              y={cy - cellSize / 2}
              width={cellSize}
              height={cellSize}
              rx={2}
              fill={`hsl(${hue}, 70%, 35%)`}
              stroke={`hsl(${hue}, 70%, 50%)`}
              strokeWidth={0.5}
            />
            <text
              x={cx}
              y={cy + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={cellSize > 10 ? 5 : 4}
              fontFamily="monospace"
            >
              {p.index + 1}
            </text>
          </g>
        );
      })}
      {/* Snake arrows for snake topology */}
      {topology === 'snake' && Array.from({ length: rows }, (_, row) => {
        const y = row * (cellSize + pad) + pad + cellSize / 2;
        const isReversed = row % 2 === 1;
        const x1 = isReversed ? w - pad - 4 : pad + 4;
        const x2 = isReversed ? pad + 4 : w - pad - 4;
        return (
          <line key={`arrow-${row}`} x1={x1} y1={y} x2={x2} y2={y}
            stroke="hsl(270, 60%, 50%, 0.15)" strokeWidth={0.8} strokeDasharray="3 2"
            markerEnd="url(#arrowhead)" />
        );
      })}
      <defs>
        <marker id="arrowhead" markerWidth="4" markerHeight="3" refX="4" refY="1.5" orient="auto">
          <polygon points="0 0, 4 1.5, 0 3" fill="hsl(270, 60%, 50%, 0.3)" />
        </marker>
      </defs>
    </svg>
  );
}

interface GroupEntry {
  name: string;
  config: PixelMapConfig;
  fixtureCount: number;
}

export default function PixelMappingPanel({ fs = false }: { fs?: boolean }) {
  const [manager] = useState(() => new PixelMappingManager());
  const [groups, setGroups] = useState<GroupEntry[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Add form state
  const [formName, setFormName] = useState('');
  const [formTopology, setFormTopology] = useState<Topology>('grid');
  const [formCols, setFormCols] = useState(8);
  const [formRows, setFormRows] = useState(4);
  const [formGroupSize, setFormGroupSize] = useState(1);
  const [formCorner, setFormCorner] = useState<typeof CORNERS[number]>('top-left');

  const addGroup = useCallback(() => {
    if (!formName.trim()) return;
    const config: PixelMapConfig = {
      topology: formTopology,
      columns: formCols,
      rows: formRows,
      groupSize: formGroupSize,
      startCorner: formCorner,
    };
    const fixtures = generateDummyFixtures(formCols * formRows * formGroupSize);
    manager.addGroup(formName, fixtures, config);
    setGroups(prev => [...prev, { name: formName, config, fixtureCount: fixtures.length }]);
    setSelectedGroup(formName);
    setShowAdd(false);
    setFormName('');
  }, [formName, formTopology, formCols, formRows, formGroupSize, formCorner, manager]);

  const removeGroup = useCallback((name: string) => {
    manager.removeGroup(name);
    setGroups(prev => prev.filter(g => g.name !== name));
    if (selectedGroup === name) setSelectedGroup(null);
  }, [manager, selectedGroup]);

  const selectedMapping = selectedGroup ? manager.getMapping(selectedGroup) : [];
  const selectedConfig = selectedGroup ? manager.getConfig(selectedGroup) : null;
  const dmxOutput = selectedMapping.length > 0 ? mapFixturesToDMXOutput(selectedMapping) : [];

  const inputStyle = {
    borderColor: 'hsl(270, 60%, 50%, 0.2)',
    color: 'hsl(270, 60%, 65%)',
    background: 'transparent',
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'hsl(220, 12%, 4%)' }}>
      {/* Header */}
      <div className="shrink-0 px-3 py-2 border-b" style={{ borderColor: 'hsl(270, 60%, 50%, 0.08)' }}>
        <div className="flex items-center justify-between">
          <span className="text-[7px] font-mono font-bold tracking-[0.2em]" style={{ color: 'hsl(270, 60%, 55%)' }}>PIXEL MAPPING MANAGER</span>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="text-[6px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: 'hsl(270, 60%, 50%, 0.1)', color: 'hsl(270, 60%, 65%)' }}
          >
            + NEW GROUP
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="shrink-0 px-3 py-2 border-b space-y-1.5" style={{ borderColor: 'hsl(270, 60%, 50%, 0.08)', background: 'hsl(220, 12%, 6%)' }}>
          <input
            value={formName} onChange={e => setFormName(e.target.value)}
            placeholder="Group name..."
            className="w-full text-[7px] font-mono border rounded px-2 py-1"
            style={inputStyle}
          />
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <span className="text-[5px] font-mono text-muted-foreground/30 block mb-0.5">TOPOLOGY</span>
              <select value={formTopology} onChange={e => setFormTopology(e.target.value as Topology)}
                className="w-full text-[6px] font-mono border rounded px-1 py-0.5" style={inputStyle}>
                {TOPOLOGIES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <span className="text-[5px] font-mono text-muted-foreground/30 block mb-0.5">COLS</span>
              <input type="number" value={formCols} onChange={e => setFormCols(Number(e.target.value))} min={1} max={32}
                className="w-full text-[7px] font-mono border rounded px-1 py-0.5 text-center" style={inputStyle} />
            </div>
            <div>
              <span className="text-[5px] font-mono text-muted-foreground/30 block mb-0.5">ROWS</span>
              <input type="number" value={formRows} onChange={e => setFormRows(Number(e.target.value))} min={1} max={32}
                className="w-full text-[7px] font-mono border rounded px-1 py-0.5 text-center" style={inputStyle} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <span className="text-[5px] font-mono text-muted-foreground/30 block mb-0.5">GROUP SIZE</span>
              <input type="number" value={formGroupSize} onChange={e => setFormGroupSize(Number(e.target.value))} min={1} max={16}
                className="w-full text-[7px] font-mono border rounded px-1 py-0.5 text-center" style={inputStyle} />
            </div>
            <div>
              <span className="text-[5px] font-mono text-muted-foreground/30 block mb-0.5">START CORNER</span>
              <select value={formCorner} onChange={e => setFormCorner(e.target.value as typeof CORNERS[number])}
                className="w-full text-[6px] font-mono border rounded px-1 py-0.5" style={inputStyle}>
                {CORNERS.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
          <button onClick={addGroup} className="w-full text-[6px] font-mono py-1 rounded" style={{ background: 'hsl(120, 70%, 30%, 0.3)', color: 'hsl(120, 70%, 55%)' }}>
            CREATE GROUP
          </button>
        </div>
      )}

      {/* Group list */}
      <div className="shrink-0 px-2 py-1.5 space-y-0.5 overflow-y-auto" style={{ maxHeight: '100px' }}>
        {groups.length === 0 && (
          <div className="text-[6px] font-mono text-muted-foreground/25 text-center py-3">No pixel mapping groups configured</div>
        )}
        {groups.map(g => (
          <div
            key={g.name}
            className={cn("flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-all", selectedGroup === g.name ? "ring-1" : "hover:bg-white/[0.02]")}
            style={{ background: selectedGroup === g.name ? 'hsl(270, 60%, 50%, 0.06)' : 'transparent' }}
            onClick={() => setSelectedGroup(g.name)}
          >
            <span className="text-[7px] font-mono font-bold" style={{ color: 'hsl(270, 60%, 65%)' }}>{g.name}</span>
            <span className="text-[5px] font-mono px-1 py-0.5 rounded" style={{ background: 'hsl(270, 60%, 50%, 0.1)', color: 'hsl(270, 40%, 50%)' }}>
              {g.config.topology.toUpperCase()}
            </span>
            <span className="text-[5px] font-mono text-muted-foreground/30">{g.config.columns}×{g.config.rows}</span>
            <span className="text-[5px] font-mono text-muted-foreground/20">{g.fixtureCount}px</span>
            <span className="flex-1" />
            <button onClick={e => { e.stopPropagation(); removeGroup(g.name); }} className="p-0.5 hover:bg-red-500/10 rounded">
              <Trash2 className="w-2.5 h-2.5 text-red-400/40 hover:text-red-400" />
            </button>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="h-[1px] shrink-0" style={{ background: 'linear-gradient(90deg, transparent 10%, hsl(270, 60%, 50%, 0.1) 50%, transparent 90%)' }} />

      {/* Selected group preview */}
      {selectedConfig && selectedMapping.length > 0 && (
        <div className="flex-1 px-3 py-2 space-y-2 overflow-y-auto">
          <span className="text-[7px] font-mono font-bold" style={{ color: 'hsl(270, 60%, 55%)' }}>
            {selectedGroup} — {selectedConfig.topology.toUpperCase()} {selectedConfig.columns}×{selectedConfig.rows}
          </span>

          {/* Grid preview */}
          <div className="border rounded p-2" style={{ borderColor: 'hsl(270, 60%, 50%, 0.1)', background: 'hsl(220, 12%, 3%)' }}>
            <GridPreview
              pixels={selectedMapping}
              cols={selectedConfig.columns}
              rows={selectedConfig.rows}
              topology={selectedConfig.topology}
            />
          </div>

          {/* DMX Output table */}
          <div>
            <span className="text-[6px] font-mono text-muted-foreground/30 block mb-1">DMX OUTPUT PATCHING</span>
            <div className="overflow-y-auto rounded border" style={{ maxHeight: '80px', borderColor: 'hsl(270, 60%, 50%, 0.08)' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'hsl(220, 12%, 8%)' }}>
                    {['PIXEL', 'UNIVERSE', 'CH START'].map(h => (
                      <th key={h} className="text-[5px] font-mono text-muted-foreground/30 px-2 py-0.5 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dmxOutput.slice(0, 20).map(d => (
                    <tr key={d.pixelIndex} style={{ borderTop: '1px solid hsl(270, 60%, 50%, 0.04)' }}>
                      <td className="text-[6px] font-mono px-2 py-0.5" style={{ color: 'hsl(270, 60%, 65%)' }}>{d.pixelIndex + 1}</td>
                      <td className="text-[6px] font-mono px-2 py-0.5" style={{ color: 'hsl(185, 80%, 55%)' }}>{d.universe}</td>
                      <td className="text-[6px] font-mono px-2 py-0.5" style={{ color: 'hsl(32, 100%, 50%)' }}>{d.startChannel}</td>
                    </tr>
                  ))}
                  {dmxOutput.length > 20 && (
                    <tr><td colSpan={3} className="text-[5px] font-mono text-muted-foreground/20 text-center py-0.5">+{dmxOutput.length - 20} more</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
