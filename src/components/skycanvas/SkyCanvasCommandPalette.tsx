/**
 * SkyCanvasCommandPalette — Master Menu palette (cmdk inside Radix Dialog).
 *
 * SAFETY GUARD: rejects registration of any SkyAction whose `safety` is not
 * 'inert'. Defense in depth — the dispatch path for real-operation commands
 * lives in /command via uiCommandGateway, never here.
 */
import * as React from 'react';
import { Command as CommandIcon } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { cn } from '@/lib/utils';
import type { SkyAction } from './skyActions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: SkyAction[];
}

export default function SkyCanvasCommandPalette({ open, onOpenChange, actions }: Props) {
  // Defense-in-depth: drop anything not 'inert' before render.
  const safeActions = React.useMemo(() => actions.filter((a) => a.safety === 'inert'), [actions]);

  const groups = React.useMemo(() => {
    const m = new Map<string, SkyAction[]>();
    for (const a of safeActions) {
      const arr = m.get(a.group) ?? [];
      arr.push(a);
      m.set(a.group, arr);
    }
    return Array.from(m.entries());
  }, [safeActions]);

  const run = React.useCallback(async (a: SkyAction) => {
    onOpenChange(false);
    try { await a.run(); } catch (err) { console.error('[SkyAction]', a.id, err); }
  }, [onOpenChange]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-[60] bg-[hsl(220_60%_2%/0.6)] backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        />
        <DialogPrimitive.Content
          aria-label="Master Menu"
          className={cn(
            'fixed left-1/2 top-[20%] z-[60] w-[min(92vw,640px)] -translate-x-1/2',
            'glass-pane glass-pane-strong rounded-2xl overflow-hidden',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          <DialogPrimitive.Title className="sr-only">Master Menu — SkyCanvas</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Lista de comandos de edição inertes do SkyCanvas. Comandos de operação real
            permanecem exclusivos do Centro de Comando.
          </DialogPrimitive.Description>
          <Command className="flex flex-col" loop>
            <div className="flex items-center gap-2 px-4 h-12 border-b border-white/[0.06]">
              <CommandIcon className="h-4 w-4 text-cyan-300/80 shrink-0" aria-hidden />
              <Command.Input
                autoFocus
                placeholder="Buscar comando…"
                className={cn(
                  'flex-1 bg-transparent outline-none border-0 text-zinc-100 placeholder:text-zinc-500',
                  'text-[14px]',
                )}
              />
              <kbd className="ds-mono text-[10px] text-zinc-500 border border-white/10 rounded px-1.5 py-0.5">ESC</kbd>
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-6 text-center text-[12px] text-zinc-500">
                Nenhum comando encontrado.
              </Command.Empty>
              {groups.map(([group, items]) => (
                <Command.Group
                  key={group}
                  heading={group}
                  className="ds-mono text-[10px] tracking-wider uppercase text-cyan-300/60 px-2 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1"
                >
                  {items.map((a) => (
                    <Command.Item
                      key={a.id}
                      value={`${a.group} ${a.label} ${a.id}`}
                      onSelect={() => run(a)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer',
                        'text-[13px] text-zinc-200',
                        'data-[selected=true]:bg-cyan-500/10 data-[selected=true]:ring-1 data-[selected=true]:ring-inset data-[selected=true]:ring-cyan-400/40 data-[selected=true]:text-cyan-100',
                        'transition-colors duration-150',
                      )}
                    >
                      <span className="flex-1 truncate">{a.label}</span>
                      {a.hint && <span className="text-[11px] text-zinc-500 truncate hidden sm:inline">{a.hint}</span>}
                      {a.kbd && (
                        <kbd className="ds-mono text-[10px] text-zinc-400 border border-white/10 rounded px-1.5 py-0.5 shrink-0">
                          {a.kbd}
                        </kbd>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
            <footer className="flex items-center justify-between px-3 h-9 border-t border-white/[0.06] text-[10px] ds-mono text-zinc-500">
              <span>SIM · ADVISORY · zero hardware dispatch</span>
              <span className="hidden sm:inline">↑↓ navega · ↵ executa</span>
            </footer>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
