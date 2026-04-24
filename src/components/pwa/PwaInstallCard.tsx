import { Link } from "react-router-dom";
import { CheckCircle2, Download, Smartphone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { toast } from "@/components/ui/sonner";
import { useState } from "react";

/**
 * Compact PWA install card for the home/dashboard.
 * - "installed" → silent (renders nothing)
 * - "available" → inline Install button + link to /install
 * - "ios-manual" / "unsupported" → soft hint with link to /install
 */
export default function PwaInstallCard() {
  const { status, promptInstall } = usePwaInstall();
  const [busy, setBusy] = useState(false);

  if (status === "installed") return null;

  const onInstall = async () => {
    setBusy(true);
    try {
      const outcome = await promptInstall();
      if (outcome === "accepted") toast.success("App instalado");
      else if (outcome === "dismissed") toast.message("Instalação cancelada");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-card/60 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        {status === "available" ? (
          <Download className="h-4 w-4 text-primary shrink-0" />
        ) : (
          <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground truncate">
            {status === "available"
              ? "Instale o FX Kontrol como app"
              : status === "ios-manual"
                ? "Adicionar à Tela de Início (iOS)"
                : "Instalação como app"}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {status === "available"
              ? "Abra em tela cheia, com cache offline."
              : status === "ios-manual"
                ? "Use Compartilhar → Adicionar à Tela de Início no Safari."
                : "Disponível em Chrome, Edge e Safari iOS."}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {status === "available" && (
          <Button size="sm" onClick={onInstall} disabled={busy} className="h-7 px-2.5 gap-1 text-xs">
            <Download className="h-3 w-3" /> Instalar
          </Button>
        )}
        <Button asChild size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs text-muted-foreground">
          <Link to="/install">
            Detalhes <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
