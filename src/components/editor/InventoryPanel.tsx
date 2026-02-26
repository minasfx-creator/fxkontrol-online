import { useState, useMemo } from 'react';
import { X, Package, DollarSign, Upload, Search, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInventoryStore, type InventoryItem } from '@/store/useInventoryStore';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { parseVDL } from '@/lib/vdlParser';
import { cn } from '@/lib/utils';

export default function InventoryPanel({ onClose }: { onClose: () => void }) {
  const { items, setItem, showCostMultiplier, setShowCostMultiplier, importItems, initDefaults } = useInventoryStore();
  const { timelineItems } = useProjectStore();
  const [search, setSearch] = useState('');
  const [csvText, setCsvText] = useState('');

  // Initialize defaults on first open
  useState(() => { initDefaults(); });

  // Calculate allocations from timeline
  const allocations = useMemo(() => {
    const map: Record<string, number> = {};
    timelineItems.forEach((ti) => {
      map[ti.effectId] = (map[ti.effectId] || 0) + 1;
    });
    return map;
  }, [timelineItems]);

  // Cost summary
  const costSummary = useMemo(() => {
    let totalCost = 0;
    let totalUnits = 0;
    let lowStockCount = 0;

    EFFECT_LIBRARY.forEach((effect) => {
      const inv = items.find((i) => i.effectId === effect.id);
      const allocated = allocations[effect.id] || 0;
      const unitCost = inv?.unitCost ?? effect.cost;
      totalCost += allocated * unitCost;
      totalUnits += allocated;
      const onHand = inv?.onHand ?? 0;
      if (allocated > onHand && onHand > 0) lowStockCount++;
    });

    return { totalCost: totalCost * showCostMultiplier, totalUnits, lowStockCount };
  }, [items, allocations, showCostMultiplier]);

  const filteredEffects = EFFECT_LIBRARY.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCsvImport = () => {
    if (!csvText.trim()) return;
    const lines = csvText.trim().split('\n');
    const imported: InventoryItem[] = [];

    lines.forEach((line) => {
      const cols = line.split(',').map((c) => c.trim());
      if (cols.length < 2) return;
      const name = cols[0];
      const qty = parseInt(cols[1]) || 0;
      const supplier = cols[2] || '';
      const cost = parseFloat(cols[3]) || 0;
      const lot = cols[4] || '';

      // Match by name or try VDL parse
      let effect = EFFECT_LIBRARY.find((e) => e.name.toLowerCase() === name.toLowerCase());
      if (!effect) {
        const vdl = parseVDL(name);
        if (vdl.valid) {
          effect = EFFECT_LIBRARY.find((e) =>
            e.name.toLowerCase().includes(vdl.typeName.toLowerCase())
          );
        }
      }
      if (effect) {
        imported.push({
          effectId: effect.id,
          onHand: qty,
          allocated: 0,
          supplier,
          unitCost: cost || effect.cost,
          lotNumber: lot,
          notes: '',
        });
      }
    });

    if (imported.length > 0) {
      importItems(imported);
      setCsvText('');
    }
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Package className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">Inventory</h2>
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Cost Summary Bar */}
      <div className="px-3 py-2 border-b border-border bg-surface-1 grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-[9px] text-muted-foreground uppercase">Show Cost</p>
          <p className="text-sm font-mono-code font-bold text-safety">${costSummary.totalCost.toFixed(2)}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-muted-foreground uppercase">Units Used</p>
          <p className="text-sm font-mono-code font-bold text-foreground">{costSummary.totalUnits}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-muted-foreground uppercase">Low Stock</p>
          <p className={cn("text-sm font-mono-code font-bold", costSummary.lowStockCount > 0 ? "text-destructive" : "text-success")}>
            {costSummary.lowStockCount}
          </p>
        </div>
      </div>

      <Tabs defaultValue="stock" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-2 mt-2 h-7 bg-surface-2">
          <TabsTrigger value="stock" className="text-[10px] h-5">Stock</TabsTrigger>
          <TabsTrigger value="costs" className="text-[10px] h-5">Costs</TabsTrigger>
          <TabsTrigger value="import" className="text-[10px] h-5">Import</TabsTrigger>
        </TabsList>

        {/* Stock Tab */}
        <TabsContent value="stock" className="flex-1 overflow-hidden flex flex-col mt-0 px-2">
          <div className="relative my-1.5">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-6 pl-7 text-[10px] bg-surface-2 border-border"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-0.5 pb-2">
            {filteredEffects.map((effect) => {
              const inv = items.find((i) => i.effectId === effect.id);
              const allocated = allocations[effect.id] || 0;
              const onHand = inv?.onHand ?? 0;
              const remaining = onHand - allocated;
              const isLow = remaining < 0 && onHand > 0;

              return (
                <div
                  key={effect.id}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] border",
                    isLow ? "border-destructive/30 bg-destructive/5" : "border-transparent hover:bg-surface-3"
                  )}
                >
                  <span className="text-sm flex-shrink-0">{effect.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-secondary-foreground">{effect.name}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isLow && <AlertTriangle className="h-2.5 w-2.5 text-destructive" />}
                    <Input
                      type="number"
                      min={0}
                      value={onHand}
                      onChange={(e) => setItem(effect.id, { onHand: parseInt(e.target.value) || 0 })}
                      className="w-12 h-5 text-[9px] text-center bg-surface-2 border-border font-mono-code px-1"
                      title="On Hand"
                    />
                    <span className="text-muted-foreground w-6 text-right" title="Allocated">{allocated}</span>
                    <span
                      className={cn(
                        "w-8 text-right font-mono-code font-bold",
                        remaining < 0 ? "text-destructive" : "text-success"
                      )}
                      title="Remaining"
                    >
                      {remaining}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Costs Tab */}
        <TabsContent value="costs" className="flex-1 overflow-y-auto mt-0 px-2 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Markup:</span>
            <Input
              type="number"
              min={0.1}
              max={10}
              step={0.1}
              value={showCostMultiplier}
              onChange={(e) => setShowCostMultiplier(parseFloat(e.target.value) || 1)}
              className="w-16 h-6 text-[10px] text-center bg-surface-2 border-border font-mono-code"
            />
            <span className="text-[10px] text-muted-foreground">×</span>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center text-[9px] text-muted-foreground uppercase px-1 pb-1 border-b border-border">
              <span className="flex-1">Effect</span>
              <span className="w-10 text-right">Qty</span>
              <span className="w-14 text-right">Unit $</span>
              <span className="w-16 text-right">Subtotal</span>
            </div>
            {EFFECT_LIBRARY.filter((e) => (allocations[e.id] || 0) > 0).map((effect) => {
              const inv = items.find((i) => i.effectId === effect.id);
              const allocated = allocations[effect.id] || 0;
              const unitCost = inv?.unitCost ?? effect.cost;
              const subtotal = allocated * unitCost * showCostMultiplier;
              return (
                <div key={effect.id} className="flex items-center text-[10px] px-1 py-0.5 hover:bg-surface-3 rounded">
                  <span className="flex-1 truncate text-secondary-foreground">{effect.icon} {effect.name}</span>
                  <span className="w-10 text-right font-mono-code text-foreground">{allocated}</span>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={unitCost}
                    onChange={(e) => setItem(effect.id, { unitCost: parseFloat(e.target.value) || 0 })}
                    className="w-14 h-5 text-[9px] text-right bg-surface-2 border-border font-mono-code px-1"
                  />
                  <span className="w-16 text-right font-mono-code font-bold text-safety">${subtotal.toFixed(2)}</span>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border pt-2 flex justify-between items-center px-1">
            <span className="text-xs font-semibold text-foreground">TOTAL</span>
            <span className="text-sm font-mono-code font-bold text-safety">${costSummary.totalCost.toFixed(2)}</span>
          </div>
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import" className="flex-1 overflow-y-auto mt-0 px-2 py-2 space-y-3">
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">CSV Import</p>
            <p className="text-[9px] text-muted-foreground">
              Format: Name, Qty, Supplier, Cost, Lot# (one per line)
            </p>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`Red Peony, 100, PyroSupply, 10.00, LOT-001\nGold Willow, 50, FireWorks Co, 18.00, LOT-002`}
              className="w-full h-24 text-[10px] font-mono-code bg-surface-2 border border-border rounded p-2 resize-none text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
            />
            <Button
              size="sm"
              className="w-full h-7 text-[10px] gap-1"
              onClick={handleCsvImport}
              disabled={!csvText.trim()}
            >
              <Upload className="h-3 w-3" />
              Import Stock
            </Button>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">VDL Auto-Detect</p>
            <p className="text-[9px] text-muted-foreground">
              Effect names are matched via VDL parser. Use standard descriptions like "3in Red Peony" for best results.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
