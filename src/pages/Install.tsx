/**
 * /install — Native install / sideload guide for FX Kontrol.
 *
 * The project ships as a Capacitor native shell (iOS + Android), not a PWA.
 * This page walks operators through pulling the repo, syncing Capacitor and
 * running the app on a physical device or emulator. It also offers the web
 * preview as a fallback so field crews always have a path to "open the app".
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Apple,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Github,
  Smartphone,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import PwaInstallHero from "@/components/pwa/PwaInstallHero";

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

const COMMANDS: { id: Platform | "common"; label: string; cmd: string }[] = [
  { id: "common", label: "1. Install JS deps", cmd: "npm install" },
  { id: "ios", label: "2a. Add iOS platform", cmd: "npx cap add ios" },
  { id: "android", label: "2b. Add Android platform", cmd: "npx cap add android" },
  { id: "common", label: "3. Build web bundle", cmd: "npm run build" },
  { id: "common", label: "4. Sync native shell", cmd: "npx cap sync" },
  { id: "ios", label: "5a. Run on iOS (Mac + Xcode)", cmd: "npx cap run ios" },
  { id: "android", label: "5b. Run on Android (Studio)", cmd: "npx cap run android" },
];

function CodeRow({ cmd }: { cmd: string }) {
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      toast.success("Comando copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs">
      <Terminal className="h-3.5 w-3.5 text-primary shrink-0" />
      <code className="flex-1 truncate text-foreground">{cmd}</code>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        onClick={onCopy}
        aria-label={`Copiar comando ${cmd}`}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default function Install() {
  const [platform, setPlatform] = useState<Platform>("other");
  useEffect(() => setPlatform(detectPlatform()), []);

  const defaultTab = useMemo<Platform>(
    () => (platform === "ios" ? "ios" : platform === "android" ? "android" : "ios"),
    [platform],
  );

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari home-screen flag
      (window.navigator as unknown as { standalone?: boolean }).standalone === true);

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur supports-[backdrop-filter]:bg-card/30">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <Badge variant="outline" className="font-mono text-[10px]">
            FX KONTROL · INSTALL
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <PwaInstallHero />

        <section className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Instalar FX Kontrol</h1>
          <p className="text-sm text-muted-foreground">
            O FX Kontrol é distribuído como aplicativo nativo (iOS + Android) via Capacitor — com acesso
            total a hardware (USB serial, BLE, NFC, câmera, GPS) que um app web puro não consegue oferecer
            de forma confiável em campo.
          </p>
          {isStandalone ? (
            <div className="inline-flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-xs text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Você já está rodando o app instalado.
            </div>
          ) : null}
        </section>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Build nativo (recomendado)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
              <li>
                Exporte o projeto via{" "}
                <span className="text-foreground font-medium">Export to Github</span> (botão no topo do
                editor Lovable) e clone seu repositório.
              </li>
              <li>
                Pré-requisitos: Node 18+, e{" "}
                <span className="text-foreground">Xcode</span> (iOS, exige Mac) ou{" "}
                <span className="text-foreground">Android Studio</span>.
              </li>
              <li>Rode os comandos abaixo no terminal, na raiz do projeto.</li>
            </ol>

            <Tabs defaultValue={defaultTab} className="w-full">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="ios" className="gap-1.5">
                  <Apple className="h-3.5 w-3.5" /> iOS
                </TabsTrigger>
                <TabsTrigger value="android" className="gap-1.5">
                  <Smartphone className="h-3.5 w-3.5" /> Android
                </TabsTrigger>
              </TabsList>

              {(["ios", "android"] as const).map((p) => (
                <TabsContent key={p} value={p} className="space-y-2 pt-3">
                  {COMMANDS.filter((c) => c.id === "common" || c.id === p).map((c) => (
                    <div key={`${p}-${c.label}`} className="space-y-1">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {c.label}
                      </div>
                      <CodeRow cmd={c.cmd} />
                    </div>
                  ))}
                </TabsContent>
              ))}
            </Tabs>

            <p className="text-[11px] text-muted-foreground">
              Após qualquer git pull, rode <code className="font-mono">npx cap sync</code> antes de
              <code className="font-mono"> npx cap run</code> para reaplicar mudanças nativas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Acesso rápido (web)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Sem máquina de build à mão? O FX Kontrol também roda no navegador móvel — útil para
              monitoramento read-only ou demos. Recursos de hardware crítico (USB/BLE/NFC) podem não
              estar disponíveis.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="default">
                <Link to="/">Abrir no navegador</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a
                  href="https://capacitorjs.com/docs/getting-started"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <Github className="mr-1.5 h-3.5 w-3.5" />
                  Docs Capacitor
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
