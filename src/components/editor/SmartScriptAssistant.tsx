/**
 * SmartScriptAssistant — AI-powered show scripting assistant (JOI)
 * Natural language commands → auto-generates timeline items, batch edits, and VDL effects.
 * Activated via Ctrl+Shift+A or toolbar button.
 *
 * UX:
 * - Mobile-first: 44px close target, swipe-down-to-close
 * - Desktop: compact 340px panel anchored bottom-right
 * - ESC key closes
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Loader2, Wand2 } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: { label: string; count: number }[];
}

const EXAMPLE_PROMPTS = [
  'Add 20 gold willows across positions POS-001 to POS-020, staggered 200ms apart',
  'Replace all red peony shells with blue ones',
  'Create a crescendo finale: 3" shells every 2s, escalate to 6" every 0.5s over 30s',
];

// Swipe-to-close threshold (px)
const SWIPE_CLOSE_THRESHOLD = 80;

export default function SmartScriptAssistant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragY, setDragY] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);

  // Focus input on open
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Reset drag offset when panel closes (single source of truth alongside touchEnd)
  useEffect(() => {
    if (!open && dragY !== 0) setDragY(0);
  }, [open, dragY]);

  const processCommand = useCallback(async (command: string) => {
    const userMsg: AssistantMessage = { id: `u-${Date.now()}`, role: 'user', content: command };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const store = useProjectStore.getState();
      const context = {
        positions: store.positions.map(p => ({ id: p.id, name: p.name, type: p.type, section: p.section, x: p.x, z: p.z })),
        timelineItemCount: store.timelineItems.length,
        currentTime: store.currentTime,
        duration: store.duration,
        effectLibrary: EFFECT_LIBRARY.slice(0, 30).map(e => ({ id: e.id, name: e.name, type: e.type, caliber: e.caliber, category: e.category })),
      };

      const { data, error } = await supabase.functions.invoke('smart-script', {
        body: { command, context },
      });

      if (error) throw error;

      const result = data;
      let responseText = result?.message || 'Command processed.';
      const actions: { label: string; count: number }[] = [];

      // Execute actions from AI
      if (result?.actions && Array.isArray(result.actions)) {
        for (const action of result.actions) {
          if (action.type === 'add_timeline_item') {
            const effect = EFFECT_LIBRARY.find(e => e.id === action.effectId || e.name.toLowerCase().includes((action.effectName || '').toLowerCase()));
            if (effect) {
              const pos = store.positions.find(p => p.name === action.positionName || p.id === action.positionId);
              store.addTimelineItem({
                id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                effectId: effect.id,
                startTime: action.startTime || store.currentTime,
                trackIndex: effect.type === 'firework' ? 0 : 1,
                position: pos ? { x: pos.x, y: pos.y, z: pos.z } : { x: 0, y: 0, z: 0 },
                positionId: pos?.id,
                positionName: pos?.name,
              });
              actions.push({ label: `Added ${effect.name}`, count: 1 });
            }
          }
        }
      }

      // Fallback: local pattern matching for common commands
      if (actions.length === 0) {
        const lc = command.toLowerCase();

        // "add N [effect] across positions"
        const addMatch = lc.match(/add\s+(\d+)\s+(.+?)\s+(?:across|to|at)\s+(.+?)(?:\s+staggered?\s+(\d+)\s*ms)?/i);
        if (addMatch) {
          const count = parseInt(addMatch[1]);
          const effectName = addMatch[2];
          const stagger = addMatch[4] ? parseInt(addMatch[4]) / 1000 : 0.2;
          const effect = EFFECT_LIBRARY.find(e => e.name.toLowerCase().includes(effectName.toLowerCase()));

          if (effect) {
            const targetPositions = store.positions.slice(0, count);
            targetPositions.forEach((pos, i) => {
              store.addTimelineItem({
                id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${i}`,
                effectId: effect.id,
                startTime: store.currentTime + i * stagger,
                trackIndex: effect.type === 'firework' ? 0 : 1,
                position: { x: pos.x, y: pos.y, z: pos.z },
                positionId: pos.id,
                positionName: pos.name,
              });
            });
            responseText = `✅ Added ${targetPositions.length} × "${effect.name}" staggered ${stagger * 1000}ms apart`;
            actions.push({ label: effect.name, count: targetPositions.length });
          } else {
            responseText = `⚠️ Could not find effect "${effectName}" in library. Try using the exact name.`;
          }
        }

        // "replace all X with Y"
        const replaceMatch = lc.match(/replace\s+all\s+(.+?)\s+with\s+(.+)/i);
        if (replaceMatch) {
          const fromName = replaceMatch[1];
          const toName = replaceMatch[2];
          const fromEffect = EFFECT_LIBRARY.find(e => e.name.toLowerCase().includes(fromName.toLowerCase()));
          const toEffect = EFFECT_LIBRARY.find(e => e.name.toLowerCase().includes(toName.toLowerCase()));

          if (fromEffect && toEffect) {
            let replaced = 0;
            store.timelineItems.forEach(item => {
              if (item.effectId === fromEffect.id) {
                store.updateTimelineItem(item.id, { effectId: toEffect.id });
                replaced++;
              }
            });
            responseText = `✅ Replaced ${replaced} × "${fromEffect.name}" → "${toEffect.name}"`;
            actions.push({ label: `Replaced`, count: replaced });
          } else {
            responseText = `⚠️ Could not find effects: "${fromName}" or "${toName}"`;
          }
        }
      }

      const assistantMsg: AssistantMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: responseText,
        actions: actions.length > 0 ? actions : undefined,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      // Local-only fallback when edge function unavailable
      const lc = command.toLowerCase();
      const store = useProjectStore.getState();
      let responseText = `Processing locally... ${command}`;
      let localActions: { label: string; count: number }[] | undefined;

      if (lc.includes('add') && lc.includes('mine')) {
        const sectionMatch = lc.match(/section\s+([a-f])/i);
        const timeMatch = lc.match(/(?:at|time)\s+(\d+(?:\.\d+)?)\s*s/);
        const section = sectionMatch?.[1]?.toUpperCase();
        const time = timeMatch ? parseFloat(timeMatch[1]) : store.currentTime;
        const mineEffect = EFFECT_LIBRARY.find(e => e.partType === 'mine');

        if (mineEffect) {
          const targets = section
            ? store.positions.filter(p => p.section === section)
            : store.positions.filter(p => p.type === 'pyro');

          targets.forEach((pos, i) => {
            store.addTimelineItem({
              id: `ai-${Date.now()}-${i}`,
              effectId: mineEffect.id,
              startTime: time,
              trackIndex: 0,
              position: { x: pos.x, y: pos.y, z: pos.z },
              positionId: pos.id,
              positionName: pos.name,
            });
          });
          toast.success(`${targets.length} mines added`);
          responseText = `✅ Added ${targets.length} mines${section ? ` to Section ${section}` : ''} at ${time.toFixed(1)}s`;
          localActions = [{ label: mineEffect.name, count: targets.length }];
        }
      }

      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: responseText,
        actions: localActions,
      }]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    processCommand(input.trim());
  };

  // Swipe-down-to-close (touch only — vertical drag from header)
  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) setDragY(dy);
  };
  const handleTouchEnd = () => {
    if (dragY > SWIPE_CLOSE_THRESHOLD) onClose();
    if (dragY !== 0) setDragY(0);
    dragStartY.current = null;
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Smart Script Assistant"
      className="fixed bottom-20 right-3 z-50 w-[340px] max-w-[calc(100vw-1.5rem)] max-h-[460px] flex flex-col rounded-2xl border border-border/30 shadow-2xl shadow-black/60 overflow-hidden transition-transform"
      style={{
        background: 'hsl(var(--card))',
        transform: `translateY(${dragY}px)`,
        transition: dragY === 0 ? 'transform 200ms ease-out' : 'none',
      }}
    >
      {/* Header — also doubles as swipe handle on touch */}
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b border-border/20 select-none touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Mobile drag indicator */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-border/40 sm:hidden" />

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary/20 to-accent/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[11px] font-bold text-foreground uppercase tracking-wider font-display truncate">JOI · Smart Script</h3>
            <p className="text-[8px] text-muted-foreground/60 truncate">AI-powered show design</p>
          </div>
        </div>

        {/* Close — 44x44 touch target, native button (no nesting issues) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close assistant"
          className="relative -mr-1.5 flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 active:bg-accent/20 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[180px] max-h-[280px]">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground/60 text-center">Try a command:</p>
            {EXAMPLE_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                className="w-full text-left px-3 py-2 rounded-xl bg-surface-0/50 border border-border/10 text-[10px] text-muted-foreground hover:text-foreground hover:border-border/30 active:bg-surface-0 transition-all"
              >
                <Wand2 className="w-3 h-3 inline mr-1.5 text-primary/50" />
                {prompt}
              </button>
            ))}
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] rounded-2xl px-3 py-2 text-[11px]",
              msg.role === 'user'
                ? "bg-primary/15 text-foreground rounded-br-md"
                : "bg-surface-0 border border-border/15 text-foreground rounded-bl-md"
            )}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.actions && msg.actions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {msg.actions.map((a, i) => (
                    <span key={i} className="text-[8px] px-1.5 py-0.5 rounded-full bg-success/15 text-success font-semibold">
                      {a.label} ×{a.count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-0 border border-border/15 rounded-2xl rounded-bl-md px-3 py-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-3 py-2 border-t border-border/20 flex items-center gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Describe what to create..."
          className="flex-1 h-9 px-3 rounded-xl text-[11px] bg-surface-0 border border-border/20 text-foreground outline-none focus:border-primary/40 transition-colors"
          disabled={loading}
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={loading || !input.trim()}
          className="flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
