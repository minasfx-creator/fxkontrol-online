import { useState } from 'react';
import { Package, Plus, Trash2, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRackStore, RACK_TYPE_INFO, generateTubes, type RackType } from '@/store/useRackStore';
import { useProjectStore } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';

function RackVisual({ rack }: { rack: ReturnType<typeof useRackStore.getState>['racks'][0] }) {
  const size = 120;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;

  return (
    <svg width={size} height={size} className="mx-auto" viewBox={`0 0 ${size} ${size}`}>
      {/* Background circle */}
      <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="hsl(240 4% 20%)" strokeWidth={1} />

      {rack.tubes.map((tube, i) => {
        const rad = (tube.heading * Math.PI) / 180;
        const dist = rack.type === 'circle' ? r * 0.8 : r * 0.5;
        let tx: number, ty: number;

        if (rack.type === 'fan') {
          const spread = ((rack.fanAngleEnd ?? 45) - (rack.fanAngleStart ?? -45));
          const angle = ((rack.fanAngleStart ?? -45) + (spread / Math.max(rack.tubes.length - 1, 1)) * i) * Math.PI / 180;
          tx = cx + Math.sin(angle) * r * 0.85;
          ty = cy - Math.cos(angle) * r * 0.85;
        } else if (rack.type === 'circle') {
          tx = cx + Math.cos(rad) * dist;
          ty = cy + Math.sin(rad) * dist;
        } else {
          // Grid layout for tiltable/variable
          const cols = Math.ceil(Math.sqrt(rack.tubes.length));
          const col = i % cols;
          const row = Math.floor(i / cols);
          const spacing = (size - 20) / (cols + 1);
          tx = 10 + spacing * (col + 1);
          ty = 10 + spacing * (row + 1);
        }

        const tubeR = Math.max(3, Math.min(8, tube.caliber * 1.2));
        const hasEffect = !!tube.effectId;

        return (
          <g key={tube.id}>
            <circle
              cx={tx} cy={ty} r={tubeR}
              fill={hasEffect ? 'hsl(207 90% 54%)' : 'hsl(240 4% 22%)'}
              stroke={hasEffect ? 'hsl(207 100% 65%)' : 'hsl(240 4% 30%)'}
              strokeWidth={1}
            />
            {tube.angle > 0 && (
              <line
                x1={tx} y1={ty}
                x2={tx + Math.sin(tube.heading * Math.PI / 180) * tubeR * 1.8}
                y2={ty - Math.cos(tube.heading * Math.PI / 180) * tubeR * 1.8}
                stroke="hsl(24 95% 53%)"
                strokeWidth={1}
                opacity={0.6}
              />
            )}
            <text x={tx} y={ty + 1} textAnchor="middle" dominantBaseline="middle" fill="hsl(0 0% 93%)" fontSize={5} fontFamily="monospace">
              {tube.caliber}
            </text>
          </g>
        );
      })}

      {/* Label */}
      <text x={cx} y={size - 4} textAnchor="middle" fill="hsl(240 5% 55%)" fontSize={7} fontFamily="monospace">
        {RACK_TYPE_INFO[rack.type].icon} {rack.name}
      </text>
    </svg>
  );
}

