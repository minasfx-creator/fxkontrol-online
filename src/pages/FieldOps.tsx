/**
 * FieldOpsPage — Unified field operations console.
 *
 * Replaces the previously separate /pairing, /field-test and (panel-only)
 * Mobile Link experiences. Three tabs in one page:
 *   • Pairing     — NFC/BLE FXK-M1 tap-to-pair
 *   • Field Test  — Wi-Fi/BLE/WAN transport diagnostics
 *   • Mobile Link — Phone↔Desktop Art-Net/Relay bridge
 *
 * Old routes /pairing and /field-test redirect here for back-compat.
 */
import { lazy, Suspense, useState } from 'react';
import { Nfc, Activity, Smartphone, Cable } from 'lucide-react';
import { cn } from '@/lib/utils';

const DevicePairing = lazy(() => import('./DevicePairing'));
const FieldTest = lazy(() => import('./FieldTest'));
const MobileLinkPanel = lazy(() => import('@/components/editor/MobileLinkPanel'));
const FXK16FieldPanel = lazy(() => import('@/components/field/FXK16FieldPanel'));

type TabKey = 'pairing' | 'fxk16' | 'field-test' | 'mobile-link';

const TABS: { key: TabKey; label: string; sub: string; icon: typeof Nfc }[] = [
  { key: 'pairing',     label: 'PAIRING',     sub: 'NFC · BLE',      icon: Nfc },
  { key: 'fxk16',       label: 'FXK16',       sub: 'PYRO RELAY',     icon: Cable },
  { key: 'field-test',  label: 'FIELD TEST',  sub: 'TRANSPORTS',     icon: Activity },
  { key: 'mobile-link', label: 'MOBILE LINK', sub: 'PHONE · BRIDGE', icon: Smartphone },
];

export default function FieldOpsPage() {
  const [tab, setTab] = useState<TabKey>(() => {
    if (typeof window === 'undefined') return 'pairing';
    const hash = window.location.hash.replace('#', '') as TabKey;
    return TABS.some(t => t.key === hash) ? hash : 'pairing';
  });

  const setTabAndHash = (k: TabKey) => {
    setTab(k);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${k}`);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col">
      {/* Tab Header */}
      <div
        className="shrink-0 flex border-b sticky top-0 z-20 backdrop-blur-md"
        style={{
          background: 'hsl(var(--field-bg, 220 30% 4%) / 0.92)',
          borderColor: 'hsl(var(--field-cyan, 190 70% 58%) / 0.18)',
        }}
      >
        {TABS.map(t => {
          const isActive = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTabAndHash(t.key)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all relative',
                'text-[10px] font-mono font-bold tracking-[0.18em] uppercase',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--field-cyan,190_70%_58%)/0.6)]',
                isActive
                  ? 'text-[hsl(var(--field-cyan,190_70%_58%))]'
                  : 'text-muted-foreground/55 hover:text-muted-foreground/85'
              )}
              aria-pressed={isActive}
              aria-label={`${t.label} — ${t.sub}`}
            >
              <div className="flex items-center gap-1.5">
                <Icon
                  className={cn(
                    'w-3.5 h-3.5',
                    isActive && 'drop-shadow-[0_0_4px_hsl(var(--field-cyan,190_70%_58%)/0.55)]'
                  )}
                />
                <span>{t.label}</span>
              </div>
              <span className="text-[7px] tracking-[0.25em] opacity-60">{t.sub}</span>
              {isActive && (
                <div
                  className="absolute bottom-0 left-[15%] right-[15%] h-[2px]"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, hsl(var(--field-cyan, 190 70% 58%) / 0.7), transparent)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        <Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          {tab === 'pairing'     && <DevicePairing />}
          {tab === 'fxk16'       && <FXK16FieldPanel />}
          {tab === 'field-test'  && <FieldTest />}
          {tab === 'mobile-link' && <MobileLinkPanel onClose={() => setTabAndHash('pairing')} />}
        </Suspense>
      </div>
    </div>
  );
}
