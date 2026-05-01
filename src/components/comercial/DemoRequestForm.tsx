/**
 * DemoRequestForm — formulário de solicitação de demo do /comercial.
 *
 * Persiste em `demo_requests` (Lovable Cloud) com RLS de insert público.
 * Faz upload privado de até 5 evidências em `demo-evidence/<sessionId>/`.
 * Dispara dois e-mails transacionais:
 *   1. notificação interna → vendas@fxkontrol.online
 *   2. confirmação ao remetente
 *
 * Validação: zod (client-side) + RLS WITH CHECK (server-side, defense-in-depth).
 * Tipos aceitos: PDF, PNG, JPG, WEBP, JSON, VVIZ. Limite 20MB por arquivo, 5 arquivos.
 *
 * Estilo: usa as variáveis do tema commercial (data-theme="commercial"),
 * NÃO contamina o app operacional.
 */
import { useId, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { CheckCircle2, Paperclip, X, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.json,.vviz";
const ACCEPTED_EXT = new Set(["pdf", "png", "jpg", "jpeg", "webp", "json", "vviz"]);

const PACKAGES = [
  { value: "Previs", label: "Previs — design e aprovação remota" },
  { value: "LiveOps", label: "LiveOps — operação real (recomendado)" },
  { value: "Enterprise", label: "Enterprise — contrato anual + SLA" },
  { value: "Não tenho certeza", label: "Não tenho certeza — me orientem" },
] as const;

const SCHEMA = z.object({
  name: z.string().trim().min(1, "Informe seu nome").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  company: z.string().trim().min(1, "Informe a empresa").max(200),
  role: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  packageInterest: z.string().trim().min(1).max(64),
  currentStack: z.string().trim().max(2000).optional().or(z.literal("")),
  showScale: z.string().trim().max(200).optional().or(z.literal("")),
  message: z.string().trim().max(4000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof SCHEMA>;
type Status = "idle" | "submitting" | "success" | "error";

const INITIAL: FormValues = {
  name: "",
  email: "",
  company: "",
  role: "",
  phone: "",
  packageInterest: "LiveOps",
  currentStack: "",
  showScale: "",
  message: "",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

export default function DemoRequestForm() {
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<FormValues>(INITIAL);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [fileError, setFileError] = useState<string>("");
  const [status, setStatus] = useState<Status>("idle");
  const [submitError, setSubmitError] = useState<string>("");

  const sessionId = useMemo(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }, []);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function handleFiles(list: FileList | null) {
    if (!list) return;
    setFileError("");
    const next: File[] = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        setFileError(`Máximo ${MAX_FILES} arquivos.`);
        break;
      }
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ACCEPTED_EXT.has(ext)) {
        setFileError(`Tipo não aceito: .${ext}. Use PDF, imagens, JSON ou VVIZ.`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        setFileError(`"${f.name}" excede 20MB.`);
        continue;
      }
      next.push(f);
    }
    setFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(idx: number) {
    setFiles((arr) => arr.filter((_, i) => i !== idx));
    setFileError("");
  }

  async function uploadEvidence(): Promise<string[]> {
    const paths: string[] = [];
    for (const f of files) {
      const safe = sanitizeFileName(f.name);
      const path = `${sessionId}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from("demo-evidence").upload(path, f, {
        upsert: false,
        contentType: f.type || "application/octet-stream",
      });
      if (error) throw new Error(`Falha ao enviar "${f.name}": ${error.message}`);
      paths.push(path);
    }
    return paths;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    const parsed = SCHEMA.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof FormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FormValues;
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setStatus("submitting");
    try {
      const evidence_paths = await uploadEvidence();
      const requestId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const { error: insertError } = await supabase.from("demo_requests").insert({
        id: requestId,
        name: parsed.data.name,
        email: parsed.data.email,
        company: parsed.data.company,
        role: parsed.data.role || null,
        phone: parsed.data.phone || null,
        package_interest: parsed.data.packageInterest,
        current_stack: parsed.data.currentStack || null,
        show_scale: parsed.data.showScale || null,
        message: parsed.data.message || null,
        evidence_paths,
        source: "comercial",
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
      });
      if (insertError) throw insertError;

      // Notification → vendas@ (best-effort; não bloqueia o sucesso visual)
      const templateData = {
        name: parsed.data.name,
        email: parsed.data.email,
        company: parsed.data.company,
        role: parsed.data.role || "—",
        phone: parsed.data.phone || "—",
        packageInterest: parsed.data.packageInterest,
        currentStack: parsed.data.currentStack || "—",
        showScale: parsed.data.showScale || "—",
        message: parsed.data.message || "—",
        evidenceCount: evidence_paths.length,
        requestId,
      };

      await Promise.allSettled([
        supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "demo-request-notification",
            recipientEmail: "vendas@fxkontrol.online",
            idempotencyKey: `demo-notify-${requestId}`,
            templateData,
          },
        }),
        supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "demo-request-confirmation",
            recipientEmail: parsed.data.email,
            idempotencyKey: `demo-confirm-${requestId}`,
            templateData: {
              name: parsed.data.name,
              packageInterest: parsed.data.packageInterest,
              company: parsed.data.company,
            },
          },
        }),
      ]);

      setStatus("success");
      setValues(INITIAL);
      setFiles([]);
    } catch (err) {
      console.error("[DemoRequestForm] submit failed", err);
      setSubmitError(err instanceof Error ? err.message : "Erro ao enviar. Tente novamente.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="c-card rounded-lg p-10 text-center max-w-2xl mx-auto">
        <CheckCircle2 className="w-12 h-12 c-cyan mx-auto mb-4" aria-hidden="true" />
        <h3 className="c-display text-2xl font-bold c-text mb-3">Solicitação recebida.</h3>
        <p className="c-text-muted mb-2">
          Enviamos uma confirmação para o seu e-mail.
        </p>
        <p className="c-text-muted text-sm">
          Nosso time técnico responde em <strong className="c-text">até 1 dia útil</strong> com
          uma proposta de demo guiada.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="c-cta-secondary mt-6 inline-block"
          style={{ padding: "10px 20px", borderRadius: 6, fontSize: 13 }}
        >
          Enviar outra solicitação
        </button>
      </div>
    );
  }

  return (
    <form
      id={formId}
      onSubmit={onSubmit}
      className="c-card rounded-lg p-6 sm:p-8 max-w-3xl mx-auto"
      noValidate
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nome *" error={errors.name}>
          <input
            type="text"
            autoComplete="name"
            required
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            className="c-input"
            maxLength={120}
          />
        </Field>
        <Field label="E-mail corporativo *" error={errors.email}>
          <input
            type="email"
            autoComplete="email"
            required
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            className="c-input"
            maxLength={255}
          />
        </Field>
        <Field label="Empresa / Produtora *" error={errors.company}>
          <input
            type="text"
            autoComplete="organization"
            required
            value={values.company}
            onChange={(e) => update("company", e.target.value)}
            className="c-input"
            maxLength={200}
          />
        </Field>
        <Field label="Cargo / função" error={errors.role}>
          <input
            type="text"
            autoComplete="organization-title"
            value={values.role ?? ""}
            onChange={(e) => update("role", e.target.value)}
            className="c-input"
            placeholder="Diretor técnico, Operador..."
            maxLength={120}
          />
        </Field>
        <Field label="Telefone / WhatsApp" error={errors.phone}>
          <input
            type="tel"
            autoComplete="tel"
            value={values.phone ?? ""}
            onChange={(e) => update("phone", e.target.value)}
            className="c-input"
            placeholder="+55 11 99999-0000"
            maxLength={40}
          />
        </Field>
        <Field label="Pacote de interesse *" error={errors.packageInterest}>
          <select
            value={values.packageInterest}
            onChange={(e) => update("packageInterest", e.target.value)}
            className="c-input"
            required
          >
            {PACKAGES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Tecnologia / stack atualmente em uso" error={errors.currentStack} className="mt-4">
        <textarea
          value={values.currentStack ?? ""}
          onChange={(e) => update("currentStack", e.target.value)}
          className="c-input"
          rows={3}
          placeholder="Ex: Finale 3D + FXK16 + Art-Net via Avolites; integração com FireOne 2.0; drones Skyfly."
          maxLength={2000}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <Field label="Escala típica do show" error={errors.showScale}>
          <input
            type="text"
            value={values.showScale ?? ""}
            onChange={(e) => update("showScale", e.target.value)}
            className="c-input"
            placeholder="500 cues / 12 controllers / 30k pessoas"
            maxLength={200}
          />
        </Field>
        <Field label="Anexar evidências (opcional)" hint={`PDF, imagens, JSON, VVIZ • até ${MAX_FILES} arquivos • 20MB cada`}>
          <label
            htmlFor={`${formId}-files`}
            className="c-input flex items-center gap-2 cursor-pointer"
            style={{ minHeight: 42 }}
          >
            <Paperclip className="w-4 h-4 c-text-muted" aria-hidden="true" />
            <span className="c-text-muted text-sm">
              {files.length === 0 ? "Selecionar arquivos" : `${files.length}/${MAX_FILES} selecionados`}
            </span>
          </label>
          <input
            id={`${formId}-files`}
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="sr-only"
          />
        </Field>
      </div>

      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between gap-3 text-sm border border-[hsl(var(--c-border-soft))] rounded px-3 py-2 bg-[hsl(var(--c-bg-elevated))]"
            >
              <span className="c-text truncate">{f.name}</span>
              <span className="c-mono c-text-subtle text-xs shrink-0">{formatBytes(f.size)}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="c-text-muted hover:c-text shrink-0"
                aria-label={`Remover ${f.name}`}
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {fileError && (
        <p className="mt-2 text-sm flex items-center gap-1.5" style={{ color: "hsl(var(--c-amber))" }}>
          <AlertCircle className="w-4 h-4" aria-hidden="true" /> {fileError}
        </p>
      )}

      <Field label="Mensagem para o time técnico" error={errors.message} className="mt-4">
        <textarea
          value={values.message ?? ""}
          onChange={(e) => update("message", e.target.value)}
          className="c-input"
          rows={4}
          placeholder="Conte sobre o show, a data alvo, principais riscos e o que precisa validar na demo."
          maxLength={4000}
        />
      </Field>

      {submitError && (
        <div
          role="alert"
          className="mt-4 p-3 rounded border text-sm flex items-start gap-2"
          style={{
            borderColor: "hsl(var(--c-amber))",
            color: "hsl(var(--c-amber))",
            background: "hsl(var(--c-amber) / 0.08)",
          }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{submitError}</span>
        </div>
      )}

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <p className="c-text-subtle text-xs">
          Ao enviar, você concorda com o uso destes dados para retorno comercial.
          Dados protegidos por RLS no Lovable Cloud.
        </p>
        <button
          type="submit"
          disabled={status === "submitting"}
          className="c-cta-primary inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ padding: "12px 20px", borderRadius: 6, fontSize: 14, minWidth: 200 }}
        >
          {status === "submitting" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Enviando…
            </>
          ) : (
            "Solicitar demo guiada"
          )}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="c-mono text-[11px] uppercase tracking-widest c-text-muted block mb-1.5">
        {label}
      </span>
      {children}
      {hint && !error && <span className="c-text-subtle text-xs mt-1 block">{hint}</span>}
      {error && (
        <span className="text-xs mt-1 block" style={{ color: "hsl(var(--c-amber))" }}>
          {error}
        </span>
      )}
    </label>
  );
}
