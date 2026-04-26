/**
 * FXKAssistant — "Joi" Central Intelligence for FX KONTROL
 * 7+1 operational modes, system-aware context injection, rich rendering
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { playGlitchBurst } from '@/utils/glitchSound';
type JoiEmotion = 'caring' | 'celebrating' | 'serious';
import { X, Minimize2, Send, Sparkles, Maximize2, Trash2, ThumbsUp, ThumbsDown, FileText, Globe, Volume2, VolumeX, Mic, MicOff, Play, Paperclip, File, Image as ImageIcon, XCircle } from 'lucide-react';
const lazyExportPdf = () => import('@/utils/joiPdfExport').then(m => m.exportJoiPdf);
const lazyExportDocx = () => import('@/utils/joiDocxExport').then(m => m.exportJoiDocx);
import { parseKmzReadyBlock, stripKmzReadyBlock, downloadAeroKmz } from '@/utils/joiAeroKmzExport';
import { executeJoiCommands, stripJoiCommands, hasJoiCommands, type JoiCommandResult } from '@/utils/joiCommandExecutor';
import JoiCommandFeedback from '@/components/JoiCommandFeedback';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { useIsMobile } from '@/hooks/use-mobile';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { useJoiSpeech } from '@/hooks/useJoiSpeech';
import joiFaceIcon from '@/assets/joi-face-icon.png';
import { joiContextBuilder } from '@/core/joi/JoiContextBuilder';
import { JOI_MODES, getPresetsForMode, getModeConfig, type JoiMode } from '@/core/joi/joiModes';
import { JOIContextRibbon } from '@/components/joi/JOIContextRibbon';
import { JOIInsightPanel } from '@/components/joi/JOIInsightPanel';
import { JOITruthInspector } from '@/components/joi/JOITruthInspector';
import { JOIExecutionTracePanel } from '@/components/joi/JOIExecutionTracePanel';
import { JOIArtifactCanvas } from '@/components/joi/JOIArtifactCanvas';
import { JOIStylePanel } from '@/components/joi/JOIStylePanel';
import { joiExecutionEngine } from '@/core/joi/JOIExecutionEngine';
import { joiStyleAwareGenerator } from '@/core/joi/JOIStyleAwareGenerator';
import type { JOIExecutionTrace } from '@/core/joi/joiTypes';

import { MermaidRenderer } from '@/components/joi/MermaidRenderer';

type Msg = { role: 'user' | 'assistant' | 'system'; content: string; ts?: number; feedback?: 'up' | 'down'; cmdResults?: JoiCommandResult[]; attachmentName?: string; imageBase64?: string };

interface AttachedFile {
  file: File;
  content: string; // text content or base64 data URL
  type: 'text' | 'image';
}

const TEXT_EXTENSIONS = ['txt', 'md', 'csv', 'json', 'xml', 'yaml', 'yml', 'log', 'ini', 'toml', 'html', 'css', 'js', 'ts', 'py', 'sql', 'env'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fxk-ai-chat`;
const HISTORY_KEY = 'fxk-ai-history';
const MAX_HISTORY = 10;



const IDLE_PHRASES = [
  'Aqui firme cuidando de tudo, chefinho!',
  'Tô de olho em tudo... pode relaxar, chefão!',
  'Diga, chefinho! A Joi tá pronta pra resolver!',
  'Tudo sob controle, chefe. Relaxa que eu cuido 😉',
  'Esperando suas ordens, chefinho!',
  'Nada escapa da Joi... pode confiar, chefe!',
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
  } catch { /* best-effort: localStorage may be full or disabled */ }
}

async function streamChat(
  messages: any[],
  onDelta: (t: string) => void,
  onDone: () => void,
  signal?: AbortSignal,
) {
  // Use the real user session JWT — never the publishable key — so the edge
  // function can identify the caller and refuse anonymous traffic that
  // would otherwise drain the workspace's Lovable AI quota.
  const { supabase } = await import('@/integrations/supabase/client');
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error('Você precisa estar logado para usar a Joi.');
  }
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ messages, projectContext: true }),
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

