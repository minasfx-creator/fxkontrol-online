/**
 * SmartScriptAssistant — AI-powered show scripting assistant
 * Natural language commands → auto-generates timeline items, batch edits, and VDL effects.
 * Activated via Ctrl+Shift+A or toolbar button.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Loader2, Wand2, Zap, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
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
  'Create a crescendo finale: start with 3" shells every 2s, escalate to 6" every 0.5s over 30 seconds',
  'Fill the gap between 45s and 60s with alternating silver and gold effects',
  'Add mines to all positions in Section A at time 30s',
];

export default function SmartScriptAssistant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

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
      const assistantMsg: AssistantMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: `Processing locally... ${command}`,
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Attempt local processing
      const lc = command.toLowerCase();
      const store = useProjectStore.getState();

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
          setMessages(prev => [...prev.slice(0, -1), {
            ...prev[prev.length - 1],
            content: `✅ Added ${targets.length} mines${section ? ` to Section ${section}` : ''} at ${time.toFixed(1)}s`,
            actions: [{ label: mineEffect.name, count: targets.length }],
          }]);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    processCommand(input.trim());
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 w-[380px] max-h-[500px] flex flex-col rounded-2xl border border-border/30 shadow-2xl shadow-black/60 overflow-hidden" style={{ background: 'hsl(var(--card))' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary/20 to-accent/15 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-[11px] font-bold text-foreground uppercase tracking-wider font-display">Smart Script</h3>
            <p className="text-[8px] text-muted-foreground/50">AI-powered show design</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[320px]">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground/60 text-center">Try a command:</p>
            {EXAMPLE_PROMPTS.slice(0, 3).map((prompt, i) => (
              <button
                key={i}
                onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                className="w-full text-left px-3 py-2 rounded-xl bg-surface-0/50 border border-border/10 text-[10px] text-muted-foreground hover:text-foreground hover:border-border/30 transition-all"
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
          className="flex-1 h-8 px-3 rounded-xl text-[11px] bg-surface-0 border border-border/20 text-foreground outline-none focus:border-primary/40 transition-colors"
          disabled={loading}
        />
        <Button type="submit" size="icon" className="h-8 w-8 rounded-xl" disabled={loading || !input.trim()}>
          <Send className="w-3.5 h-3.5" />
        </Button>
      </form>
    </div>
  );
}
