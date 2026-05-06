/**
 * TabbedDockPanel — tabbed glass island used by SkyCanvas v4.
 * Pure presentation: lazy-loads tab content, mounts in <Suspense>.
 * Never imports CommandBus/FieldBus/uiCommandGateway.fire.
 */
import { Suspense, lazy, useState, useMemo, type ComponentType, type LazyExoticComponent } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface DockTabSpec {
  value: string;
  label: string;
  /** Lazy-loaded content. Wrapped in Suspense + ScrollArea by the host. */
  load: () => Promise<{ default: ComponentType<Record<string, never>> }>;
}

interface Props {
  defaultValue: string;
  tabs: DockTabSpec[];
  /** Optional dense mode for narrow panels. */
  dense?: boolean;
  /** Optional controlled mode: when provided, parent owns the active tab. */
  value?: string;
  onValueChange?: (next: string) => void;
}

function TabSkeleton({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="w-5 h-5 border-2 border-cyan-400/60 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="ds-mono text-[10px] text-cyan-300/60 uppercase tracking-wider">Carregando {label}…</p>
      </div>
    </div>
  );
}

export default function TabbedDockPanel({ defaultValue, tabs, dense, value, onValueChange }: Props) {
  const [internal, setInternal] = useState(defaultValue);
  const isControlled = value !== undefined;
  const active = isControlled ? value : internal;
  const setActive = (next: string) => {
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
  };

  // Cache lazy components per tab so they don't reset on tab switch.
  const lazyMap = useMemo(() => {
    const map = new Map<string, LazyExoticComponent<ComponentType<Record<string, never>>>>();
    for (const t of tabs) map.set(t.value, lazy(t.load));
    return map;
  }, [tabs]);

  return (
    <div className="glass-pane glass-pane-strong rounded-2xl mx-1.5 my-1.5 h-[calc(100%-12px)] overflow-hidden flex flex-col min-h-0">
      <Tabs value={active} onValueChange={setActive} className="flex h-full flex-col min-h-0">
        <TabsList
          className={`mx-2 mt-2 grid bg-transparent border border-white/[0.08] rounded-lg backdrop-blur-sm`}
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className={[
                dense ? 'text-[10px] px-1' : 'text-[11px]',
                'data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-100',
                'data-[state=active]:shadow-[inset_0_-2px_0_0_hsl(189_94%_55%/0.6)]',
                'transition-colors duration-200',
              ].join(' ')}
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((t) => {
          const Comp = lazyMap.get(t.value)!;
          return (
            <TabsContent
              key={t.value}
              value={t.value}
              className="flex-1 min-h-0 mt-2 outline-none"
            >
              <ScrollArea className="h-full px-2 pb-3">
                <Suspense fallback={<TabSkeleton label={t.label} />}>
                  {active === t.value ? <Comp /> : null}
                </Suspense>
              </ScrollArea>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
