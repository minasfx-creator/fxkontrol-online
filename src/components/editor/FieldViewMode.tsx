/**
 * FieldViewMode — High-Contrast UI for outdoor Show Commander operation.
 * Designed for readability under direct sunlight on barges/field.
 * Pure white background, black text, neon telemetry indicators.
 */
import { createContext, useContext, useState, useCallback } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Context ─────────────────────────────────────────────────────────

interface FieldViewContextType {
  isFieldMode: boolean;
  toggleFieldMode: () => void;
}

const FieldViewContext = createContext<FieldViewContextType>({
  isFieldMode: false,
  toggleFieldMode: () => {},
});

export function useFieldViewMode() {
  return useContext(FieldViewContext);
}

// ── Provider ────────────────────────────────────────────────────────

export function FieldViewProvider({ children }: { children: React.ReactNode }) {
  const [isFieldMode, setIsFieldMode] = useState(false);
  const toggleFieldMode = useCallback(() => setIsFieldMode(v => !v), []);

  return (
    <FieldViewContext.Provider value={{ isFieldMode, toggleFieldMode }}>
      {children}
    </FieldViewContext.Provider>
  );
}

// ── Toggle Button ───────────────────────────────────────────────────

export function FieldModeToggle() {
  const { isFieldMode, toggleFieldMode } = useFieldViewMode();

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={toggleFieldMode}
      className={cn(
        "h-7 px-2 text-[9px] font-bold uppercase tracking-wider gap-1",
        isFieldMode
          ? "bg-white text-black border-black hover:bg-gray-100"
          : "border-border/30 text-muted-foreground hover:text-foreground"
      )}
    >
      {isFieldMode ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
      {isFieldMode ? 'STUDIO' : 'FIELD'}
    </Button>
  );
}

// ── Field Mode Wrapper ──────────────────────────────────────────────

export function FieldViewWrapper({ children, className }: { children: React.ReactNode; className?: string }) {
  const { isFieldMode } = useFieldViewMode();

  if (!isFieldMode) return <>{children}</>;

  return (
    <div className={cn(
      "field-view-active",
      "bg-white text-black",
      "[&_.text-muted-foreground]:text-gray-600",
      "[&_.text-primary]:text-black",
      "[&_.bg-card]:bg-gray-50 [&_.bg-card\\/20]:bg-gray-50 [&_.bg-card\\/30]:bg-gray-100",
      "[&_.border-border]:border-gray-300 [&_.border-border\\/10]:border-gray-200 [&_.border-border\\/20]:border-gray-300",
      "[&_.font-mono-code]:text-[20px]",
      "rounded-xl",
      className,
    )}>
      {children}
    </div>
  );
}

// ── Field Telemetry Indicator ───────────────────────────────────────

type TelemetryLevel = 'ok' | 'warning' | 'critical';

const NEON_COLORS: Record<TelemetryLevel, string> = {
  ok: '#00FF66',
  warning: '#FFAA00',
  critical: '#FF3366',
};

export function FieldTelemetryBadge({
  label,
  value,
  unit,
  level = 'ok',
}: {
  label: string;
  value: string | number;
  unit?: string;
  level?: TelemetryLevel;
}) {
  const { isFieldMode } = useFieldViewMode();
  const neonColor = NEON_COLORS[level];

  if (!isFieldMode) {
    // Standard mode — compact badge
    return (
      <div className="flex items-center gap-1 text-[9px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold tabular-nums" style={{ color: neonColor }}>{value}</span>
        {unit && <span className="text-muted-foreground/60">{unit}</span>}
      </div>
    );
  }

  // Field mode — large neon readout
  return (
    <div className="flex flex-col items-center p-2 rounded-lg bg-black min-w-[80px]">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
      <span
        className="text-3xl font-black tabular-nums leading-tight"
        style={{
          color: neonColor,
          textShadow: `0 0 10px ${neonColor}40, 0 0 20px ${neonColor}20`,
        }}
      >
        {value}
      </span>
      {unit && <span className="text-[9px] text-gray-500 font-medium">{unit}</span>}
    </div>
  );
}

// ── Terrain Collision Alert ─────────────────────────────────────────

export function TerrainCollisionAlert({
  hasCollision,
  minClearance,
}: {
  hasCollision: boolean;
  minClearance: number;
}) {
  if (!hasCollision) return null;

  return (
    <div className={cn(
      "rounded-lg border-2 border-red-500 bg-red-500/10 p-3 animate-pulse",
      "flex items-center gap-3"
    )}>
      <div
        className="w-4 h-4 rounded-full bg-red-500"
        style={{ boxShadow: '0 0 12px #FF3366, 0 0 24px #FF336640' }}
      />
      <div>
        <p className="text-sm font-black text-red-400 uppercase tracking-wider">
          ⚠ TERRAIN COLLISION
        </p>
        <p className="text-[10px] text-red-300/70">
          Min clearance: {minClearance.toFixed(1)}m — Rota de colisão detectada
        </p>
      </div>
    </div>
  );
}
