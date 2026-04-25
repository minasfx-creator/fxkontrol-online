import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Loader2, CheckCircle2, Mail, Sparkles, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * EarlyAccessForm — formulário público de cadastro para Early Access da /landing.
 *
 * Persiste em `public.early_access_signups` via Supabase (RLS: insert anon+auth).
 * Mostra confirmação inline após sucesso. Sem PII em logs.
 *
 * Estados granulares:
 *   - `submitting`: bloqueia inputs via <fieldset disabled> (preserva valores) +
 *     skeleton shimmer nos labels + barra indeterminada no botão.
 *   - `lastError`: exibe banner com CTA "Tentar novamente" (retry preserva os
 *     valores já digitados — usamos uncontrolled inputs).
 *   - `errors`: erros de validação por campo (Zod), com `aria-invalid` e
 *     mensagem associada via `aria-describedby`.
 */

const SignupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido").max(255),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  use_case: z.string().trim().max(1000).optional().or(z.literal("")),
});

type FieldErrors = Partial<Record<"email" | "name" | "company" | "use_case", string>>;

/** Label com skeleton shimmer enquanto `loading=true`. */
function FieldLabel({
  htmlFor,
  loading,
  required,
  children,
}: {
  htmlFor: string;
  loading: boolean;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor} className="flex items-center gap-2">
      <span className={cn(loading && "opacity-60")}>{children}</span>
      {required && (
        <span aria-hidden="true" className="text-destructive">*</span>
      )}
      {loading && (
        <span
          aria-hidden="true"
          className="ml-auto h-1 w-10 overflow-hidden rounded-full bg-muted"
        >
          <span className="block h-full w-full animate-pulse bg-primary/60" />
        </span>
      )}
    </Label>
  );
}

