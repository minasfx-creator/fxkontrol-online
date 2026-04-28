/**
 * SafetyGateSettings — QUARANTINED.
 *
 * Todos os toggles de bloqueio foram desativados para a fase de testes.
 * Os módulos originais permanecem em `src/_quarantine/safety/` e podem
 * ser restaurados antes do deploy de produção.
 */

import { Shield, Info } from 'lucide-react';

export default function SafetyGateSettings() {
  return (
    <div className="space-y-4 p-4">
      <header className="flex items-center gap-3">
        <Shield className="w-5 h-5 text-amber-500" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">Sistemas de Segurança</h2>
          <p className="text-xs text-muted-foreground">
            Estado: <span className="text-amber-500 font-mono">QUARENTENA · MODO TESTES</span>
          </p>
        </div>
      </header>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-sm text-foreground/90 space-y-2">
            <p>
              Todas as 4 camadas de bloqueio foram <strong>desativadas</strong> para
              a fase atual de testes:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs">
              <li>Lockout Groups (A–E)</li>
              <li>Cadeia de Interlock (LOCK → ARM → FIRE)</li>
              <li>Guard de Modo Operacional</li>
              <li>Travas de Itens e Camadas</li>
            </ul>
            <p className="text-xs text-muted-foreground pt-1">
              Telemetria e diagnóstico continuam ativos e visíveis — apenas o
              comportamento de <em>bloqueio</em> está suspenso. Simulação,
              preview e export funcionam sem restrições por estado interno.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
        <p className="font-mono">
          Restauração para produção:
          <br />
          <code className="text-foreground/70">
            cp src/_quarantine/safety/safetyGate.original.ts.txt
            src/core/safety/safetyGate.ts
          </code>
          <br />
          + reverter early-returns em <code className="text-foreground/70">ExportCoordinator.execute()</code>
          <br />
          + restaurar lógica binária em <code className="text-foreground/70">ReadinessEvaluator._isOperationAllowed()</code>
        </p>
      </div>
    </div>
  );
}
