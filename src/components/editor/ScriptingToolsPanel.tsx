import { useState, useMemo } from 'react';
import { Wand2, Shuffle, ArrowLeftRight, Fan, AlignHorizontalSpaceAround, ArrowDownUp, Grid3X3, X, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import {
  randomizeItems, DEFAULT_RANDOMIZE, type RandomizeConfig,
  makeIntoSequence, DEFAULT_SEQUENCE, type SequenceConfig, type SequenceSortMode,
  makeIntoFan, DEFAULT_FAN, type FanConfig,
  spreadOut, reverseOrder, quantizeToGrid, getAnglesPreview,
  duplicateIntoFlights, DEFAULT_DUPLICATE_FLIGHTS, type DuplicateFlightsConfig,
  snapAngle,
} from '@/lib/scriptingTools';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ToolMode = 'randomize' | 'sequence' | 'fan' | 'spread' | 'reverse' | 'quantize' | 'duplicate-flights';

export default function ScriptingToolsPanel({ onClose }: { onClose: () => void }) {
  const { timelineItems, positions, selectedTimelineItemIds, updateTimelineItem, addTimelineItem } = useProjectStore();
  const [mode, setMode] = useState<ToolMode>('sequence');
  const [randomConfig, setRandomConfig] = useState<RandomizeConfig>(DEFAULT_RANDOMIZE);
  const [seqConfig, setSeqConfig] = useState<SequenceConfig>(DEFAULT_SEQUENCE);
  const [fanConfig, setFanConfig] = useState<FanConfig>(DEFAULT_FAN);
  const [gridSize, setGridSize] = useState(0.25);
  const [spreadGap, setSpreadGap] = useState(0.1);
  const [dupConfig, setDupConfig] = useState<DuplicateFlightsConfig>(DEFAULT_DUPLICATE_FLIGHTS);

  const selectedItems = useMemo(
    () => timelineItems.filter(i => selectedTimelineItemIds.includes(i.id)),
    [timelineItems, selectedTimelineItemIds],
  );

  // ASCII preview for duplicate flights
  const flightsPreview = useMemo(() => {
    if (mode !== 'duplicate-flights' || selectedItems.length === 0) return '';
    const basePan = selectedItems[0]?.pan ?? 90;
    const totalSpread = (dupConfig.flightsPerItem - 1) * dupConfig.angleSeparation;
    const startAngle = dupConfig.centerOnOriginal ? basePan - totalSpread / 2 : basePan;
    const angles = Array.from({ length: dupConfig.flightsPerItem }, (_, i) => ({
      pan: startAngle + i * dupConfig.angleSeparation,
    }));
    return getAnglesPreview(angles);
  }, [mode, dupConfig, selectedItems]);

  const handleApply = () => {
    if (selectedItems.length === 0) {
      toast.error('Selecione items no Script ou Timeline primeiro');
      return;
    }

    switch (mode) {
      case 'randomize': {
        const updates = randomizeItems(selectedItems, randomConfig);
        selectedItems.forEach((item, idx) => updateTimelineItem(item.id, updates[idx]));
        toast.success(`${selectedItems.length} items randomizados`);
        break;
      }
      case 'sequence': {
        const result = makeIntoSequence(selectedItems, positions, seqConfig);
        result.forEach(r => updateTimelineItem(r.id, { startTime: r.startTime }));
        toast.success(`${result.length} items sequenciados (${seqConfig.direction})`);
        break;
      }
      case 'fan': {
        const result = makeIntoFan(selectedItems, fanConfig);
        result.forEach(r => updateTimelineItem(r.id, { pan: r.pan, tilt: r.tilt }));
        toast.success(`${result.length} items em leque (${fanConfig.panStart}°–${fanConfig.panEnd}°)`);
        break;
      }
      case 'spread': {
        const effects = EFFECT_LIBRARY.map(e => ({ id: e.id, duration: e.duration }));
        const result = spreadOut(selectedItems, effects, spreadGap);
        result.forEach(r => updateTimelineItem(r.id, { startTime: r.startTime }));
        toast.success(`${result.length} items espaçados (gap: ${spreadGap}s)`);
        break;
      }
      case 'reverse': {
        const result = reverseOrder(selectedItems);
        result.forEach(r => updateTimelineItem(r.id, { startTime: r.startTime }));
        toast.success(`${result.length} items revertidos`);
        break;
      }
      case 'quantize': {
        const result = quantizeToGrid(selectedItems, gridSize);
        result.forEach(r => updateTimelineItem(r.id, { startTime: r.startTime }));
        toast.success(`${result.length} items quantizados (grid: ${gridSize}s)`);
        break;
      }
      case 'duplicate-flights': {
        const results = duplicateIntoFlights(selectedItems, dupConfig);
        let totalCopies = 0;
        for (const r of results) {
          // First copy may be the original pan update (if centering)
          const startIdx = dupConfig.centerOnOriginal ? 1 : 0;
          if (dupConfig.centerOnOriginal && r.copies.length > 0) {
            updateTimelineItem(r.originalId, { pan: r.copies[0].pan, startTime: r.copies[0].startTime });
          }
          for (let i = startIdx; i < r.copies.length; i++) {
            const copy = r.copies[i];
            addTimelineItem({
              id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              effectId: copy.effectId || selectedItems.find(it => it.id === r.originalId)?.effectId || '',
              startTime: copy.startTime ?? 0,
              trackIndex: selectedItems.find(it => it.id === r.originalId)?.trackIndex ?? 0,
              position: copy.position || { x: 0, y: 0, z: 0 },
              pan: copy.pan,
              tilt: copy.tilt,
              positionName: copy.positionName,
            });
            totalCopies++;
          }
        }
        toast.success(`${totalCopies} flights criados a partir de ${selectedItems.length} items`);
        break;
      }
    }
  };

  const tools: { id: ToolMode; label: string; icon: typeof Shuffle; desc: string }[] = [
    { id: 'sequence', label: 'Sequenciar', icon: ArrowLeftRight, desc: 'Distribuir no tempo por posição' },
    { id: 'fan', label: 'Leque', icon: Fan, desc: 'Distribuir ângulos Pan/Tilt' },
    { id: 'duplicate-flights', label: 'Flights', icon: Copy, desc: 'Duplicar em leque com N cópias (Finale)' },
    { id: 'randomize', label: 'Randomizar', icon: Shuffle, desc: 'Variar tempo/posição/ângulos' },
    { id: 'spread', label: 'Espaçar', icon: AlignHorizontalSpaceAround, desc: 'Espaçar por duração' },
    { id: 'reverse', label: 'Reverter', icon: ArrowDownUp, desc: 'Inverter ordem temporal' },
    { id: 'quantize', label: 'Quantizar', icon: Grid3X3, desc: 'Alinhar à grade' },
  ];

  const allSortModes: { id: SequenceSortMode; label: string }[] = [
    { id: 'left-to-right', label: 'L→R' },
    { id: 'right-to-left', label: 'R→L' },
    { id: 'center-out', label: 'C→E' },
    { id: 'edges-in', label: 'E→C' },
    { id: 'position-clockwise', label: '↻CW' },
    { id: 'position-name', label: 'Nome' },
    { id: 'angle', label: '∠Ang' },
    { id: 'angle-center-out', label: '∠C→E' },
    { id: 'angle-edges-in', label: '∠E→C' },
    { id: 'effect-time', label: 'Tempo' },
    { id: 'random', label: '🎲' },
  ];

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Wand2 className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex-1">Scripting Tools</h2>
        <span className="text-[9px] font-mono text-primary">{selectedItems.length} sel</span>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Tool selector */}
      <div className="px-2 py-2 border-b border-border grid grid-cols-4 gap-1">
        {tools.map(t => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-sm text-[8px] transition-colors",
              mode === t.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tool config */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        <p className="text-[9px] text-muted-foreground">{tools.find(t => t.id === mode)?.desc}</p>

        {mode === 'randomize' && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[10px]">
              <input type="checkbox" checked={randomConfig.randomizeTime} onChange={e => setRandomConfig(c => ({ ...c, randomizeTime: e.target.checked }))} />
              <span>⏱ Tempo ±{randomConfig.timeRange.toFixed(2)}s</span>
            </label>
            {randomConfig.randomizeTime && (
              <Slider value={[randomConfig.timeRange]} min={0.01} max={2} step={0.01} onValueChange={([v]) => setRandomConfig(c => ({ ...c, timeRange: v }))} />
            )}
            <label className="flex items-center gap-2 text-[10px]">
              <input type="checkbox" checked={randomConfig.randomizePosition} onChange={e => setRandomConfig(c => ({ ...c, randomizePosition: e.target.checked }))} />
              <span>📍 Posição ±{randomConfig.xRange.toFixed(1)}m</span>
            </label>
            {randomConfig.randomizePosition && (
              <Slider value={[randomConfig.xRange]} min={0.1} max={10} step={0.1} onValueChange={([v]) => setRandomConfig(c => ({ ...c, xRange: v, zRange: v }))} />
            )}
            <label className="flex items-center gap-2 text-[10px]">
              <input type="checkbox" checked={randomConfig.randomizeAngles} onChange={e => setRandomConfig(c => ({ ...c, randomizeAngles: e.target.checked }))} />
              <span>🔄 Ângulos ±{randomConfig.panRange}°</span>
            </label>
            {randomConfig.randomizeAngles && (
              <Slider value={[randomConfig.panRange]} min={1} max={90} step={1} onValueChange={([v]) => setRandomConfig(c => ({ ...c, panRange: v }))} />
            )}
          </div>
        )}

        {mode === 'sequence' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="text-[8px] text-muted-foreground uppercase">Início (s)</label>
                <Input type="number" step="0.1" value={seqConfig.startTime} onChange={e => setSeqConfig(c => ({ ...c, startTime: parseFloat(e.target.value) || 0 }))} className="h-5 text-[10px] font-mono bg-background" />
              </div>
              <div>
                <label className="text-[8px] text-muted-foreground uppercase">Fim (s)</label>
                <Input type="number" step="0.1" value={seqConfig.endTime} onChange={e => setSeqConfig(c => ({ ...c, endTime: parseFloat(e.target.value) || 10 }))} className="h-5 text-[10px] font-mono bg-background" />
              </div>
            </div>
            <div>
              <label className="text-[8px] text-muted-foreground uppercase">Direção / Ordem</label>
              <div className="flex gap-0.5 flex-wrap mt-0.5">
                {allSortModes.map(sm => (
                  <button key={sm.id} onClick={() => setSeqConfig(c => ({ ...c, direction: sm.id }))}
                    className={cn("text-[8px] px-1.5 py-0.5 rounded-sm", seqConfig.direction === sm.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    {sm.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[8px] text-muted-foreground uppercase">Easing</label>
              <div className="flex gap-0.5 mt-0.5">
                {(['linear', 'ease-in', 'ease-out', 'ease-in-out'] as const).map(ease => (
                  <button key={ease} onClick={() => setSeqConfig(c => ({ ...c, easing: ease }))}
                    className={cn("text-[8px] px-1.5 py-0.5 rounded-sm", seqConfig.easing === ease ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    {ease}
                  </button>
                ))}
              </div>
            </div>
            {/* Cycles & Bounce */}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="text-[8px] text-muted-foreground uppercase">Ciclos</label>
                <Input type="number" min={1} max={10} value={seqConfig.cycles} onChange={e => setSeqConfig(c => ({ ...c, cycles: Math.max(1, parseInt(e.target.value) || 1) }))} className="h-5 text-[10px] font-mono bg-background" />
              </div>
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-1.5 text-[9px]">
                  <input type="checkbox" checked={seqConfig.bounce} onChange={e => setSeqConfig(c => ({ ...c, bounce: e.target.checked }))} />
                  <span>↔ Bounce</span>
                </label>
              </div>
            </div>
            {seqConfig.bounce && (
              <label className="flex items-center gap-1.5 text-[9px]">
                <input type="checkbox" checked={seqConfig.removeTurnarounds} onChange={e => setSeqConfig(c => ({ ...c, removeTurnarounds: e.target.checked }))} />
                <span>Remover duplicatas nas viradas</span>
              </label>
            )}
          </div>
        )}

        {mode === 'fan' && (
          <div className="space-y-2">
            <div>
              <label className="text-[8px] text-muted-foreground uppercase">Tipo</label>
              <div className="flex gap-0.5 mt-0.5">
                {(['horizontal', 'vertical', 'both'] as const).map(ft => (
                  <button key={ft} onClick={() => setFanConfig(c => ({ ...c, fanType: ft }))}
                    className={cn("text-[8px] px-2 py-0.5 rounded-sm", fanConfig.fanType === ft ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    {ft === 'horizontal' ? '↔ Pan' : ft === 'vertical' ? '↕ Tilt' : '↔↕'}
                  </button>
                ))}
              </div>
            </div>
            {fanConfig.fanType !== 'vertical' && (
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[8px] text-muted-foreground">Pan Início°</label>
                  <Input type="number" value={fanConfig.panStart} onChange={e => setFanConfig(c => ({ ...c, panStart: parseFloat(e.target.value) || 0 }))} className="h-5 text-[10px] font-mono bg-background" />
                </div>
                <div>
                  <label className="text-[8px] text-muted-foreground">Pan Fim°</label>
                  <Input type="number" value={fanConfig.panEnd} onChange={e => setFanConfig(c => ({ ...c, panEnd: parseFloat(e.target.value) || 135 }))} className="h-5 text-[10px] font-mono bg-background" />
                </div>
              </div>
            )}
            {fanConfig.fanType !== 'horizontal' && (
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[8px] text-muted-foreground">Tilt Início°</label>
                  <Input type="number" value={fanConfig.tiltStart} onChange={e => setFanConfig(c => ({ ...c, tiltStart: parseFloat(e.target.value) || 0 }))} className="h-5 text-[10px] font-mono bg-background" />
                </div>
                <div>
                  <label className="text-[8px] text-muted-foreground">Tilt Fim°</label>
                  <Input type="number" value={fanConfig.tiltEnd} onChange={e => setFanConfig(c => ({ ...c, tiltEnd: parseFloat(e.target.value) || 45 }))} className="h-5 text-[10px] font-mono bg-background" />
                </div>
              </div>
            )}
            <div>
              <label className="text-[8px] text-muted-foreground uppercase">Distribuição</label>
              <div className="flex gap-0.5 mt-0.5">
                {(['even', 'converging', 'diverging'] as const).map(d => (
                  <button key={d} onClick={() => setFanConfig(c => ({ ...c, distribution: d }))}
                    className={cn("text-[8px] px-2 py-0.5 rounded-sm", fanConfig.distribution === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    {d === 'even' ? 'Uniforme' : d === 'converging' ? 'Convergente' : 'Divergente'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {mode === 'duplicate-flights' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="text-[8px] text-muted-foreground uppercase">Flights / item</label>
                <Input type="number" min={2} max={20} value={dupConfig.flightsPerItem}
                  onChange={e => setDupConfig(c => ({ ...c, flightsPerItem: Math.max(2, Math.min(20, parseInt(e.target.value) || 5)) }))}
                  className="h-5 text-[10px] font-mono bg-background" />
              </div>
              <div>
                <label className="text-[8px] text-muted-foreground uppercase">Separação (°)</label>
                <Input type="number" min={1} max={90} value={dupConfig.angleSeparation}
                  onChange={e => setDupConfig(c => ({ ...c, angleSeparation: parseFloat(e.target.value) || 15 }))}
                  className="h-5 text-[10px] font-mono bg-background" />
              </div>
            </div>
            <div>
              <label className="text-[8px] text-muted-foreground uppercase">Separação angular</label>
              <Slider value={[dupConfig.angleSeparation]} min={1} max={45} step={1}
                onValueChange={([v]) => setDupConfig(c => ({ ...c, angleSeparation: v }))} />
            </div>
            <div>
              <label className="text-[8px] text-muted-foreground uppercase">Separação temporal (s)</label>
              <Slider value={[dupConfig.timeSeparation]} min={0} max={2} step={0.05}
                onValueChange={([v]) => setDupConfig(c => ({ ...c, timeSeparation: v }))} />
              <span className="text-[9px] text-muted-foreground font-mono">
                {dupConfig.timeSeparation === 0 ? 'Simultâneo' : `${dupConfig.timeSeparation.toFixed(2)}s entre flights`}
              </span>
            </div>
            <label className="flex items-center gap-2 text-[9px]">
              <input type="checkbox" checked={dupConfig.centerOnOriginal}
                onChange={e => setDupConfig(c => ({ ...c, centerOnOriginal: e.target.checked }))} />
              <span>Centralizar no ângulo original</span>
            </label>
            {/* Snap buttons */}
            <div>
              <label className="text-[8px] text-muted-foreground uppercase">Snap ângulo</label>
              <div className="flex gap-1 mt-0.5">
                {([1, 5, 22.5] as const).map(snap => (
                  <button key={snap}
                    onClick={() => setDupConfig(c => ({ ...c, angleSeparation: snapAngle(c.angleSeparation, snap) }))}
                    className="text-[8px] px-2 py-0.5 rounded-sm bg-muted text-muted-foreground hover:text-foreground">
                    {snap}°
                  </button>
                ))}
              </div>
            </div>
            {/* ASCII preview */}
            {flightsPreview && (
              <div className="bg-muted rounded-sm p-2 text-center">
                <p className="text-[8px] text-muted-foreground uppercase mb-1">Preview</p>
                <p className="text-sm font-mono text-primary tracking-widest">{flightsPreview}</p>
                <p className="text-[8px] text-muted-foreground mt-1">
                  {dupConfig.flightsPerItem} flights × {dupConfig.angleSeparation}° = {(dupConfig.flightsPerItem - 1) * dupConfig.angleSeparation}° total
                </p>
              </div>
            )}
          </div>
        )}

        {mode === 'spread' && (
          <div className="space-y-2">
            <label className="text-[8px] text-muted-foreground uppercase">Gap entre efeitos (s)</label>
            <Slider value={[spreadGap]} min={0} max={2} step={0.05} onValueChange={([v]) => setSpreadGap(v)} />
            <span className="text-[9px] text-muted-foreground font-mono">{spreadGap.toFixed(2)}s</span>
          </div>
        )}

        {mode === 'quantize' && (
          <div className="space-y-2">
            <label className="text-[8px] text-muted-foreground uppercase">Tamanho da grade (s)</label>
            <div className="flex gap-1">
              {[0.125, 0.25, 0.5, 1.0].map(g => (
                <button key={g} onClick={() => setGridSize(g)}
                  className={cn("text-[9px] px-2 py-0.5 rounded-sm font-mono", gridSize === g ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  {g}s
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'reverse' && (
          <p className="text-[9px] text-muted-foreground">
            Inverte a ordem temporal dos items selecionados mantendo as posições.
          </p>
        )}
      </div>

      {/* Apply button */}
      <div className="px-2 py-2 border-t border-border">
        <Button
          className="w-full h-7 text-[10px] uppercase tracking-wider"
          onClick={handleApply}
          disabled={selectedItems.length === 0}
        >
          <Wand2 className="h-3 w-3 mr-1" />
          {mode === 'duplicate-flights' ? `Criar Flights (${selectedItems.length} items)` : `Aplicar em ${selectedItems.length} items`}
        </Button>
      </div>
    </div>
  );
}
