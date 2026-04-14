/**
 * StockAlertsBadge — Compact stock shortage indicator for toolbar/timeline.
 * Integrates with useStockValidation to show deficit warnings inline.
 */
import { useState } from 'react';
import { AlertTriangle, Package, ChevronDown, X } from 'lucide-react';
import { useStockValidation, type StockAlert } from '@/hooks/useStockValidation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export default function StockAlertsBadge() {
  const { alerts, hasAlerts, totalDeficit } = useStockValidation();

  if (!hasAlerts) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-colors",
            "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/20"
          )}
        >
          <AlertTriangle className="w-3 h-3" />
          <span>{alerts.length} estoque</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-72 p-0 bg-card border-border"
      >
        <div className="px-3 py-2 border-b border-border flex items-center gap-2">
          <Package className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-bold text-foreground">Alertas de Estoque</span>
          <span className="ml-auto text-[9px] text-destructive font-mono font-bold">
            -{totalDeficit} déficit
          </span>
        </div>
        <div className="max-h-48 overflow-y-auto p-1">
          {alerts.map(a => (
            <div
              key={a.effectId}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-3 text-[10px]"
            >
              <span className="text-sm flex-shrink-0">{a.effectIcon}</span>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-secondary-foreground">{a.effectName}</p>
                <p className="text-muted-foreground">
                  Precisa <span className="font-bold text-foreground">{a.required}</span> · Tem{' '}
                  <span className="font-bold text-foreground">{a.available}</span>
                </p>
              </div>
              <span className="text-destructive font-mono font-bold">-{a.deficit}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
