/**
 * SafetyGateSettings — Live status panel for the Safety Gate.
 * In STRICT mode (prod default), all toggles are read-only LOCKED.
 * In PERMISSIVE mode, layers are togglable per-user.
 */

import { useEffect, useState } from 'react';
import { Shield, Lock, Info } from 'lucide-react';
import { safetyGate, type SafetyGateConfig, type SafetyLayer } from '@/core/safety/safetyGate';
import { Switch } from '@/components/ui/switch';

const LAYERS: { key: SafetyLayer; label: string; desc: string }[] = [
  { key: 'lockoutGroups',  label: 'Lockout Groups (A–E)', desc: 'Hold-to-confirm grupos do Live Firing.' },
  { key: 'interlockChain', label: 'Interlock LOCK→ARM→FIRE', desc: 'Cadeia determinística da SafetyStateMachine.' },
  { key: 'modeGuard',      label: 'Operational Mode Guard', desc: 'Restringe simulate/preview/export por modo.' },
  { key: 'uiLocks',        label: 'UI Locks (itens travados)', desc: 'Respeita .locked em items/layers do editor.' },
];

export default function SafetyGateSettings() {
  const [cfg, setCfg] = useState<Readonly<SafetyGateConfig>>(safetyGate.config);
  const strict = safetyGate.isStrict;

  useEffect(() => safetyGate.subscribe(setCfg), []);

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-center gap-3">
        <Shield className={`w-5 h-5 ${strict ? 'text-emerald-500' : 'text-amber-500'}`} />
        <div>
          <h2 className="text-lg font-semibold text-foreground">Sistemas de Segurança</h2>
          <p className="text-xs text-muted-foreground">
            Estado:{' '}
            <span className={`font-mono ${strict ? 'text-emerald-500' : 'text-amber-500'}`}>
              {strict ? 'STRICT · BLOQUEIOS ATIVOS (PROD)' : 'PERMISSIVO · CONTROLE LOCAL'}
            </span>
          </p>
        </div>
      </header>

      {strict && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-start gap-2">
          <Lock className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
          <div className="text-xs text-foreground/90">
            <strong>Modo estrito ativo</strong> via flag <code>safety_gate_strict</code>. Todas as
            4 camadas estão forçadamente <strong>ON</strong> e não podem ser desativadas pela UI.
            Para alterar, edite <code>src/lib/featureFlags.ts</code>.
          </div>
        </div>
      )}

      <div className="space-y-2">
        {LAYERS.map(({ key, label, desc }) => (
          <div
            key={key}
            className="flex items-center justify-between rounded-md border border-border/50 bg-muted/10 p-3"
          >
            <div className="space-y-0.5">
              <p className="text-sm text-foreground">{label}</p>
              <p className="text-[11px] text-muted-foreground">{desc}</p>
            </div>
            <Switch
              checked={!!cfg[key]}
              disabled={strict}
              onCheckedChange={(v) => safetyGate.setLayer(key, v)}
            />
          </div>
        ))}
      </div>

      {!strict && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground">
            Modo permissivo: ative o master switch e as camadas individualmente para reproduzir o
            comportamento mission-critical durante testes locais.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between rounded-md border border-border/50 bg-muted/10 p-3">
        <div className="text-sm text-foreground">Master switch</div>
        <Switch
          checked={!!cfg.masterEnabled}
          disabled={strict}
          onCheckedChange={(v) => safetyGate.setMaster(v)}
        />
      </div>
    </div>
  );
}
