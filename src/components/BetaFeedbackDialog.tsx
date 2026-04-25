import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { Bug, Lightbulb, Plug, MessageSquare, Send, Loader2, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceProfile } from '@/lib/deviceCapability';

type Category = 'bug' | 'suggestion' | 'integration' | 'other';
type Severity = 'low' | 'medium' | 'high' | 'critical';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const APP_VERSION =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'beta';

const feedbackSchema = z.object({
  category: z.enum(['bug', 'suggestion', 'integration', 'other']),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  message: z
    .string()
    .trim()
    .min(10, 'Mensagem muito curta (mínimo 10 caracteres)')
    .max(2000, 'Mensagem muito longa (máximo 2000 caracteres)'),
  contact_email: z
    .string()
    .trim()
    .email('Email inválido')
    .max(255)
    .optional()
    .or(z.literal('')),
});

const CATEGORIES: { value: Category; label: string; Icon: typeof Bug }[] = [
  { value: 'bug', label: 'Bug', Icon: Bug },
  { value: 'suggestion', label: 'Sugestão', Icon: Lightbulb },
  { value: 'integration', label: 'Integração', Icon: Plug },
  { value: 'other', label: 'Outro', Icon: MessageSquare },
];

const SEVERITIES: { value: Severity; label: string; color: string }[] = [
  { value: 'low', label: 'Baixa', color: 'hsl(140 60% 50%)' },
  { value: 'medium', label: 'Média', color: 'hsl(48 100% 55%)' },
  { value: 'high', label: 'Alta', color: 'hsl(32 100% 55%)' },
  { value: 'critical', label: 'Crítica', color: 'hsl(0 80% 60%)' },
];

const MAX_FILES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

interface AttachmentMeta {
  path: string;
  name: string;
  size: number;
  type: string;
}

