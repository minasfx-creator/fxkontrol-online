/**
 * FXKAssistant — "Joi" BR2049 AI Companion
 * Cyan-Âmbar-Gold palette, cinematic presence, voice interaction (Alexa-style)
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { playGlitchBurst } from '@/utils/glitchSound';
import JoiCinematicHologram, { type JoiEmotion } from '@/components/JoiCinematicHologram';
import { X, Minimize2, Send, Zap, ShieldCheck, Activity, Sparkles, Maximize2, Trash2, ThumbsUp, ThumbsDown, AlertTriangle, FileText, Download, Gavel, Plane, MapPin, Globe, Volume2, VolumeX, Mic, MicOff, Play } from 'lucide-react';
import { exportJoiPdf } from '@/utils/joiPdfExport';
import { parseKmzReadyBlock, stripKmzReadyBlock, downloadAeroKmz } from '@/utils/joiAeroKmzExport';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { useIsMobile } from '@/hooks/use-mobile';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { useJoiSpeech } from '@/hooks/useJoiSpeech';
import joiFaceIcon from '@/assets/joi-face-icon.png';

type Msg = { role: 'user' | 'assistant'; content: string; ts?: number; feedback?: 'up' | 'down' };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fxk-ai-chat`;
const HISTORY_KEY = 'fxk-ai-history';
const MAX_HISTORY = 10;

const PRESETS_COMMAND = [
  { label: 'ORÇAMENTO', icon: Sparkles, prompt: 'Me ajude a criar um orçamento detalhado para um show pirotécnico. Preciso incluir itens, quantidades, calibres e custos.' },
  { label: 'LICENÇAS', icon: ShieldCheck, prompt: 'Quais documentos e licenças preciso para realizar este show? Liste todos os órgãos, prazos e requisitos.' },
  { label: 'DECLARAÇÃO', icon: FileText, prompt: 'Preciso redigir uma declaração/ofício para um órgão regulador. Me ajude com o formato oficial completo.' },
  { label: 'CHECKLIST', icon: Activity, prompt: 'Monte um checklist completo de documentação pré-show: licenças, seguros, certificados, autorizações.' },
  { label: 'PRAZOS', icon: AlertTriangle, prompt: 'Verifique prazos de licenças, certificados e seguros. Me alerte sobre vencimentos e renovações urgentes.' },
  { label: 'CONTRATO', icon: Zap, prompt: 'Me ajude a redigir uma proposta comercial / contrato de prestação de serviços para um show.' },
  { label: 'LICITAÇÃO', icon: Gavel, prompt: 'Me ajude a analisar um edital de licitação e preparar a proposta técnica e de preços. Inclua documentação de habilitação necessária.' },
  { label: 'ESPAÇO AÉREO', icon: Plane, prompt: 'Me ajude a preparar a documentação de fechamento de espaço aéreo (NOTAM/DECEA) e planta de distanciamento de segurança para este show.' },
  { label: 'PLANTA', icon: MapPin, prompt: 'Gere uma planta de distanciamento de segurança conforme NFPA 1123 para este show. Preciso das zonas de fogo, segurança, fallout e restrição aérea com as coordenadas GPS.' },
];

const PRESETS_EDITOR = [
  { label: 'ORÇAMENTO', icon: Sparkles, prompt: 'Me ajude a montar um orçamento para este show com base nos efeitos e posições do projeto.' },
  { label: 'LICENÇAS', icon: ShieldCheck, prompt: 'Quais licenças e autorizações preciso para este tipo de show? Inclua Exército, Bombeiros e ANAC se aplicável.' },
  { label: 'DECLARAÇÃO', icon: FileText, prompt: 'Preciso redigir um documento formal (ofício, declaração ou requerimento) para órgão regulador.' },
  { label: 'CHECKLIST', icon: Activity, prompt: 'Monte um checklist de documentação e segurança para este show.' },
  { label: 'PRAZOS', icon: AlertTriangle, prompt: 'Verifique prazos de licenças, certificados e seguros. Me alerte sobre vencimentos urgentes.' },
  { label: 'CONTRATO', icon: Zap, prompt: 'Me ajude a redigir uma proposta comercial ou contrato para este projeto de show.' },
  { label: 'LICITAÇÃO', icon: Gavel, prompt: 'Me ajude a analisar um edital de licitação e preparar proposta para este tipo de show.' },
  { label: 'ESPAÇO AÉREO', icon: Plane, prompt: 'Me ajude a preparar a documentação de fechamento de espaço aéreo e planta de distanciamento para este show.' },
  { label: 'PLANTA', icon: MapPin, prompt: 'Gere uma planta de distanciamento de segurança conforme NFPA 1123 para este projeto.' },
];

const IDLE_PHRASES = [
  'Cuidando de tudo por você...',
  'Tudo sob controle. Relaxa.',
  'Me chama quando precisar, tá?',
  'Observando e cuidando de tudo...',
];

const CELEBRATING_KEYWORDS = ['✅', 'concluído', 'pronto', 'sucesso', 'exportado', 'seguro', 'perfeito', 'excelente', 'finalizado', 'aprovado', 'deferido', 'concedido', 'assinado', 'renovado', 'pago', 'liberado', 'autorizado'];
const SERIOUS_KEYWORDS = ['⚠', 'prazo', 'urgente', 'atenção', 'pendente', 'documento', 'licença', 'vencido', 'alerta', 'risco', 'cuidado', 'indeferido', 'multa', 'notificação', 'embargo', 'irregular', 'expirado', 'autuação', 'infração'];

function detectEmotion(text: string): JoiEmotion {
  const lower = text.toLowerCase();
  if (CELEBRATING_KEYWORDS.some(k => lower.includes(k))) return 'celebrating';
  if (SERIOUS_KEYWORDS.some(k => lower.includes(k))) return 'serious';
  return 'caring';
}

/** Typewriter greeting */
function TypewriterGreeting({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(iv); setDone(true); }
    }, 40);
    return () => clearInterval(iv);
  }, [text]);

  return (
    <p className="text-[10px] font-mono tracking-[0.12em] text-center max-w-[220px] min-h-[2em]" style={{ color: 'hsl(38 100% 55% / 0.8)' }}>
      {displayed}
      {!done && <span className="joi-typewriter-cursor" />}
    </p>
  );
}

