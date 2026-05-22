import { useState } from "react";
import { CheckCircle2, Download, Share, Plus, Smartphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { usePwaInstall } from "@/hooks/usePwaInstall";

/**
 * Full-bleed PWA install hero. Shows live status (installed / available / iOS manual /
 * unsupported) and a primary "Install app" button when the browser exposes a prompt.
 */
export default function PwaInstallHero() {
  const { status, isIOS, promptInstall } = usePwaInstall();
  const [busy, setBusy] = useState(false);

  const onInstall = async () => {
    setBusy(true);
    try {
      const outcome = await promptInstall();
      if (outcome === "accepted") toast.success("App instalado");
      else if (outcome === "dismissed") toast.message("Instalação cancelada");
      else toast.error("Prompt de instalação indisponível neste navegador");
    } finally {
      setBusy(false);
    }
  };

  const StatusBadge = () => {
    switch (status) {
      case "installed":
        return (
          <Badge className="bg-primary/15 text-primary border-primary/30 gap-1.5">
            <CheckCircle2 className="h-3 w-3" /> Instalado
          </Badge>
        );
      case "available":
        return (
          <Badge className="bg-accent text-accent-foreground border-accent gap-1.5">
            <Download className="h-3 w-3" /> Disponível
          </Badge>
        );
      case "ios-manual":
        return (
          <Badge variant="outline" className="gap-1.5">
            <Smartphone className="h-3 w-3" /> iOS — passos manuais
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1.5 text-muted-foreground">
            Não suportado neste navegador
          </Badge>
        );
    }
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card to-background p-6 sm:p-8">
      <div className="absolute inset-0 pointer-events-none opacity-30 [background:radial-gradient(circle_at_top_right,hsl(var(--primary)/0.25),transparent_60%)]" />
      <div className="relative space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <Smartphone className="h-3.5 w-3.5 text-primary" />
            FX Kontrol · PWA
          </div>
          <StatusBadge />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Instale como aplicativo
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl">
            Adicione o FX Kontrol à tela inicial para abrir em tela cheia, com cache offline
            e ícone próprio — sem passar pela App Store.
          </p>
        </div>

        {status === "installed" && (
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Você já está rodando o app instalado.
          </div>
        )}

        {status === "available" && (
          <Button size="lg" onClick={onInstall} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Instalar app
          </Button>
        )}

        {status === "ios-manual" && (
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-sm">
            <p className="font-medium text-foreground">Como instalar no iPhone / iPad</p>
            <ol className="space-y-1.5 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary font-mono text-xs mt-0.5">1.</span>
                <span className="flex items-center gap-1.5">
                  Toque em <Share className="inline h-3.5 w-3.5 text-primary" /> Compartilhar
                  na barra do Safari.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-mono text-xs mt-0.5">2.</span>
                <span className="flex items-center gap-1.5">
                  Escolha <Plus className="inline h-3.5 w-3.5 text-primary" />
                  <span className="font-medium text-foreground">Adicionar à Tela de Início</span>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-mono text-xs mt-0.5">3.</span>
                <span>Toque em <span className="font-medium text-foreground">Adicionar</span> no canto superior direito.</span>
              </li>
            </ol>
          </div>
        )}

        {status === "unsupported" && !isIOS && (
          <p className="text-xs text-muted-foreground">
            Seu navegador atual não expõe um prompt de instalação. Tente abrir esta página no
            <span className="text-foreground font-medium"> Chrome</span> ou
            <span className="text-foreground font-medium"> Edge</span> em desktop/Android, ou no
            <span className="text-foreground font-medium"> Safari</span> no iOS.
          </p>
        )}
      </div>
    </section>
  );
}
