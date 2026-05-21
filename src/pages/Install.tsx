import { useEffect, useState } from "react";
import { Share, Plus, Home, Smartphone, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type Platform = "ios" | "android" | "desktop" | "unknown";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua) || (ua.includes("mac") && "ontouchend" in document)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

export default function Install() {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true,
    );
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  if (isStandalone) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center p-6 bg-background text-foreground">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Home className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">FX KONTROL já está instalado</h1>
          <p className="text-muted-foreground">Você está rodando como aplicativo. Tudo certo.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-background text-foreground px-5 py-10 sm:py-16">
      <div className="mx-auto max-w-xl space-y-8">
        <header className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
            <Smartphone className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Instalar FX KONTROL</h1>
          <p className="text-muted-foreground">
            Adicione o app à tela inicial para abrir em tela cheia, com acesso rápido e suporte offline.
          </p>
        </header>

        {platform === "ios" && (
          <section className="rounded-2xl border border-border bg-card p-6 space-y-5">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="text-2xl"></span> Instalar no iPhone / iPad
            </h2>
            <ol className="space-y-4 text-sm">
              <li className="flex gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center">1</span>
                <div>
                  Abra esta página no <strong>Safari</strong> (não funciona em Chrome/Firefox no iOS).
                </div>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center">2</span>
                <div className="flex items-center gap-2 flex-wrap">
                  Toque no botão <strong>Compartilhar</strong>
                  <Share className="w-4 h-4 inline text-primary" />
                  na barra inferior.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center">3</span>
                <div className="flex items-center gap-2 flex-wrap">
                  Role e escolha <strong>Adicionar à Tela de Início</strong>
                  <Plus className="w-4 h-4 inline text-primary" />.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center">4</span>
                <div>
                  Toque em <strong>Adicionar</strong> no canto superior direito. O ícone aparecerá na sua tela inicial.
                </div>
              </li>
            </ol>
            <p className="text-xs text-muted-foreground border-t border-border pt-4">
              Dica: depois de instalado, abra sempre pelo ícone — algumas APIs (câmera, sensores) só funcionam no modo standalone.
            </p>
          </section>
        )}

        {platform === "android" && (
          <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-lg font-semibold">Instalar no Android</h2>
            {deferredPrompt ? (
              <Button onClick={handleNativeInstall} size="lg" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Instalar agora
              </Button>
            ) : (
              <ol className="space-y-3 text-sm">
                <li>1. Abra o menu (⋮) do Chrome.</li>
                <li>2. Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
                <li>3. Confirme em <strong>Instalar</strong>.</li>
              </ol>
            )}
          </section>
        )}

        {platform === "desktop" && (
          <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-lg font-semibold">Instalar no Desktop</h2>
            {deferredPrompt ? (
              <Button onClick={handleNativeInstall} size="lg" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Instalar FX KONTROL
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Procure o ícone de instalação (⊕) na barra de endereços do Chrome, Edge ou Brave.
              </p>
            )}
            <p className="text-xs text-muted-foreground border-t border-border pt-4">
              Para iPhone, abra <code className="px-1.5 py-0.5 rounded bg-muted">fxkontrol.online/install</code> no Safari do seu celular.
            </p>
          </section>
        )}

        <footer className="text-center text-xs text-muted-foreground">
          FX KONTROL · Minas FX
        </footer>
      </div>
    </main>
  );
}