function getContextPresets() {
  const path = window.location.pathname;
  if (path.includes('command')) return PRESETS_COMMAND;
  return PRESETS_EDITOR;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Ei... ainda acordado? Posso adiantar alguma papelada?';
  if (h < 12) return 'Bom dia! Já organizei sua agenda. Vamos revisar pendências?';
  if (h < 18) return 'Boa tarde. Algum documento urgente para preparar?';
  return 'Boa noite... Posso adiantar alguma papelada para amanhã?';
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


function ThinkingWave() {
  return (
    <div className="flex items-center gap-2 py-2 animate-fade-in">
      <div className="flex items-end gap-[2px] h-5">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="w-[2px] rounded-full origin-bottom"
            style={{
              background: `linear-gradient(to top, hsl(190 100% ${40 + i * 3}%), hsl(190 100% ${55 + i * 2}%))`,
              animation: `voice-wave 1.2s ease-in-out ${i * 60}ms infinite, joi-wave-bar-enter 0.4s ease-out ${i * 40}ms both`,
            }}
          />
        ))}
      </div>
      <span className="text-[7px] font-mono tracking-[0.2em] uppercase flex items-center gap-0.5" style={{ color: 'hsl(190 100% 50% / 0.5)' }}>
        PROCESSANDO
        <span className="inline-flex w-4">
          <span className="animate-pulse" style={{ animationDelay: '0ms' }}>.</span>
          <span className="animate-pulse" style={{ animationDelay: '200ms' }}>.</span>
          <span className="animate-pulse" style={{ animationDelay: '400ms' }}>.</span>
        </span>
      </span>
    </div>
  );
}

