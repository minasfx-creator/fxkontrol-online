/**
 * AddPositionWizard — Guided 4-step bottom sheet for creating positions
 * Inspired by Finale 3D workflow: Type → Place → Angles → Effect
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import { X, MapPin, Plane, Sparkles, ChevronRight, ChevronLeft, Check, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useUndoStore } from '@/store/useUndoStore';
import AngleQuickEditor from './AngleQuickEditor';

type WizardStep = 1 | 2 | 3 | 4;
type PositionType = 'pyro' | 'drone-pad';

interface AddPositionWizardProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { key: 'all', label: 'Todos' },
  { key: 'morteiros', label: 'Shells' },
  { key: 'cakes_batteries', label: 'Cakes' },
  { key: 'roman_candles', label: 'Candles' },
  { key: 'mines', label: 'Mines' },
  { key: 'waterfalls', label: 'Falls' },
  { key: 'sfx', label: 'SFX' },
  { key: 'drones', label: 'Drones' },
];

export default function AddPositionWizard({ open, onClose }: AddPositionWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [posType, setPosType] = useState<PositionType>('pyro');
  const [placedIds, setPlacedIds] = useState<string[]>([]);
  const [heading, setHeading] = useState(0);
  const [pitch, setPitch] = useState(85);
  const [roll, setRoll] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const setEditorMode = useProjectStore(s => s.setEditorMode);
  const positions = useProjectStore(s => s.positions);

  // Listen for position-placed events from GroundClickPlane
  useEffect(() => {
    if (!open || step !== 2) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.id) {
        setPlacedIds(prev => [...prev, detail.id]);
        haptics.tap();
      }
    };
    window.addEventListener('position-placed', handler);
    return () => window.removeEventListener('position-placed', handler);
  }, [open, step]);

  // Activate add mode when on step 2
  useEffect(() => {
    if (open && step === 2) {
      setEditorMode(posType === 'pyro' ? 'add-pyro' : 'add-drone');
    }
  }, [open, step, posType, setEditorMode]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setPlacedIds([]);
      setHeading(0);
      setPitch(85);
      setRoll(0);
      setSelectedCategory('all');
    }
  }, [open]);

  const handleClose = useCallback(() => {
    setEditorMode('select');
    onClose();
  }, [setEditorMode, onClose]);

  const handleAngleChange = useCallback((h: number, p: number, r: number) => {
    setHeading(h);
    setPitch(p);
    setRoll(r);
  }, []);

  // Apply angles to all placed positions
  const applyAngles = useCallback(() => {
    const store = useProjectStore.getState();
    placedIds.forEach(id => {
      store.updatePosition(id, { heading, pitch, roll });
    });
  }, [placedIds, heading, pitch, roll]);

  // Apply effect to placed positions
  const handleSelectEffect = useCallback((effectId: string) => {
    haptics.success();
    const store = useProjectStore.getState();
    useUndoStore.getState().checkpoint();
    const pos0 = store.positions.find(p => p.id === placedIds[0]);
    placedIds.forEach((posId, i) => {
      const pos = store.positions.find(p => p.id === posId);
      store.addTimelineItem({
        id: `tl-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
        effectId,
        positionId: posId,
        startTime: store.currentTime + i * 0.2,
        trackIndex: 0,
        position: { x: pos?.x ?? 0, y: pos?.y ?? 0, z: pos?.z ?? 0 },
      });
    });
    handleClose();
  }, [placedIds, handleClose]);

  const filteredEffects = useMemo(() => {
    const effects = EFFECT_LIBRARY.filter(e => e.type === 'firework');
    if (selectedCategory === 'all') return effects;
    return effects.filter(e => e.category === selectedCategory);
  }, [selectedCategory]);

  const handleNext = useCallback(() => {
    if (step === 3) applyAngles();
    if (step < 4) {
      haptics.tap();
      setStep((step + 1) as WizardStep);
    }
  }, [step, applyAngles]);

  const handlePrev = useCallback(() => {
    if (step > 1) {
      haptics.tap();
      setStep((step - 1) as WizardStep);
    }
  }, [step]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={handleClose} />

      {/* Bottom sheet */}
      <div
        className="relative pointer-events-auto mx-2 mb-[72px] rounded-t-[24px] rounded-b-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
        style={{
          background: 'rgba(10, 12, 18, 0.97)',
          backdropFilter: 'blur(48px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(48px) saturate(1.6)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.04)',
          borderRight: '1px solid rgba(255, 255, 255, 0.04)',
          boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.6)',
          maxHeight: '70dvh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/80">
              {step === 1 && 'Tipo'}
              {step === 2 && 'Posicionar'}
              {step === 3 && 'Ângulos HPR'}
              {step === 4 && 'Efeito'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Step indicator */}
            <div className="flex gap-1">
              {[1, 2, 3, 4].map(s => (
                <div
                  key={s}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: s === step ? 16 : 6,
                    height: 6,
                    background: s === step ? 'hsl(var(--primary))' : s < step ? 'hsl(var(--primary) / 0.4)' : 'hsl(var(--muted-foreground) / 0.2)',
                  }}
                />
              ))}
            </div>
            <button onClick={handleClose} className="w-7 h-7 flex items-center justify-center rounded-full active:scale-90 transition-transform" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pb-3 overflow-y-auto" style={{ maxHeight: 'calc(70dvh - 100px)' }}>
          {/* Step 1: Type selection */}
          {step === 1 && (
            <div className="space-y-2 py-2">
              {[
                { type: 'pyro' as const, icon: MapPin, label: 'Nova Posição Pyro', desc: 'Morteiro, cake, mina, cascata' },
                { type: 'drone-pad' as const, icon: Plane, label: 'Novo Drone Pad', desc: 'Pad de lançamento para drones' },
              ].map(({ type, icon: Icon, label, desc }) => (
                <button
                  key={type}
                  onClick={() => { haptics.select(); setPosType(type); setStep(2); }}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border transition-all active:scale-[0.98]",
                    posType === type ? "border-primary/30 bg-primary/5" : "border-border/50 bg-surface-1/50"
                  )}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'hsl(var(--primary) / 0.1)' }}>
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-foreground">{label}</div>
                    <div className="text-[10px] text-muted-foreground">{desc}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 ml-auto" />
                </button>
              ))}

              {/* Add effect to existing */}
              {positions.length > 0 && (
                <button
                  onClick={() => { haptics.select(); setPlacedIds(useProjectStore.getState().selectedPositionIds); setStep(3); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-accent/20 bg-accent/5 transition-all active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'hsl(var(--accent) / 0.1)' }}>
                    <Sparkles className="w-5 h-5 text-accent" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-foreground">Efeito em Existente</div>
                    <div className="text-[10px] text-muted-foreground">{positions.length} posições disponíveis</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 ml-auto" />
                </button>
              )}
            </div>
          )}

          {/* Step 2: Tap to place */}
          {step === 2 && (
            <div className="py-4 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center fab-glow-pulse" style={{ background: 'hsl(var(--primary) / 0.15)' }}>
                <Target className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Toque no viewport para posicionar</p>
                <p className="text-[11px] text-muted-foreground mt-1">Cada toque cria uma nova posição no mapa 3D</p>
              </div>
              {placedIds.length > 0 && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'hsl(var(--primary) / 0.1)', border: '1px solid hsl(var(--primary) / 0.2)' }}>
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-bold text-primary tabular-nums">{placedIds.length} criada{placedIds.length > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Angles HPR */}
          {step === 3 && (
            <div className="py-2">
              <AngleQuickEditor
                heading={heading}
                pitch={pitch}
                roll={roll}
                onChange={handleAngleChange}
              />
            </div>
          )}

          {/* Step 4: Effect selection */}
          {step === 4 && (
            <div className="space-y-3 py-1">
              {/* Category tabs */}
              <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                {CATEGORIES.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => { haptics.tap(); setSelectedCategory(key); }}
                    className={cn(
                      "shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95",
                      selectedCategory === key
                        ? "bg-primary/15 text-primary border border-primary/20"
                        : "text-muted-foreground/50 border border-transparent"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Effects grid */}
              <div className="grid grid-cols-3 gap-1.5 max-h-[35vh] overflow-y-auto no-scrollbar">
                {filteredEffects.slice(0, 30).map(effect => (
                  <button
                    key={effect.id}
                    onClick={() => handleSelectEffect(effect.id)}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl border border-border/30 transition-all active:scale-95 hover:border-primary/30"
                    style={{ background: 'hsl(var(--surface-1))' }}
                  >
                    <div
                      className="w-6 h-6 rounded-full"
                      style={{ background: effect.color, boxShadow: `0 0 8px ${effect.color}40` }}
                    />
                    <span className="text-[8px] font-semibold text-foreground/70 text-center leading-tight line-clamp-2">
                      {effect.name}
                    </span>
                  </button>
                ))}
              </div>

              {/* Skip effect */}
              <button
                onClick={handleClose}
                className="w-full py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 active:scale-95 transition-transform"
              >
                Sem efeito — criar vazia
              </button>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/20">
          <button
            onClick={step === 1 ? handleClose : handlePrev}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-semibold text-muted-foreground active:scale-95 transition-transform"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>

          {step < 4 && (
            <button
              onClick={handleNext}
              disabled={step === 2 && placedIds.length === 0}
              className={cn(
                "flex items-center gap-1 px-4 py-2 rounded-xl text-[11px] font-bold transition-all active:scale-95",
                step === 2 && placedIds.length === 0
                  ? "text-muted-foreground/30 bg-muted/30"
                  : "text-primary-foreground bg-primary shadow-lg"
              )}
              style={step === 2 && placedIds.length === 0 ? undefined : { boxShadow: '0 4px 16px hsl(var(--primary) / 0.3)' }}
            >
              {step === 3 ? 'Confirmar' : 'Próximo'}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 3 && (
            <button
              onClick={() => { setStep(4); }}
              className="px-3 py-2 rounded-xl text-[10px] font-bold text-muted-foreground/50 active:scale-95 transition-transform"
            >
              Pular →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
