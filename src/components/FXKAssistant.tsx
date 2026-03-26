/**
 * FXKAssistant — "Joi" BR2049 Holographic AI Assistant
 * Docked panel with voice wave avatar, materializing text, dissolve animations
 * Enhanced: textarea, session history, feedback, expand, timestamps, clear, context presets
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import JoiHologramAvatar from '@/components/JoiHologramAvatar';
import { X, Minimize2, Send, Zap, ShieldCheck, Activity, Sparkles, Maximize2, Trash2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { useIsMobile } from '@/hooks/use-mobile';

type Msg = { role: 'user' | 'assistant'; content: string; ts?: number; feedback?: 'up' | 'down' };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fxk-ai-chat`;
const HISTORY_KEY = 'fxk-ai-history';
const MAX_HISTORY = 10;

const PRESETS_COMMAND = [
  { label: 'DIAGNÓSTICO', icon: Activity, prompt: 'Execute um diagnóstico completo do sistema FXK — módulos, DMX, canais ativos, status de segurança.' },
  { label: 'SCRIPT', icon: Sparkles, prompt: 'Preciso de ajuda criando um script de show pirotécnico.' },
  { label: 'SAFETY', icon: ShieldCheck, prompt: 'Quais são os protocolos de segurança NFPA que devo seguir para este show?' },
  { label: 'STATUS', icon: Zap, prompt: 'Qual o status atual do show — timeline, posições configuradas e módulos online?' },
];

const PRESETS_EDITOR = [
  { label: 'DESIGN', icon: Zap, prompt: 'Me ajude a criar um design de show com efeitos visuais impressionantes.' },
  { label: 'TIMELINE', icon: Activity, prompt: 'Preciso organizar a timeline do show com transições suaves.' },
  { label: 'SAFETY', icon: ShieldCheck, prompt: 'Verifique a segurança das posições configuradas no meu show.' },
  { label: 'EXPORT', icon: Sparkles, prompt: 'Como exportar meu projeto para diferentes formatos de firing system?' },
];

function getContextPresets() {
  const path = window.location.pathname;
  if (path.includes('command')) return PRESETS_COMMAND;
  return PRESETS_EDITOR;
}

function loadHistory(): Msg[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw).slice(-MAX_HISTORY);
  } catch { return []; }
}

function saveHistory(msgs: Msg[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(msgs.slice(-MAX_HISTORY)));
  } catch {}
}

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
    body: JSON.stringify({ messages: messages.map(m => ({ role: m.role, content: m.content })) }),
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

function VoiceWave({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-[2px] h-5">
      {[0, 1, 2, 3, 4].map(i => (
        <div
          key={i}
          className={cn("w-[3px] rounded-full transition-all", active ? "animate-voice-wave" : "h-1")}
          style={{
            background: 'hsl(32 100% 55%)',
            animationDelay: active ? `${i * 80}ms` : '0ms',
            height: active ? undefined : '4px',
          }}
        />
      ))}
    </div>
  );
}

function ThinkingWave() {
  return (
    <div className="flex items-center gap-2 py-2 animate-fade-in">
      <div className="flex items-end gap-[2px] h-4">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="w-[2px] rounded-full"
            style={{
              background: `hsl(32 100% ${50 + i * 2}% / ${0.3 + Math.sin(i * 0.8) * 0.2})`,
              animation: `voice-wave 1.2s ease-in-out ${i * 60}ms infinite`,
            }}
          />
        ))}
      </div>
      <span className="text-[7px] font-mono tracking-[0.2em] uppercase" style={{ color: 'hsl(32 100% 50% / 0.5)' }}>
        PROCESSANDO
      </span>
    </div>
  );
}

function formatTime(ts?: number) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function FXKAssistant() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [closing, setClosing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => loadHistory());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAtBottom = useRef(true);

  // Check connection on mount
  useEffect(() => {
    fetch(CHAT_URL, { method: 'OPTIONS' })
      .then(() => setConnectionOk(true))
      .catch(() => setConnectionOk(false));
  }, []);

  // Smart auto-scroll: only when at bottom
  useEffect(() => {
    if (isAtBottom.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }, []);

  // Save history
  useEffect(() => {
    if (messages.length > 0) saveHistory(messages);
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 80) + 'px';
    }
  }, [input]);

  const presets = getContextPresets();

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: 'user', content: text.trim(), ts: Date.now() };
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
        return [...prev, { role: 'assistant', content: soFar, ts: Date.now() }];
      });
    };

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      await streamChat([...messages, userMsg], upsert, () => setLoading(false), ctrl.signal);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠ ${e.message}`, ts: Date.now() }]);
      }
      setLoading(false);
    }
  }, [messages, loading]);

  const handleFeedback = useCallback((idx: number, fb: 'up' | 'down') => {
    setMessages(prev => prev.map((m, i) => i === idx ? { ...m, feedback: fb } : m));
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(HISTORY_KEY);
  }, []);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 350);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }, [input, send]);

  const panelWidth = isMobile ? undefined : (expanded ? 560 : 360);

  // Bubble
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed z-[60] h-14 w-14 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 fxk-bubble touch-target-lg joi-bubble-shimmer",
          isMobile ? "bottom-20 right-3" : "bottom-5 right-5"
        )}
        style={{
          background: 'radial-gradient(circle at 30% 30%, hsl(32 100% 55%), hsl(32 100% 40%))',
          boxShadow: '0 0 30px hsl(32 100% 50% / 0.4), 0 0 60px hsl(32 100% 50% / 0.15), inset 0 1px 0 hsl(32 100% 70% / 0.3)',
          willChange: 'transform',
        }}
      >
        <Sparkles className="h-6 w-6 text-black" />
        <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full animate-amber-pulse" style={{ background: 'hsl(32 100% 50%)' }} />
      </button>
    );
  }

  // Minimized bar
  if (minimized) {
    return (
      <div
        onClick={() => setMinimized(false)}
        className={cn(
          "fixed z-[60] w-56 cursor-pointer rounded-lg border px-3 py-2 flex items-center gap-2",
          isMobile ? "bottom-20 right-3" : "bottom-5 right-5"
        )}
        style={{
          background: 'hsl(220 22% 5% / 0.92)',
          borderColor: 'hsl(32 100% 50% / 0.3)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <VoiceWave active={loading} />
        <span className="text-[10px] font-mono tracking-[0.2em] uppercase" style={{ color: 'hsl(32 100% 60%)' }}>
          JOI · NEXUS
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-[60] rounded-xl flex flex-col overflow-hidden fxk-panel transition-all duration-300",
        closing ? "animate-holo-dissolve" : "animate-holo-materialize",
        isMobile ? "inset-3 bottom-20" : "bottom-5 right-5 h-[560px]"
      )}
      style={{
        width: isMobile ? undefined : panelWidth,
        background: 'hsl(220 22% 4% / 0.96)',
        border: '1px solid hsl(32 100% 50% / 0.2)',
        boxShadow: '0 0 50px hsl(32 100% 50% / 0.12), 0 20px 80px hsl(0 0% 0% / 0.7)',
        backdropFilter: 'blur(32px)',
      }}
    >
      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none animate-holographic-scan rounded-xl" style={{ zIndex: 1 }} />

      {/* Rain overlay when idle */}
      {messages.length === 0 && <div className="absolute inset-0 pointer-events-none br2049-rain rounded-xl" style={{ zIndex: 1 }} />}

      {/* Header */}
      <div className="relative z-10 flex items-center gap-2.5 px-3 py-3 shrink-0" style={{ borderBottom: '1px solid hsl(32 100% 50% / 0.12)' }}>
        <JoiHologramAvatar size="sm" state={loading ? 'active' : 'idle'} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono font-bold tracking-[0.25em] uppercase" style={{ color: 'hsl(32 100% 60%)' }}>
              JOI · NEXUS
            </span>
            {/* Connection indicator */}
            <div className={cn("w-1.5 h-1.5 rounded-full",
              connectionOk === true ? "bg-green-500" : connectionOk === false ? "bg-red-500" : "bg-muted-foreground/20"
            )} style={{ boxShadow: connectionOk === true ? '0 0 4px hsl(120 70% 50%)' : 'none' }} />
          </div>
          <span className="text-[7px] font-mono tracking-[0.15em] uppercase" style={{ color: 'hsl(32 100% 50% / 0.4)' }}>
            {loading ? 'PROCESSING...' : 'HOLOGRAPHIC COMPANION'}
          </span>
        </div>

        <button onClick={clearMessages} className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/5 transition-colors" title="Clear">
          <Trash2 className="h-3 w-3" style={{ color: 'hsl(32 100% 50% / 0.4)' }} />
        </button>
        <button onClick={() => setExpanded(!expanded)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/5 transition-colors" title="Expand">
          <Maximize2 className="h-3 w-3" style={{ color: 'hsl(32 100% 50% / 0.6)' }} />
        </button>
        <button onClick={() => setMinimized(true)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/5 transition-colors">
          <Minimize2 className="h-3 w-3" style={{ color: 'hsl(32 100% 50% / 0.6)' }} />
        </button>
        <button onClick={handleClose} className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/5 transition-colors">
          <X className="h-3 w-3" style={{ color: 'hsl(32 100% 50% / 0.6)' }} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="relative z-10 flex-1 overflow-y-auto px-3 py-2 space-y-3 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 opacity-80">
            <JoiHologramAvatar size="lg" state="idle" />
            <p className="text-[8px] font-mono tracking-[0.2em] uppercase text-center" style={{ color: 'hsl(32 100% 50% / 0.45)' }}>
              NEXUS ONLINE · AWAITING INPUT
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center px-2">
              {presets.map((p, idx) => (
                <button
                  key={p.label}
                  onClick={() => send(p.prompt)}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-[8px] font-mono tracking-wider uppercase transition-all hover:scale-105 active:scale-95 animate-fade-in"
                  style={{
                    background: 'hsl(32 100% 50% / 0.06)',
                    border: '1px solid hsl(32 100% 50% / 0.15)',
                    color: 'hsl(32 100% 60%)',
                    animationDelay: `${idx * 50}ms`,
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
            className={cn('max-w-[88%]', msg.role === 'user' ? 'ml-auto' : '')}
            style={{ animation: msg.role === 'assistant' ? 'holo-materialize 0.5s cubic-bezier(0.16, 1, 0.3, 1) both' : 'fade-in 0.2s ease-out both' }}
          >
            {msg.role === 'user' ? (
              <div>
                <div
                  className="px-3 py-2 rounded-lg rounded-br-sm text-[11px] font-mono leading-relaxed"
                  style={{
                    background: 'hsl(32 100% 50% / 0.1)',
                    border: '1px solid hsl(32 100% 50% / 0.18)',
                    color: 'hsl(32 100% 80%)',
                  }}
                >
                  {msg.content}
                </div>
                {msg.ts && <span className="text-[6px] font-mono block text-right mt-0.5" style={{ color: 'hsl(32 100% 50% / 0.2)' }}>{formatTime(msg.ts)}</span>}
              </div>
            ) : (
              <div>
                <div
                  className="px-3 py-2 rounded-lg rounded-bl-sm text-[11px] leading-relaxed"
                  style={{
                    borderLeft: '2px solid hsl(32 100% 50% / 0.35)',
                    background: 'hsl(220 20% 6% / 0.6)',
                    color: 'hsl(180 8% 82%)',
                  }}
                >
                  <div className="prose prose-invert prose-xs max-w-none [&_p]:my-1 [&_code]:text-[hsl(32_100%_65%)] [&_code]:bg-transparent [&_pre]:bg-[hsl(220_20%_8%)] [&_pre]:border [&_pre]:border-[hsl(32_100%_50%/0.1)] [&_strong]:text-[hsl(32_100%_70%)] [&_a]:text-[hsl(32_100%_60%)]">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  {msg.ts && <span className="text-[6px] font-mono" style={{ color: 'hsl(32 100% 50% / 0.2)' }}>{formatTime(msg.ts)}</span>}
                  {!loading && (
                    <div className="flex gap-0.5 ml-auto">
                      <button
                        onClick={() => handleFeedback(i, 'up')}
                        className={cn("h-4 w-4 rounded flex items-center justify-center transition-colors",
                          msg.feedback === 'up' ? "bg-green-500/20" : "hover:bg-white/5"
                        )}
                      >
                        <ThumbsUp className="h-2.5 w-2.5" style={{ color: msg.feedback === 'up' ? 'hsl(120 70% 50%)' : 'hsl(32 100% 50% / 0.2)' }} />
                      </button>
                      <button
                        onClick={() => handleFeedback(i, 'down')}
                        className={cn("h-4 w-4 rounded flex items-center justify-center transition-colors",
                          msg.feedback === 'down' ? "bg-red-500/20" : "hover:bg-white/5"
                        )}
                      >
                        <ThumbsDown className="h-2.5 w-2.5" style={{ color: msg.feedback === 'down' ? 'hsl(0 70% 50%)' : 'hsl(32 100% 50% / 0.2)' }} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role !== 'assistant' && (
          <ThinkingWave />
        )}
        <div ref={endRef} />
      </div>

      {/* Quick presets */}
      {messages.length > 0 && (
        <div className="relative z-10 flex gap-1 px-3 py-1.5 overflow-x-auto shrink-0" style={{ borderTop: '1px solid hsl(32 100% 50% / 0.06)' }}>
          {presets.map(p => (
            <button
              key={p.label}
              onClick={() => send(p.prompt)}
              disabled={loading}
              className="shrink-0 px-2 py-1 rounded text-[7px] font-mono tracking-wider uppercase transition-colors disabled:opacity-30"
              style={{
                background: 'hsl(32 100% 50% / 0.05)',
                border: '1px solid hsl(32 100% 50% / 0.1)',
                color: 'hsl(32 100% 55%)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Input — multiline textarea */}
      <div className="relative z-10 p-2.5 shrink-0" style={{ borderTop: '1px solid hsl(32 100% 50% / 0.1)' }}>
        <div
          className="flex items-end gap-1.5 rounded-lg px-3 py-2"
          style={{
            background: 'hsl(220 20% 5%)',
            border: '1px solid hsl(32 100% 50% / 0.12)',
          }}
        >
          <span className="text-[10px] font-mono shrink-0 pb-0.5" style={{ color: 'hsl(32 100% 50% / 0.4)' }}>&gt;_</span>
          <textarea
            ref={textareaRef}
            className="flex-1 bg-transparent border-none outline-none text-[11px] font-mono placeholder:text-[hsl(32_100%_50%/0.2)] resize-none overflow-hidden leading-relaxed"
            style={{ color: 'hsl(32 100% 75%)', caretColor: 'hsl(32 100% 50%)', minHeight: '20px', maxHeight: '80px' }}
            placeholder="Comando... (Shift+Enter nova linha)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="h-7 w-7 rounded flex items-center justify-center transition-all disabled:opacity-20 hover:scale-110 active:scale-90 shrink-0"
            style={{ background: input.trim() ? 'hsl(32 100% 50% / 0.15)' : 'transparent' }}
          >
            <Send className="h-3.5 w-3.5" style={{ color: 'hsl(32 100% 55%)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
