import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Minimize2, Send, Zap, ShieldCheck, Activity, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

type Msg = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fxk-ai-chat`;

const PRESETS = [
  { label: 'DIAGNÓSTICO', icon: Activity, prompt: 'Execute um diagnóstico completo do sistema FXK — módulos, DMX, canais ativos, status de segurança.' },
  { label: 'SCRIPT', icon: Terminal, prompt: 'Preciso de ajuda criando um script de show pirotécnico.' },
  { label: 'SAFETY', icon: ShieldCheck, prompt: 'Quais são os protocolos de segurança NFPA que devo seguir para este show?' },
  { label: 'STATUS', icon: Zap, prompt: 'Qual o status atual do show — timeline, posições configuradas e módulos online?' },
];

async function streamChat(
  messages: Msg[],
  onDelta: (t: string) => void,
  onDone: () => void,
  signal?: AbortSignal,
) {
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Erro de conexão' }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }

  if (!resp.body) throw new Error('No stream body');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buf.indexOf('\n')) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (json === '[DONE]') { onDone(); return; }
      try {
        const p = JSON.parse(json);
        const c = p.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch { /* partial */ }
    }
  }
  onDone();
}

export function FXKAssistant() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    let soFar = '';
    const upsert = (chunk: string) => {
      soFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: soFar } : m);
        }
        return [...prev, { role: 'assistant', content: soFar }];
      });
    };

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      await streamChat([...messages, userMsg], upsert, () => setLoading(false), ctrl.signal);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠ ${e.message}` }]);
      }
      setLoading(false);
    }
  }, [messages, loading]);

  // Bubble
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 fxk-bubble touch-target-lg"
        style={{
          background: 'radial-gradient(circle at 30% 30%, hsl(32 100% 55%), hsl(32 100% 40%))',
          boxShadow: '0 0 30px hsl(32 100% 50% / 0.4), 0 0 60px hsl(32 100% 50% / 0.15), inset 0 1px 0 hsl(32 100% 70% / 0.3)',
        }}
      >
        <Terminal className="h-6 w-6 text-black" />
        <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full animate-amber-pulse" style={{ background: 'hsl(32 100% 50%)' }} />
      </button>
    );
  }

  // Minimized bar
  if (minimized) {
    return (
      <div
        onClick={() => setMinimized(false)}
        className="fixed bottom-5 right-5 z-50 w-56 cursor-pointer rounded-lg border px-3 py-2 flex items-center gap-2"
        style={{
          background: 'hsl(220 22% 5% / 0.92)',
          borderColor: 'hsl(32 100% 50% / 0.3)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <span className="h-2 w-2 rounded-full animate-amber-pulse" style={{ background: 'hsl(32 100% 50%)' }} />
        <span className="text-[10px] font-mono tracking-[0.2em] uppercase" style={{ color: 'hsl(32 100% 60%)' }}>
          FXK-AI · NEXUS
        </span>
      </div>
    );
  }

  // Full panel
  return (
    <div
      className="fixed bottom-5 right-5 z-50 w-[340px] h-[520px] rounded-xl flex flex-col overflow-hidden fxk-panel"
      style={{
        background: 'hsl(220 22% 4% / 0.95)',
        border: '1px solid hsl(32 100% 50% / 0.2)',
        boxShadow: '0 0 40px hsl(32 100% 50% / 0.1), 0 20px 60px hsl(0 0% 0% / 0.6)',
        backdropFilter: 'blur(24px)',
      }}
    >
      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none animate-holographic-scan rounded-xl" style={{ zIndex: 1 }} />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-2 px-3 py-2.5 shrink-0" style={{ borderBottom: '1px solid hsl(32 100% 50% / 0.15)' }}>
        <span className="h-2 w-2 rounded-full animate-amber-pulse" style={{ background: 'hsl(32 100% 50%)' }} />
        <span className="text-[10px] font-mono font-bold tracking-[0.25em] uppercase flex-1" style={{ color: 'hsl(32 100% 60%)' }}>
          FXK-AI · NEXUS
        </span>
        <button onClick={() => setMinimized(true)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/5 transition-colors">
          <Minimize2 className="h-3 w-3" style={{ color: 'hsl(32 100% 50% / 0.6)' }} />
        </button>
        <button onClick={() => setOpen(false)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/5 transition-colors">
          <X className="h-3 w-3" style={{ color: 'hsl(32 100% 50% / 0.6)' }} />
        </button>
      </div>

      {/* Messages */}
      <div className="relative z-10 flex-1 overflow-y-auto px-3 py-2 space-y-3 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 opacity-80">
            <Terminal className="h-8 w-8" style={{ color: 'hsl(32 100% 50% / 0.4)' }} />
            <p className="text-[9px] font-mono tracking-[0.15em] uppercase text-center" style={{ color: 'hsl(32 100% 50% / 0.5)' }}>
              NEXUS ONLINE · AWAITING INPUT
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center px-2">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => send(p.prompt)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded text-[8px] font-mono tracking-wider uppercase transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: 'hsl(32 100% 50% / 0.08)',
                    border: '1px solid hsl(32 100% 50% / 0.2)',
                    color: 'hsl(32 100% 60%)',
                  }}
                >
                  <p.icon className="h-3 w-3" />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn('max-w-[88%] animate-fade-in', msg.role === 'user' ? 'ml-auto' : '')}
          >
            {msg.role === 'user' ? (
              <div
                className="px-3 py-2 rounded-lg rounded-br-sm text-[11px] font-mono leading-relaxed"
                style={{
                  background: 'hsl(32 100% 50% / 0.12)',
                  border: '1px solid hsl(32 100% 50% / 0.2)',
                  color: 'hsl(32 100% 80%)',
                }}
              >
                {msg.content}
              </div>
            ) : (
              <div
                className="px-3 py-2 rounded-lg rounded-bl-sm text-[11px] leading-relaxed"
                style={{
                  borderLeft: '2px solid hsl(32 100% 50% / 0.4)',
                  background: 'hsl(220 20% 6% / 0.6)',
                  color: 'hsl(180 8% 82%)',
                }}
              >
                <div className="prose prose-invert prose-xs max-w-none [&_p]:my-1 [&_code]:text-[hsl(32_100%_65%)] [&_code]:bg-transparent [&_pre]:bg-[hsl(220_20%_8%)] [&_pre]:border [&_pre]:border-[hsl(32_100%_50%/0.1)] [&_strong]:text-[hsl(32_100%_70%)] [&_a]:text-[hsl(32_100%_60%)]">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex items-center gap-2 py-1 animate-fade-in">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full animate-bounce"
                  style={{
                    background: 'hsl(32 100% 50%)',
                    animationDelay: `${i * 150}ms`,
                  }}
                />
              ))}
            </div>
            <span className="text-[8px] font-mono tracking-widest uppercase" style={{ color: 'hsl(32 100% 50% / 0.6)' }}>
              PROCESSANDO
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick presets (visible when conversation active) */}
      {messages.length > 0 && (
        <div className="relative z-10 flex gap-1 px-3 py-1.5 overflow-x-auto shrink-0" style={{ borderTop: '1px solid hsl(32 100% 50% / 0.08)' }}>
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => send(p.prompt)}
              disabled={loading}
              className="shrink-0 px-2 py-1 rounded text-[7px] font-mono tracking-wider uppercase transition-colors disabled:opacity-30"
              style={{
                background: 'hsl(32 100% 50% / 0.06)',
                border: '1px solid hsl(32 100% 50% / 0.12)',
                color: 'hsl(32 100% 55%)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative z-10 p-2 shrink-0" style={{ borderTop: '1px solid hsl(32 100% 50% / 0.12)' }}>
        <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ background: 'hsl(220 20% 6%)', border: '1px solid hsl(32 100% 50% / 0.15)' }}>
          <span className="text-[10px] font-mono shrink-0" style={{ color: 'hsl(32 100% 50% / 0.5)' }}>&gt;_</span>
          <input
            className="flex-1 bg-transparent border-none outline-none text-[11px] font-mono placeholder:text-[hsl(32_100%_50%/0.25)]"
            style={{ color: 'hsl(32 100% 75%)', caretColor: 'hsl(32 100% 50%)' }}
            placeholder="Comando..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
            disabled={loading}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="h-7 w-7 rounded flex items-center justify-center transition-all disabled:opacity-20 hover:scale-110 active:scale-90"
            style={{ background: input.trim() ? 'hsl(32 100% 50% / 0.2)' : 'transparent' }}
          >
            <Send className="h-3.5 w-3.5" style={{ color: 'hsl(32 100% 55%)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
