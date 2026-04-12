/**
 * MermaidRenderer — Renders Mermaid diagrams inline as SVG
 * Uses dynamic import to avoid bundle bloat
 */
import { useEffect, useRef, useState } from 'react';

let mermaidInstance: any = null;
let mermaidLoading = false;
const mermaidQueue: (() => void)[] = [];

async function getMermaid() {
  if (mermaidInstance) return mermaidInstance;
  if (mermaidLoading) {
    return new Promise<any>(resolve => {
      mermaidQueue.push(() => resolve(mermaidInstance));
    });
  }
  mermaidLoading = true;
  const mod = await import('mermaid');
  mermaidInstance = mod.default;
  mermaidInstance.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
      darkMode: true,
      primaryColor: 'hsl(190, 100%, 20%)',
      primaryTextColor: 'hsl(190, 100%, 80%)',
      primaryBorderColor: 'hsl(190, 100%, 40%)',
      lineColor: 'hsl(190, 100%, 35%)',
      secondaryColor: 'hsl(220, 20%, 15%)',
      tertiaryColor: 'hsl(220, 20%, 10%)',
      fontFamily: 'ui-monospace, monospace',
      fontSize: '11px',
    },
    securityLevel: 'strict',
  });
  mermaidLoading = false;
  mermaidQueue.forEach(fn => fn());
  mermaidQueue.length = 0;
  return mermaidInstance;
}

export function MermaidRenderer({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mm = await getMermaid();
        if (cancelled) return;
        const { svg } = await mm.render(idRef.current, code.trim());
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || 'Mermaid render error');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <div className="px-2 py-1.5 rounded text-[9px] font-mono" style={{ background: 'hsl(0 70% 50% / 0.08)', border: '1px solid hsl(0 70% 50% / 0.15)', color: 'hsl(0 70% 65%)' }}>
        ⚠ Diagram error: {error}
      </div>
    );
  }

  return (
    <div className="my-2 rounded-lg overflow-hidden" style={{ background: 'hsl(220 20% 6%)', border: '1px solid hsl(190 100% 50% / 0.1)' }}>
      {loading && (
        <div className="px-3 py-2 text-[8px] font-mono tracking-wider" style={{ color: 'hsl(190 100% 50% / 0.4)' }}>
          RENDERING DIAGRAM...
        </div>
      )}
      <div ref={containerRef} className="p-2 [&_svg]:max-w-full [&_svg]:h-auto" />
    </div>
  );
}
