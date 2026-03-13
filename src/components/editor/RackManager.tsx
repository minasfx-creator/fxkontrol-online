import { useState } from 'react';
import { Package, Plus, Trash2, LayoutGrid, Eye, Zap, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRackStore, RACK_TYPE_INFO, RACK_TEMPLATES, generateTubes, type RackType } from '@/store/useRackStore';
import { useProjectStore } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';
import RackVisualEditor from './RackVisualEditor';
import { toast } from 'sonner';

type TabId = 'list' | 'designer' | 'templates';

export default function RackManager({ onClose }: { onClose: () => void }) {
  const { racks, selectedRackId, addRack, removeRack, selectRack, showRack3D, setShowRack3D, addRackFromTemplate, autoAssignToPositions } = useRackStore();
  const { positions } = useProjectStore();
  const [tab, setTab] = useState<TabId>('list');
  const [newType, setNewType] = useState<RackType>('fan');
  const [newCount, setNewCount] = useState(6);
  const [newCaliber, setNewCaliber] = useState(3);
  const [newRows, setNewRows] = useState(1);
  const [newCols, setNewCols] = useState(6);

  const pyroPositions = positions.filter(p => p.type === 'pyro');
  const selectedRack = racks.find(r => r.id === selectedRackId);

  const handleAdd = () => {
    const posId = pyroPositions[0]?.id || '';
    const info = RACK_TYPE_INFO[newType];
    const rack = {
      id: `rack-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${info.label} ${racks.length + 1}`,
      type: newType,
      positionId: posId,
      rows: newRows,
      cols: newCols,
      tubes: generateTubes(newType, newRows, newCols, newCaliber),
      fanAngleStart: newType === 'fan' ? -45 : undefined,
      fanAngleEnd: newType === 'fan' ? 45 : undefined,
      circleRadius: newType === 'circle' ? 1.5 : undefined,
      color: ['#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261', '#264653'][racks.length % 6],
      rotation: 0,
      locked: false,
    };
    addRack(rack);
    selectRack(rack.id);
    setTab('designer');
    toast.success(`Rack "${rack.name}" criado`);
  };

  const handleAutoAssign = () => {
    const ids = pyroPositions.map(p => p.id);
    autoAssignToPositions(ids);
    toast.success(`Racks atribuídos a ${ids.length} posições`);
  };

  const handleTemplateSelect = (tplId: string) => {
    const posId = pyroPositions[0]?.id || '';
    addRackFromTemplate(tplId, posId);
    setTab('designer');
    toast.success('Rack criado a partir do template');
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'list', label: 'Lista' },
    { id: 'designer', label: 'Designer' },
    { id: 'templates', label: 'Templates' },
  ];

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Package className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex-1">Rack Designer</h2>
        <div className="flex items-center gap-1.5">
          <Eye className="h-3 w-3 text-muted-foreground" />
          <Switch checked={showRack3D} onCheckedChange={setShowRack3D} className="scale-75" />
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 text-[9px] font-semibold py-1.5 transition-colors border-b-2",
              tab === t.id ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        {/* ═══ LIST TAB ═══ */}
        {tab === 'list' && (
          <div className="p-2 space-y-2">
            {/* Quick add */}
            <div className="space-y-1.5 border border-border/30 rounded p-2 bg-background/30">
              <div className="text-[8px] font-semibold text-muted-foreground uppercase">Quick Add</div>
              <div className="flex gap-1">
                <Select value={newType} onValueChange={(v) => {
                  const type = v as RackType;
                  setNewType(type);
                  setNewRows(RACK_TYPE_INFO[type].defaultRows);
                  setNewCols(RACK_TYPE_INFO[type].defaultCols);
                  setNewCaliber(RACK_TYPE_INFO[type].defaultCaliber);
                }}>
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
                <div className="flex-1">
                  <label className="text-[7px] text-muted-foreground">Rows</label>
                  <Input type="number" min={1} max={10} value={newRows} onChange={e => setNewRows(parseInt(e.target.value) || 1)} className="h-5 text-[9px]" />
                </div>
                <div className="flex-1">
                  <label className="text-[7px] text-muted-foreground">Cols</label>
                  <Input type="number" min={1} max={20} value={newCols} onChange={e => setNewCols(parseInt(e.target.value) || 1)} className="h-5 text-[9px]" />
                </div>
                <div className="flex-1">
                  <label className="text-[7px] text-muted-foreground">Cal"</label>
                  <Input type="number" min={1} max={12} value={newCaliber} onChange={e => setNewCaliber(parseInt(e.target.value) || 3)} className="h-5 text-[9px]" />
                </div>
              </div>
              <Button size="sm" className="w-full h-6 text-[9px] gap-1" onClick={handleAdd}>
                <Plus className="h-3 w-3" /> Criar Rack ({newRows}×{newCols} = {newRows * newCols} tubes)
              </Button>
            </div>

            {/* Rack list */}
            {racks.length === 0 ? (
              <div className="py-8 text-center">
                <Package className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-[10px] text-muted-foreground/60">Nenhum rack. Crie um acima ou use um Template.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {racks.map(rack => {
                  const pos = pyroPositions.find(p => p.id === rack.positionId);
                  return (
                    <div
                      key={rack.id}
                      className={cn(
                        "p-2 rounded border cursor-pointer transition-colors",
                        selectedRackId === rack.id ? "border-primary/50 bg-primary/5" : "border-border/30 hover:bg-muted/20"
                      )}
                      onClick={() => { selectRack(rack.id); setTab('designer'); }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: rack.color }} />
                        <span className="text-[10px] font-semibold flex-1 truncate">{rack.name}</span>
                        <span className="text-[8px] text-muted-foreground">{rack.tubes.length}T</span>
                        {rack.locked && <span className="text-[8px]">🔒</span>}
                        <button onClick={e => { e.stopPropagation(); removeRack(rack.id); }} className="text-destructive/40 hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[8px] text-muted-foreground">{RACK_TYPE_INFO[rack.type].icon} {RACK_TYPE_INFO[rack.type].label}</span>
                        <span className="text-[8px] text-muted-foreground">•</span>
                        <span className="text-[8px] text-muted-foreground">{rack.rows}×{rack.cols}</span>
                        {pos && <span className="text-[8px] text-primary">→ {pos.name}</span>}
                      </div>

                      {/* Position assignment */}
                      {pyroPositions.length > 0 && (
                        <Select
                          value={rack.positionId}
                          onValueChange={v => useRackStore.getState().updateRack(rack.id, { positionId: v })}
                        >
                          <SelectTrigger className="h-5 text-[8px] mt-1" onClick={e => e.stopPropagation()}>
                            <SelectValue placeholder="Atribuir posição" />
                          </SelectTrigger>
                          <SelectContent>
                            {pyroPositions.map(p => (
                              <SelectItem key={p.id} value={p.id} className="text-[9px]">{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Actions */}
            {racks.length > 0 && (
              <div className="space-y-1 pt-1">
                <Button variant="outline" size="sm" className="w-full h-6 text-[9px] gap-1" onClick={handleAutoAssign} disabled={pyroPositions.length === 0}>
                  <Zap className="h-3 w-3" /> Auto-Assign to Positions ({pyroPositions.length})
                </Button>
                <Button variant="outline" size="sm" className="w-full h-6 text-[9px] gap-1" onClick={() => generateLabels(racks)}>
                  🏷️ Gerar Etiquetas
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ═══ DESIGNER TAB ═══ */}
        {tab === 'designer' && (
          <div className="p-2">
            {selectedRack ? (
              <RackVisualEditor rackId={selectedRack.id} />
            ) : (
              <div className="py-8 text-center">
                <LayoutGrid className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-[10px] text-muted-foreground/60">Selecione um rack na aba Lista para editar visualmente.</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ TEMPLATES TAB ═══ */}
        {tab === 'templates' && (
          <div className="p-2 space-y-1">
            <div className="text-[8px] font-semibold text-muted-foreground uppercase mb-2">Rack Templates</div>
            {RACK_TEMPLATES.map(tpl => (
              <button
                key={tpl.id}
                className="w-full text-left p-2 rounded border border-border/30 hover:bg-muted/20 hover:border-primary/30 transition-colors"
                onClick={() => handleTemplateSelect(tpl.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{RACK_TYPE_INFO[tpl.type].icon}</span>
                  <div className="flex-1">
                    <div className="text-[10px] font-semibold">{tpl.name}</div>
                    <div className="text-[8px] text-muted-foreground">{tpl.description}</div>
                  </div>
                  <div className="text-[8px] text-muted-foreground">{tpl.rows}×{tpl.cols}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
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
    .label .lbl { font-size: 12px; font-weight: bold; background: #eee; padding: 2px 6px; display: inline-block; margin: 2px 0; }
    @media print { .label { border: 1px solid #000; } }
  `;

  const labels = racks.flatMap(rack =>
    rack.tubes.map((tube, i) => `
      <div class="label">
        <h3>${rack.name}</h3>
        <div class="lbl">${tube.label || `T${i + 1}`}</div>
        <div class="cal">${tube.caliber}"</div>
        <p>${tube.angle}° tilt | ${tube.heading.toFixed(0)}° hdg</p>
        <p>${RACK_TYPE_INFO[rack.type].label} • ${tube.status}</p>
      </div>
    `)
  ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rack Labels</title><style>${css}</style></head><body>${labels}</body></html>`;
  const w = window.open('', '_blank', 'width=800,height=600');
  if (w) { w.document.write(html); w.document.close(); }
}
