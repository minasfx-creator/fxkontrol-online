/**
 * DetachablePanel — wraps any panel with a "pop out" button that renders
 * the panel content into a separate browser window via React portal.
 */
import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DetachablePanelProps {
  title: string;
  children: ReactNode;
  width?: number;
  height?: number;
}

export default function DetachablePanel({ title, children, width = 420, height = 700 }: DetachablePanelProps) {
  const [detached, setDetached] = useState(false);
  const windowRef = useRef<Window | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const openWindow = useCallback(() => {
    const left = window.screenX + window.innerWidth - width - 50;
    const top = window.screenY + 80;
    const win = window.open(
      '',
      `panel-${title}`,
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );
    if (!win) return;

    // Copy stylesheets
    const styles = document.querySelectorAll('link[rel="stylesheet"], style');
    styles.forEach(s => {
      win.document.head.appendChild(s.cloneNode(true));
    });

    // Set base styles
    win.document.body.style.cssText = 'margin:0;padding:0;background:#0a0a0f;color:#e0e0e0;font-family:system-ui,sans-serif;overflow:auto;';
    win.document.title = `${title} — PyroForge`;

    // Create container
    const container = win.document.createElement('div');
    container.id = 'detached-root';
    container.style.cssText = 'width:100%;min-height:100vh;';
    win.document.body.appendChild(container);

    containerRef.current = container;
    windowRef.current = win;
    setDetached(true);

    win.addEventListener('beforeunload', () => {
      setDetached(false);
      windowRef.current = null;
      containerRef.current = null;
    });
  }, [title, width, height]);

  const reattach = useCallback(() => {
    if (windowRef.current) {
      windowRef.current.close();
    }
    windowRef.current = null;
    containerRef.current = null;
    setDetached(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (windowRef.current) windowRef.current.close();
    };
  }, []);

  if (detached && containerRef.current) {
    return (
      <>
        {/* Placeholder in main window */}
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 p-4 text-center">
          <ExternalLink className="w-5 h-5 text-primary" />
          <p className="text-xs font-mono-code">{title}</p>
          <p className="text-[10px]">Detached — open in separate window</p>
          <button
            onClick={reattach}
            className="text-[10px] px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors mt-1"
          >
            <Minimize2 className="w-3 h-3 inline mr-1" />
            Reattach
          </button>
        </div>
        {/* Portal into external window */}
        {createPortal(children, containerRef.current)}
      </>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      <button
        onClick={openWindow}
        className="absolute top-1 right-1 z-10 p-1 rounded hover:bg-surface-3/60 text-muted-foreground hover:text-foreground transition-colors"
        title="Pop out to separate window"
      >
        <ExternalLink className="w-3 h-3" />
      </button>
      {children}
    </div>
  );
}