/** Speaking wave animation in header — enhanced 8-bar organic */
function SpeakingWave() {
  return (
    <div className="flex items-center gap-[1.5px] h-3.5">
      {Array.from({ length: 8 }, (_, i) => {
        const offset = i * 0.7;
        return (
          <div
            key={i}
            className="w-[2px] rounded-full origin-bottom"
            style={{
              background: `linear-gradient(to top, hsl(38 100% 50%), hsl(45 100% 60%))`,
              animation: `joi-speak-wave 0.9s ease-in-out ${i * 70}ms infinite, joi-wave-bar-enter 0.3s ease-out ${i * 50}ms both`,
              height: `${6 + Math.sin(offset) * 5}px`,
            }}
          />
        );
      })}
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
  const [glitching, setGlitching] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [idlePhrase, setIdlePhrase] = useState(0);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [statusText, setStatusText] = useState('COMPANION ONLINE');
  const [joiEmotion, setJoiEmotion] = useState<JoiEmotion>('caring');
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAtBottom = useRef(true);
  const lastMsgCountRef = useRef(messages.length);

  // Voice hooks
  const joiSpeech = useJoiSpeech();
  const voiceRecognition = useVoiceRecognition({
    onTranscript: (text) => setInput(text),
    onFinalTranscript: (text) => {
      setInput(text);
      // Auto-submit after voice recognition
      setTimeout(() => send(text), 200);
    },
  });

  // Auto-speak new assistant messages
  useEffect(() => {
    if (messages.length > lastMsgCountRef.current) {
      const last = messages[messages.length - 1];
      if (last?.role === 'assistant' && !loading && joiSpeech.enabled) {
        joiSpeech.speak(last.content);
      }
    }
    lastMsgCountRef.current = messages.length;
  }, [messages, loading, joiSpeech.enabled]);

  useEffect(() => {
    if (messages.length > 0 || loading) return;
    const interval = setInterval(() => {
      setIdlePhrase(p => (p + 1) % IDLE_PHRASES.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [messages.length, loading]);

  useEffect(() => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant || loading) {
      setJoiEmotion('caring');
      return;
    }
    const emotion = detectEmotion(lastAssistant.content);
    setJoiEmotion(emotion);
    if (emotion === 'celebrating') {
      playGlitchBurst(0.1, 1.6);
    }
    const t = setTimeout(() => setJoiEmotion('caring'), 8000);
    return () => clearTimeout(t);
  }, [messages, loading]);

  useEffect(() => {
    if (voiceRecognition.state === 'listening') {
      setStatusText('🎤 LISTENING...');
    } else if (joiSpeech.speaking) {
      setStatusText('🔊 SPEAKING...');
    } else if (loading) {
      setStatusText('PROCESSING...');
    } else if (joiEmotion === 'celebrating') {
      setStatusText('✨ EXCELENTE!');
    } else if (joiEmotion === 'serious') {
      setStatusText('⚠ ATENÇÃO');
    } else if (isTyping) {
      setStatusText('LISTENING...');
    } else if (messages.length === 0) {
      setStatusText('COMPANION ONLINE');
    } else {
      setStatusText('OBSERVING...');
    }
  }, [loading, isTyping, messages.length, joiEmotion, voiceRecognition.state, joiSpeech.speaking]);

  useEffect(() => {
    if (input.length > 0) {
      setIsTyping(true);
    } else {
      const t = setTimeout(() => setIsTyping(false), 1000);
      return () => clearTimeout(t);
    }
  }, [input]);

  useEffect(() => {
    fetch(CHAT_URL, { method: 'OPTIONS' })
      .then(() => setConnectionOk(true))
      .catch(() => setConnectionOk(false));
  }, []);

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

  useEffect(() => {
    if (messages.length > 0) saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 80) + 'px';
    }
  }, [input]);

  useEffect(() => {
    if (open && !minimized) {
      playGlitchBurst(0.08);
    }
  }, [open]);

  const presets = getContextPresets();
  const joiState = loading ? 'active' : isTyping ? 'active' : 'idle';

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setGlitching(true);
    playGlitchBurst();
    setTimeout(() => setGlitching(false), 800);
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
    joiSpeech.stop();
    voiceRecognition.stopListening();
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 350);
  }, [joiSpeech, voiceRecognition]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }, [input, send]);

  const handleMicToggle = useCallback(() => {
    playGlitchBurst(0.06, voiceRecognition.state === 'listening' ? 0.8 : 1.2);
    voiceRecognition.toggle();
  }, [voiceRecognition]);

  const panelWidth = isMobile ? undefined : (expanded ? 560 : 360);
  const isListening = voiceRecognition.state === 'listening';

  const fabState = joiSpeech.speaking ? 'speaking' : isListening ? 'listening' : loading ? 'processing' : 'idle';

  // FAB — Joi face icon with multi-state visuals
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed z-[70] group rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 touch-target-lg",
          isMobile ? "bottom-[88px] right-3 h-14 w-14" : "bottom-5 right-5 h-16 w-16"
        )}
        style={{ willChange: 'transform' }}
      >
        {/* State-specific outer effects */}
        {fabState === 'listening' && (
          <>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="absolute inset-0 rounded-full"
                style={{
                  border: '1.5px solid hsl(190 100% 50% / 0.4)',
                  animation: `joi-listening-ripple 2s ease-out ${i * 0.6}s infinite`,
                }}
              />
            ))}
          </>
        )}
        {fabState === 'processing' && (
          <div
            className="absolute inset-[-6px] rounded-full"
            style={{ animation: 'joi-processing-orbit 2s linear infinite' }}
          >
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  background: 'hsl(38 100% 55%)',
                  boxShadow: '0 0 8px hsl(38 100% 50% / 0.6)',
                  top: '50%',
                  left: '50%',
                  transform: `rotate(${i * 120}deg) translateY(-${isMobile ? 34 : 38}px) translate(-50%, -50%)`,
                }}
              />
            ))}
          </div>
        )}
        {fabState === 'speaking' && (
          <div
            className="absolute inset-[-3px] rounded-full"
            style={{
              border: '2px solid hsl(38 100% 50% / 0.5)',
              animation: 'joi-speaking-pulse 1.5s ease-in-out infinite',
            }}
          />
        )}

        {/* Base glow ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: fabState === 'speaking'
              ? 'radial-gradient(circle, hsl(38 100% 50% / 0.25), hsl(45 100% 50% / 0.1), transparent)'
              : fabState === 'processing'
                ? 'radial-gradient(circle, hsl(38 100% 50% / 0.2), transparent)'
                : 'radial-gradient(circle, hsl(190 100% 50% / 0.25), hsl(38 100% 50% / 0.1), transparent)',
            animation: fabState === 'idle' ? 'joi-fab-breathe 3s ease-in-out infinite' : undefined,
          }}
        />
        {/* Outer border */}
        <div
          className="absolute inset-0 rounded-full transition-all duration-500"
          style={{
            border: `2px solid ${
              fabState === 'speaking' ? 'hsl(38 100% 50% / 0.6)'
                : fabState === 'listening' ? 'hsl(190 100% 50% / 0.7)'
                  : fabState === 'processing' ? 'hsl(38 100% 50% / 0.4)'
                    : 'hsl(190 100% 50% / 0.5)'
            }`,
            boxShadow: fabState === 'speaking'
              ? '0 0 25px hsl(38 100% 50% / 0.35), inset 0 0 15px hsl(38 100% 50% / 0.1)'
              : fabState === 'listening'
                ? '0 0 30px hsl(190 100% 50% / 0.4), inset 0 0 15px hsl(190 100% 50% / 0.1)'
                : '0 0 20px hsl(190 100% 50% / 0.3), 0 0 40px hsl(38 100% 45% / 0.1), inset 0 0 15px hsl(190 100% 50% / 0.1)',
            animation: fabState === 'idle' ? 'joi-fab-breathe 3s ease-in-out infinite' : undefined,
          }}
        />
        {/* Joi face image */}
        <img
          src={joiFaceIcon}
          alt="Joi"
          className="w-full h-full rounded-full object-cover relative z-10 transition-all duration-300"
          style={{
            filter: fabState === 'speaking' ? 'contrast(1.1) brightness(1.05) saturate(1.1)' : 'contrast(1.05) brightness(0.95)',
          }}
        />
        {/* Mini speaking wave bars around FAB */}
        {fabState === 'speaking' && (
          <div className="absolute inset-[-10px] z-0 flex items-center justify-center">
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                className="absolute w-[2px] rounded-full origin-bottom"
                style={{
                  background: 'hsl(38 100% 55% / 0.6)',
                  transform: `rotate(${i * 45}deg) translateY(-${isMobile ? 32 : 36}px)`,
                  animation: `joi-mouth-speak 0.6s ease-in-out ${i * 75}ms infinite`,
                }}
              />
            ))}
          </div>
        )}
        {/* Status ping */}
        <span
          className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full z-20 transition-colors duration-300"
          style={{
            background: fabState === 'speaking' ? 'hsl(38 100% 55%)' : fabState === 'listening' ? 'hsl(190 100% 55%)' : 'hsl(190 100% 50%)',
            boxShadow: `0 0 8px ${fabState === 'speaking' ? 'hsl(38 100% 50% / 0.6)' : 'hsl(190 100% 50% / 0.6)'}`,
            animation: fabState !== 'idle' ? undefined : 'joi-fab-breathe 2s ease-in-out infinite',
          }}
        />
      </button>
    );
  }

  // Minimized bar
  if (minimized) {
    return (
      <div
        onClick={() => setMinimized(false)}
        className={cn(
          "fixed z-[70] cursor-pointer rounded-lg border px-3 py-2 flex items-center gap-2",
          isMobile ? "bottom-[88px] right-3" : "bottom-5 right-5"
        )}
        style={{
          background: 'hsl(220 22% 5% / 0.92)',
          borderColor: 'hsl(190 100% 50% / 0.25)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <img src={joiFaceIcon} alt="Joi" className="w-5 h-5 rounded-full object-cover" />
        <span className="text-[10px] font-mono tracking-[0.2em] uppercase" style={{ color: 'hsl(38 100% 55%)' }}>
          JOI · COMPANION
        </span>
        {joiSpeech.speaking && <SpeakingWave />}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-[70] rounded-xl flex flex-col overflow-hidden fxk-panel transition-all duration-300",
        closing ? "animate-holo-dissolve" : "animate-holo-materialize",
        isMobile ? "inset-3 bottom-[76px]" : "bottom-5 right-5 h-[560px]"
      )}
      style={{
        width: isMobile ? undefined : panelWidth,
        background: 'hsl(220 22% 4% / 0.96)',
        border: '1px solid hsl(190 100% 50% / 0.15)',
        boxShadow: '0 0 50px hsl(190 100% 50% / 0.08), 0 0 100px hsl(38 100% 45% / 0.05), 0 20px 80px hsl(0 0% 0% / 0.7)',
        backdropFilter: 'blur(32px)',
      }}
    >
      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none animate-holographic-scan rounded-xl" style={{ zIndex: 1 }} />

      {/* Rain overlay when idle */}
      {messages.length === 0 && <div className="absolute inset-0 pointer-events-none br2049-rain rounded-xl" style={{ zIndex: 1 }} />}

      {/* Header */}
      <div className="relative z-10 flex items-center gap-2.5 px-3 py-3 shrink-0" style={{ borderBottom: '1px solid hsl(190 100% 50% / 0.1)' }}>
        {/* Joi face in header — speaking avatar */}
        <div className="relative cursor-pointer hover:brightness-125 transition-all shrink-0">
          <img src={joiFaceIcon} alt="Joi" className="w-10 h-10 rounded-full object-cover transition-all duration-500" style={{
            border: joiSpeech.speaking ? '2px solid hsl(38 100% 50% / 0.6)' : '1.5px solid hsl(190 100% 50% / 0.3)',
            boxShadow: joiSpeech.speaking
              ? '0 0 20px hsl(38 100% 50% / 0.25), 0 0 8px hsl(38 100% 50% / 0.15)'
              : '0 0 12px hsl(190 100% 50% / 0.15)',
            animation: joiSpeech.speaking ? 'joi-avatar-speaking 1.5s ease-in-out infinite' : undefined,
            transform: joiSpeech.speaking ? 'scale(1.02)' : 'scale(1)',
          }} />
          {joiSpeech.speaking && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: 'hsl(38 100% 50%)', boxShadow: '0 0 6px hsl(38 100% 50% / 0.5)' }}>
              <Volume2 className="w-2 h-2 text-black" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono font-bold tracking-[0.25em] uppercase" style={{ color: 'hsl(38 100% 55%)' }}>
              JOI · COMPANION
            </span>
            <div className={cn("w-1.5 h-1.5 rounded-full",
              connectionOk === true ? "bg-green-500" : connectionOk === false ? "bg-red-500" : "bg-muted-foreground/20"
            )} style={{ boxShadow: connectionOk === true ? '0 0 4px hsl(120 70% 50%)' : 'none' }} />
            {joiSpeech.speaking && <SpeakingWave />}
          </div>
          <span className="text-[7px] font-mono tracking-[0.15em] uppercase transition-all duration-500" style={{
            color: voiceRecognition.state === 'listening' ? 'hsl(190 100% 65%)' : joiSpeech.speaking ? 'hsl(38 100% 65%)' : joiEmotion === 'celebrating' ? 'hsl(42 90% 60%)' : joiEmotion === 'serious' ? 'hsl(32 80% 55%)' : 'hsl(190 100% 50% / 0.4)',
          }}>
            {statusText}
          </span>
        </div>

        {/* Voice toggle */}
        {joiSpeech.supported && (
          <button
            onClick={joiSpeech.toggle}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/5 transition-colors"
            title={joiSpeech.enabled ? 'Desativar voz' : 'Ativar voz'}
          >
            {joiSpeech.enabled ? (
              <Volume2 className="h-3 w-3" style={{ color: 'hsl(38 100% 55%)' }} />
            ) : (
              <VolumeX className="h-3 w-3" style={{ color: 'hsl(190 100% 50% / 0.3)' }} />
            )}
          </button>
        )}

        <button onClick={clearMessages} className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/5 transition-colors" title="Clear">
          <Trash2 className="h-3 w-3" style={{ color: 'hsl(190 100% 50% / 0.4)' }} />
        </button>
        {!isMobile && (
          <button onClick={() => setExpanded(!expanded)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/5 transition-colors" title="Expand">
            <Maximize2 className="h-3 w-3" style={{ color: 'hsl(190 100% 50% / 0.6)' }} />
          </button>
        )}
        <button onClick={() => setMinimized(true)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/5 transition-colors">
          <Minimize2 className="h-3 w-3" style={{ color: 'hsl(190 100% 50% / 0.6)' }} />
        </button>
        <button onClick={handleClose} className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/5 transition-colors">
          <X className="h-3 w-3" style={{ color: 'hsl(190 100% 50% / 0.6)' }} />
        </button>
      </div>

      {/* Content area */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Sidebar hologram (expanded only) */}
        {expanded && messages.length > 0 && !isMobile && (
          <div className="w-[120px] shrink-0 flex flex-col items-center justify-center border-r" style={{ borderColor: 'hsl(190 100% 50% / 0.08)', background: 'hsl(220 22% 3% / 0.5)' }}>
            <JoiCinematicHologram size="lg" state={joiState} glitching={glitching} emotion={joiEmotion} className="w-24 h-48" />
            <span className="text-[6px] font-mono tracking-[0.2em] uppercase mt-2" style={{ color: 'hsl(190 100% 50% / 0.4)' }}>
              {statusText}
            </span>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 py-2 space-y-3 scrollbar-thin">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-90">
              {/* Close-up cinematográfico */}
              <div className="relative w-64 h-72 rounded-3xl overflow-hidden joi-closeup-entrance" style={{ boxShadow: '0 0 50px hsl(190 100% 50% / 0.2), 0 0 100px hsl(38 100% 45% / 0.1), inset 0 0 60px hsl(220 22% 4% / 0.5)', background: 'radial-gradient(ellipse at 50% 40%, hsl(220 22% 8%) 0%, hsl(220 22% 3%) 100%)' }}>
                <JoiCinematicHologram size="xl" state="materializing" glitching={glitching} emotion={joiEmotion} variant="closeup" className="w-full h-full" />
              </div>
              {/* Typewriter greeting */}
              <TypewriterGreeting text={getGreeting()} />
              {/* Idle presence phrase */}
              <p className="text-[7px] font-mono tracking-[0.2em] uppercase text-center transition-all duration-1000" style={{ color: 'hsl(190 100% 50% / 0.3)' }}>
                {IDLE_PHRASES[idlePhrase]}
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center px-2">
                {presets.map((p, idx) => (
                  <button
                    key={p.label}
                    onClick={() => send(p.prompt)}
                    className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-[8px] font-mono tracking-wider uppercase transition-all hover:scale-105 active:scale-95 animate-fade-in"
                    style={{
                      background: 'hsl(190 100% 50% / 0.06)',
                      border: '1px solid hsl(190 100% 50% / 0.12)',
                      color: 'hsl(38 100% 55%)',
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
                      background: 'hsl(190 100% 50% / 0.08)',
                      border: '1px solid hsl(190 100% 50% / 0.15)',
                      color: 'hsl(190 100% 85%)',
                    }}
                  >
                    {msg.content}
                  </div>
                  {msg.ts && <span className="text-[6px] font-mono block text-right mt-0.5" style={{ color: 'hsl(190 100% 50% / 0.2)' }}>{formatTime(msg.ts)}</span>}
                </div>
              ) : (
                <div>
                  {(() => {
                    const isSpeakingThis = joiSpeech.speaking && i === messages.length - 1 && msg.role === 'assistant';
                    return (
                      <div
                        className="px-3 py-2 rounded-lg rounded-bl-sm text-[11px] leading-relaxed transition-all duration-500"
                        style={{
                          borderLeft: `2px solid ${
                            isSpeakingThis ? 'hsl(38 100% 55% / 0.8)'
                              : detectEmotion(msg.content) === 'celebrating' ? 'hsl(42 90% 55% / 0.5)'
                                : detectEmotion(msg.content) === 'serious' ? 'hsl(32 80% 50% / 0.5)'
                                  : 'hsl(190 100% 50% / 0.3)'
                          }`,
                          background: isSpeakingThis ? 'hsl(220 20% 7% / 0.8)' : 'hsl(220 20% 6% / 0.6)',
                          color: 'hsl(180 8% 82%)',
                          animation: isSpeakingThis ? 'joi-msg-speaking 2s ease-in-out infinite' : undefined,
                        }}
                      >
                    <div className="prose prose-invert prose-xs max-w-none [&_p]:my-1 [&_code]:text-[hsl(190_100%_70%)] [&_code]:bg-transparent [&_pre]:bg-[hsl(220_20%_8%)] [&_pre]:border [&_pre]:border-[hsl(190_100%_50%/0.1)] [&_strong]:text-[hsl(38_100%_65%)] [&_a]:text-[hsl(190_100%_60%)]">
                      <ReactMarkdown>{stripKmzReadyBlock(msg.content)}</ReactMarkdown>
                    </div>
                    {parseKmzReadyBlock(msg.content) && (
                      <button
                        onClick={() => {
                          const params = parseKmzReadyBlock(msg.content);
                          if (params) downloadAeroKmz(params);
                        }}
                        className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-[9px] font-mono tracking-wider uppercase transition-all hover:scale-105 active:scale-95"
                        style={{
                          background: 'hsl(190 100% 50% / 0.1)',
                          border: '1px solid hsl(190 100% 50% / 0.25)',
                          color: 'hsl(190 100% 70%)',
                        }}
                      >
                        <Globe className="h-3 w-3" />
                        Exportar KMZ Aeronáutica
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    {msg.ts && <span className="text-[6px] font-mono" style={{ color: 'hsl(190 100% 50% / 0.2)' }}>{formatTime(msg.ts)}</span>}
                    {!loading && (
                      <div className="flex gap-0.5 ml-auto">
                        {/* Play individual message */}
                        {joiSpeech.supported && (
                          <button
                            onClick={() => joiSpeech.speakSingle(msg.content)}
                            className="h-4 w-4 rounded flex items-center justify-center transition-colors hover:bg-white/5"
                            title="Ouvir mensagem"
                          >
                            <Play className="h-2.5 w-2.5" style={{ color: 'hsl(38 100% 55% / 0.5)' }} />
                          </button>
                        )}
                        <button
                          onClick={() => exportJoiPdf(msg.content)}
                          className="h-4 w-4 rounded flex items-center justify-center transition-colors hover:bg-white/5"
                          title="Exportar PDF"
                        >
                          <Download className="h-2.5 w-2.5" style={{ color: 'hsl(38 100% 55% / 0.5)' }} />
                        </button>
                        <button
                          onClick={() => handleFeedback(i, 'up')}
                          className={cn("h-4 w-4 rounded flex items-center justify-center transition-colors",
                            msg.feedback === 'up' ? "bg-green-500/20" : "hover:bg-white/5"
                          )}
                        >
                          <ThumbsUp className="h-2.5 w-2.5" style={{ color: msg.feedback === 'up' ? 'hsl(120 70% 50%)' : 'hsl(190 100% 50% / 0.2)' }} />
                        </button>
                        <button
                          onClick={() => handleFeedback(i, 'down')}
                          className={cn("h-4 w-4 rounded flex items-center justify-center transition-colors",
                            msg.feedback === 'down' ? "bg-red-500/20" : "hover:bg-white/5"
                          )}
                        >
                          <ThumbsDown className="h-2.5 w-2.5" style={{ color: msg.feedback === 'down' ? 'hsl(0 70% 50%)' : 'hsl(190 100% 50% / 0.2)' }} />
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
      </div>

      {/* Quick presets */}
      {messages.length > 0 && (
        <div className="relative z-10 flex gap-1 px-3 py-1.5 overflow-x-auto shrink-0" style={{ borderTop: '1px solid hsl(190 100% 50% / 0.06)' }}>
          {presets.map(p => (
            <button
              key={p.label}
              onClick={() => send(p.prompt)}
              disabled={loading}
              className="shrink-0 px-2 py-1 rounded text-[7px] font-mono tracking-wider uppercase transition-colors disabled:opacity-30"
              style={{
                background: 'hsl(190 100% 50% / 0.05)',
                border: '1px solid hsl(190 100% 50% / 0.08)',
                color: 'hsl(38 100% 55%)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative z-10 p-2.5 shrink-0" style={{ borderTop: '1px solid hsl(190 100% 50% / 0.08)' }}>
        <div
          className="flex items-end gap-1.5 rounded-lg px-3 py-2 transition-all duration-300"
          style={{
            background: 'hsl(220 20% 5%)',
            border: `1px solid ${isListening ? 'hsl(190 100% 50% / 0.5)' : isTyping ? 'hsl(190 100% 50% / 0.25)' : 'hsl(190 100% 50% / 0.08)'}`,
            boxShadow: isListening ? '0 0 15px hsl(190 100% 50% / 0.15)' : 'none',
          }}
        >
          <span className="text-[10px] font-mono shrink-0 pb-0.5" style={{ color: isListening ? 'hsl(190 100% 50% / 0.8)' : 'hsl(190 100% 50% / 0.4)' }}>
            {isListening ? '🎤' : '>_'}
          </span>
          <textarea
            ref={textareaRef}
            className="flex-1 bg-transparent border-none outline-none text-[11px] font-mono placeholder:text-[hsl(190_100%_50%/0.2)] resize-none overflow-hidden leading-relaxed"
            style={{ color: 'hsl(38 100% 80%)', caretColor: 'hsl(190 100% 50%)', minHeight: '20px', maxHeight: '80px' }}
            placeholder={isListening ? 'Ouvindo...' : 'Comando... (Shift+Enter nova linha)'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
          />
          {/* Mic button */}
          {voiceRecognition.supported && (
            <button
              onClick={handleMicToggle}
              disabled={loading}
              className={cn(
                "h-7 w-7 rounded flex items-center justify-center transition-all shrink-0 hover:scale-110 active:scale-90",
                isListening && "animate-pulse"
              )}
              style={{
                background: isListening ? 'hsl(190 100% 50% / 0.2)' : 'transparent',
                boxShadow: isListening ? '0 0 12px hsl(190 100% 50% / 0.3)' : 'none',
              }}
              title={isListening ? 'Parar de ouvir' : 'Comando de voz'}
            >
              {isListening ? (
                <Mic className="h-3.5 w-3.5" style={{ color: 'hsl(190 100% 60%)' }} />
              ) : (
                <MicOff className="h-3.5 w-3.5" style={{ color: 'hsl(190 100% 50% / 0.3)' }} />
              )}
            </button>
          )}
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="h-7 w-7 rounded flex items-center justify-center transition-all disabled:opacity-20 hover:scale-110 active:scale-90 shrink-0"
            style={{ background: input.trim() ? 'hsl(190 100% 50% / 0.15)' : 'transparent' }}
          >
            <Send className="h-3.5 w-3.5" style={{ color: 'hsl(190 100% 55%)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
