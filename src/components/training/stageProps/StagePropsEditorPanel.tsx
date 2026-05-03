/**
 * Training v2.2 — Stage Props editor panel.
 *
 * Floating HUD panel (top-left under the mission triangle) that lets the
 * operator add scenic props to the stage and tweak position / rotation /
 * scale per instance. Persists per missionId.
 *
 * Pure UI — no command bus, no safety coupling.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useStageProps } from './useStagePropsStore';
import { STAGE_PROP_CATALOG, type StagePropKind } from './stagePropsCatalog';
import { Button } from '@/components/ui/button';

interface Props {
  missionId: string;
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
}

export default function StagePropsEditorPanel({ missionId, selectedId, onSelectedIdChange }: Props) {
  const { items, addProp, updateProp, removeProp, clearAll, resetProp } = useStageProps(missionId);
  const [open, setOpen] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const selected = items.find((it) => it.id === selectedId) ?? null;

  return (
    <div className="absolute left-3 top-24 z-30 w-72 rounded-md border border-white/10 bg-black/85 backdrop-blur-md text-foreground shadow-xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-[11px] uppercase tracking-widest font-mono text-[hsl(190_70%_58%)] hover:bg-white/5"
      >
        <span>Props do Palco · {items.length}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="border-t border-white/10 p-2 space-y-2 max-h-[60vh] overflow-y-auto">
          {/* Add catalog */}
          <div>
            <button
              onClick={() => setShowCatalog((v) => !v)}
              className="flex w-full items-center justify-between rounded bg-white/5 hover:bg-white/10 px-2 py-1.5 text-xs"
            >
              <span className="flex items-center gap-1.5">
                <Plus className="h-3 w-3" /> Adicionar prop
              </span>
              {showCatalog ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showCatalog && (
              <div className="mt-1 space-y-1">
                {STAGE_PROP_CATALOG.map((def) => (
                  <button
                    key={def.kind}
                    onClick={() => {
                      addProp(def.kind as StagePropKind);
                      setShowCatalog(false);
                    }}
                    className="w-full text-left rounded border border-white/10 bg-black/40 hover:border-[hsl(190_70%_58%)]/60 hover:bg-white/5 px-2 py-1.5 text-[11px]"
                  >
                    <div className="font-medium text-foreground">{def.label}</div>
                    <div className="text-[10px] text-muted-foreground">{def.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Placed list */}
          {items.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic px-1 py-2">
              Nenhum prop. Clique em "Adicionar prop" para começar.
            </p>
          ) : (
            <div className="space-y-1">
              {items.map((it) => {
                const def = STAGE_PROP_CATALOG.find((d) => d.kind === it.kind);
                const isSel = it.id === selectedId;
                return (
                  <div
                    key={it.id}
                    className={`rounded border px-2 py-1.5 text-[11px] cursor-pointer transition-colors ${
                      isSel
                        ? 'border-[hsl(190_70%_58%)] bg-[hsl(190_70%_58%)]/10'
                        : 'border-white/10 bg-black/40 hover:bg-white/5'
                    }`}
                    onClick={() => onSelectedIdChange(isSel ? null : it.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{def?.label ?? it.kind}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            resetProp(it.id);
                          }}
                          title="Restaurar padrões"
                          className="rounded p-0.5 hover:bg-white/10"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedId === it.id) onSelectedIdChange(null);
                            removeProp(it.id);
                          }}
                          title="Remover"
                          className="rounded p-0.5 hover:bg-destructive/30"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected editor */}
          {selected && (
            <div className="mt-2 rounded border border-[hsl(190_70%_58%)]/40 bg-black/60 p-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest font-mono text-[hsl(190_70%_58%)]">
                  Editor
                </span>
                <button
                  onClick={() => onSelectedIdChange(null)}
                  className="rounded p-0.5 hover:bg-white/10"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <SliderRow
                label="X"
                min={-15}
                max={15}
                step={0.1}
                value={selected.position[0]}
                onChange={(v) =>
                  updateProp(selected.id, { position: [v, selected.position[1], selected.position[2]] })
                }
              />
              <SliderRow
                label="Y"
                min={0}
                max={6}
                step={0.05}
                value={selected.position[1]}
                onChange={(v) =>
                  updateProp(selected.id, { position: [selected.position[0], v, selected.position[2]] })
                }
              />
              <SliderRow
                label="Z"
                min={-15}
                max={15}
                step={0.1}
                value={selected.position[2]}
                onChange={(v) =>
                  updateProp(selected.id, { position: [selected.position[0], selected.position[1], v] })
                }
              />
              <SliderRow
                label="Rot"
                min={-Math.PI}
                max={Math.PI}
                step={0.05}
                value={selected.rotationY}
                onChange={(v) => updateProp(selected.id, { rotationY: v })}
                format={(v) => `${Math.round((v * 180) / Math.PI)}°`}
              />
              <SliderRow
                label="Esc"
                min={0.3}
                max={3}
                step={0.05}
                value={selected.scale}
                onChange={(v) => updateProp(selected.id, { scale: v })}
                format={(v) => `${v.toFixed(2)}×`}
              />
            </div>
          )}

          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.confirm('Remover todos os props deste palco?')) {
                  onSelectedIdChange(null);
                  clearAll();
                }
              }}
              className="w-full text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              Limpar todos
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="grid grid-cols-[28px_1fr_44px] items-center gap-2">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 w-full cursor-pointer accent-[hsl(190_70%_58%)]"
      />
      <span className="text-[10px] font-mono text-foreground/85 text-right">
        {format ? format(value) : value.toFixed(2)}
      </span>
    </div>
  );
}
