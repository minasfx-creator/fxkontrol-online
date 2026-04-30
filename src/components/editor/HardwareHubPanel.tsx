/**
 * HardwareHubPanel — Façade unificada (Phase 3 fusion).
 *
 * Conserva os 4 painéis de hardware existentes (Easy Connect / USB /
 * Connection Manager / Quick Hardware) como abas internas de um único
 * ponto de entrada. NÃO altera lógica de pareamento, Hold-to-Confirm,
 * BLE FXK16 nem fluxos iPhone — apenas reduz a fragmentação de UI.
 *
 * Abas inicialmente carregadas via React.lazy (preserva code-splitting
 * dos painéis pesados, principalmente USBConnectionPanel ≈ 800 LOC).
 */
import { lazy, Suspense, useState, useMemo } from 'react';
import { Cable, Usb, Network, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const EasyConnectPanel       = lazy(() => import('./EasyConnectPanel'));
const USBConnectionPanel     = lazy(() => import('./USBConnectionPanel'));
const ConnectionManagerPanel = lazy(() => import('./ConnectionManagerPanel'));
const QuickHardwarePanel     = lazy(() => import('./QuickHardwarePanel'));

export type HardwareHubTab = 'easy' | 'usb' | 'connections' | 'quick';

interface HardwareHubPanelProps {
  onClose: () => void;
  initialTab?: HardwareHubTab;
  fs?: boolean;
}

const TABS: { key: HardwareHubTab; label: string; sub: string; icon: typeof Cable }[] = [
  { key: 'easy',        label: 'EASY',     sub: 'AUTO',     icon: Zap },
  { key: 'usb',         label: 'USB',      sub: 'SERIAL',   icon: Usb },
  { key: 'connections', label: 'MANAGER',  sub: 'BRIDGES',  icon: Network },
  { key: 'quick',       label: 'QUICK',    sub: 'FX',       icon: Cable },
];

export default function HardwareHubPanel({ onClose, initialTab = 'easy', fs = false }: HardwareHubPanelProps) {
  const [tab, setTab] = useState<HardwareHubTab>(initialTab);

  const content = useMemo(() => {
    switch (tab) {
      case 'easy':        return <EasyConnectPanel onClose={onClose} />;
      case 'usb':         return <USBConnectionPanel onClose={onClose} />;
      case 'connections': return <ConnectionManagerPanel onClose={onClose} fs={fs} />;
      case 'quick':       return <QuickHardwarePanel open onClose={onClose} fs={fs} />;
    }
  }, [tab, onClose, fs]);

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background">
      <div
        className="shrink-0 flex border-b sticky top-0 z-20 backdrop-blur-md"
        style={{ background: 'hsl(220 12% 5% / 0.92)', borderColor: 'hsl(180 100% 50% / 0.12)' }}
      >
        {TABS.map(t => {
          const isActive = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all relative',
                'text-[10px] font-mono font-bold tracking-[0.18em] uppercase',
                isActive ? 'text-primary' : 'text-muted-foreground/45 hover:text-muted-foreground/70'
              )}
              aria-pressed={isActive}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </div>
              <span className="text-[7px] tracking-[0.25em] opacity-60">{t.sub}</span>
              {isActive && (
                <div
                  className="absolute bottom-0 left-[15%] right-[15%] h-[2px]"
                  style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.6), transparent)' }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0">
        <Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          {content}
        </Suspense>
      </div>
    </div>
  );
}