export default function BetaFeedbackDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [category, setCategory] = useState<Category>('bug');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Prefill email from auth user
  useEffect(() => {
    if (open && user?.email && !email) setEmail(user.email);
  }, [open, user, email]);

  // Auto-collected technical context
  const techContext = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const profile = getDeviceProfile();
    return {
      route: window.location.pathname + window.location.search,
      user_agent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x`,
      app_version: APP_VERSION,
      tier: profile.tier,
      memory_gb: profile.memory,
      cores: profile.cores,
      mobile: profile.isMobile,
    };
  }, [open]);

  const handleAddFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const next: File[] = [...files];
    const errors: string[] = [];
    Array.from(incoming).forEach((f) => {
      if (next.length >= MAX_FILES) {
        errors.push(`Máximo ${MAX_FILES} arquivos`);
        return;
      }
      if (!ACCEPTED_TYPES.includes(f.type)) {
        errors.push(`${f.name}: tipo não suportado`);
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        errors.push(`${f.name}: excede 5 MB`);
        return;
      }
      next.push(f);
    });
    setFiles(next);
    if (errors.length) {
      toast({ title: 'Alguns arquivos foram ignorados', description: errors.join(' · '), variant: 'destructive' });
    }
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const uploadAttachments = async (): Promise<AttachmentMeta[]> => {
    if (files.length === 0) return [];
    setUploading(true);
    const uploaded: AttachmentMeta[] = [];
    try {
      for (const f of files) {
        const ext = f.name.split('.').pop() || 'bin';
        const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
        const path = `beta-feedback/${(user?.id ?? 'anon')}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
        const { error } = await supabase.storage.from('assets').upload(path, f, {
          contentType: f.type,
          upsert: false,
        });
        if (error) throw error;
        uploaded.push({ path, name: f.name, size: f.size, type: f.type });
      }
      return uploaded;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    const parsed = feedbackSchema.safeParse({
      category,
      severity,
      message,
      contact_email: email || undefined,
    });

    if (!parsed.success) {
      toast({
        title: 'Verifique os campos',
        description: parsed.error.errors[0]?.message ?? 'Dados inválidos',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const attachments = await uploadAttachments();

      const { error } = await (supabase as any).from('beta_feedback').insert({
        user_id: user?.id ?? null,
        category: parsed.data.category,
        severity: parsed.data.severity ?? null,
        message: parsed.data.message,
        contact_email: parsed.data.contact_email || null,
        route: techContext?.route ?? null,
        user_agent: techContext?.user_agent ?? null,
        viewport: techContext?.viewport ?? null,
        app_version: techContext?.app_version ?? null,
        attachments,
        metadata: {
          tier: techContext?.tier,
          memory_gb: techContext?.memory_gb,
          cores: techContext?.cores,
          mobile: techContext?.mobile,
        },
      });

      if (error) throw error;

      toast({
        title: 'Feedback enviado',
        description: attachments.length
          ? `Obrigado! ${attachments.length} anexo(s) incluído(s).`
          : 'Obrigado por contribuir com a fase Beta!',
      });
      setMessage('');
      setSeverity('medium');
      setCategory('bug');
      setFiles([]);
      onOpenChange(false);
    } catch (err: any) {
      console.error('[BetaFeedback] submit failed', err);
      toast({
        title: 'Falha ao enviar',
        description: err?.message ?? 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="text-[10px] font-mono font-black tracking-[0.25em] px-2 py-0.5 rounded"
              style={{
                background: 'hsl(32 100% 50% / 0.18)',
                color: 'hsl(32 100% 65%)',
                border: '1px solid hsl(32 100% 50% / 0.4)',
              }}
            >
              BETA
            </span>
            Enviar Feedback
          </DialogTitle>
          <DialogDescription>
            Reporte bugs, sugira melhorias ou solicite integração com novos equipamentos.
            Contexto técnico do dispositivo é incluído automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Category */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Categoria
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(({ value, label, Icon }) => {
                const active = category === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCategory(value)}
                    className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2.5 text-[11px] font-medium transition-all ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background hover:bg-accent text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Severidade
            </label>
            <div className="grid grid-cols-4 gap-2">
              {SEVERITIES.map(({ value, label, color }) => {
                const active = severity === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSeverity(value)}
                    className={`rounded-md border px-2 py-2 text-[11px] font-medium transition-all ${
                      active ? 'border-current' : 'border-border hover:bg-accent'
                    }`}
                    style={active ? { color, borderColor: color, background: `${color.replace(')', ' / 0.1)')}` } : undefined}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Mensagem
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Descreva o bug, sugestão ou equipamento que deseja integrar. Inclua passos para reproduzir se for um bug."
              className="min-h-[120px] resize-none"
              maxLength={2000}
            />
            <div className="text-[10px] text-muted-foreground text-right mt-1">
              {message.length}/2000
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Email para resposta {user?.email && <span className="opacity-60">(pré-preenchido)</span>}
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              maxLength={255}
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Anexos <span className="opacity-60">(PNG/JPG/WEBP/PDF · até 5 MB · máx {MAX_FILES})</span>
            </label>
            <div className="flex items-center gap-2">
              <label
                className={`inline-flex items-center gap-2 rounded-md border border-dashed border-border bg-background hover:bg-accent px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${
                  files.length >= MAX_FILES ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <Paperclip className="h-3.5 w-3.5" />
                Adicionar arquivo
                <input
                  type="file"
                  multiple
                  accept={ACCEPTED_TYPES.join(',')}
                  className="hidden"
                  onChange={(e) => {
                    handleAddFiles(e.target.files);
                    e.target.value = '';
                  }}
                  disabled={files.length >= MAX_FILES}
                />
              </label>
              <span className="text-[10px] text-muted-foreground">
                {files.length}/{MAX_FILES}
              </span>
            </div>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => {
                  const isImg = f.type.startsWith('image/');
                  return (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-[11px]"
                    >
                      {isImg ? <ImageIcon className="h-3.5 w-3.5 text-primary" /> : <FileText className="h-3.5 w-3.5 text-primary" />}
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-muted-foreground text-[10px]">
                        {(f.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        aria-label={`Remover ${f.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Tech context preview */}
          {techContext && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-[10px] font-mono text-muted-foreground space-y-0.5">
              <div className="text-[9px] uppercase tracking-widest text-foreground/60 font-bold mb-1">
                Contexto técnico (auto)
              </div>
              <div>route: {techContext.route}</div>
              <div>viewport: {techContext.viewport}</div>
              <div>
                tier: {techContext.tier} · {techContext.memory_gb}GB · {techContext.cores} cores ·{' '}
                {techContext.mobile ? 'mobile' : 'desktop'}
              </div>
              <div>app: {techContext.app_version}</div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || message.trim().length < 10}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar Feedback
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
