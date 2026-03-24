/**
 * useStockValidation — Real-time inventory validation for timeline cues.
 * Checks if designed effects exceed available stock from inventory store.
 */
import { useMemo } from 'react';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useInventoryStore } from '@/store/useInventoryStore';

export interface StockAlert {
  effectId: string;
  effectName: string;
  effectIcon: string;
  required: number;
  available: number;
  deficit: number;
}

export function useStockValidation() {
  const timelineItems = useProjectStore(s => s.timelineItems);
  const inventoryItems = useInventoryStore(s => s.items);

  const alerts = useMemo<StockAlert[]>(() => {
    // Count usage per effect
    const usage: Record<string, number> = {};
    timelineItems.forEach(ti => {
      usage[ti.effectId] = (usage[ti.effectId] || 0) + 1;
    });

    const result: StockAlert[] = [];
    for (const [effectId, required] of Object.entries(usage)) {
      const inv = inventoryItems.find(i => i.effectId === effectId);
      const available = inv?.onHand ?? 0;
      // Only alert if inventory has been initialized (onHand > 0 means tracked)
      if (available > 0 && required > available) {
        const effect = EFFECT_LIBRARY.find(e => e.id === effectId);
        result.push({
          effectId,
          effectName: effect?.name || effectId,
          effectIcon: effect?.icon || '🎆',
          required,
          available,
          deficit: required - available,
        });
      }
    }

    return result.sort((a, b) => b.deficit - a.deficit);
  }, [timelineItems, inventoryItems]);

  const hasAlerts = alerts.length > 0;
  const totalDeficit = alerts.reduce((sum, a) => sum + a.deficit, 0);

  return { alerts, hasAlerts, totalDeficit };
}
