import { useEffect, useState } from 'react';
import { Sparkles, Gauge, Zap } from 'lucide-react';
import {
  getGlassQualityPref,
  setGlassQualityPref,
  subscribeGlassQuality,
  type GlassQualityPref,
  type GpuTier,
} from '@/lib/gpuTier';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

/**
 * Glass Quality toggle — cycles Auto → High → Low.
 * Writes user preference to localStorage and updates `<html data-gpu-tier>`
 * so the existing CSS adaptive-blur rules apply instantly.
 */
const ORDER: GlassQualityPref[] = ['auto', 'high', 'low'];

const META: Record<GlassQualityPref, { label: string; icon: typeof Sparkles; desc: string }> = {
  auto: { label: 'AUTO', icon: Sparkles, desc: 'Detecta GPU automaticamente' },
  high: { label: 'HIGH', icon: Gauge, desc: 'Vidro completo (60px blur)' },
  low: { label: 'LOW', icon: Zap, desc: 'Performance — blur reduzido' },
};

export function GlassQualityToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [pref, setPref] = useState<GlassQualityPref>(() => getGlassQualityPref());
  const [tier, setTier] = useState<GpuTier>(() =>
    (document.documentElement.dataset.gpuTier as GpuTier) || 'high',
  );

  useEffect(() => subscribeGlassQuality((t, p) => {
    setTier(t);
    setPref(p);
  }), []);

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
    setGlassQualityPref(next);
  };

  const { icon: Icon, label, desc } = META[pref];
  const effective = pref === 'auto' ? `· ${tier.toUpperCase()}` : '';

  const button = (
    <button
      onClick={cycle}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-control text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-all active:scale-95"
      aria-label={`Glass Quality: ${label}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: 'hsl(32 100% 50%)' }} />
      {!collapsed && (
        <span className="text-[9px] font-mono-code tracking-wider">
          GLASS · {label} <span className="opacity-50">{effective}</span>
        </span>
      )}
    </button>
  );

  if (!collapsed) return button;

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" className="glass-hud rounded-panel border-primary/10 text-[10px] font-mono-code px-3 py-2">
          <p className="font-bold">Glass · {label}</p>
          <p className="text-muted-foreground text-[8px]">{desc}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
