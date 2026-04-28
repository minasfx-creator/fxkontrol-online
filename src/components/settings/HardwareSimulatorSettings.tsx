/**
 * HardwareSimulatorSettings — Painel informativo do estado do simulador.
 * Flag `dev_hardware_simulator` controla TODA geração sintética.
 */

import { Cpu, Info } from 'lucide-react';
import { isHardwareSimulatorEnabled } from '@/lib/featureFlags';

export default function HardwareSimulatorSettings() {
  const simOn = isHardwareSimulatorEnabled();

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-center gap-3">
        <Cpu className="w-5 h-5 text-cyan-500" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">Simulador de Hardware</h2>
          <p className="text-xs text-muted-foreground">
            Estado:{' '}
            <span className={simOn ? 'text-amber-500 font-mono' : 'text-emerald-500 font-mono'}>
              {simOn ? 'LIGADO (dev mode)' : 'DESLIGADO · Detecção real apenas'}
            </span>
          </p>
        </div>
      </header>

      <div className="rounded-md border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-cyan-500 mt-0.5 shrink-0" />
          <div className="text-sm text-foreground/90 space-y-2">
            <p>
              Toda geração de dados sintéticos (Math.random nos adapters, continuidade
              falsa, FireOne emulator, MA3 simulateInput) está gateada pela flag{' '}
              <code className="text-foreground/70">dev_hardware_simulator</code>.
            </p>
            <p className="text-xs text-muted-foreground">
              Com a flag <strong>OFF</strong> (padrão), os adapters permanecem
              "frios" (0Hz, 0V, UNKNOWN) até que hardware real responda via
              Web Serial / WebUSB / WebBLE / Art-Net discovery.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
        <p className="font-mono">
          Reativação para dev/testes:
          <br />
          <code className="text-foreground/70">
            src/lib/featureFlags.ts → dev_hardware_simulator: true
          </code>
        </p>
      </div>
    </div>
  );
}
