/**
 * ShowPlanSanitizerPanel — Sprint 2 (Phase 0/1) UI surface.
 *
 * Mostra o diff de `sanitizeShowPlan(showPlanManager.current)` ao vivo
 * (tick 2s, pure read) e permite ao operador aplicar a limpeza com 1
 * clique. Aplicar é a ÚNICA escrita: chama `showPlanManager.load(plan)`
 * — caminho aprovado para mutação do ShowPlan canônico.
 *
 * Honesty rules:
 *   - Zero CommandBus / FieldBus / SafetyStateMachine.
 *   - Não muda workMode, não arma, não dispara.
 *   - "Apply" é gated por confirmação visual — sem auto-apply.
 *   - Se nada mudaria, mostra estado clean e desabilita Apply.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Wand2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import {
  sanitizeShowPlan,
  sanitizationToText,
  type ShowPlanSanitizationResult,
} from '@/core/showplan/sanitizeShowPlan';

function evaluate(): ShowPlanSanitizationResult {
  return sanitizeShowPlan(showPlanManager.current as ReturnType<
    typeof showPlanManager.current.valueOf
  > extends infer _ ? typeof showPlanManager.current : never);
}

export default function ShowPlanSanitizerPanel() {
  const { toast } = useToast();
  const [result, setResult] = useState<ShowPlanSanitizationResult>(() =>
    sanitizeShowPlan(showPlanManager.current),
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setResult(sanitizeShowPlan(showPlanManager.current));
      setTick((t) => t + 1);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const summary = useMemo(() => sanitizationToText(result.diff), [result]);

  const handleApply = useCallback(() => {
    if (!result.changed) return;
    showPlanManager.load(result.plan);
    toast({
      title: 'ShowPlan saneado',
      description: summary,
    });
    setResult(sanitizeShowPlan(showPlanManager.current));
  }, [result, summary, toast]);

  const planName = showPlanManager.current.metadata.name || '(blank)';
  const cues = showPlanManager.current.pyroCues.length;
  const drone = showPlanManager.current.dronePaths.length;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="ds-h3 flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            ShowPlan sanitizer
          </h2>
          <p className="text-xs text-muted-foreground">
            Plano ativo: <span className="font-mono">{planName}</span> ·{' '}
            {cues} pyro · {drone} drone path(s) · tick #{tick}
          </p>
        </div>
        {result.changed ? (
          <Badge
            variant="outline"
            style={{
              borderColor: 'hsl(var(--status-warn))',
              color: 'hsl(var(--status-warn))',
            }}
          >
            {result.diff.removedPyroCueIds.length +
              result.diff.removedDronePathIds.length +
              (result.diff.filledName ? 1 : 0) +
              (result.diff.filledDuration !== null ? 1 : 0)}{' '}
            fix(es) propostos
          </Badge>
        ) : (
          <Badge
            variant="outline"
            style={{
              borderColor: 'hsl(var(--status-ok))',
              color: 'hsl(var(--status-ok))',
            }}
          >
            <Check className="h-3 w-3 mr-1" />
            clean
          </Badge>
        )}
      </div>

      {result.changed ? (
        <>
          <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/40 rounded p-2 border border-border/40">
            {summary}
          </pre>
          <div className="flex justify-end">
            <Button size="sm" onClick={handleApply}>
              <Wand2 className="h-4 w-4 mr-2" />
              Apply sanitization
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          ShowPlan canônico já está limpo: sem orphans e metadata coerente.
        </p>
      )}
    </Card>
  );
}