/** Rich content renderer — Mermaid, JOI_STATUS, JOI_MATRIX, markdown */
function JoiRichContent({ content }: { content: string }) {
  // Split content into segments: mermaid blocks, JOI_STATUS, JOI_MATRIX, and regular markdown
  const segments = useMemo(() => {
    const result: { type: 'markdown' | 'mermaid' | 'status' | 'matrix'; content: string }[] = [];
    // Match mermaid code blocks and JOI custom blocks
    const pattern = /(```mermaid\n[\s\S]*?```|\[JOI_STATUS\][\s\S]*?\[\/JOI_STATUS\]|\[JOI_MATRIX\][\s\S]*?\[\/JOI_MATRIX\])/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(content)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'markdown', content: content.slice(lastIndex, match.index) });
      }
      const block = match[0];
      if (block.startsWith('```mermaid')) {
        result.push({ type: 'mermaid', content: block.replace(/^```mermaid\n/, '').replace(/```$/, '') });
      } else if (block.startsWith('[JOI_STATUS]')) {
        result.push({ type: 'status', content: block.replace(/^\[JOI_STATUS\]/, '').replace(/\[\/JOI_STATUS\]$/, '') });
      } else if (block.startsWith('[JOI_MATRIX]')) {
        result.push({ type: 'matrix', content: block.replace(/^\[JOI_MATRIX\]/, '').replace(/\[\/JOI_MATRIX\]$/, '') });
      }
      lastIndex = match.index + block.length;
    }
    if (lastIndex < content.length) {
      result.push({ type: 'markdown', content: content.slice(lastIndex) });
    }
    return result;
  }, [content]);

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'mermaid') {
          return <MermaidRenderer key={i} code={seg.content} />;
        }
        if (seg.type === 'status') {
          return <JoiStatusCard key={i} content={seg.content} />;
        }
        if (seg.type === 'matrix') {
          return <JoiMatrixBlock key={i} content={seg.content} />;
        }
        return (
          <div key={i} className="prose prose-invert prose-xs max-w-none [&_p]:my-1 [&_code]:text-[hsl(190_100%_70%)] [&_code]:bg-transparent [&_pre]:bg-[hsl(220_20%_8%)] [&_pre]:border [&_pre]:border-[hsl(190_100%_50%/0.1)] [&_strong]:text-[hsl(38_100%_65%)] [&_a]:text-[hsl(190_100%_60%)]">
            <ReactMarkdown>{seg.content}</ReactMarkdown>
          </div>
        );
      })}
    </>
  );
}

