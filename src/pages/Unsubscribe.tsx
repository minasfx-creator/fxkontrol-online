/**
 * Unsubscribe — página pública para tokens enviados nos rodapés de e-mails
 * transacionais (vendas / confirmações de demo).
 *
 * Fluxo: GET valida token → botão "Confirmar" → POST processa → sucesso.
 * Tema "commercial" para visual coerente com /comercial.
 */
import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "loading" | "valid" | "invalid" | "already" | "submitting" | "done" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("loading");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "commercial");
    return () => document.documentElement.removeAttribute("data-theme");
  }, []);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      setErrMsg("Link inválido — token ausente.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_KEY } },
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.valid === true) setState("valid");
        else if (data.reason === "already_unsubscribed") setState("already");
        else {
          setState("invalid");
          setErrMsg(data.error ?? "Token inválido ou expirado.");
        }
      } catch (e) {
        if (cancelled) return;
        setState("error");
        setErrMsg(e instanceof Error ? e.message : "Erro de rede.");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function confirm() {
    setState("submitting");
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if ((data as any)?.success || (data as any)?.reason === "already_unsubscribed") {
        setState("done");
      } else {
        setState("error");
        setErrMsg("Não foi possível processar.");
      }
    } catch (e) {
      setState("error");
      setErrMsg(e instanceof Error ? e.message : "Erro ao processar.");
    }
  }

  return (
    <div data-theme="commercial" className="min-h-dvh c-bg flex items-center justify-center px-6 py-16">
      <div className="c-card rounded-lg p-8 sm:p-10 max-w-md w-full text-center">
        <div className="text-[10px] c-mono c-cyan uppercase tracking-widest mb-3">
          FX KONTROL · E-mails
        </div>
        {(state === "loading" || state === "submitting") && (
          <>
            <Loader2 className="w-10 h-10 c-cyan mx-auto mb-4 animate-spin" aria-hidden="true" />
            <h1 className="c-display text-xl font-bold c-text mb-2">
              {state === "loading" ? "Validando link…" : "Processando…"}
            </h1>
          </>
        )}
        {state === "valid" && (
          <>
            <h1 className="c-display text-2xl font-bold c-text mb-3">Cancelar inscrição</h1>
            <p className="c-text-muted text-sm mb-6">
              Você não receberá mais e-mails do FX KONTROL neste endereço.
            </p>
            <button
              onClick={confirm}
              className="c-cta-primary inline-block w-full"
              style={{ padding: "12px 20px", borderRadius: 6, fontSize: 14 }}
            >
              Confirmar cancelamento
            </button>
          </>
        )}
        {state === "done" && (
          <>
            <CheckCircle2 className="w-10 h-10 c-cyan mx-auto mb-4" aria-hidden="true" />
            <h1 className="c-display text-xl font-bold c-text mb-2">Pronto.</h1>
            <p className="c-text-muted text-sm">Inscrição cancelada com sucesso.</p>
          </>
        )}
        {state === "already" && (
          <>
            <CheckCircle2 className="w-10 h-10 c-text-muted mx-auto mb-4" aria-hidden="true" />
            <h1 className="c-display text-xl font-bold c-text mb-2">Já cancelado</h1>
            <p className="c-text-muted text-sm">Este e-mail já estava sem inscrição.</p>
          </>
        )}
        {(state === "invalid" || state === "error") && (
          <>
            <AlertCircle className="w-10 h-10 mx-auto mb-4" style={{ color: "hsl(var(--c-amber))" }} aria-hidden="true" />
            <h1 className="c-display text-xl font-bold c-text mb-2">
              {state === "invalid" ? "Link inválido" : "Erro"}
            </h1>
            <p className="c-text-muted text-sm">{errMsg}</p>
          </>
        )}
        <div className="mt-8">
          <Link to="/comercial" className="c-text-subtle text-xs hover:c-text">
            ← Voltar ao site
          </Link>
        </div>
      </div>
    </div>
  );
}
