/**
 * SafetyGateSettings — UI de configuração dos bloqueios opcionais.
 * Exposta em Settings → aba "Segurança".
 *
 * Filosofia: por padrão TUDO desligado para usuário leigo.
 * Operadores avançados ligam o Master Switch e escolhem camadas.
 */

import { useEffect, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Shield, Lock, GitBranch, ShieldCheck, Layers, Info } from 'lucide-react';
import { safetyGate, type SafetyGateConfig, type SafetyLayer } from '@/core/safety/safetyGate';

const LAYER_INFO: Array<{
  key: SafetyLayer;
  icon: typeof Lock;
  label: string;
  description: string;
}> = [
  {
    key: 'lockoutGroups',
    icon: Lock,
    label: 'Lockout Groups (A–E)',
    description: 'Bloqueia disparos por grupo de risco no painel Live Firing.',
  },
  {
    key: 'interlockChain',
    icon: GitBranch,
    label: 'Cadeia de Interlock (LOCK → ARM → FIRE)',
    description: 'Exige sequência completa de armamento antes de qualquer disparo.',
  },
  {
    key: 'modeGuard',
    icon: ShieldCheck,
    label: 'Guard de Modo Operacional',
    description: 'Restringe operações conforme o modo (preview, dry-run, export…).',
  },
  {
    key: 'uiLocks',
    icon: Layers,
    label: 'Travas de Itens e Camadas',
    description: 'Respeita o cadeado em itens/camadas do editor (move, edita, apaga).',
  },
];

export default function SafetyGateSettings() {
  const [cfg, setCfg] = useState<SafetyGateConfig>(() => ({ ...safetyGate.config }));

  useEffect(() => safetyGate.subscribe((c) => setCfg({ ...c })), []);

  const master = cfg.masterEnabled;

  return (
    <div className="space-y-5">
      {/* Header explicativo */}
      <div
        className="rounded-xl border p-5 space-y-3"
        style={{
          background: 'hsl(var(--surface-0))',
          borderColor: 'hsl(32 100% 50% / 0.15)',
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'hsl(32 100% 50% / 0.15)' }}
          >
            <Shield className="h-4 w-4" style={{ color: 'hsl(32 100% 50%)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-foreground">Sistema de Bloqueios</h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Por padrão, a plataforma é <strong>livre para criar</strong> — sem travas, sem
              interlocks, sem fricção. Ative os bloqueios apenas se você opera{' '}
              <strong>hardware real em show ao vivo</strong>.
            </p>
          </div>
        </div>

        {/* Master switch */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/30 bg-background/40 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Ativar bloqueios</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {master
                ? 'Modo profissional — interlocks ativos.'
                : 'Modo livre — sem travas.'}
            </p>
          </div>
          <Switch
            checked={master}
            onCheckedChange={(v) => safetyGate.setMaster(v)}
            aria-label="Master switch de bloqueios"
          />
        </div>
      </div>

      {/* Camadas individuais */}
      <div
        className={`rounded-xl border p-4 space-y-3 transition-opacity ${
          master ? 'opacity-100' : 'opacity-50 pointer-events-none'
        }`}
        style={{
          background: 'hsl(var(--surface-0))',
          borderColor: 'hsl(32 100% 50% / 0.08)',
        }}
      >
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Camadas Avançadas
          </p>
          {!master && (
            <span className="text-[10px] text-muted-foreground/60 font-mono">
              · ative o master para configurar
            </span>
          )}
        </div>

        <div className="space-y-2">
          {LAYER_INFO.map(({ key, icon: Icon, label, description }) => (
            <div
              key={key}
              className="flex items-start gap-3 rounded-lg border border-border/20 bg-background/30 px-3 py-2.5"
            >
              <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                  {description}
                </p>
              </div>
              <Switch
                checked={!!cfg[key]}
                disabled={!master}
                onCheckedChange={(v) => safetyGate.setLayer(key, v)}
                aria-label={`Ativar ${label}`}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => safetyGate.enableAll()}
            disabled={!master}
            className="flex-1 text-[11px] font-mono uppercase tracking-wider py-2 rounded-md border border-border/40 hover:bg-muted/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Ativar todas
          </button>
          <button
            type="button"
            onClick={() => safetyGate.disableAll()}
            className="flex-1 text-[11px] font-mono uppercase tracking-wider py-2 rounded-md border border-border/40 hover:bg-muted/40 transition-colors"
          >
            Modo livre
          </button>
        </div>
      </div>

      {/* Nota de auditoria */}
      <div className="flex items-start gap-2 px-1 text-[10px] text-muted-foreground/70 leading-relaxed">
        <Info className="h-3 w-3 mt-0.5 shrink-0" />
        <p>
          Todas as ações continuam registradas no audit trail e black-box recorder,
          independentemente desta configuração — para integridade de auditoria.
        </p>
      </div>
    </div>
  );
}