export default function RackManager({ onClose }: { onClose: () => void }) {
  const { racks, selectedRackId, addRack, removeRack, selectRack, updateRack } = useRackStore();
  const { positions } = useProjectStore();
  const [newType, setNewType] = useState<RackType>('fan');
  const [newCount, setNewCount] = useState(6);
  const [newCaliber, setNewCaliber] = useState(3);

  const pyroPositions = positions.filter(p => p.type === 'pyro');
  const selectedRack = racks.find(r => r.id === selectedRackId);

  const handleAdd = () => {
    const posId = pyroPositions[0]?.id || '';
    const rack = {
      id: `rack-${Date.now()}`,
      name: `${RACK_TYPE_INFO[newType].label} ${racks.length + 1}`,
      type: newType,
      positionId: posId,
      tubes: generateTubes(newType, newCount, newCaliber),
      fanAngleStart: newType === 'fan' ? -45 : undefined,
      fanAngleEnd: newType === 'fan' ? 45 : undefined,
      circleRadius: newType === 'circle' ? 1.5 : undefined,
    };
    addRack(rack);
    selectRack(rack.id);
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Package className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex-1">Racks</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>

      {/* Add new rack */}
      <div className="p-2 border-b border-border space-y-1.5">
        <div className="flex gap-1">
          <Select value={newType} onValueChange={(v) => setNewType(v as RackType)}>
            <SelectTrigger className="h-6 text-[9px] flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RACK_TYPE_INFO).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-[10px]">{v.icon} {v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-1">
          <Input
            type="number" min={1} max={30} value={newCount}
            onChange={e => setNewCount(parseInt(e.target.value) || 1)}
            className="h-6 text-[9px] w-14" placeholder="Tubes"
          />
          <Input
            type="number" min={1} max={12} value={newCaliber}
            onChange={e => setNewCaliber(parseInt(e.target.value) || 3)}
            className="h-6 text-[9px] w-14" placeholder="Cal"
          />
          <Button size="sm" className="h-6 text-[9px] gap-1 flex-1" onClick={handleAdd}>
            <Plus className="h-3 w-3" /> Add
          </Button>
        </div>
      </div>

      {/* Rack list */}
      <div className="flex-1 overflow-auto">
        {racks.length === 0 && (
          <div className="px-2 py-8 text-center">
            <Package className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-[10px] text-muted-foreground/60">No racks yet. Add one above.</p>
          </div>
        )}

        {racks.map(rack => (
          <div
            key={rack.id}
            className={cn(
              "p-2 border-b border-border/30 cursor-pointer transition-colors",
              selectedRackId === rack.id ? "bg-primary/10" : "hover:bg-surface-2/30"
            )}
            onClick={() => selectRack(rack.id)}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px]">{RACK_TYPE_INFO[rack.type].icon}</span>
              <Input
                value={rack.name}
                onChange={e => updateRack(rack.id, { name: e.target.value })}
                className="h-5 text-[9px] bg-transparent border-none p-0 flex-1 font-semibold"
                onClick={e => e.stopPropagation()}
              />
              <span className="text-[8px] text-muted-foreground">{rack.tubes.length} tubes</span>
              <button
                className="text-destructive/40 hover:text-destructive"
                onClick={e => { e.stopPropagation(); removeRack(rack.id); }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>

            {/* Visual */}
            <RackVisual rack={rack} />

            {/* Position assignment */}
            {pyroPositions.length > 0 && (
              <Select
                value={rack.positionId}
                onValueChange={v => updateRack(rack.id, { positionId: v })}
              >
                <SelectTrigger className="h-5 text-[8px] mt-1" onClick={e => e.stopPropagation()}>
                  <SelectValue placeholder="Assign position" />
                </SelectTrigger>
                <SelectContent>
                  {pyroPositions.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-[9px]">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
      </div>

      {/* Generate Labels */}
      {racks.length > 0 && (
        <div className="p-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-6 text-[9px] gap-1"
            onClick={() => generateLabels(racks)}
          >
            🏷️ Generate Labels
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Label generation ───────────────────────────────────────────────
function generateLabels(racks: ReturnType<typeof useRackStore.getState>['racks']) {
  const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: monospace; padding: 12px; }
    .label { border: 2px solid #333; padding: 8px; margin: 4px; display: inline-block; width: 180px; text-align: center; page-break-inside: avoid; }
    .label h3 { font-size: 14px; margin-bottom: 4px; }
    .label p { font-size: 10px; color: #666; }
    .label .cal { font-size: 18px; font-weight: bold; color: #0077b6; }
    @media print { .label { border: 1px solid #000; } }
  `;

  const labels = racks.flatMap(rack =>
    rack.tubes.map((tube, i) => `
      <div class="label">
        <h3>${rack.name}</h3>
        <div class="cal">${tube.caliber}"</div>
        <p>Tube ${i + 1} | ${tube.angle}° tilt | ${tube.heading.toFixed(0)}° hdg</p>
        <p>${RACK_TYPE_INFO[rack.type].label}</p>
      </div>
    `)
  ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rack Labels</title><style>${css}</style></head><body>${labels}</body></html>`;
  const w = window.open('', '_blank', 'width=800,height=600');
  if (w) { w.document.write(html); w.document.close(); }
}
