import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "fxk:iframe-hw-warning-dismissed";

/**
 * Mostra um banner quando a aplicação está sendo executada dentro de
 * um iframe (preview do editor Lovable). Iframes do preview NÃO têm
 * permissão para WebSerial / WebUSB / WebBluetooth — qualquer tentativa
 * resulta em "Access to the feature is disallowed by permissions policy".
 *
 * Para testes reais de hardware, abra a URL publicada em uma nova aba.
 */
export function IframeHardwareWarning() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const inIframe = window.self !== window.top;
      const dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
      setShow(inIframe && !dismissed);
    } catch {
      // Cross-origin frame access throws → definitely in iframe.
      setShow(sessionStorage.getItem(DISMISS_KEY) !== "1");
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  const openExternal = () => {
    const url = window.location.href;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[9999] max-w-2xl w-[calc(100%-1rem)]">
      <div className="bg-amber-500/10 border border-amber-500/40 backdrop-blur-md rounded-lg px-3 py-2 flex items-center gap-3 shadow-lg">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-amber-100">
            Hardware desativado neste preview
          </p>
          <p className="text-[10px] text-amber-200/80 leading-tight">
            WebSerial / WebUSB / Bluetooth são bloqueados dentro do iframe do editor.
            Abra em nova aba para conectar dispositivos reais.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[10px] border-amber-500/40 text-amber-100 hover:bg-amber-500/20 shrink-0"
          onClick={openExternal}
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          Abrir em nova aba
        </Button>
        <button
          onClick={dismiss}
          aria-label="Fechar aviso"
          className="text-amber-300/70 hover:text-amber-100 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
