/**
 * OperationalLockoutSettings (legacy filename SafetyGateSettings.tsx)
 *
 * Surface the new WorkMode (design / simulation / real_operation) at the
 * top, then the physical lockout layers — which only have effect in
 * `real_operation`. In design/simulation EVERY blocking layer is bypassed
 * regardless of toggle state. Toggles below tune the experience inside
 * Real Operation only.
 */

import { useEffect, useState } from 'react';
import { Shield, Lock, Info, Sparkles, Eye, AlertTriangle } from 'lucide-react';
import { safetyGate, type SafetyGateConfig, type SafetyLayer } from '@/core/safety/safetyGate';
import { workMode, type WorkMode } from '@/core/safety/workMode';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

const LAYERS: { key: SafetyLayer; label: string; desc: string }[] = [
  { key: 'lockoutGroups',  label: 'Lockout Groups (A–E)', desc: 'Hold-to-confirm físico do Live Firing.' },
  { key: 'interlockChain', label: 'Interlock LOCK→ARM→FIRE', desc: 'Cadeia determinística antes de qualquer disparo.' },
  { key: 'modeGuard',      label: 'Operational Mode Guard', desc: 'Restringe operações sensíveis dentro de Operação Real.' },
  { key: 'uiLocks',        label: 'UI Locks (itens travados)', desc: 'Respeita .locked em items/layers — informativo fora de Real.' },
];

const MODE_META: Record<WorkMode, { label: string; desc: string; tone: string; icon: typeof Sparkles }> = {
  design:          { label: 'Design / Edição',  desc: 'Liberdade total para criar, editar, importar, organizar.',     tone: 'text-sky-400',     icon: Sparkles },
  simulation:      { label: 'Simulação / Preview', desc: 'Render 3D, timeline e validações sem qualquer disparo real.', tone: 'text-emerald-400', icon: Eye },
  real_operation:  { label: 'Operação Real',    desc: 'Hardware físico armado. Todos os intertravamentos ATIVOS.',     tone: 'text-red-400',     icon: AlertTriangle },
};

export default function SafetyGateSettings() {
  const [cfg, setCfg] = useState<Readonly<SafetyGateConfig>>(safetyGate.config);
  const [mode, setMode] = useState<WorkMode>(workMode.get());
  const strict = safetyGate.isStrict;
  const isReal = mode === 'real_operation';

  useEffect(() => safetyGate.subscribe(setCfg), []);
  useEffect(() => workMode.subscribe(setMode), []);

  const requestRealMode = () => {
    const ok = window.confirm(
      'Ativar OPERAÇÃO REAL?\n\n' +
      'Todos os intertravamentos físicos serão aplicados. Saídas reais ' +
      'podem ser energizadas. Operador autorizado deve estar presente.',
    );
    if (ok) workMode.set('real_operation');
  };

  return (
    <div className="space-y-4 p-4">
      {/* ── Work Mode ─────────────────────────────────────────────── */}
      <section className="space-y-2">
        <header className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Modo de trabalho</h2>
            <p className="text-xs text-muted-foreground">
              Separação entre criação livre e operação real. Bloqueios físicos só agem em Operação Real.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {(Object.keys(MODE_META) as WorkMode[]).map((m) => {
            const meta = MODE_META[m];
            const Icon = meta.icon;
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  if (m === 'real_operation') requestRealMode();
                  else workMode.set(m);
                }}
                className={`text-left rounded-md border p-3 transition ${
                  active
                    ? 'border-primary bg-primary/10'
                    : 'border-border/50 bg-muted/10 hover:bg-muted/20'
                }`}
              >
                <div className={`flex items-center gap-2 ${meta.tone}`}>
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{meta.label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{meta.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Operational Lockout ───────────────────────────────────── */}
      <section className="space-y-3 pt-2 border-t border-border/40">
        <header className="flex items-center gap-3">
          <Shield className={`w-5 h-5 ${strict ? 'text-emerald-500' : isReal ? 'text-amber-500' : 'text-muted-foreground'}`} />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Sistema de bloqueio operacional</h2>
            <p className="text-xs text-muted-foreground">
              Afeta apenas <strong>Operação Real</strong>. Não bloqueia criação, edição, simulação ou render 3D.
              Estado:{' '}
              <span className={`font-mono ${strict ? 'text-emerald-500' : 'text-amber-500'}`}>
                {strict ? 'STRICT · BLOQUEIOS FORÇADOS (PROD)' : isReal ? 'PERMISSIVO · ATIVO EM REAL' : 'INATIVO (modo criativo)'}
              </span>
            </p>
          </div>
        </header>

        {strict && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-start gap-2">
            <Lock className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <div className="text-xs text-foreground/90">
              <strong>Modo estrito ativo</strong> via flag <code>safety_gate_strict</code>. Todas as
              4 camadas estão forçadamente <strong>ON</strong> para Operação Real.
            </div>
          </div>
        )}

        {!isReal && (
          <div className="rounded-md border border-sky-500/20 bg-sky-500/5 p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              Você está em <strong>{MODE_META[mode].label}</strong>. Os toggles abaixo são prévia da
              configuração que será aplicada quando entrar em Operação Real. Alertas e validações
              continuam visíveis, mas nada bloqueia o fluxo criativo.
            </p>
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

        <div className="flex items-center justify-between rounded-md border border-border/50 bg-muted/10 p-3">
          <div className="text-sm text-foreground">Master switch (Operação Real)</div>
          <Switch
            checked={!!cfg.masterEnabled}
            disabled={strict}
            onCheckedChange={(v) => safetyGate.setMaster(v)}
          />
        </div>

        {isReal && !cfg.masterEnabled && !strict && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground">
                Operação Real ativa com bloqueios desativados. Alertas continuam, mas comandos
                físicos passarão sem intertravamento. Recomendado manter ativo.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => safetyGate.enableAll()}>
              Reativar
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
