import { useEffect, useState } from 'react';
import { renderQuality, type RenderQuality } from '@/lib/featureFlags';
import { renderStabilityController } from '@/render_ultra/stability/renderStabilityController';

/**
 * Reactive hook returning the current effective render quality tier.
 * Re-renders the component when the stability controller degrades or upgrades.
 */
export function useRenderQualityTier(): RenderQuality {
  const [tier, setTier] = useState<RenderQuality>(() => renderQuality());
  useEffect(() => {
    renderStabilityController.start();
    setTier(renderQuality());
    return renderStabilityController.subscribe((next) => setTier(next));
  }, []);
  return tier;
}
