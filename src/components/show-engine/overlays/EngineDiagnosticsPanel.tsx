import { useEffect, useState } from 'react';
import { engineDiagnostics, type EngineDiagnostics } from '@/lib/showEngine/EngineDiagnostics';

export default function EngineDiagnosticsPanel() {
  const [d, setD] = useState<EngineDiagnostics>(engineDiagnostics.get());
  useEffect(() => engineDiagnostics.subscribe(setD), []);

  return (
    <div className="absolute bottom-2 right-2 z-30 rounded border border-border/60 bg-background/80 px-2 py-1 text-[10px] font-mono text-muted-foreground backdrop-blur-sm">
      <div>WebGL: {d.webglAvailable ? 'ok' : 'unavailable'}{d.contextLost ? ' · LOST' : ''}</div>
      <div>FPS: {d.fps.toFixed(1)} · draws: {d.drawCalls} · tris: {d.triangles}</div>
      <div>Objects: {d.sceneObjects}</div>
      {d.lastError && <div className="text-destructive">Err: {d.lastError}</div>}
    </div>
  );
}