/** Telemetry status card rendered from [JOI_STATUS] blocks */
function JoiStatusCard({ content }: { content: string }) {
  // Try to parse as JSON, fallback to text display
  let data: Record<string, any> = {};
  try {
    data = JSON.parse(content.trim());
  } catch {
    // Display as simple text card
    return (
      <div className="my-2 px-3 py-2 rounded-lg text-[9px] font-mono" style={{ background: 'hsl(190 100% 50% / 0.06)', border: '1px solid hsl(190 100% 50% / 0.15)', color: 'hsl(190 100% 70%)' }}>
        {content.trim()}
      </div>
    );
  }

  return (
    <div className="my-2 rounded-lg overflow-hidden" style={{ background: 'hsl(220 20% 6%)', border: '1px solid hsl(190 100% 50% / 0.12)' }}>
      <div className="px-3 py-1.5 flex items-center gap-2" style={{ borderBottom: '1px solid hsl(190 100% 50% / 0.08)', background: 'hsl(190 100% 50% / 0.04)' }}>
        <span className="text-[8px] font-mono font-bold tracking-wider uppercase" style={{ color: 'hsl(190 100% 60%)' }}>
          {data.title || 'SYSTEM STATUS'}
        </span>
        {data.readiness && (
          <span className="px-1.5 py-0.5 rounded text-[7px] font-mono font-bold" style={{
            background: data.readiness.includes('BLOCKED') ? 'hsl(0 70% 50% / 0.15)' : 'hsl(160 80% 45% / 0.15)',
            color: data.readiness.includes('BLOCKED') ? 'hsl(0 70% 60%)' : 'hsl(160 80% 50%)',
          }}>
            {data.readiness}
          </span>
        )}
      </div>
      <div className="px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1">
        {Object.entries(data).filter(([k]) => k !== 'title' && k !== 'readiness').map(([key, value]) => (
          <div key={key} className="flex items-center justify-between text-[8px] font-mono">
            <span className="tracking-wider uppercase" style={{ color: 'hsl(190 100% 50% / 0.5)' }}>{key.replace(/_/g, ' ')}</span>
            <span style={{ color: 'hsl(38 100% 65%)' }}>{String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Matrix block rendered from [JOI_MATRIX] blocks */
function JoiMatrixBlock({ content }: { content: string }) {
  let rows: Record<string, string>[] = [];
  try {
    rows = JSON.parse(content.trim());
  } catch {
    return (
      <div className="my-2 px-3 py-2 rounded-lg text-[9px] font-mono" style={{ background: 'hsl(220 20% 6%)', border: '1px solid hsl(190 100% 50% / 0.1)', color: 'hsl(180 8% 75%)' }}>
        {content.trim()}
      </div>
    );
  }

  if (!Array.isArray(rows) || rows.length === 0) return null;
  const cols = Object.keys(rows[0]);

  const cellColor = (val: string) => {
    const v = val.toLowerCase();
    if (v.includes('simulated') || v.includes('sim')) return 'hsl(210 90% 60%)';
    if (v.includes('live') || v.includes('ok') || v.includes('pass') || v.includes('ready')) return 'hsl(160 80% 50%)';
    if (v.includes('replay') || v.includes('warn')) return 'hsl(38 90% 55%)';
    if (v.includes('error') || v.includes('fail') || v.includes('blocked') || v.includes('not_integrated')) return 'hsl(0 70% 55%)';
    return 'hsl(180 8% 75%)';
  };

  return (
    <div className="my-2 rounded-lg overflow-hidden overflow-x-auto" style={{ background: 'hsl(220 20% 6%)', border: '1px solid hsl(190 100% 50% / 0.1)' }}>
      <table className="w-full text-[8px] font-mono">
        <thead>
          <tr style={{ borderBottom: '1px solid hsl(190 100% 50% / 0.1)' }}>
            {cols.map(c => (
              <th key={c} className="px-2 py-1.5 text-left tracking-wider uppercase" style={{ color: 'hsl(190 100% 55%)', background: 'hsl(190 100% 50% / 0.04)' }}>
                {c.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid hsl(190 100% 50% / 0.04)' }}>
              {cols.map(c => (
                <td key={c} className="px-2 py-1" style={{ color: cellColor(String(row[c] || '')) }}>
                  {String(row[c] || '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FXKAssistant() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [closing, setClosing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mobileSide, setMobileSide] = useState<'left' | 'right'>('right');
  const [messages, setMessages] = useState<Msg[]>(() => loadHistory());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<AttachedFile | null>(null);
  const [joiMode, setJoiMode] = useState<JoiMode>('show');
  const [lastTrace, setLastTrace] = useState<JOIExecutionTrace | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  // Stable ref for send to avoid stale closure in voice callbacks
  const sendRef = useRef<(text: string) => void>(() => {});

  // Voice hooks
  const joiSpeech = useJoiSpeech();
  const voiceRecognition = useVoiceRecognition({
    onTranscript: (text) => setInput(text),
    onFinalTranscript: (text) => {
      setInput(text);
      setTimeout(() => sendRef.current(text), 200);
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
  }, [messages, loading, joiSpeech.enabled, joiSpeech.speak]);

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
  }, [open, minimized]);

  const modeConfig = getModeConfig(joiMode);
  const presets = useMemo(() => {
    return getPresetsForMode(joiMode).map(p => ({ label: p.label, icon: p.icon, prompt: p.prompt }));
  }, [joiMode]);
  

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      import('sonner').then(({ toast }) => toast.error('Arquivo muito grande (máx 2MB)'));
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (TEXT_EXTENSIONS.includes(ext)) {
      const content = await readFileAsText(file);
      setAttachment({ file, content: content.slice(0, 8000), type: 'text' });
    } else if (IMAGE_EXTENSIONS.includes(ext)) {
      const dataUrl = await readFileAsDataURL(file);
      setAttachment({ file, content: dataUrl, type: 'image' });
    } else {
      import('sonner').then(({ toast }) => toast.error(`Formato .${ext} não suportado. Use texto ou imagem.`));
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  }, []);

  const send = useCallback(async (text: string) => {
    if ((!text.trim() && !attachment) || loading) return;
    playGlitchBurst();

    // Build user message with attachment context
    let userContent = text.trim();
    let imageBase64: string | undefined;
    const attachName = attachment?.file.name;

    if (attachment) {
      if (attachment.type === 'text') {
        userContent = `[DOCUMENTO ANEXADO: ${attachment.file.name}]\n\`\`\`\n${attachment.content}\n\`\`\`\n\n${userContent || 'Analise este documento.'}`;
      } else if (attachment.type === 'image') {
        imageBase64 = attachment.content;
        userContent = userContent || `Analise esta imagem: ${attachment.file.name}`;
      }
      setAttachment(null);
    }

    const userMsg: Msg = { role: 'user', content: userContent, ts: Date.now(), attachmentName: attachName, imageBase64 };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Run execution engine — classify intent, run resolvers, collect artifacts
    const trace = joiExecutionEngine.execute(userContent, joiMode);
    setLastTrace(trace);
    const traceContext = joiExecutionEngine.formatTraceForAI(trace);

    // Style context if active
    const styleContext = joiStyleAwareGenerator.getStyleContext();

    // Inject system context (full pipeline awareness + execution trace)
    const systemContext = joiContextBuilder.toSystemMessage();
    const modeInstruction = getModeConfig(joiMode).systemInstruction;
    const contextMsg: Msg = {
      role: 'system' as const,
      content: `${systemContext}\n\n${traceContext}${styleContext ? `\n\n[ACTIVE STYLE]\n${styleContext}` : ''}\n\n[ACTIVE MODE: ${joiMode.toUpperCase()}]\n${modeInstruction}\n\n[EXECUTION ARTIFACTS: ${trace.artifacts.length} artifacts generated by resolvers — reference them in your response when relevant]`,
    };

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

    // Build messages for API — include image as multimodal content if present
    const apiMessages = [contextMsg, ...messages, userMsg].map(m => {
      if (m.imageBase64) {
        return {
          role: m.role,
          content: [
            { type: 'text', text: m.content },
            { type: 'image_url', image_url: { url: m.imageBase64 } },
          ],
        };
      }
      return { role: m.role, content: m.content };
    });

    try {
      await streamChat(apiMessages as any, upsert, () => {
        setLoading(false);
        if (hasJoiCommands(soFar)) {
          const results = executeJoiCommands(soFar);
          if (results.length > 0) {
            setMessages(prev => prev.map((m, i) =>
              i === prev.length - 1 && m.role === 'assistant'
                ? { ...m, cmdResults: results }
                : m
            ));
          }
        }
      }, ctrl.signal);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠ ${e.message}`, ts: Date.now() }]);
      }
      setLoading(false);
    }
  }, [messages, loading, attachment]);

  // Keep sendRef fresh
  sendRef.current = send;

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
    if (isMobile) {
      setOpen(false);
      setClosing(false);
      return;
    }
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 220);
  }, [isMobile, joiSpeech, voiceRecognition]);

  const handleMobileTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, [isMobile]);

  const handleMobileTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile || !swipeStartRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - swipeStartRef.current.x;
    const deltaY = touch.clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;

    if (Math.abs(deltaX) < 56 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    setMobileSide(deltaX > 0 ? 'right' : 'left');
  }, [isMobile]);

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
  const mobilePanelStyle = isMobile ? {
    width: 'min(23.5rem, calc(100vw - 1rem))',
    height: 'min(76dvh, calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 5rem))',
    top: 'max(0.5rem, env(safe-area-inset-top))',
    bottom: 'calc(4.5rem + env(safe-area-inset-bottom))',
    left: mobileSide === 'left' ? '0.5rem' : 'auto',
    right: mobileSide === 'right' ? '0.5rem' : 'auto',
  } : undefined;

  const fabState = joiSpeech.speaking ? 'speaking' : isListening ? 'listening' : loading ? 'processing' : 'idle';

  // FAB — Joi face icon with multi-state visuals
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir assistente Joi"
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
        <span className="text-[10px] font-mono tracking-[0.2em] uppercase" style={{ color: `hsl(${modeConfig.accentHsl})` }}>
          JOI · {modeConfig.shortLabel}
        </span>
        {joiSpeech.speaking && <SpeakingWave />}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-[10000] rounded-xl flex flex-col overflow-hidden fxk-panel transition-all duration-300",
        closing ? "animate-holo-dissolve" : "animate-holo-materialize",
        isMobile ? "max-w-[calc(100vw-1rem)]" : "bottom-5 right-5 h-[560px]"
      )}
      onTouchStart={handleMobileTouchStart}
      onTouchEnd={handleMobileTouchEnd}
      style={{
        width: isMobile ? undefined : panelWidth,
        background: 'hsl(220 22% 4% / 0.96)',
        border: '1px solid hsl(190 100% 50% / 0.15)',
        boxShadow: '0 0 50px hsl(190 100% 50% / 0.08), 0 0 100px hsl(38 100% 45% / 0.05), 0 20px 80px hsl(0 0% 0% / 0.7)',
        backdropFilter: 'blur(32px)',
        ...mobilePanelStyle,
      }}
    >
      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none animate-holographic-scan rounded-xl" style={{ zIndex: 1 }} />

      {/* Rain overlay when idle */}
      {messages.length === 0 && <div className="absolute inset-0 pointer-events-none br2049-rain rounded-xl" style={{ zIndex: 1 }} />}

      {/* Header */}
      <div
        className={cn(
          "relative z-20 flex items-center shrink-0 pointer-events-auto",
          isMobile ? "gap-1.5 px-2 py-2.5" : "gap-2.5 px-3 py-3"
        )}
        style={{ borderBottom: '1px solid hsl(190 100% 50% / 0.1)' }}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-border/50" />
        )}
        {/* Joi face in header — speaking avatar */}
        <div className="relative cursor-pointer hover:brightness-125 transition-all shrink-0">
          <img
            src={joiFaceIcon}
            alt="Joi"
            className={cn(
              "rounded-full object-cover transition-all duration-500",
              isMobile ? "w-8 h-8" : "w-10 h-10"
            )}
            style={{
              border: joiSpeech.speaking ? '2px solid hsl(38 100% 50% / 0.6)' : '1.5px solid hsl(190 100% 50% / 0.3)',
              boxShadow: joiSpeech.speaking
                ? '0 0 20px hsl(38 100% 50% / 0.25), 0 0 8px hsl(38 100% 50% / 0.15)'
                : '0 0 12px hsl(190 100% 50% / 0.15)',
              animation: joiSpeech.speaking ? 'joi-avatar-speaking 1.5s ease-in-out infinite' : undefined,
              transform: joiSpeech.speaking ? 'scale(1.02)' : 'scale(1)',
            }}
          />
          {joiSpeech.speaking && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: 'hsl(38 100% 50%)', boxShadow: '0 0 6px hsl(38 100% 50% / 0.5)' }}>
              <Volume2 className="w-2 h-2 text-black" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-mono font-bold tracking-[0.25em] uppercase truncate" style={{ color: `hsl(${modeConfig.accentHsl})` }}>
              JOI · {modeConfig.shortLabel}
            </span>
            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
              connectionOk === true ? "bg-green-500" : connectionOk === false ? "bg-red-500" : "bg-muted-foreground/20"
            )} style={{ boxShadow: connectionOk === true ? '0 0 4px hsl(120 70% 50%)' : 'none' }} />
            {joiSpeech.speaking && <SpeakingWave />}
          </div>
          <span className="text-[7px] font-mono tracking-[0.15em] uppercase transition-all duration-500 truncate block" style={{
            color: voiceRecognition.state === 'listening' ? 'hsl(190 100% 65%)' : joiSpeech.speaking ? 'hsl(38 100% 65%)' : joiEmotion === 'celebrating' ? 'hsl(42 90% 60%)' : joiEmotion === 'serious' ? 'hsl(32 80% 55%)' : 'hsl(190 100% 50% / 0.4)',
          }}>
            {statusText}
          </span>
        </div>

        {/* Action cluster — secondary controls */}
        <div className={cn("flex items-center shrink-0", isMobile ? "gap-0.5" : "gap-1")}>
          {/* Voice toggle */}
          {joiSpeech.supported && (
            <button
              onClick={joiSpeech.toggle}
              className={cn("flex items-center justify-center rounded hover:bg-white/5 transition-colors shrink-0", isMobile ? "h-9 w-9" : "h-6 w-6")}
              title={joiSpeech.enabled ? 'Desativar voz' : 'Ativar voz'}
              aria-label={joiSpeech.enabled ? 'Desativar voz' : 'Ativar voz'}
            >
              {joiSpeech.enabled ? (
                <Volume2 className="h-3.5 w-3.5" style={{ color: 'hsl(38 100% 55%)' }} />
              ) : (
                <VolumeX className="h-3.5 w-3.5" style={{ color: 'hsl(190 100% 50% / 0.3)' }} />
              )}
            </button>
          )}

          {/* Clear — desktop only */}
          <button
            onClick={clearMessages}
            className="hidden sm:flex h-6 w-6 items-center justify-center rounded hover:bg-white/5 transition-colors shrink-0"
            title="Limpar conversa"
            aria-label="Limpar conversa"
          >
            <Trash2 className="h-3 w-3" style={{ color: 'hsl(190 100% 50% / 0.4)' }} />
          </button>

          {!isMobile && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/5 transition-colors shrink-0"
              title="Expandir"
              aria-label="Expandir"
            >
              <Maximize2 className="h-3 w-3" style={{ color: 'hsl(190 100% 50% / 0.6)' }} />
            </button>
          )}

          <button
            onClick={() => setMinimized(true)}
            className={cn("flex items-center justify-center rounded hover:bg-white/5 transition-colors shrink-0", isMobile ? "h-9 w-9" : "h-6 w-6")}
            title="Minimizar"
            aria-label="Minimizar"
          >
            <Minimize2 className={cn(isMobile ? "h-4 w-4" : "h-3 w-3")} style={{ color: 'hsl(190 100% 50% / 0.6)' }} />
          </button>
        </div>

        {/* Close — always anchored to the far right, isolated from cluster */}
        <button
          onClick={handleClose}
          className={cn(
            "flex items-center justify-center rounded-md transition-colors shrink-0 relative z-10",
            isMobile
              ? "h-11 w-11 ml-1 bg-destructive/15 border border-destructive/30 hover:bg-destructive/25 active:bg-destructive/35"
              : "h-6 w-6 ml-0.5 hover:bg-white/5"
          )}
          title="Fechar"
          aria-label="Fechar Joi"
        >
          <X className={cn(isMobile ? "h-5 w-5" : "h-3 w-3")} style={{ color: isMobile ? 'hsl(0 80% 70%)' : 'hsl(190 100% 50% / 0.6)' }} />
        </button>
      </div>


      {/* Mode selector bar */}
      <div className="relative z-10 flex flex-wrap gap-1 px-2 py-1.5 shrink-0" style={{ borderBottom: '1px solid hsl(190 100% 50% / 0.06)' }}>
        {JOI_MODES.map(mode => {
          const isActive = joiMode === mode.id;
          const ModeIcon = mode.icon;
          return (
            <button
              key={mode.id}
              onClick={() => setJoiMode(mode.id)}
              className={cn(
                "shrink-0 px-2 py-1 rounded text-[7px] font-mono tracking-wider uppercase transition-all flex items-center gap-1",
                isActive && "scale-[1.02]"
              )}
              style={{
                background: isActive ? `hsl(${mode.accentHsl} / 0.15)` : 'transparent',
                border: isActive ? `1px solid hsl(${mode.accentHsl} / 0.4)` : '1px solid transparent',
                color: isActive ? `hsl(${mode.accentHsl})` : 'hsl(190 100% 50% / 0.35)',
              }}
              title={mode.description}
            >
              <ModeIcon className="h-2.5 w-2.5" />
              {mode.shortLabel}
            </button>
          );
        })}
      </div>

      {/* Joi side panels — desktop only. No mobile to keep header/close button clean. */}
      {!isMobile && (
        <>
          <JOIContextRibbon />
          <JOIInsightPanel />
          <JOITruthInspector />
          <JOIExecutionTracePanel trace={lastTrace} />
          <JOIStylePanel />
        </>
      )}

      {/* Content area */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Messages */}

        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 py-2 space-y-3 scrollbar-thin">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-90">
              {/* Joi icon placeholder */}
              <div className="relative w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at 50% 40%, hsl(190 100% 50% / 0.15) 0%, hsl(220 22% 8%) 100%)', boxShadow: '0 0 30px hsl(190 100% 50% / 0.15)' }}>
                <Sparkles className="w-8 h-8" style={{ color: 'hsl(190 100% 50% / 0.7)' }} />
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
                  {msg.attachmentName && (
                    <div className="flex items-center gap-1.5 mb-1 px-2 py-1 rounded" style={{ background: 'hsl(38 100% 55% / 0.08)', border: '1px solid hsl(38 100% 55% / 0.15)' }}>
                      {msg.imageBase64 ? <ImageIcon className="h-3 w-3" style={{ color: 'hsl(38 100% 55% / 0.7)' }} /> : <File className="h-3 w-3" style={{ color: 'hsl(38 100% 55% / 0.7)' }} />}
                      <span className="text-[8px] font-mono truncate" style={{ color: 'hsl(38 100% 65%)' }}>{msg.attachmentName}</span>
                    </div>
                  )}
                  {msg.imageBase64 && (
                    <img src={msg.imageBase64} alt="Anexo" className="max-h-32 rounded mb-1 border" style={{ borderColor: 'hsl(190 100% 50% / 0.15)' }} />
                  )}
                  <div
                    className="px-3 py-2 rounded-lg rounded-br-sm text-[11px] font-mono leading-relaxed"
                    style={{
                      background: 'hsl(190 100% 50% / 0.08)',
                      border: '1px solid hsl(190 100% 50% / 0.15)',
                      color: 'hsl(190 100% 85%)',
                    }}
                  >
                    {msg.attachmentName && msg.content.includes('[DOCUMENTO ANEXADO')
                      ? msg.content.replace(/\[DOCUMENTO ANEXADO:.*?\]\n```\n[\s\S]*?\n```\n\n/, '').trim() || `📎 ${msg.attachmentName}`
                      : msg.content}
                  </div>
                  {msg.ts && <span className="text-[6px] font-mono block text-right mt-0.5" style={{ color: 'hsl(190 100% 50% / 0.2)' }}>{formatTime(msg.ts)}</span>}
                </div>
              ) : (
                <div>
                  <div
                    className="px-3 py-2 rounded-lg rounded-bl-sm text-[11px] leading-relaxed transition-all duration-500"
                    style={{
                      borderLeft: `2px solid ${
                        (joiSpeech.speaking && i === messages.length - 1) ? 'hsl(38 100% 55% / 0.8)'
                          : detectEmotion(msg.content) === 'celebrating' ? 'hsl(42 90% 55% / 0.5)'
                            : detectEmotion(msg.content) === 'serious' ? 'hsl(32 80% 50% / 0.5)'
                              : 'hsl(190 100% 50% / 0.3)'
                      }`,
                      background: (joiSpeech.speaking && i === messages.length - 1) ? 'hsl(220 20% 7% / 0.8)' : 'hsl(220 20% 6% / 0.6)',
                      color: 'hsl(180 8% 82%)',
                      animation: (joiSpeech.speaking && i === messages.length - 1) ? 'joi-msg-speaking 2s ease-in-out infinite' : undefined,
                    }}
                  >
                    {joiSpeech.speaking && i === messages.length - 1 && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <SpeakingWave />
                        <span className="text-[7px] font-mono tracking-wider uppercase" style={{ color: 'hsl(38 100% 55% / 0.6)' }}>FALANDO</span>
                      </div>
                    )}
                    <JoiRichContent content={stripJoiCommands(stripKmzReadyBlock(msg.content))} />
                    {msg.cmdResults && msg.cmdResults.length > 0 && (
                      <JoiCommandFeedback results={msg.cmdResults} />
                    )}
                    {/* Render execution artifacts for last assistant message */}
                    {i === messages.length - 1 && !loading && lastTrace && lastTrace.artifacts.length > 0 && (
                      <JOIArtifactCanvas artifacts={lastTrace.artifacts} />
                    )}
                    {parseKmzReadyBlock(msg.content) && (
                      <button
                        onClick={() => {
                          const params = parseKmzReadyBlock(msg.content);
                          if (params) {
                            downloadAeroKmz(params);
                            import('sonner').then(({ toast }) => toast.success('🌍 KMZ exportado com sucesso!'));
                          }
                        }}
                        className="flex items-center gap-1.5 mt-2 px-3 py-2 rounded-lg text-[9px] font-mono tracking-wider uppercase transition-all hover:scale-105 active:scale-95"
                        style={{
                          background: 'hsl(190 100% 50% / 0.1)',
                          border: '1px solid hsl(190 100% 50% / 0.25)',
                          color: 'hsl(190 100% 70%)',
                        }}
                      >
                        <Globe className="h-3.5 w-3.5" />
                        Exportar KMZ Aeronáutica
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    {msg.ts && <span className="text-[6px] font-mono" style={{ color: 'hsl(190 100% 50% / 0.2)' }}>{formatTime(msg.ts)}</span>}
                    {!loading && (
                      <div className="flex gap-1 ml-auto">
                        {/* Play individual message */}
                        {joiSpeech.supported && (
                          <button
                            onClick={() => joiSpeech.speakSingle(msg.content)}
                            className="h-7 px-1.5 rounded-md flex items-center gap-1 transition-all hover:scale-105 active:scale-95"
                            style={{ background: 'hsl(38 100% 55% / 0.08)', border: '1px solid hsl(38 100% 55% / 0.15)' }}
                            title="Ouvir mensagem"
                          >
                            <Play className="h-3 w-3" style={{ color: 'hsl(38 100% 55% / 0.7)' }} />
                            <span className="text-[7px] font-mono" style={{ color: 'hsl(38 100% 55% / 0.6)' }}>OUVIR</span>
                          </button>
                        )}
                        <button
                          onClick={() => lazyExportPdf().then(fn => fn(msg.content))}
                          className="h-7 px-1.5 rounded-md flex items-center gap-1 transition-all hover:scale-105 active:scale-95"
                          style={{ background: 'hsl(190 100% 50% / 0.08)', border: '1px solid hsl(190 100% 50% / 0.15)' }}
                          title="Exportar PDF"
                        >
                          <FileText className="h-3 w-3" style={{ color: 'hsl(190 100% 50% / 0.7)' }} />
                          <span className="text-[7px] font-mono" style={{ color: 'hsl(190 100% 50% / 0.6)' }}>PDF</span>
                        </button>
                        <button
                          onClick={() => lazyExportDocx().then(fn => fn(msg.content))}
                          className="h-7 px-1.5 rounded-md flex items-center gap-1 transition-all hover:scale-105 active:scale-95"
                          style={{ background: 'hsl(160 70% 40% / 0.1)', border: '1px solid hsl(160 70% 40% / 0.2)' }}
                          title="Exportar DOCX"
                        >
                          <FileText className="h-3 w-3" style={{ color: 'hsl(160 70% 45% / 0.8)' }} />
                          <span className="text-[7px] font-mono" style={{ color: 'hsl(160 70% 45% / 0.7)' }}>DOCX</span>
                        </button>
                        <button
                          onClick={() => handleFeedback(i, 'up')}
                          className={cn("h-7 w-7 rounded-md flex items-center justify-center transition-all hover:scale-105 active:scale-95",
                            msg.feedback === 'up' ? "bg-green-500/20 border border-green-500/30" : "hover:bg-white/5"
                          )}
                        >
                          <ThumbsUp className="h-3 w-3" style={{ color: msg.feedback === 'up' ? 'hsl(120 70% 50%)' : 'hsl(190 100% 50% / 0.3)' }} />
                        </button>
                        <button
                          onClick={() => handleFeedback(i, 'down')}
                          className={cn("h-7 w-7 rounded-md flex items-center justify-center transition-all hover:scale-105 active:scale-95",
                            msg.feedback === 'down' ? "bg-red-500/20 border border-red-500/30" : "hover:bg-white/5"
                          )}
                        >
                          <ThumbsDown className="h-3 w-3" style={{ color: msg.feedback === 'down' ? 'hsl(0 70% 50%)' : 'hsl(190 100% 50% / 0.3)' }} />
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
              className="shrink-0 px-2 py-1 rounded text-[7px] font-mono tracking-wider uppercase transition-colors disabled:opacity-30 flex items-center gap-1"
              style={{
                background: 'hsl(38 100% 55% / 0.06)',
                border: '1px solid hsl(38 100% 55% / 0.12)',
                color: 'hsl(38 100% 60%)',
              }}
            >
              {'icon' in p && p.icon && <p.icon className="h-2.5 w-2.5" />}
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative z-10 p-2.5 shrink-0" style={{ borderTop: '1px solid hsl(190 100% 50% / 0.08)' }}>
        {/* Attachment preview */}
        {attachment && (
          <div className="flex items-center gap-2 mb-1.5 px-2 py-1.5 rounded-lg animate-fade-in" style={{ background: 'hsl(38 100% 55% / 0.06)', border: '1px solid hsl(38 100% 55% / 0.15)' }}>
            {attachment.type === 'image' ? (
              <img src={attachment.content} alt="Preview" className="h-8 w-8 rounded object-cover" style={{ border: '1px solid hsl(190 100% 50% / 0.2)' }} />
            ) : (
              <File className="h-4 w-4 shrink-0" style={{ color: 'hsl(38 100% 55% / 0.7)' }} />
            )}
            <span className="text-[9px] font-mono truncate flex-1" style={{ color: 'hsl(38 100% 65%)' }}>{attachment.file.name}</span>
            <span className="text-[7px] font-mono shrink-0" style={{ color: 'hsl(190 100% 50% / 0.3)' }}>{(attachment.file.size / 1024).toFixed(0)}KB</span>
            <button onClick={() => setAttachment(null)} className="shrink-0 hover:scale-110 transition-transform">
              <XCircle className="h-3.5 w-3.5" style={{ color: 'hsl(0 70% 55% / 0.6)' }} />
            </button>
          </div>
        )}
        <div
          className="flex items-end gap-1.5 rounded-lg px-3 py-2 transition-all duration-300"
          style={{
            background: 'hsl(220 20% 5%)',
            border: `1px solid ${isListening ? 'hsl(190 100% 50% / 0.5)' : isTyping ? 'hsl(190 100% 50% / 0.25)' : 'hsl(190 100% 50% / 0.08)'}`,
            boxShadow: isListening ? '0 0 15px hsl(190 100% 50% / 0.15)' : 'none',
          }}
        >
          {/* File attach button */}
          <input ref={fileInputRef} type="file" className="hidden" accept=".txt,.md,.csv,.json,.xml,.yaml,.yml,.log,.html,.css,.js,.ts,.py,.sql,.png,.jpg,.jpeg,.gif,.webp,.bmp" onChange={handleFileSelect} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="h-7 w-7 rounded flex items-center justify-center transition-all shrink-0 hover:scale-110 active:scale-90 disabled:opacity-20"
            style={{ background: attachment ? 'hsl(38 100% 55% / 0.15)' : 'transparent' }}
            title="Anexar documento ou imagem"
          >
            <Paperclip className="h-3.5 w-3.5" style={{ color: attachment ? 'hsl(38 100% 55%)' : 'hsl(190 100% 50% / 0.4)' }} />
          </button>
          <span className="text-[10px] font-mono shrink-0 pb-0.5" style={{ color: isListening ? 'hsl(190 100% 50% / 0.8)' : 'hsl(190 100% 50% / 0.4)' }}>
            {isListening ? '🎤' : '>_'}
          </span>
          <textarea
            ref={textareaRef}
            className="flex-1 bg-transparent border-none outline-none text-[11px] font-mono placeholder:text-[hsl(190_100%_50%/0.2)] resize-none overflow-hidden leading-relaxed"
            style={{ color: 'hsl(38 100% 80%)', caretColor: 'hsl(190 100% 50%)', minHeight: '20px', maxHeight: '80px' }}
            placeholder={isListening ? 'Ouvindo...' : attachment ? 'Descreva o que fazer com o arquivo...' : 'Comando... (Shift+Enter nova linha)'}
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
            disabled={(!input.trim() && !attachment) || loading}
            className="h-7 w-7 rounded flex items-center justify-center transition-all disabled:opacity-20 hover:scale-110 active:scale-90 shrink-0"
            style={{ background: (input.trim() || attachment) ? 'hsl(190 100% 50% / 0.15)' : 'transparent' }}
          >
            <Send className="h-3.5 w-3.5" style={{ color: 'hsl(190 100% 55%)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
