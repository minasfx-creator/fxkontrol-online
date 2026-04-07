/**
 * LiveCard — AR/HUD contextual telemetry card.
 * Floats adjacent to the selected 3D position, projected from world coords to screen space.
 * Auto-dissolves after 5s of inactivity or on deselection.
 */
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { getEffectById } from '@/data/effectLibraryMap';
import { Navigation, Crosshair, Zap, Shield, MapPin } from 'lucide-react';

const DISSOLVE_DELAY = 5000; // ms

export default function LiveCard() {
  const {
    positions, selectedPositionId, selectedPositionIds, timelineItems,
  } = useProjectStore();

  const [visible, setVisible] = useState(false);
  const [screenPos, setScreenPos] = useState({ x: 0, y: 0 });
  const dissolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number>(0);

  const pos = useMemo(() =>
    selectedPositionId ? positions.find(p => p.id === selectedPositionId) : null,
    [selectedPositionId, positions]
  );

  const linkedEffects = useMemo(() => {
    if (!pos) return [];
    return timelineItems
      .filter(t => t.positionId === pos.id)
      .slice(0, 4)
      .map(t => {
        const eff = getEffectById(t.effectId);
        return { id: t.id, name: eff?.name || t.effectId, color: eff?.color || '#888', time: t.startTime };
      });
  }, [pos, timelineItems]);

  // Project 3D → screen via custom event from SkyCanvas
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail?.screenX != null) {
        setScreenPos({ x: e.detail.screenX + 24, y: e.detail.screenY - 60 });
      }
    };
    window.addEventListener('livecard-project' as any, handler as any);
    return () => window.removeEventListener('livecard-project' as any, handler as any);
  }, []);

  // Show/hide with dissolve
  useEffect(() => {
    if (pos) {
      setVisible(true);
      resetDissolve();
    } else {
      setVisible(false);
    }
    return () => { if (dissolveTimer.current) clearTimeout(dissolveTimer.current); };
  }, [pos?.id]);

  const resetDissolve = useCallback(() => {
    if (dissolveTimer.current) clearTimeout(dissolveTimer.current);
    dissolveTimer.current = setTimeout(() => setVisible(false), DISSOLVE_DELAY);
  }, []);

  // Re-show on interaction
  useEffect(() => {
    if (!pos) return;
    setVisible(true);
    resetDissolve();
  }, [pos?.x, pos?.y, pos?.z, pos?.heading, pos?.pitch, pos?.roll]);

  if (!pos || !visible) return null;

  // Clamp to viewport
  const clampedX = Math.min(Math.max(screenPos.x, 16), typeof window !== 'undefined' ? window.innerWidth - 240 : 800);
  const clampedY = Math.min(Math.max(screenPos.y, 16), typeof window !== 'undefined' ? window.innerHeight - 200 : 600);

  return (
    <div
      className="fixed z-50 pointer-events-none animate-scale-in"
      style={{
        left: clampedX,
        top: clampedY,
        transition: 'left 80ms cubic-bezier(0, 0.55, 0.45, 1), top 80ms cubic-bezier(0, 0.55, 0.45, 1), opacity 300ms',
        opacity: visible ? 1 : 0,
        mixBlendMode: 'screen',
      }}
    >
      {/* Connection line */}
      <div
        className="absolute -left-4 top-1/2 w-4 h-px"
        style={{ background: 'linear-gradient(90deg, hsl(190 100% 50% / 0.1), hsl(190 100% 50% / 0.5))' }}
      />

      {/* Card */}
      <div
        className="relative min-w-[200px] max-w-[240px] rounded-sm overflow-hidden"
        style={{
          background: 'hsl(220 20% 5% / 0.92)',
          backdropFilter: 'blur(24px)',
          border: '1px solid hsl(190 100% 50% / 0.2)',
          boxShadow: '0 0 20px hsl(190 100% 50% / 0.08), inset 0 1px 0 hsl(190 100% 50% / 0.05)',
          clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
        }}
      >
        {/* Scanline overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(190 100% 50% / 0.3) 2px, hsl(190 100% 50% / 0.3) 3px)',
          }}
        />

        {/* Header */}
        <div className="px-2.5 py-1.5 border-b" style={{ borderColor: 'hsl(190 100% 50% / 0.1)' }}>
          <div className="flex items-center gap-1.5">
            <MapPin size={10} color="hsl(190, 100%, 50%)" />
            <span
              className="text-[10px] font-bold tracking-wider uppercase"
              style={{ color: 'hsl(190, 100%, 50%)', fontFamily: "'JetBrains Mono', monospace" }}
            >
              {pos.name}
            </span>
            {pos.section && (
              <span
                className="ml-auto text-[8px] px-1.5 py-0.5 rounded-sm font-bold"
                style={{
                  background: 'hsl(32 100% 50% / 0.15)',
                  color: 'hsl(32, 100%, 50%)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                §{pos.section}
              </span>
            )}
          </div>
          <div className="text-[8px] mt-0.5" style={{ color: 'hsl(180, 8%, 40%)', fontFamily: "'JetBrains Mono', monospace" }}>
            {pos.type.toUpperCase()} · ID:{pos.id.slice(-6)}
          </div>
        </div>

        {/* Coordinates */}
        <div className="px-2.5 py-1.5 grid grid-cols-3 gap-1">
          {[
            { label: 'X', value: pos.x, color: 'hsl(0, 70%, 55%)' },
            { label: 'Y', value: pos.y, color: 'hsl(120, 60%, 45%)' },
            { label: 'Z', value: pos.z, color: 'hsl(210, 70%, 55%)' },
          ].map(c => (
            <div key={c.label} className="text-center">
              <div className="text-[7px] font-bold" style={{ color: c.color, fontFamily: "'JetBrains Mono', monospace" }}>{c.label}</div>
              <div className="text-[9px] font-mono" style={{ color: 'hsl(180, 8%, 75%)' }}>{c.value.toFixed(1)}</div>
            </div>
          ))}
        </div>

        {/* Orientation */}
        <div className="px-2.5 py-1 border-t grid grid-cols-3 gap-1" style={{ borderColor: 'hsl(190 100% 50% / 0.08)' }}>
          {[
            { label: 'HDG', value: pos.heading, color: '#4FC3F7' },
            { label: 'PIT', value: pos.pitch || 85, color: '#FF8A65' },
            { label: 'ROL', value: pos.roll || 0, color: '#66BB6A' },
          ].map(c => (
            <div key={c.label} className="text-center">
              <div className="text-[7px] font-bold" style={{ color: c.color, fontFamily: "'JetBrains Mono', monospace" }}>{c.label}</div>
              <div className="text-[9px] font-mono" style={{ color: 'hsl(180, 8%, 75%)' }}>{c.value}°</div>
            </div>
          ))}
        </div>

        {/* Linked effects */}
        {linkedEffects.length > 0 && (
          <div className="px-2.5 py-1.5 border-t" style={{ borderColor: 'hsl(190 100% 50% / 0.08)' }}>
            <div className="flex items-center gap-1 mb-1">
              <Zap size={8} color="hsl(32, 100%, 50%)" />
              <span className="text-[7px] font-bold uppercase tracking-wider" style={{ color: 'hsl(32, 100%, 50%)', fontFamily: "'JetBrains Mono', monospace" }}>
                Effects ({linkedEffects.length})
              </span>
            </div>
            <div className="space-y-0.5">
              {linkedEffects.map(eff => (
                <div key={eff.id} className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: eff.color }} />
                  <span className="text-[8px] truncate" style={{ color: 'hsl(180, 8%, 60%)', fontFamily: "'JetBrains Mono', monospace" }}>{eff.name}</span>
                  <span className="text-[7px] ml-auto" style={{ color: 'hsl(180, 8%, 35%)', fontFamily: "'JetBrains Mono', monospace" }}>{eff.time.toFixed(1)}s</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status bar */}
        <div className="px-2.5 py-1 border-t flex items-center gap-2" style={{ borderColor: 'hsl(190 100% 50% / 0.08)' }}>
          <div className="flex items-center gap-1">
            <Shield size={7} color="hsl(120, 70%, 38%)" />
            <span className="text-[7px]" style={{ color: 'hsl(120, 70%, 45%)', fontFamily: "'JetBrains Mono', monospace" }}>SAFE</span>
          </div>
          <div className="flex-1" />
          <span className="text-[6px]" style={{ color: 'hsl(180, 8%, 30%)', fontFamily: "'JetBrains Mono', monospace" }}>
            LIVE
          </span>
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'hsl(190, 100%, 50%)' }} />
        </div>
      </div>
    </div>
  );
}