export function EarlyAccessForm() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [lastError, setLastError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const fd = new FormData(e.currentTarget);
    const raw = {
      email: String(fd.get("email") ?? ""),
      name: String(fd.get("name") ?? ""),
      company: String(fd.get("company") ?? ""),
      use_case: String(fd.get("use_case") ?? ""),
    };

    const parsed = SignupSchema.safeParse(raw);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors({
        email: flat.email?.[0],
        name: flat.name?.[0],
        company: flat.company?.[0],
        use_case: flat.use_case?.[0],
      });
      setLastError(null);
      return;
    }
    setErrors({});
    setLastError(null);
    setSubmitting(true);

    try {
      const payload = {
        email: parsed.data.email,
        name: parsed.data.name || null,
        company: parsed.data.company || null,
        use_case: parsed.data.use_case || null,
        source: "landing",
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
        referrer: typeof document !== "undefined" ? document.referrer.slice(0, 500) || null : null,
      };

      // Cast: tipos do Supabase ainda não regenerados após a migration recente.
      const { error } = await (supabase as any).from("early_access_signups").insert(payload);

      if (error) {
        // Unique violation no índice case-insensitive em email
        if (error.code === "23505") {
          setDone(true);
          toast.success("Você já está na lista — obrigado!");
          return;
        }
        throw error;
      }

      setDone(true);
      toast.success("Cadastro recebido! Entraremos em contato em breve.");
    } catch (err) {
      // Mantém os valores digitados (uncontrolled inputs) — usuário pode
      // simplesmente clicar em "Tentar novamente".
      const msg = "Não foi possível enviar agora. Verifique sua conexão e tente novamente.";
      setLastError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card className="mx-auto max-w-xl border-border/60 bg-card/40 p-8 text-center backdrop-blur">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--success)/0.15)]">
          <CheckCircle2 aria-hidden="true" className="h-6 w-6 text-[hsl(var(--success))]" />
        </div>
        <h3 className="text-xl font-bold tracking-tight">Você está na lista 🚀</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Recebemos seu cadastro para o Early Access do FX KONTROL. Vamos entrar em contato pelo e-mail informado
          assim que sua vaga for liberada.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-6 rounded-full"
          onClick={() => setDone(false)}
        >
          Cadastrar outro e-mail
        </Button>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "mx-auto max-w-xl border-border/60 bg-card/40 p-6 backdrop-blur transition-opacity sm:p-8",
        submitting && "opacity-95",
      )}
      aria-busy={submitting}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {/* fieldset disabled = bloqueia TODOS os controles aninhados sem
            limpar valores (uncontrolled) — preserva entrada após falha. */}
        <fieldset disabled={submitting} className="space-y-4 disabled:cursor-not-allowed">
          {lastError && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Falha ao enviar</p>
                <p className="mt-0.5 opacity-90">{lastError}</p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <FieldLabel htmlFor="ea-email" loading={submitting} required>
              E-mail
            </FieldLabel>
            <div className="relative">
              <Mail
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground",
                  submitting && "opacity-50",
                )}
              />
              <Input
                id="ea-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="voce@empresa.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "ea-email-error" : undefined}
                className={cn(
                  "pl-9",
                  submitting && "animate-pulse",
                  errors.email && "border-destructive focus-visible:ring-destructive",
                )}
              />
            </div>
            {errors.email && (
              <p id="ea-email-error" role="alert" className="text-xs text-destructive">
                {errors.email}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="ea-name" loading={submitting}>
                Nome
              </FieldLabel>
              <Input
                id="ea-name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Seu nome"
                maxLength={120}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "ea-name-error" : undefined}
                className={cn(
                  submitting && "animate-pulse",
                  errors.name && "border-destructive focus-visible:ring-destructive",
                )}
              />
              {errors.name && (
                <p id="ea-name-error" role="alert" className="text-xs text-destructive">
                  {errors.name}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="ea-company" loading={submitting}>
                Empresa
              </FieldLabel>
              <Input
                id="ea-company"
                name="company"
                type="text"
                autoComplete="organization"
                placeholder="Sua empresa"
                maxLength={160}
                aria-invalid={!!errors.company}
                aria-describedby={errors.company ? "ea-company-error" : undefined}
                className={cn(
                  submitting && "animate-pulse",
                  errors.company && "border-destructive focus-visible:ring-destructive",
                )}
              />
              {errors.company && (
                <p id="ea-company-error" role="alert" className="text-xs text-destructive">
                  {errors.company}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="ea-use-case" loading={submitting}>
              Como pretende usar o FX KONTROL?
            </FieldLabel>
            <Textarea
              id="ea-use-case"
              name="use_case"
              placeholder="Pirotecnia, drones, lasers, SFX… conte um pouco do show."
              maxLength={1000}
              rows={3}
              aria-invalid={!!errors.use_case}
              aria-describedby={errors.use_case ? "ea-use-case-error" : undefined}
              className={cn(
                submitting && "animate-pulse",
                errors.use_case && "border-destructive focus-visible:ring-destructive",
              )}
            />
            {errors.use_case && (
              <p id="ea-use-case-error" role="alert" className="text-xs text-destructive">
                {errors.use_case}
              </p>
            )}
          </div>
        </fieldset>

        <Button
          type="submit"
          size="lg"
          disabled={submitting}
          aria-live="polite"
          className="relative h-12 w-full overflow-hidden rounded-full text-sm font-bold shadow-[0_10px_40px_hsl(var(--primary)/0.35)]"
        >
          {/* Barra indeterminada de progresso (somente durante envio) */}
          {submitting && (
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-primary-foreground/10"
            >
              <span className="block h-full w-1/3 animate-[fxk-shimmer_1.2s_ease-in-out_infinite] bg-primary-foreground/70" />
            </span>
          )}
          {submitting ? (
            <>
              <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
              Enviando…
            </>
          ) : lastError ? (
            <>
              <RotateCcw aria-hidden="true" className="mr-2 h-4 w-4" />
              Tentar novamente
            </>
          ) : (
            <>
              <Sparkles aria-hidden="true" className="mr-2 h-4 w-4" />
              Quero acesso antecipado
            </>
          )}
        </Button>

        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          Ao enviar, você concorda em receber comunicações sobre o Early Access. Sem spam.
        </p>
      </form>
    </Card>
  );
}

export default EarlyAccessForm;
